import {
  centsBetween,
  frequencyForMidi,
  midiToSpelledPitch,
  parseAppPitchToken,
  spelledPitchToMidi
} from './pitch-math';

describe('typed pitch math', () => {
  it('parses the repository spelling convention without losing accidentals', () => {
    expect(parseAppPitchToken('C4s')).toEqual({
      letter: 'C',
      accidental: 'sharp',
      octave: 4
    });
    expect(parseAppPitchToken('E4f')).toEqual({
      letter: 'E',
      accidental: 'flat',
      octave: 4
    });
    expect(spelledPitchToMidi(parseAppPitchToken('A4'))).toBe(69);
  });

  it('converts MIDI frequency at A4 430, 440, and 450 Hz', () => {
    expect(frequencyForMidi(69, 430)).toBe(430);
    expect(frequencyForMidi(69, 440)).toBe(440);
    expect(frequencyForMidi(69, 450)).toBe(450);
    expect(frequencyForMidi(67, 440)).toBeCloseTo(391.995436, 5);
  });

  it('returns an explicit invalid result for cents involving silence', () => {
    expect(centsBetween(0, 440)).toBeNull();
    expect(centsBetween(Number.NaN, 440)).toBeNull();
    expect(centsBetween(440, 440)).toBeCloseTo(0, 10);
  });

  it('uses stable canonical sounding spellings for transposed MIDI pitches', () => {
    expect(midiToSpelledPitch(67)).toEqual({
      letter: 'G',
      accidental: 'natural',
      octave: 4
    });
  });
});
