/**
 * This file is part of the Music Education Interface project.
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */
import { Injectable, NgZone, isDevMode } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  AttackRecord,
  AttackTracker
} from '../activities/attack-clarity/attack-tracker';
import {
  BackgroundCondition,
  BackgroundMonitor
} from '../activities/attack-clarity/background-monitor';
import { WaveformTrack } from '../activities/attack-clarity/waveform-track';
import { AttackDebug, attackDebugEnabled } from './attack-clarity-debug';

/**
 * Minimal typing of the wasm-bindgen module in assets/attack-clarity, built
 * from attack-clarity-rs (commit a86e8ac) with `web/build.sh`
 * (wasm-pack --target web). To update it, rebuild there and copy
 * `attack_clarity_wasm.js` and `attack_clarity_wasm_bg.wasm` into that folder.
 */
interface StreamAnalyzerHandle {
  process(samples: Float32Array): Float64Array;
  finish(): Float64Array;
  take_envelopes(): Float32Array;
  free(): void;
}

interface AttackClarityModule {
  default(options: { module_or_path: string }): Promise<unknown>;
  StreamAnalyzer: new (sampleRate: number, fmin: number, fmax: number) => StreamAnalyzerHandle;
}

const MODULE_PATH = 'assets/attack-clarity/attack_clarity_wasm.js';
const WASM_PATH = 'assets/attack-clarity/attack_clarity_wasm_bg.wasm';
/** Samples handed to the analyzer at a time (the worklet sends 128). */
const BLOCK_SIZE = 1024;
/** Pitch search range, in Hz, covering the instruments of the app. */
const PITCH_RANGE_HZ: readonly [number, number] = [100, 3000];

/** Seconds of live waveform kept for display. */
const LIVE_HISTORY_S = 12;
/** Longest recording, in seconds. */
export const MAX_RECORDING_S = 30;

export type AttackListenerState = 'idle' | 'starting' | 'listening';

/**
 * - `empty`: nothing recorded;
 * - `recording`: the input is being kept;
 * - `ready`: a recording can be played back;
 * - `playing`: it is being played back (the analyzer is fed silence).
 */
export type RecorderState = 'empty' | 'recording' | 'ready' | 'playing';

/** Up to {@link MAX_RECORDING_S} seconds of input with its waveform and attacks. */
export interface AttackRecording {
  /** Stream time of the first sample. */
  readonly startS: number;
  /** Stream time just after the last sample. */
  endS: number;
  readonly sampleRate: number;
  readonly samples: Float32Array;
  length: number;
  readonly track: WaveformTrack;
  /** Attacks whose onset falls inside the recording, stream times. */
  attacks: AttackRecord[];
  /** Set when listening stops: later events belong to another stream. */
  frozen: boolean;
  buffer: AudioBuffer | null;
}

let modulePromise: Promise<AttackClarityModule> | null = null;

function loadModule(): Promise<AttackClarityModule> {
  if (!modulePromise) {
    const base = document.baseURI;
    const moduleUrl = new URL(MODULE_PATH, base).href;
    const wasmUrl = new URL(WASM_PATH, base).href;
    modulePromise = (import(/* webpackIgnore: true */ moduleUrl) as Promise<AttackClarityModule>)
      .then(async mod => {
        await mod.default({ module_or_path: wasmUrl });
        return mod;
      })
      .catch(error => {
        modulePromise = null;
        throw error;
      });
  }
  return modulePromise;
}

/**
 * Listens to the microphone and measures the attack of each note with the
 * streaming attack-clarity analyzer.
 */
@Injectable({ providedIn: 'root' })
export class AttackClarityService {
  readonly state$ = new BehaviorSubject<AttackListenerState>('idle');
  readonly attacks$ = new BehaviorSubject<readonly AttackRecord[]>([]);
  /** Input peak level, 0..1 on a -60..0 dBFS scale. */
  readonly level$ = new BehaviorSubject<number>(0);
  /** Whether the background lets new notes be detected. */
  readonly background$ = new BehaviorSubject<BackgroundCondition>('normal');
  /** True while the audio context waits for a user gesture (iOS). */
  readonly suspended$ = new BehaviorSubject<boolean>(false);
  readonly recorder$ = new BehaviorSubject<RecorderState>('empty');

