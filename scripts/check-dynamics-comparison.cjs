const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function compile(filename) {
  return ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
}
const production = { exports: {} };
vm.runInNewContext(compile(path.join(root, 'src/app/core/music/dynamics-profiles.ts')), {
  exports: production.exports, module: production
});
const comparison = { exports: {} };
vm.runInNewContext(compile(path.join(__dirname, 'dynamics-comparison-profiles.js')), {
  exports: comparison.exports, module: comparison, require: name => {
    assert.equal(name, '/dynamics-profiles.js'); return production.exports;
  }
});
const {settings, ORIGINAL} = comparison.exports;
const depths = {
  'trumpet-bb': [-3,-7], 'clarinet-bb': [-2,-5],
  'oboe-c': [-2.5,-6], 'flute-c': [-1.5,-4]
};
for (const id of Object.keys(depths)) {
  for (const hz of [147, 247, 440, 1000, 2020]) {
    for (const [index, dynamic] of ['mf','p'].entries()) {
      const a=settings('A',id,hz,dynamic),b=settings('B',id,hz,dynamic),c=settings('C',id,hz,dynamic);
      assert.equal(a.gain,index===0?.4:.15);
      assert.equal(a.gainDb,depths[id][index]);
      assert.equal(a.frequencyHz,Math.min(19200,Math.max(ORIGINAL[id].floorHz, hz*ORIGINAL[id].harmonic)));
      const real=production.exports.dynamicsShelf(id,hz,dynamic,48000);
      assert.equal(b.gain,10**((dynamic==='mf'?-3.5:-7.5)/20));
      assert.equal(b.frequencyHz,a.frequencyHz);
      assert.equal(b.gainDb,a.gainDb*.5*Math.min(1,Math.max(.65,hz/440)));
      assert(Math.abs(c.gainDb-(a.gainDb+b.gainDb)/2)<1e-12);
      assert(Math.abs(c.gainDb-real.gainDb)<1e-12);
      assert.equal(c.targetDb,index===0?-6:-12);
    }
    for (const profile of ['A','B','C'])assert.equal(settings(profile,id,hz,'f').gain,1);
  }
}
console.log('Passed: A original fixture; B mobile-first fixture; C matches production EQ and targets; all forte bypasses.');
