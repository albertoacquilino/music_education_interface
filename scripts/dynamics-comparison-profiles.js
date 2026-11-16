// Comparison-only settings. Never imported by production application code.
import { dynamicsShelf, DYNAMICS_LEVEL_DB } from '/dynamics-profiles.js';
export const ORIGINAL = {
  'trumpet-bb': { harmonic:3, floorHz:1000, mfDb:-3, pDb:-7 },
  'clarinet-bb': { harmonic:4, floorHz:1200, mfDb:-2, pDb:-5 },
  'oboe-c': { harmonic:4, floorHz:1600, mfDb:-2.5, pDb:-6 },
  'flute-c': { harmonic:2.5, floorHz:900, mfDb:-1.5, pDb:-4 }
};
export function settings(profile, instrument, hz, dynamic) {
  if(dynamic==='f')return {gain:1,frequencyHz:0,gainDb:0};
  const old=ORIGINAL[instrument];
  const a={frequencyHz:Math.min(19200,Math.max(old.floorHz,hz*old.harmonic)),
    gainDb:dynamic==='mf'?old.mfDb:old.pDb};
  // Frozen B reference; production now contains C only.
  const depth=Math.min(1,Math.max(.65,hz/440));
  const b={frequencyHz:a.frequencyHz,gainDb:a.gainDb*.5*depth};
  if(profile==='A')return {...a,gain:dynamic==='mf'?.4:.15};
  if(profile==='B')return {...b,gain:10**((dynamic==='mf'?-3.5:-7.5)/20)};
  if(profile==='C')return {...dynamicsShelf(instrument,hz,dynamic,48000),
    gain:1,targetDb:DYNAMICS_LEVEL_DB[dynamic]};
  throw Error('Unknown comparison profile');
}
export async function renderClip(buffer, note, profile, dynamic) {
  const s=settings(profile,note.instrument,note.hz,dynamic);
  const ctx=new OfflineAudioContext(2,96000,48000),source=ctx.createBufferSource(),gain=ctx.createGain();
  source.buffer=buffer;
  if(dynamic==='f')source.connect(gain);
  else{
    const eq=ctx.createBiquadFilter();eq.type='highshelf';eq.frequency.value=s.frequencyHz;eq.gain.value=s.gainDb;
    source.connect(eq).connect(gain);
  }
  const level=s.gain;
  gain.gain.setValueAtTime(dynamic==='f'?level:0,0);
  if(dynamic!=='f')gain.gain.linearRampToValueAtTime(level,.005);
  gain.gain.setValueAtTime(level,1.8);gain.gain.linearRampToValueAtTime(0,2);
  gain.connect(ctx.destination);source.start();source.stop(2);
  return {buffer:await ctx.startRendering(),settings:s};
}
