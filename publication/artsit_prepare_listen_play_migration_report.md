# ArtsIT prepare–listen–play migration report

This report records the first publication-oriented implementation slice on
`research/artsit-extensible-activities`. It covers the typed musical domain,
the bounded shared lifecycle, and the migration of the existing
prepare–listen–play (PLP) activity. It does not claim that the repository is a
framework or toolkit, and it does not claim that target intonation has been
implemented.

## 1. Structural decisions made

The implementation follows the selected Design B:

- `LearningActivityController` defines the small shared lifecycle boundary.
- `ActivitySessionService` permits one active controller and owns the session
  cancellation boundary.
- `ActivityContext` supplies explicit clock, audio, pitch-input, notation,
  instrument-registry, and persistence capabilities.
- `PrepareListenPlayController` owns PLP-specific state and transitions.
- Typed instrument definitions own written-to-sounding conversion inputs and
  exact note assets.
- `HomePage` composes dependencies and renders controller snapshots; it does
  not calculate phase transitions.

No generic activity engine, state-machine DSL, plug-in system, external
instrument schema, toolkit package, or full target-intonation activity was
introduced. The post-migration code comparison point is commit `45daf1c`.

## 2. Files changed

The typed domain was added in:

- `src/app/core/music/pitch-math.ts`
- `src/app/instruments/instrument-definition.ts`
- `src/app/instruments/instrument-registry.service.ts`
- `src/app/instruments/definitions/create-instrument-definition.ts`
- `src/app/instruments/definitions/trumpet-bb.instrument.ts`
- `src/app/instruments/definitions/clarinet-bb.instrument.ts`
- `src/app/instruments/definitions/oboe-c.instrument.ts`

The lifecycle, controller, and adapters were added in:

- `src/app/core/activity/activity.types.ts`
- `src/app/core/activity/activity-controller.ts`
- `src/app/core/activity/activity-context.ts`
- `src/app/core/activity/activity-session.service.ts`
- `src/app/activities/prepare-listen-play/prepare-listen-play.types.ts`
- `src/app/activities/prepare-listen-play/prepare-listen-play.controller.ts`
- `src/app/adapters/clock/rxjs-clock.adapter.ts`
- `src/app/adapters/notation/score-notation.adapter.ts`
- `src/app/adapters/persistence/firebase-activity.adapter.ts`

Existing production consumers were changed in:

- `src/app/pages/home/home.page.ts`
- `src/app/pages/home/home.page.html`
- `src/app/services/beat.service.ts`
- `src/app/services/sounds.service.ts`
- `src/app/services/pitch.service.ts`
- `src/app/components/chromatic-tuner/chromatic-tuner.component.ts`
- `src/app/components/chromatic-tuner/chromatic-tuner.component.html`
- `src/app/components/score/score.component.ts`
- `src/app/app.component.ts`
- `src/app/pages/tabs/tabs.page.ts`
- `src/global.scss`
- `android/gradle.properties`

Tests were added or updated in:

- `src/app/core/music/pitch-math.spec.ts`
- `src/app/instruments/instrument-registry.service.spec.ts`
- `src/app/core/activity/activity-session.service.spec.ts`
- `src/app/activities/prepare-listen-play/prepare-listen-play.controller.spec.ts`
- `src/app/pages/home/home.page.spec.ts`
- `src/app/services/beat.service.spec.ts`
- `src/app/services/sounds.service.spec.ts`
- `src/app/services/pitch.service.spec.ts`
- `src/app/components/chromatic-tuner/chromatic-tuner.component.spec.ts`
- `src/app/components/score/score.component.spec.ts`

The pre-existing changes to
`ios/App/App.xcodeproj/project.pbxproj`, store screenshots, and the two
untracked planning documents were not staged or modified.

## 3. Terminal-semantics correction

The learner-facing default remains 12 cycles through `MAXCYCLES`. Each
controller cycle contains:

