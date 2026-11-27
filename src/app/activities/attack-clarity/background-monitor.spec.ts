import { BackgroundMonitor } from './background-monitor';

/** Envelope frames at 1 kHz: [t, input, harmonic, noise, pitchHz]. */
function frames(level: number, seconds: number, pitchHz = 0): number[] {
  const out: number[] = [];
  for (let k = 0; k < seconds * 1000; k += 1) {
    out.push(k / 1000, level, 0, 0, pitchHz);
  }
  return out;
}

describe('BackgroundMonitor', () => {
  let monitor: BackgroundMonitor;

  beforeEach(() => {
    monitor = new BackgroundMonitor();
  });

  it('opens a note for a sound well above a quiet background', () => {
    monitor.addEnvelopes(frames(0.003, 2));
    monitor.addEnvelopes(frames(0.2, 0.5, 466));
    expect(monitor.noteOpen).toBeTrue();
    expect(monitor.condition).toBe('normal');
  });

  it('stays normal on a loud background when nothing is played', () => {
    monitor.addEnvelopes(frames(0.12, 5)); // unpitched noise
    expect(monitor.condition).toBe('normal');
  });

  it('reports too loud when played sound cannot start a note', () => {
    monitor.addEnvelopes(frames(0.1, 3)); // background, about -20 dBFS
    for (let i = 0; i < 4; i += 1) {
      monitor.addEnvelopes(frames(0.3, 0.6, 466)); // voice about 10 dB above
      monitor.addEnvelopes(frames(0.1, 0.3));
    }
    expect(monitor.noteOpen).toBeFalse();
    expect(monitor.condition).toBe('too-loud');
  });

  it('returns to normal a few seconds after playing stops', () => {
    monitor.addEnvelopes(frames(0.1, 3));
    monitor.addEnvelopes(frames(0.3, 1, 466));
    expect(monitor.condition).toBe('too-loud');
    monitor.addEnvelopes(frames(0.1, 3.5));
    expect(monitor.condition).toBe('normal');
  });

  it('does not count the fading end of a note', () => {
    monitor.addEnvelopes(frames(0.003, 2));
    for (let i = 0; i < 5; i += 1) {
      monitor.addEnvelopes(frames(0.3, 0.8, 466));
      monitor.addEnvelopes(frames(0.02, 0.15, 466)); // pitched tail, far below the note
      monitor.addEnvelopes(frames(0.003, 0.3));
    }
    expect(monitor.condition).toBe('normal');
  });
});
