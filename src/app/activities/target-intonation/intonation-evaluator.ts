import { PitchEstimate } from '../../core/activity/activity-context';
import { centsBetween } from '../../core/music/pitch-math';
import { NoteTarget } from '../../instruments/instrument-definition';
import {
  IntonationBand,
  IntonationEvaluation,
  IntonationEvaluationConfig,
  IntonationAttemptMetrics,
  IntonationFeedback
} from './target-intonation.types';

const CHROMATIC_IDENTITY_BOUNDARY_CENTS = 50;
const FLOATING_POINT_EPSILON = 1e-9;

interface StabilitySample {
  readonly capturedAtMs: number;
  readonly cents: number;
}

/**
 * Pure target-relative pitch evaluation. The evaluator owns no clock or input
 * resource; all timing comes from deterministic sample timestamps.
 */
export class IntonationEvaluator {
  private readonly validCents: number[] = [];
  private stabilityWindow: StabilitySample[] = [];
  private firstValidAtMs?: number;
  private stableHoldAtMs?: number;
  private lastSampleAtMs?: number;
  private wrongNoteCount = 0;

  constructor(
    private readonly target: NoteTarget,
    private readonly config: IntonationEvaluationConfig,
    private readonly attemptStartedAtMs: number
  ) {
    this.validateConfiguration();
  }

  evaluate(estimate: PitchEstimate): IntonationEvaluation {
    if (!this.hasValidTimestamp(estimate)) {
      return this.resetWith('invalid-estimate', estimate.capturedAtMs);
    }

    const signalGap = this.lastSampleAtMs === undefined
      ? 0
      : estimate.capturedAtMs - this.lastSampleAtMs;
    this.lastSampleAtMs = estimate.capturedAtMs;

    if (signalGap > this.config.maximumSignalGapMs) {
      this.resetStability();
    }

    if (estimate.kind === 'unvoiced') {
      const band: IntonationBand = estimate.reason === 'silence'
        ? 'no-signal'
        : estimate.reason === 'invalid'
          ? 'invalid-estimate'
          : 'out-of-detector-range';
      return this.resetWith(band, estimate.capturedAtMs);
    }

    if (!Number.isFinite(estimate.frequencyHz) || estimate.frequencyHz <= 0) {
      return this.resetWith(
        'invalid-estimate',
        estimate.capturedAtMs,
        estimate.frequencyHz
      );
    }

    if (
      estimate.frequencyHz < this.config.detectorMinimumHz
      || estimate.frequencyHz > this.config.detectorMaximumHz
    ) {
      return this.resetWith(
        'out-of-detector-range',
        estimate.capturedAtMs,
        estimate.frequencyHz
      );
    }

    const cents = centsBetween(
      estimate.frequencyHz,
      this.target.expectedSoundingFrequencyHz
    );
    if (cents === null) {
      return this.resetWith(
        'invalid-estimate',
        estimate.capturedAtMs,
        estimate.frequencyHz
      );
    }
    const detectedSoundingMidi = Math.round(
      69 + (12 * Math.log2(estimate.frequencyHz / this.target.referenceA4Hz))
    );

    // At exactly half a semitone there is no unique nearest chromatic note, so
    // the estimate is conservatively rejected as not the explicit target.
    if (
      Math.abs(cents) + FLOATING_POINT_EPSILON
      >= CHROMATIC_IDENTITY_BOUNDARY_CENTS
    ) {
      this.wrongNoteCount += 1;
      this.resetStability();
      return this.result(
        'wrong-note',
        estimate.capturedAtMs,
        false,
        estimate.frequencyHz,
        detectedSoundingMidi,
        cents
      );
    }

    this.validCents.push(cents);
    this.firstValidAtMs ??= estimate.capturedAtMs;

    const pitchBand = this.pitchBand(cents);
    if (pitchBand !== 'within-tolerance') {
      this.resetStability();
      return this.result(
        pitchBand,
        estimate.capturedAtMs,
        false,
        estimate.frequencyHz,
        detectedSoundingMidi,
        cents
      );
    }

    this.stabilityWindow.push({
      capturedAtMs: estimate.capturedAtMs,
      cents
    });

    if (this.windowSpread() > this.config.maximumSpreadCents) {
      this.stabilityWindow = [{
        capturedAtMs: estimate.capturedAtMs,
        cents
      }];
      return this.result(
        'unstable',
        estimate.capturedAtMs,
        false,
        estimate.frequencyHz,
        detectedSoundingMidi,
        cents
      );
    }

    const stableForMs = this.stableForMs();
    const stableHoldAchieved =
      this.stabilityWindow.length >= this.config.minimumValidEstimates
      && stableForMs >= this.config.requiredStableMs;
    if (stableHoldAchieved) {
      this.stableHoldAtMs ??= estimate.capturedAtMs;
    }

    return this.result(
      'within-tolerance',
      estimate.capturedAtMs,
      stableHoldAchieved,
      estimate.frequencyHz,
      detectedSoundingMidi,
      cents
    );
  }