1. `preparing` / visible `Rest`, beats 0–3;
2. `listening` / visible `Listen`, beats 0–3;
3. `playing` / visible `Play`, beats 0–3.

The resulting default trace contains exactly 144 running ticks
(`12 cycles × 3 phases × 4 beats`), 144 metronome commands, and 12 reference
tone commands. Completion follows cycle 12, Play beat 3. There is no stopped
sentinel tick and no duplicate playing tick at the terminal position.

The controller guards terminal entry, cancels the clock once, stops audio once,
releases pitch input once, closes persistence once, emits one terminal
snapshot, and resolves one result. Manual stop produces `cancelled` with
`learner-stop`; it does not emit `completed`. A manual stop also retains
already-collected chromatic means from the partial cycle.

## 4. Pitch-domain model

The model distinguishes:

- `SpelledPitch` for written, sounding, and displayed spellings;
- instrument transposition in written-to-sounding semitones;
- typed `InstrumentNoteDefinition` and stable instrument-qualified note IDs;
- selected reference A4;
- `NoteTarget.expectedSoundingFrequencyHz`;
- the exact recorded reference-tone asset and its recorded A4 assumption;
- valves or an exact fingering-image asset.

`createNoteTarget` is the single owner of target-frequency conversion:

`expected Hz = selected A4 × 2^((sounding MIDI - 69) / 12)`.

B-flat trumpet and B-flat clarinet use `-2` semitones; C oboe uses `0`.
Tests cover A4 values 430, 440, and 450 Hz. Reference playback applies the
ratio `selected A4 / recorded A4` to the checked-in recording. The 110 typed
notes preserve the existing visible order and spellings. An asset audit
resolved all 189 declared audio and fingering paths, including the historical
oboe `G62.m4a` filename.

Silent and non-finite audio frames now produce finite zero buffers and explicit
`unvoiced` estimates with `silence` or `invalid` reasons. They do not enter the
WASM detector as `NaN`.

## 5. Resource ownership model

| Resource | Owner while active | Acquisition/use | Exactly-once release |
|---|---|---|---|
| Timer | `PrepareListenPlayController` | `ClockPort.every` after resources and persistence are ready | stored cancel handle |
| Microphone/detector | controller through `PitchInputPort` | one `acquire` when pitch display is enabled | one idempotent pitch-session `release` |
| Pitch subscription | controller | subscribes only after pitch acquisition | unsubscribed at every terminal |
| Reference tone | controller through `AudioPort` | explicit command on Listen beat 0 | bounded playback plus terminal `stopAll` |
| Metronome | controller through `AudioPort` | one explicit command per running tick | terminal `stopAll`; no hidden subscription |
| Persistence session | controller through bounded adapter | one `open` before the clock starts | guarded one `close` after resources stop |
| Controller/session observer | `ActivitySessionService` | one subscription for the active controller | released at terminal/cancel/supersession |
| View observers | `HomePage` | reference frequency, snapshot rendering, mute check | one composite unsubscribe on destroy |

`AppComponent`, `TabsPage`, `HomePage`, and the chromatic tuner do not call
microphone connect/disconnect methods. `HomePage` supplies the pitch port to
the controller as composition, while the controller owns acquisition and
release.

## 6. Prepare–listen–play controller design

`PrepareListenPlayController` is an activity-specific, DOM-free TypeScript
controller. Its typed states carry phase, cycle, beat, target, score, optional
dynamic, fingering through the target, and non-gating pitch feedback.

Startup validates the instrument, range, accidental-filter result, A4, tempo,
and four-beat contract before acquiring resources. It then unlocks and
preloads audio, optionally acquires pitch input, opens persistence, and starts
the clock in that order. Random material is selected only from the validated
typed range. Display spelling may vary among the existing available
spellings, while target evaluation always uses the typed sounding frequency.

