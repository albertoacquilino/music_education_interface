// Recreated local-only comparison server. Read-only production asset access.
const http = require('http');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(
  fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }
).outputText, filename);
const notes = ['trumpet-bb', 'clarinet-bb', 'oboe-c', 'flute-c'].flatMap(id => {
  const definition = Object.values(require(path.join(root,
    'src/app/instruments/definitions', id + '.instrument.ts')))[0];
  return [0, Math.floor(definition.notes.length / 2), definition.notes.length - 1].map(index => {
    const note = definition.notes[index];
    return { instrument: id, token: note.displayTokens[0],
      hz: note.referenceAudio.recordedSoundingFrequencyHz, path: note.referenceAudio.path };
  });
});
const modules = new Map([
  ['/expressive.js', 'src/app/services/expressive-dynamics.ts'],
  ['/dynamics-profiles.js', 'src/app/core/music/dynamics-profiles.ts']
].map(([url, filename]) => [url, ts.transpileModule(fs.readFileSync(path.join(root, filename), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2020 }
}).outputText.replaceAll('../core/music/dynamics-profiles', '/dynamics-profiles.js')]));
for (const note of notes) {
  if (!fs.existsSync(path.join(root, 'src', note.path))) { throw new Error('Missing ' + note.path); }
}
if (process.argv.includes('--check')) {
  const profiles = require(path.join(root, 'src/app/core/music/dynamics-profiles.ts'));
  if (notes.length !== 12 || profiles.DYNAMICS_LEVELS.f !== 1) { throw new Error('Invalid configuration'); }
  console.log('Verified 12 source recordings, 4 instruments and mobile-first profile modules.');
  process.exit(0);
}
http.createServer((req, res) => {
  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(fs.readFileSync(path.join(__dirname, 'dynamics-comparison.html')));
  }
  if (req.url === '/notes.json') {
    res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(notes));
  }
  if (req.url === '/comparison-profiles.js') {
    res.setHeader('Content-Type', 'text/javascript');
    return res.end(fs.readFileSync(path.join(__dirname, 'dynamics-comparison-profiles.js')));
  }
  if (modules.has(req.url)) {
    res.setHeader('Content-Type', 'text/javascript'); return res.end(modules.get(req.url));
  }
  const asset = notes.find(note => '/' + note.path === req.url);
  if (asset) {
    res.setHeader('Content-Type', 'audio/mp4');
    const stream = fs.createReadStream(path.join(root, 'src', asset.path));
    stream.on('error', () => { res.statusCode = 500; res.end('Asset unavailable'); });
    return stream.pipe(res);
  }
  res.statusCode = 404; res.end('Not found');
}).listen(4210, '127.0.0.1', () => console.log('Listening comparisons: http://127.0.0.1:4210'));
