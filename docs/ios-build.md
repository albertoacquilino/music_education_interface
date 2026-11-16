# iOS build toolchain

## Supported configuration

This project uses Xcode 27.2 (27B52), iOS SDK 27.2 and CocoaPods 1.14.3. The installed SDK and Apple's Xcode compatibility table support deployment to iOS 15 and later. Capacitor 6.2.3 and all eight existing native plugins declare iOS 13 support and compile at the selected iOS 15 floor. Swift remains in the existing Swift 5 language mode (app 5.0, pods 5.1); no Swift 6 migration is required.

The project and app Debug/Release deployment settings and Podfile platform are 15.0. The Podfile post-install step raises generated pod deployment targets to at least 15.0, retaining any higher requirement and the existing resource-bundle signing exception. Capacitor's own helper only enforces iOS 13, so it is insufficient on its own for this Xcode.

This change excludes installations still running iOS 13/14. No higher minimum than 15 is needed. SDK upload requirements are distinct from the minimum OS supported by the app: Apple's current App Store Connect requirement is Xcode 26+ and an iOS 26+ SDK, which this toolchain satisfies.

## Identity and behavior preserved

- Bundle ID: `com.mei-team.mei-trumpet`; display name: `music-education-interface`.
- Marketing version 2.0.0, build 2; existing automatic signing, team and identity settings unchanged. No custom entitlements are tracked.
- iPhone/iPad device families unchanged. iPhone portrait/upside-down and iPad all four orientations unchanged.
- Existing microphone usage description retained. It explains pitch analysis, with trumpet as an example; it does not restrict other instruments.
- Existing AppDelegate `playAndRecord` session configuration, speaker/Bluetooth options and activation at launch/resume retained. No new interruption handler or background-audio mode added.
- The pitch service still uses Web Audio/getUserMedia; reference playback still explicitly refuses unsupported HTML Audio tuning. No audio assets, processing, native plugin packages or exercise logic changed.

## Reproducible checks

Use the repository's approved Node/npm toolchain (validation: Node 18.20.8/npm 10.8.2) and installed CocoaPods:

```sh
npm ci
npm run build -- --configuration production
npm run cap:sync:ios
npm run test:ci
npx tsc --noEmit -p tsconfig.app.json
npx tsc --noEmit -p tsconfig.spec.json
node scripts/verify-reference-calibration.cjs
cd ios/App
pod install --deployment
cd ../..
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath "$TMPDIR/mei-ios-simulator" CODE_SIGNING_ALLOWED=NO clean build analyze
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Release -destination 'generic/platform=iOS' -derivedDataPath "$TMPDIR/mei-ios-device" -archivePath "$TMPDIR/mei-ios.xcarchive" CODE_SIGNING_ALLOWED=NO archive
```

These commands do not override the deployment target. An unsigned archive demonstrates compilation/packaging only; it cannot be distributed through TestFlight. Do not pass unsigned settings for a real distribution archive.

## Privacy and distribution review still required

The Device disk-space issue identified during modernization is addressed by a version-checked, reproducible iOS source patch. See [Device privacy patch](ios-device-privacy.md) for its scope, optional-field behavior, installation requirements, archive checks and remaining privacy obligations. No speculative privacy declaration was added; existing telemetry is preserved.

Static analysis reports warnings in unchanged `CAPPlugin.m` (self initialization) and `Keyboard.m` (uninitialized values). Compilation succeeds, but these findings need plugin-level review; those dependency sources were not patched. Existing API deprecations, CocoaPods script output warnings and optional AppIntents metadata messages are also reported.

Before TestFlight: verify Apple account access, signing/provisioning, agreements, an unused build number, export compliance, final bundle validation and privacy disclosures. Test microphone permission allow/deny, Web Audio unlock, all four instruments/calibration/Profile C, silent mode/speaker/headphones/Bluetooth, calls/background/resume and low-vision layouts on physical devices. Browser tests and unsigned builds do not establish these runtime behaviors.

## Primary references

- [Xcode support matrix](https://developer.apple.com/xcode/system-requirements)
- [Apple SDK upload minimum](https://developer.apple.com/news/upcoming-requirements/?id=04282026a)
- [Capacitor Device v6 privacy requirements](https://capacitorjs.com/docs/v6/apis/device)
- [Apple required-reason API policy](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api)

## Validation results (2026-11-16)

Clean npm installation, production Angular build, Capacitor iOS sync, fresh CocoaPods installation and subsequent `pod install --deployment` passed. Dependency versions were unchanged; only the Podfile checksum changed in the lockfile. All 26 generated pod build configurations have deployment targets of at least iOS 15.

The full browser suite passed 133 tests; app/spec TypeScript checks and the calibration verifier passed (147 recordings, 207 aliases, 588 tuning cases, 13 exact approvals). Clean simulator build and static analysis completed, as did an unsigned Release archive for generic physical iOS devices. None used a deployment-target override. The archive preserves bundle identity/version/families and all 147 source-audio hashes. This is not a signed distribution archive or an App Store Connect acceptance result.
