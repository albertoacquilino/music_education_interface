#!/usr/bin/env node
// Check the built app, not just source settings: archive success alone missed
// the missing scene manifest that traps at launch on iOS 27.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const app = process.argv[2];
if (!app) throw new Error('Usage: node scripts/verify-ios-startup.cjs <App.app> [expected-bundle-id] [production-web-directory]');
const expectedId = process.argv[3] || 'com.mei-team.mei-trumpet';
const info = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', path.join(app, 'Info.plist')], { encoding: 'utf8' }));
assert.equal(info.CFBundleIdentifier, expectedId, 'Unexpected application identity');
const manifest = info.UIApplicationSceneManifest;
assert.ok(manifest, 'Missing scene lifecycle manifest: iOS 27 will reject legacy startup');
assert.equal(manifest.UIApplicationSupportsMultipleScenes, false, 'Keep the single-window architecture');
const scenes = manifest.UISceneConfigurations?.UIWindowSceneSessionRoleApplication;
assert.equal(scenes?.length, 1, 'Expected one application scene configuration');
const scene = scenes[0];
const [moduleName, className, extra] = scene.UISceneDelegateClassName.split('.');
assert.ok(moduleName && className && !extra, 'Scene delegate must name its compiled module and class');
assert.equal(scene.UISceneStoryboardFile, 'Main', 'Keep the Capacitor Main storyboard');
assert.ok(fs.existsSync(path.join(app, 'Base.lproj', 'Main.storyboardc')), 'Compiled Main storyboard missing');
const strings = execFileSync('strings', [path.join(app, info.CFBundleExecutable)], { encoding: 'utf8' }).split('\n');
assert.ok(strings.includes(`_TtC${moduleName.length}${moduleName}${className.length}${className}`), 'Configured scene delegate missing from executable');
assert.ok(info.NSMicrophoneUsageDescription?.trim(), 'Microphone permission description missing');
console.log(`Verified scene startup packaging, compiled delegate/storyboard and microphone description: ${info.CFBundleIdentifier}`);

// A cached native public/ directory can silently omit already-fixed web behavior.
const web = process.argv[4];
if (web) {
    let checked = 0;
    const verify = (directory, relative = '') => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const name = path.join(relative, entry.name);
            if (entry.isDirectory()) verify(path.join(directory, entry.name), name);
            else if (entry.isFile()) {
                const bundled = path.join(app, 'public', name);
                assert.ok(fs.existsSync(bundled), `Missing packaged web file: ${name}`);
                assert.deepEqual(fs.readFileSync(bundled), fs.readFileSync(path.join(directory, entry.name)), `Stale packaged web file: ${name}`);
                checked++;
            }
        }
    };
    verify(web);
    console.log(`Verified ${checked} production web files against the packaged app`);
}
