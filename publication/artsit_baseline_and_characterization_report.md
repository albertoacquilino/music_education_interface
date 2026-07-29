# ArtsIT baseline and characterization report

This report establishes the repository baseline required before introducing typed instruments or an extensible activity architecture. It records what the current application demonstrably does, including behavior that appears defective. No activity architecture, instrument model, activity model, or production workflow was refactored in this task.

## 1. Git/worktree safety

The required starting gate was verified at commit `748579a14877c8fd1a7030bbf6c32709fdf4dba2` before branch creation.

Pre-existing work was identified and preserved:

- an unstaged iOS project version/build-number change;
- four untracked App Store/Google Play screenshots;
- the two untracked publication strategy and architecture-planning documents.

Native synchronization and builds were performed in a disposable source copy because those commands can update generated Android and iOS files. The working native projects were not synchronized or built in place. Existing package and lock files were not changed.

## 2. Branch

The baseline work is on:

`research/artsit-extensible-activities`

The branch was created directly from the verified commit while carrying the owner's existing working-tree material unchanged. No remote branch was pushed and no pull request was created.

## 3. Environment

The successful baseline used macOS 26.6 on arm64, Node.js 23.1.0, npm 10.9.0, OpenJDK 17.0.18, Angular 15.2.10, Capacitor CLI 5.0.3/core 6.0.0, Gradle 8.5, Xcode 26.6, CocoaPods 1.14.3, and Chrome 150.

This is an observed workstation environment, not the recommended reference environment. In particular:

- Node.js 23 is unsupported by Angular 15 and should be replaced by a supported LTS version in CI;
- Capacitor CLI and core should be aligned to compatible major versions;
- platform build evidence should eventually be repeated on a documented reference toolchain.

Full versions are recorded in `artifacts/artsit-architecture/baseline/environment.md`.

## 4. Clean install

`npm ci` completed successfully after network access was restored:

- 1,775 packages installed;
- 1,776 packages audited;
- no change to `package.json` or `package-lock.json`.

The audit reported 102 vulnerabilities: 7 low, 32 moderate, 59 high, and 4 critical. The counts do not establish exploitability in this application, but they preclude an unqualified security or production-readiness claim until triaged.

The clean-install result is reproducible at the lockfile level. Package hashes are included in the baseline checksums.

## 5. Original Karma reproduction

Before modification, the exact `npm run test:ci` command launched headed Chrome because `karma.conf.js` recognized only the `CI=true` environment variable, while the npm script expressed non-watch mode as `--watch=false`.

The one original test succeeded, after which Karma logged:

`Some of your tests did a full page reload!`

Despite that error, the process exited 0. Running with `CI=true` selected headless Chrome but produced the same late reload report.

A temporary, application-independent sentinel spec reproduced the condition. In watch mode, the test remained clean until the runner was terminated. This isolated the symptom from Angular routing, application code, and Capacitor plugins.

## 6. Root cause

Karma's browser context installs an unload handler to detect genuine full-page reloads. The configuration left the context iframe present after a successful non-watch run (`client.clearContext: false`). Chrome 150 fired the iframe unload during browser shutdown, after test completion. Karma then reported the shutdown event as a full-page reload too late to affect the already successful exit status.

The root cause was therefore a runner-lifecycle/configuration incompatibility:

- the npm command did not activate the intended CI configuration;
- the retained iframe made browser shutdown observable as a reload;
- the report arrived after the suite had been marked successful.

## 7. Exact fix

The production source was not changed. `karma.conf.js` now defines a non-watch/CI run when any of the following is true:

- `CI=true`;
- `--no-watch` is present;
- `--watch=false` is present.

For those runs it:

- selects `ChromeHeadless`;
- enables `client.clearContext` so Karma clears the context iframe before shutdown.

The existing local watch behavior remains unchanged.

## 8. Proof that genuine failures remain nonzero

Two temporary sentinel tests were used and then deleted:

