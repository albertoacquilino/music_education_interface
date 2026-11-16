import { INSTRUMENT_DEFINITIONS, InstrumentRegistryService } from '../instruments/instrument-registry.service';
import { calibratedPlaybackRate } from '../core/music/reference-audio-calibration';
import { ExpressiveDynamicsPlayer, calibrateReferenceDynamics } from './expressive-dynamics';

describe('calibrated reference rendering', () => {
  it('renders real recordings across instruments, registers, tunings, dynamics and durations', async () => {
    const registry = new InstrumentRegistryService();
    const notes = INSTRUMENT_DEFINITIONS.map(i => [i.notes[0], i.notes[Math.floor(i.notes.length / 2)], i.notes[i.notes.length - 1]]).reduce((a, b) => a.concat(b), []);
    notes.push(registry.get('clarinet-bb').notes.find(n => n.displayTokens.includes('A6'))!);
    const capture = (window as any).__karma__?.config.args?.includes('capture-reference');
    for (const [index, note] of notes.entries()) {
      const instrument = INSTRUMENT_DEFINITIONS.find(i => i.notes.includes(note))!;
      const decoder = new OfflineAudioContext(2, 48000, 48000);
      const response = await fetch('/' + note.referenceAudio.path);
      const buffer = await decoder.decodeAudioData(await response.arrayBuffer());
      for (const [setting, a4] of [430, 440, 442, 450].entries()) {
        const target = registry.resolveTarget(instrument.id, note.id, a4);
        const rate = calibratedPlaybackRate(note.id, note.referenceAudio.path, target.expectedSoundingFrequencyHz);
        const dynamic = (['f', 'mf', 'p'] as const)[(index + setting) % 3];
        const duration = setting % 2 ? 4 : 1;
        const context = new OfflineAudioContext(2, 48000 * duration, 48000);
        const player = new ExpressiveDynamicsPlayer();
        if (dynamic === 'f') {
          // Same buffer-source/rate primitive as Howler Web Audio; routing/rate is tested separately.
          const source = context.createBufferSource(), gain = context.createGain();
          source.buffer = buffer; source.playbackRate.value = rate;
          gain.gain.setValueAtTime(1, 0); gain.gain.setValueAtTime(1, duration * .9); gain.gain.linearRampToValueAtTime(0, duration);
          source.connect(gain).connect(context.destination); source.start(); source.stop(duration);
        } else {
          const gains = await calibrateReferenceDynamics(buffer, instrument.id, target.expectedSoundingFrequencyHz, rate);
          player.play(context, context.destination, buffer, instrument.id, target.expectedSoundingFrequencyHz, dynamic, gains[dynamic], rate, duration * 1000);
        }
        const rendered = await context.startRendering();
        expect(rendered.duration).toBe(duration); expect(player.activeVoiceCount).toBe(0);
        expect(rendered.getChannelData(0).some(x => Math.abs(x) > .001)).toBeTrue();
        if (capture) {
          const interleaved = new Float32Array(rendered.length * 2);
          for (let i = 0; i < rendered.length; i++) { interleaved[i * 2] = rendered.getChannelData(0)[i]; interleaved[i * 2 + 1] = rendered.getChannelData(1)[i]; }
          const params = new URLSearchParams({ noteId: note.id, path: note.referenceAudio.path, a4: String(a4), rate: String(rate), duration: String(duration), dynamic, target: String(target.expectedSoundingFrequencyHz) });
          const saved = await fetch('/calibration-capture?' + params, { method: 'POST', body: interleaved.buffer });
          expect(saved.ok).toBeTrue();
        }
      }
    }
  }, 120000);
});
