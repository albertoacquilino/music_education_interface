/**
 * This file is part of the Music Education Interface project.
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */

/**
 * Diagnostics for the attack listener. Enabled in dev builds or with
 * `localStorage.attackDebug = '1'`. Logs with the `[attack]` prefix and
 * exposes `window.__attackDebug`.
 *
 * Besides the analyzer events it logs, once per second, the microphone and
 * audio context state and the note tracker thresholds estimated by
 * BackgroundMonitor, so a note that never ends, or a background that rose
 * above the thresholds, can be told apart from a crash or a stalled
 * microphone. The raw input is kept in memory and can be saved with
 * `__attackDebug.downloadWav()`.
 */
import { BackgroundMonitor } from '../activities/attack-clarity/background-monitor';

const ENVELOPE_FIELDS = 5;
/** Maximum recorded audio, in seconds. */
const MAX_RECORD_S = 300;

export function attackDebugEnabled(devMode: boolean): boolean {
  try {
    const flag = localStorage.getItem('attackDebug');
    return flag === null ? devMode : flag === '1';
  } catch {
    return devMode;
  }
}

const db = (v: number) => (v > 0 ? (20 * Math.log10(v)).toFixed(1) : '-inf');

export class AttackDebug {
  private startedAt = performance.now();
  private sampleRate = 48000;
  private messages = 0;
  private samples = 0;
  private blocks = 0;
  private errors = 0;
  private processMsMax = 0;
  private processMsTotal = 0;
  private secPeak = 0;
  private secSumSq = 0;
  private secCount = 0;
  private lastMessageAt = performance.now();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastEnvT = 0;
  private framesThisSec = 0;
  private envMinThisSec = Infinity;
  private envMaxThisSec = 0;
  private pitchedThisSec = 0;

  private record: Float32Array[] = [];
  private recordLength = 0;
  readonly log: string[] = [];

  constructor(
    private readonly getContext: () => AudioContext | null,
    private readonly getStream: () => MediaStream | null,
    private readonly monitor: BackgroundMonitor
  ) {}

  start(sampleRate: number): void {
    this.sampleRate = sampleRate;
    this.startedAt = performance.now();
    this.write(`start sampleRate=${sampleRate} baseLatency=${this.getContext()?.baseLatency}`);
    const context = this.getContext();
    if (context) {
      context.onstatechange = () => this.write(`audioContext state=${context.state}`);
    }
    const track = this.getStream()?.getAudioTracks()[0];
    if (track) {
      this.write(`track label="${track.label}" settings=${JSON.stringify(track.getSettings())}`);
      track.onmute = () => this.write('track MUTED');
      track.onunmute = () => this.write('track unmuted');
      track.onended = () => this.write('track ENDED');
    }
    this.timer = setInterval(() => this.stat(), 1000);
    (window as unknown as { __attackDebug: AttackDebug }).__attackDebug = this;
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.stat();
    this.write('stop');
  }

  onMessage(samples: Float32Array): void {
    this.messages += 1;
    this.samples += samples.length;
    this.lastMessageAt = performance.now();
    for (let i = 0; i < samples.length; i += 1) {
      const v = samples[i];
      const a = v < 0 ? -v : v;
      if (a > this.secPeak) {
        this.secPeak = a;
      }
      this.secSumSq += v * v;
    }
    this.secCount += samples.length;
    if (this.recordLength < MAX_RECORD_S * this.sampleRate) {
      this.record.push(samples.slice());
      this.recordLength += samples.length;
    }
  }

  onProcessed(ms: number): void {
    this.blocks += 1;
    this.processMsTotal += ms;
    this.processMsMax = Math.max(this.processMsMax, ms);
  }

  onError(error: unknown): void {
    this.errors += 1;
    if (this.errors <= 5 || this.errors % 100 === 0) {
      const e = error as Error;
      this.write(`ERROR #${this.errors} ${e?.name}: ${e?.message}\n${e?.stack ?? ''}`, 'error');
    }
  }