  private readonly tracker = new AttackTracker();
  private readonly monitor = new BackgroundMonitor();
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private worklet: AudioWorkletNode | null = null;
  private sink: GainNode | null = null;
  private analyzer: StreamAnalyzerHandle | null = null;
  private block = new Float32Array(BLOCK_SIZE);
  private blockFill = 0;
  private blockPeak = 0;
  private levelPeak = 0;
  private levelBlocks = 0;
  private startToken = 0;
  private debug: AttackDebug | null = null;
  private sampleCount = 0;
  private silence = new Float32Array(128);
  private live: WaveformTrack | null = null;
  private take: AttackRecording | null = null;
  private playback: { source: AudioBufferSourceNode; startedAt: number; offset: number } | null = null;

  constructor(private readonly zone: NgZone) {}

  async start(): Promise<void> {
    if (this.state$.value !== 'idle') {
      return;
    }
    const token = ++this.startToken;
    this.state$.next('starting');
    try {
      // Created before any await so that it inherits the user gesture (iOS).
      const context = new AudioContext({ latencyHint: 'interactive' });
      this.context = context;
      context.addEventListener('statechange', () => {
        if (this.context === context) {
          this.zone.run(() => this.suspended$.next(context.state === 'suspended'));
        }
      });
      // Not awaited: without a user gesture the promise may never settle.
      void context.resume().catch(() => undefined);
      const mod = await loadModule();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // The analysis needs the raw sound, breath and tongue noise included.
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1
        }
      });
      if (token !== this.startToken) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      this.stream = stream;

      await context.audioWorklet.addModule('assets/audio-accumulator.js');
      if (token !== this.startToken) {
        return;
      }

      this.analyzer = new mod.StreamAnalyzer(
        context.sampleRate,
        PITCH_RANGE_HZ[0],
        PITCH_RANGE_HZ[1]
      );
      this.blockFill = 0;
      this.blockPeak = 0;
      this.sampleCount = 0;
      this.live = new WaveformTrack(context.sampleRate, LIVE_HISTORY_S);
      this.monitor.reset();
      this.background$.next('normal');

      this.worklet = new AudioWorkletNode(context, 'audio-accumulator', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2] // the worklet copies both input channels
      });
      // Audio blocks arrive ~375 times per second: keep them out of change detection.
      this.zone.runOutsideAngular(() => {
        if (this.worklet) {
          this.worklet.port.onmessage = event => this.onSamples(event.data.data as Float32Array);
        }
      });
      this.source = context.createMediaStreamSource(stream);
      this.sink = context.createGain();
      this.sink.gain.value = 0;
      this.source.connect(this.worklet);
      this.worklet.connect(this.sink);
      this.sink.connect(context.destination);

      if (attackDebugEnabled(isDevMode())) {
        this.debug = new AttackDebug(() => this.context, () => this.stream, this.monitor);
        this.debug.start(context.sampleRate);
      }
      this.suspended$.next(context.state === 'suspended');
      this.state$.next('listening');
    } catch (error) {
      if (token === this.startToken) {
        this.teardown();
        this.state$.next('idle');
      }
      throw error;
    }
  }

  stop(): void {
    this.startToken += 1;
    this.stopPlaybackSource();
    if (this.recorder$.value === 'recording') {
      this.finishRecording();
    } else if (this.recorder$.value === 'playing') {
      this.recorder$.next('ready');
    }
    if (this.analyzer) {
      if (this.blockFill > 0) {
        this.feed(this.block.subarray(0, this.blockFill));
      }
      this.publish(this.analyzer.finish());
    }
    if (this.take) {
      this.take.frozen = true;
    }
    this.debug?.stop();
    this.debug = null;
    this.teardown();
    this.state$.next('idle');
  }

  clear(): void {
    this.tracker.clear();
    this.attacks$.next(this.tracker.attacks);
  }

  /** Resumes an audio context left suspended for lack of a user gesture. */
  resumeAudio(): void {
    void this.context?.resume().catch(() => undefined);
  }

  /** Live waveform, null when not listening. */
  get liveTrack(): WaveformTrack | null {
    return this.live;
  }

  /** Stream time, in seconds, of the latest sample received. */
  get nowS(): number {
    return this.context ? this.sampleCount / this.context.sampleRate : 0;
  }

  get recording(): AttackRecording | null {
    return this.take;
  }

  startRecording(): void {
    const context = this.context;
    if (!context || this.state$.value !== 'listening' || this.recorder$.value === 'recording') {
      return;
    }
    this.stopPlaybackSource();
    const sampleRate = context.sampleRate;
    const startS = this.sampleCount / sampleRate;
    this.take = {
      startS,
      endS: startS,
      sampleRate,
      samples: new Float32Array(Math.ceil(MAX_RECORDING_S * sampleRate)),
      length: 0,
      track: new WaveformTrack(sampleRate, MAX_RECORDING_S + 0.1, 'linear'),
      attacks: [],
      frozen: false,
      buffer: null
    };
    this.recorder$.next('recording');
  }

  stopRecording(): void {
    if (this.recorder$.value === 'recording') {
      this.finishRecording();
    }
  }

  discardRecording(): void {
    this.stopPlaybackSource();
    this.take = null;
    this.recorder$.next('empty');
  }

  /** Plays the recording from `fromS` seconds after its start. */
  play(fromS = 0): void {
    const take = this.take;
    const context = this.context;
    if (!take || !context || !take.length || this.recorder$.value === 'recording') {
      return;
    }
    this.stopPlaybackSource();
    if (!take.buffer || take.buffer.sampleRate !== take.sampleRate) {
      take.buffer = context.createBuffer(1, take.length, take.sampleRate);
      take.buffer.copyToChannel(take.samples.subarray(0, take.length), 0);
    }
    const duration = take.length / take.sampleRate;
    const offset = Math.max(0, Math.min(fromS, duration - 0.01));
    const source = context.createBufferSource();
    source.buffer = take.buffer;
    source.connect(context.destination);
    source.onended = () => {
      if (this.playback?.source === source) {
        this.zone.run(() => {
          this.stopPlaybackSource();
          this.recorder$.next('ready');
        });
      }
    };
    void context.resume().catch(() => undefined);
    source.start(0, offset);
    this.playback = { source, startedAt: context.currentTime, offset };
    this.recorder$.next('playing');
  }

  stopPlayback(): void {
    if (this.recorder$.value === 'playing') {
      this.stopPlaybackSource();
      this.recorder$.next('ready');
    }
  }

  /** Seconds from the start of the recording to the sound being played. */
  get playbackPositionS(): number {
    const take = this.take;
    if (!this.playback || !this.context || !take) {
      return 0;
    }
    const position = this.playback.offset + this.context.currentTime - this.playback.startedAt;
    return Math.max(0, Math.min(take.length / take.sampleRate, position));
  }

  private finishRecording(): void {
    const take = this.take;
    if (take) {
      take.endS = take.startS + take.length / take.sampleRate;
      take.buffer = null;
      this.syncRecordingAttacks();
    }
    this.recorder$.next(take && take.length ? 'ready' : 'empty');
    if (take && !take.length) {
      this.take = null;
    }
  }

  private stopPlaybackSource(): void {
    const playback = this.playback;
    this.playback = null;
    if (playback) {
      playback.source.onended = null;
      try {
        playback.source.stop();
      } catch {
        // Already stopped.
      }
      playback.source.disconnect();
    }
  }

  /** Copies into the recording the attacks whose onset falls inside it. */
  private syncRecordingAttacks(): void {
    const take = this.take;
    if (!take || take.frozen) {
      return;
    }
    const endS = this.recorder$.value === 'recording' ? Infinity : take.endS;
    const all = this.tracker.attacks;
    for (let i = all.length - 1; i >= 0 && all[i].onsetS >= take.startS - 1e-6; i -= 1) {
      const record = all[i];
      if (record.onsetS >= endS) {
        continue;
      }
      const at = take.attacks.findIndex(a => Math.abs(a.onsetS - record.onsetS) < 1e-6);
      if (at >= 0) {
        take.attacks[at] = record;
      } else {
        take.attacks.push(record);
      }
    }
    take.attacks.sort((a, b) => a.onsetS - b.onsetS);
  }

  private onSamples(samples: Float32Array): void {
    if (!this.analyzer) {
      return;
    }
    this.debug?.onMessage(samples);
    const first = this.sampleCount;
    this.sampleCount += samples.length;
    if (this.playback) {
      // The speaker plays the recording: keep the clock running on silence
      // so the analyzer does not measure the playback.
      if (this.silence.length !== samples.length) {
        this.silence = new Float32Array(samples.length);
      }
      samples = this.silence;
    }
    this.live?.addSamples(samples, first);
    if (this.recorder$.value === 'recording') {
      this.record(samples, first);
    }
    let offset = 0;
    while (offset < samples.length) {
      const n = Math.min(samples.length - offset, BLOCK_SIZE - this.blockFill);
      for (let i = 0; i < n; i += 1) {
        const v = samples[offset + i];
        this.block[this.blockFill + i] = v;
        const a = v < 0 ? -v : v;
        if (a > this.blockPeak) {
          this.blockPeak = a;
        }
      }
      this.blockFill += n;
      offset += n;
      if (this.blockFill === BLOCK_SIZE) {
        this.feed(this.block);
        this.blockFill = 0;
      }
    }
  }

  private record(samples: Float32Array, first: number): void {
    const take = this.take;
    if (!take) {
      return;
    }
    const room = take.samples.length - take.length;
    const n = Math.min(room, samples.length);
    take.samples.set(n === samples.length ? samples : samples.subarray(0, n), take.length);
    take.length += n;
    take.track.addSamples(samples.subarray(0, n), first);
    if (n < samples.length || take.length >= take.samples.length) {
      this.zone.run(() => this.finishRecording());
    }
  }

  private feed(samples: Float32Array): void {
    if (!this.analyzer) {
      return;
    }
    let events: Float64Array;
    let frames: Float32Array;
    const t0 = performance.now();
    try {
      events = this.analyzer.process(samples);
      frames = this.analyzer.take_envelopes();
    } catch (error) {
      if (this.debug) {
        this.debug.onError(error);
      } else {
        console.error('Attack analyzer failed', error);
      }
      return;
    }
    this.debug?.onProcessed(performance.now() - t0);
    this.debug?.onEnvelopes(frames);
    this.tracker.addEnvelopes(frames);
    this.live?.addEnvelopes(frames);
    if (this.take && !this.take.frozen) {
      this.take.track.addEnvelopes(frames);
    }
    if (this.monitor.addEnvelopes(frames)) {
      const condition = this.monitor.condition;
      this.debug?.note(`background ${condition}`);
      this.zone.run(() => this.background$.next(condition));
    }
    this.publish(events);

    // Level meter refreshed about 12 times per second.
    this.levelPeak = Math.max(this.levelPeak, this.blockPeak);
    this.blockPeak = 0;
    this.levelBlocks += 1;
    if (this.levelBlocks >= 4) {
      const db = this.levelPeak > 0 ? 20 * Math.log10(this.levelPeak) : -Infinity;
      const level = Math.max(0, Math.min(1, (db + 60) / 60));
      this.levelPeak = 0;
      this.levelBlocks = 0;
      this.zone.run(() => this.level$.next(level));
    }
  }

  private publish(events: Float64Array): void {
    if (events.length) {
      this.debug?.onEvents(events);
    }
    if (events.length && this.tracker.applyEvents(events)) {
      this.syncRecordingAttacks();
      this.zone.run(() => this.attacks$.next(this.tracker.attacks));
    }
  }

  private teardown(): void {
    if (this.worklet) {
      this.worklet.port.onmessage = null;
      this.worklet.disconnect();
    }
    this.source?.disconnect();
    this.sink?.disconnect();
    this.stream?.getTracks().forEach(track => track.stop());
    if (this.context && this.context.state !== 'closed') {
      void this.context.close();
    }
    this.analyzer?.free();
    this.worklet = null;
    this.source = null;
    this.sink = null;
    this.stream = null;
    this.context = null;
    this.analyzer = null;
    this.live = null;
    this.blockFill = 0;
    this.blockPeak = 0;
    this.levelPeak = 0;
    this.levelBlocks = 0;
    this.level$.next(0);
    this.background$.next('normal');
    this.suspended$.next(false);
  }
}
