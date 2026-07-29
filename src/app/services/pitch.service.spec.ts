import {
  PITCH_MINIMUM_HZ,
  scaleArrayToMinusOneToOne
} from './pitch.service';

describe('PitchService current detector preprocessing', () => {
  it('uses a hard-coded 140 Hz minimum detector pitch', () => {
    expect(PITCH_MINIMUM_HZ).toBe(140);
  });

  it('normalizes a non-silent frame by its absolute peak', () => {
    const normalized = scaleArrayToMinusOneToOne(
      new Float32Array([-0.5, 0.25, 1])
    );

    expect(Array.from(normalized)).toEqual([-0.5, 0.25, 1]);
  });

  it('characterizes silent-frame division by zero as NaN samples', () => {
    const normalized = scaleArrayToMinusOneToOne(
      new Float32Array([0, 0, 0])
    );

    expect(Array.from(normalized).every(Number.isNaN)).toBeTrue();
  });
});
