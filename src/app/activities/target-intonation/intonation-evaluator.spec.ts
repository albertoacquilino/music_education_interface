import { PitchEstimate } from '../../core/activity/activity-context';
import {
  InstrumentRegistryService
} from '../../instruments/instrument-registry.service';
import { NoteTarget } from '../../instruments/instrument-definition';
import { IntonationEvaluator } from './intonation-evaluator';
import {
  IntonationEvaluationConfig,
  TARGET_INTONATION_DEFAULTS
} from './target-intonation.types';

describe('IntonationEvaluator', () => {
  const registry = new InstrumentRegistryService();
  const instrument = registry.get('oboe-c');
  const note = instrument.notes.find(candidate => candidate.displayTokens[0] === 'A4')
    ?? instrument.notes[0];
  const target = registry.resolveTarget('oboe-c', note.id, 440);
  const config: IntonationEvaluationConfig = {
    toleranceCents: TARGET_INTONATION_DEFAULTS.toleranceCents,
    farThresholdCents: TARGET_INTONATION_DEFAULTS.farThresholdCents,
    requiredStableMs: TARGET_INTONATION_DEFAULTS.requiredStableMs,
    maximumSpreadCents: TARGET_INTONATION_DEFAULTS.maximumSpreadCents,
    minimumValidEstimates: TARGET_INTONATION_DEFAULTS.minimumValidEstimates,
    maximumSignalGapMs: TARGET_INTONATION_DEFAULTS.maximumSignalGapMs,
    detectorMinimumHz: TARGET_INTONATION_DEFAULTS.detectorMinimumHz,
    detectorMaximumHz: TARGET_INTONATION_DEFAULTS.detectorMaximumHz
  };

  it('evaluates the exact explicit target frequency within tolerance', () => {
    const result = evaluator().evaluate(voiced(target.expectedSoundingFrequencyHz, 0));

    expect(result.feedback.band).toBe('within-tolerance');
    expect(result.feedback.centsFromTarget).toBeCloseTo(0, 9);
    expect(result.feedback.detectedSoundingMidi).toBe(note.soundingMidiAtA4_440);
  });

  it('includes both exact tolerance boundaries in the acceptance window', () => {
    const flat = evaluator().evaluate(atCents(target, -config.toleranceCents, 0));
    const sharp = evaluator().evaluate(atCents(target, config.toleranceCents, 0));

    expect(flat.feedback.band).toBe('within-tolerance');
    expect(sharp.feedback.band).toBe('within-tolerance');
  });

  it('distinguishes flat and sharp bands outside tolerance', () => {
    expect(evaluator().evaluate(atCents(target, -20, 0)).feedback.band)
      .toBe('flat');
    expect(evaluator().evaluate(atCents(target, 20, 0)).feedback.band)
      .toBe('sharp');
  });

  it('places the exact far thresholds in the far-flat and far-sharp bands', () => {
    expect(evaluator().evaluate(atCents(target, -30, 0)).feedback.band)
      .toBe('far-flat');
    expect(evaluator().evaluate(atCents(target, 30, 0)).feedback.band)
      .toBe('far-sharp');
  });

  it('rejects a different chromatic note even when that note is internally in tune', () => {
    const semitoneAboveTarget = target.expectedSoundingFrequencyHz * Math.pow(2, 1 / 12);
    const result = evaluator().evaluate(voiced(semitoneAboveTarget, 0));

    expect(result.feedback.band).toBe('wrong-note');
    expect(result?.stableHoldAchieved).toBeFalse();
    expect(result.feedback.centsFromTarget).toBeCloseTo(100, 8);
  });

  it('conservatively rejects both exact half-semitone identity boundaries', () => {
    expect(evaluator().evaluate(atCents(target, -50, 0)).feedback.band)
      .toBe('wrong-note');
    expect(evaluator().evaluate(atCents(target, 50, 0)).feedback.band)
      .toBe('wrong-note');
  });

  it('uses the expected sounding target for a transposing instrument', () => {
    const trumpet = registry.get('trumpet-bb');
    const trumpetNote = trumpet.notes[0];
    const trumpetTarget = registry.resolveTarget(
      'trumpet-bb',
      trumpetNote.id,
      440
    );
    const writtenFrequency = 440 * Math.pow(
      2,
      (trumpetNote.writtenMidi - 69) / 12
    );

    expect(new IntonationEvaluator(trumpetTarget, config, 0)
      .evaluate(voiced(trumpetTarget.expectedSoundingFrequencyHz, 0))
      .feedback.band).toBe('within-tolerance');
    expect(new IntonationEvaluator(trumpetTarget, config, 0)
      .evaluate(voiced(writtenFrequency, 0))
      .feedback.band).toBe('wrong-note');
  });

  [430, 440, 450].forEach(referenceA4Hz => {
    it(`evaluates the target generated for A4=${referenceA4Hz} Hz`, () => {
      const referenceTarget = registry.resolveTarget(
        'oboe-c',
        note.id,
        referenceA4Hz
      );
      const result = new IntonationEvaluator(referenceTarget, config, 0)
        .evaluate(voiced(referenceTarget.expectedSoundingFrequencyHz, 0));

      expect(result.feedback.band).toBe('within-tolerance');
      expect(result.feedback.centsFromTarget).toBeCloseTo(0, 9);
    });
  });

  it('reports silence as no signal and resets stability', () => {
    const instance = evaluator({
      requiredStableMs: 300,
      maximumSignalGapMs: 200
    });
    instance.evaluate(atCents(target, 0, 0));
    instance.evaluate(atCents(target, 0, 100));

    const silence = instance.evaluate(unvoiced('silence', 200));
    const recovered = instance.evaluate(atCents(target, 0, 300));

    expect(silence.feedback.band).toBe('no-signal');
    expect(silence.feedback.stableForMs).toBe(0);
    expect(recovered.feedback.stableForMs).toBe(0);
  });

  it('rejects non-finite, non-positive, and detector-reported invalid estimates', () => {
    expect(evaluator().evaluate(voiced(Number.NaN, 0)).feedback.band)
      .toBe('invalid-estimate');
    expect(evaluator().evaluate(voiced(0, 0)).feedback.band)
      .toBe('invalid-estimate');
    expect(evaluator().evaluate(unvoiced('invalid', 0)).feedback.band)
      .toBe('invalid-estimate');
  });

  it('reports voiced and detector-reported out-of-range estimates', () => {
    expect(evaluator().evaluate(voiced(config.detectorMinimumHz - 1, 0))
      .feedback.band).toBe('out-of-detector-range');
    expect(evaluator().evaluate(unvoiced('out-of-range', 0)).feedback.band)
      .toBe('out-of-detector-range');
  });

  it('does not pass the duration threshold with insufficient valid estimates', () => {
    const instance = evaluator({
      minimumValidEstimates: 5,
      maximumSignalGapMs: 500
    });
    const result = [0, 500, 1000, 1500]
      .map(timestamp => instance.evaluate(atCents(target, 0, timestamp)))
      .pop();

    expect(result?.feedback.stableForMs).toBe(1500);
    expect(result?.stableHoldAchieved).toBeFalse();
  });

  it('passes at the exact configured stable duration with enough estimates', () => {
    const instance = evaluator({ maximumSignalGapMs: 500 });
    const timestamps = [0, 300, 600, 900, 1200, 1500];
    const results = timestamps.map(timestamp =>
      instance.evaluate(atCents(target, 2, timestamp))
    );

    expect(results[results.length - 2].stableHoldAchieved).toBeFalse();
    expect(results[results.length - 1].stableHoldAchieved).toBeTrue();
    expect(instance.metrics().timeToStableHoldMs).toBe(1500);
  });

  it('marks excessive in-window spread as unstable and resets its window', () => {
    const instance = evaluator({
      maximumSpreadCents: 12,
      maximumSignalGapMs: 500
    });
    instance.evaluate(atCents(target, -7, 0));
    const result = instance.evaluate(atCents(target, 7, 100));

    expect(result.feedback.band).toBe('unstable');
    expect(result.feedback.stabilityEstimateCount).toBe(1);
    expect(result.feedback.stableForMs).toBe(0);
  });

  it('resets on a signal gap and can establish a new valid window', () => {
    const instance = evaluator({
      requiredStableMs: 1500,
      maximumSignalGapMs: 350
    });
    [0, 300].forEach(timestamp =>
      instance.evaluate(atCents(target, 0, timestamp))
    );
    const afterGap = instance.evaluate(atCents(target, 0, 700));
    const result = [1000, 1300, 1600, 1900, 2200]
      .map(timestamp => instance.evaluate(atCents(target, 0, timestamp)))
      .pop();

    expect(afterGap.feedback.stableForMs).toBe(0);
    expect(result?.stableHoldAchieved).toBeTrue();
  });

  it('resets on a wrong note and recovers only after a new full hold', () => {
    const instance = evaluator({
      requiredStableMs: 300,
      minimumValidEstimates: 3,
      maximumSignalGapMs: 150
    });
    [0, 100, 200].forEach(timestamp =>
      instance.evaluate(atCents(target, 0, timestamp))
    );
    const wrong = instance.evaluate(atCents(target, 100, 300));
    const recovery = [400, 500, 600, 700]
      .map(timestamp => instance.evaluate(atCents(target, 0, timestamp)));

    expect(wrong.feedback.band).toBe('wrong-note');
    expect(recovery[2].stableHoldAchieved).toBeFalse();
    expect(recovery[3].stableHoldAchieved).toBeTrue();
    expect(instance.metrics().wrongNoteCount).toBe(1);
  });

  it('rejects non-monotonic and emitted-before-captured timestamps', () => {
    const instance = evaluator();
    instance.evaluate(atCents(target, 0, 100));

    expect(instance.evaluate(atCents(target, 0, 100)).feedback.band)
      .toBe('invalid-estimate');
    expect(instance.evaluate({
      kind: 'voiced',
      frequencyHz: target.expectedSoundingFrequencyHz,
      capturedAtMs: 200,
      emittedAtMs: 199
    }).feedback.band).toBe('invalid-estimate');
  });

  it('reports bounded aggregate attempt metrics without exposing pitch traces', () => {
    const instance = evaluator({ maximumSignalGapMs: 500 });
    [-4, 0, 4, 6].forEach((cents, index) =>
      instance.evaluate(atCents(target, cents, index * 100))
    );
    const metrics = instance.metrics();

    expect(metrics.timeToFirstValidEstimateMs).toBe(0);
    expect(metrics.validEstimateCount).toBe(4);
    expect(metrics.medianCents).toBeCloseTo(0, 8);
    expect(metrics.absoluteErrorP95Cents).toBeCloseTo(6, 8);
    expect(metrics.spreadCents).toBeCloseTo(10, 8);
    expect(Object.keys(metrics)).not.toContain('samples');
  });

  function evaluator(
    overrides: Partial<IntonationEvaluationConfig> = {}
  ): IntonationEvaluator {
    return new IntonationEvaluator(target, { ...config, ...overrides }, 0);
  }
});

function atCents(
  target: NoteTarget,
  cents: number,
  capturedAtMs: number
): PitchEstimate {
  return voiced(
    target.expectedSoundingFrequencyHz * Math.pow(2, cents / 1200),
    capturedAtMs
  );
}

function voiced(
  frequencyHz: number,
  capturedAtMs: number
): PitchEstimate {
  return {
    kind: 'voiced',
    frequencyHz,
    capturedAtMs,
    emittedAtMs: capturedAtMs
  };
}

function unvoiced(
  reason: 'silence' | 'invalid' | 'out-of-range',
  capturedAtMs: number
): PitchEstimate {
  return {
    kind: 'unvoiced',
    reason,
    capturedAtMs,
    emittedAtMs: capturedAtMs
  };
}
