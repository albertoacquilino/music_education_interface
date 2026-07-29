# iOS baseline

## Configuration

- Bundle identifier: `com.mei-team.mei-trumpet`
- Minimum iOS version: 13
- Microphone usage description: present
- Version observed in the isolated build: 2.0.1 (build 3)

The version/build values came from a pre-existing, uncommitted owner change and were not introduced by this task.

The iOS bundle identifier differs from Android's `com.meiteam.trumpet`. This may be intentional, but the publication and release documentation should either explain the distinction or align the identifiers.

Eight Capacitor plugins were discovered during synchronization, matching the Android set.

## Build result

An unsigned Debug build for the iPhone simulator completed successfully with Xcode:

- result: `** BUILD SUCCEEDED **`;
- application bundle size: approximately 49 MB;
- executable SHA-256: `71f27caf0b7b0e63775fdeef9ca7974436fcd5f024a1c6c20bc6bc612ff2950c`.

The application bundle contains the web index, `pitchlite.wasm`, and `audio-accumulator.js`.

## Simulator result

The application installed and launched successfully on an iPhone 17 Pro simulator running iOS 26.5. Visual inspection showed the Exercise route, instrument practice interface, Start control, and tab navigation.

This verifies compilation, packaging, installation, launch, and initial rendering. It does not verify:

- microphone capture;
- audible reference tones or metronome output;
- complete prepare–listen–play execution;
- physical-device timing or permissions;
- signing or store release.

## Warnings

- The splash storyboard reports three unassigned children.
- the Pods framework-embedding script has no output declarations and runs on every build;
- Xcode emitted a non-blocking App Intents metadata warning.
