import { Observable, Subject } from 'rxjs';
import {
  ActivityContext,
  AudioPlayback,
  ClockPort,
  ClockTick,
  PitchEstimate
} from '../../core/activity/activity-context';
import { ActivitySessionService } from '../../core/activity/activity-session.service';
import { InstrumentRegistryService } from '../../instruments/instrument-registry.service';
import { scoreForTarget, scoreFromNote } from '../../utils/score.utils';
import { TargetIntonationController } from './target-intonation.controller';
import {
  TARGET_INTONATION_DEFAULTS,
  TargetIntonationConfig
} from './target-intonation.types';

interface ScheduledTimer {
  readonly dueAtMs: number;
  readonly callback: (observedAtMs: number) => void;
  active: boolean;
}

class FakeClock implements ClockPort {
  now = 1000;
  cancelledTimerCount = 0;
  private timers: ScheduledTimer[] = [];

  get pendingTimerCount(): number {
    return this.timers.filter(timer => timer.active).length;
  }

  nowMs(): number {
    return this.now;
  }

  after(
    delayMs: number,
    onElapsed: (observedAtMs: number) => void,
    _signal: AbortSignal
  ) {
    const timer: ScheduledTimer = {
      dueAtMs: this.now + delayMs,
      callback: onElapsed,
      active: true
    };
    this.timers.push(timer);
    return {
      cancel: () => {
        if (!timer.active) {
          return;
        }
        timer.active = false;
        this.cancelledTimerCount += 1;
      }
    };
  }

  every(
    _periodMs: number,
    _onTick: (tick: ClockTick) => void,
    _signal: AbortSignal
  ) {
    return { cancel: () => undefined };
  }

  advanceBy(durationMs: number): void {
    this.advanceTo(this.now + durationMs);
  }

  advanceTo(targetMs: number): void {
    while (true) {
      const next = this.timers
        .filter(timer => timer.active && timer.dueAtMs <= targetMs)
        .sort((left, right) => left.dueAtMs - right.dueAtMs)[0];
      if (!next) {
        break;
      }
      this.now = next.dueAtMs;
      next.active = false;
      next.callback(this.now);
    }
    this.now = targetMs;
  }
}

