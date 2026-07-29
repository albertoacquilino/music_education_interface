# ArtsIT target-intonation implementation report

This report records the second publication-oriented vertical slice on
`research/artsit-extensible-activities`. It compares the implementation with
the post-PLP point `45daf1c` and reports verification completed on 29 July
2026 in Toronto.

The result is a second, materially different activity implemented through the
same bounded lifecycle and capability ports:

- prepare–listen–play (PLP) remains clock-driven and fixed-cycle;
- target intonation is driven by pitch events, stability evidence, an attempt
  deadline, and learner commands.

The repository now supports a defensible claim that the architecture has been
instantiated by two contrasting activities. It does not yet support calling
the repository a toolkit or framework, and it does not provide measured
acoustic, detector-accuracy, or real-time performance evidence.

## 1. Implementation summary

The new vertical slice consists of:

- typed target-intonation configuration, state, feedback, command, attempt,
  and terminal result definitions;
- a pure target-relative `IntonationEvaluator`;
- a DOM-free `TargetIntonationController`;
- an activity-specific target-intonation page at `/home/intonation`;
- explicit PLP and Intonation activity selectors;
- bounded typed persistence for aggregate attempt results;
- deterministic evaluator, controller, persistence, host, route, and
  presenter tests;
- automated frozen-core and change-surface evidence.

The implementation deliberately does not add a generic state-machine engine,
declarative activity language, plug-in system, external instrument schema, or
package-level toolkit API.

The main activity-specific production files are:

- `src/app/activities/target-intonation/target-intonation.types.ts`;
- `src/app/activities/target-intonation/intonation-evaluator.ts`;
- `src/app/activities/target-intonation/target-intonation.controller.ts`;
- `src/app/pages/target-intonation/target-intonation.page.ts`;
- `src/app/pages/target-intonation/target-intonation.page.html`;
- `src/app/pages/target-intonation/target-intonation.page.scss`.

The evaluator, controller, UI integration, and boundary evidence were
committed separately. The PLP controller source is byte-for-byte identical to
its source at `45daf1c`.

## 2. State model

The activity-specific running states are:

| State | Entry | Events that can change it |
|---|---|---|
| `presenting-target` | a target is selected or an attempt is retried | presentation timer, skip, stop, cancellation, resource failure |
| `awaiting-signal` | presentation ends and an attempt begins | no-signal/voiced pitch event, attempt timeout, skip, stop, cancellation, resource failure |
| `tracking` | a non-silence pitch estimate is evaluated | further pitch events, stable-hold success, attempt timeout, skip, stop, cancellation, resource failure |
| `attempt-result` | stable hold, timeout, or skip ends an attempt | retry, next target, skip target, stop, cancellation |

`completed`, `cancelled`, and `failed` remain terminal states of the shared
activity lifecycle/result envelope rather than being duplicated inside the
activity-specific state union.

The normal success trace is:

`presenting-target → awaiting-signal → tracking → attempt-result → next target`

The final `next-target` command after the configured number of processed
targets enters shared lifecycle `completed`. A successful attempt permits
`next-target`. A timed-out attempt permits `retry-attempt` while
`attemptIndex < maximumAttemptsPerTarget`, and permits `skip-target`.
`maximumAttemptsPerTarget` therefore bounds retries without silently treating
a timeout as success. `stop` produces `cancelled` with `learner-stop`.

Target selection reuses the typed instrument range and accidental policy.
Written notation and displayed spelling come from the target. Evaluation is
always against that target's expected sounding frequency.

The activity can restart after a terminal result. `ActivitySessionService`
still permits one controller at a time; launching another activity cancels the
active one as `superseded` before the new controller starts.

## 3. Evaluator semantics

`IntonationEvaluator` is deterministic TypeScript with no Angular, Ionic, DOM,
WebAudio, Firebase, Capacitor, or wall-clock dependency. Its only time inputs
are the attempt start and the timestamps carried by deterministic pitch
samples.

For voiced frequency \(f\) and the explicit target sounding frequency
\(f_t\), target-relative error is:

`cents = 1200 × log2(f / f_t)`

The target frequency already incorporates:

- the typed instrument's written-to-sounding transposition;
- the target's sounding MIDI identity;
- the selected reference A4.

The evaluator bands are:

