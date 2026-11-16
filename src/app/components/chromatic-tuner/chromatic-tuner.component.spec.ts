import { ChangeDetectorRef, ElementRef } from '@angular/core';
import { ChromaticTunerComponent } from './chromatic-tuner.component';
import { InstrumentRegistryService } from '../../instruments/instrument-registry.service';

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

  it('uses explicit-target feedback and never celebrates a wrong chromatic note', () => {
    const instruments = new InstrumentRegistryService();
    const instrument = instruments.get('oboe-c');
    const target = instruments.resolveTarget(
      instrument.id,
      instrument.notes[0].id,
      440
    );
    component.pitchHz =
      target.expectedSoundingFrequencyHz * Math.pow(2, 1 / 12);
    expect(component.currentEmoji).toBe('happy');

    component.targetFeedback = {
      band: 'wrong-note',
      target,
      capturedAtMs: 100,
      detectedFrequencyHz:
        target.expectedSoundingFrequencyHz * Math.pow(2, 1 / 12),
      detectedSoundingMidi: instrument.notes[0].soundingMidiAtA4_440 + 1,
      centsFromTarget: 100,
      stableForMs: 0,
      requiredStableMs: 1500,
      stableProgress: 0,
      stabilityEstimateCount: 0,
      validEstimateCount: 0,
      wrongNoteCount: 1
    };

    expect(component.currentCents).toBeCloseTo(100, 8);
    expect(component.currentEmoji).toBe('notHappy');
    expect(component.pointerTransform).toBe('rotate(90deg)');
  });

  it('keeps two presenter instances on independent DOM surfaces', () => {
    const other = new ChromaticTunerComponent(cdr);
    const firstHost = document.createElement('div');
    const secondHost = document.createElement('div');
    (component as any).tunerSurface = new ElementRef(firstHost);
    (other as any).tunerSurface = new ElementRef(secondHost);

    component.scaleContent();
    other.scaleContent();
    component.pitchHz = 440;
    other.pitchHz = 466.16;

    expect(component.currentNote).toBe('A4');
    expect(other.currentNote).toBe('A#/Bb4');
    expect((component as any).tunerSurface.nativeElement)
      .not.toBe((other as any).tunerSurface.nativeElement);
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
