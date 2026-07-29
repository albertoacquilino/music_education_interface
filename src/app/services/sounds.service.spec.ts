import { EventEmitter } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AppBeat } from '../models/appbeat.types';
import { SoundsService } from './sounds.service';

describe('SoundsService current beat coupling', () => {
  beforeEach(() => {
    spyOn<any>(SoundsService.prototype, 'preloadSounds').and.resolveTo();
  });

  function createService() {
    const tick$ = new EventEmitter<AppBeat>();
    const beat = {
      tick$,
      tempo$: new BehaviorSubject(80)
    };
    const service = new SoundsService(beat as any);
    spyOn(service, 'playMetronome');
    spyOn(service, 'playNoteSound');
    return { service, tick$ };
  }

  it('plays a metronome on every tick regardless of the playing flag', () => {
    const { service, tick$ } = createService();

    tick$.emit({ playing: false, measure: 0, beat: 0, cycle: 12 });
    tick$.emit({ playing: true, measure: 0, beat: 0, cycle: 12 });

    expect(service.playMetronome).toHaveBeenCalledTimes(2);
    expect(service.playMetronome).toHaveBeenCalledWith(0);
    expect(service.playNoteSound).not.toHaveBeenCalled();
  });

  it('starts the current reference note only at beat zero of measure one', () => {
    const { service, tick$ } = createService();
    service.currentNote = 13;

    tick$.emit({ playing: true, measure: 1, beat: 0, cycle: 1 });
    tick$.emit({ playing: true, measure: 1, beat: 1, cycle: 1 });
    tick$.emit({ playing: true, measure: 2, beat: 0, cycle: 1 });

    expect(service.playMetronome).toHaveBeenCalledTimes(3);
    expect(service.playNoteSound).toHaveBeenCalledOnceWith(13);
  });
});
