import { TestBed } from '@angular/core/testing';
import { scoreFromNote } from 'src/app/utils/score.utils';
import { ScoreViewComponent } from './score.component';

describe('ScoreViewComponent instance and lifecycle behavior', () => {
  let previousBodyDisplay: string;

  beforeEach(async () => {
    // Ionic hides the document until hydration. These standalone fixtures need layout.
    previousBodyDisplay = document.body.style.display;
    document.body.style.display = 'block';
    await TestBed.configureTestingModule({
      imports: [ScoreViewComponent]
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    document.body.style.display = previousBodyDisplay;
  });

  const waitForLayout = () => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  const createScore = async (width = 350, height = 200) => {
    const fixture = TestBed.createComponent(ScoreViewComponent);
    Object.assign(fixture.nativeElement.style, {
      width: `${width}px`, height: `${height}px`
    });
    fixture.componentInstance.score = scoreFromNote('C4', 'trumpet');
    fixture.detectChanges();
    await waitForLayout();
    fixture.detectChanges();
    await waitForLayout();
    return fixture;
  };

  for (const [width, height] of [[280, 160], [215, 136], [650, 330], [720, 500]]) {
    it(`fits all dynamic markings and the score in a ${width} × ${height} panel`, async () => {
      const fixture = await createScore(width, height);
      const label: HTMLElement = fixture.nativeElement.querySelector('.score-note-name');

      for (const [dynamic, note] of [['p', 'B3'], ['mf', 'F5s'], ['f', 'B6']]) {
        fixture.componentInstance.score = scoreFromNote(note, 'flute', dynamic);
        fixture.detectChanges();
        const svg: SVGSVGElement = fixture.nativeElement.querySelector('svg');
        const marking = Array.from(svg.querySelectorAll('text')).find(text => text.textContent?.trim() === dynamic);
        expect(marking).withContext(dynamic).toBeDefined();
        expect(marking?.getBBox().height).toBeGreaterThan(0);

        const viewBox = svg.viewBox.baseVal;
        const bounds = svg.getBBox();
        expect(bounds.x).toBeGreaterThanOrEqual(viewBox.x);
        expect(bounds.y).toBeGreaterThanOrEqual(viewBox.y);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewBox.x + viewBox.width);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewBox.y + viewBox.height);
        expect(svg.getBoundingClientRect().bottom).toBeLessThanOrEqual(label.getBoundingClientRect().top);
      }

      fixture.componentInstance.score = scoreFromNote('B6', 'flute');
      expect(fixture.nativeElement.querySelectorAll('svg text').length).toBe(0);
    });
  }

  it('renders two instances into independent local surfaces', async () => {
    const first = await createScore();
    const second = await createScore();
    second.componentInstance.score = scoreFromNote('D4', 'trumpet');

    expect(first.nativeElement.querySelectorAll('svg').length).toBe(1);
    expect(second.nativeElement.querySelectorAll('svg').length).toBe(1);
    expect(document.querySelectorAll('#score').length).toBe(0);

    first.destroy();
    second.destroy();
  });

  it('unsubscribes rendering updates when destroyed', async () => {
    const fixture = await createScore();
    const updateSpy = spyOn(fixture.componentInstance, 'updateScore').and.callThrough();

    fixture.destroy();
    fixture.componentInstance.score = scoreFromNote('E4', 'trumpet');

    expect(updateSpy).not.toHaveBeenCalled();
  });
});
