# ArtsIT 2026 Publication Snapshot

This repository accompanies the accepted ArtsIT 2026 paper **“An Extensible
Activity Architecture for Cross-Platform Music-Learning Applications.”** It
contains the shared activity lifecycle and capability boundaries described in
the paper, together with two contrasting activities:

- **Prepare–Listen–Play**, a clock-driven, fixed-cycle activity; and
- **Target Intonation**, an event-driven activity based on pitch input,
  stability, timeout, and learner commands.

## Archival relationship

Commit
[`4118f4df8a106193d4bcee1cadb65f0f8be8326d`](https://github.com/albertoacquilino/music_education_interface/tree/4118f4df8a106193d4bcee1cadb65f0f8be8326d)
is the exact code checkpoint evaluated in the paper and is preserved by the
annotated tag `artsit-2026-accepted`. This publication snapshot is a direct
descendant of that checkpoint and changes only this README; application code,
tests, assets, native projects, and evaluation evidence are unchanged.

## Quick verification

The project requires Node.js and npm 10. The evaluation and this archival
recheck used Node.js 23.1.0 and npm 10.9.0. The archived baseline notes that
Node.js 23 was outside Angular 15's supported range; a supported LTS runtime is
preferable for continued development. npm 11 does not accept this historical
lockfile, so use npm 10 when reproducing the frozen snapshot.

```bash
npm ci
npm run lint
npm run test:ci
npm run build
node scripts/check-activity-boundaries.mjs
```

Expected results for this snapshot are a successful lint and production web
build, **98 passing tests**, and a dependency-boundary result with
`"passed": true`. Run the application locally with `npm start`; the two
activity routes are `/home/exercise` and `/home/intonation`.

## Where to inspect the implementation

| Concern | Location |
| --- | --- |
| Shared lifecycle and capability contracts | `src/app/core/activity/` |
| Single-active-session composition | `src/app/core/activity/activity-session.service.ts` |
| Prepare–Listen–Play controller | `src/app/activities/prepare-listen-play/` |
| Target Intonation controller and pure evaluator | `src/app/activities/target-intonation/` |
| Typed instruments and written/sounding targets | `src/app/instruments/`, `src/app/core/music/` |
| Capability adapters | `src/app/adapters/` |
| Activity routes and views | `src/app/app.routes.ts`, `src/app/pages/` |
| Automated specifications | `src/**/*.spec.ts` |

## Evaluation and reproducibility materials

- `scripts/check-activity-boundaries.mjs` checks controller independence,
  shared-core dependency direction, the frozen Prepare–Listen–Play controller,
  and independent activity routes.
- `publication/artsit_target_intonation_change_surface.json` and
  `publication/artsit_target_intonation_change_surface.csv` provide the
  machine-readable production change surface used in the architectural
  analysis.
- `publication/artsit_prepare_listen_play_migration_report.md` documents the
  lifecycle extraction and its verification.
- `publication/artsit_baseline_and_characterization_report.md` and
  `artifacts/artsit-architecture/baseline/` record the characterized baseline,
  toolchain, commands, and platform-specific limitations.

## Native project verification

The web application is packaged through Capacitor for Android and iOS. Native
verification requires platform tooling in addition to the quick checks above.

Android (Java 17 and an Android SDK):

```bash
npm run build
npm run cap:sync:android
cd android
./gradlew assembleDebug testDebugUnitTest
```

iOS (macOS, Xcode, and CocoaPods):

```bash
npm run build
npm run cap:sync:ios
xcodebuild -workspace ios/App/App.xcworkspace -scheme App \
  -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
```

Capacitor synchronization can update generated native files, so use a clean
checkout when reproducing native builds. The paper reports simulator-based iOS
route rendering and Android build/unit-task evidence; it does not claim
physical-device acoustic validation.

## License

The project is distributed under the GNU Affero General Public License v3.0;
see `LICENSE`.