| Band | Semantics under the default configuration |
|---|---|
| `no-signal` | detector explicitly reports silence |
| `invalid-estimate` | invalid detector result, non-finite/non-positive frequency, or invalid timestamp ordering |
| `out-of-detector-range` | detector reports range failure or voiced frequency is outside the configured detector range |
| `wrong-note` | estimate is at least 50 cents from the explicit target; exact half-semitone boundaries are conservatively rejected |
| `far-flat` | correct target identity and error at or below −30 cents |
| `flat` | correct target identity, below −10 cents, and above −30 cents |
| `within-tolerance` | correct target identity and error from −10 through +10 cents, inclusive |
| `sharp` | correct target identity, above +10 cents and below +30 cents |
| `far-sharp` | correct target identity and error at or above +30 cents |
| `unstable` | in-window samples exceed the configured stability-window spread |

This explicit-target rule prevents the learner from receiving an in-tune
result merely because a different chromatic note is internally well tuned.
At ±50 cents there is no unique nearest chromatic identity, so the evaluator
rejects the estimate rather than resolving the tie in the learner's favor.

Stability requires both:

1. at least `minimumValidEstimates` in the current stability window; and
2. elapsed time from the first through last window sample of at least
   `requiredStableMs`.

Silence, an invalid/range estimate, a wrong note, or an out-of-tolerance pitch
clears the stability window. A captured-time gap greater than
`maximumSignalGapMs` clears the previous window before the current sample is
considered. Excessive spread replaces the window with the current sample so
recovery requires a new full hold. Equal-to-threshold values are handled
explicitly: tolerance endpoints pass, far-band endpoints enter the far bands,
the required stable duration passes when the estimate-count condition is also
met, the maximum spread passes, and only a signal gap greater than the
configured maximum resets.

Timestamps must be finite, captured no earlier than the attempt start,
emitted no earlier than captured, and strictly increasing by captured time.
Invalid timestamp input cannot advance stability.

The evaluator retains bounded aggregate inputs for attempt metrics, not audio
or per-frame production telemetry. It reports time to first valid
correct-identity estimate, time to stable hold, valid-estimate count,
wrong-note count, median cents, 95th-percentile absolute error, and total
valid-estimate spread.

## 4. Parameter defaults and rationale

| Parameter | Default | Implementation rationale and sensitivity |
|---|---:|---|
| target count | 3 | exercises multi-target progression while keeping a default session bounded; changes session duration and evidence volume |
| reference playback | enabled | gives an optional target model; a playback failure is visible but non-fatal |
| target presentation | 1,000 ms | separates explicit presentation from pitch acquisition; shorter values begin listening sooner |
| reference duration | 1,000 ms | bounds owned playback; changes exposure, not pitch acceptance |
| tolerance | ±10 cents | creates a narrow initial target window; narrower values increase rejection and wider values reduce precision |
| far threshold | ±30 cents | provides graded directional feedback inside the correct-note region |
| required stable hold | 1,500 ms | requires sustained evidence rather than one frame; longer values increase task difficulty and timeout sensitivity |
| maximum window spread | 12 cents | rejects a dispersed in-window sequence; lower values demand steadier production |
| minimum valid estimates | 4 | prevents two widely spaced samples from satisfying duration alone; should be evaluated against detector cadence |
| maximum signal gap | 350 ms | prevents disconnected samples from composing one hold; must be assessed against real device scheduling |
| attempt timeout | 10,000 ms | bounds an attempt and enables retry/skip policy |
| maximum attempts | 3 | bounds retry loops while retaining learner choice |
| detector range | 140–2,000 Hz | explicit implementation guard for the current target ranges and detector use |

These values are configurable and persisted with the activity. They are
engineering defaults for implementation and controlled testing, not validated
learning thresholds, clinical thresholds, or universal definitions of
intonation. The sensitivity of completion rate, time to completion, reset
frequency, and perceived difficulty to these parameters remains an empirical
evaluation requirement.

## 5. Resource ownership

`TargetIntonationController` owns all activity resources through the shared
ports:

| Resource | Acquisition/use | Exactly-once release mechanism |
|---|---|---|
| microphone/pitch session | `PitchInputPort.acquire` during startup | guarded `PitchInputSession.release` |
| pitch subscription | subscribed after acquisition | unsubscribe and clear reference during terminal release |
| presentation timer | `ClockPort.after` for target presentation | stored cancel handle, cancelled on replacement or terminal release |
| attempt timeout timer | `ClockPort.after` for the attempt deadline | stored cancel handle, cancelled on attempt end or terminal release |
| reference playback | optional `AudioPort.playReference` | playback handle `stop`, then terminal `stopAll` |
| persistence session | one `ActivityPersistencePort.open` | guarded one `close` after owned resources stop |
| abort listener | one listener per controller session | removed during terminal release |

