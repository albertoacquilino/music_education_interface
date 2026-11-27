/**
 * This file is part of the Music Education Interface project.
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */

/**
 * The four views of the Attack tab. Each draws the same data, the scrolling
 * input and the attacks measured on it, with a different emphasis:
 *
 * - `wave`: the waveform, coloured by whether tone or noise dominates, with a
 *   bracket over each attack and its value above it;
 * - `fog`: the harmonic part rising out of the noise, which is what the
 *   measure is about; the value sits where the tone clears the fog;
 * - `ribbon`: a pitch ribbon (height = pitch, thickness = level), each note
 *   labelled at its head;
 * - `spotlight`: the last value in large type over a skyline of bars, one per
 *   attack, as tall as the attack is long.
 */
import { AttackRecord } from '../../../activities/attack-clarity/attack-tracker';
import {
  AppearClock,
  AttackVariant,
  FONT,
  LabelLanes,
  PixelColumn,
  StageFrame,
  StageRenderer,
  axisFor,
  dimFuture,
  drawAttackLens,
  drawPendingDot,
  drawPlayhead,
  drawRecordingSpan,
  drawValuePill,
  easeOutBack,
  easeOutCubic,
  hzOf,
  isTone,
  levelOf,
  measuredAttacks,
  midiOf,
  pendingAttacks,
  pillWidth,
  pixelColumns
} from './stage-model';

function attackEnd(a: AttackRecord): number {
  return a.onsetS + (a.attackMs ?? 0) / 1000;
}

