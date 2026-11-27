/**
 * This file is part of the Music Education Interface project.
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnDestroy,
  Output,
  ViewChild
} from '@angular/core';
import { createRenderer } from './renderers';
import {
  AttackVariant,
  Palette,
  StageData,
  StageRenderer,
  levelOf,
  pixelColumns,
  TimeAxis
} from './stage-model';

/** Height of the overview strip shown in playback. */
const OVERVIEW_H = 34;

/**
 * Canvas that draws the scrolling input and the attacks, redrawn on every
 * animation frame outside the Angular zone. In playback it adds an overview
 * of the whole recording; tapping it emits `seek` with the time, in seconds
 * from the start of the recording.
 */
@Component({
  selector: 'app-attack-stage',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<canvas #canvas (pointerdown)="onPointerDown($event)"></canvas>',
  styles: [`
    :host { display: block; position: relative; width: 100%; height: 100%; }
    canvas { display: block; width: 100%; height: 100%; touch-action: pan-y; }
  `]
})
export class AttackStageComponent implements AfterViewInit, OnDestroy {
  @Input() variant: AttackVariant = 'wave';
  /** Called once per frame; null draws nothing. */
  @Input() source: () => StageData | null = () => null;
  @Output() seek = new EventEmitter<number>();

  @ViewChild('canvas', { static: true }) private canvasRef!: ElementRef<HTMLCanvasElement>;

  private readonly renderers = new Map<AttackVariant, StageRenderer>();
  private frameId = 0;
  private palette: Palette | null = null;
  private paletteAge = 0;
  private width = 0;
  private height = 0;
  private overview: { startS: number; endS: number } | null = null;

  constructor(private readonly zone: NgZone, private readonly host: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      const loop = (time: number) => {
        this.frameId = requestAnimationFrame(loop);
        this.render(time);
      };
      this.frameId = requestAnimationFrame(loop);
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frameId);
  }

  onPointerDown(event: PointerEvent): void {
    const overview = this.overview;
    if (!overview) {
      return;
    }
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const y = event.clientY - rect.top;
    if (y < rect.height - OVERVIEW_H - 8) {
      return;
    }
    const f = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    this.seek.emit(f * (overview.endS - overview.startS));
  }

  private render(time: number): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx || !this.resize(canvas)) {
      return;
    }
    if (!this.palette || ++this.paletteAge > 60) {
      this.palette = this.readPalette(ctx);
      this.paletteAge = 0;
    }
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    const data = this.source();
    this.overview = data?.overview ?? null;
    if (!data) {
      return;
    }
    let renderer = this.renderers.get(this.variant);
    if (!renderer) {
      renderer = createRenderer(this.variant);
      this.renderers.set(this.variant, renderer);
    }
    const mainH = data.overview ? this.height - OVERVIEW_H - 8 : this.height;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.width, mainH);
    ctx.clip();
    renderer.draw({ ctx, width: this.width, height: mainH, time, data, palette: this.palette });
    ctx.restore();
    if (data.overview) {
      this.drawOverview(ctx, data, data.overview, mainH + 8);
    }
  }

  private drawOverview(
    ctx: CanvasRenderingContext2D,
    data: StageData,
    range: { startS: number; endS: number },
    top: number
  ): void {
    const palette = this.palette as Palette;
    const W = this.width;
    const H = OVERVIEW_H;
    const duration = Math.max(0.1, range.endS - range.startS);
    const axis = new TimeAxis(range.startS, duration, W, 0);
    const mid = top + H / 2;

    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = palette.text;
    ctx.fillRect(0, top, W, H);
    for (const c of pixelColumns(data.track, axis, W, 2)) {
      const h = Math.max(0.5, levelOf(c.peak) * (H / 2 - 3));
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = palette.noise;
      ctx.fillRect(c.x, mid - h, 1.5, 2 * h);
    }
    for (const a of data.attacks) {
      const x = axis.x(a.onsetS);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = palette.primary;
      ctx.fillRect(x - 1, top, 2, H);
    }
    const head = axis.x(data.nowS);
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = palette.primary;
    ctx.fillRect(0, top, head, H);
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.text;
    ctx.fillRect(head - 1, top - 3, 2, H + 6);
    ctx.restore();
  }

  /** Matches the backing store to the element size. Returns false if hidden. */
  private resize(canvas: HTMLCanvasElement): boolean {
    const rect = this.host.nativeElement.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) {
      return false;
    }
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    this.width = rect.width;
    this.height = rect.height;
    return true;
  }

  private readPalette(ctx: CanvasRenderingContext2D): Palette {
    const style = getComputedStyle(this.host.nativeElement);
    const pick = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
    const text = style.color || '#222222';
    return {
      text: toHex(ctx, text),
      background: toHex(ctx, pick('--ion-background-color', '#ffffff')),
      primary: toHex(ctx, pick('--ion-color-primary', '#3880ff')),
      noise: toHex(ctx, pick('--attack-noise-color', '#9aa0aa')),
      record: toHex(ctx, pick('--ion-color-danger', '#eb445a'))
    };
  }
}

/** Any CSS colour as #rrggbb, so renderers can append an alpha byte. */
function toHex(ctx: CanvasRenderingContext2D, color: string): string {
  ctx.fillStyle = '#000000';
  ctx.fillStyle = color;
  const value = ctx.fillStyle;
  if (value.startsWith('#')) {
    return value;
  }
  const m = value.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (!m) {
    return '#888888';
  }
  return '#' + [m[1], m[2], m[3]].map(v => Number(v).toString(16).padStart(2, '0')).join('');
}
