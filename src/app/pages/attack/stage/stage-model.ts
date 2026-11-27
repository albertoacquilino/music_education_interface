/**
 * This file is part of the Music Education Interface project.
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */
import { AttackRecord } from '../../../activities/attack-clarity/attack-tracker';
import { COLUMNS_PER_S, WaveformTrack } from '../../../activities/attack-clarity/waveform-track';

export type AttackVariant = 'wave' | 'fog' | 'ribbon' | 'spotlight';

/** What the stage draws, read once per animation frame. */
export interface StageData {
  track: WaveformTrack;
  attacks: readonly AttackRecord[];
  /** Stream time under the playhead. */
  nowS: number;
  /** Live input (playhead at the right edge) or playback (playhead centred). */
  live: boolean;
  /** Live only: stream time at which the ongoing recording started. */
  recordFromS: number | null;
  /** Playback only: whole recording, drawn as an overview strip. */
  overview: { startS: number; endS: number } | null;
  noteName(pitchHz: number | null): string;
  referenceA4Hz: number;
}

export interface Palette {
  text: string;
  background: string;
  primary: string;
  noise: string;
  record: string;
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

/** Live window: about 120 px per second, between 3 and 8 s. */
export function windowFor(width: number): number {
  return Math.max(3, Math.min(8, width / 120));
}

export function axisFor(data: StageData, width: number, windowS = windowFor(width)): TimeAxis {
  return new TimeAxis(data.nowS, windowS, width, data.live ? 0.9 : 0.5);
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

/** True when the tone dominates the noise in that column. */
export function isTone(column: PixelColumn): boolean {
  return column.pitch > 0 && column.harmonic > column.noise;
}

/** Attacks with a value whose end has been reached by the playhead. */
export function measuredAttacks(data: StageData, axis: TimeAxis): AttackRecord[] {
  return data.attacks.filter(a =>
    a.attackMs !== null
    && a.onsetS + a.attackMs / 1000 <= data.nowS + 1e-3
    && a.onsetS + a.attackMs / 1000 >= axis.t0 - 1
    && a.onsetS <= axis.t1
  );
}

/** Attacks still being measured (live) or not yet revealed (playback). */
export function pendingAttacks(data: StageData, axis: TimeAxis): AttackRecord[] {
  return data.attacks.filter(a =>
    a.onsetS <= data.nowS
    && a.onsetS >= axis.t0
    && (a.status === 'measuring' || (a.attackMs !== null && a.onsetS + a.attackMs / 1000 > data.nowS))
  );
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

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

/**
 * Draws a "42 ms" pill centred on `cx` with its bottom at `bottom`. Returns
 * its width.
 */
export function drawValuePill(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  cx: number,
  bottom: number,
  ms: number,
  options: { scale?: number; alpha?: number; size?: number } = {}
): number {
  const scale = options.scale ?? 1;
  const size = options.size ?? 15;
  const value = Math.round(ms).toString();
  ctx.save();
  ctx.globalAlpha *= options.alpha ?? 1;
  ctx.font = `800 ${size}px ${FONT}`;
  const valueW = ctx.measureText(value).width;
  ctx.font = `600 ${size * 0.68}px ${FONT}`;
  const unitW = ctx.measureText(' ms').width;
  const w = valueW + unitW + 16;
  const h = size + 10;
  ctx.translate(cx, bottom);
  ctx.scale(scale, scale);
  roundRect(ctx, -w / 2, -h, w, h, h / 2);
  ctx.fillStyle = palette.text;
  ctx.fill();
  ctx.fillStyle = palette.background;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.fillText(value, -w / 2 + 8, -h / 2 + 0.5);
  ctx.font = `600 ${size * 0.68}px ${FONT}`;
  ctx.fillText(' ms', -w / 2 + 8 + valueW, -h / 2 + 1);
  ctx.restore();
  return w;
}

/** Assigns labels to stacked lanes so that they do not overlap. */
export class LabelLanes {
  private readonly right: number[];

  constructor(lanes: number) {
    this.right = new Array(lanes).fill(-Infinity);
  }

  place(cx: number, width: number): number {
    for (let lane = 0; lane < this.right.length; lane += 1) {
      if (cx - width / 2 > this.right[lane] + 4) {
        this.right[lane] = cx + width / 2;
        return lane;
      }
    }
    this.right[0] = cx + width / 2;
    return 0;
  }
}

export function pillWidth(ctx: CanvasRenderingContext2D, ms: number, size = 15): number {
  ctx.save();
  ctx.font = `800 ${size}px ${FONT}`;
  const v = ctx.measureText(Math.round(ms).toString()).width;
  ctx.font = `600 ${size * 0.68}px ${FONT}`;
  const u = ctx.measureText(' ms').width;
  ctx.restore();
  return v + u + 16;
}

export function drawPlayhead(frame: StageFrame, axis: TimeAxis, top = 0, bottom = frame.height): void {
  const { ctx, palette, data, time } = frame;
  const x = axis.headPx;
  ctx.save();
  if (data.live) {
    const pulse = 0.5 + 0.5 * Math.sin(time / 260);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = palette.text;
    ctx.fillRect(x - 0.5, top, 1, bottom - top);
    ctx.globalAlpha = 0.5 + 0.5 * pulse;
    ctx.fillStyle = data.recordFromS !== null ? palette.record : palette.primary;
    ctx.beginPath();
    ctx.arc(x, top + 8, 4 + pulse, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = palette.text;
    ctx.fillRect(x - 1, top, 2, bottom - top);
    ctx.beginPath();
    ctx.moveTo(x - 6, top);
    ctx.lineTo(x + 6, top);
    ctx.lineTo(x, top + 8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Thin red line over the part of the live view being recorded. */
export function drawRecordingSpan(frame: StageFrame, axis: TimeAxis, y = 2): void {
  const { ctx, palette, data } = frame;
  if (data.recordFromS === null) {
    return;
  }
  const x0 = Math.max(0, axis.x(data.recordFromS));
  ctx.save();
  ctx.fillStyle = palette.record;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(x0, y, axis.headPx - x0, 3);
  ctx.restore();
}

/** Dims what lies ahead of the playhead in playback. */
export function dimFuture(frame: StageFrame, axis: TimeAxis): void {
  if (frame.data.live) {
    return;
  }
  const { ctx, palette, width, height } = frame;
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = palette.background;
  ctx.fillRect(axis.headPx + 1, 0, width - axis.headPx, height);
  ctx.restore();
}

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

export function midiOf(hz: number, a4: number): number {
  return 69 + 12 * Math.log2(hz / a4);
}

export function hzOf(midi: number, a4: number): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Magnified view of the start of a note: noise (grey) and harmonic part
 * (colour) over the first ~150 ms, the attack shaded up to the instant the
 * harmonic part clears the noise. Drawn in the box (x, y, w, h).
 */
export function drawAttackLens(
  frame: StageFrame,
  a: { onsetS: number; attackMs: number | null },
  x: number,
  y: number,
  w: number,
  h: number,
  progress: number
): void {
  const { ctx, palette, data } = frame;
  const track = data.track;
  const tNd = (a.attackMs ?? 0) / 1000;
  const pre = 0.02;
  const span = Math.max(0.15, tNd * 2.5) + pre;
  const t0 = a.onsetS - pre;
  const xOf = (t: number) => x + ((t - t0) / span) * w;
  const inner = h - 6;
  const yOf = (v: number) => y + h - 3 - levelOf(v) * inner;

  ctx.save();
  roundRect(ctx, x, y, w, h, 8);
  ctx.fillStyle = palette.background;
  ctx.globalAlpha = 0.92;
  ctx.fill();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = palette.text;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.clip();

  // Attack span.
  const xa = xOf(a.onsetS);
  const xb = xOf(a.onsetS + tNd * easeOutCubic(progress));
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = palette.primary;
  ctx.fillRect(xa, y, xb - xa, h);

  const c0 = Math.floor(t0 * 200);
  const c1 = Math.ceil((t0 + span) * 200);
  const series = (pick: (s: number) => number) => {
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    for (let c = c0; c <= c1; c += 1) {
      const s = track.slot(c);
      const v = s < 0 ? 0 : pick(s);
      ctx.lineTo(xOf((c + 0.5) / 200), yOf(v));
    }
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
  };
  series(s => track.harmonic[s]);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = palette.primary;
  ctx.fill();
  series(s => track.noise[s]);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = palette.noise;
  ctx.fill();

  ctx.globalAlpha = 0.9;
  ctx.fillStyle = palette.text;
  ctx.fillRect(xa - 0.5, y, 1, h);
  ctx.fillRect(xb - 1, y, 2, h);
  ctx.restore();
}
