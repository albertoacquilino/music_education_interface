import { BehaviorSubject, Subscription } from 'rxjs';
import {
  ActivityContext,
  AudioPlayback,
  CancelHandle,
  PitchEstimate,
  PitchInputSession
} from '../../core/activity/activity-context';
import { LearningActivityController } from '../../core/activity/activity-controller';
import {
  ActivityCancelReason,
  ActivityFailure,
  ActivitySnapshot
} from '../../core/activity/activity.types';
import { NoteTarget } from '../../instruments/instrument-definition';
import { Score } from '../../models/score.types';
import { IntonationEvaluator } from './intonation-evaluator';
import {
  AttemptResultState,
  IntonationAttemptOutcome,
  IntonationAttemptResult,
  IntonationFeedback,
  TARGET_INTONATION_ACTIVITY_VERSION,
  TargetIntonationCommand,
  TargetIntonationConfig,
  TargetIntonationResult,
  TargetIntonationState
} from './target-intonation.types';

interface TargetPresentation {
  readonly target: NoteTarget;
  readonly score: Score;
  readonly targetNumber: number;
  readonly attemptIndex: number;
}

export class TargetIntonationController implements LearningActivityController<
  TargetIntonationConfig,
  TargetIntonationState,
  TargetIntonationResult
> {
  readonly activityId = 'target-intonation' as const;
  readonly activityVersion = TARGET_INTONATION_ACTIVITY_VERSION;
  readonly snapshot$ = new BehaviorSubject<
    ActivitySnapshot<TargetIntonationState, TargetIntonationResult>
  >({ lifecycle: 'idle' });

  private config: TargetIntonationConfig | null = null;
  private context: ActivityContext | null = null;
  private signal: AbortSignal | null = null;
  private pitchSession: PitchInputSession | null = null;
  private pitchSubscription: Subscription | null = null;
  private presentationTimer: CancelHandle | null = null;
  private attemptTimer: CancelHandle | null = null;
  private referencePlayback: AudioPlayback | null = null;
  private currentPresentation: TargetPresentation | null = null;
  private evaluator: IntonationEvaluator | null = null;
  private attemptStartedAtMs?: number;
  private attemptDeadlineAtMs?: number;
  private referenceAvailable = true;
  private sessionId = '';
  private startedAtMs = 0;
  private completedTargets = 0;
  private successfulTargets = 0;
  private attempts: IntonationAttemptResult[] = [];
  private persistenceOpened = false;
  private resourcesReleased = false;
  private terminalStarted = false;
  private sessionSequence = 0;
  private abortListener: (() => void) | null = null;
  private settledPromise = new Promise<TargetIntonationResult>(() => {
    // Replaced with a session-specific promise in reset().
  });
  private settle!: (result: TargetIntonationResult) => void;

  async start(
    config: TargetIntonationConfig,
    context: ActivityContext,
    signal: AbortSignal
  ): Promise<void> {
    if (this.isActive()) {
      throw new Error('Target intonation is already active');
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

    this.abortListener = () => {
      void this.cancel('resource-lost');
    };
    signal.addEventListener('abort', this.abortListener, { once: true });

    try {
      if (config.playReferenceTone) {
        try {
          const instrument = context.instruments.get(config.instrumentId);
          await context.audio.unlockFromUserGesture();
          await context.audio.preloadInstrument(instrument);
        } catch {
          // Reference playback is optional. Its failed status is made explicit
          // in the presenting state while pitch tracking remains available.
          this.referenceAvailable = false;
        }
      }

      this.pitchSession = await context.pitch.acquire(signal);
      this.pitchSubscription = context.pitch.estimates$.subscribe({
        next: estimate => this.handlePitchEstimate(estimate),
        error: error => {
          void this.fail({
            code: 'resource-failed',
            message: this.errorMessage(error),
            recoverable: true
          });
        }
      });

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

      this.selectAndPresentTarget();
    } catch (error) {
      await this.fail({
        code: 'resource-failed',
        message: this.errorMessage(error),
        recoverable: true
      });
    }
  }

  async dispatch(command: TargetIntonationCommand): Promise<void> {
    if (this.terminalStarted) {
      return;
    }

    if (command.type === 'stop') {
      await this.cancel('learner-stop');
      return;
    }

    const snapshot = this.snapshot$.value;
    if (snapshot.lifecycle !== 'running') {
      return;
    }

    if (command.type === 'retry-attempt') {
      if (
        snapshot.state.kind !== 'attempt-result'
        || !snapshot.state.canRetry
        || !this.currentPresentation
      ) {
        return;
      }
      this.presentCurrentTarget(this.currentPresentation.attemptIndex + 1);
      return;
    }

    if (command.type === 'next-target') {
      if (
        snapshot.state.kind !== 'attempt-result'
        || !snapshot.state.canProceed
      ) {
        return;
      }
      await this.advanceTarget(true);
      return;
    }

    if (command.type === 'skip-target') {
      if (snapshot.state.kind === 'presenting-target') {
        this.recordPresentingSkip();
      } else if (
        snapshot.state.kind === 'awaiting-signal'
        || snapshot.state.kind === 'tracking'
      ) {
        this.finishAttempt('skipped', this.context!.clock.nowMs());
      } else if (!snapshot.state.canSkip) {
        return;
      }
      await this.advanceTarget(false);
    }
  }

  async cancel(reason: ActivityCancelReason): Promise<TargetIntonationResult> {
    if (this.terminalStarted) {
      return this.whenSettled();
    }

    this.terminalStarted = true;
    if (this.evaluator && this.attemptStartedAtMs !== undefined) {
      this.attempts.push(this.createAttemptResult(
        'cancelled',
        this.context?.clock.nowMs() ?? this.attemptStartedAtMs
      ));
      this.clearAttempt();
    }

    let result = this.buildResult('cancelled', { cancelReason: reason });
    const resourceFailure = await this.releaseResources();
    const persistenceFailure = await this.closePersistence(result);
    const terminalFailure = resourceFailure ?? persistenceFailure;
    if (terminalFailure) {
      result = this.buildResult('failed', {
        failure: {
          code: 'resource-failed',
          message: terminalFailure,
          recoverable: true
        }
      });
      this.snapshot$.next({
        lifecycle: 'failed',
        sessionId: this.sessionId,
        failure: result.failure!,
        result
      });
    } else {
      this.snapshot$.next({
        lifecycle: 'cancelled',
        sessionId: this.sessionId,
        reason,
        result
      });
    }
    this.settle(result);
    return result;
  }

  whenSettled(): Promise<TargetIntonationResult> {
    return this.settledPromise;
  }

  private reset(
    config: TargetIntonationConfig,
    context: ActivityContext,
    signal: AbortSignal
  ): void {
    this.config = config;
    this.context = context;
    this.signal = signal;
    this.sessionSequence += 1;
    this.startedAtMs = context.clock.nowMs();
    this.sessionId = `intonation-${Math.round(this.startedAtMs)}-${this.sessionSequence}`;
    this.pitchSession = null;
    this.pitchSubscription = null;
    this.presentationTimer = null;
    this.attemptTimer = null;
    this.referencePlayback = null;
    this.currentPresentation = null;
    this.evaluator = null;
    this.attemptStartedAtMs = undefined;
    this.attemptDeadlineAtMs = undefined;
    this.referenceAvailable = true;
    this.completedTargets = 0;
    this.successfulTargets = 0;
    this.attempts = [];
    this.persistenceOpened = false;
    this.resourcesReleased = false;
    this.terminalStarted = false;
    this.abortListener = null;
    this.settledPromise = new Promise(resolve => {
      this.settle = resolve;
    });
  }

  private validateConfig(
    config: TargetIntonationConfig,
    context: ActivityContext
  ): ActivityFailure | null {
    const finiteValues = [
      config.referenceA4Hz,
      config.targetPresentationMs,
      config.referenceToneDurationMs,
      config.toleranceCents,
      config.farThresholdCents,
      config.requiredStableMs,
      config.maximumSpreadCents,
      config.maximumSignalGapMs,
      config.attemptTimeoutMs,
      config.detectorMinimumHz,
      config.detectorMaximumHz
    ];
    if (
      !finiteValues.every(Number.isFinite)
      || !Number.isInteger(config.targetCount)
      || config.targetCount <= 0
      || !Number.isInteger(config.minimumValidEstimates)
      || config.minimumValidEstimates <= 0
      || !Number.isInteger(config.maximumAttemptsPerTarget)
      || config.maximumAttemptsPerTarget <= 0
      || config.targetPresentationMs < 0
      || config.referenceToneDurationMs <= 0
      || config.toleranceCents <= 0
      || config.farThresholdCents <= config.toleranceCents
      || config.farThresholdCents >= 50
      || config.requiredStableMs <= 0
      || config.maximumSpreadCents <= 0
      || config.maximumSignalGapMs <= 0
      || config.attemptTimeoutMs <= config.requiredStableMs
      || config.detectorMinimumHz <= 0
      || config.detectorMinimumHz >= config.detectorMaximumHz
    ) {
      return {
        code: 'invalid-config',
        message: 'Target intonation requires finite, positive, and ordered timing and pitch thresholds',
        recoverable: false
      };
    }

    try {
      const notes = context.instruments.selectableNotes(config.instrumentId, {
        lowNoteId: config.lowNoteId,
        highNoteId: config.highNoteId,
        includeAccidentals: config.includeAccidentals
      });
      if (
        notes[0].index !== config.lowNoteIndex
        || notes[notes.length - 1].index !== config.highNoteIndex
      ) {
        throw new Error('Configured note indexes do not match the typed target range');
      }
      notes.forEach(note => {
        const target = context.instruments.resolveTarget(
          config.instrumentId,
          note.id,
          config.referenceA4Hz
        );
        if (
          target.expectedSoundingFrequencyHz < config.detectorMinimumHz
          || target.expectedSoundingFrequencyHz > config.detectorMaximumHz
        ) {
          throw new Error(
            `Target ${target.noteId} falls outside the configured detector range`
          );
        }
      });
    } catch (error) {
      return {
        code: 'invalid-config',
        message: this.errorMessage(error),
        recoverable: false
      };
    }

    return null;
  }

  private selectAndPresentTarget(): void {
    try {
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
      this.currentPresentation = {
        target,
        score: context.notation.forTarget(target),
        targetNumber: this.completedTargets + 1,
        attemptIndex: 1
      };
      this.presentCurrentTarget(1);
    } catch (error) {
      void this.fail({
        code: 'unexpected',
        message: this.errorMessage(error),
        recoverable: false
      });
    }
  }

  private presentCurrentTarget(attemptIndex: number): void {
    if (
      this.terminalStarted
      || !this.currentPresentation
      || !this.context
      || !this.config
      || !this.signal
    ) {
      return;
    }

    this.clearAttempt();
    this.presentationTimer?.cancel();
    this.presentationTimer = null;
    this.stopReferencePlayback();
    this.currentPresentation = {
      ...this.currentPresentation,
      attemptIndex
    };

    let referencePlayback: 'not-requested' | 'playing' | 'failed' =
      this.config.playReferenceTone ? 'failed' : 'not-requested';
    if (this.config.playReferenceTone && this.referenceAvailable) {
      try {
        this.referencePlayback = this.context.audio.playReference(
          this.currentPresentation.target,
          {
            durationMs: this.config.referenceToneDurationMs,
            gain: 1,
            desiredReferenceA4Hz: this.config.referenceA4Hz
          }
        );
        referencePlayback = 'playing';
      } catch {
        this.referenceAvailable = false;
      }
    }

    this.snapshot$.next({
      lifecycle: 'running',
      sessionId: this.sessionId,
      state: {
        ...this.stateBase(),
        kind: 'presenting-target',
        referencePlayback
      }
    });

    this.presentationTimer = this.context.clock.after(
      this.config.targetPresentationMs,
      () => {
        this.presentationTimer = null;
        this.beginAttempt();
      },
      this.signal
    );
  }

  private beginAttempt(): void {
    if (
      this.terminalStarted
      || !this.currentPresentation
      || !this.context
      || !this.config
      || !this.signal
    ) {
      return;
    }

    this.stopReferencePlayback();
    this.attemptStartedAtMs = this.context.clock.nowMs();
    this.attemptDeadlineAtMs =
      this.attemptStartedAtMs + this.config.attemptTimeoutMs;
    this.evaluator = new IntonationEvaluator(
      this.currentPresentation.target,
      this.config,
      this.attemptStartedAtMs
    );

    this.snapshot$.next({
      lifecycle: 'running',
      sessionId: this.sessionId,
      state: {
        ...this.stateBase(),
        kind: 'awaiting-signal',
        attemptStartedAtMs: this.attemptStartedAtMs,
        attemptDeadlineAtMs: this.attemptDeadlineAtMs,
        feedback: this.initialFeedback(this.attemptStartedAtMs)
      }
    });

    this.attemptTimer = this.context.clock.after(
      this.config.attemptTimeoutMs,
      observedAtMs => {
        this.attemptTimer = null;
        this.finishAttempt('timeout', observedAtMs);
      },
      this.signal
    );
  }

  private handlePitchEstimate(estimate: PitchEstimate): void {
    const snapshot = this.snapshot$.value;
    if (
      this.terminalStarted
      || snapshot.lifecycle !== 'running'
      || (
        snapshot.state.kind !== 'awaiting-signal'
        && snapshot.state.kind !== 'tracking'
      )
      || !this.evaluator
      || this.attemptDeadlineAtMs === undefined
    ) {
      return;
    }

    if (estimate.capturedAtMs >= this.attemptDeadlineAtMs) {
      this.finishAttempt('timeout', this.attemptDeadlineAtMs);
      return;
    }

    try {
      const evaluation = this.evaluator.evaluate(estimate);
      this.snapshot$.next({
        lifecycle: 'running',
        sessionId: this.sessionId,
        state: {
          ...this.stateBase(),
          kind: evaluation.feedback.band === 'no-signal'
            ? 'awaiting-signal'
            : 'tracking',
          attemptStartedAtMs: this.attemptStartedAtMs!,
          attemptDeadlineAtMs: this.attemptDeadlineAtMs,
          feedback: evaluation.feedback
        }
      });

      if (evaluation.stableHoldAchieved) {
        this.finishAttempt('stable-hold', estimate.capturedAtMs);
      }
    } catch (error) {
      void this.fail({
        code: 'unexpected',
        message: this.errorMessage(error),
        recoverable: false
      });
    }
  }

  private finishAttempt(
    outcome: IntonationAttemptOutcome,
    endedAtMs: number
  ): void {
    if (!this.evaluator || this.attemptStartedAtMs === undefined) {
      return;
    }

    const result = this.createAttemptResult(outcome, endedAtMs);
    this.attempts.push(result);
    this.clearAttempt();

    const canRetry = outcome === 'timeout'
      && result.attemptIndex < this.config!.maximumAttemptsPerTarget;
    const state: AttemptResultState = {
      ...this.stateBase(),
      kind: 'attempt-result',
      result,
      canRetry,
      canSkip: outcome === 'timeout',
      canProceed: outcome === 'stable-hold'
    };
    this.snapshot$.next({
      lifecycle: 'running',
      sessionId: this.sessionId,
      state
    });
  }

  private createAttemptResult(
    outcome: IntonationAttemptOutcome,
    endedAtMs: number
  ): IntonationAttemptResult {
    return {
      target: this.currentPresentation!.target,
      targetNumber: this.currentPresentation!.targetNumber,
      attemptIndex: this.currentPresentation!.attemptIndex,
      outcome,
      startedAtMs: this.attemptStartedAtMs!,
      endedAtMs,
      ...this.evaluator!.metrics()
    };
  }

  private recordPresentingSkip(): void {
    const nowMs = this.context!.clock.nowMs();
    this.attempts.push({
      target: this.currentPresentation!.target,
      targetNumber: this.currentPresentation!.targetNumber,
      attemptIndex: this.currentPresentation!.attemptIndex,
      outcome: 'skipped',
      startedAtMs: nowMs,
      endedAtMs: nowMs,
      validEstimateCount: 0,
      wrongNoteCount: 0
    });
  }

  private async advanceTarget(successful: boolean): Promise<void> {
    this.presentationTimer?.cancel();
    this.presentationTimer = null;
    this.attemptTimer?.cancel();
    this.attemptTimer = null;
    this.stopReferencePlayback();
    this.completedTargets += 1;
    if (successful) {
      this.successfulTargets += 1;
    }

    if (this.completedTargets >= this.config!.targetCount) {
      await this.complete();
      return;
    }
    this.selectAndPresentTarget();
  }

  private async complete(): Promise<void> {
    if (this.terminalStarted) {
      return;
    }
    this.terminalStarted = true;
    let result = this.buildResult('completed');
    const resourceFailure = await this.releaseResources();
    const persistenceFailure = await this.closePersistence(result);
    const terminalFailure = resourceFailure ?? persistenceFailure;

    if (terminalFailure) {
      result = this.buildResult('failed', {
        failure: {
          code: 'resource-failed',
          message: terminalFailure,
          recoverable: true
        }
      });
      this.snapshot$.next({
        lifecycle: 'failed',
        sessionId: this.sessionId,
        failure: result.failure!,
        result
      });
    } else {
      this.snapshot$.next({
        lifecycle: 'completed',
        sessionId: this.sessionId,
        result
      });
    }
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
    outcome: TargetIntonationResult['outcome'],
    terminal: Pick<TargetIntonationResult, 'cancelReason' | 'failure'> = {}
  ): TargetIntonationResult {
    return {
      activityId: this.activityId,
      activityVersion: this.activityVersion,
      sessionId: this.sessionId,
      outcome,
      startedAtMs: this.startedAtMs,
      endedAtMs: this.context?.clock.nowMs() ?? this.startedAtMs,
      configuration: { ...this.config! },
      plannedTargets: this.config?.targetCount ?? 0,
      completedTargets: this.completedTargets,
      successfulTargets: this.successfulTargets,
      attempts: [...this.attempts],
      ...terminal
    };
  }

  private stateBase(): Omit<
    TargetIntonationState,
    'kind' | 'referencePlayback' | 'attemptStartedAtMs'
    | 'attemptDeadlineAtMs' | 'feedback' | 'result'
    | 'canRetry' | 'canSkip' | 'canProceed'
  > {
    return {
      target: this.currentPresentation!.target,
      score: this.currentPresentation!.score,
      targetNumber: this.currentPresentation!.targetNumber,
      targetCount: this.config!.targetCount,
      attemptIndex: this.currentPresentation!.attemptIndex,
      maximumAttempts: this.config!.maximumAttemptsPerTarget
    };
  }

  private initialFeedback(capturedAtMs: number): IntonationFeedback {
    return {
      band: 'no-signal',
      target: this.currentPresentation!.target,
      capturedAtMs,
      stableForMs: 0,
      requiredStableMs: this.config!.requiredStableMs,
      stableProgress: 0,
      stabilityEstimateCount: 0,
      validEstimateCount: 0,
      wrongNoteCount: 0
    };
  }

  private clearAttempt(): void {
    this.attemptTimer?.cancel();
    this.attemptTimer = null;
    this.evaluator = null;
    this.attemptStartedAtMs = undefined;
    this.attemptDeadlineAtMs = undefined;
  }

  private stopReferencePlayback(): void {
    this.referencePlayback?.stop(50);
    this.referencePlayback = null;
  }

  private async releaseResources(): Promise<string | null> {
    if (this.resourcesReleased) {
      return null;
    }
    this.resourcesReleased = true;
    this.presentationTimer?.cancel();
    this.presentationTimer = null;
    this.clearAttempt();
    this.stopReferencePlayback();
    this.pitchSubscription?.unsubscribe();
    this.pitchSubscription = null;
    if (this.signal && this.abortListener) {
      this.signal.removeEventListener('abort', this.abortListener);
    }
    this.abortListener = null;

    let failure: string | null = null;
    try {
      await this.pitchSession?.release();
    } catch (error) {
      failure = this.errorMessage(error);
    }
    this.pitchSession = null;
    try {
      this.context?.audio.stopAll();
    } catch (error) {
      failure ??= this.errorMessage(error);
    }
    return failure;
  }

  private async closePersistence(
    result: TargetIntonationResult
  ): Promise<string | null> {
    if (!this.persistenceOpened || !this.context) {
      return null;
    }
    this.persistenceOpened = false;
    try {
      await this.context.persistence.close(result);
      return null;
    } catch (error) {
      return this.errorMessage(error);
    }
  }

  private randomIndex(length: number): number {
    const value = this.context!.random();
    const finiteValue = Number.isFinite(value) ? value : 0;
    const bounded = Math.max(0, Math.min(0.999999999, finiteValue));
    return Math.floor(bounded * length);
  }

  private isActive(): boolean {
    const snapshot = this.snapshot$.value;
    return snapshot.lifecycle === 'starting' || snapshot.lifecycle === 'running';
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
