# Concert flute assets and calibration

Concert flute is non-transposing, B3–B6 inclusive. Primary spellings follow
the existing note arrays (C-sharp, E-flat, F-sharp, G-sharp, B-flat), with
enharmonic aliases sharing assets. SVGs were copied without alteration from
the supplied flute-assets/images folder; redundant PNGs are not bundled.

All 37 WAVs are 48 kHz stereo 16-bit PCM. M4As use FFmpeg AAC-LC at 192 kb/s,
retaining source rate/channels and full duration, with no filters, normalization,
trimming or pitch correction. AAC is lossy and decoded encoder padding may vary.

Sampled source pitches were approximately -2 to +36 cents from A4=440 theoretical
equal temperament. This is an observation, not a per-recording calibration.
The shared referenceAudio recordedSoundingFrequencyHz field is a theoretical
declaration (validationStatus: declared-unmeasured), not a measured fundamental.
For flute, recordedReferenceA4Hz=440 retains the existing playback-rate baseline,
not a claim of exact source tuning. Expected target pitch remains theoretical.
Changing reference A4 scales playback by A4/440 and preserves source offsets.
Future measured calibration requires a separate musical/product decision.

Target Intonation uses a flute-only 2100 Hz ceiling; other instruments retain
2000 Hz. B6 reaches 2020.43 Hz at A4=450. Synthetic bundled-detector tests near
2.0–2.1 kHz do not establish real microphone/high-register flute accuracy.

Fingerings retain their white backgrounds and natural aspect ratios. The enlarged
Ionic view freezes the opened diagram, offers 100–400% zoom and scrolling/panning,
and does not pause or mutate the exercise or audio.