One guarded terminal path covers completion, learner stop, navigation
cancellation, supersession, startup failure after partial acquisition, and
runtime failure. Repeated cancellation returns the same settled result.
Terminal resource cleanup is idempotent. Reference-tone unlock, preload, or
playback failure is non-fatal because playback is optional; microphone/pitch
failure is terminal because pitch input is essential.

The page and chromatic tuner never call microphone connect, disconnect,
acquire, or release methods. They render snapshots and dispatch commands.

## 6. Typed results and persistence

`TargetIntonationResult` extends the existing activity result envelope and
contains:

- activity ID `target-intonation` and version `1.0.0`;
- session ID and start/end timestamps;
- terminal outcome, cancellation reason, or failure;
- the complete typed configuration, including instrument, A4, thresholds, and
  policy;
- planned, completed, and successful target counts;
- bounded typed attempt results.

Each attempt contains, where available:

- stable typed target identity, written and sounding spellings, expected
  sounding frequency, and selected A4;
- target number and attempt index;
- outcome: `stable-hold`, `timeout`, `skipped`, or `cancelled`;
- attempt start/end timestamps;
- time to first valid estimate and time to stable hold;
- valid-estimate and wrong-note counts;
- median cents, 95th-percentile absolute error, and spread.

`FirebaseActivityAdapter` dispatches activity-specific DTO conversion only at
the infrastructure boundary. PLP retains its existing persistence path and
shape. The shared lifecycle core does not import either activity module.
Deterministic controller tests use fake/no-op persistence.

No raw microphone audio is stored. Normal target-intonation telemetry does not
store a full per-frame pitch trace.

## 7. UI and routing integration

The routes are independent:

- `/home/exercise` launches PLP;
- `/home/intonation` launches target intonation.

The tabs expose PLP and Intonation as separate activity selections. A switch
first asks `ActivitySessionService` to cancel the active controller with
`superseded`, then navigates. Re-selecting the current activity does neither.

The target-intonation view displays:

- written target notation and note name;
- detected frequency or a no-signal state;
- cents relative to the explicit target;
- flat, sharp, within-window, wrong-note, unstable, invalid, and range
  feedback;
- stability progress;
- target and attempt counters;
- retry, next, skip, and stop controls only where permitted.

The existing tuner gauge is reused as a pure presenter with an
explicit-target input mode. A `wrong-note` input cannot render its success
presentation. Tuner and score components keep instance-local DOM surfaces, so
PLP and target intonation do not share global element IDs or presentation
state. The integration intentionally avoids a broader visual redesign.

PLP now explicitly selects its target-feedback presentation mode. This is a
host configuration correction, not a PLP state-machine or terminal-semantics
change.

## 8. Tests and deterministic evidence

The web suite contains 98 passing tests, an increase of 50 over the post-PLP
suite.

| Area | Tests attributable to this slice | Main evidence |
|---|---:|---|
| pure evaluator | 20 | target frequency; tolerance/far/identity boundaries; wrong note; transposition; A4 430/440/450; silence; invalid/range input; count/duration/spread/gap rules; recovery; timestamps; aggregate metrics |
| controller | 16 | stable success; silent/unstable timeout; retry; skip; next; multi-target completion; attempt limit; cancellation; restart; supersession; acquisition/runtime failure; optional playback failure; wrong-note rejection; invalid configuration |
| persistence adapter | 3 | PLP shape retained; bounded target result; session mismatch rejection |
| activity page | 4 | controller launch without resource ownership; snapshot mapping; command dispatch; navigation cleanup |
| activity tabs | 4 | selection; exactly-once supersession; same-route no-op; independent routes |
| route definition | 1 | independent lazy launches |
| tuner additions | 2 | explicit-target wrong-note behavior; no global tuner ID |

Existing PLP, pitch-domain, service, page, score, tuner, and lifecycle tests
remain in the same 98-test run. Fakes inject all pitch values and timestamps.
No evaluator/controller test requires Angular, a browser DOM, Firebase,
WebAudio, Capacitor, or wall-clock waiting.

`scripts/check-activity-boundaries.mjs` also verifies:

- the current PLP controller SHA-256 equals the version at `45daf1c`;
- the evaluator and controller contain none of the forbidden UI/platform
  dependencies;
- shared core files import no activity module;
- both independent activity routes exist.

## 9. PLP regression status

All 98 tests pass, including the existing PLP terminal trace and resource
assertions. The PLP controller logic has not changed:

