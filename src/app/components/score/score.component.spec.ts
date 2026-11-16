import { TestBed } from '@angular/core/testing';
import { scoreFromNote } from 'src/app/utils/score.utils';
import { ScoreViewComponent } from './score.component';

describe('ScoreViewComponent instance and lifecycle behavior', () => {
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

  it('renders two instances into independent local surfaces', () => {
    const first = TestBed.createComponent(ScoreViewComponent);
    const second = TestBed.createComponent(ScoreViewComponent);
    first.componentInstance.score = scoreFromNote('C4', 'trumpet');
    second.componentInstance.score = scoreFromNote('D4', 'trumpet');
    first.detectChanges();
    second.detectChanges();
    jasmine.clock().tick(1000);

    expect(first.nativeElement.querySelectorAll('svg').length).toBe(1);
    expect(second.nativeElement.querySelectorAll('svg').length).toBe(1);
    expect(document.querySelectorAll('#score').length).toBe(0);

    first.destroy();
    second.destroy();
  });

  it('unsubscribes rendering updates when destroyed', () => {
    const fixture = TestBed.createComponent(ScoreViewComponent);
    fixture.componentInstance.score = scoreFromNote('C4', 'trumpet');
    fixture.detectChanges();
    jasmine.clock().tick(1000);
    const updateSpy = spyOn(fixture.componentInstance, 'updateScore').and.callThrough();

    fixture.destroy();
    fixture.componentInstance.score = scoreFromNote('E4', 'trumpet');

    expect(updateSpy).not.toHaveBeenCalled();
  });
});
