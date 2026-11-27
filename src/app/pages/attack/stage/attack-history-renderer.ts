/**
 * This file is part of the Music Education Interface project.
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */
import { AttackRecord } from '../../../activities/attack-clarity/attack-tracker';
import {
  AppearClock,
  FONT,
  StageFrame,
  StageRenderer,
  drawPendingDot,
  easeOutBack,
  easeOutCubic
} from './stage-model';

function attackEnd(a: AttackRecord): number {
  return a.onsetS + (a.attackMs ?? 0) / 1000;
}

/** Narrowest slot, in px, that keeps a value and a note name readable. */
const HISTORY_MIN_SLOT = 40;
const HISTORY_MIN_BARS = 6;
const HISTORY_MAX_BARS = 24;

/** Number of attacks in the history for a stage of this width. */
export function historyBars(width: number): number {
  return Math.max(HISTORY_MIN_BARS, Math.min(HISTORY_MAX_BARS, Math.floor(width / HISTORY_MIN_SLOT)));
}

/**
 * The last N attacks at a fixed spacing, newest on the right, whatever the
 * time between them: a pause does not empty the history. Each bar carries
 * its value on top and the written note underneath; the latest value is also
 * shown in large type.
 */
export class AttackHistoryRenderer implements StageRenderer {
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
    const n = historyBars(W);
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