function drawNoteName(frame: StageFrame, a: AttackRecord, x: number, y: number, alpha = 0.6): void {
  const name = frame.data.noteName(a.pitchHz);
  if (name === '—') {
    return;
  }
  const { ctx, palette } = frame;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = palette.text;
  ctx.font = `700 11px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(name, x + 2, y);
  ctx.restore();
}

/* 1. Waveform ------------------------------------------------------------- */

class WaveRenderer implements StageRenderer {
  private readonly clock = new AppearClock();
  private gain = 0.1;

  draw(frame: StageFrame): void {
    const { ctx, width: W, height: H, data, palette, time } = frame;
    const axis = axisFor(data, W);
    const mid = H * 0.7;
    const amp = Math.min(H * 0.22, 110);

    // Baseline.
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = palette.text;
    ctx.fillRect(0, mid - 0.5, W, 1);
    ctx.globalAlpha = 1;

    // Waveform, mirrored, one bar every 2 px coloured tone / noise, with a
    // slow automatic gain so that quiet and loud players both fill the view.
    const columns = pixelColumns(data.track, axis, W, 2);
    const loudest = columns.reduce((m, c) => Math.max(m, c.peak), 0);
    // Floor at -30 dBFS: silence stays flat instead of showing the room noise.
    const target = Math.max(0.03, loudest);
    this.gain += (target - this.gain) * (target > this.gain ? 0.2 : 0.02);
    for (const c of columns) {
      const h = Math.max(0.5, Math.pow(Math.min(1, c.peak / this.gain), 0.8) * amp);
      const analysed = c.harmonic > 0 || c.noise > 0;
      ctx.fillStyle = !analysed ? palette.text : isTone(c) ? palette.primary : palette.noise;
      ctx.globalAlpha = !analysed ? 0.3 : isTone(c) ? 0.95 : 0.6;
      ctx.fillRect(c.x, mid - h, 1.6, 2 * h);
    }
    ctx.globalAlpha = 1;

    // A magnifying lens over each attack, with its value.
    const lensW = Math.min(150, W * 0.26);
    const lensH = Math.min(84, H * 0.18);
    const lanes = new LabelLanes(2);
    for (const a of measuredAttacks(data, axis)) {
      const x0 = axis.x(a.onsetS);
      const p = this.clock.progress(a.onsetS, data.nowS, time, 400);
      const lane = lanes.place(x0 + lensW / 2 - 10, lensW);
      const lensY = mid - amp - 26 - lensH - lane * (lensH + 40);
      const lensX = x0 - 10;
      const e = easeOutBack(p);

      ctx.save();
      ctx.globalAlpha = 0.5 * easeOutCubic(p);
      ctx.strokeStyle = palette.text;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(x0, mid - amp - 4);
      ctx.lineTo(x0, lensY + lensH);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.translate(lensX, lensY + lensH);
      ctx.scale(e, e);
      ctx.translate(-lensX, -(lensY + lensH));
      drawAttackLens(frame, a, lensX, lensY, lensW, lensH, p);
      ctx.restore();
      drawValuePill(ctx, palette, lensX + lensW / 2, lensY - 4, a.attackMs ?? 0, {
        scale: e,
        alpha: a.status === 'updating' ? 0.65 : 1
      });
      drawNoteName(frame, a, x0, mid + amp + 8);
    }
    if (data.live) {
      for (const a of pendingAttacks(data, axis)) {
        drawPendingDot(frame, axis.x(a.onsetS), mid - amp - 10);
      }
    }

    dimFuture(frame, axis);
    drawRecordingSpan(frame, axis);
    drawPlayhead(frame, axis);
  }
}

/* 2. Tone out of the fog -------------------------------------------------- */

class FogRenderer implements StageRenderer {
  private readonly clock = new AppearClock();

  draw(frame: StageFrame): void {
    const { ctx, width: W, height: H, data, palette, time } = frame;
    // Closer view than the others: the attack is a few tens of ms.
    const axis = axisFor(data, W, Math.max(2, Math.min(4, W / 300)));
    const base = H * 0.88;
    const span = H * 0.6;
    const columns = pixelColumns(data.track, axis, W, 2);
    const y = (v: number) => base - levelOf(v) * span;

    // Tone underneath, solid.
    this.area(ctx, columns, c => y(c.pitch > 0 ? c.harmonic : 0), base);
    const tone = ctx.createLinearGradient(0, base - span, 0, base);
    tone.addColorStop(0, palette.primary);
    tone.addColorStop(1, palette.primary + '66');
    ctx.fillStyle = tone;
    ctx.globalAlpha = 0.95;
    ctx.fill();

    // Noise on top, as a fog the tone has to rise through.
    this.area(ctx, columns, c => y(c.noise), base);
    const fog = ctx.createLinearGradient(0, base - span, 0, base);
    fog.addColorStop(0, palette.noise + '55');
    fog.addColorStop(1, palette.noise + 'cc');
    ctx.fillStyle = fog;
    ctx.globalAlpha = 1;
    ctx.fill();
    ctx.strokeStyle = palette.noise;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = palette.text;
    ctx.globalAlpha = 0.2;
    ctx.fillRect(0, base, W, 1);
    ctx.globalAlpha = 1;

    const lanes = new LabelLanes(3);
    for (const a of measuredAttacks(data, axis)) {
      const x0 = axis.x(a.onsetS);
      const x1 = Math.max(x0 + 2, axis.x(attackEnd(a)));
      const p = this.clock.progress(a.onsetS, data.nowS, time, 420);
      const e = easeOutCubic(p);
      const crossY = this.levelAt(columns, x1, y) ?? base - span * 0.5;
      const arrowY = Math.min(crossY, this.levelAt(columns, x0, y) ?? crossY) - 14;

      ctx.save();
      // From the onset to where the tone clears the noise.
      ctx.strokeStyle = palette.text;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x0, base);
      ctx.lineTo(x0, arrowY);
      ctx.stroke();
      ctx.setLineDash([]);
      const xr = x0 + (x1 - x0) * e;
      ctx.beginPath();
      ctx.moveTo(x0, arrowY);
      ctx.lineTo(xr, arrowY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(xr, arrowY);
      ctx.lineTo(xr - 5, arrowY - 3.5);
      ctx.lineTo(xr - 5, arrowY + 3.5);
      ctx.closePath();
      ctx.fillStyle = palette.text;
      ctx.fill();

      // Glow where the tone emerges.
      const glow = ctx.createRadialGradient(x1, crossY, 0, x1, crossY, 16 * e + 1);
      glow.addColorStop(0, palette.primary);
      glow.addColorStop(1, palette.primary + '00');
      ctx.globalAlpha = 0.9 * e;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x1, crossY, 16 * e + 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = palette.background;
      ctx.strokeStyle = palette.primary;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x1, crossY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      const w = pillWidth(ctx, a.attackMs ?? 0);
      const cx = Math.max(x0 + w / 2 - 4, (x0 + x1) / 2);
      const lane = lanes.place(cx, w);
      drawValuePill(ctx, palette, cx, Math.max(30, arrowY - 6 - lane * 30), a.attackMs ?? 0, {
        scale: easeOutBack(p),
        alpha: a.status === 'updating' ? 0.65 : 1
      });
      drawNoteName(frame, a, x0, base + 4);
    }
    if (data.live) {
      for (const a of pendingAttacks(data, axis)) {
        drawPendingDot(frame, axis.x(a.onsetS), base - 8);
      }
    }

    dimFuture(frame, axis);
    drawRecordingSpan(frame, axis);
    drawPlayhead(frame, axis);
  }

  private area(
    ctx: CanvasRenderingContext2D,
    columns: PixelColumn[],
    yOf: (c: PixelColumn) => number,
    base: number
  ): void {
    ctx.beginPath();
    if (!columns.length) {
      return;
    }
    ctx.moveTo(columns[0].x, base);
    for (const c of columns) {
      ctx.lineTo(c.x, yOf(c));
    }
    ctx.lineTo(columns[columns.length - 1].x, base);
    ctx.closePath();
  }

  private levelAt(columns: PixelColumn[], x: number, y: (v: number) => number): number | null {
    let best: PixelColumn | null = null;
    for (const c of columns) {
      if (Math.abs(c.x - x) < 3 && (!best || c.harmonic > best.harmonic)) {
        best = c;
      }
    }
    return best ? y(best.harmonic) : null;
  }
}

/* 3. Pitch ribbon --------------------------------------------------------- */

class RibbonRenderer implements StageRenderer {
  private readonly clock = new AppearClock();
  private lo = 60;
  private hi = 76;

  draw(frame: StageFrame): void {
    const { ctx, width: W, height: H, data, palette, time } = frame;
    const axis = axisFor(data, W);
    const columns = pixelColumns(data.track, axis, W, 1.5);
    const a4 = data.referenceA4Hz;
    this.fitRange(columns, a4);

    const top = 64;
    const bottom = H - 18;
    const y = (midi: number) => top + ((this.hi - midi) / (this.hi - this.lo)) * (bottom - top);

    // Staff-like guides on natural (written) notes.
    ctx.save();
    ctx.font = `700 10px ${FONT}`;
    ctx.textBaseline = 'middle';
    for (let m = Math.ceil(this.lo); m <= Math.floor(this.hi); m += 1) {
      const name = data.noteName(hzOf(m, a4));
      if (name.includes('♯')) {
        continue;
      }
      const yy = y(m);
      ctx.globalAlpha = name.startsWith('C') || name.startsWith('Do') ? 0.2 : 0.08;
      ctx.fillStyle = palette.text;
      ctx.fillRect(0, yy - 0.5, W, 1);
      ctx.globalAlpha = 0.35;
      ctx.fillText(name, 4, yy - 6);
    }
    ctx.restore();

    // The ribbon.
    for (const c of columns) {
      if (c.pitch <= 0) {
        continue;
      }
      const level = levelOf(c.peak);
      if (level < 0.15) {
        continue;
      }
      const thick = 2 + level * 16;
      const yy = y(midiOf(c.pitch, a4));
      ctx.fillStyle = isTone(c) ? palette.primary : palette.noise;
      ctx.globalAlpha = isTone(c) ? 0.9 : 0.55;
      ctx.fillRect(c.x, yy - thick / 2, 2.1, thick);
    }
    ctx.globalAlpha = 1;

    // Each note starts with a bubble as large as its attack is long.
    for (const a of measuredAttacks(data, axis)) {
      if (!a.pitchHz) {
        continue;
      }
      const ms = a.attackMs ?? 0;
      const x0 = axis.x(a.onsetS);
      const yy = y(midiOf(a.pitchHz, a4));
      const p = this.clock.progress(a.onsetS, data.nowS, time, 450);
      const r = Math.max(13, Math.min(40, 8 + ms * 0.4)) * easeOutBack(p);
      ctx.save();
      ctx.globalAlpha = a.status === 'updating' ? 0.6 : 0.95;
      ctx.fillStyle = palette.text;
      ctx.beginPath();
      ctx.arc(x0, yy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = palette.background;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 ${Math.max(11, Math.min(18, r * 0.7))}px ${FONT}`;
      ctx.fillText(Math.round(ms).toString(), x0, yy + 0.5);
      ctx.restore();
      drawNoteName(frame, a, x0 - 8, yy + r + 3, 0.75);
    }
    if (data.live) {
      for (const a of pendingAttacks(data, axis)) {
        drawPendingDot(frame, axis.x(a.onsetS), 52);
      }
    }

    dimFuture(frame, axis);
    drawRecordingSpan(frame, axis);
    drawPlayhead(frame, axis);
  }

  /** Follows the pitches on screen, at least an octave and a bit. */
  private fitRange(columns: PixelColumn[], a4: number): void {
    let min = Infinity;
    let max = -Infinity;
    for (const c of columns) {
      if (c.pitch > 0 && levelOf(c.peak) >= 0.15) {
        const m = midiOf(c.pitch, a4);
        min = Math.min(min, m);
        max = Math.max(max, m);
      }
    }
    if (!Number.isFinite(min)) {
      return;
    }
    let lo = min - 2;
    let hi = max + 3;
    if (hi - lo < 14) {
      const c = (hi + lo) / 2;
      lo = c - 7;
      hi = c + 7;
    }
    this.lo += (lo - this.lo) * 0.06;
    this.hi += (hi - this.hi) * 0.06;
  }
}

