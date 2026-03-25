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