1. A deliberately false expectation made `npm run test:ci` exit 1.
2. A deliberate `window.location.reload()` made the command exit 1 and report the full-page reload.

The repaired real suite was then run three consecutive times. Every run exited 0 with:

`TOTAL: 35 SUCCESS`

There was no late reload error. The fix therefore removes the shutdown false positive without suppressing real assertion failures or real page reloads.

## 9. Characterization tests added

Thirty-four tests were added around the existing application, bringing the suite to 35 tests:

| Test area | Added | Characterized concern |
|---|---:|---|
| Beat service | 5 | tempo, ticks, measure boundaries, stop/restart, terminal state |
| Sounds service | 2 | metronome/reference reactions and duplicate terminal ticks |
| Home page | 9 | exercise start order, phase labels, pitch flow, capture, persistence, range, cleanup |
| Chromatic tuner | 9 | smoothing, thresholds, silence, microphone lifecycle, leaks, identifiers |
| Pitch service | 3 | frequency floor, normalization, silent input |
| Score utilities | 4 | notation defaults, accidentals, dynamics, instrument handling |
| Score component | 2 | render target and subscription lifecycle |

One narrow testability seam was introduced: the existing pitch minimum constant and normalization helper are exported. Their runtime values and behavior were not changed.

## 10. Current behavior

The current exercise is a single, stateful practice workflow centered in `HomePage`:

1. instrument mode waits for audio readiness and enables the microphone;
2. tuner mode starts the beat service and then prepares the tuner;
3. beat ticks drive labels, notation updates, tone/metronome playback through another subscriber, and terminal persistence;
4. pitch estimates flow independently from the phase sequence, with callbacks gated by current activity state;
5. score, tuner, sounds, beat, Firebase persistence, and timing are coupled through shared services and global DOM targets.

The visible phase label is `Rest`, followed by `Listen` and `Play`; it is not presently named `Prepare`.

The application functions as a specialized interactive music-practice application. The baseline does not support describing it as a toolkit or framework.

## 11. Observed defects

The characterization suite exposes the following defects or high-risk ambiguities:

- the terminal beat sequence produces only 11 complete cycles before emitting a stopped tick, then emits another tick marked playing;
- the sounds subscriber ignores the tick's `playing` flag, causing an additional terminal metronome beat;
- Home processes the terminal condition twice and persists `finished` twice;
- silent pitch buffers are normalized by division by zero and become `NaN`;
- nearest-note tuner feedback is not checked against the displayed exercise target;
- an accidental-only selected pitch range can yield a note outside the selected range;
- tuner mode starts the beat timer before asynchronous tuner preparation completes;
- score rendering and tuner lookup use global IDs that do not support multiple independent instances;
- several subscriptions and anonymous event listeners remain active after component destruction;
- ScoreComponent mutates display state after view initialization and can produce an Angular development-mode changed-after-check error.

These are not all equally visible to a learner, but they directly affect deterministic orchestration, reproducibility, or extensibility claims.

## 12. Prepare–listen–play event behavior

The observable cycle is implemented through beat/measure integers rather than a named exercise state model. In the regular path, each cycle contains three measures with four beats per measure. Phase interpretation is distributed:

- Home maps measure position to `Rest`, `Listen`, and `Play`;
- Sounds independently reacts to the same beat stream;
- terminal status is inferred from cycle/measure/beat conditions;
- persistence and presentation are not coordinated through one terminal event.

At the terminal boundary, the Beat service emits:

1. the final pre-terminal tick;
2. a tick at cycle 12, measure 0, beat 0 with `playing=false`;
3. another tick at the same position with `playing=true`.

This behavior should not become the implicit contract of a new architecture. Before extracting orchestration, the project must choose one explicit lifecycle and one terminal event, then write tests against that decision.

## 13. Tuner limitations

The tuner:

- estimates the nearest chromatic pitch, not correctness relative to a required target;
- smooths in groups of four estimates using a 2 Hz bucket and selects the first estimate in a tie;
- treats exact zero cents differently from adjacent in-tune values when assigning the emoji;
- blanks the display for silent/no-estimate input;
- uses a hard-coded global `#tuner` element;
- leaves its note subscription and anonymous window listeners attached after destruction.

These constraints are adequate for describing the existing display, but not for claiming a reusable target-aware assessment component. Typed activities need an explicit target pitch supplied to evaluation logic, not inferred from whichever pitch happens to be nearest.

## 14. Pitch, reference-frequency, and transposition limitations

The current implementation has no coherent domain model separating:

- written note;
- sounding frequency;
- transposing instrument;
- concert/reference pitch;
- learner-visible notation;
- tolerance/evaluation policy.

`HomePage` converts note names using a fixed A4 = 440 Hz formula. Instrument identity and any selected reference frequency do not alter the expected pitch. Score generation accepts an instrument argument but ignores it. Pitch detection rejects estimates below 140 Hz, and silent-buffer normalization produces `NaN`.

These are central scientific limitations for a claim of instrument generalizability. The typed-instrument stage should not begin by merely replacing strings with enums. It must first specify which layer owns written-to-sounding conversion and how a reference-frequency setting propagates through tone generation, detection, scoring, display, and persistence.

## 15. Score limitations

The current score utilities generate a fixed presentation:

- treble clef;
- C major;
- 4/4 time;
- three measures;
- fixed dynamic placement;
- no instrument-dependent transposition.

Accidentals are rendered, but the passed instrument does not change notation. The score component selects the first global `#score` node, so two component instances render into the same surface. Its reactive subscription is not disposed on destruction.

These limitations can be reported if the proposed contribution is orchestration/configurability rather than general-purpose notation. They must be fixed if the paper claims reusable multi-instrument score presentation or independent embedded activity instances.

## 16. Lifecycle/resource limitations

Resource ownership is distributed and incomplete:

- Home leaves the reference-frequency and one-second interval subscriptions active on destruction;
- ChromaticTuner leaves its note subscription and anonymous global listeners active;
- ScoreComponent leaves its combined stream subscription active;
- SoundsService owns a hidden Beat subscription for the application lifetime;
- tuner start ordering can allow timing to begin before microphone/tuner preparation completes;
- phase transitions do not explicitly acquire and release audio, microphone, timer, notation, and persistence resources.

This is the strongest argument for a later orchestration service or tested state machine. Extraction would be scientifically useful only if it establishes explicit states, transition causes, resource ownership, terminal semantics, and evidence that two activities reuse the same mechanism. Moving the existing conditionals without defining those contracts would be a code-quality refactor, not a research contribution.

## 17. Web verification

Both `npm run lint` and `npm run build` exit 0. The production build generated the application, lazy Home chunk, `pitchlite.wasm`, and audio worklet. Source/output asset hashes match.

The build reports 29 skipped CSS selectors. Bundle sizes are substantial, including a 1.09 MB raw lazy Home chunk and approximately 43 MB of generated web output. These are optimization concerns, not immediate blockers for the proposed architecture study.

The web baseline establishes buildability and asset packaging. It does not constitute browser-based microphone or complete exercise validation.

## 18. Android verification

Capacitor synchronization succeeds in an isolated copy and discovers eight plugins.

The default Gradle build fails because `android/gradle.properties` commits:

`org.gradle.java.home=C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot`

With a command-line Java 17 override:

- `assembleDebug` succeeds;
- `testDebugUnitTest` succeeds;
- a debug APK of approximately 40 MB is produced.

No device or emulator was attached, so installation, microphone permission, audio output, and complete activity execution were not verified. The generated instrumented test uses the wrong package/application ID and cannot be treated as meaningful platform evidence.

The Windows-only Java path is a direct reproducibility defect and should be removed in a separate, narrowly scoped correction before architectural work is advertised as cross-platform.

## 19. iOS verification

