# Baseline risks and warnings

## Direct claim blockers

These limitations undermine proposed claims and should be fixed or explicitly resolved before an extensible-activity implementation is treated as publication evidence:

1. The Android build is not portable because `org.gradle.java.home` is committed as a Windows-only path.
2. The beat terminal sequence emits a stopped event followed by another playing event. Downstream listeners ignore or duplicate the state, producing a duplicate terminal metronome beat and duplicate finished-session persistence.
3. Pitch normalization divides a silent input buffer by zero, producing `NaN` samples.
4. Tuner feedback is nearest-note based and has no explicit exercise target, so it can reward a pitch that is musically wrong for the displayed task.
5. Written pitch, sounding pitch, transposition, and reference-frequency semantics are not represented consistently. Home's note-frequency conversion is fixed at A4 = 440 Hz.
6. Activity, tuner, score, and sound lifecycles do not have single, explicit ownership. Several subscriptions and anonymous window listeners survive component destruction.
7. Global `#score` and `#tuner` DOM identifiers prevent safe independent component instances.

## Important engineering risks

- Node.js 23 is unsupported by Angular 15; use a supported LTS runtime in CI.
- Capacitor CLI 5 and core 6 should use compatible major versions.
- `npm ci` reports 102 known dependency vulnerabilities: 7 low, 32 moderate, 59 high, and 4 critical. These require triage rather than an unqualified security claim.
- The generated Android instrumented test uses the wrong package and expected application ID.
- There is no application-specific native Android test coverage.
- No physical Android or iOS activity run was completed.

## Reportable limitations

These do not by themselves invalidate a software-architecture paper if described accurately:

- 29 CSS selector warnings in the production web build;
- Android Gradle Plugin's compile-SDK compatibility warning;
- Gradle flat-directory repository warnings;
- iOS splash-storyboard and build-script warnings;
- large web and native debug artifacts;
- lack of store-signing verification at this stage;
- current score layout being fixed to treble clef, C major, 4/4, and three measures, provided the paper does not claim general notation support.