/* 4. Spotlight ------------------------------------------------------------ */

/** Narrowest slot, in px, that keeps a value and a note name readable. */
const SPOTLIGHT_MIN_SLOT = 40;
const SPOTLIGHT_MIN_BARS = 6;
const SPOTLIGHT_MAX_BARS = 24;

/** Number of attacks in the history for a stage of this width. */
export function spotlightBars(width: number): number {
  return Math.max(SPOTLIGHT_MIN_BARS, Math.min(SPOTLIGHT_MAX_BARS, Math.floor(width / SPOTLIGHT_MIN_SLOT)));
}

/**
 * The last N attacks at a fixed spacing, newest on the right, whatever the
 * time between them: a pause does not empty the history. Each bar carries
 * its value on top and the written note underneath; the latest value is also
 * shown in large type.
 */
class SpotlightRenderer implements StageRenderer {
  private readonly clock = new AppearClock();
  /** Current x of each bar, keyed by onset, so bars slide when a new one arrives. */
  private readonly xs = new Map<number, number>();
  private shownMs = 0;
  private shownKey = -1;
  private fromMs = 0;
  private changedAt = 0;
  private scaleMs = 100;

  draw(frame: StageFrame): void {
    const { ctx, width: W, height: H, data, palette, time } = frame;
    const n = spotlightBars(W);
    const slot = W / n;
    const readoutSize = Math.min(H * 0.22, W * 0.22, 120);
    const base = H - 30;
    const barTop = H * 0.1 + readoutSize + 56;
    const barSpace = Math.max(40, base - barTop - 22);

    const revealed = data.attacks.filter(a =>
      a.attackMs !== null
        ? attackEnd(a) <= data.nowS + 1e-3
        : a.status === 'not-measured' && a.onsetS <= data.nowS
    );
    const pending = data.live
      ? data.attacks.filter(a => a.status === 'measuring' && a.onsetS <= data.nowS).slice(-1)
      : [];
    const items = [...revealed.slice(-(n - pending.length)), ...pending];

    const measured = items.filter(a => a.attackMs !== null);
    const target = Math.max(100, ...measured.map(a => a.attackMs ?? 0));
    this.scaleMs += (Math.ceil(target / 50) * 50 - this.scaleMs) * 0.08;

    ctx.globalAlpha = 0.2;
    ctx.fillStyle = palette.text;
    ctx.fillRect(0, base, W, 1);
    ctx.globalAlpha = 1;

    const barW = Math.min(30, slot * 0.55);
    const latest = measured[measured.length - 1];
    const keys = new Set<number>();
    items.forEach((a, i) => {
      const key = Math.round(a.onsetS * 1000);
      keys.add(key);
      const targetX = (n - items.length + i + 0.5) * slot;
      const x0 = this.xs.get(key) ?? targetX + slot;
      const x = x0 + (targetX - x0) * 0.18;
      this.xs.set(key, x);
      const p = this.clock.progress(a.onsetS, data.nowS, time, 500);
      const isLatest = a === latest;

      ctx.save();
      ctx.textAlign = 'center';
      if (a.status === 'measuring') {
        drawPendingDot(frame, x, base - 10);
      } else if (a.attackMs === null) {
        // Note heard, attack not measurable.
        ctx.globalAlpha = 0.5 * easeOutCubic(p);
        ctx.strokeStyle = palette.text;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, base - 8, 5, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const ms = a.attackMs;
        const h = Math.max(3, (ms / this.scaleMs) * barSpace * easeOutBack(p));
        const r = Math.min(barW / 2, 6);
        ctx.fillStyle = palette.primary;
        ctx.globalAlpha = isLatest ? 1 : a.status === 'updating' ? 0.45 : 0.6;
        ctx.beginPath();
        ctx.moveTo(x - barW / 2, base);
        ctx.lineTo(x - barW / 2, base - h + r);
        ctx.arcTo(x - barW / 2, base - h, x, base - h, r);
        ctx.arcTo(x + barW / 2, base - h, x + barW / 2, base - h + r, r);
        ctx.lineTo(x + barW / 2, base);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = (isLatest ? 1 : 0.8) * easeOutCubic(p);
        ctx.fillStyle = palette.text;
        ctx.font = `800 ${isLatest ? 15 : 13}px ${FONT}`;
        ctx.textBaseline = 'bottom';
        ctx.fillText(Math.round(ms).toString(), x, base - h - 5);
      }
      const name = data.noteName(a.pitchHz);
      if (name !== '—') {
        ctx.globalAlpha = (isLatest ? 0.95 : 0.65) * easeOutCubic(p);
        ctx.fillStyle = palette.text;
        ctx.font = `700 ${isLatest ? 13 : 12}px ${FONT}`;
        ctx.textBaseline = 'top';
        ctx.fillText(name, x, base + 8);
      }
      ctx.restore();
    });
    for (const key of [...this.xs.keys()]) {
      if (!keys.has(key)) {
        this.xs.delete(key);
      }
    }

    // Big readout of the latest value, counting to its new value.
    if (latest && latest.attackMs !== null) {
      const key = Math.round(latest.onsetS * 1000);
      if (key !== this.shownKey) {
        this.fromMs = this.shownKey < 0 ? latest.attackMs : this.shownMs;
        this.shownKey = key;
        this.changedAt = time;
      }
      const p = Math.min(1, (time - this.changedAt) / 380);
      this.shownMs = this.fromMs + (latest.attackMs - this.fromMs) * easeOutCubic(p);
      const pop = 1 + 0.08 * Math.sin(Math.PI * Math.min(1, p * 1.2));
      ctx.save();
      ctx.translate(W / 2, H * 0.08 + readoutSize);
      ctx.scale(pop, pop);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = palette.primary;
      ctx.font = `800 ${readoutSize}px ${FONT}`;
      const value = Math.round(this.shownMs).toString();
      ctx.fillText(value, 0, 0);
      const vw = ctx.measureText(value).width;
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = palette.text;
      ctx.font = `700 ${readoutSize * 0.25}px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText('ms', vw / 2 + 6, 0);
      const name = data.noteName(latest.pitchHz);
      if (name !== '—') {
        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.7;
        ctx.font = `700 ${Math.max(14, readoutSize * 0.22)}px ${FONT}`;
        ctx.fillText(name, 0, readoutSize * 0.34);
      }
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = palette.text;
      ctx.font = `800 ${readoutSize}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('—', W / 2, H * 0.08 + readoutSize);
      ctx.restore();
    }
  }
}

export function createRenderer(variant: AttackVariant): StageRenderer {
  switch (variant) {
    case 'fog':
      return new FogRenderer();
    case 'ribbon':
      return new RibbonRenderer();
    case 'spotlight':
      return new SpotlightRenderer();
    default:
      return new WaveRenderer();
  }
}
