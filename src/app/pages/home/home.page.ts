/**
 * This file is part of the Music Education Interface project.
 * Copyright (C) 2025 Alberto Acquilino
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */

import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { Mute } from '@capgo/capacitor-mute';
import { AlertController, IonicModule, PickerController } from '@ionic/angular';
import { range } from 'lodash';
import { Observable, Subscription, interval } from 'rxjs';
import {
  PrepareListenPlayController
} from '../../activities/prepare-listen-play/prepare-listen-play.controller';
import {
  PrepareListenPlayConfig,
  PrepareListenPlayResult,
  PrepareListenPlayState
} from '../../activities/prepare-listen-play/prepare-listen-play.types';
import { RxjsClockAdapter } from '../../adapters/clock/rxjs-clock.adapter';
import {
  FirebaseActivityAdapter
} from '../../adapters/persistence/firebase-activity.adapter';
import { ScoreNotationAdapter } from '../../adapters/notation/score-notation.adapter';
import { ChromaticTunerComponent } from '../../components/chromatic-tuner/chromatic-tuner.component';
import { NoteSelectorComponent } from '../../components/note-selector/note-selector.component';
import { ScoreViewComponent } from '../../components/score/score.component';
import { SemaphoreLightComponent } from '../../components/semaphore-light/semaphore-light.component';
import { TempoSelectorComponent } from '../../components/tempo-selector/tempo-selector.component';
import { TrumpetDiagramComponent } from '../../components/trumpet-diagram/trumpet-diagram.component';
import {
  DYNAMICS,
  INITIAL_NOTE,
  MAXCYCLES,
  MAXREFFREQUENCY,
  MAXTEMPO,
  MINREFFREQUENCY,
  MINTEMPO
} from '../../constants';
import { ActivityContext } from '../../core/activity/activity-context';
import { ActivitySnapshot } from '../../core/activity/activity.types';
import {
  LegacyInstrumentId,
  NoteTarget
} from '../../instruments/instrument-definition';
import {
  InstrumentRegistryService
} from '../../instruments/instrument-registry.service';
import { Score } from '../../models/score.types';
import { BeatService } from '../../services/beat.service';
import { PitchService } from '../../services/pitch.service';
import { RefFreqService } from '../../services/ref-freq.service';
import { SoundsService } from '../../services/sounds.service';
import { TabsService } from '../../services/tabs.service';
import {
  ActivitySessionService
} from '../../core/activity/activity-session.service';
import { scoreFromNote } from '../../utils/score.utils';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    IonicModule,
    ScoreViewComponent,
    CommonModule,
    SemaphoreLightComponent,
    TrumpetDiagramComponent,
    TempoSelectorComponent,
    NoteSelectorComponent,
    ChromaticTunerComponent
  ]
})
export class HomePage implements OnInit, AfterViewInit, OnDestroy {
  private readonly controller = new PrepareListenPlayController();
  private readonly subscriptions = new Subscription();
  private readonly boundRefreshSettings = () => this.handleSettingsUpdated();

  exerciseMode: 'instrument' | 'tuner' = 'instrument';
  selectedInstrument: LegacyInstrumentId = 'trumpet';
  language = 'en';
  NOTES: string[][] = [];
  muteAlert = false;
  useFlatsAndSharps = false;
  useDynamics = false;
  isDarkMode = false;
  instrumentSelectInterfaceOptions = { cssClass: 'settings-select-overlay' };
  nomenclatureSelectInterfaceOptions = { cssClass: 'settings-select-overlay' };
  tempo$: Observable<number>;
  soundsLoading$: Observable<boolean>;
  highNote = INITIAL_NOTE;
  lowNote = INITIAL_NOTE;
  currentNote = INITIAL_NOTE;
  score: Score = scoreFromNote('G4', 'trumpet');
  currentAction = '';
  currentBeat = -1;
  clarinetPosition = 'assets/images/clarinet_positions/A3.svg';
  oboePosition = 'assets/images/oboe_positions/A4.svg';
  trumpetBtns: number[] = [];
  refFrequencyValue$ = 440;
  showIOSWebAudioHint = false;
  pitchCents = 0;
  pitchAccuracyClass: 'in-tune' | 'close' | 'far' | 'waiting' = 'waiting';
  pitchFeedbackLabel = 'Waiting';
  pitchBarPosition = 50;
  tunerPitchHz = 0;
  collectedMeansObject: { [key: string]: number[] } = {};