| Evidence | Value |
|---|---|
| comparison point | `45daf1c` |
| PLP controller SHA-256 at comparison point | `8fcdbe101780b7d6f8239b2216f74948d06281516919678fe64ac65b93a567b9` |
| current PLP controller SHA-256 | `8fcdbe101780b7d6f8239b2216f74948d06281516919678fe64ac65b93a567b9` |
| PLP production controller lines changed | 0 |
| PLP terminal semantics changed | no |
| PLP pitch-domain semantics changed | no |

The PLP controller specification was changed only so its fake context
implements the two narrow shared port additions. PLP production persistence
continues through the legacy adapter path and is covered by a regression test.

## 10. Frozen-core/change-surface analysis

Machine-readable evidence is in:

- `publication/artsit_target_intonation_change_surface.csv`;
- `publication/artsit_target_intonation_change_surface.json`.

Production change surface from `45daf1c` through the completed integration
commit is:

| Category | Files | Added | Deleted |
|---|---:|---:|---:|
| new target-intonation module | 3 | 1,297 | 0 |
| shared contract extension | 1 | 6 | 0 |
| shared adapter reuse | 6 | 320 | 21 |
| PLP modification | 0 | 0 | 0 |
| host/routing/presentation integration | 8 | 864 | 30 |
| unrelated correction | 0 | 0 | 0 |
| **production total** | **18** | **2,487** | **51** |

The production total comprises six added files and twelve modified files.
Tests comprise six added files, two modified files, 1,399 added lines, and one
deleted line. Seven shared production files were touched.

The shared contract extension is six lines: a one-shot clock capability and
single-target notation capability. The remaining shared-file changes
implement or reuse those ports, typed bounded persistence, and existing score
construction. There are no activity-specific branches in shared lifecycle
core. Activity-specific result dispatch exists at the Firebase infrastructure
adapter boundary and is reported as such.

This is the relevant extensibility result: the second activity required its
own substantial controller/evaluator/presentation code, but only two narrow
shared capability extensions and no PLP controller change. It is not evidence
that arbitrary activities can be added without integration work.

## 11. Web, Android, and iOS verification

Verification ran from committed source in an isolated native copy at
`/private/tmp/mei-artsit-target.8C0mc9`. The copy was made from Git rather than
from the dirty working tree, so the owner's iOS version change, store
screenshots, and untracked planning documents were not copied or modified.

| Check | Result | Evidence/qualification |
|---|---|---|
| `npm ci` | pass | explicit Node 22 clean install; 1,775 packages added and 1,776 audited |
| `npm run lint` | pass | no lint errors |
| `npm run test:ci` | pass | `TOTAL: 98 SUCCESS` |
| `npm run build` | pass | production web bundle and separate target-intonation lazy chunk generated |
| typed instrument/asset audit | pass | 3 instruments, 110 notes, 189 exact asset paths, 0 missing paths, 0 definition issues |
| isolated Android sync | pass | Capacitor copied web bundle and synchronized 8 plugins |
| Android Java 17 debug build | pass | Gradle 8.5/OpenJDK 17.0.18; 292 tasks; debug APK generated |
| Android unit-test task | pass | 160 tasks; one generated native Java test, not activity-behavior evidence |
| Android emulator launch | unavailable | `adb devices` reported no connected device |
| isolated iOS sync | pass | CocoaPods and 8 Capacitor plugins synchronized |
| unsigned iOS simulator compile | pass | Xcode 26.6, generic iOS Simulator destination, signing disabled |
| iOS simulator install/launch | pass | installed and launched on iPhone 17 Pro / iOS 26.5 |
| iOS route rendering | pass | PLP and target-intonation launch views were separately rendered and visually inspected |

The clean install reported 102 dependency audit findings: 7 low, 32 moderate,
59 high, and 4 critical. No destructive `npm audit fix` was run. The host
default is Node 23.1.0, which npm warns is outside this older project's
supported range; clean dependency installation was therefore performed with
the available Node 22 runtime.

The web build retains 29 Ionic CSS selector-processing warnings and the
existing CommonJS warning for `PitchService`. Android reports that Android
Gradle Plugin 8.2.1 was tested through compile SDK 34 while the project uses
compile SDK 35. The iOS build retains the existing unassigned splash-screen
warning and a CocoaPods script-output warning. None blocked a build.

The iOS launch check stopped before starting an attempt because simulator
microphone permission and synthetic simulator input would not establish
physical acoustic validity. No Android simulator was running.

## 12. Remaining technical evaluation requirements

The following evidence is still required before making performance or
acoustic claims:

- controlled detector-frequency error against known ground truth across the
  activity's target range, all three instrument mappings, and A4 values;
