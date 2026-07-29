import { ChangeDetectorRef } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  TargetIntonationController
} from '../../activities/target-intonation/target-intonation.controller';
import {
  IntonationFeedback,
  TargetIntonationState
} from '../../activities/target-intonation/target-intonation.types';
import { ScoreNotationAdapter } from '../../adapters/notation/score-notation.adapter';
import { InstrumentRegistryService } from '../../instruments/instrument-registry.service';
import { TargetIntonationPage } from './target-intonation.page';

describe('TargetIntonationPage activity composition', () => {
  let page: TargetIntonationPage;
  let session: {
    isActive: boolean;
    start: jasmine.Spy;
    cancel: jasmine.Spy;
  };
  let pitch: {
    estimates$: BehaviorSubject<{
      kind: 'unvoiced';
      reason: 'silence';
      capturedAtMs: number;
      emittedAtMs: number;
    }>;
    acquire: jasmine.Spy;
  };
  let tabs: { setDisabled: jasmine.Spy };
  let cdr: jasmine.SpyObj<ChangeDetectorRef>;
  let referenceA4$: BehaviorSubject<number>;
  let instruments: InstrumentRegistryService;
  let destroyed = false;

  beforeEach(() => {
    localStorage.clear();
    session = {
      isActive: false,
      start: jasmine.createSpy('start').and.callFake(async () => {
        session.isActive = true;
      }),
      cancel: jasmine.createSpy('cancel').and.callFake(async () => {
        session.isActive = false;
        return null;
      })
    };
    pitch = {
      estimates$: new BehaviorSubject({
        kind: 'unvoiced',
        reason: 'silence',
        capturedAtMs: 0,
        emittedAtMs: 0
      }),
      acquire: jasmine.createSpy('acquire')
    };
    tabs = { setDisabled: jasmine.createSpy('setDisabled') };
    cdr = jasmine.createSpyObj<ChangeDetectorRef>(
      'ChangeDetectorRef',
      ['markForCheck']
    );
    referenceA4$ = new BehaviorSubject(440);
    instruments = new InstrumentRegistryService();
    page = new TargetIntonationPage(
      {
        unlockFromUserGesture: jasmine.createSpy('unlock'),
        preloadInstrument: jasmine.createSpy('preload'),
        playMetronome: jasmine.createSpy('metronome'),
        playReference: jasmine.createSpy('reference'),
        stopAll: jasmine.createSpy('stopAll')
      } as any,
      pitch as any,
      {
        getRefFrequency: () => referenceA4$,
        setRefFrequency: jasmine.createSpy('setRefFrequency')
      } as any,
      tabs as any,
      session as any,
      {
        nowMs: () => 0,
        after: jasmine.createSpy('after'),
        every: jasmine.createSpy('every')
      } as any,
      instruments,
      new ScoreNotationAdapter(),
      {
        open: jasmine.createSpy('open'),
        close: jasmine.createSpy('close')
      } as any,
      cdr
    );
    page.ngOnInit();
    destroyed = false;
  });

  afterEach(() => {
    if (!destroyed) {
      page.ngOnDestroy();
    }
  });

  it('launches the typed target-intonation controller without owning pitch resources', async () => {
    localStorage.setItem('selectedInstrument', 'clarinet');
    localStorage.setItem('clarinet_lowNote', '17');
    localStorage.setItem('clarinet_highNote', '19');
    page.ngOnDestroy();
    destroyed = true;

    page = createPageAfterStoredSettings();
    page.ngOnInit();
    destroyed = false;
    referenceA4$.next(450);
    await page.start();

    expect(session.start).toHaveBeenCalledTimes(1);
    const [controller, config, context] =
      session.start.calls.mostRecent().args;
    expect(controller instanceof TargetIntonationController).toBeTrue();
    expect(config).toEqual(jasmine.objectContaining({
      instrumentId: 'clarinet-bb',
      lowNoteIndex: 17,
      highNoteIndex: 19,
      referenceA4Hz: 450,
      toleranceCents: 10,
      requiredStableMs: 1500,
      attemptTimeoutMs: 10000,
      maximumAttemptsPerTarget: 3
    }));
    expect(context.pitch).toBe(pitch);
    expect(pitch.acquire).not.toHaveBeenCalled();
    expect(tabs.setDisabled).toHaveBeenCalledWith(true);
  });

  it('maps activity-specific snapshots to written target and feedback fields', () => {
    const controller = (page as any).controller as TargetIntonationController;
    const instrument = instruments.get('trumpet-bb');
    const target = instruments.resolveTarget(
      instrument.id,
      instrument.notes[13].id,
      440
    );
    const score = new ScoreNotationAdapter().forTarget(target);
    const base = {
      target,
      score,
      targetNumber: 2,
      targetCount: 3,
      attemptIndex: 1,
      maximumAttempts: 3
    };
    const presenting: TargetIntonationState = {
      ...base,
      kind: 'presenting-target',
      referencePlayback: 'playing'
    };
    controller.snapshot$.next({
      lifecycle: 'running',
      sessionId: 'test',
      state: presenting
    });

    expect(page.targetLabel()).toBe('G4');
    expect(page.score).toBe(score);
    expect(page.detectedPitchLabel()).toBe('No signal');

    const feedback: IntonationFeedback = {
      band: 'wrong-note',
      target,
      capturedAtMs: 200,
      detectedFrequencyHz: 392,
      detectedSoundingMidi: 67,
      centsFromTarget: 200,
      stableForMs: 0,
      requiredStableMs: 1500,
      stableProgress: 0,
      stabilityEstimateCount: 0,
      validEstimateCount: 0,
      wrongNoteCount: 1
    };
    controller.snapshot$.next({
      lifecycle: 'running',
      sessionId: 'test',
      state: {
        ...base,
        kind: 'tracking',
        attemptStartedAtMs: 100,
        attemptDeadlineAtMs: 10100,
        feedback
      }
    });

    expect(page.detectedPitchLabel()).toBe('392.0 Hz');
    expect(page.centsLabel()).toBe('+200.0 cents');
    expect(page.feedbackLabel()).toContain('Wrong note');
    expect(page.stabilityProgress).toBe(0);
  });

  it('dispatches retry, next, skip, and stop commands to the controller', async () => {
    const controller = (page as any).controller as TargetIntonationController;
    const dispatch = spyOn(controller, 'dispatch').and.resolveTo();

    await page.dispatch({ type: 'retry-attempt' });
    await page.dispatch({ type: 'next-target' });
    await page.dispatch({ type: 'skip-target' });
    await page.stop();

    expect(dispatch.calls.allArgs()).toEqual([
      [{ type: 'retry-attempt' }],
      [{ type: 'next-target' }],
      [{ type: 'skip-target' }],
      [{ type: 'stop' }]
    ]);
  });

  it('requests navigation cancellation only once across leave and destroy hooks', () => {
    session.isActive = true;

    page.ionViewWillLeave();
    page.ngOnDestroy();
    destroyed = true;

    expect(session.cancel).toHaveBeenCalledOnceWith('navigation');
  });

  function createPageAfterStoredSettings(): TargetIntonationPage {
    return new TargetIntonationPage(
      {
        unlockFromUserGesture: jasmine.createSpy('unlock'),
        preloadInstrument: jasmine.createSpy('preload'),
        playMetronome: jasmine.createSpy('metronome'),
        playReference: jasmine.createSpy('reference'),
        stopAll: jasmine.createSpy('stopAll')
      } as any,
      pitch as any,
      {
        getRefFrequency: () => referenceA4$
      } as any,
      tabs as any,
      session as any,
      {
        nowMs: () => 0,
        after: jasmine.createSpy('after'),
        every: jasmine.createSpy('every')
      } as any,
      instruments,
      new ScoreNotationAdapter(),
      {
        open: jasmine.createSpy('open'),
        close: jasmine.createSpy('close')
      } as any,
      cdr
    );
  }
});
