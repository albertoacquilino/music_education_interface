import { ChangeDetectorRef, ElementRef } from '@angular/core';
import { ChromaticTunerComponent } from './chromatic-tuner.component';

describe('ChromaticTunerComponent presentation boundary', () => {
  let cdr: jasmine.SpyObj<ChangeDetectorRef>;
  let component: ChromaticTunerComponent;

  beforeEach(() => {
    cdr = jasmine.createSpyObj<ChangeDetectorRef>(
      'ChangeDetectorRef',
      ['markForCheck']
    );
    component = new ChromaticTunerComponent(cdr);
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('presents the nearest chromatic note from an explicit pitch input', () => {
    component.pitchHz = 523.25;

    expect(component.currentNote).toBe('C5');
    expect(component.currentCents).toBeCloseTo(0, 1);
    expect(component.currentEmoji).toBe('happy');
  });

  it('recalibrates display frequencies from its explicit A4 input', () => {
    component.refFrequencyValue$ = 442;
    component.pitchHz = 442;

    expect(component.NOTES['A4'].freq).toBe(442);
    expect(component.currentNote).toBe('A4');
    expect(component.currentCents).toBeCloseTo(0, 8);
  });

  it('clamps the pointer and treats exact tuning as in tune', () => {
    component.detectedPitch = 440;
    component.rotatePointer(-100);
    expect(component.pointerTransform).toBe('rotate(-90deg)');
    component.rotatePointer(100);
    expect(component.pointerTransform).toBe('rotate(90deg)');

    component.showEmoji(0);
    expect(component.currentEmoji).toBe('happy');
    component.showEmoji(11);
    expect(component.currentEmoji).toBe('confused');
    component.showEmoji(31);
    expect(component.currentEmoji).toBe('notHappy');
  });

  it('represents silence as a blank finite presentation', () => {
    component.pitchHz = 0;

    expect(component.detectedPitch).toBe(0);
    expect(component.currentNote).toBe('');
    expect(component.currentCents).toBe(0);
    expect(component.currentEmoji).toBe('');
    expect(component.pointerTransform).toBe('rotate(0deg)');
  });

  it('owns no microphone lifecycle and removes its bound window listeners', () => {
    const host = document.createElement('div');
    (component as any).tunerSurface = new ElementRef(host);
    const addSpy = spyOn(window, 'addEventListener').and.callThrough();
    const removeSpy = spyOn(window, 'removeEventListener').and.callThrough();

    component.ngAfterViewInit();
    component.ngOnDestroy();

    expect((component as any).pitchService).toBeUndefined();
    expect(addSpy.calls.allArgs().map(args => args[0])).toEqual(['resize', 'load']);
    expect(removeSpy.calls.allArgs().map(args => args[0])).toEqual(['resize', 'load']);
  });

  it('does not create a global tuner identifier', () => {
    const host = document.createElement('div');
    (component as any).tunerSurface = new ElementRef(host);
    component.scaleContent();

    expect(document.querySelectorAll('#tuner').length).toBe(0);
  });
});
