/**
 * This file is part of the Music Education Interface project.
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */
import { AttackRecord } from '../../../activities/attack-clarity/attack-tracker';
import { COLUMNS_PER_S, WaveformTrack } from '../../../activities/attack-clarity/waveform-track';

/** What the stage draws, read once per animation frame. */
export interface StageData {
  track: WaveformTrack;
  attacks: readonly AttackRecord[];
  /** Stream time under the playhead. */
  nowS: number;
  /** Live input, or playback of a recording. */
  live: boolean;
  /** Playback only: whole recording, drawn as an overview strip. */
  overview: { startS: number; endS: number } | null;
  noteName(pitchHz: number | null): string;
}

export interface Palette {
  text: string;
  background: string;
  primary: string;
  noise: string;
}

export interface StageFrame {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  /** performance.now(), for animations. */
  time: number;
  data: StageData;
  palette: Palette;
}

export interface StageRenderer {
  draw(frame: StageFrame): void;
}

/* Helpers shared by the renderers ---------------------------------------- */

const FLOOR_DB = -60;

/** Amplitude to 0..1 on a -60..0 dBFS scale. */
export function levelOf(amplitude: number): number {
  if (amplitude <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, (20 * Math.log10(amplitude) - FLOOR_DB) / -FLOOR_DB));
}

export class TimeAxis {
  readonly t0: number;
  readonly t1: number;
  private readonly pxPerS: number;
  private readonly headX: number;

  constructor(readonly nowS: number, readonly windowS: number, width: number, headFraction: number) {
    this.pxPerS = width / windowS;
    this.headX = width * headFraction;
    this.t0 = nowS - this.headX / this.pxPerS;
    this.t1 = this.t0 + windowS;
  }

  x(t: number): number {
    return this.headX + (t - this.nowS) * this.pxPerS;
  }

  t(x: number): number {
    return this.nowS + (x - this.headX) / this.pxPerS;
  }

  get headPx(): number {
    return this.headX;
  }

  get scale(): number {
    return this.pxPerS;
  }
}

export interface PixelColumn {
  x: number;
  t: number;
  peak: number;
  harmonic: number;
  noise: number;
  /** Pitch of the column with the strongest harmonic part, 0 if none. */
  pitch: number;
}

/** Aggregates the track into one column every `step` pixels. */
export function pixelColumns(track: WaveformTrack, axis: TimeAxis, width: number, step: number): PixelColumn[] {
  const out: PixelColumn[] = [];
  const startX = Math.max(0, Math.floor(axis.x(track.startS)));
  const endX = Math.min(width, axis.x(track.endS));
  for (let x = startX; x < endX; x += step) {
    const ta = axis.t(x);
    const tb = axis.t(x + step);
    const c0 = Math.floor(ta * COLUMNS_PER_S);
    const c1 = Math.max(c0 + 1, Math.floor(tb * COLUMNS_PER_S));
    let peak = 0;
    let harmonic = 0;
    let noise = 0;
    let pitch = 0;
    let any = false;
    for (let c = c0; c < c1; c += 1) {
      const s = track.slot(c);
      if (s < 0) {
        continue;
      }
      any = true;
      peak = Math.max(peak, track.peak[s]);
      noise = Math.max(noise, track.noise[s]);
      if (track.harmonic[s] >= harmonic) {
        harmonic = track.harmonic[s];
        if (track.pitch[s] > 0) {
          pitch = track.pitch[s];
        }
      }
    }
    if (any) {
      out.push({ x, t: ta, peak, harmonic, noise, pitch });
    }
  }
  return out;
}

/** Remembers when each attack first became visible, for pop-in animations. */
export class AppearClock {
  private readonly seen = new Map<number, number>();
  private lastNow = -Infinity;

  /** Animation progress 0..1 of the attack with this onset. */
  progress(onsetS: number, nowS: number, time: number, durationMs = 320): number {
    if (nowS < this.lastNow - 0.05) {
      this.seen.clear(); // the playhead jumped back
    }
    this.lastNow = nowS;
    const key = Math.round(onsetS * 1000);
    let at = this.seen.get(key);
    if (at === undefined) {
      at = time;
      this.seen.set(key, at);
      if (this.seen.size > 400) {
        const oldest = this.seen.keys().next().value;
        if (oldest !== undefined) {
          this.seen.delete(oldest);
        }
      }
    }
    return Math.max(0, Math.min(1, (time - at) / durationMs));
  }
}

/** Overshooting ease, for things that pop in. */
export function easeOutBack(p: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}

export function easeOutCubic(p: number): number {
  return 1 - Math.pow(1 - p, 3);
}

export const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

/** Pulsing marker of a note whose attack is still being measured. */
export function drawPendingDot(frame: StageFrame, x: number, y: number): void {
  const { ctx, palette, time } = frame;
  const pulse = 0.5 + 0.5 * Math.sin(time / 140);
  ctx.save();
  ctx.fillStyle = palette.primary;
  ctx.globalAlpha = 0.35 + 0.5 * pulse;
  ctx.beginPath();
  ctx.arc(x, y, 3 + 2 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