describe('TargetIntonationController', () => {
  let controller: TargetIntonationController;
  let clock: FakeClock;
  let estimateSource: Subject<PitchEstimate>;
  let activePitchSubscriptions: number;
  let pitchRelease: jasmine.Spy;
  let pitchAcquire: jasmine.Spy;
  let persistence: { open: jasmine.Spy; close: jasmine.Spy };
  let playbacks: { stop: jasmine.Spy }[];
  let audio: {
    unlockFromUserGesture: jasmine.Spy;
    preloadInstrument: jasmine.Spy;
    playMetronome: jasmine.Spy;
    playReference: jasmine.Spy;
    stopAll: jasmine.Spy;
  };
  let context: ActivityContext;
  let instruments: InstrumentRegistryService;
  let config: TargetIntonationConfig;

  beforeEach(() => {
    controller = new TargetIntonationController();
    clock = new FakeClock();
    estimateSource = new Subject<PitchEstimate>();
    activePitchSubscriptions = 0;
    const estimates$ = new Observable<PitchEstimate>(subscriber => {
      activePitchSubscriptions += 1;
      const subscription = estimateSource.subscribe(subscriber);
      return () => {
        activePitchSubscriptions -= 1;
        subscription.unsubscribe();
      };
    });
    pitchRelease = jasmine.createSpy('pitchRelease').and.resolveTo();
    pitchAcquire = jasmine.createSpy('pitchAcquire').and.resolveTo({
      release: pitchRelease
    });
    persistence = {
      open: jasmine.createSpy('open').and.resolveTo(),
      close: jasmine.createSpy('close').and.resolveTo()
    };
    playbacks = [];
    audio = {
      unlockFromUserGesture: jasmine.createSpy('unlock').and.resolveTo(),
      preloadInstrument: jasmine.createSpy('preload').and.resolveTo(),
      playMetronome: jasmine.createSpy('metronome'),
      playReference: jasmine.createSpy('reference').and.callFake(() => {
        const playback = { stop: jasmine.createSpy('playbackStop') };
        playbacks.push(playback);
        return playback as AudioPlayback;
      }),
      stopAll: jasmine.createSpy('stopAll')
    };
    instruments = new InstrumentRegistryService();
    context = {
      clock,
      audio,
      pitch: {
        estimates$,
        acquire: pitchAcquire
      },
      notation: {
        forPrepareListenPlay: (target, dynamic) =>
          scoreFromNote(target.displayToken, target.instrumentId, dynamic),
        forTarget: target => scoreForTarget(target.displayToken)
      },
      instruments,
      persistence,
      random: () => 0
    };
    const trumpet = instruments.get('trumpet-bb');
    const selectedNote = trumpet.notes[13];
    config = {
      instrumentId: 'trumpet-bb',
      lowNoteId: selectedNote.id,
      highNoteId: selectedNote.id,
      lowNoteIndex: selectedNote.index,
      highNoteIndex: selectedNote.index,
      includeAccidentals: false,
      referenceA4Hz: 440,
      targetCount: 1,
      playReferenceTone: true,
      targetPresentationMs: 100,
      referenceToneDurationMs: 100,
      toleranceCents: TARGET_INTONATION_DEFAULTS.toleranceCents,
      farThresholdCents: TARGET_INTONATION_DEFAULTS.farThresholdCents,
      requiredStableMs: 300,
      maximumSpreadCents: TARGET_INTONATION_DEFAULTS.maximumSpreadCents,
      minimumValidEstimates: 4,
      maximumSignalGapMs: 150,
      attemptTimeoutMs: 1000,
      maximumAttemptsPerTarget: 2,
      detectorMinimumHz: TARGET_INTONATION_DEFAULTS.detectorMinimumHz,
      detectorMaximumHz: TARGET_INTONATION_DEFAULTS.detectorMaximumHz
    };
  });

  it('completes a successful stable hold with bounded metrics and no leaked resources', async () => {
    await startAndBeginAttempt();
    emitStableHold();
    expectAttemptResult('stable-hold');

    await controller.dispatch({ type: 'next-target' });
    const result = await controller.whenSettled();

    expect(result.outcome).toBe('completed');
    expect(result.completedTargets).toBe(1);
    expect(result.successfulTargets).toBe(1);
    expect(result.attempts[0].timeToFirstValidEstimateMs).toBe(0);
    expect(result.attempts[0].timeToStableHoldMs).toBe(300);
    expect(persistence.open).toHaveBeenCalledTimes(1);
    expect(persistence.close).toHaveBeenCalledOnceWith(result);
    expect(pitchRelease).toHaveBeenCalledTimes(1);
    expect(activePitchSubscriptions).toBe(0);
    expect(clock.pendingTimerCount).toBe(0);
    expect(playbacks[0].stop).toHaveBeenCalledTimes(1);
    expect(audio.stopAll).toHaveBeenCalledTimes(1);
  });

  it('times out deterministically without receiving a pitch signal', async () => {
    await startAndBeginAttempt();
    clock.advanceBy(config.attemptTimeoutMs);

    expectAttemptResult('timeout');
    await controller.dispatch({ type: 'skip-target' });
    const result = await controller.whenSettled();

    expect(result.attempts[0].validEstimateCount).toBe(0);
    expect(result.attempts[0].wrongNoteCount).toBe(0);
    expect(result.outcome).toBe('completed');
  });

  it('times out when in-window input never satisfies the spread condition', async () => {
    await startAndBeginAttempt();
    const attemptStart = clock.now;
    [0, 100, 200, 300, 400, 500].forEach((offset, index) => {
      emitAtCents(index % 2 === 0 ? -8 : 8, attemptStart + offset);
    });
    clock.advanceTo(attemptStart + config.attemptTimeoutMs);

    const state = currentAttemptResult();
    expect(state.result.outcome).toBe('timeout');
    expect(state.result.validEstimateCount).toBe(6);
    expect(state.result.spreadCents).toBeCloseTo(16, 8);
  });

  it('retries after timeout and succeeds on the next attempt', async () => {
    await startAndBeginAttempt();
    clock.advanceBy(config.attemptTimeoutMs);

    await controller.dispatch({ type: 'retry-attempt' });
    expect(currentState().kind).toBe('presenting-target');
    clock.advanceBy(config.targetPresentationMs);
    emitStableHold();

    const state = currentAttemptResult();
    expect(state.result.attemptIndex).toBe(2);
    expect(state.result.outcome).toBe('stable-hold');
    expect(playbacks.length).toBe(2);
  });

  it('skips an active target and completes it without success', async () => {
    await startAndBeginAttempt();
    await controller.dispatch({ type: 'skip-target' });
    const result = await controller.whenSettled();

    expect(result.outcome).toBe('completed');
    expect(result.completedTargets).toBe(1);
    expect(result.successfulTargets).toBe(0);
    expect(result.attempts[0].outcome).toBe('skipped');
  });

  it('proceeds to a second selected target only after a successful attempt', async () => {
    const trumpet = instruments.get('trumpet-bb');
    const randomValues = [0, 0.999999];
    context = {
      ...context,
      random: () => randomValues.shift() ?? 0
    };
    config = {
      ...config,
      highNoteId: trumpet.notes[15].id,
      highNoteIndex: trumpet.notes[15].index,
      targetCount: 2
    };
    await startAndBeginAttempt();
    const firstTargetId = currentState().target.noteId;
    emitStableHold();

    await controller.dispatch({ type: 'next-target' });
    const secondState = currentState();

    expect(secondState.kind).toBe('presenting-target');
    expect(secondState.targetNumber).toBe(2);
    expect(secondState.target.noteId).not.toBe(firstTargetId);
  });

  it('completes after the configured number of targets', async () => {
    config = { ...config, targetCount: 2 };
    await startAndBeginAttempt();
    emitStableHold();
    await controller.dispatch({ type: 'next-target' });
    clock.advanceBy(config.targetPresentationMs);
    emitStableHold();
    await controller.dispatch({ type: 'next-target' });
    const result = await controller.whenSettled();

    expect(result.completedTargets).toBe(2);
    expect(result.successfulTargets).toBe(2);
    expect(result.attempts.length).toBe(2);
    expect(persistence.close).toHaveBeenCalledTimes(1);
  });

  it('enforces the configured maximum attempts policy', async () => {
    await startAndBeginAttempt();
    clock.advanceBy(config.attemptTimeoutMs);
    expect(currentAttemptResult().canRetry).toBeTrue();

    await controller.dispatch({ type: 'retry-attempt' });
    clock.advanceBy(config.targetPresentationMs);
    clock.advanceBy(config.attemptTimeoutMs);
    const exhausted = currentAttemptResult();

    expect(exhausted.result.attemptIndex).toBe(2);
    expect(exhausted.canRetry).toBeFalse();
    await controller.dispatch({ type: 'retry-attempt' });
    expect(currentAttemptResult()).toBe(exhausted);
  });

  it('cancels navigation exactly once and releases every owned resource', async () => {
    await startAndBeginAttempt();
    const first = await controller.cancel('navigation');
    const repeated = await controller.cancel('navigation');

    expect(first.outcome).toBe('cancelled');
    expect(first.cancelReason).toBe('navigation');
    expect(repeated).toBe(first);
    expect(first.attempts[0].outcome).toBe('cancelled');
    expect(persistence.close).toHaveBeenCalledTimes(1);
    expect(pitchRelease).toHaveBeenCalledTimes(1);
    expect(activePitchSubscriptions).toBe(0);
    expect(clock.pendingTimerCount).toBe(0);
    expect(audio.stopAll).toHaveBeenCalledTimes(1);
  });

  it('restarts cleanly after learner stop', async () => {
    await startAndBeginAttempt();
    await controller.dispatch({ type: 'stop' });

    await controller.start(config, context, new AbortController().signal);
    clock.advanceBy(config.targetPresentationMs);

    expect(currentState().kind).toBe('awaiting-signal');
    expect(currentState().targetNumber).toBe(1);
    expect(persistence.open).toHaveBeenCalledTimes(2);
    expect(pitchAcquire).toHaveBeenCalledTimes(2);
  });

  it('is cancelled as superseded when another activity claims the session', async () => {
    const sessions = new ActivitySessionService();
    const replacement = new TargetIntonationController();
    await sessions.start(controller, config, context);

    await sessions.start(replacement, config, context);
    const superseded = await controller.whenSettled();

    expect(superseded.outcome).toBe('cancelled');
    expect(superseded.cancelReason).toBe('superseded');
    expect(pitchRelease).toHaveBeenCalledTimes(1);
    await sessions.cancel('learner-stop');
    expect(pitchRelease).toHaveBeenCalledTimes(2);
  });

  it('fails cleanly when microphone permission or acquisition is denied', async () => {
    pitchAcquire.and.rejectWith(new Error('microphone denied'));

    await controller.start(config, context, new AbortController().signal);
    const result = await controller.whenSettled();

    expect(result.outcome).toBe('failed');
    expect(result.failure?.code).toBe('resource-failed');
    expect(result.failure?.message).toContain('microphone denied');
    expect(persistence.open).not.toHaveBeenCalled();
    expect(activePitchSubscriptions).toBe(0);
  });

  it('fails and releases the session after a runtime pitch resource failure', async () => {
    await startAndBeginAttempt();
    estimateSource.error(new Error('pitch stream failed'));
    const result = await controller.whenSettled();

    expect(result.outcome).toBe('failed');
    expect(result.failure?.message).toContain('pitch stream failed');
    expect(pitchRelease).toHaveBeenCalledTimes(1);
    expect(persistence.close).toHaveBeenCalledTimes(1);
    expect(activePitchSubscriptions).toBe(0);
  });

  it('continues tracking when optional reference playback fails', async () => {
    audio.playReference.and.throwError('reference unavailable');
    await controller.start(config, context, new AbortController().signal);

    const presenting = currentState();
    expect(presenting.kind).toBe('presenting-target');
    if (presenting.kind === 'presenting-target') {
      expect(presenting.referencePlayback).toBe('failed');
    }
    clock.advanceBy(config.targetPresentationMs);
    emitStableHold();
    expectAttemptResult('stable-hold');
  });

  it('maps wrong-note input to explicit target feedback and never succeeds', async () => {
    await startAndBeginAttempt();
    const target = currentState().target;
    const wrongFrequency =
      target.expectedSoundingFrequencyHz * Math.pow(2, 1 / 12);
    estimateSource.next({
      kind: 'voiced',
      frequencyHz: wrongFrequency,
      capturedAtMs: clock.now,
      emittedAtMs: clock.now
    });

    const state = currentState();
    expect(state.kind).toBe('tracking');
    if (state.kind === 'tracking') {
      expect(state.feedback.band).toBe('wrong-note');
      expect(state.feedback.stableProgress).toBe(0);
    }
  });

  it('fails invalid configuration before acquiring any session resource', async () => {
    await controller.start(
      { ...config, toleranceCents: 40, farThresholdCents: 30 },
      context,
      new AbortController().signal
    );
    const result = await controller.whenSettled();

    expect(result.outcome).toBe('failed');
    expect(result.failure?.code).toBe('invalid-config');
    expect(pitchAcquire).not.toHaveBeenCalled();
    expect(persistence.open).not.toHaveBeenCalled();
  });

  async function startAndBeginAttempt(): Promise<void> {
    await controller.start(config, context, new AbortController().signal);
    expect(currentState().kind).toBe('presenting-target');
    clock.advanceBy(config.targetPresentationMs);
    expect(currentState().kind).toBe('awaiting-signal');
  }

  function emitStableHold(cents = 0): void {
    const attemptStart = clock.now;
    [0, 100, 200, 300].forEach(offset =>
      emitAtCents(cents, attemptStart + offset)
    );
  }

  function emitAtCents(cents: number, capturedAtMs: number): void {
    clock.advanceTo(capturedAtMs);
    const target = currentState().target;
    estimateSource.next({
      kind: 'voiced',
      frequencyHz: target.expectedSoundingFrequencyHz
        * Math.pow(2, cents / 1200),
      capturedAtMs,
      emittedAtMs: capturedAtMs
    });
  }

  function currentState() {
    const snapshot = controller.snapshot$.value;
    if (snapshot.lifecycle !== 'running') {
      throw new Error(`Expected running snapshot, received ${snapshot.lifecycle}`);
    }
    return snapshot.state;
  }

  function currentAttemptResult() {
    const state = currentState();
    if (state.kind !== 'attempt-result') {
      throw new Error(`Expected attempt result, received ${state.kind}`);
    }
    return state;
  }

  function expectAttemptResult(outcome: 'stable-hold' | 'timeout'): void {
    expect(currentAttemptResult().result.outcome).toBe(outcome);
  }
});
