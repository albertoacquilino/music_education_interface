# Environment

Captured on 2026-07-28/29 in America/Toronto.

| Component | Observed version |
|---|---|
| Operating system | macOS 26.6 (build 25G72), arm64 |
| Darwin | 25.6.0 |
| Git | 2.50.1 (Apple Git-155) |
| Node.js | 23.1.0 |
| npm | 10.9.0 |
| Java | OpenJDK 17.0.18 (Homebrew) |
| Angular CLI | 15.2.11 |
| Angular | 15.2.10 |
| TypeScript | 4.8.4 |
| RxJS | 7.5.7 |
| Ionic Angular | 7.8.6 |
| Capacitor CLI | 5.0.3 |
| Capacitor core | 6.0.0 |
| Gradle | 8.5 |
| Kotlin | 1.9.20 |
| Groovy | 3.0.17 |
| Xcode | 26.6 (build 17F113) |
| Swift | 6.3.3 |
| CocoaPods | 1.14.3 |
| Chrome | 150.0.7871.187 |
| Safari | 26.6 |

Environment observations:

- Node.js 23 is outside Angular 15's supported Node range and is not an LTS release. The successful baseline does not establish that this runtime is suitable for CI or release work.
- The installed Capacitor CLI and core packages have different major versions. Synchronization succeeded, but the mismatch should be removed before making portability claims.
- The Ionic CLI is not installed globally. Repository npm scripts do not require it for the checks recorded here.
- No dependency or lockfile changes were required for the successful install.
