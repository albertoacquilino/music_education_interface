# ArtsIT manuscript evidence map

## Purpose and evidence policy

This map links the important technical claims in
`publication/artsit_manuscript/samplepaper.tex` to repository evidence on
`research/artsit-extensible-activities`. It is intended for author review,
rebuttal preparation, and final claim checking.

The evidence hierarchy used in the manuscript is:

1. implementation and deterministic tests;
2. executable audits and machine-readable change-surface artifacts;
3. isolated build and route-rendering records;
4. implementation reports that assemble the command outputs and evidence
   boundaries;
5. repository history for temporal and change-locality claims.

Reports are secondary summaries. Where a claim can be traced directly to code,
tests, or history, those sources are listed first.

## Claim-to-evidence map

| ID | Manuscript locus | Important claim | Primary evidence | Supporting evidence and history | Claim boundary |
|---|---|---|---|---|---|
| C01 | Abstract; Introduction; Architecture | The application has a bounded shared lifecycle separated from activity-specific state. | [`activity.types.ts`](../src/app/core/activity/activity.types.ts), [`activity-controller.ts`](../src/app/core/activity/activity-controller.ts), [`activity-context.ts`](../src/app/core/activity/activity-context.ts) | Commits `17739b3` and `45daf1c`; [PLP migration report, sections 1 and 5](artsit_prepare_listen_play_migration_report.md) | Demonstrated inside this application; not an external extension API. |
| C02 | Architecture: Bounded Lifecycle | Lifecycle snapshots explicitly distinguish idle, starting, running, completed, cancelled, and failed, and terminal variants carry typed results. | [`activity.types.ts`](../src/app/core/activity/activity.types.ts) | [`activity-session.service.spec.ts`](../src/app/core/activity/activity-session.service.spec.ts); [target implementation report, section 2](artsit_target_intonation_implementation_report.md) | Type-level and deterministic behavior evidence; no formal model checking. |
| C03 | Architecture: Session Admission | One active controller is admitted; a new activity supersedes the current one through the same cancellation boundary. | [`activity-session.service.ts`](../src/app/core/activity/activity-session.service.ts), [`tabs.page.ts`](../src/app/pages/tabs/tabs.page.ts) | [`activity-session.service.spec.ts`](../src/app/core/activity/activity-session.service.spec.ts), [`tabs.page.spec.ts`](../src/app/pages/tabs/tabs.page.spec.ts); [target report, sections 7--8](artsit_target_intonation_implementation_report.md) | Exactly-once behavior is established under tested event orderings, not every possible native lifecycle interleaving. |
| C04 | Architecture: Capability Ports | Controllers depend on clock, audio, pitch-input, notation, instrument-registry, and persistence ports rather than Angular/Ionic/Capacitor/Firebase/DOM/Web Audio. | [`activity-context.ts`](../src/app/core/activity/activity-context.ts), [`prepare-listen-play.controller.ts`](../src/app/activities/prepare-listen-play/prepare-listen-play.controller.ts), [`target-intonation.controller.ts`](../src/app/activities/target-intonation/target-intonation.controller.ts) | [`scripts/check-activity-boundaries.mjs`](../scripts/check-activity-boundaries.mjs); [target report, section 9](artsit_target_intonation_implementation_report.md) | Static import boundary plus review; it does not prove all future files obey the rule. |
| C05 | Architecture: Resource Ownership | Controllers acquire and release timing, pitch, audio, and persistence resources on terminal paths, and the target view does not own the microphone. | [`target-intonation.controller.ts`](../src/app/activities/target-intonation/target-intonation.controller.ts), [`prepare-listen-play.controller.ts`](../src/app/activities/prepare-listen-play/prepare-listen-play.controller.ts), [`target-intonation.page.ts`](../src/app/pages/target-intonation/target-intonation.page.ts) | Controller and page specifications; [target report, sections 5 and 8](artsit_target_intonation_implementation_report.md) | Deterministic fake-port evidence; no physical operating-system interruption study. |
| C06 | Architecture: Typed Musical Domain | A note target unifies written pitch, sounding pitch, transposition, A4, expected frequency, notation/fingering, and reference asset. | [`instrument-definition.ts`](../src/app/instruments/instrument-definition.ts), [`instrument-registry.service.ts`](../src/app/instruments/instrument-registry.service.ts), instrument definitions under [`src/app/instruments/definitions`](../src/app/instruments/definitions) | [`instrument-registry.service.spec.ts`](../src/app/instruments/instrument-registry.service.spec.ts); [PLP report, section 4](artsit_prepare_listen_play_migration_report.md) | Western equal-tempered pitch and the current typed catalog only. |
| C07 | Architecture: Instrument Catalog | The registry contains three instruments, 110 notes, and 189 exact asset paths; B-flat trumpet/clarinet use -2 semitones and oboe uses zero. | Instrument definitions under [`src/app/instruments/definitions`](../src/app/instruments/definitions) and [`instrument-registry.service.spec.ts`](../src/app/instruments/instrument-registry.service.spec.ts) | [PLP report, sections 4 and 9](artsit_prepare_listen_play_migration_report.md); [target report, section 11](artsit_target_intonation_implementation_report.md) | Asset presence and catalog invariants, not acoustic correctness or licensing provenance. |
| C08 | Two Instantiations: PLP | Default PLP produces 144 running ticks, 144 metronome commands, 12 reference commands, and exactly one terminal result after cycle 12/Play beat 3. | [`prepare-listen-play.controller.spec.ts`](../src/app/activities/prepare-listen-play/prepare-listen-play.controller.spec.ts) | [PLP report, section 3](artsit_prepare_listen_play_migration_report.md) | Deterministic controller cadence; not audible timing or device drift. |
| C09 | Two Instantiations: Target Intonation | The second controller is event-driven by pitch estimates, one-shot deadlines, and retry/next/skip/stop commands. | [`target-intonation.types.ts`](../src/app/activities/target-intonation/target-intonation.types.ts), [`target-intonation.controller.ts`](../src/app/activities/target-intonation/target-intonation.controller.ts) | [`target-intonation.controller.spec.ts`](../src/app/activities/target-intonation/target-intonation.controller.spec.ts); commits `ce8393e` and `f0ac951` | Functional state and trace evidence; no learner study. |
| C10 | Target-Relative Evaluation | Cents are computed against the explicit target sounding frequency; a different chromatic note is rejected and cannot produce stable-hold success. | [`intonation-evaluator.ts`](../src/app/activities/target-intonation/intonation-evaluator.ts), [`instrument-definition.ts`](../src/app/instruments/instrument-definition.ts) | [`intonation-evaluator.spec.ts`](../src/app/activities/target-intonation/intonation-evaluator.spec.ts), especially wrong-note, transposition, A4, and threshold cases; [target report, section 3](artsit_target_intonation_implementation_report.md) | Verification uses deterministic pitch estimates, not microphone waveforms or detector-accuracy ground truth. |
| C11 | Implementation | Intonation defaults are explicit configuration, persisted with the session, and are not presented as validated pedagogical thresholds. | [`target-intonation.types.ts`](../src/app/activities/target-intonation/target-intonation.types.ts), [`firebase-activity.adapter.ts`](../src/app/adapters/persistence/firebase-activity.adapter.ts) | [Target report, sections 4 and 6](artsit_target_intonation_implementation_report.md) | Parameter rationale is engineering sensitivity analysis, not learning-threshold validation. |
| C12 | Persistence | Results are typed and bounded; normal production telemetry stores neither raw microphone audio nor full per-frame pitch traces. | [`activity-context.ts`](../src/app/core/activity/activity-context.ts), [`firebase-activity.adapter.ts`](../src/app/adapters/persistence/firebase-activity.adapter.ts), [`firebase.types.ts`](../src/app/models/firebase.types.ts) | [`firebase-activity.adapter.spec.ts`](../src/app/adapters/persistence/firebase-activity.adapter.spec.ts); [target report, section 6](artsit_target_intonation_implementation_report.md) | Code-path claim for the current adapters, not a legal/privacy compliance assessment. |
| C13 | Evaluation: Test Results | The verified suite contains 98 passing tests, including 20 evaluator and 16 target-controller tests while retaining PLP regression tests. | Test files under [`src/app`](../src/app) and `npm run test:ci` | Commit `4118f4d`; [target report, sections 8--9 and 11](artsit_target_intonation_implementation_report.md) | Test count is descriptive and is not used as a coverage percentage or quality metric. |
| C14 | Evaluation: Change Surface | From `45daf1c` to second-activity integration, production changes were 6 added/12 modified files and +2,487/-51 lines: 3 new activity files, a 6-line shared contract extension, 7 shared files touched, no PLP-controller changes, and no shared-core activity branches. | [`artsit_target_intonation_change_surface.csv`](artsit_target_intonation_change_surface.csv), [`artsit_target_intonation_change_surface.json`](artsit_target_intonation_change_surface.json), and the Git diff from `45daf1c` through `f0ac951` | Comparison point `45daf1c`; integration commit `f0ac951`; evidence commit `4118f4d`; [target report, section 10](artsit_target_intonation_implementation_report.md) | Line counts support locality only when triangulated with history, hashes, tests, and boundary checks; they do not prove quality. |
| C15 | Evaluation: PLP Preservation | The PLP controller is byte-for-byte unchanged after the second activity and its SHA-256 remains `8fcdbe101780b7d6f8239b2216f74948d06281516919678fe64ac65b93a567b9`. | Git object at `45daf1c` and current [`prepare-listen-play.controller.ts`](../src/app/activities/prepare-listen-play/prepare-listen-play.controller.ts) | Change-surface JSON; [target report, sections 9--10](artsit_target_intonation_implementation_report.md) | Applies to controller content; PLP host/presenter wiring received small integration changes classified separately. |
| C16 | Evaluation: Cross-Platform | Clean web verification, isolated Android sync/debug build/unit task, isolated iOS sync/unsigned simulator build, iOS install/launch, and rendering of both routes passed. | Command records summarized in [target report, section 11](artsit_target_intonation_implementation_report.md) and baseline artifacts under [`artifacts/artsit-architecture/baseline`](../artifacts/artsit-architecture/baseline) | Commits `f0ac951`, `4118f4d`, and `fdff748`; current web re-verification recorded during manuscript preparation | No Android emulator launch, physical microphone/audio run, detector accuracy, latency, or reference-recording acoustic validation. |
| C17 | Figures and UI | The manuscript screenshots show the current independent PLP and target-intonation routes; the diagrams correspond to implemented dependencies and transitions. | [`app.routes.ts`](../src/app/app.routes.ts), [`tabs.page.ts`](../src/app/pages/tabs/tabs.page.ts), both page modules, and figure sources under [`publication/artsit_manuscript/figures`](artsit_manuscript/figures) | [Target report, section 7](artsit_target_intonation_implementation_report.md); local web route rendering during manuscript preparation | Screenshots show launch/configuration surfaces, not a physical acoustic attempt. |
| C18 | Open Source | The repository is open-source under AGPLv3-or-later. | [`LICENSE`](../LICENSE) | Repository history | The anonymous review artifact still needs a stable archival URL before submission. |

## Quantitative consistency checklist

The following values must remain synchronized across the manuscript, tables,
captions, reports, and rebuttal materials:

| Quantity | Authoritative value |
|---|---:|
| Total automated tests | 98 |
| Intonation-evaluator tests | 20 |
| Target-controller tests | 16 |
| PLP default running ticks | 144 |
| PLP default metronome commands | 144 |
| PLP default reference commands | 12 |
| Typed instruments | 3 |
| Typed note definitions | 110 |
| Exact declared asset paths | 189 |
| Post-PLP production files added / modified | 6 / 12 |
| Post-PLP production lines added / deleted | 2,487 / 51 |
| New target-intonation module files | 3 |
| Shared contract extension | 6 added lines |
| Shared files touched | 7 |
| PLP controller lines changed | 0 |

## Claims intentionally excluded

The manuscript does not claim:

- educational effectiveness, learning gains, usability, engagement, or
  accessibility outcomes;
- physical microphone validation, audible timing validation, pitch-detector
  accuracy, end-to-end latency, or acoustic correctness of reference tones;
- arbitrary third-party extensibility, toolkit maturity, or a stable public
  framework API;
- that change volume or test count alone proves software quality.
