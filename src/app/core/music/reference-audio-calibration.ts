import { REFERENCE_CALIBRATIONS, REFERENCE_CALIBRATION_VERSION, ReferenceCalibration } from './reference-audio-calibration-data';

export function referenceCalibration(noteId: string, path: string): ReferenceCalibration {
  const entry = REFERENCE_CALIBRATIONS[noteId];
  if (!entry || entry.path !== path || !/^[a-f0-9]{64}$/.test(entry.sourceSha256)
      || !Number.isFinite(entry.calibrationReferenceFrequencyHz) || entry.calibrationReferenceFrequencyHz <= 0
      || !Number.isFinite(entry.measuredWholeSustainFrequencyHz) || entry.measuredWholeSustainFrequencyHz <= 0) {
    throw new Error('Missing or invalid reference calibration: ' + noteId);
  }
  return entry;
}

/** Target already incorporates sounding transposition and selected A4. Apply exactly once. */
export function calibratedPlaybackRate(noteId: string, path: string, targetSoundingHz: number): number {
  if (!Number.isFinite(targetSoundingHz) || targetSoundingHz <= 0) { throw new Error('Invalid reference target frequency'); }
  const rate = targetSoundingHz / referenceCalibration(noteId, path).calibrationReferenceFrequencyHz;
  if (!Number.isFinite(rate) || rate <= 0) { throw new Error('Invalid calibrated playback rate'); }
  return rate;
}

/** Prepared gains depend on the source, approved reference and calibration policy version. */
export function calibrationIdentity(noteId: string, path: string): string {
  const entry = referenceCalibration(noteId, path);
  return [REFERENCE_CALIBRATION_VERSION, path, entry.sourceSha256, entry.calibrationReferenceFrequencyHz].join(':');
}
