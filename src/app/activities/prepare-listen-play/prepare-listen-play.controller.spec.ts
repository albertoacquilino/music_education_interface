import { BehaviorSubject } from 'rxjs';
import {
  ActivityContext,
  AudioPlayback,
  ClockPort,
  ClockTick,
  PitchEstimate
} from '../../core/activity/activity-context';
import { InstrumentRegistryService } from '../../instruments/instrument-registry.service';
import { scoreFromNote } from '../../utils/score.utils';
import { PrepareListenPlayController } from './prepare-listen-play.controller';
import { PrepareListenPlayConfig } from './prepare-listen-play.types';

class FakeClock implements ClockPort {
  now = 1000;
  callback: ((tick: ClockTick) => void) | null = null;
  cancelCount = 0;
  sequence = 0;

  nowMs(): number {
    return this.now;
  }

  after(
    _delayMs: number,
    _onElapsed: (observedAtMs: number) => void,
    _signal: AbortSignal
  ) {
    return { cancel: () => undefined };
  }

  every(
    periodMs: number,
    onTick: (tick: ClockTick) => void,
    _signal: AbortSignal
  ) {
    this.callback = onTick;
    return {
      cancel: () => {
        this.cancelCount += 1;
        this.callback = null;
      }
    };
  }

  tick(count = 1): void {
    for (let index = 0; index < count; index += 1) {
      const callback = this.callback;
      if (!callback) {
        return;
      }
      this.now += 750;
      callback({
        sequence: this.sequence++,
        scheduledAtMs: this.now,
        observedAtMs: this.now
      });
    }
  }
}

