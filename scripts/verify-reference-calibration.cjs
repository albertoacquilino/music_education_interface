const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,f);
const source=fs.readFileSync(path.join(root,'docs/reference-calibration/audited-manifest.json'));
const manifest=JSON.parse(source),approvals=JSON.parse(fs.readFileSync(path.join(root,'docs/reference-calibration/listening-approvals.json')));
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');assert.equal(hash(source),approvals.manifest_sha256);
assert.equal(approvals.source_commit,manifest.source_commit);
const {REFERENCE_CALIBRATIONS:data}=require(path.join(root,'src/app/core/music/reference-audio-calibration-data.ts'));
const {calibratedPlaybackRate}=require(path.join(root,'src/app/core/music/reference-audio-calibration.ts'));
const pitch=require(path.join(root,'src/app/core/music/pitch-math.ts'));
const notes=['trumpet-bb','clarinet-bb','oboe-c','flute-c'].flatMap(id=>Object.values(require(path.join(root,'src/app/instruments/definitions/'+id+'.instrument.ts')))[0].notes);
const held=manifest.recordings.filter(e=>e.status==='requires_human_listening');
assert.equal(held.length,13);assert.equal(approvals.decisions.length,13);assert.equal(new Set(approvals.decisions.map(d=>d.note_id)).size,13);
for(const e of held){const d=approvals.decisions.find(d=>d.note_id===e.note_id);assert(d);assert.equal(d.decision,'approve_recommended');assert.equal(d.recommended_frequency_hz,e.recommended_candidate_frequency_hz);assert.equal(d.asset_path,e.asset_path);assert.equal(d.source_sha256,e.source_sha256);assert.equal(d.manifest_sha256,approvals.manifest_sha256);assert.equal(d.source_commit,manifest.source_commit);}
assert.equal(notes.length,147);assert.equal(new Set(notes.map(n=>n.referenceAudio.path)).size,147);assert.equal(Object.keys(data).length,147);assert.equal(manifest.recordings.length,147);assert.equal(new Set(manifest.recordings.map(e=>e.note_id)).size,147);
let aliases=0;
for(const n of notes){const e=manifest.recordings.find(e=>e.note_id===n.id),c=data[n.id];assert(e&&c);assert.equal(c.path,n.referenceAudio.path);assert.equal(c.sourceSha256,e.source_sha256);assert.equal(hash(fs.readFileSync(path.join(root,'src',c.path))),c.sourceSha256);assert.equal(c.measuredWholeSustainFrequencyHz,e.measured_whole_sustain_frequency_hz);assert.equal(c.calibrationReferenceFrequencyHz,e.recommended_candidate_frequency_hz);assert(c.calibrationReferenceFrequencyHz>0);assert.deepEqual(n.displayTokens,e.aliases);assert.equal(n.writtenMidi,e.written_midi);assert.equal(n.soundingMidiAtA4_440,e.sounding_midi);
 for(const alias of n.displayTokens){assert.equal(pitch.spelledPitchToMidi(pitch.parseAppPitchToken(alias)),n.writtenMidi);aliases++;}
 for(const a4 of [430,440,442,450]){const target=pitch.frequencyForMidi(n.soundingMidiAtA4_440,a4);assert(Math.abs(calibratedPlaybackRate(n.id,c.path,target)*c.calibrationReferenceFrequencyHz-target)<1e-9);}}
console.log(`Verified 147 exact mappings/hashes, ${aliases} aliases, 588 tuning cases and 13 exact human approvals; no unresolved deployed entries.`);

const approved=JSON.parse(fs.readFileSync(path.join(root,'docs/reference-calibration/approved-manifest.json')));
assert.equal(approved.recordings.length,147);assert.equal(approved.unresolved_entries,0);assert.equal(approved.ready_entries,147);
for(const e of approved.recordings){assert.equal(e.calibration_reference_frequency_hz,data[e.note_id].calibrationReferenceFrequencyHz);assert.equal(e.unresolved_reasons.length,0);assert(e.status.startsWith('approved_'));}
