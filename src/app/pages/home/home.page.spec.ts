import { ChangeDetectorRef, EventEmitter } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Howler } from 'howler';
import { AppBeat } from 'src/app/models/appbeat.types';
import { MAXCYCLES } from 'src/app/constants';
import { HomePage } from './home.page';

describe('HomePage current exercise orchestration', () => {
  let page: HomePage;
  let beat: any;
  let sounds: any;
  let firebase: any;
  let refFrequency$: BehaviorSubject<number>;
  let pitch$: BehaviorSubject<number>;
  let pitch: any;
  let tabs: any;
  let cdr: jasmine.SpyObj<ChangeDetectorRef>;
  let tuner: any;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jasmine.clock().install();

    beat = {
      tempo$: new BehaviorSubject<number>(80),
      playing$: new BehaviorSubject<boolean>(false),
      tick$: new EventEmitter<AppBeat>(),
      start: jasmine.createSpy('start').and.callFake(() => beat.playing$.next(true)),
      stop: jasmine.createSpy('stop').and.callFake(() => beat.playing$.next(false)),
      setTempo: jasmine.createSpy('setTempo')
    };
    sounds = {
      loading$: new BehaviorSubject<boolean>(false),
      currentNote: 0,
      unlockAudio: jasmine.createSpy('unlockAudio').and.resolveTo(),
      ensureSoundsReady: jasmine.createSpy('ensureSoundsReady').and.resolveTo(),
      setInstrument: jasmine.createSpy('setInstrument').and.resolveTo(),
      setVolume: jasmine.createSpy('setVolume')
    };
    firebase = jasmine.createSpyObj('FirebaseService', ['saveStart', 'saveStop']);
    refFrequency$ = new BehaviorSubject<number>(440);
    const refFrequencyService = {
      getRefFrequency: jasmine.createSpy('getRefFrequency').and.returnValue(refFrequency$),
      setRefFrequency: jasmine.createSpy('setRefFrequency')
    };
    pitch$ = new BehaviorSubject<number>(0);
    pitch = {
      pitch$,
      primeMicrophoneAccess: jasmine.createSpy('primeMicrophoneAccess').and.resolveTo(),
      connect: jasmine.createSpy('connect').and.resolveTo(),
      disconnect: jasmine.createSpy('disconnect')
    };
    tabs = jasmine.createSpyObj('TabsService', ['setDisabled']);
    cdr = jasmine.createSpyObj<ChangeDetectorRef>(
      'ChangeDetectorRef',
      ['markForCheck', 'detectChanges']
    );
    tuner = {
      prepare: jasmine.createSpy('prepare').and.resolveTo(),
      startCapture: jasmine.createSpy('startCapture'),
      stopCapture: jasmine.createSpy('stopCapture').and.returnValue([]),
      stop: jasmine.createSpy('stop').and.returnValue([])
    };

    page = new HomePage(
      sounds,
      jasmine.createSpyObj('PickerController', ['create']),
      beat,
      firebase,
      jasmine.createSpyObj('AlertController', ['create']),
      refFrequencyService as any,
      tabs,
      pitch,
      jasmine.createSpyObj('Router', ['navigate']),
      cdr
    );
    (page as any).chromaticTuner = tuner;
    page.refFrequencyValue$ = 440;
  });

  afterEach(() => {
    page.ngOnDestroy();
    void page.audioContext.close();
    jasmine.clock().uninstall();
  });

  it('starts instrument mode only after audio readiness and microphone connection', async () => {
    const order: string[] = [];
    sounds.unlockAudio.and.callFake(async () => { order.push('unlock'); });
    sounds.ensureSoundsReady.and.callFake(async () => { order.push('sounds-ready'); });
    pitch.primeMicrophoneAccess.and.callFake(async () => { order.push('mic-prime'); });
    pitch.connect.and.callFake(async () => { order.push('mic-connect'); });
    beat.start.and.callFake(() => {
      order.push('beat-start');
      beat.playing$.next(true);
    });
    firebase.saveStart.and.callFake(() => order.push('firebase-start'));

    await page.startStop();

    expect(order).toEqual([
      'unlock',
      'sounds-ready',
      'mic-prime',
      'mic-connect',
      'beat-start',
      'firebase-start'
    ]);
    expect(tabs.setDisabled).toHaveBeenCalledWith(true);
    expect(firebase.saveStart).toHaveBeenCalledOnceWith(80, 13, 13, 440, false, false);
  });

  it('starts the tuner beat before awaiting tuner preparation and skips parent microphone setup', async () => {
    const order: string[] = [];
    page.exerciseMode = 'tuner';
    beat.start.and.callFake(() => {
      order.push('beat-start');
      beat.playing$.next(true);
    });
    tuner.prepare.and.callFake(async () => { order.push('tuner-prepare'); });

    await page.startStop();

    expect(order).toEqual(['beat-start', 'tuner-prepare']);
    expect(pitch.primeMicrophoneAccess).not.toHaveBeenCalled();
    expect(pitch.connect).not.toHaveBeenCalled();
  });

  it('maps measure-zero/listen/play beat-zero events to Rest, Listen, and Play', () => {
    spyOn(page, 'nextNote').and.returnValue(15);
    const updateScore = spyOn(page, 'updateScore');
    const updateTrumpet = spyOn(page, 'updateTrumpetPosition');

    page.intervalHandler({ playing: true, measure: 0, beat: 0, cycle: 1 });
    expect(page.currentAction).toBe('Rest');
    expect(page.currentNote).toBe(15);
    expect(sounds.currentNote).toBe(15);
    expect(updateScore).toHaveBeenCalledOnceWith(15);
    expect(updateTrumpet).toHaveBeenCalledOnceWith(15);

    page.intervalHandler({ playing: true, measure: 1, beat: 0, cycle: 1 });
    expect(page.currentAction).toBe('Listen');
    expect(page.pitchFeedbackLabel).toBe('Listen');

    page.intervalHandler({ playing: true, measure: 2, beat: 0, cycle: 1 });
    expect(page.currentAction).toBe('Play');
    pitch$.next(440);
    expect(page.pitchFeedbackLabel).toBe('In Tune');

    page.intervalHandler({ playing: true, measure: 0, beat: 0, cycle: 2 });
    expect(page.pitchFeedbackLabel).toBe('Waiting');
    expect((page as any).pitchSubscription.closed).toBeFalse();
  });

  it('opens and closes tuner collection in Play and Rest and records returned means', () => {
    page.exerciseMode = 'tuner';
    tuner.stopCapture.and.returnValue([439, 440]);

    page.intervalHandler({ playing: true, measure: 2, beat: 0, cycle: 1 });
    expect(tuner.startCapture).toHaveBeenCalledTimes(1);

    page.intervalHandler({ playing: true, measure: 0, beat: 0, cycle: 2 });
    expect(tuner.stopCapture).toHaveBeenCalledTimes(1);
    expect(page.collectedMeansObject).toEqual({ 1: [439, 440] });
  });

  it('persists completion once for each duplicate terminal BeatService event', () => {
    const terminal = { playing: false, measure: 0, beat: 0, cycle: MAXCYCLES };

    page.intervalHandler(terminal);
    page.intervalHandler({ ...terminal, playing: true });

    expect(firebase.saveStop).toHaveBeenCalledTimes(2);
    expect(firebase.saveStop).toHaveBeenCalledWith('finished', {});
    expect(tabs.setDisabled).toHaveBeenCalledWith(false);
    expect(page.currentAction).toBe('');
  });

  it('can move an accidental-only selected range outside that range', () => {
    page.lowNote = 7;
    page.highNote = 7;
    page.useFlatsAndSharps = false;

    expect(page.nextNote()).toBe(8);
  });

  it('uses fixed A4=440 written-note frequency with no instrument transposition', () => {
    const noteNameToFrequency = (page as any).noteNameToFrequency.bind(page);

    expect(noteNameToFrequency('A4')).toBe(440);
    expect(noteNameToFrequency('C4')).toBeCloseTo(261.625565, 5);
    page.selectedInstrument = 'clarinet';
    expect(noteNameToFrequency('A4')).toBe(440);
    page.refFrequencyValue$ = 442;
    expect(noteNameToFrequency('A4')).toBe(440);
  });

  it('stops audio, pitch, tempo, persistence, and tuner collection on manual stop', () => {
    const howlerStop = spyOn(Howler, 'stop');
    page.exerciseMode = 'tuner';
    tuner.stop.and.returnValue([440]);
    beat.playing$.next(true);

    page.stop();

    expect(beat.stop).toHaveBeenCalled();
    expect(tuner.stop).toHaveBeenCalled();
    expect(pitch.disconnect).toHaveBeenCalled();
    expect(howlerStop).toHaveBeenCalled();
    expect(firebase.saveStop).toHaveBeenCalledOnceWith(
      'interrupted',
      { 1: [440] }
    );
  });

  it('cleans the beat subscription but leaves reference and one-second subscriptions active', () => {
    const intervalHandler = spyOn(page, 'intervalHandler');
    const checkMuted = spyOn(page, 'checkMuted').and.resolveTo();
    page.ngOnInit();

    jasmine.clock().tick(1000);
    expect(checkMuted).toHaveBeenCalledTimes(1);

    page.ngOnDestroy();
    beat.tick$.emit({ playing: true, measure: 0, beat: 0, cycle: 1 });
    refFrequency$.next(442);
    jasmine.clock().tick(1000);

    expect(intervalHandler).not.toHaveBeenCalled();
    expect(page.refFrequencyValue$).toBe(442);
    expect(checkMuted).toHaveBeenCalledTimes(2);
  });
});
