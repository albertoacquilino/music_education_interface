import { MAXTEMPO, MINTEMPO } from '../constants';
import { BeatService } from './beat.service';

describe('BeatService tempo settings boundary', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses the stored tempo or a validated default', () => {
    expect(new BeatService().tempo$.value).toBe(80);
    localStorage.setItem('tempo', '120');
    expect(new BeatService().tempo$.value).toBe(120);
    localStorage.setItem('tempo', 'not-a-number');
    expect(new BeatService().tempo$.value).toBe(80);
  });

  it('accepts inclusive supported bounds and persists them', () => {
    const service = new BeatService();
    service.setTempo(MINTEMPO);
    expect(service.tempo$.value).toBe(MINTEMPO);
    service.setTempo(MAXTEMPO);
    expect(service.tempo$.value).toBe(MAXTEMPO);
    expect(localStorage.getItem('tempo')).toBe(String(MAXTEMPO));
  });

  it('rejects unsupported values and contains no activity phase state', () => {
    const service = new BeatService();
    service.setTempo(MINTEMPO - 1);
    service.setTempo(MAXTEMPO + 1);

    expect(service.tempo$.value).toBe(80);
    expect((service as any).tick$).toBeUndefined();
    expect((service as any).playing$).toBeUndefined();
    expect((service as any).start).toBeUndefined();
  });
});
