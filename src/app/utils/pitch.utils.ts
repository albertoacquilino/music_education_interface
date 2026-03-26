/**
 * Calculates the mean of the dominant pitch bucket.
 * Buckets are grouped using a small tolerance to smooth jittery detector output.
 */
export function calculateDominantPitchMean(pitches: number[], toleranceHz: number = 2): number {
  const validPitches = pitches.filter((pitch) => Number.isFinite(pitch) && pitch > 0);
  if (validPitches.length === 0) {
    return 0;
  }

  const buckets = new Map<number, number[]>();

  for (const pitch of validPitches) {
    let bucketFound = false;

    for (const [key, bucket] of buckets.entries()) {
      if (Math.abs(pitch - key) <= toleranceHz) {
        bucket.push(pitch);
        bucketFound = true;
        break;
      }
    }

    if (!bucketFound) {
      buckets.set(pitch, [pitch]);
    }
  }

  let maxBucket: number[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.length > maxBucket.length) {
      maxBucket = bucket;
    }
  }

  if (maxBucket.length === 0) {
    return 0;
  }

  return maxBucket.reduce((sum, pitch) => sum + pitch, 0) / maxBucket.length;
}

/**
 * Convert a frequency in Hz to a note name using equal temperament and A4 = 440Hz.
 * Returns an empty string for invalid frequencies (<= 0, NaN, null, undefined).
 * Example outputs: C, C#, D, D#, E, F, F#, G, G#, A, A#, B
 */
export function frequencyToNoteName(freq: number | null | undefined): string {
  if (!Number.isFinite(freq) || (freq as number) <= 0) {
    return '';
  }

  const f = freq as number;
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const midi = Math.round(69 + 12 * Math.log2(f / 440));
  const name = noteNames[((midi % 12) + 12) % 12];
  return name;
}

/**
 * Convert an expected note label from the app (e.g. 'C4', 'F3s', 'G3f') to a canonical note name
 * matching the output of `frequencyToNoteName` (C, C#, D, ...).
 * - 's' suffix is used for sharps in the app labels (e.g., 'F3s' -> 'F#')
 * - 'f' suffix is used for flats (e.g., 'G3f' -> 'F#' because Gb == F#)
 * Returns an empty string for unexpected formats.
 */
export function expectedLabelToNoteName(label: string | null | undefined): string {
  if (!label || typeof label !== 'string') return '';
  // match letter, octave digits, optional accidental s or f
  const m = label.match(/^([A-G])\d+(s|f)?$/);
  if (!m) return '';
  const letter = m[1];
  const acc = m[2];
  if (!acc) return letter;
  if (acc === 's') return `${letter}#`;
  // flats -> convert to equivalent sharp
  const flatToSharp: { [k: string]: string } = { 'A': 'G#', 'B': 'A#', 'C': 'B', 'D': 'C#', 'E': 'D#', 'F': 'E', 'G': 'F#' };
  // For flats we need the note name one semitone below the natural note, but the app labels use e.g. G3f meaning Gb
  // Map Gb -> F# (G -> F#), Ab -> G#, Bb -> A#, Db -> C#, Eb -> D#
  // We'll handle common cases by mapping by letter
  switch (letter) {
    case 'A': return 'G#';
    case 'B': return 'A#';
    case 'C': return 'B';
    case 'D': return 'C#';
    case 'E': return 'D#';
    case 'F': return 'E';
    case 'G': return 'F#';
    default: return letter;
  }
}
