import { COLUMNS_PER_S, WaveformTrack } from './waveform-track';

describe('WaveformTrack', () => {
  const rate = 1000; // 5 samples per column

  it('keeps the peak of each 5 ms column', () => {
    const track = new WaveformTrack(rate, 1);
    track.addSamples([0.1, -0.5, 0.2, 0, 0, 0.3, 0, 0, 0, 0], 0);
    expect(track.firstColumn).toBe(0);
    expect(track.endColumn).toBe(2);
    expect(track.peak[track.slot(0)]).toBeCloseTo(0.5);
    expect(track.peak[track.slot(1)]).toBeCloseTo(0.3);
    expect(track.endS).toBeCloseTo(0.01);
  });

  it('stores envelope levels and pitch in the matching column', () => {
    const track = new WaveformTrack(rate, 1);
    track.addSamples(new Array(20).fill(0.1), 0);
    track.addEnvelopes([0.006, 0.2, 0.15, 0.05, 440, 0.007, 0.2, 0.18, 0.04, 441]);
    const s = track.slot(Math.floor(0.006 * COLUMNS_PER_S));
    expect(track.harmonic[s]).toBeCloseTo(0.18);
    expect(track.noise[s]).toBeCloseTo(0.05);
    expect(track.pitch[s]).toBe(441);
    // Frames beyond the samples written are ignored.
    track.addEnvelopes([5, 0.2, 0.15, 0.05, 440]);
    expect(track.slot(1000)).toBe(-1);
  });

  it('ring mode keeps only the last capacity', () => {
    const track = new WaveformTrack(rate, 0.05); // 10 columns
    track.addSamples(new Array(100).fill(0.2), 0); // 20 columns
    expect(track.endColumn).toBe(20);
    expect(track.firstColumn).toBe(10);
    expect(track.slot(5)).toBe(-1);
    expect(track.startS).toBeCloseTo(0.05);
  });

  it('linear mode stops when full', () => {
    const track = new WaveformTrack(rate, 0.05, 'linear');
    expect(track.addSamples(new Array(100).fill(0.2), 500)).toBeFalse();
    expect(track.full).toBeTrue();
    expect(track.firstColumn).toBe(100);
    expect(track.endColumn).toBe(110);
  });
});
