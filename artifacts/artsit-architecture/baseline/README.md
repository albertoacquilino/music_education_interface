# ArtsIT architecture baseline

This directory records the reproducible baseline established before any activity-architecture refactor. It supports the corresponding report in `publication/artsit_baseline_and_characterization_report.md`.

Scope:

- dependency installation and environment capture;
- web lint, production build, and Karma characterization tests;
- isolated Capacitor synchronization;
- Android debug build and JVM unit-test verification;
- iOS simulator build, installation, and launch verification;
- checksums for key source, web, and native artifacts.

The native synchronization and builds were performed in a disposable copy named `<temporary-copy>`. This protected the working tree and, in particular, preserved an existing uncommitted iOS version change. Paths in these records are intentionally normalized; no credentials or user-specific absolute paths are included.

This is a characterization baseline, not evidence that every observed behavior is correct. Known limitations and claim blockers are recorded in `warnings.md` and in the publication report.
