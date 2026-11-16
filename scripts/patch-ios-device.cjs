// Narrow iOS-only source patch. Do not relax hashes when upgrading: review upstream first.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'node_modules/@capacitor/device');
const records = require('../patches/capacitor-device-6.0.1-ios.json');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
if (JSON.parse(fs.readFileSync(path.join(dir, 'package.json'))).version !== '6.0.1') {
  throw new Error('Unsupported Device version: review the iOS privacy patch before upgrading.');
}
const states = records.map(r => hash(path.join(dir, r.path)));
if (states.every((s, i) => s === records[i].patched)) {
  console.log('Device iOS privacy patch verified (already applied).');
} else {
  if (!states.every((s, i) => s === records[i].original)) {
    throw new Error('Unexpected Device iOS source: refusing to patch modified or partially patched files.');
  }
  const args = ['--directory=node_modules/@capacitor/device', '-'];
  const options = { cwd: root, stdio: ['pipe', 'inherit', 'inherit'],
    input: fs.readFileSync(path.join(root, 'patches/capacitor-device-6.0.1-ios.patch'), 'utf8')
      .replace(/\r\n/g, '\n') };
  execFileSync('git', ['apply', '--check', ...args], options);
  execFileSync('git', ['apply', ...args], options);
  if (!records.every(r => hash(path.join(dir, r.path)) === r.patched)) {
    throw new Error('Device privacy patch output verification failed.');
  }
  console.log('Applied Device 6.0.1 iOS privacy patch.');
}
