import { TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { FluteFingeringComponent } from './flute-fingering.component';
import { FLUTE_CANVAS, FLUTE_VIEWPORTS } from './flute-viewport';

describe('Stable flute fingering frame', () => {
  it('matches every original canvas/crop and aligns keys without editing SVG content', async () => {
    expect(Object.keys(FLUTE_VIEWPORTS).length).toBe(37);
    for (const [name, frame] of Object.entries(FLUTE_VIEWPORTS)) {
      const response = await fetch('/assets/images/flute_positions/' + name);
      expect(response.ok).toBeTrue();
      const svg = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
      const bounds = svg.documentElement.getAttribute('viewBox')!.split(' ').map(Number);
      const matrix = svg.querySelector('[transform]')!.getAttribute('transform')!.slice(7, -1).split(' ').map(Number);
      expect(frame.width).toBe(bounds[2]); expect(frame.height).toBe(bounds[3]);
      expect(frame.x + matrix[4]).toBe(0); expect(frame.y + matrix[5]).toBe(0);
      expect(frame.x).toBeGreaterThanOrEqual(FLUTE_CANVAS.x);
      expect(frame.y).toBeGreaterThanOrEqual(FLUTE_CANVAS.y);
      expect(frame.x + frame.width).toBeLessThanOrEqual(FLUTE_CANVAS.x + FLUTE_CANVAS.width + .001);
      expect(frame.y + frame.height).toBeLessThanOrEqual(FLUTE_CANVAS.y + FLUTE_CANVAS.height + .001);
    }
  });

  for (const width of [320, 1024]) {
    it('keeps the same rendered size for all 37 notes at width ' + width, async () => {
      await TestBed.configureTestingModule({ imports: [IonicModule.forRoot(), FluteFingeringComponent] }).compileComponents();
      const fixture = TestBed.createComponent(FluteFingeringComponent);
      // Ionic hides the unbootstrapped Karma body. Make layout measurable only
      // for this fixture, restoring the runner's state afterwards.
      const display = document.body.style.display;
      document.body.style.display = 'block';
      document.body.appendChild(fixture.nativeElement);
      fixture.nativeElement.style.display = 'block';
      fixture.nativeElement.style.width = width + 'px';
      try {
        let expectedHeight = 0;
        for (const name of Object.keys(FLUTE_VIEWPORTS)) {
          fixture.componentInstance.src = 'assets/images/flute_positions/' + name;
          fixture.componentInstance.alt = name;
          fixture.detectChanges();
          const svg: SVGElement = fixture.nativeElement.querySelector('svg');
          const box = svg.getBoundingClientRect();
          if (!expectedHeight) { expectedHeight = box.height; }
          expect(box.width).toBeCloseTo(width, 0);
          expect(box.height).toBeCloseTo(expectedHeight, 2);
          expect(svg.getAttribute('aria-label')).toBe(name);
          expect(svg.querySelector('image')!.getAttribute('href')).toContain(name);
        }
      } finally {
        document.body.style.display = display;
        fixture.destroy();
      }
    });
  }
});
