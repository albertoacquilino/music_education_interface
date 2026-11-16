# Production PLP expressive dynamics: Profile C

Only PLP with Dynamics enabled requests this processing. Forte, Dynamics-off,
metronome, other exercises and microphone paths retain their original behavior.
There are no development controls or A/B profiles in the production bundle.

## Central parameters and matching contract

src/app/core/music/dynamics-profiles.ts owns all gain/EQ parameters.

| Instrument | Pivot = max(floor, sounding f0 × multiplier) | Nominal mf/p shelf dB |
|---|---|---|
| Trumpet | max(1000 Hz, f0 × 3) | -2.25 / -5.25 |
| Clarinet | max(1200 Hz, f0 × 4) | -1.5 / -3.75 |
| Oboe | max(1600 Hz, f0 × 4) | -1.875 / -4.5 |
| Flute | max(900 Hz, f0 × 2.5) | -1.125 / -3 |

Depth multiplier is (2+d)/3, where d=min(1,max(.65,f0/440)); this is exactly
the tested C curve, the mean of former A/B effective depths. Pivot is capped at
.4 × sample rate. f0 is theoretical sounding pitch at the session's reference
A4, including transposition, not a measured tuning claim about the recording.

Targets are mf=-6 dB and p=-12 dB relative to unfiltered forte. During preload,
decode and render two-second references at 48 kHz, with the session's playback
rate and filter pivot. Measure .25–.75 second stereo RMS, then calculate:

compensated gain = dry_RMS × 10^(target_dB/20) / unit_filtered_RMS.

This is the exact comparison C measurement contract. It is excerpt-specific,
not gated LUFS or subjective loudness, and full-recording RMS can vary over time.
Comparison gains ranged .50196–.55026 mf and .25213–.30906 p; these are observed
values, not hard-coded limits. Production tests reproduce the independent
comparison graph and check gain/level agreement.

Playback uses the original full recording and existing reference-A4 rate.
No pitch correction, trimming, resampling of source assets or microphone dynamics
assessment is introduced. Random selection, displayed markings, four-beat phases
and three-measure timing remain unchanged.

## Graph, lifecycle and fallback

Soft notes: AudioBufferSource -> per-voice high shelf -> per-voice gain ->
Howler.masterGain. Howler.ctx/masterGain are documented public APIs. No private
Howler source objects, caches or graph connections are accessed. Forte bypasses
the new player entirely. Each soft voice starts with a 5 ms ramp and uses the
existing tail-fade duration.

Serial preload/calibration bounds concurrent mobile resources and completes
before the timer starts. Extra decoded buffers duplicate some Howler memory.
stopAll, instrument changes and navigation stop owned voices, clear the extra
cache and invalidate stale asynchronous results. Nodes disconnect on ending;
stopped suspended contexts release immediately. Stops are idempotent and
overlapping voices own independent nodes. AudioPort has no pause API; context
suspension pauses the scheduled graph together.

Without Web Audio, decode/calibration failure or mismatched prepared A4, use
unfiltered Howler with nominal gains 10^(-6/20) and 10^(-12/20). Silence/non-finite
calibration or compensation above unity is rejected. Failures log a warning and
do not block the exercise. The degraded path cannot reproduce spectral shaping
or exact compensated output targets.

## Rationale and validation limits

[UNSW loudness and spectra](https://phys.unsw.edu.au/jw/loudness.html) and
[double-reed acoustics](https://www.phys.unsw.edu.au/jw/double-reed-acoustics.html)
describe spectral changes with wind excitation. Gentle shelving retains more
upper-frequency information than a low-pass but cannot recreate all softer
articulation, noise and nonlinear timbral changes.

A/B fixtures, RMS matching and the speaker approximation remain in standalone
scripts only. See dynamics-abc-comparison.md for reproducible comparisons.
Tests cover independent C graph agreement on low/middle/high notes for every
instrument, high notes at A4=430/440/450, periodic pitch, timing, clipping,
overlap/cleanup, cancelled preload, routing, fallback and existing activities.
Native iOS/Android unlock/interruptions, mobile startup memory/time, physical
speaker audibility and musical realism still require device/listener testing.
