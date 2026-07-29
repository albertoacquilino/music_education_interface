import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Score } from 'src/app/models/score.types';
import { scoreFromNote } from 'src/app/utils/score.utils';
import { ScoreViewComponent } from './score.component';

describe('ScoreViewComponent current DOM and lifecycle behavior', () => {
  beforeEach(async () => {
    jasmine.clock().install();
    await TestBed.configureTestingModule({
      imports: [ScoreViewComponent]
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    jasmine.clock().uninstall();
  });

  it('uses a global #score lookup so two instances render into the first surface', () => {
    const first = TestBed.createComponent(ScoreViewComponent);
    first.componentInstance.score = scoreFromNote('C4', 'trumpet');
    first.detectChanges(false);

    const secondHost = document.createElement('div');
    const secondSurface = document.createElement('div');
    secondSurface.id = 'score';
    secondHost.appendChild(secondSurface);
    document.body.appendChild(secondHost);
    const second = new ScoreViewComponent(new ElementRef(secondHost));
    second.score = scoreFromNote('D4', 'trumpet');
    second.ngAfterViewInit();

    const surfaces = document.querySelectorAll('#score');
    expect(surfaces.length).toBe(2);
    expect(surfaces[0].querySelectorAll('svg').length).toBe(2);
    expect(surfaces[1].querySelectorAll('svg').length).toBe(0);

    first.destroy();
    secondHost.remove();
  });

  it('keeps the score/size subscription alive after fixture destruction', () => {
    const fixture = TestBed.createComponent(ScoreViewComponent);
    fixture.componentInstance.score = scoreFromNote('C4', 'trumpet');
    fixture.detectChanges(false);
    const updateSpy = spyOn(fixture.componentInstance, 'updateScore').and.callThrough();
    fixture.destroy();

    const nextScore: Score = scoreFromNote('E4', 'trumpet');
    fixture.componentInstance.score = nextScore;

    expect(updateSpy).toHaveBeenCalledOnceWith(nextScore);
  });
});
