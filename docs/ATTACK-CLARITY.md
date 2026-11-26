# Attack tab (attack clarity)

The **Attack** tab listens to the microphone and, for every note played,
shows how long the tone takes to emerge from the noise of the attack (breath,
tongue, bow), in milliseconds. It also keeps a list of all the attacks heard
since listening started. Values are shown as they are: there are no
thresholds, no colours meaning good or bad, and no score.

## What is measured

The measure is the **noise ducking time** `t_nd` from G. Evangelista and
A. Acquilino:

- "A Wavelet-Based Method for the Estimation of Clarity of Attack Parameters
  in Non-Percussive Instruments", *Proc. DAFx25*, Ancona, 2025, pp. 110–117.
- "Estimation of Transient Characteristics in Nonpercussive Acoustic
  Instruments", *J. Audio Eng. Soc.*, vol. 74, no. 10, pp. 750–761, 2026.

The sound is split, period by period, into a harmonic part and a noisy part
with a pitch-synchronous wavelet transform. `t_nd` is the time from the note
onset until the harmonic part rises clear of the noise. The other descriptor
of the papers, the attack duration `t_dur`, is only available in the offline
(nominal) analysis and is not used here.

The analysis comes from the Rust crate **attack-clarity-rs**, in its
*streaming* version, compiled to WebAssembly. That version handles continuous
playing: it detects notes by itself (rise out of silence, deep valley or
pitch jump for slurs) and costs about 1% of real time.

## Pieces

| File | Role |
|---|---|
| `src/assets/attack-clarity/attack_clarity_wasm.js`, `attack_clarity_wasm_bg.wasm` | wasm-bindgen package (`--target web`), copied from attack-clarity-rs |
| `src/app/services/attack-clarity.service.ts` | `AttackClarityService`: microphone, AudioWorklet, wasm analyzer, observables |
| `src/app/activities/attack-clarity/attack-tracker.ts` | `AttackTracker`: turns analyzer events into a list of attacks (pure, unit tested) |
| `src/app/pages/attack/` | `AttackPage`: the tab UI |
| `src/app/pages/tabs/tabs.page.*`, `src/app/app.routes.ts` | new mode `attack`, route `/home/attack`, entries in the desktop nav, mobile tab bar and Options › Mode |

## Audio path

```
getUserMedia ──► MediaStreamSource ──► audio-accumulator worklet ──► gain 0 ──► destination
                                              │ 128-sample blocks (postMessage)
                                              ▼
                                  AttackClarityService (main thread)
                                   buffers 1024 samples, then
                                   StreamAnalyzer.process(block)  ──► events
                                   StreamAnalyzer.take_envelopes() ──► pitch history
                                              ▼
                                        AttackTracker ──► attacks$ ──► AttackPage
```

- **Raw sound.** The microphone is opened with `echoCancellation`,
  `noiseSuppression` and `autoGainControl` off: the measure is about the
  noise of the attack, which those filters would remove. Unlike the pitch
  service, blocks are not normalised.
- **Own AudioContext.** The service does not use Howler's shared context or
  `PitchService`; it creates its context synchronously in the Start click,
  so that it inherits the user gesture (iOS). `resume()` is not awaited: in
  the absence of a gesture the promise may never settle.
- **Worklet.** It reuses `src/assets/audio-accumulator.js`. The node must be
  created with `outputChannelCount: [2]`, because the worklet copies the
  second input channel to the second output when the input is stereo; with
  one output channel it throws and stops processing silently.
- **Change detection.** Worklet messages (~375/s) are handled outside the
  Angular zone. The zone is entered only when the list changes and for the
  level meter (about 12 updates per second).
- **Pitch range.** 100–3000 Hz, the library default, for every instrument.
  The lower limit sets the worst-case latency.

## Loading the wasm module

The package is served as a static asset and imported at run time:

```ts
import(/* webpackIgnore: true */ new URL('assets/attack-clarity/attack_clarity_wasm.js', document.baseURI).href)
```

then initialised with the URL of `attack_clarity_wasm_bg.wasm`. The
`webpackIgnore` comment keeps webpack from bundling or rewriting the module.
The `**/*.js` and `**/*.wasm` asset globs in `angular.json` already copy both
files to the build output. The module is loaded once and cached.

## Analyzer events

`StreamAnalyzer.process` returns a flat `Float64Array`, five numbers per
event, `[kind, onset, a, b, c]`, times in seconds from the start of the
stream:

| kind | meaning | fields |
|---|---|---|
| 0 | note onset | — |
| 1 | noise ducking time | `a` = `t_nd`, `b` = rule (0 level, 1 peak) |
| 2 | note end | `a` = end, `b` = 1 if the noise was ducked, `c` = seconds analysed |

A value is reported once it has been stable for 100 ms and may be reported
again if later signal changes it; the note end makes it final, or void when
the harmonics never overtook the noise. A value typically arrives about
300 ms after the instant it measures (for notes around 460 Hz); the delay
grows as the pitch drops.

`AttackTracker` maps this onto records with a status:

| status | shown as | when |
|---|---|---|
| `measuring` | "measuring…" | onset seen, no value yet |
| `updating` | value + "refining" | value received, note still going |
| `final` | value | note ended, noise ducked |
| `not-measured` | "not measurable" | note ended, noise never ducked |

Records are matched to events by onset time.

## Note names

The analyzer also returns envelope frames, `[time, input, harmonic, noise,
pitchHz]` at 1 kHz. The tracker keeps the last 6 s and takes the median
pitch over the 150 ms following the end of the attack. The page converts it
to the **written** note of the selected instrument (using the instrument's
`writtenToSoundingSemitones` and the reference A4), spelled with sharps and
in English or Italian names according to the Note Names setting.

## UI

The layout follows Target Intonation: a header with the instrument, a start
panel explaining what is measured, then two panels and a controls bar.

- **Last attack**: the last available value in large type, with note and
  time, the listening status, the input level and a strip of the last 16
  attacks (scale rounded up to 50 ms, at least 100 ms).
- **Recorded attacks**: newest first, with number, note, time, a
  proportional bar and the value.
- **Controls**: Stop, Clear list, Start listening. The list survives Stop;
  Options is disabled while listening. Leaving the tab stops listening and
  releases the microphone.

## Updating the wasm package

In attack-clarity-rs:

```sh
./web/build.sh   # wasm-pack build wasm --release --target web --out-dir ../web/pkg
```

then copy `web/pkg/attack_clarity_wasm.js` and
`web/pkg/attack_clarity_wasm_bg.wasm` into `src/assets/attack-clarity/`. The
current copy was built from commit `a86e8ac`. If the bindings change, update
the `StreamAnalyzerHandle` / `AttackClarityModule` interfaces in the service
and the event layout in the tracker.

## Verification so far

- Unit tests for `AttackTracker` (`attack-tracker.spec.ts`).
- The bundled wasm, fed the 76 s trumpet recording of attack-clarity-rs in
  1024-sample blocks through `AttackTracker`, finds the 27 notes listed in
  that repository's README.
- In Chrome, with `getUserMedia` replaced by a stream of the same recording,
  the page detects the same notes at the same times (within 0.1 s) as the
  offline run, but the values differ by up to about 15 ms (for example
  10 ms offline against 24 ms in the browser on one note). The cause has not
  been checked; likely candidates are the resampling in `decodeAudioData` and
  the routing of the stream through a second AudioContext in that test setup.
- Not yet tried with a real microphone, nor on iOS or Android.

## Licence

attack-clarity-rs has no licence yet ("all rights reserved by the authors"
in its README). Check with the authors before distributing builds that
include the wasm package.