describe('PrepareListenPlayController', () => {
  let controller: PrepareListenPlayController;
  let clock: FakeClock;
  let pitchEstimates$: BehaviorSubject<PitchEstimate>;
  let context: ActivityContext;
  let audio: {
    unlockFromUserGesture: jasmine.Spy;
    preloadInstrument: jasmine.Spy;
    playMetronome: jasmine.Spy;
    playReference: jasmine.Spy;
    stopAll: jasmine.Spy;
  };
  let pitchRelease: jasmine.Spy;
  let persistence: {
    open: jasmine.Spy;
    close: jasmine.Spy;
  };
  let config: PrepareListenPlayConfig;

  beforeEach(() => {
    controller = new PrepareListenPlayController();
    clock = new FakeClock();
    pitchEstimates$ = new BehaviorSubject<PitchEstimate>({
      kind: 'unvoiced',
      reason: 'silence',
      capturedAtMs: 0,
      emittedAtMs: 0
    });
    const playback: AudioPlayback = { stop: jasmine.createSpy('stop') };
    audio = {
      unlockFromUserGesture: jasmine.createSpy('unlock').and.resolveTo(),
      preloadInstrument: jasmine.createSpy('preload').and.resolveTo(),
      playMetronome: jasmine.createSpy('metronome').and.returnValue(playback),
      playReference: jasmine.createSpy('reference').and.returnValue(playback),
      stopAll: jasmine.createSpy('stopAll')
    };
    pitchRelease = jasmine.createSpy('pitchRelease').and.resolveTo();
    persistence = {
      open: jasmine.createSpy('open').and.resolveTo(),
      close: jasmine.createSpy('close').and.resolveTo()
    };
    const instruments = new InstrumentRegistryService();
    context = {
      clock,
      audio,
      pitch: {
        estimates$: pitchEstimates$,
        acquire: jasmine.createSpy('acquire').and.resolveTo({
          release: pitchRelease
        })
      },
      notation: {
        forPrepareListenPlay: (target, dynamic) =>
          scoreFromNote(target.displayToken, target.instrumentId, dynamic),
        forTarget: target => scoreFromNote(
          target.displayToken,
          target.instrumentId
        )
      },
      instruments,
      persistence,
      random: () => 0
    };
    const trumpet = instruments.get('trumpet-bb');
    config = {
      instrumentId: 'trumpet-bb',
      lowNoteId: trumpet.notes[13].id,
      highNoteId: trumpet.notes[13].id,
      lowNoteIndex: 13,
      highNoteIndex: 13,
      tempoBpm: 80,
      beatsPerPhase: 4,
      cycles: 12,
      includeAccidentals: false,
      useDynamics: false,
      pitchDisplay: 'target',
      referenceA4Hz: 440
    };
  });

  it('emits exactly 12 complete prepare/listen/play cycles and one completion', async () => {
    const lifecycles: string[] = [];
    const states: string[] = [];
    controller.snapshot$.subscribe(snapshot => {
      lifecycles.push(snapshot.lifecycle);
      if (snapshot.lifecycle === 'running') {
        states.push(
          `${snapshot.state.cycleNumber}:${snapshot.state.phase}:${snapshot.state.beatIndex}`
        );
      }
    });

    await controller.start(config, context, new AbortController().signal);
    clock.tick(12 * 3 * 4);
    const result = await controller.whenSettled();

    expect(result.outcome).toBe('completed');
    expect(result.completedCycles).toBe(12);
    expect(result.presentedTargetIds.length).toBe(12);
    expect(states.length).toBe(144);
    expect(states.slice(0, 4)).toEqual([
      '1:preparing:0',
      '1:preparing:1',
      '1:preparing:2',
      '1:preparing:3'
    ]);
    expect(states.slice(-4)).toEqual([
      '12:playing:0',
      '12:playing:1',
      '12:playing:2',
      '12:playing:3'
    ]);
    expect(lifecycles.filter(value => value === 'completed').length).toBe(1);
    expect(audio.playMetronome).toHaveBeenCalledTimes(144);
    expect(audio.playReference).toHaveBeenCalledTimes(12);
    expect(persistence.close).toHaveBeenCalledTimes(1);
    expect(clock.cancelCount).toBe(1);
    expect(pitchRelease).toHaveBeenCalledTimes(1);
    expect(audio.stopAll).toHaveBeenCalledTimes(1);
  });

  it('cancels without completion and releases every acquired resource once', async () => {
    await controller.start(config, context, new AbortController().signal);
    clock.tick(17);
    const result = await controller.cancel('learner-stop');
    const repeated = await controller.cancel('learner-stop');

    expect(result.outcome).toBe('cancelled');
    expect(result.cancelReason).toBe('learner-stop');
    expect(repeated).toBe(result);
    expect(persistence.close).toHaveBeenCalledTimes(1);
    expect(clock.cancelCount).toBe(1);
    expect(pitchRelease).toHaveBeenCalledTimes(1);
    expect(audio.stopAll).toHaveBeenCalledTimes(1);
  });

  it('restarts cleanly after cancellation', async () => {
    await controller.start(config, context, new AbortController().signal);
    clock.tick(1);
    await controller.cancel('learner-stop');

    await controller.start(config, context, new AbortController().signal);
    clock.tick(1);
    const snapshot = controller.snapshot$.value;

    expect(snapshot.lifecycle).toBe('running');
    if (snapshot.lifecycle === 'running') {
      expect(snapshot.state.cycleNumber).toBe(1);
      expect(snapshot.state.phase).toBe('preparing');
      expect(snapshot.state.beatIndex).toBe(0);
    }
    expect(persistence.open).toHaveBeenCalledTimes(2);
  });

  it('issues explicit strong/weak metronome and reference audio commands', async () => {
    await controller.start({ ...config, cycles: 1 }, context, new AbortController().signal);
    clock.tick(12);
    await controller.whenSettled();

    expect(audio.playMetronome.calls.allArgs().slice(0, 4)).toEqual([
      ['strong'],
      ['weak'],
      ['weak'],
      ['weak']
    ]);
    expect(audio.playReference).toHaveBeenCalledTimes(1);
    const referenceOptions = audio.playReference.calls.mostRecent().args[1];
    expect(referenceOptions.durationMs).toBe(3000);
    expect(referenceOptions.desiredReferenceA4Hz).toBe(440);
  });

  it('selects targets only from the validated range', async () => {
    const trumpet = context.instruments.get('trumpet-bb');
    const randomValues = [0.999, 0, 0, 0];
    context = {
      ...context,
      random: () => randomValues.shift() ?? 0
    };
    config = {
      ...config,
      cycles: 1,
      lowNoteId: trumpet.notes[13].id,
      highNoteId: trumpet.notes[15].id,
      lowNoteIndex: 13,
      highNoteIndex: 15
    };

    await controller.start(config, context, new AbortController().signal);
    clock.tick(1);
    const snapshot = controller.snapshot$.value;
    expect(snapshot.lifecycle).toBe('running');
    if (snapshot.lifecycle === 'running') {
      expect(snapshot.state.target.noteId).toBe(trumpet.notes[15].id);
    }
  });

  it('uses sounding pitch and selected A4 for non-gating feedback', async () => {
    await controller.start({ ...config, cycles: 1 }, context, new AbortController().signal);
    clock.tick(9);
    pitchEstimates$.next({
      kind: 'voiced',
      frequencyHz: 349.228231,
      capturedAtMs: 10,
      emittedAtMs: 11
    });

    const snapshot = controller.snapshot$.value;
    expect(snapshot.lifecycle).toBe('running');
    if (snapshot.lifecycle === 'running') {
      expect(snapshot.state.target.displayToken).toBe('G4');
      expect(snapshot.state.target.expectedSoundingFrequencyHz)
        .toBeCloseTo(349.228231, 5);
      expect(snapshot.state.pitchFeedback?.kind).toBe('voiced');
      if (snapshot.state.pitchFeedback?.kind === 'voiced') {
        expect(snapshot.state.pitchFeedback.cents).toBeCloseTo(0, 4);
      }
    }
  });

  it('collects the existing four-estimate chromatic means without gating progress', async () => {
    await controller.start({
      ...config,
      cycles: 1,
      pitchDisplay: 'chromatic'
    }, context, new AbortController().signal);
    clock.tick(9);
    [440, 441, 466, 467].forEach(frequencyHz => pitchEstimates$.next({
      kind: 'voiced',
      frequencyHz,
      capturedAtMs: 10,
      emittedAtMs: 11
    }));
    clock.tick(3);
    const result = await controller.whenSettled();

    expect(result.collectedMeans).toEqual({ 1: [440.5] });
  });

  it('persists a partial chromatic cycle when the learner stops manually', async () => {
    await controller.start({
      ...config,
      pitchDisplay: 'chromatic'
    }, context, new AbortController().signal);
    clock.tick(9);
    [440, 441, 466, 467].forEach(frequencyHz => pitchEstimates$.next({
      kind: 'voiced',
      frequencyHz,
      capturedAtMs: 10,
      emittedAtMs: 11
    }));

    const result = await controller.cancel('learner-stop');

    expect(result.collectedMeans).toEqual({ 1: [440.5] });
    expect(persistence.close).toHaveBeenCalledOnceWith(result);
  });

  it('fails invalid instrument/range configuration before acquiring resources', async () => {
    await controller.start({
      ...config,
      lowNoteId: 'missing'
    }, context, new AbortController().signal);
    const result = await controller.whenSettled();

    expect(result.outcome).toBe('failed');
    expect(result.failure?.code).toBe('invalid-config');
    expect(audio.unlockFromUserGesture).not.toHaveBeenCalled();
    expect(persistence.open).not.toHaveBeenCalled();
  });
});