  private readonly instrumentDisplayNames: Record<LegacyInstrumentId, string> = {
    trumpet: 'Trumpet',
    clarinet: 'Clarinet',
    oboe: 'Oboe'
  };

  constructor(
    private readonly soundsService: SoundsService,
    private readonly picker: PickerController,
    private readonly tempoSettings: BeatService,
    private readonly alertController: AlertController,
    private readonly refFrequencyService: RefFreqService,
    private readonly tabsService: TabsService,
    private readonly pitchService: PitchService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly activitySession: ActivitySessionService,
    private readonly clock: RxjsClockAdapter,
    private readonly instruments: InstrumentRegistryService,
    private readonly notation: ScoreNotationAdapter,
    private readonly persistence: FirebaseActivityAdapter
  ) {
    this.tempo$ = this.tempoSettings.tempo$.asObservable();
    this.soundsLoading$ = this.soundsService.loading$;
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.refFrequencyService.getRefFrequency().subscribe(value => {
        this.refFrequencyValue$ = value;
      })
    );
    this.subscriptions.add(
      this.controller.snapshot$.subscribe(snapshot => {
        this.handleActivitySnapshot(snapshot);
      })
    );
    this.subscriptions.add(
      interval(1000).subscribe(() => {
        void this.checkMuted();
      })
    );

