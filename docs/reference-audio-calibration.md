# Approved per-recording reference pitch calibration v1

Base: `75f8e82a05347f57c5b65cd518da3362e9090efd`. All 147 active recordings have an approved fixed playback-window reference frequency: 134 audit approvals and 13 exact human listening approvals. Source audio is unchanged.

`reference-audio-calibration-data.ts` is the versioned runtime mapping, keyed by stable note ID and checked against the exact asset path. It retains both **measured whole-sustain frequency** and **effective playback-window calibration reference frequency**. They are different quantities. The latter is the approved duration-compromise denominator, not a claim that the recording has constant pitch or was recorded at one particular A4.

`calibratedPlaybackRate(id, path, targetSoundingHz)` computes `targetSoundingHz / calibrationReferenceFrequencyHz`. Targets already include selected A4 and written-to-sounding transposition. No additional A4/440 factor is applied. Invalid/missing entries fail explicitly; runtime does not guess a substitute. Source hashes are verified by regression tests and the standalone verifier, not recomputed on every exercise beat.

SoundsService uses that helper for normal reference playback, gain-only Web Audio fallback, and expressive preload/playback. Preload filter pivots use the theoretical sounding target at the selected A4, independently of the source reference denominator. Prepared gains are guarded by A4 and a calibration identity containing policy version, source hash, path and reference frequency. Existing generation cancellation, private voice cleanup and envelopes are retained. Profile C gain/EQ parameters, detection, exercise timing and selection remain unchanged.

## HTML Audio backend

Reference playback fails **before starting audio** if the individual Howl is not using Web Audio. Howler 2.2.4's `_webAudio` flag is checked per instance; global `Howler.usingWebAudio` alone cannot identify a particular Howl's HTML fallback after a load failure. HTML media can preserve pitch while changing playbackRate, so this backend is deliberately unsupported for calibrated references. The explicit error flows through existing activity failure/reference-unavailable handling. Metronome playback is unaffected. This does not disable the gain-only fallback when Web Audio is available but soft processing failed. Recheck this adapter when upgrading Howler.

## Provenance and approvals

`reference-calibration/audited-manifest.json` preserves the source audit verbatim (including its historical 13 holds); `listening-approvals.json` is the user's export approving exactly those 13 recommendations. Its manifest SHA256, note IDs, paths, source hashes and frequencies must agree exactly. `approved-manifest.json` merges those approvals explicitly: all 147 entries resolved, zero holds. No numerical substitutions were made. Documentation and listening artifacts are outside the production asset bundle.

## Validation / reproduction

- `node scripts/verify-reference-calibration.cjs`: all 147 definitions, source hashes, manifest recommendations, approvals, 207 enharmonic/display tokens and 588 tuning cases at 430/440/442/450 Hz.
- `npm run test:ci`: complete browser suite, including calibration coverage/hashes, shared rates, stale-cache rejection, HTML failure, decode/cancellation fallbacks, timing and real-recording Profile C compensation.
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` and `-p tsconfig.spec.json`.
- `npm run build -- --configuration production`.
- `npm run test:ci -- --karma-config=scripts/reference-calibration.karma.cjs`: optional capture of real rendered audio to the system temporary directory under `reference-calibration-renders` (override with REFERENCE_RENDER_DIR).
- `python3 scripts/measure-reference-calibration.py [capture-directory]`: independent spectral harmonic-family / phase-advance measurement. Requires existing NumPy/SciPy and ffmpeg; these are analysis tools, not app dependencies. No installations performed.

The capture covers 13 representative source notes (four instruments, low/middle/high registers plus clarinet A6), each at four tunings: 52 renders, f/mf/p, one/four seconds. Soft renders use the actual ExpressiveDynamicsPlayer and preload gain calibration; f renders use the same dry buffer-source/rate/envelope primitives as Howler Web Audio. These dry renders are **not** an end-to-end live Howler capture; service routing/backend rates are tested separately. Captured PCM remains outside the repo. Measurement CSV and PCM outputs are retained outside the repository; neither is committed.

Independent source/output comparison found maximum pitch-shift transfer discrepancy 0.56 cents; maximum residual relative to theoretical target was 4.24 cents in this sample. Nonzero residuals are expected because a fixed compromise preserves natural instantaneous pitch variation and drift. These measurements do not guarantee every moment or all 147 recordings at every tempo are exactly theoretical. Broad duration predictions remain documented in the audited manifest.

Physical iOS/Android testing remains necessary for audio unlock, real Howler playback, routing, interruptions/suspension, device resampling, and the explicit unsupported-backend error. No real microphone validation or human listening beyond the supplied approvals is claimed.

## Final check results

133 browser tests passed, application/spec TypeScript checks passed, and the production build passed (existing pitchlite CommonJS optimization warning). Asset/approval and dynamics comparison checks passed. The optional legacy activity-boundary script reports its PLP frozen-file mismatch against hardcoded commit `45daf1c`. The PLP controller is byte-identical to the requested base `75f8e82`; this inherited historical mismatch was not changed or hidden. Its other boundary checks pass.
