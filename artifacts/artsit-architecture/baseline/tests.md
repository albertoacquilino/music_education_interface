# Test baseline

## Karma runner repair

The repository's `test:ci` script passes `--watch=false`, but `karma.conf.js` previously selected headless/CI behavior only when `CI=true`. Consequently, the nominal CI script could launch headed Chrome and leave Karma's context iframe installed during shutdown.

With Chrome 150, the iframe's unload handler reported a full-page reload after the only original test had already succeeded. The process nevertheless returned exit 0. A minimal sentinel test with no Angular application code reproduced the same shutdown symptom, and a watch-mode experiment showed that it appeared when the runner was terminated.

The configuration now treats any of the following as CI/non-watch execution:

- `CI=true`;
- `--no-watch`;
- `--watch=false`.

For these runs, `client.clearContext` is enabled so the context iframe is cleared before browser shutdown.

## Authority checks

The repaired command was checked with temporary tests that were deleted after use:

- a deliberately false expectation returned exit 1;
- a deliberate `window.location.reload()` returned exit 1 and reported the reload;
- the real suite returned exit 0.

This proves that the repair suppresses only the shutdown false positive and does not convert genuine failures or reloads into success.

## Characterization suite

The suite contains 35 successful tests:

| Area | Added tests | Behaviors characterized |
|---|---:|---|
| Beat service | 5 | defaults, tempo conversion, measure/beat progression, stop/restart, terminal sequence |
| Sounds service | 2 | metronome and reference-tone reactions to beat events |
| Home activity | 9 | start ordering, phase labels, pitch feedback, capture, persistence, range selection, cleanup |
| Chromatic tuner | 9 | target independence, four-estimate smoothing, thresholds, silence, microphone lifecycle, listener cleanup, global IDs |
| Pitch service | 3 | 140 Hz floor, normalization, silent-buffer behavior |
| Score utilities | 4 | fixed notation defaults, accidentals, dynamics, ignored instrument argument |
| Score component | 2 | rendering target and subscription cleanup |
| Original application test | 1 | application construction |

These are characterization tests: where the current implementation is questionable, the test records it rather than silently redefining it as desirable.
