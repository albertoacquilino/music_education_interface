import { AppBeat } from '../models/appbeat.types';
import { MAXCYCLES, MAXTEMPO, MINTEMPO } from '../constants';
import { BeatService } from './beat.service';

describe('BeatService current timing contract', () => {
  let service: BeatService;
  const defaultPeriodMs = 60000 / 80;

  beforeEach(() => {
    localStorage.clear();
    jasmine.clock().install();
    service = new BeatService();
  });

  afterEach(() => {
    service.stop();
    jasmine.clock().uninstall();
  });

  it('starts at the stored/default tempo with idle counters and no immediate tick', () => {
    const ticks: AppBeat[] = [];
    service.tick$.subscribe(tick => ticks.push({ ...tick }));

    expect(service.tempo$.value).toBe(80);
    expect(service.playing$.value).toBeFalse();
    expect([service._cycle, service._measure, service._beat]).toEqual([-1, -1, -1]);

    service.start();

    expect(service.playing$.value).toBeTrue();
    expect([service._cycle, service._measure, service._beat]).toEqual([0, -1, -1]);
    expect(ticks).toEqual([]);
  });

  it('uses four beats per measure and three measures per cycle at 60000 / tempo ms', () => {
    const ticks: AppBeat[] = [];
    service.tick$.subscribe(tick => ticks.push({ ...tick }));
    service.start();

    jasmine.clock().tick(defaultPeriodMs - 1);
    expect(ticks).toEqual([]);

    jasmine.clock().tick(1);
    expect(ticks[0]).toEqual({ playing: true, measure: 0, beat: 0, cycle: 1 });

    jasmine.clock().tick(defaultPeriodMs * 3);
    expect(ticks[3]).toEqual({ playing: true, measure: 0, beat: 3, cycle: 1 });

    jasmine.clock().tick(defaultPeriodMs);
    expect(ticks[4]).toEqual({ playing: true, measure: 1, beat: 0, cycle: 1 });

    jasmine.clock().tick(defaultPeriodMs * 7);
    expect(ticks[11]).toEqual({ playing: true, measure: 2, beat: 3, cycle: 1 });

    jasmine.clock().tick(defaultPeriodMs);
    expect(ticks[12]).toEqual({ playing: true, measure: 0, beat: 0, cycle: 2 });
  });

  it('accepts only inclusive tempo bounds while idle and ignores changes while playing', () => {
    service.setTempo(MINTEMPO);
    expect(service.tempo$.value).toBe(MINTEMPO);
    expect(localStorage.getItem('tempo')).toBe(String(MINTEMPO));

    service.setTempo(MINTEMPO - 1);
    expect(service.tempo$.value).toBe(MINTEMPO);

    service.setTempo(MAXTEMPO);
    expect(service.tempo$.value).toBe(MAXTEMPO);

    service.start();
    service.setTempo(80);
    expect(service.tempo$.value).toBe(MAXTEMPO);
  });

  it('emits one stopped snapshot on manual stop and restarts from cycle one', () => {
    const ticks: AppBeat[] = [];
    service.tick$.subscribe(tick => ticks.push({ ...tick }));
    service.start();
    jasmine.clock().tick(defaultPeriodMs);

    service.stop();
    service.stop();

    expect(service.playing$.value).toBeFalse();
    expect(ticks).toEqual([
      { playing: true, measure: 0, beat: 0, cycle: 1 },
      { playing: false, measure: 0, beat: 0, cycle: 1 }
    ]);

    service.start();
    jasmine.clock().tick(defaultPeriodMs);
    expect(ticks[2]).toEqual({ playing: true, measure: 0, beat: 0, cycle: 1 });
  });

  it('characterizes the terminal MAXCYCLES stop and duplicate outer tick', () => {
    const ticks: AppBeat[] = [];
    service.tick$.subscribe(tick => ticks.push({ ...tick }));
    service.start();

    jasmine.clock().tick(defaultPeriodMs * (11 * 12 + 1));

    expect(MAXCYCLES).toBe(12);
    expect(service.playing$.value).toBeFalse();
    expect(ticks.length).toBe(134);
    expect(ticks[131]).toEqual({ playing: true, measure: 2, beat: 3, cycle: 11 });
    expect(ticks[132]).toEqual({ playing: false, measure: 0, beat: 0, cycle: 12 });
    expect(ticks[133]).toEqual({ playing: true, measure: 0, beat: 0, cycle: 12 });
    expect(ticks.filter(tick => !tick.playing).length).toBe(1);
  });
});
