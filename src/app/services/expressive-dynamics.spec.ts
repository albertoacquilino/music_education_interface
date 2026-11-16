import { calibratedPlaybackRate } from '../core/music/reference-audio-calibration';
import { frequencyForMidi } from '../core/music/pitch-math';
import { ExpressiveDynamicsPlayer, calibrateReferenceDynamics } from './expressive-dynamics';
import { calibrationRms, compensatedDynamicsGain, dynamicsShelf, DYNAMICS_LEVELS } from '../core/music/dynamics-profiles';
import { InstrumentRegistryService } from '../instruments/instrument-registry.service';

describe('production Profile C', () => {
  const registry = new InstrumentRegistryService();
  const oldDepths = {
    'trumpet-bb': [-3, -7], 'clarinet-bb': [-2, -5],
    'oboe-c': [-2.5, -6], 'flute-c': [-1.5, -4]
  };

  it('contains only C targets and the exact tested C curves', () => {
    expect(DYNAMICS_LEVELS.f).toBe(1);
    expect(20 * Math.log10(DYNAMICS_LEVELS.mf)).toBeCloseTo(-6, 10);
    expect(20 * Math.log10(DYNAMICS_LEVELS.p)).toBeCloseTo(-12, 10);
    for (const id of Object.keys(oldDepths) as (keyof typeof oldDepths)[]) {
      for (const hz of [147, 247, 440, 1000, 2020]) {
        for (const [i, dynamic] of (['mf', 'p'] as const).entries()) {
          const a = oldDepths[id][i];
          const b = a * .5 * Math.min(1, Math.max(.65, hz / 440));
          expect(dynamicsShelf(id, hz, dynamic, 48000).gainDb).toBeCloseTo((a + b) / 2, 12);
        }
      }
    }
  });

  it('matches the independent comparison C graph, compensation and output levels', async () => {
    for (const id of Object.keys(oldDepths) as (keyof typeof oldDepths)[]) {
      const instrument = registry.get(id);
      for (const index of [0, Math.floor(instrument.notes.length / 2), instrument.notes.length - 1]) {
        const note = instrument.notes[index];
        const response = await fetch('/' + note.referenceAudio.path);
        expect(response.ok).toBeTrue();
        const decoder = new OfflineAudioContext(2, 96000, 48000);
        const buffer = await decoder.decodeAudioData(await response.arrayBuffer());
        for (const reference of index === instrument.notes.length - 1 ? [430, 440, 450] : [440]) {
          const hz = frequencyForMidi(note.soundingMidiAtA4_440, reference);
          const rate = calibratedPlaybackRate(note.id, note.referenceAudio.path, hz);
          const gains = await calibrateReferenceDynamics(buffer, id, hz, rate);
          for (const [i, dynamic] of (['mf', 'p'] as const).entries()) {
            // Independently reproduce the already-tested comparison curve/envelope.
            const context = new OfflineAudioContext(2, 96000, 48000);
            const source = context.createBufferSource(), shelf = context.createBiquadFilter(), gain = context.createGain();
            source.buffer = buffer; source.playbackRate.value = rate;
            shelf.type = 'highshelf'; shelf.frequency.value = dynamicsShelf(id, hz, dynamic, 48000).frequencyHz;
            const a = oldDepths[id][i], b = a * .5 * Math.min(1, Math.max(.65, hz / 440));
            shelf.gain.value = (a + b) / 2;
            gain.gain.setValueAtTime(0, 0); gain.gain.linearRampToValueAtTime(1, .005);
            gain.gain.setValueAtTime(1, 1.8); gain.gain.linearRampToValueAtTime(0, 2);
            source.connect(shelf).connect(gain).connect(context.destination);
            source.start(); source.stop(2);
            const filtered = await context.startRendering();
            const baseline = new OfflineAudioContext(2, 96000, 48000), dry = baseline.createBufferSource();
            dry.buffer = buffer; dry.playbackRate.value = rate;
            dry.connect(baseline.destination); dry.start(); dry.stop(2);
            const dryRms = calibrationRms(await baseline.startRendering());
            const expected = dryRms * 10 ** ((dynamic === 'mf' ? -6 : -12) / 20) / calibrationRms(filtered);
            expect(gains[dynamic]).toBeCloseTo(expected, 6);
            const output = new OfflineAudioContext(2, 96000, 48000), player = new ExpressiveDynamicsPlayer();
            player.play(output, output.destination, buffer, id, hz, dynamic, gains[dynamic], rate, 2000);
            const rendered = await output.startRendering();
            expect(20 * Math.log10(calibrationRms(rendered) / dryRms)).toBeCloseTo(dynamic === 'mf' ? -6 : -12, 4);
            expect(rendered.length).toBe(96000);
            expect(player.activeVoiceCount).toBe(0);
            const peak = rendered.getChannelData(0).reduce((p, x) => Math.max(p, Math.abs(x)), 0);
            expect(peak).toBeGreaterThan(0); expect(peak).toBeLessThan(1);
          }
        }
      }
    }
  }, 30000);

  it('rejects silent calibration rather than creating NaN or amplification', () => {
    expect(() => compensatedDynamicsGain(0, 0, 'p')).toThrow();
    expect(() => compensatedDynamicsGain(1, .01, 'mf')).toThrow();
  });

  it('fades and cleans up at the rate-adjusted natural end even for long requests', async () => {
    for (const durationMs of [1000, 1333, 6000]) {
      const context = new OfflineAudioContext(1, 48000, 48000);
      const buffer = context.createBuffer(1, 24000, 48000);
      for (let i = 0; i < buffer.length; i++) { buffer.getChannelData(0)[i] = .2 * Math.sin(2 * Math.PI * 440 * i / 48000); }
      const player = new ExpressiveDynamicsPlayer(), rate = 1.1;
      player.play(context, context.destination, buffer, 'flute-c', 484, 'p', .25, rate, durationMs);
      const output = await context.startRendering();
      expect(output.getChannelData(0).slice(Math.ceil(24000 / rate) + 2).every(x => x === 0)).toBeTrue();
      expect(player.activeVoiceCount).toBe(0);
    }
  });

  it('preserves synthetic pitch and release timing with independent overlapping voices', async () => {
    const context = new OfflineAudioContext(1, 48000, 48000);
    const buffer = context.createBuffer(1, 48000, 48000), data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) { data[i] = .3 * Math.sin(2 * Math.PI * 500 * i / 48000); }
    const player = new ExpressiveDynamicsPlayer();
    player.play(context, context.destination, buffer, 'flute-c', 500, 'mf', .5, 1, 900);
    const rendered = await context.startRendering();
    const samples = rendered.getChannelData(0);
    let crossings = 0;
    for (let i = 12001; i < 36000; i++) { if (samples[i - 1] < 0 && samples[i] >= 0) { crossings++; } }
    expect(crossings).toBeGreaterThanOrEqual(249); expect(crossings).toBeLessThanOrEqual(251);
    expect(samples.slice(43201).every(x => x === 0)).toBeTrue();
    expect(player.activeVoiceCount).toBe(0);
    const suspended = new OfflineAudioContext(1, 48000, 48000);
    const first = player.play(suspended, suspended.destination, buffer, 'flute-c', 500, 'p', .25, 1, 900);
    player.play(suspended, suspended.destination, buffer, 'oboe-c', 500, 'mf', .5, 1, 900);
    expect(player.activeVoiceCount).toBe(2);
    first.stop(5); first.stop(); player.stopAll(); player.stopAll();
    expect(player.activeVoiceCount).toBe(0);
    await suspended.startRendering();
  });
});
