# Web baseline

## Lint

`npm run lint` completed successfully before and after the characterization changes.

## Production build

`npm run build` completed successfully.

- Build hash: `439d2c44fb48f29c`
- Build timestamp: `2026-07-29T00:08:41.969Z`
- Initial bundle total: 857.99 kB
- Main bundle: 773.65 kB raw
- Lazy Home chunk: 1.09 MB raw
- Generated `www` tree: approximately 43 MB across 1,815 files
- Main output file: `www/main.473f6d4fa7ca4a2a.js`

The build reported 29 skipped CSS-selector warnings. They did not prevent output generation, but should be reduced before presenting a clean release-engineering narrative.

## Runtime assets

The production output contains:

- `pitchlite.wasm`;
- `audio-accumulator.js` (the AudioWorklet processor);
- the Angular application assets and routes.

Source/output checksums for the pitch and worklet assets match. The Firebase configuration rewrites routes to `/index.html`, which supports client-side routing in the deployed web build.
