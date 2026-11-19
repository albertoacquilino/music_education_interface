# iOS 27 launch-crash correction

Build 2.0.2 (4), source c1526ef, used UIApplicationDelegate and a main
storyboard without a scene manifest. A separately signed copy reproduced an
immediate Home Screen closure on a physical iPhone running iOS 27.2.1.
The native report identifies EXC_BREAKPOINT/SIGTRAP on thread 0 in
`___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption_block_invoke`.
This happens during UIKit scene creation, before the Capacitor WebView is ready.
Apple's rejection did not include its own crash attachment; the device report
establishes the cause of the locally reproduced failure.

[Apple's scene migration guidance](https://developer.apple.com/documentation/uikit/transitioning-to-the-uikit-scene-based-life-cycle)
requires scene adoption for apps built with the latest SDK running on iOS 27.
The unchanged app launched on iOS 26.5 simulators, which did not expose this
requirement. Compilation and signature validation alone are insufficient.

## Minimal correction

- Declare one application scene using the existing Main storyboard and
  CAPBridgeViewController. Multiple scenes remain disabled.
- Define SceneDelegate alongside the existing AppDelegate, so it is compiled
  by the existing target without changing project membership or dependencies.
- Retain the scene's window in AppDelegate and preserve audio-session
  reactivation when the scene becomes active.
- Forward cold/warm URL and universal-link events through the existing
  AppDelegate/Capacitor handlers.
- Keep identifiers, supported orientations, minimum OS, microphone description,
  dependencies, privacy patch, musical processing and recordings unchanged.

## Built-artifact regression

After a Release build/archive, run:

```sh
node scripts/verify-ios-startup.cjs /path/to/App.app com.mei-team.mei-trumpet www
```

The verifier checks the actual processed manifest, single-scene setting,
compiled scene delegate and storyboard, microphone description and production
bundle ID. The preserved rejected build fails for its missing scene manifest;
the corrected device and simulator artifacts pass. This complements physical
launch tests; it cannot replace them.

For a separately identified diagnostic app, supply its expected bundle ID as
the second argument. Never install a diagnostic build over a user's working
production installation without permission. A different identifier has a
separate sandbox, permissions and device-identifier scope, so successful
launch is valuable evidence but not identical to testing App Store packaging.

Before resubmission, verify cold Home Screen launch without a debugger,
relaunch, background/resume, microphone permission and basic exercise startup
on current physical iOS. Preserve the rejected archive/report/dSYMs and assign
a verified unused build number. Do not upload/resubmit an unverified artifact.

## Validation on 17 November 2026

- Physical iPhone running iOS 27.2.1: owner reproduced the original diagnostic
  closure, then confirmed cold Home Screen launch and exercise startup after
  the scene fix. A first diagnostic copy used an older ignored native web
  cache; after copying the current production build, the owner also confirmed
  instrument switching/restart and selector backdrop application both work.
  The rejected IPA already contained the newer web bundle: this was a
  diagnostic packaging mistake, not another source regression.
- 32 existing focused note/tempo selector and Home page browser tests passed.
  Production Angular build, application TypeScript and 147 calibration/hash
  validations passed. Corrected simulator Release build/launch passed.
- Built-artifact checker fails on preserved rejected build 4, passes on fixed
  diagnostic, simulator and distribution artifacts, and verifies all 1,891
  current production web files in the final archive/IPA. Run `npx cap copy ios`
  after the production web build before any archive; do not reuse a stale
  ignored native public directory.
- App Store Connect upload history showed 2.0.2 (4) as the latest upload;
  replacement 2.0.2 (5) was archived/exported and locally validated with the
  original production identity and App Store signing profile. The Device
  disk-space patch remains present. No upload/resubmission was performed.
- The production App Store-signed IPA was not installed over the owner's
  working app. Physical checks used the separately identified diagnostic app;
  App Store-specific encryption/thinning remains an Apple-processing check.
- Existing compiler deprecation and CocoaPods script-output warnings remain;
  no new compilation failure. Simulator accessibility duplicate-class warning
  was not the physical-device trap.
