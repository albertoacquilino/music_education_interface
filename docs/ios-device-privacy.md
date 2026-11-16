# iOS Device plugin data minimization

## Decision and scope

The application uses Device.getInfo()/getId() in both Firebase activity-start paths. It persists/uploads only device identifier, model, platform and OS version. Device 6.0.1 nevertheless queried disk space and returned four optional disk fields. These queries had no application purpose. Apple's disk-space reason 85F4.1 is for displaying disk space; this application does not do that. No reason was invented and no privacy manifest was added.

A narrow reproducible patch was chosen over vendoring all plugin source or maintaining an entire fork. Latest compatible Device 6.0.3 was inspected and retains the same disk queries without a privacy manifest, so a patch-version update alone would not solve this issue. Merely removing JavaScript calls leaves the native SDK code bundled.

## Reproduction and maintenance

`@capacitor/device` is pinned to the already locked 6.0.1. `npm ci` runs `scripts/patch-ios-device.cjs` as `postinstall`; `npm run cap:sync:ios` also runs it as a verification hook. The script uses Node built-ins and Git, both required on the build machine; no new npm dependency was introduced.

The patch lives in `patches/capacitor-device-6.0.1-ios.patch`. Its accompanying JSON contains exact SHA-256 hashes for original and patched files. The script checks the installed package version, requires either both original hashes or both patched hashes, applies the patch only to pristine originals, and verifies outputs. Modified/partially patched inputs and unreviewed versions fail installation. Repeated application only verifies the result. Patch line endings are normalized for portable Git application.

Do not use `--ignore-scripts` for builds. If dependency installation must disable lifecycle scripts, explicitly run `node scripts/patch-ios-device.cjs` before any native sync/build; direct `npx cap sync ios` is not a substitute for patch application. Include scripts and patches in CI checkouts and cache keys; never distribute a native build from an unverified dependency cache.

The two modified Swift files remove the disk helper methods, corresponding computations and all four disk response entries (`diskFree`, `diskTotal`, `realDiskFree`, `realDiskTotal`). The four optional fields are now absent/undefined on iOS, as allowed by the existing TypeScript interface. No sentinel value is presented as a measurement. Android implementation, JavaScript/web implementation and type declarations remain byte-for-byte upstream. Device.getId(), model, platform, OS version and all other retained native methods are unchanged.

On a plugin upgrade, inspect upstream API usage/manifests, reassess Apple's current categories, regenerate/review patch and hashes only if still necessary, then rerun clean installation, iOS sync, builds and binary inspection. Remove the patch if upstream eliminates the unwanted APIs. Do not simply relax hash/version checks. This is a maintained local iOS deviation, not an upstream fix.

## Validation

- Two fresh npm installations applied the patch, including the final script; a subsequent iOS sync and `pod install --deployment` passed. Repeated verification passes. Disposable pristine-installation checks passed application, idempotence, rejection of changed source and rejection of an unexpected plugin version.
- Production Angular build, full 137-test browser suite (133 existing plus four Firebase regressions), app/spec TypeScript checks, lint and calibration verifier passed. The Firebase tests exercise both start paths with iOS disk fields absent and Android disk fields present; local records and objects passed to the Firestore write boundary retain exactly the established device fields. No live Firebase writes were performed.
- iOS sync/CocoaPods installation, clean simulator build and unsigned generic-device Release archive passed without deployment-target overrides. Plugin and CocoaPods versions are unchanged.
- The original archived Device framework imports `_NSFileSystemFreeSize`, `_NSFileSystemSize` and `_NSURLVolumeAvailableCapacityForImportantUsageKey`. In the new archive these references and corresponding disk strings are absent. Native getId/getInfo/getModelName symbols remain.
- Source review and archived undefined-symbol/string inspection also covered file timestamps, system boot time, user defaults and active keyboards. No matching required-reason API usage was identified in the affected Device framework. Remaining native code uses UIKit device/vendor ID/model/version, Foundation locale, hardware-model sysctl and task_info memory reporting; these are not a substitute disk query. The three deleted helpers are absent, not merely unused.
- Android and JS/type files were compared to pristine 6.0.1 by hash. Original application source, record schemas, musical processing and audio assets are unchanged.

## Limits and remaining obligations

This resolves the identified unnecessary disk-space API usage, not every privacy obligation of the whole application. The affected framework still has no privacy manifest; there is no disk-space declaration to add after removing the access. Capacitor/Cordova retain their existing manifests. Recheck any other frameworks against current Apple SDK/required-reason requirements and generate/review Xcode's aggregate privacy report before submission. Symbol scanning is evidence, not an App Store Connect acceptance certificate.

The existing device identifier and exercise telemetry continue to be stored locally and transmitted to Firestore. Accurate privacy disclosures, purpose/consent/retention review and App Store Connect validation remain required. Actual vendor ID/model reporting, microphone/audio behavior, routing and interruption/resume still require physical-device testing. No signed build, upload or store validation was performed; existing native deprecation warnings remain.

References: [Apple required-reason policy](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api), [Apple API categories/reasons](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype), [SDK requirements](https://developer.apple.com/support/third-party-SDK-requirements/), [Device v6 documentation](https://capacitorjs.com/docs/v6/apis/device).
