export type PitchLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export type PitchAccidental = 'flat' | 'natural' | 'sharp';

export interface SpelledPitch {
  readonly letter: PitchLetter;
  readonly accidental: PitchAccidental;
  readonly octave: number;
}

const SEMITONES_FROM_C: Record<PitchLetter, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11
};

const SHARP_SPELLINGS: readonly Pick<SpelledPitch, 'letter' | 'accidental'>[] = [
  { letter: 'C', accidental: 'natural' },
  { letter: 'C', accidental: 'sharp' },
  { letter: 'D', accidental: 'natural' },
  { letter: 'D', accidental: 'sharp' },
  { letter: 'E', accidental: 'natural' },
  { letter: 'F', accidental: 'natural' },
  { letter: 'F', accidental: 'sharp' },
  { letter: 'G', accidental: 'natural' },
  { letter: 'G', accidental: 'sharp' },
  { letter: 'A', accidental: 'natural' },
  { letter: 'A', accidental: 'sharp' },
  { letter: 'B', accidental: 'natural' }
];

export function parseAppPitchToken(token: string): SpelledPitch {
  const match = token.match(/^([A-G])(-?\d+)([sf])?$/);
  if (!match) {
    throw new Error(`Invalid pitch token: ${token}`);
  }

  return {
    letter: match[1] as PitchLetter,
    accidental: match[3] === 's'
      ? 'sharp'
      : match[3] === 'f'
        ? 'flat'
        : 'natural',
    octave: Number(match[2])
  };
}

export function formatAppPitchToken(pitch: SpelledPitch): string {
  const accidental = pitch.accidental === 'sharp'
    ? 's'
    : pitch.accidental === 'flat'
      ? 'f'
      : '';
  return `${pitch.letter}${pitch.octave}${accidental}`;
}

export function spelledPitchToMidi(pitch: SpelledPitch): number {
  const accidentalOffset = pitch.accidental === 'sharp'
    ? 1
    : pitch.accidental === 'flat'
      ? -1
      : 0;
  return (pitch.octave + 1) * 12
    + SEMITONES_FROM_C[pitch.letter]
    + accidentalOffset;
}

export function midiToSpelledPitch(midi: number): SpelledPitch {
  if (!Number.isInteger(midi)) {
    throw new Error(`MIDI note must be an integer: ${midi}`);
  }

  const pitchClass = ((midi % 12) + 12) % 12;
  const spelling = SHARP_SPELLINGS[pitchClass];
  return {
    ...spelling,
    octave: Math.floor(midi / 12) - 1
  };
}

export function frequencyForMidi(midi: number, referenceA4Hz: number): number {
  if (!Number.isFinite(referenceA4Hz) || referenceA4Hz <= 0) {
    throw new Error(`Reference A4 must be positive and finite: ${referenceA4Hz}`);
  }
  return referenceA4Hz * Math.pow(2, (midi - 69) / 12);
}

export function centsBetween(frequencyHz: number, targetFrequencyHz: number): number | null {
  if (
    !Number.isFinite(frequencyHz)
    || !Number.isFinite(targetFrequencyHz)
    || frequencyHz <= 0
    || targetFrequencyHz <= 0
  ) {
    return null;
  }
  return 1200 * Math.log2(frequencyHz / targetFrequencyHz);
}
