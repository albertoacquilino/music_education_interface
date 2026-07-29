# Android baseline

## Configuration

- Application ID/namespace: `com.meiteam.trumpet`
- Minimum SDK: 22
- Compile SDK: 35
- Target SDK: 35
- Gradle wrapper: 8.5
- Audio recording permission: declared

Eight Capacitor plugins were discovered during synchronization:

1. Keep Awake
2. App
3. Device
4. Haptics
5. Keyboard
6. Status Bar
7. Capgo Mute
8. Mozartec Microphone

## Build result

The committed `android/gradle.properties` sets `org.gradle.java.home` to a Windows-specific JDK path. The default build therefore fails on macOS before compilation.

Using a command-line Java 17 override, `assembleDebug` succeeded in 15 seconds:

- 292 tasks total;
- 243 tasks executed;
- debug APK size: approximately 40 MB;
- APK SHA-256: `8328d1363f528a1c935dc9f3d100cc912b2e30b51b16c73e32177bd4322da352`.

`testDebugUnitTest` also succeeded with the override, but the native JVM suite contains only the generated arithmetic test and provides no application-specific coverage.

## Device status

ADB was available through the Android SDK, but no physical device or emulator was attached. Instrumented tests were not run.

The generated instrumented test is not valid for the configured application: it declares `com.getcapacitor.myapp` and expects `com.getcapacitor.app`, whereas the repository uses `com.meiteam.trumpet`.

## Warnings

- Android Gradle Plugin 8.2.1 reports that it was tested only through compile SDK 34, while the project uses 35.
- Gradle reports flat-directory repository warnings.
- Compilation reports deprecated API use in dependencies.
- The hard-coded Java path is a direct portability and reproducibility blocker and should be fixed, rather than merely reported.