    this.showIOSWebAudioHint = this.isIOSWebBrowser()
      && sessionStorage.getItem('ios-web-audio-hint-dismissed') !== 'true';
    this.loadStateFromLocalStorage();
  }

  ngOnDestroy(): void {
    window.removeEventListener('mei-settings-updated', this.boundRefreshSettings);
    this.subscriptions.unsubscribe();
    void this.activitySession.cancel('navigation');
  }

  ngAfterViewInit(): void {
    window.addEventListener('mei-settings-updated', this.boundRefreshSettings);
  }

  ionViewWillLeave(): void {
    void this.activitySession.cancel('navigation');
  }

  async startStop(): Promise<void> {
    if (this.activitySession.isActive) {
      await this.stop();
      return;
    }

    const instrument = this.instruments.fromLegacyId(this.selectedInstrument);
    const lowNote = instrument.notes[this.lowNote];
    const highNote = instrument.notes[this.highNote];
    if (!lowNote || !highNote) {
      console.error('The selected note range is outside the instrument definition');
      return;
    }

    const config: PrepareListenPlayConfig = {
      instrumentId: instrument.id,
      lowNoteId: lowNote.id,
      highNoteId: highNote.id,
      lowNoteIndex: this.lowNote,
      highNoteIndex: this.highNote,
      tempoBpm: this.tempoSettings.tempo$.value,
      beatsPerPhase: 4,
      cycles: MAXCYCLES,
      includeAccidentals: this.useFlatsAndSharps,
      useDynamics: this.useDynamics,
      pitchDisplay: this.isTunerExercise() ? 'chromatic' : 'target',
      referenceA4Hz: this.refFrequencyValue$
    };

    this.collectedMeansObject = {};
    await this.activitySession.start(
      this.controller,
      config,
      this.createActivityContext()
    );
    this.tabsService.setDisabled(this.activitySession.isActive);
    this.cdr.markForCheck();
  }

  async stop(): Promise<void> {
    await this.activitySession.cancel('learner-stop');
    this.tabsService.setDisabled(false);
    this.resetExerciseView();
    this.cdr.markForCheck();
  }

  isPlaying(): boolean {
    return this.activitySession.isActive;
  }

  private createActivityContext(): ActivityContext {
    return {
      clock: this.clock,
      audio: this.soundsService,
      pitch: this.pitchService,
      notation: this.notation,
      instruments: this.instruments,
      persistence: this.persistence,
      random: Math.random
    };
  }

  private handleActivitySnapshot(
    snapshot: ActivitySnapshot<PrepareListenPlayState, PrepareListenPlayResult>
  ): void {
    if (snapshot.lifecycle === 'running') {
      this.renderRunningState(snapshot.state);
      return;
    }

    if (
      snapshot.lifecycle === 'completed'
      || snapshot.lifecycle === 'cancelled'
      || snapshot.lifecycle === 'failed'
    ) {
      this.collectedMeansObject = Object.keys(snapshot.result.collectedMeans)
        .reduce<{ [key: string]: number[] }>((means, key) => ({
          ...means,
          [key]: [...snapshot.result.collectedMeans[key]]
        }), {});
      this.tabsService.setDisabled(false);
      this.resetExerciseView();
      this.cdr.markForCheck();
    }
  }

  private renderRunningState(state: PrepareListenPlayState): void {
    this.currentAction = state.phase === 'preparing'
      ? 'Rest'
      : state.phase === 'listening'
        ? 'Listen'
        : 'Play';
    this.currentBeat = state.beatIndex;

    if (state.target.noteIndex !== this.currentNote || state.beatIndex === 0) {
      this.currentNote = state.target.noteIndex;
      this.score = state.score;
      this.renderFingering(state.target);
    }

    if (this.isTunerExercise()) {
      this.tunerPitchHz = state.phase === 'playing'
        ? state.chromaticPitchHz ?? 0
        : 0;
    } else if (state.phase === 'listening') {
      this.setPitchFeedbackWaiting('Listen');
    } else if (state.phase === 'preparing' || !state.pitchFeedback) {
      this.setPitchFeedbackWaiting('Waiting');
    } else if (state.pitchFeedback.kind === 'unvoiced') {
      this.setPitchFeedbackWaiting('Waiting');
    } else {
      this.renderPitchFeedback(
        state.pitchFeedback.cents,
        state.pitchFeedback.band
      );
    }

    this.cdr.markForCheck();
  }

  private renderFingering(target: NoteTarget): void {
    if (target.fingering.kind === 'valves') {
      this.trumpetBtns = [
        ...(target.fingering.thirdValveSlide === 'extend' ? [0] : []),
        ...target.fingering.pressedValveNumbers
      ];
      return;
    }

    if (target.instrumentId === 'clarinet-bb') {
      this.clarinetPosition = target.fingering.assetPath;
    } else if (target.instrumentId === 'oboe-c') {
      this.oboePosition = target.fingering.assetPath;
    }
  }

  private renderPitchFeedback(
    cents: number,
    band: 'in-tune' | 'close' | 'far'
  ): void {
    this.pitchCents = cents;
    const clampedCents = Math.max(-50, Math.min(50, cents));
    this.pitchBarPosition = 50 + clampedCents;
    this.pitchAccuracyClass = band;
    this.pitchFeedbackLabel = band === 'in-tune'
      ? 'In Tune'
      : cents > 0
        ? band === 'close' ? 'Sharp' : 'Too Sharp'
        : band === 'close' ? 'Flat' : 'Too Flat';
  }

  private resetExerciseView(): void {
    this.currentAction = '';
    this.currentBeat = -1;
    this.tunerPitchHz = 0;
    this.resetPitchFeedback();
    this.resetInstrumentVisual();
  }

  private setPitchFeedbackWaiting(label: string): void {
    this.pitchCents = 0;
    this.pitchAccuracyClass = 'waiting';
    this.pitchFeedbackLabel = label;
    this.pitchBarPosition = 50;
  }

  private resetPitchFeedback(): void {
    this.setPitchFeedbackWaiting('Waiting');
  }

  private resetInstrumentVisual(): void {
    this.trumpetBtns = [];
    this.clarinetPosition = 'assets/images/clarinet_positions/A3.svg';
    this.oboePosition = 'assets/images/oboe_positions/A4.svg';
  }

  private loadStateFromLocalStorage(): void {
    const { mode, instrument } = this.parseStoredModeAndInstrument();
    this.exerciseMode = mode;
    this.selectedInstrument = instrument;
    this.applyExerciseConfiguration();
    this.useFlatsAndSharps = this.retrieveAndParseFromLocalStorage(
      'useFlatsAndSharps',
      false
    );
    this.useDynamics = this.retrieveAndParseFromLocalStorage('useDynamics', false);
    this.language = localStorage.getItem('language') ?? 'en';
    this.isDarkMode = this.retrieveAndParseFromLocalStorage('isDarkMode', false);
    this.applyDarkMode(this.isDarkMode);
  }

  private parseStoredModeAndInstrument(): {
    mode: 'instrument' | 'tuner';
    instrument: LegacyInstrumentId;
  } {
    const savedMode = localStorage.getItem('mode');
    const savedInstrument = localStorage.getItem('selectedInstrument');
    const isInstrument = (value: string | null): value is LegacyInstrumentId =>
      value === 'trumpet' || value === 'clarinet' || value === 'oboe';

    let mode: 'instrument' | 'tuner' = 'instrument';
    let instrument: LegacyInstrumentId = 'trumpet';
    if (isInstrument(savedInstrument)) {
      instrument = savedInstrument;
    }
    if (savedMode === 'tuner' || savedInstrument === 'tuner') {
      mode = 'tuner';
    } else if (isInstrument(savedMode)) {
      instrument = savedMode;
    }
    return { mode, instrument };
  }

  private handleSettingsUpdated(): void {
    if (!this.isPlaying()) {
      this.loadStateFromLocalStorage();
    }
  }

  private applyExerciseConfiguration(): void {
    const instrument = this.instruments.fromLegacyId(this.selectedInstrument);
    this.NOTES = instrument.notes.map(note => [...note.displayTokens]);
    void this.soundsService.setInstrument(this.selectedInstrument);
    this.loadInstrumentSettings();
    this.currentNote = Math.min(this.currentNote, this.NOTES.length - 1);
    this.updateScore(this.currentNote);
    this.cdr.detectChanges();
  }

  private loadInstrumentSettings(): void {
    const key = this.exerciseNoteKey;
    this.lowNote = this.clampNoteIndex(
      this.retrieveAndParseFromLocalStorage(`${key}_lowNote`, INITIAL_NOTE)
    );
    this.highNote = this.clampNoteIndex(
      this.retrieveAndParseFromLocalStorage(`${key}_highNote`, INITIAL_NOTE)
    );
    if (this.lowNote > this.highNote) {
      this.highNote = this.lowNote;
    }
    const storedTempo = this.retrieveAndParseFromLocalStorage('tempo', 80);
    this.tempoSettings.setTempo(storedTempo);
  }

  private clampNoteIndex(value: number): number {
    return Math.max(0, Math.min(this.NOTES.length - 1, Number(value)));
  }

  retrieveAndParseFromLocalStorage(key: string, defaultValue: any): any {
    const storedValue = localStorage.getItem(key);
    return storedValue ? JSON.parse(storedValue) : defaultValue;
  }

  selectInstrument(event: CustomEvent): void {
    const instrument = event.detail.value;
    if (instrument !== 'trumpet' && instrument !== 'clarinet' && instrument !== 'oboe') {
      return;
    }
    this.selectedInstrument = instrument;
    this.applyExerciseConfiguration();
    this.saveCurrentStateToLocalStorage();
  }

  switchUseFlatsAndSharps(event: CustomEvent): void {
    this.useFlatsAndSharps = event.detail.checked;
    localStorage.setItem(
      'useFlatsAndSharps',
      JSON.stringify(this.useFlatsAndSharps)
    );
    if (!this.useFlatsAndSharps) {
      this.lowNote = this.nearestNaturalIndex(this.lowNote);
      this.highNote = this.nearestNaturalIndex(this.highNote);
      if (this.lowNote > this.highNote) {
        this.highNote = this.lowNote;
      }
      this.saveNotes();
    }
  }

  private nearestNaturalIndex(index: number): number {
    if (this.NOTES[index]?.length === 1) {
      return index;
    }
    for (let distance = 1; distance < this.NOTES.length; distance += 1) {
      const above = index + distance;
      if (above < this.NOTES.length && this.NOTES[above].length === 1) {
        return above;
      }
      const below = index - distance;
      if (below >= 0 && this.NOTES[below].length === 1) {
        return below;
      }
    }
    return index;
  }

  switchUseDynamics(event: CustomEvent): void {
    this.useDynamics = event.detail.checked;
    localStorage.setItem('useDynamics', JSON.stringify(this.useDynamics));
    if (!this.useDynamics) {
      this.updateScore(this.currentNote);
    }
  }

  switchDarkMode(event: CustomEvent): void {
    this.isDarkMode = event.detail.checked;
    localStorage.setItem('isDarkMode', JSON.stringify(this.isDarkMode));
    this.applyDarkMode(this.isDarkMode);
  }

  applyDarkMode(isDark: boolean): void {
    document.body.classList.toggle('dark-theme', isDark);
  }

  changeLowNote(index: number): void {
    this.lowNote = this.clampNoteIndex(index);
    if (!this.useFlatsAndSharps) {
      this.lowNote = this.nearestNaturalIndex(this.lowNote);
    }
    if (this.lowNote > this.highNote) {
      this.highNote = this.lowNote;
    }
    this.saveNotes();
  }

  changeHighNote(index: number): void {
    this.highNote = this.clampNoteIndex(index);
    if (!this.useFlatsAndSharps) {
      this.highNote = this.nearestNaturalIndex(this.highNote);
    }
    if (this.highNote < this.lowNote) {
      this.lowNote = this.highNote;
    }
    this.saveNotes();
  }

  saveNotes(): void {
    localStorage.setItem(`${this.exerciseNoteKey}_lowNote`, String(this.lowNote));
    localStorage.setItem(`${this.exerciseNoteKey}_highNote`, String(this.highNote));
  }

  updateScore(noteNumber: number): void {
    const notes = this.NOTES[noteNumber];
    if (!notes) {
      return;
    }
    const displayToken = notes[Math.floor(Math.random() * notes.length)];
    if (this.useDynamics) {
      const dynamic = DYNAMICS[Math.floor(Math.random() * DYNAMICS.length)];
      this.score = scoreFromNote(
        displayToken,
        this.exerciseNoteKey,
        dynamic.label
      );
    } else {
      this.score = scoreFromNote(displayToken, this.exerciseNoteKey);
    }
  }

  private saveCurrentStateToLocalStorage(): void {
    localStorage.setItem('selectedInstrument', this.selectedInstrument);
    localStorage.setItem('useFlatsAndSharps', JSON.stringify(this.useFlatsAndSharps));
    localStorage.setItem('useDynamics', JSON.stringify(this.useDynamics));
    localStorage.setItem('mode', this.exerciseMode);
    localStorage.setItem('refFrequencyValue', String(this.refFrequencyValue$));
    this.saveNotes();
  }

  async checkMuted(): Promise<void> {
    if (Capacitor.getPlatform() === 'android') {
      return;
    }
    try {
      const muted = await Mute.isMuted();
      if (!muted.value || this.muteAlert) {
        return;
      }
      this.muteAlert = true;
      const alert = await this.alertController.create({
        header: 'Sound Check',
        message: 'Make sure your sound is on to hear the instrument sounds.',
        buttons: ['OK']
      });
      await alert.present();
    } catch {
      // Native mute status is optional on unsupported platforms.
    }
  }

  private isIOSWebBrowser(): boolean {
    if (Capacitor.isNativePlatform()) {
      return false;
    }
    const userAgent = navigator.userAgent || navigator.vendor || '';
    return /iPad|iPhone|iPod/.test(userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  dismissIOSWebAudioHint(): void {
    this.showIOSWebAudioHint = false;
    sessionStorage.setItem('ios-web-audio-hint-dismissed', 'true');
  }

  get selectedInstrumentDisplayName(): string {
    return this.isTunerExercise()
      ? 'Tuner'
      : this.instrumentDisplayNames[this.selectedInstrument];
  }

  get exerciseNoteKey(): LegacyInstrumentId {
    return this.selectedInstrument;
  }

  isTunerExercise(): boolean {
    return this.exerciseMode === 'tuner';
  }

  getNoteImg(note: number): string {
    return `assets/images/clarinet_notes_images/_${this.NOTES[note]?.[0] ?? ''}.png`;
  }

  async openPicker(type: 'frequency' | 'tempo'): Promise<void> {
    if (this.isPlaying()) {
      return;
    }

    const selectedValue = type === 'frequency'
      ? this.refFrequencyValue$
      : this.tempoSettings.tempo$.value;
    const rangeValues = type === 'frequency'
      ? range(MINREFFREQUENCY, MAXREFFREQUENCY + 1, 1)
      : range(MINTEMPO, MAXTEMPO + 1, 5);
    const unit = type === 'frequency' ? 'Hz' : 'bpm';
    const options = rangeValues.map(value => ({
      value,
      text: `${value} ${unit}`
    }));

    const picker = await this.picker.create({
      cssClass: 'settings-picker-overlay',
      columns: [{
        name: type,
        options,
        selectedIndex: options.findIndex(option => option.value === selectedValue)
      }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Confirm',
          handler: value => {
            if (type === 'frequency') {
              this.refFrequencyValue$ = value[type].value;
              this.refFrequencyService.setRefFrequency(this.refFrequencyValue$);
              this.saveCurrentStateToLocalStorage();
            } else {
              this.tempoSettings.setTempo(value[type].value);
            }
          }
        }
      ]
    });
    await picker.present();
  }

  changeTempo(tempo: number): void {
    this.tempoSettings.setTempo(tempo);
  }

  async canDismiss(_data?: any, role?: string): Promise<boolean> {
    return role !== 'gesture';
  }

  goToProfile(): void {
    void this.router.navigate(['/profile']);
  }

  changeLanguage(event: CustomEvent): void {
    this.language = event.detail.value;
    localStorage.setItem('language', this.language);
  }
}
