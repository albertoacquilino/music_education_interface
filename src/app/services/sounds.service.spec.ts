import { Howl, Howler } from 'howler';
import { InstrumentRegistryService } from '../instruments/instrument-registry.service';
import { SoundsService } from './sounds.service';
import { calibratedPlaybackRate } from '../core/music/reference-audio-calibration';
import { DYNAMICS_LEVELS } from '../core/music/dynamics-profiles';

describe('SoundsService explicit audio port', () => {
  beforeEach(() => {
    spyOn<any>(SoundsService.prototype, 'preloadSounds').and.resolveTo();
  });

  it('has no hidden activity-timing subscription or automatic playback', () => {
    const service = new SoundsService();
    const metronome = spyOn(service, 'playMetronome');
    const reference = spyOn(service, 'playReference');

    expect(metronome).not.toHaveBeenCalled();
    expect(reference).not.toHaveBeenCalled();
  });

  it('prepares C gains, routes only soft PLP notes, and releases its own cache', async () => {
    const service = new SoundsService(), registry = new InstrumentRegistryService();
    const instrument = registry.get('flute-c'), note = instrument.notes[13];
    await service.preloadInstrument({ ...instrument, notes: [note] },
      { expressiveDynamics: true, referenceA4Hz: 450 });
    const prepared = (service as any).expressiveNotes.get(note.id);
    expect(prepared.referenceA4Hz).toBe(450);
    expect(prepared.gains.p).toBeGreaterThan(DYNAMICS_LEVELS.p);
    const target = registry.resolveTarget(instrument.id, note.id, 450);
    const audio = jasmine.createSpyObj('Howl', ['volume', 'play', 'rate', 'fade', 'stop']);
    (audio as any)._webAudio = true;
    audio.play.and.returnValue(7);
    (service as any).preloadedNotes.set(note.id, audio);
    const processed = spyOn((service as any).expressive, 'play').and.returnValue({ stop() {} });
    const options = { durationMs: 3000, gain: DYNAMICS_LEVELS.mf, desiredReferenceA4Hz: 450 };
    service.playReference(target, options); // Other exercise / no explicit request.
    service.playReference(target, { ...options, gain: 1, plpDynamic: 'f' });
    expect(processed).not.toHaveBeenCalled();
    service.playReference(target, { ...options, plpDynamic: 'mf' });
    expect(processed).toHaveBeenCalledOnceWith(Howler.ctx, Howler.masterGain, prepared.buffer,
      instrument.id, target.expectedSoundingFrequencyHz, 'mf', prepared.gains.mf, calibratedPlaybackRate(target.noteId, target.referenceAudio.path, target.expectedSoundingFrequencyHz), 3000);
    const metronome = spyOn(service, 'playMetronome');
    service.stopAll();
    expect(metronome).not.toHaveBeenCalled();
    expect((service as any).expressiveNotes.size).toBe(0);
    service.playReference(target, { ...options, plpDynamic: 'p', gain: DYNAMICS_LEVELS.p });
    expect(processed).toHaveBeenCalledTimes(1);
    expect(audio.volume).toHaveBeenCalledWith(DYNAMICS_LEVELS.p);
  });

  it('prevents cancelled preloads from decoding or publishing late buffers', async () => {
    const service = new SoundsService(), instrument = new InstrumentRegistryService().get('flute-c');
    let resolveFetch!: (response: Response) => void;
    const fetchAudio = spyOn(window, 'fetch').and.returnValue(new Promise(resolve => { resolveFetch = resolve; }));
    const task = service.preloadInstrument({ ...instrument, notes: [instrument.notes[0]] },
      { expressiveDynamics: true, referenceA4Hz: 440 });
    await Promise.resolve(); await Promise.resolve();
    expect(fetchAudio).toHaveBeenCalledTimes(1);
    service.stopAll();
    const decodeBytes = jasmine.createSpy('arrayBuffer');
    resolveFetch({ ok: true, arrayBuffer: decodeBytes } as any);
    await task;
    expect(decodeBytes).not.toHaveBeenCalled();
    expect((service as any).expressiveNotes.size).toBe(0);
  });

  it('invalidates stale prepared calibration and fails closed on per-Howl HTML fallback', () => {
    const service = new SoundsService(), registry = new InstrumentRegistryService();
    const note = registry.get('flute-c').notes[0], target = registry.resolveTarget('flute-c', note.id, 442);
    const audio = jasmine.createSpyObj('audio', ['play', 'rate', 'volume', 'fade', 'stop']);
    audio._webAudio = true; audio.play.and.returnValue(7);
    (service as any).preloadedNotes.set(note.id, audio);
    (service as any).expressiveNotes.set(note.id, { referenceA4Hz: 442, calibrationIdentity: 'stale', gains: { p: .25 } });
    const processed = spyOn((service as any).expressive, 'play');
    const options = { durationMs: 1000, gain: .25, desiredReferenceA4Hz: 442, plpDynamic: 'p' as const };
    jasmine.clock().install();
    try {
      service.playReference(target, options).stop();
      expect(processed).not.toHaveBeenCalled();
      expect(audio.rate).toHaveBeenCalledWith(calibratedPlaybackRate(note.id, note.referenceAudio.path, target.expectedSoundingFrequencyHz), 7);
      audio._webAudio = false; audio.play.calls.reset();
      expect(() => service.playReference(target, options)).toThrowError(/requires Web Audio/);
      expect(audio.play).not.toHaveBeenCalled();
      expect(() => service.playReference(target, { ...options, desiredReferenceA4Hz: 440 })).toThrowError(/disagree/);
    } finally { jasmine.clock().uninstall(); }
  });

  for (const durationMs of [1000, 1333, 2000, 4000, 6000]) {
    it('preserves scheduled fades, stop and cancellation at ' + durationMs + ' ms', () => {
      const service = new SoundsService(), registry = new InstrumentRegistryService();
      const target = registry.resolveTarget('oboe-c', registry.get('oboe-c').notes[0].id, 430);
      const audio = jasmine.createSpyObj('audio', ['play', 'rate', 'volume', 'fade', 'stop']);
      audio._webAudio = true; audio.play.and.returnValue(1);
      (service as any).preloadedNotes.set(target.noteId, audio);
      jasmine.clock().install();
      try {
        const options = { durationMs, gain: 1, desiredReferenceA4Hz: 430 };
        service.playReference(target, options);
        jasmine.clock().tick(durationMs - Math.max(durationMs / 10, 100));
        expect(audio.fade).toHaveBeenCalledWith(1, 0, Math.max(durationMs / 10, 100), 1);
        expect(audio.stop).not.toHaveBeenCalled();
        jasmine.clock().tick(Math.max(durationMs / 10, 100)); expect(audio.stop).toHaveBeenCalledTimes(1);
        service.playReference(target, options).stop(); jasmine.clock().tick(durationMs);
        expect(audio.stop).toHaveBeenCalledTimes(2);
      } finally { jasmine.clock().uninstall(); }
    });
  }

  it('keeps gain-only playback available after a soft-reference decode failure', async () => {
    const service = new SoundsService(), registry = new InstrumentRegistryService();
    const instrument = registry.get('flute-c'), note = instrument.notes[0];
    spyOn(window, 'fetch').and.rejectWith(new Error('decode unavailable'));
    const warning = spyOn(console, 'warn');
    await service.preloadInstrument({ ...instrument, notes: [note] },
      { expressiveDynamics: true, referenceA4Hz: 440 });
    expect(warning).toHaveBeenCalled();
    const audio = jasmine.createSpyObj('Howl', ['volume', 'play', 'rate', 'fade', 'stop']);
    (audio as any)._webAudio = true;
    audio.play.and.returnValue(1);
    (service as any).preloadedNotes.set(note.id, audio);
    service.playReference(registry.resolveTarget(instrument.id, note.id, 440),
      { durationMs: 3000, gain: DYNAMICS_LEVELS.p, desiredReferenceA4Hz: 440, plpDynamic: 'p' });
    expect(audio.play).toHaveBeenCalled();
    service.stopAll();
  });

  for (const instrumentId of ['oboe-c', 'flute-c'] as const) {
  it('derives bounded reference playback rate for ' + instrumentId, () => {
    const service = new SoundsService();
    const registry = new InstrumentRegistryService();
    const instrument = registry.get(instrumentId);
    const note = instrument.notes.find(
      candidate => candidate.displayTokens[0] === 'A4'
    )!;
    const target = registry.resolveTarget(instrument.id, note.id, 450);
    const audio = jasmine.createSpyObj<Howl>(
      'Howl',
      ['play', 'rate', 'volume', 'fade', 'stop']
    );
    (audio as any)._webAudio = true;
    audio.play.and.returnValue(7);
    (service as any).preloadedNotes = new Map([[target.noteId, audio]]);

    service.playReference(target, {
      durationMs: 3000,
      gain: 1,
      desiredReferenceA4Hz: 450
    });

    expect(audio.rate).toHaveBeenCalledOnceWith(calibratedPlaybackRate(target.noteId, target.referenceAudio.path, target.expectedSoundingFrequencyHz), 7);
  });
  }
});