The legacy chromatic display behavior remains non-gating: groups of four
estimates are reduced using the existing 2 Hz bucket rule and stored for
persistence. The regular instrument display is now target-relative and uses
the selected A4 and instrument transposition. Neither pitch-display mode can
delay the fixed activity sequence.

## 7. Migration from HomePage and BeatService

Phase orchestration, cycle counting, tick advancement, target selection,
reference playback, pitch collection, terminal detection, and persistence
close moved out of `HomePage`. The page now:

- translates stored UI settings into a typed PLP configuration;
- supplies an `ActivityContext`;
- delegates start/stop/navigation cancellation to `ActivitySessionService`;
- maps typed controller snapshots to existing labels, score, fingering, and
  pitch presentation.

`BeatService` is now only a validated tempo-settings boundary. It no longer
owns a timer, measure, phase, cycle, or terminal state. `SoundsService` no
longer injects or subscribes to `BeatService`; it implements explicit audio
commands.

The tuner is now a pure presentation component receiving pitch as input. Score
and tuner rendering use instance-local `ViewChild` surfaces rather than global
IDs, and their subscriptions/listeners are removed on destruction. App and
tab startup no longer pre-acquire microphone access. These changes correct
the baseline resource leaks without redesigning the learner interface.

## 8. Tests added or updated

The web suite now contains 48 passing tests:

| Area | Tests | Main evidence |
|---|---:|---|
| PLP controller | 9 | 144-state trace, one completion/close, cancellation, restart, audio, target range, sounding feedback, chromatic persistence, invalid config |
| Typed instruments | 7 | parity, validation, duplicate/missing/range failures, transposition, 430/440/450, unsupported targets, exact historical asset |
| Pitch math | 4 | spelling/MIDI/frequency/cents conversion |
| Session boundary | 1 | exactly one active controller and supersession |
| Home host | 5 | composition, snapshot rendering, delegated stop/navigation, terminal behavior, cleanup |
| Beat settings | 3 | tempo validation and absence of activity timing state |
| Pitch service | 4 | minimum, normalization, silence, invalid input |
| Sounds service | 2 | no hidden playback and selected-A4 playback rate |
| Tuner presentation | 6 | display mapping, silence, exact tune, local surface, listener cleanup |
| Score presentation | 2 | independent surfaces and subscription cleanup |
| Existing app/score utilities | 5 | retained shell and notation characterization |

Deterministic fakes supply clock, pitch, audio, and persistence events. The
controller test asserts 144 metronome calls, 12 reference calls, one
persistence close, one clock cancel, one microphone release, and one
completion. A separate cancellation test repeats stop to prove idempotence.
The repaired Karma configuration continues to return nonzero for genuine
failures, as established in the baseline task.

## 9. Web, Android, and iOS verification

Verification was performed from the migrated source on 28 July 2026 in
Toronto:

| Check | Result | Evidence/qualification |
|---|---|---|
| `npm ci` | pass | 1,775 packages installed; lockfiles unchanged |
| `npm run lint` | pass | all files pass |
| `npm run test:ci` | pass | `TOTAL: 48 SUCCESS` in Chrome Headless 150 |
| `npm run build` | pass | production web bundle generated; 29 existing CSS selector-processing warnings |
| Instrument asset audit | pass | 3 instruments, 110 notes, 189 exact paths present |
| `npx cap sync android` | pass | isolated copy; 8 plugins |
| Android `assembleDebug` | pass | Gradle 8.5, PATH-provided OpenJDK 17.0.18; 292 tasks |
| Android `testDebugUnitTest` | pass | one generated Java test; not activity evidence |
| `npx cap sync ios` | pass | isolated copy; CocoaPods and 8 plugins |
| iOS simulator compile | pass | unsigned Debug build, generic iOS Simulator, Xcode 26.6 |

The committed Windows-only `org.gradle.java.home` was removed and no
machine-specific replacement was added. Native synchronization/builds ran in
`/private/tmp/mei-artsit-native.oEKGY7`, preserving the working Android/iOS
projects and the owner's iOS version change.