Capacitor synchronization succeeds in an isolated copy and discovers the same eight plugins. An unsigned Debug simulator build succeeds, producing an approximately 49 MB application bundle containing the expected web and audio assets.

The application installs and launches on an iPhone 17 Pro simulator running iOS 26.5. Initial visual inspection confirms that the Exercise route and practice interface render.

This does not verify microphone input, audible output, real-time pitch performance, signing, store release, or physical-device behavior. Those checks are required later for a complete cross-platform evidence package.

The iOS bundle ID (`com.mei-team.mei-trumpet`) differs from the Android/Capacitor ID (`com.meiteam.trumpet`). The difference should be documented as intentional or aligned.

## 20. Files modified

The scoped baseline changes are:

- `karma.conf.js`;
- `src/app/services/pitch.service.ts` (exports only, no changed behavior);
- `src/app/services/beat.service.spec.ts`;
- `src/app/services/sounds.service.spec.ts`;
- `src/app/services/pitch.service.spec.ts`;
- `src/app/pages/home/home.page.spec.ts`;
- `src/app/components/chromatic-tuner/chromatic-tuner.component.spec.ts`;
- `src/app/utils/score.utils.spec.ts`;
- `src/app/components/score/score.component.spec.ts`;
- files below `artifacts/artsit-architecture/baseline`;
- this report.

No production activity architecture, domain type, UI flow, native project, dependency manifest, or lockfile was refactored.

## 21. Files deliberately untouched

The following pre-existing material was deliberately excluded:

- `ios/App/App.xcodeproj/project.pbxproj`;
- `artifacts/app-store-screenshots/**`;
- `artifacts/google-play-screenshots/**`;
- `publication/repository_publication_strategy.md`;
- `publication/artsit_activity_architecture_plan.md`.

The native working directories were also left unsynchronized. All native generation occurred in `<temporary-copy>`.

## 22. Remaining risks

### Fix before making architecture claims

- remove the committed Windows-only Gradle Java path;
- define and test one terminal event and eliminate duplicate terminal sound/persistence;
- handle silence without `NaN`;
- make evaluation explicitly target-relative;
- define written/sounding/reference/transposition semantics;
- establish explicit resource ownership and teardown;
- remove global DOM identity assumptions if multiple instances are claimed.

### Resolve or control during implementation

- pin supported Node and compatible Capacitor versions in a reference environment;
- replace the invalid Android instrumented test and add application-specific smoke coverage;
- run complete microphone/audio workflows on physical Android and iOS devices;
- triage dependency vulnerabilities;
- decide whether cross-platform application IDs should align.

### Reportable at ArtsIT scope

- fixed clef/key/meter/measure-count notation, unless broader notation is claimed;
- CSS selector and native build warnings;
- simulator-only iOS launch at this baseline stage;
- absence of release signing/store verification;
- bundle size, unless performance or deployability is a central claim.

## 23. Go/no-go recommendation for typed instruments

**Recommendation: conditional no-go for implementation; go for the domain decision and instrument inventory only.**

The repository is now sufficiently characterized to design typed instruments without guessing about current behavior. It is not yet safe to implement them as evidence of a reusable architecture, because three foundational contracts remain unresolved:

1. the intended terminal semantics of the prepare–listen–play cycle;
2. the written-pitch, sounding-pitch, transposition, and reference-frequency model;
3. lifecycle ownership for timer, microphone, audio, score, persistence, and tuner resources.

The minimum next task should be a narrow correctness-and-domain-contract change, not the architectural refactor itself:

1. document the intended 12-cycle/terminal event sequence and correct duplicate terminal effects;
2. remove the repository-specific Gradle Java path;
3. define typed written/sounding/reference pitch conversion with tests;
4. correct silent-buffer handling;
5. rerun all 35 tests plus web and isolated native baselines.

After those gates pass, proceed to typed instruments and the planned extensible activity model. This sequence preserves the scientific value of the baseline: later evidence can show that the architecture intentionally changed known contracts, rather than accidentally inheriting or obscuring them.
