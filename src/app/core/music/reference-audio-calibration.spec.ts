import { INSTRUMENT_DEFINITIONS, InstrumentRegistryService } from '../../instruments/instrument-registry.service';
import { referenceCalibration, calibratedPlaybackRate, calibrationIdentity } from './reference-audio-calibration';
import { REFERENCE_CALIBRATIONS } from './reference-audio-calibration-data';
import { frequencyForMidi } from './pitch-math';

describe('approved per-recording calibration', () => {
  const registry = new InstrumentRegistryService();
  it('covers 147 unique active recordings and preserves every transposition and alias', () => {
    const ids: string[] = [], paths: string[] = [];
    for (const instrument of INSTRUMENT_DEFINITIONS) {
      for (const note of instrument.notes) {
        ids.push(note.id); paths.push(note.referenceAudio.path);
        const entry = referenceCalibration(note.id, note.referenceAudio.path);
        expect(entry.measuredWholeSustainFrequencyHz).toBeGreaterThan(0);
        expect(note.soundingMidiAtA4_440).toBe(note.writtenMidi + instrument.transposition.writtenToSoundingSemitones);
        for (const a4 of [430, 440, 442, 450]) {
          for (const alias of note.displayTokens) {
            const target = registry.resolveTarget(instrument.id, note.id, a4, alias);
            const rate = calibratedPlaybackRate(note.id, entry.path, target.expectedSoundingFrequencyHz);
            expect(rate * entry.calibrationReferenceFrequencyHz).toBeCloseTo(frequencyForMidi(note.soundingMidiAtA4_440, a4), 9);
          }
        }
        expect(calibrationIdentity(note.id, entry.path)).toContain(entry.sourceSha256);
      }
    }
    expect(ids.length).toBe(147); expect(new Set(paths).size).toBe(147);
    expect(Object.keys(REFERENCE_CALIBRATIONS).sort()).toEqual(ids.sort());
  });
  it('hashes every exact source asset in the browser', async () => {
    for (const entry of Object.values(REFERENCE_CALIBRATIONS)) {
      const response = await fetch('/' + entry.path); expect(response.ok).toBeTrue();
      const digest = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
      expect(Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')).toBe(entry.sourceSha256);
    }
  }, 30000);
  it('rejects missing, mismatched and invalid data without a legacy tuning substitute', () => {
    expect(() => referenceCalibration('missing', 'missing')).toThrow();
    const id = Object.keys(REFERENCE_CALIBRATIONS)[0], entry = REFERENCE_CALIBRATIONS[id];
    expect(() => referenceCalibration(id, 'wrong')).toThrow();
    for (const hz of [0, -1, NaN, Infinity]) { expect(() => calibratedPlaybackRate(id, entry.path, hz)).toThrow(); }
    const invalid = { ...entry, calibrationReferenceFrequencyHz: NaN };
    (REFERENCE_CALIBRATIONS as any)[id] = invalid;
    try { expect(() => referenceCalibration(id, entry.path)).toThrow(); }
    finally { (REFERENCE_CALIBRATIONS as any)[id] = entry; }
    (REFERENCE_CALIBRATIONS as any)[id] = { ...entry, calibrationReferenceFrequencyHz: Number.MIN_VALUE };
    try { expect(() => calibratedPlaybackRate(id, entry.path, 440)).toThrowError(/Invalid calibrated playback rate/); }
    finally { (REFERENCE_CALIBRATIONS as any)[id] = entry; }
  });
});