  onEvents(events: ArrayLike<number>): void {
    for (let i = 0; i + 5 <= events.length; i += 5) {
      const [kind, onset, a, b, c] = [events[i], events[i + 1], events[i + 2], events[i + 3], events[i + 4]];
      if (kind === 0) {
        this.write(`event ONSET onset=${onset.toFixed(3)}`);
      } else if (kind === 1) {
        this.write(`event T_ND onset=${onset.toFixed(3)} t_nd=${(a * 1000).toFixed(0)}ms rule=${b ? 'peak' : 'level'}`);
      } else if (kind === 2) {
        this.write(`event END onset=${onset.toFixed(3)} end=${a.toFixed(3)} ducked=${!!b} analysed=${c.toFixed(2)}s`);
      } else {
        this.write(`event UNKNOWN ${Array.from(events).slice(i, i + 5).join(',')}`);
      }
    }
  }

  onEnvelopes(frames: ArrayLike<number>): void {
    for (let i = 0; i + ENVELOPE_FIELDS <= frames.length; i += ENVELOPE_FIELDS) {
      const t = frames[i];
      const level = Math.max(0, frames[i + 1]);
      const pitch = frames[i + 4];
      this.lastEnvT = t;
      this.framesThisSec += 1;
      this.envMinThisSec = Math.min(this.envMinThisSec, level);
      this.envMaxThisSec = Math.max(this.envMaxThisSec, level);
      if (pitch > 0) {
        this.pitchedThisSec += 1;
      }
    }
  }

  note(line: string): void {
    this.write(line);
  }

  /** Estimated note tracker thresholds. */
  thresholds(): Record<string, string> {
    return {
      background: db(this.monitor.background),
      onsetAbove: db(this.monitor.onsetThreshold),
      actualNoise: db(this.monitor.actualNoise),
      missed: String(this.monitor.missedFrames),
      condition: this.monitor.condition
    };
  }

  /** Recorded input as a 16-bit mono WAV, downloaded by the browser. */
  downloadWav(name = 'attack-debug.wav'): void {
    const n = this.recordLength;
    const buffer = new ArrayBuffer(44 + 2 * n);
    const view = new DataView(buffer);
    const text = (o: number, s: string) => [...s].forEach((ch, k) => view.setUint8(o + k, ch.charCodeAt(0)));
    text(0, 'RIFF');
    view.setUint32(4, 36 + 2 * n, true);
    text(8, 'WAVE');
    text(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, this.sampleRate, true);
    view.setUint32(28, this.sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    text(36, 'data');
    view.setUint32(40, 2 * n, true);
    let o = 44;
    for (const chunk of this.record) {
      for (let i = 0; i < chunk.length; i += 1) {
        view.setInt16(o, Math.max(-32768, Math.min(32767, Math.round(chunk[i] * 32767))), true);
        o += 2;
      }
    }
    const url = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  private stat(): void {
    const now = performance.now();
    const track = this.getStream()?.getAudioTracks()[0];
    const rms = this.secCount ? Math.sqrt(this.secSumSq / this.secCount) : 0;
    const streamS = this.samples / this.sampleRate;
    const wallS = (now - this.startedAt) / 1000;
    this.write(
      `stat wall=${wallS.toFixed(1)}s stream=${streamS.toFixed(1)}s env=${this.lastEnvT.toFixed(1)}s`
      + ` msgs=${this.messages} blocks=${this.blocks} errors=${this.errors}`
      + ` proc(avg/max)=${(this.processMsTotal / Math.max(1, this.blocks)).toFixed(2)}/${this.processMsMax.toFixed(1)}ms`
      + ` sinceMsg=${(now - this.lastMessageAt).toFixed(0)}ms`
      + ` ctx=${this.getContext()?.state} track=${track?.readyState}${track?.muted ? '/muted' : ''}`
      + ` | input peak=${db(this.secPeak)} rms=${db(rms)} dBFS`
      + ` | env frames=${this.framesThisSec} min=${db(this.envMinThisSec)} max=${db(this.envMaxThisSec)} pitched=${this.pitchedThisSec}`
      + ` | noteOpen=${this.monitor.noteOpen} ${JSON.stringify(this.thresholds())}`
    );
    this.secPeak = 0;
    this.secSumSq = 0;
    this.secCount = 0;
    this.processMsMax = 0;
    this.framesThisSec = 0;
    this.envMinThisSec = Infinity;
    this.envMaxThisSec = 0;
    this.pitchedThisSec = 0;
  }

  private write(line: string, level: 'log' | 'error' = 'log'): void {
    const stamped = `[attack] +${((performance.now() - this.startedAt) / 1000).toFixed(2)}s ${line}`;
    this.log.push(stamped);
    if (this.log.length > 5000) {
      this.log.splice(0, 1000);
    }
    console[level](stamped);
  }
}