  metrics(): IntonationAttemptMetrics {
    return {
      timeToFirstValidEstimateMs: this.firstValidAtMs === undefined
        ? undefined
        : this.firstValidAtMs - this.attemptStartedAtMs,
      timeToStableHoldMs: this.stableHoldAtMs === undefined
        ? undefined
        : this.stableHoldAtMs - this.attemptStartedAtMs,
      validEstimateCount: this.validCents.length,
      wrongNoteCount: this.wrongNoteCount,
      medianCents: percentile(this.validCents, 0.5),
      absoluteErrorP95Cents: percentile(
        this.validCents.map(value => Math.abs(value)),
        0.95
      ),
      spreadCents: this.validCents.length === 0
        ? undefined
        : Math.max(...this.validCents) - Math.min(...this.validCents)
    };
  }

  private result(
    band: IntonationBand,
    capturedAtMs: number,
    stableHoldAchieved: boolean,
    detectedFrequencyHz?: number,
    detectedSoundingMidi?: number,
    centsFromTarget?: number
  ): IntonationEvaluation {
    const stableForMs = this.stableForMs();
    const feedback: IntonationFeedback = {
      band,
      target: this.target,
      capturedAtMs,
      detectedFrequencyHz,
      detectedSoundingMidi,
      centsFromTarget,
      stableForMs,
      requiredStableMs: this.config.requiredStableMs,
      stableProgress: Math.min(
        1,
        stableForMs / this.config.requiredStableMs
      ),
      stabilityEstimateCount: this.stabilityWindow.length,
      validEstimateCount: this.validCents.length,
      wrongNoteCount: this.wrongNoteCount
    };

    return {
      feedback,
      stableHoldAchieved
    };
  }

  private resetWith(
    band: IntonationBand,
    capturedAtMs: number,
    detectedFrequencyHz?: number
  ): IntonationEvaluation {
    this.resetStability();
    return this.result(
      band,
      capturedAtMs,
      false,
      detectedFrequencyHz
    );
  }

  private pitchBand(cents: number): IntonationBand {
    if (cents <= -this.config.farThresholdCents + FLOATING_POINT_EPSILON) {
      return 'far-flat';
    }
    if (cents < -this.config.toleranceCents - FLOATING_POINT_EPSILON) {
      return 'flat';
    }
    if (cents <= this.config.toleranceCents + FLOATING_POINT_EPSILON) {
      return 'within-tolerance';
    }
    if (cents < this.config.farThresholdCents - FLOATING_POINT_EPSILON) {
      return 'sharp';
    }
    return 'far-sharp';
  }

  private hasValidTimestamp(estimate: PitchEstimate): boolean {
    return Number.isFinite(estimate.capturedAtMs)
      && Number.isFinite(estimate.emittedAtMs)
      && estimate.capturedAtMs >= this.attemptStartedAtMs
      && estimate.emittedAtMs >= estimate.capturedAtMs
      && (
        this.lastSampleAtMs === undefined
        || estimate.capturedAtMs > this.lastSampleAtMs
      );
  }

  private stableForMs(): number {
    if (this.stabilityWindow.length < 2) {
      return 0;
    }
    return this.stabilityWindow[this.stabilityWindow.length - 1].capturedAtMs
      - this.stabilityWindow[0].capturedAtMs;
  }

  private windowSpread(): number {
    const cents = this.stabilityWindow.map(sample => sample.cents);
    return cents.length === 0 ? 0 : Math.max(...cents) - Math.min(...cents);
  }

  private resetStability(): void {
    this.stabilityWindow = [];
  }

  private validateConfiguration(): void {
    const finitePositive = [
      this.target.expectedSoundingFrequencyHz,
      this.target.referenceA4Hz,
      this.config.toleranceCents,
      this.config.farThresholdCents,
      this.config.requiredStableMs,
      this.config.maximumSpreadCents,
      this.config.minimumValidEstimates,
      this.config.maximumSignalGapMs,
      this.config.detectorMinimumHz,
      this.config.detectorMaximumHz
    ].every(value => Number.isFinite(value) && value > 0);

    if (
      !finitePositive
      || !Number.isFinite(this.attemptStartedAtMs)
      || this.config.toleranceCents >= this.config.farThresholdCents
      || this.config.farThresholdCents >= CHROMATIC_IDENTITY_BOUNDARY_CENTS
      || !Number.isInteger(this.config.minimumValidEstimates)
      || this.config.detectorMinimumHz >= this.config.detectorMaximumHz
    ) {
      throw new Error('Invalid intonation evaluation configuration');
    }
  }
}

function percentile(values: readonly number[], quantile: number): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil(quantile * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}
