# Commands and outcomes

Paths are represented as `<workspace>` and `<temporary-copy>`.

| Purpose | Command | Outcome |
|---|---|---|
| Install exact dependencies | `npm ci` | Exit 0; 1,775 packages installed, 1,776 audited |
| Lint | `npm run lint` | Exit 0 |
| Production web build | `npm run build` | Exit 0 |
| CI test suite | `npm run test:ci` | Exit 0; 35 tests successful |
| Explicit CI test suite | `CI=true npm run test:ci` | Exit 0 after Karma repair |
| Android synchronization | `npx cap sync android` | Exit 0 in `<temporary-copy>` |
| iOS synchronization | `npx cap sync ios` | Exit 0 in `<temporary-copy>` |
| Android default build | `./gradlew assembleDebug --no-daemon --stacktrace` | Exit 1 because the committed Gradle Java path is Windows-specific |
| Android build with local JDK override | `./gradlew -Dorg.gradle.java.home=<java-17-home> assembleDebug --no-daemon --stacktrace` | Exit 0; 292 tasks |
| Android JVM tests with override | `./gradlew -Dorg.gradle.java.home=<java-17-home> testDebugUnitTest --no-daemon --stacktrace` | Exit 0 |
| Android device query | `<android-sdk>/platform-tools/adb devices -l` | Exit 0; no attached devices |
| iOS simulator build | `xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug -sdk iphonesimulator -derivedDataPath <temporary-copy>/DerivedData CODE_SIGNING_ALLOWED=NO build` | Exit 0 |
| iOS simulator install | `xcrun simctl install <simulator-id> <built-app>` | Exit 0 |
| iOS simulator launch | `xcrun simctl launch <simulator-id> com.mei-team.mei-trumpet` | Exit 0 |

The final release-candidate test suite was run three consecutive times. Each run completed with `TOTAL: 35 SUCCESS` and no late full-page-reload error.
