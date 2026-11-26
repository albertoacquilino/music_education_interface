/**
 * This file is part of the Music Education Interface project.
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */
import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  AttackRecord,
  AttackTracker
} from '../activities/attack-clarity/attack-tracker';

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

export type AttackListenerState = 'idle' | 'starting' | 'listening';

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

  private readonly tracker = new AttackTracker();
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
    if (this.analyzer) {
      if (this.blockFill > 0) {
        this.feed(this.block.subarray(0, this.blockFill));
      }
      this.publish(this.analyzer.finish());
    }
    this.teardown();
    this.state$.next('idle');
  }

  clear(): void {
    this.tracker.clear();
    this.attacks$.next(this.tracker.attacks);
  }

  private onSamples(samples: Float32Array): void {
    if (!this.analyzer) {
      return;
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

  private feed(samples: Float32Array): void {
    if (!this.analyzer) {
      return;
    }
    const events = this.analyzer.process(samples);
    this.tracker.addEnvelopes(this.analyzer.take_envelopes());
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
    if (events.length && this.tracker.applyEvents(events)) {
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
    this.blockFill = 0;
    this.blockPeak = 0;
    this.levelPeak = 0;
    this.levelBlocks = 0;
    this.level$.next(0);
  }
}
