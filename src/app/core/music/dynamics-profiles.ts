import { InstrumentId } from '../../instruments/instrument-definition';

export type SoftDynamic = 'mf' | 'p';
/** Selected production calibration: C — Intermediate. */
export const DYNAMICS_LEVEL_DB = { f: 0, mf: -6, p: -12 } as const;
export const DYNAMICS_LEVELS = {
  f: 1,
  mf: 10 ** (DYNAMICS_LEVEL_DB.mf / 20),
  p: 10 ** (DYNAMICS_LEVEL_DB.p / 20)
} as const;
export const DYNAMICS_PROFILES: Record<InstrumentId, {
  harmonic: number; floorHz: number; mfDb: number; pDb: number;
}> = {
  'trumpet-bb': { harmonic: 3, floorHz: 1000, mfDb: -2.25, pDb: -5.25 },
  'clarinet-bb': { harmonic: 4, floorHz: 1200, mfDb: -1.5, pDb: -3.75 },
  'oboe-c': { harmonic: 4, floorHz: 1600, mfDb: -1.875, pDb: -4.5 },
  'flute-c': { harmonic: 2.5, floorHz: 900, mfDb: -1.125, pDb: -3 }
};
export const LOW_REGISTER_SHELF = { fullDepthHz: 440, minimumDepthRatio: .65 } as const;

export function dynamicsShelf(instrument: InstrumentId, soundingHz: number, dynamic: SoftDynamic, sampleRate: number) {
  const profile = DYNAMICS_PROFILES[instrument];
  const mobileDepth = Math.min(1, Math.max(LOW_REGISTER_SHELF.minimumDepthRatio,
    soundingHz / LOW_REGISTER_SHELF.fullDepthHz));
  // Exactly the mean of original A and protected mobile B shelf depths.
  const depth = (2 + mobileDepth) / 3;
  return {
    frequencyHz: Math.min(sampleRate * .4, Math.max(profile.floorHz, soundingHz * profile.harmonic)),
    gainDb: (dynamic === 'mf' ? profile.mfDb : profile.pDb) * depth
  };
}

/** Same .25–.75 s stereo RMS window used by the selected comparison. */
export function calibrationRms(buffer: AudioBuffer): number {
  let sum = 0, count = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = Math.round(.25 * buffer.sampleRate); i < Math.min(data.length, Math.round(.75 * buffer.sampleRate)); i++) {
      sum += data[i] * data[i]; count++;
    }
  }
  return Math.sqrt(sum / count);
}

export function compensatedDynamicsGain(originalRms: number, filteredRms: number, dynamic: SoftDynamic): number {
  const gain = originalRms * DYNAMICS_LEVELS[dynamic] / filteredRms;
  if (!Number.isFinite(gain) || gain <= 0 || gain > 1) {
    throw new Error('Unable to calibrate reference dynamics without amplification');
  }
  return gain;
}