No app was installed or launched on a simulator/device. No microphone,
detector accuracy, audible reference tone, metronome timing, or complete
learner flow was validated on physical hardware; none is claimed here.

## 10. Remaining blockers for target intonation

The repository is structurally ready to begin `TargetIntonationController`,
but the following work remains:

- implement a pure target-relative evaluator with wrong-note, silence,
  out-of-range, flat/sharp, tolerance, spread, signal-gap, and stability rules;
- define typed attempt/timeout/retry/skip/progression states and results;
- prove success requires both minimum valid estimates and consecutive stable
  duration;
- add the second activity view/route and preserve one-session cancellation
  during activity switching;
- decide and document parameter defaults without presenting them as universal
  pedagogical thresholds;
- measure or spot-check the declared reference recordings; their current
  status is `declared-unmeasured`;
- run controlled detector accuracy/latency/timing tests and physical
  microphone/audio flows;
- replace or supplement the generated Android example test, whose package does
  not match the application and provides no activity evidence;
- exercise persistence with an emulator or controlled backend failure.

Repository-wide concerns remain outside this slice: Node 23 is not an Angular
15 reference LTS environment; Capacitor CLI/core major versions are
misaligned; `npm ci` reports 102 dependency vulnerabilities; the Android
Gradle plug-in warns about compile SDK 35; and the web build retains CSS and
bundle-size warnings. These do not block implementing the pure target
controller, but they constrain release/security/platform claims.

## 11. Evidence already usable in the ArtsIT paper

The implementation now supports the following bounded technical evidence:

- a concrete Design B API consisting of a small shared lifecycle/context and
  one activity-specific controller;
- an exhaustive, deterministic PLP transition trace with corrected terminal
  semantics;
- explicit exactly-once resource and persistence behavior under completion,
  cancellation, restart, and supersession tests;
- a typed three-instrument catalog with 110 ordered notes, written/sounding
  separation, transposition, A4 propagation, fingering, and exact assets;
- an instance-local presentation boundary and removal of hidden
  Beat-to-Sounds and view-to-microphone ownership;
- one source implementation that compiles for web, Android, and iOS after the
  migration.

This evidence supports describing the current result as the first
instantiation of an extensible application architecture. It does not yet
demonstrate generalization across two meaningfully different activities. A
regular-paper claim should therefore wait for target intonation, frozen-core
change-surface analysis, controlled pitch/timing evidence, and representative
device runs.

## 12. Exact next Codex task

> Continue on `research/artsit-extensible-activities` from the PLP comparison
> point `45daf1c` and its migration-report commit. Implement the second
> publication vertical slice without changing PLP terminal semantics or
> introducing a generic engine, DSL, toolkit, third activity, dependency
> upgrade, or manuscript rewrite. Add typed `TargetIntonationConfig`,
> `IntonationFeedback`, attempt/result types, a pure target-relative
> `IntonationEvaluator`, and `TargetIntonationController` reusing the existing
> `LearningActivityController`, `ActivityContext`, `ActivitySessionService`,
> pitch port, audio port, persistence port, notation port, and typed instrument
> registry. Define and deterministically test explicit-target presentation,
> wrong-note rejection, silence/invalid/out-of-range handling, flat/sharp and
> within-tolerance feedback, minimum valid estimates, consecutive stability,
> maximum spread, signal-gap reset, attempt timeout, retry, skip/next,
> multi-target progression, cancellation, restart, failure, and exactly-once
> resource release/persistence close. Convert the existing tuner presentation
> into the activity-specific view without giving it microphone ownership, add
> the minimum route/selection composition needed to launch either activity,
> and classify every change made outside the new target-intonation module
> against the frozen PLP comparison point. Run the full web, isolated Android,
> and isolated iOS verification matrix; do not claim physical microphone or
> audible validation unless actually performed. Preserve the owner's pending
> iOS version and screenshot changes, use small logical commits, and do not
> push or open a PR.
