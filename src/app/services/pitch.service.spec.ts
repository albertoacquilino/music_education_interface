import {
  normalizeAudioFrame,
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

  it('normalizes silence to finite zeros and classifies it explicitly', () => {
    const normalized = scaleArrayToMinusOneToOne(
      new Float32Array([0, 0, 0])
    );
    const result = normalizeAudioFrame(new Float32Array([0, 0, 0]));

    expect(Array.from(normalized)).toEqual([0, 0, 0]);
    expect(Array.from(normalized).every(Number.isFinite)).toBeTrue();
    expect(result.kind).toBe('silence');
  });

  it('classifies non-finite frames as invalid without propagating NaN', () => {
    const result = normalizeAudioFrame(
      new Float32Array([0, Number.NaN, 1])
    );

    expect(result.kind).toBe('invalid');
    expect(Array.from(result.data)).toEqual([0, 0, 0]);
  });
});
