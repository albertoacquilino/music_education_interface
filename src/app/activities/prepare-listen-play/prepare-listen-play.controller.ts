import { BehaviorSubject, Subscription } from 'rxjs';
import { DYNAMICS, MAXTEMPO, MINTEMPO } from '../../constants';
import {
  ActivityContext,
  CancelHandle,
  PitchInputSession
} from '../../core/activity/activity-context';
import { LearningActivityController } from '../../core/activity/activity-controller';
import {
  ActivityCancelReason,
  ActivityFailure,
  ActivitySnapshot
} from '../../core/activity/activity.types';
import { centsBetween } from '../../core/music/pitch-math';
import { InstrumentDefinition, NoteTarget } from '../../instruments/instrument-definition';
import {
  BeatIndex,
  NonGatingPitchFeedback,
  PrepareListenPlayConfig,
  PrepareListenPlayPhase,
  PrepareListenPlayResult,
  PrepareListenPlayState
} from './prepare-listen-play.types';

interface SelectedMaterial {
  readonly target: NoteTarget;
  readonly dynamic?: string;
  readonly dynamicGain: number;
}

export class PrepareListenPlayController implements LearningActivityController<
  PrepareListenPlayConfig,
  PrepareListenPlayState,
  PrepareListenPlayResult
> {
  readonly activityId = 'prepare-listen-play' as const;
  readonly activityVersion = '1.0.0';
  readonly snapshot$ = new BehaviorSubject<
    ActivitySnapshot<PrepareListenPlayState, PrepareListenPlayResult>
  >({ lifecycle: 'idle' });

  private config: PrepareListenPlayConfig | null = null;
  private context: ActivityContext | null = null;
  private signal: AbortSignal | null = null;
  private timer: CancelHandle | null = null;
  private pitchSession: PitchInputSession | null = null;
  private pitchSubscription: Subscription | null = null;
  private sessionId = '';
  private startedAtMs = 0;
  private tickIndex = 0;
  private completedCycles = 0;
  private currentMaterial: SelectedMaterial | null = null;
  private presentedTargetIds: string[] = [];
  private chromaticBuffer: number[] = [];
  private currentCycleMeans: number[] = [];
  private collectedMeans: { [cycle: string]: number[] } = {};
  private persistenceOpened = false;
  private terminalStarted = false;
  private sessionSequence = 0;
  private settledPromise = new Promise<PrepareListenPlayResult>(() => {
    // Replaced with a session-specific promise in reset().
  });
  private settle!: (result: PrepareListenPlayResult) => void;

  async start(
    config: PrepareListenPlayConfig,
    context: ActivityContext,
    signal: AbortSignal
  ): Promise<void> {
    if (this.isActive()) {
      throw new Error('Prepare-listen-play is already active');
    }

    this.reset(config, context, signal);
    const validationFailure = this.validateConfig(config, context);
    if (validationFailure) {
      await this.fail(validationFailure);
      return;
    }

    this.snapshot$.next({
      lifecycle: 'starting',
      sessionId: this.sessionId,
      startedAtMs: this.startedAtMs
    });

    try {
      const instrument = context.instruments.get(config.instrumentId);
      await context.audio.unlockFromUserGesture();
      await context.audio.preloadInstrument(instrument);

      if (config.pitchDisplay !== 'off') {
        this.pitchSession = await context.pitch.acquire(signal);
        this.pitchSubscription = context.pitch.estimates$.subscribe(
          estimate => this.handlePitchEstimate(estimate)
        );
      }

      await context.persistence.open({
        schemaVersion: 2,
        sessionId: this.sessionId,
        activityId: this.activityId,
        activityVersion: this.activityVersion,
        instrumentId: config.instrumentId,
        config,
        startedAtMs: this.startedAtMs
      });
      this.persistenceOpened = true;

      const periodMs = 60000 / config.tempoBpm;
      this.timer = context.clock.every(
        periodMs,
        () => this.advance(),
        signal
      );
    } catch (error) {
      await this.fail({
        code: 'resource-failed',
        message: this.errorMessage(error),
        recoverable: true
      });
    }
  }

  async cancel(reason: ActivityCancelReason): Promise<PrepareListenPlayResult> {
    if (this.terminalStarted) {
      return this.whenSettled();
    }

    this.terminalStarted = true;
    this.finishChromaticCycle();
    const result = this.buildResult('cancelled', { cancelReason: reason });
    await this.releaseResources();
    await this.closePersistence(result);
    this.snapshot$.next({
      lifecycle: 'cancelled',
      sessionId: this.sessionId,
      reason,
      result
    });
    this.settle(result);
    return result;
  }

  whenSettled(): Promise<PrepareListenPlayResult> {
    return this.settledPromise;
  }

  private reset(
    config: PrepareListenPlayConfig,
    context: ActivityContext,
    signal: AbortSignal
  ): void {
    this.config = config;
    this.context = context;
    this.signal = signal;
    this.sessionSequence += 1;
    this.sessionId = `plp-${Math.round(context.clock.nowMs())}-${this.sessionSequence}`;
    this.startedAtMs = context.clock.nowMs();
    this.tickIndex = 0;
    this.completedCycles = 0;
    this.currentMaterial = null;
    this.presentedTargetIds = [];
    this.chromaticBuffer = [];
    this.currentCycleMeans = [];
    this.collectedMeans = {};
    this.persistenceOpened = false;
    this.terminalStarted = false;
    this.settledPromise = new Promise(resolve => {
      this.settle = resolve;
    });
  }

  private validateConfig(
    config: PrepareListenPlayConfig,
    context: ActivityContext
  ): ActivityFailure | null {
    if (
      config.beatsPerPhase !== 4
      || !Number.isInteger(config.cycles)
      || config.cycles <= 0
      || config.tempoBpm < MINTEMPO
      || config.tempoBpm > MAXTEMPO
    ) {
      return {
        code: 'invalid-config',
        message: 'PLP requires four beats per phase, positive cycles, and a supported tempo',
        recoverable: false
      };
    }

    try {
      context.instruments.selectableNotes(config.instrumentId, {
        lowNoteId: config.lowNoteId,
        highNoteId: config.highNoteId,
        includeAccidentals: config.includeAccidentals
      });
      context.instruments.resolveTarget(
        config.instrumentId,
        config.lowNoteId,
        config.referenceA4Hz
      );
    } catch (error) {
      return {
        code: 'invalid-config',
        message: this.errorMessage(error),
        recoverable: false
      };
    }

    return null;
  }

  private advance(): void {
    if (this.terminalStarted || !this.config || !this.context) {
      return;
    }

    const ticksPerPhase = this.config.beatsPerPhase;
    const ticksPerCycle = ticksPerPhase * 3;
    const cycleNumber = Math.floor(this.tickIndex / ticksPerCycle) + 1;
    const positionInCycle = this.tickIndex % ticksPerCycle;
    const phaseIndex = Math.floor(positionInCycle / ticksPerPhase);
    const beatIndex = (positionInCycle % ticksPerPhase) as BeatIndex;
    const phase: PrepareListenPlayPhase = phaseIndex === 0
      ? 'preparing'
      : phaseIndex === 1
        ? 'listening'
        : 'playing';

    if (positionInCycle === 0) {
      this.finishChromaticCycle();
      this.currentMaterial = this.selectMaterial();
      this.presentedTargetIds.push(this.currentMaterial.target.noteId);
    }

    if (!this.currentMaterial) {
      void this.fail({
        code: 'unexpected',
        message: 'No material was selected for the current cycle',
        recoverable: false
      });
      return;
    }

    this.context.audio.playMetronome(beatIndex === 0 ? 'strong' : 'weak');
    if (phase === 'listening' && beatIndex === 0) {
      this.context.audio.playReference(this.currentMaterial.target, {
        durationMs: ticksPerPhase * (60000 / this.config.tempoBpm),
        gain: this.currentMaterial.dynamicGain,
        desiredReferenceA4Hz: this.config.referenceA4Hz
      });
    }

    const state: PrepareListenPlayState = {
      phase,
      cycleNumber,
      beatIndex,
      target: this.currentMaterial.target,
      score: this.context.notation.forPrepareListenPlay(
        this.currentMaterial.target,
        this.currentMaterial.dynamic
      ),
      dynamic: this.currentMaterial.dynamic,
      dynamicGain: this.currentMaterial.dynamicGain
    };
    this.snapshot$.next({
      lifecycle: 'running',
      sessionId: this.sessionId,
      state
    });

    this.tickIndex += 1;
    if (positionInCycle === ticksPerCycle - 1) {
      this.completedCycles += 1;
      if (cycleNumber === this.config.cycles) {
        this.finishChromaticCycle();
        void this.complete();
      }
    }
  }

  private selectMaterial(): SelectedMaterial {
    const config = this.config!;
    const context = this.context!;
    const notes = context.instruments.selectableNotes(config.instrumentId, {
      lowNoteId: config.lowNoteId,
      highNoteId: config.highNoteId,
      includeAccidentals: config.includeAccidentals
    });
    const note = notes[this.randomIndex(notes.length)];
    const displayToken = note.displayTokens[
      config.includeAccidentals ? this.randomIndex(note.displayTokens.length) : 0
    ];
    const target = context.instruments.resolveTarget(
      config.instrumentId,
      note.id,
      config.referenceA4Hz,
      displayToken
    );

    if (!config.useDynamics) {
      return { target, dynamicGain: 1 };
    }

    const dynamic = DYNAMICS[this.randomIndex(DYNAMICS.length)];
    return {
      target,
      dynamic: dynamic.label,
      dynamicGain: dynamic.volume
    };
  }

  private randomIndex(length: number): number {
    const value = this.context!.random();
    const bounded = Math.max(0, Math.min(0.999999999, value));
    return Math.floor(bounded * length);
  }

  private handlePitchEstimate(
    estimate: import('../../core/activity/activity-context').PitchEstimate
  ): void {
    const snapshot = this.snapshot$.value;
    if (
      snapshot.lifecycle !== 'running'
      || snapshot.state.phase !== 'playing'
      || !this.config
    ) {
      return;
    }

    if (estimate.kind === 'unvoiced') {
      if (this.config.pitchDisplay === 'target') {
        this.updateRunningState({
          ...snapshot.state,
          pitchFeedback: { kind: 'unvoiced' }
        });
      } else if (this.config.pitchDisplay === 'chromatic') {
        this.updateRunningState({
          ...snapshot.state,
          chromaticPitchHz: 0
        });
      }
      return;
    }

    if (this.config.pitchDisplay === 'target') {
      const cents = centsBetween(
        estimate.frequencyHz,
        snapshot.state.target.expectedSoundingFrequencyHz
      );
      if (cents === null) {
        return;
      }
      const feedback: NonGatingPitchFeedback = {
        kind: 'voiced',
        frequencyHz: estimate.frequencyHz,
        cents,
        band: Math.abs(cents) <= 10
          ? 'in-tune'
          : Math.abs(cents) <= 30
            ? 'close'
            : 'far'
      };
      this.updateRunningState({
        ...snapshot.state,
        pitchFeedback: feedback
      });
      return;
    }

    if (this.config.pitchDisplay === 'chromatic') {
      this.chromaticBuffer.push(estimate.frequencyHz);
      if (this.chromaticBuffer.length === 4) {
        const mean = this.meanOfLargestBucket(this.chromaticBuffer);
        this.chromaticBuffer = [];
        if (mean > 0) {
          if (
            this.currentCycleMeans.length === 0
            || this.currentCycleMeans[this.currentCycleMeans.length - 1] !== mean
          ) {
            this.currentCycleMeans.push(mean);
          }
          this.updateRunningState({
            ...snapshot.state,
            chromaticPitchHz: mean
          });
        }
      }
    }
  }

  private meanOfLargestBucket(values: readonly number[]): number {
    const buckets = new Map<number, number[]>();
    values.forEach(value => {
      const existingKey = Array.from(buckets.keys())
        .find(key => Math.abs(value - key) <= 2);
      if (existingKey === undefined) {
        buckets.set(value, [value]);
      } else {
        buckets.get(existingKey)!.push(value);
      }
    });

    let largest: number[] = [];
    buckets.forEach(bucket => {
      if (bucket.length > largest.length) {
        largest = bucket;
      }
    });
    return largest.reduce((sum, value) => sum + value, 0) / largest.length;
  }

  private updateRunningState(state: PrepareListenPlayState): void {
    this.snapshot$.next({
      lifecycle: 'running',
      sessionId: this.sessionId,
      state
    });
  }

  private finishChromaticCycle(): void {
    if (this.currentCycleMeans.length === 0) {
      this.chromaticBuffer = [];
      return;
    }
    const key = String(Object.keys(this.collectedMeans).length + 1);
    this.collectedMeans[key] = [...this.currentCycleMeans];
    this.currentCycleMeans = [];
    this.chromaticBuffer = [];
  }

  private async complete(): Promise<void> {
    if (this.terminalStarted) {
      return;
    }
    this.terminalStarted = true;
    const result = this.buildResult('completed');
    await this.releaseResources();
    await this.closePersistence(result);
    this.snapshot$.next({
      lifecycle: 'completed',
      sessionId: this.sessionId,
      result
    });
    this.settle(result);
  }

  private async fail(failure: ActivityFailure): Promise<void> {
    if (this.terminalStarted) {
      return;
    }
    this.terminalStarted = true;
    const result = this.buildResult('failed', { failure });
    await this.releaseResources();
    await this.closePersistence(result);
    this.snapshot$.next({
      lifecycle: 'failed',
      sessionId: this.sessionId,
      failure,
      result
    });
    this.settle(result);
  }

  private buildResult(
    outcome: PrepareListenPlayResult['outcome'],
    terminal: Pick<PrepareListenPlayResult, 'cancelReason' | 'failure'> = {}
  ): PrepareListenPlayResult {
    return {
      activityId: this.activityId,
      activityVersion: this.activityVersion,
      sessionId: this.sessionId,
      outcome,
      startedAtMs: this.startedAtMs,
      endedAtMs: this.context?.clock.nowMs() ?? this.startedAtMs,
      plannedCycles: this.config?.cycles ?? 0,
      completedCycles: this.completedCycles,
      presentedTargetIds: [...this.presentedTargetIds],
      collectedMeans: { ...this.collectedMeans },
      ...terminal
    };
  }

  private async releaseResources(): Promise<void> {
    this.timer?.cancel();
    this.timer = null;
    this.pitchSubscription?.unsubscribe();
    this.pitchSubscription = null;
    await this.pitchSession?.release();
    this.pitchSession = null;
    this.context?.audio.stopAll();
  }

  private async closePersistence(result: PrepareListenPlayResult): Promise<void> {
    if (!this.persistenceOpened || !this.context) {
      return;
    }
    this.persistenceOpened = false;
    await this.context.persistence.close(result);
  }

  private isActive(): boolean {
    const snapshot = this.snapshot$.value;
    return snapshot.lifecycle === 'starting' || snapshot.lifecycle === 'running';
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
