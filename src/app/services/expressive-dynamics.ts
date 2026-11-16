import { AudioPlayback } from '../core/activity/activity-context';
import { InstrumentId } from '../instruments/instrument-definition';
import { dynamicsShelf, SoftDynamic, calibrationRms, compensatedDynamicsGain } from '../core/music/dynamics-profiles';
export { dynamicsShelf, DYNAMICS_PROFILES } from '../core/music/dynamics-profiles';

/** Fresh per-reference nodes; only the caller-supplied destination is connected. */
export class ExpressiveDynamicsPlayer {
  private readonly voices = new Set<AudioPlayback>();
  get activeVoiceCount(): number { return this.voices.size; }

  play(context: BaseAudioContext, destination: AudioNode, buffer: AudioBuffer,
       instrument: InstrumentId, soundingHz: number, dynamic: SoftDynamic,
       gain: number, rate: number, durationMs: number): AudioPlayback {
    const source = context.createBufferSource(), shelf = context.createBiquadFilter();
    const envelope = context.createGain();
    const settings = dynamicsShelf(instrument, soundingHz, dynamic, context.sampleRate);
    source.buffer = buffer; source.playbackRate.value = rate;
    shelf.type = 'highshelf'; shelf.frequency.value = settings.frequencyHz; shelf.gain.value = settings.gainDb;
    const start = context.currentTime, duration = Math.min(durationMs / 1000, buffer.duration / rate);
    const end = start + duration, attack = Math.min(.005, duration / 4);
    const fade = Math.min(Math.max(durationMs / 10000, .1), duration / 2);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(gain, start + attack);
    envelope.gain.setValueAtTime(gain, end - fade);
    envelope.gain.linearRampToValueAtTime(0, end);
    source.connect(shelf); shelf.connect(envelope); envelope.connect(destination);
    let stopped = false;
    const cleanup = () => {
      stopped = true; source.disconnect(); shelf.disconnect(); envelope.disconnect();
      source.onended = null; this.voices.delete(playback);
    };
    const playback: AudioPlayback = {
      stop: (fadeMs = 0) => {
        if (stopped) { return; }
        stopped = true;
        const now = context.currentTime;
        const level = gain * Math.max(0, Math.min(1, (now - start) / attack, (end - now) / fade));
        const stopAt = Math.min(end, now + Math.max(0, fadeMs) / 1000);
        envelope.gain.cancelScheduledValues(now); envelope.gain.setValueAtTime(level, now);
        envelope.gain.linearRampToValueAtTime(0, stopAt); source.stop(stopAt);
        if (context.state === 'suspended') { cleanup(); }
      }
    };
    source.onended = cleanup; this.voices.add(playback); source.start(start); source.stop(end);
    return playback;
  }
  stopAll(): void { [...this.voices].forEach(voice => voice.stop(5)); }
}

/** Preload-time calibration; no rendering/decoding is performed on exercise beats. */
export async function calibrateReferenceDynamics(buffer: AudioBuffer, instrument: InstrumentId,
    soundingHz: number, rate: number): Promise<Record<SoftDynamic, number>> {
  const original = new OfflineAudioContext(2, 96000, 48000);
  const source = original.createBufferSource();
  source.buffer = buffer; source.playbackRate.value = rate;
  source.connect(original.destination); source.start(); source.stop(2);
  const baseline = calibrationRms(await original.startRendering());
  const result = {} as Record<SoftDynamic, number>;
  for (const dynamic of ['mf', 'p'] as const) {
    const context = new OfflineAudioContext(2, 96000, 48000);
    new ExpressiveDynamicsPlayer().play(context, context.destination, buffer,
      instrument, soundingHz, dynamic, 1, rate, 2000);
    result[dynamic] = compensatedDynamicsGain(baseline,
      calibrationRms(await context.startRendering()), dynamic);
  }
  return result;
}
