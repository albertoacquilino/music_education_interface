import { ChangeDetectorRef } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { RefFreqService } from 'src/app/services/ref-freq.service';
import { PitchService } from 'src/app/services/pitch.service';
import { ChromaticTunerComponent } from './chromatic-tuner.component';

describe('ChromaticTunerComponent current behavior', () => {
  let pitch$: BehaviorSubject<number>;
  let refFrequency$: BehaviorSubject<number>;
  let pitchService: jasmine.SpyObj<PitchService>;
  let refFrequencyService: jasmine.SpyObj<RefFreqService>;
  let changeDetectorRef: jasmine.SpyObj<ChangeDetectorRef>;
  let component: ChromaticTunerComponent;

  beforeEach(() => {
    pitch$ = new BehaviorSubject<number>(0);
    refFrequency$ = new BehaviorSubject<number>(440);
    pitchService = jasmine.createSpyObj<PitchService>(
      'PitchService',
      ['connect', 'disconnect'],
      { pitch$ }
    );
    pitchService.connect.and.resolveTo();
    refFrequencyService = jasmine.createSpyObj<RefFreqService>(
      'RefFreqService',
      ['getRefFrequency']
    );
    refFrequencyService.getRefFrequency.and.returnValue(refFrequency$);
    changeDetectorRef = jasmine.createSpyObj<ChangeDetectorRef>(
      'ChangeDetectorRef',
      ['detectChanges']
    );

    component = new ChromaticTunerComponent(
      pitchService,
      changeDetectorRef,
      refFrequencyService
    );
    component.ngOnInit();
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  async function capture(...pitches: number[]) {
    await component.prepare();
    component.startCapture();
    pitches.forEach(pitch => pitch$.next(pitch));
  }

  it('has no target-note input and reports the nearest chromatic note instead', async () => {
    expect((component as any).targetNote).toBeUndefined();

    await capture(523.25, 523.25, 523.25, 523.25);

    expect(component.currentNote).toBe('C5');
    expect(component.currentCents).toBeCloseTo(0, 4);
    expect(component.currentEmoji).toBe('');
  });

  it('smooths each four estimates by the largest 2 Hz bucket and keeps the first tie', async () => {
    await capture(440, 441, 466, 467);

    expect(component.detectedPitch).toBe(440.5);
    expect(component.meansArray).toEqual([440.5]);
    expect(component.currentNote).toBe('A4');
  });

  it('recalibrates the nearest-note table when the A4 reference changes', async () => {
    refFrequency$.next(442);
    await capture(442, 442, 442, 442);

    expect(component.NOTES['A4'].freq).toBeCloseTo(442, 10);
    expect(component.currentNote).toBe('A4');
    expect(component.currentCents).toBeCloseTo(0, 4);
  });

  it('clamps the pointer and characterizes emoji threshold and zero behavior', () => {
    component.rotatePointer(-100);
    expect(component.pointerTransform).toBe('rotate(-90deg)');
    component.rotatePointer(100);
    expect(component.pointerTransform).toBe('rotate(90deg)');

    component.detectedPitch = 440;
    component.showEmoji(0);
    expect(component.currentEmoji).toBe('');
    component.showEmoji(10);
    expect(component.currentEmoji).toBe('happy');
    component.showEmoji(11);
    expect(component.currentEmoji).toBe('confused');
    component.showEmoji(30);
    expect(component.currentEmoji).toBe('confused');
    component.showEmoji(31);
    expect(component.currentEmoji).toBe('notHappy');
  });

  it('maps four zero/silent estimates to a blank display without collected means', async () => {
    await capture(0, 0, 0, 0);

    expect(component.detectedPitch).toBe(0);
    expect(component.currentNote).toBe('');
    expect(component.currentCents).toBe(0);
    expect(component.currentEmoji).toBe('');
    expect(component.pointerTransform).toBe('rotate(0deg)');
    expect(component.meansArray).toEqual([]);
  });

  it('keeps the microphone connected across capture windows and releases it on shutdown', async () => {
    await component.prepare();
    await component.prepare();
    component.startCapture();
    pitch$.next(440);
    component.stopCapture();

    expect(pitchService.connect).toHaveBeenCalledTimes(1);
    expect(pitchService.disconnect).not.toHaveBeenCalled();

    component.shutdown();
    expect(pitchService.disconnect).toHaveBeenCalledTimes(1);

    await component.prepare();
    expect(pitchService.connect).toHaveBeenCalledTimes(2);
  });

  it('leaves its note pipeline subscribed after destroy', () => {
    component.ngOnDestroy();
    component.currentNote = '';

    const pitchSubject = (component as any).pitchSubject;
    [440, 440, 440, 440].forEach(pitch => pitchSubject.next(pitch));

    expect(component.currentNote).toBe('A4');
  });

  it('adds anonymous global listeners that destroy cannot remove', () => {
    const tuner = document.createElement('div');
    tuner.id = 'tuner';
    document.body.appendChild(tuner);
    const addSpy = spyOn(window, 'addEventListener').and.callThrough();
    const removeSpy = spyOn(window, 'removeEventListener').and.callThrough();

    component.ngAfterViewInit();
    component.ngOnDestroy();

    expect(addSpy.calls.allArgs().map(args => args[0])).toEqual(['resize', 'load']);
    expect(removeSpy).not.toHaveBeenCalled();
    tuner.remove();
  });

  it('resolves a duplicated tuner ID to the first global element', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    first.id = 'tuner';
    second.id = 'tuner';
    document.body.append(first, second);

    component.scaleContent();

    expect(document.querySelectorAll('#tuner').length).toBe(2);
    expect(document.getElementById('tuner')).toBe(first);
    first.remove();
    second.remove();
  });
});