- false acceptance/rejection tests at wrong-note, tolerance, spread, gap, and
  duration boundaries through the real detector pipeline;
- measured capture-to-estimate and estimate-to-feedback latency, jitter, event
  cadence, timer drift, and timeout behavior on representative web, Android,
  and iOS hardware;
- physical-device microphone denial, interruption, route switching,
  background/foreground, and repeated-session cleanup checks;
- audible reference-tone pitch and duration characterization, including the
  checked-in recordings' declared A4 assumptions and playback-rate changes;
- sensitivity analysis for tolerance, hold duration, minimum estimate count,
  maximum spread, maximum signal gap, timeout, and retry policy;
- persistence tests against an actual configured backend, including offline
  recovery and failure handling;
- accessibility/usability review of the new controls and feedback;
- a controlled end-to-end multi-target run on each platform.

The current simulator result does not validate a physical microphone, audible
timing, pitch-detector accuracy, real-time latency, or the acoustic
correctness of reference recordings.

## 13. Evidence now usable in the ArtsIT paper

The repository now provides reproducible evidence for these bounded claims:

1. One shared lifecycle/capability architecture supports two implemented
   educational activity controllers.
2. The activities have materially different control structures: PLP is a
   fixed 144-tick default cycle, while target intonation reacts to pitch
   identity, stability, signal gaps, deadlines, and learner commands.
3. The second activity was added with no change to PLP controller logic and
   only two narrow shared capability additions.
4. Written/sounding pitch, typed instrument transposition, selected A4, and
   explicit target identity are shared across both activities.
5. Target intonation rejects a well-tuned but incorrect chromatic note by
   construction and deterministic boundary tests.
6. Controllers own resources through ports, views remain presenters, and
   activity switching has one shared cancellation boundary.
7. Results are activity-specific and bounded while sharing one lifecycle
   envelope and persistence port.
8. The complete suite, static boundary checks, web build, Android build/test,
   iOS build, and two-route iOS render check pass.
9. A per-file, per-category change-surface dataset is available for the
   architectural extensibility analysis.

These are software-architecture and deterministic-behavior results. They must
not be written as evidence of educational effectiveness, detector accuracy,
low latency, acoustic correctness, or validated pedagogical thresholds.

## 14. Is the two-activity generalizability claim defensible?

Yes, with a narrow and explicit formulation:

> The bounded activity lifecycle and capability architecture was instantiated
> by two functionally and temporally contrasting music-learning activities
> while preserving the first activity's controller and requiring only two
> small shared capability extensions.

That claim is supported by source history, hashes, change-surface data,
deterministic tests, and cross-platform builds. It is stronger than a
single-activity reference implementation because the second instantiation
exercises event-driven pitch feedback, stability, timeouts, learner commands,
retry policy, and target-specific persistence.

The following broader claims remain indefensible:

- that the architecture generalizes to arbitrary educational activities;
- that third parties can extend it without repository-specific knowledge;
- that it is a toolkit, framework, plug-in platform, or declarative activity
  system;
- that architectural modularity has been evaluated across many
  implementations or developer teams;
- that the intonation activity improves learning;
- that its detector and feedback operate accurately or with acceptable
  latency on physical devices.

The evidence is sufficient to draft the architecture, implementation,
deterministic evaluation, and limitations sections of an ArtsIT regular paper.
The paper's controlled technical evaluation section should remain incomplete
until the measurements in Section 12 are performed.

## 15. Exact next Codex task

The next task should be a controlled pitch/timing characterization slice, not
another architectural refactor:

1. add an offline, deterministic characterization harness that feeds
   timestamped ground-truth tones and wrong-note cases through the actual
   pitch-detection boundary without changing evaluator semantics;
2. define a checked-in test matrix spanning instrument mappings, representative
   target frequencies, A4 430/440/450, silence, detuning offsets, cadence,
   jitter, gaps, and timeout boundaries;
3. record machine-readable detector error, false
   acceptance/rejection, capture-to-estimate timing, evaluator processing
   time, stability completion, and reset behavior;
4. add a physical-device protocol for Android and iOS covering microphone
   permission, interruption, route switching, repeated-session cleanup,
   reference playback, and end-to-end latency;
5. execute only the offline/automatable portion first, clearly mark
   physical-device items pending, and create
   `publication/artsit_pitch_timing_evaluation_report.md`;
6. do not change PLP semantics, target-intonation acceptance thresholds, or
   either manuscript merely to improve the measured results.

The repository is ready for that controlled evaluation task and for
provisional paper drafting. It is not yet ready for final acoustic-performance
claims.
