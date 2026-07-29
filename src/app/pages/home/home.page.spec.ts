import { ChangeDetectorRef, EventEmitter } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  PrepareListenPlayController
} from '../../activities/prepare-listen-play/prepare-listen-play.controller';
import {
  PrepareListenPlayResult,
  PrepareListenPlayState
} from '../../activities/prepare-listen-play/prepare-listen-play.types';
import { ActivitySnapshot } from '../../core/activity/activity.types';
import { InstrumentRegistryService } from '../../instruments/instrument-registry.service';
import { ScoreNotationAdapter } from '../../adapters/notation/score-notation.adapter';
import { BeatService } from '../../services/beat.service';
import { HomePage } from './home.page';

describe('HomePage activity host', () => {
  let page: HomePage;
  let session: any;
  let sounds: any;
  let pitch: any;
  let refFrequency$: BehaviorSubject<number>;
  let tabs: any;
  let cdr: jasmine.SpyObj<ChangeDetectorRef>;
  let instruments: InstrumentRegistryService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jasmine.clock().install();

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
    sounds = {
      loading$: new BehaviorSubject<boolean>(false),
      setInstrument: jasmine.createSpy('setInstrument').and.resolveTo(),
      unlockFromUserGesture: jasmine.createSpy('unlock').and.resolveTo(),
      preloadInstrument: jasmine.createSpy('preload').and.resolveTo(),
      playMetronome: jasmine.createSpy('metronome'),
      playReference: jasmine.createSpy('reference'),
      stopAll: jasmine.createSpy('stopAll')
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
    refFrequency$ = new BehaviorSubject(440);
    const refFrequency = {
      getRefFrequency: jasmine.createSpy('getRefFrequency')
        .and.returnValue(refFrequency$),
      setRefFrequency: jasmine.createSpy('setRefFrequency')
    };
    tabs = jasmine.createSpyObj('TabsService', ['setDisabled']);
    cdr = jasmine.createSpyObj<ChangeDetectorRef>(
      'ChangeDetectorRef',
      ['markForCheck', 'detectChanges']
    );
    instruments = new InstrumentRegistryService();

    page = new HomePage(
      sounds,
      jasmine.createSpyObj('PickerController', ['create']),
      new BeatService(),
      jasmine.createSpyObj('AlertController', ['create']),
      refFrequency as any,
      tabs,
      pitch,
      jasmine.createSpyObj('Router', ['navigate']),
      cdr,
      session,
      {
        nowMs: () => 0,
        every: jasmine.createSpy('every')
      } as any,
      instruments,
      new ScoreNotationAdapter(),
      {
        open: jasmine.createSpy('open'),
        close: jasmine.createSpy('close')
      } as any
    );
    page.ngOnInit();
  });

  afterEach(() => {
    page.ngOnDestroy();
    jasmine.clock().uninstall();
  });

  it('starts by composing a typed controller configuration rather than orchestrating resources', async () => {
    page.selectedInstrument = 'clarinet';
    (page as any).applyExerciseConfiguration();
    page.lowNote = 17;
    page.highNote = 19;
    page.refFrequencyValue$ = 450;

    await page.startStop();

    expect(session.start).toHaveBeenCalledTimes(1);
    const [controller, config, context] = session.start.calls.mostRecent().args;
    expect(controller instanceof PrepareListenPlayController).toBeTrue();
    expect(config).toEqual(jasmine.objectContaining({
      instrumentId: 'clarinet-bb',
      lowNoteIndex: 17,
      highNoteIndex: 19,
      beatsPerPhase: 4,
      cycles: 12,
      referenceA4Hz: 450,
      pitchDisplay: 'target'
    }));
    expect(context.audio).toBe(sounds);
    expect(context.pitch).toBe(pitch);
    expect(sounds.unlockFromUserGesture).not.toHaveBeenCalled();
    expect(pitch.acquire).not.toHaveBeenCalled();
    expect(tabs.setDisabled).toHaveBeenCalledWith(true);
  });

  it('renders typed controller snapshots without deciding phase transitions', () => {
    const controller = (page as any).controller as PrepareListenPlayController;
    const instrument = instruments.get('trumpet-bb');
    const target = instruments.resolveTarget(
      instrument.id,
      instrument.notes[13].id,
      440
    );
    const score = new ScoreNotationAdapter().forPrepareListenPlay(target);
    const state: PrepareListenPlayState = {
      phase: 'preparing',
      cycleNumber: 1,
      beatIndex: 0,
      target,
      score,
      dynamicGain: 1
    };

    controller.snapshot$.next({
      lifecycle: 'running',
      sessionId: 'test',
      state
    });

    expect(page.currentAction).toBe('Rest');
    expect(page.currentBeat).toBe(0);
    expect(page.currentNote).toBe(13);
    expect(page.trumpetBtns).toEqual([]);

    controller.snapshot$.next({
      lifecycle: 'running',
      sessionId: 'test',
      state: {
        ...state,
        phase: 'playing',
        pitchFeedback: {
          kind: 'voiced',
          frequencyHz: target.expectedSoundingFrequencyHz,
          cents: 0,
          band: 'in-tune'
        }
      }
    });
    expect(page.currentAction).toBe('Play');
    expect(page.pitchFeedbackLabel).toBe('In Tune');
  });

  it('handles one terminal result as view cleanup without closing persistence itself', () => {
    const controller = (page as any).controller as PrepareListenPlayController;
    const result: PrepareListenPlayResult = {
      activityId: 'prepare-listen-play',
      activityVersion: '1.0.0',
      sessionId: 'test',
      outcome: 'completed',
      startedAtMs: 0,
      endedAtMs: 1,
      plannedCycles: 12,
      completedCycles: 12,
      presentedTargetIds: [],
      collectedMeans: { 1: [440] }
    };

    controller.snapshot$.next({
      lifecycle: 'completed',
      sessionId: 'test',
      result
    });

    expect(page.collectedMeansObject).toEqual({ 1: [440] });
    expect(tabs.setDisabled).toHaveBeenCalledOnceWith(false);
    expect(page.currentAction).toBe('');
    expect((page as any).persistence.close).not.toHaveBeenCalled();
  });

  it('delegates learner stop and navigation cancellation to the session boundary', async () => {
    session.isActive = true;
    await page.startStop();
    expect(session.cancel).toHaveBeenCalledWith('learner-stop');

    page.ionViewWillLeave();
    expect(session.cancel).toHaveBeenCalledWith('navigation');
  });

  it('releases reference-frequency, timer, and controller subscriptions on destroy', () => {
    const checkMuted = spyOn(page, 'checkMuted').and.resolveTo();
    const controller = (page as any).controller as PrepareListenPlayController;
    const beforeDestroyFrequency = page.refFrequencyValue$;

    page.ngOnDestroy();
    refFrequency$.next(450);
    jasmine.clock().tick(1000);
    controller.snapshot$.next({ lifecycle: 'idle' });

    expect(page.refFrequencyValue$).toBe(beforeDestroyFrequency);
    expect(checkMuted).not.toHaveBeenCalled();
  });
});
