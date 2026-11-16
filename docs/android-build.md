# Android build toolchain

The Android app remains `com.meiteam.trumpet`, version name `1.4.3`, version code `13`, with minimum API 22. Store versions and signing configuration are independent of this toolchain update.

## Prerequisites

- JDK 17. Select it with `JAVA_HOME` in the shell, or Android Studio's Gradle JDK setting. Do not commit `org.gradle.java.home` or developer-specific paths.
- Android SDK Platform 36 and SDK Build Tools 35.0.0 (AGP's default); platform-tools and accepted Android SDK licenses.
- Set `ANDROID_HOME` to the local SDK, or configure ignored `android/local.properties` locally.
- Gradle 8.11.1 via the checked-in wrapper, with distribution SHA-256 verification; AGP 8.10.1. This AGP release explicitly supports API 36 and Java 17.
- Existing web dependencies: use a Node/npm combination compatible with Angular 15. Validation used Node 18.20.8 and npm 10.8.2. These are legacy tools; modernization is a separate task.

Google Play currently requires API 36 for phone/tablet updates. Compile and target SDK are both 36. Capacitor core/Android/iOS/CLI remain 6.2.3; native plugin packages, AndroidX and Google Services versions are retained. The shared `kotlin_version` is 2.2.21 so Kotlin compilation uses a documented supported Gradle/AGP combination instead of the microphone plugin's old 1.9.10 default.

## Build and checks

From the repository root, after selecting the JDK and SDK in the environment:

```sh
npm ci
npm run build -- --configuration production
npm run cap:sync:android
npm run test:ci
node scripts/verify-reference-calibration.cjs
cd android
./gradlew --version
./gradlew clean :app:assembleDebug :app:testDebugUnitTest :app:lintDebug
./gradlew :app:assembleDebugAndroidTest
```

Run `./gradlew :app:connectedDebugAndroidTest` only with a connected emulator/device. The package-context fixture checks the real app ID; it does not test the musical exercises.

For an unsigned release compilation/packaging check, use `./gradlew :app:packageReleaseBundle`. Its intermediate AAB is not signed and must not be uploaded. Normal `bundleRelease` still requires the existing external release-signing properties and upload key; this update does not bypass that guard or provide credentials.

Inspect final APK/AAB archives for `.so`/ELF libraries and check 16 KB alignment if any are introduced. Java/Kotlin-only packages do not require NDK alignment changes. Test on 16 KB hardware/emulation nonetheless. Before distribution, test API 36 edge-to-edge/insets, navigation, microphone permission, first-use Web Audio unlock, audio routing, interruptions/resumption and all four instruments on physical devices. Desktop browser tests do not establish Android audio behavior.

## Official references

- [Google Play target API policy](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en-US-u-mu-fahrenhe)
- [AGP 8.10 compatibility](https://developer.android.com/build/releases/agp-8-10-0-release-notes)
- [16 KB page-size support](https://developer.android.com/guide/practices/page-sizes)

- [Kotlin Gradle/AGP compatibility](https://kotlinlang.org/docs/gradle-configure-project.html)

## Validation of this update (2026-11-16)

- Clean npm installation, production web build, Android Capacitor sync, 133 browser tests, app/spec TypeScript checks and all 147 calibration hashes/13 listening approvals passed.
- Android dependencies resolved with `--refresh-dependencies`. Final clean build passed `assembleDebug`, `testDebugUnitTest` (one template test), `lintDebug`, `assembleDebugAndroidTest` and `packageReleaseBundle` with JDK 17.0.18. Lint reported zero errors and 32 warnings, mostly inherited icons/resources and maintenance suggestions.
- Both debug APK and unsigned intermediate AAB contained no `.so` or ELF libraries. APK `zipalign -c -P 16 4` passed. No 16 KB device test was performed.
- All eight existing Capacitor plugin packages were retained and compiled. Kotlin runtime resolved to 2.2.21. Google Services 4.3.15 resolved on the build classpath; its app processing remains conditional on the existing `google-services.json` check and was not exercised without that file.
- No device was connected and no AVD was configured. Instrumentation was compiled but not executed. Real microphone/audio behavior and Android 16 insets remain physical-device checks.
- Existing flat-directory repository/deprecation and older local SDK tooling XML warnings remain; Gradle 9 is outside this configuration. The generated Windows wrapper retains its standard CRLF line endings (`git -c core.whitespace=cr-at-eol diff --check`).
- Signed Play upload still requires the original upload key/signing properties, a valid unused store version code, developer-account access and device testing. No signing guard or current store version was changed.
