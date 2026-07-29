import { Howl } from 'howler';
import { InstrumentRegistryService } from '../instruments/instrument-registry.service';
import { SoundsService } from './sounds.service';

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

  it('derives bounded reference playback rate from the selected A4', () => {
    const service = new SoundsService();
    const registry = new InstrumentRegistryService();
    const instrument = registry.get('oboe-c');
    const note = instrument.notes.find(
      candidate => candidate.displayTokens[0] === 'A4'
    )!;
    const target = registry.resolveTarget(instrument.id, note.id, 450);
    const audio = jasmine.createSpyObj<Howl>(
      'Howl',
      ['play', 'rate', 'volume', 'fade', 'stop']
    );
    audio.play.and.returnValue(7);
    (service as any).preloadedNotes = new Map([[target.noteId, audio]]);

    service.playReference(target, {
      durationMs: 3000,
      gain: 1,
      desiredReferenceA4Hz: 450
    });

    expect(audio.rate).toHaveBeenCalledOnceWith(450 / 440, 7);
  });
});
