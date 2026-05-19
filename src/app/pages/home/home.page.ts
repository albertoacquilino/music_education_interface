/**
 * This file is part of the Music Education Interface project.
 * Copyright (C) 2025 Alberto Acquilino
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */
import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AlertController, IonicModule, PickerController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { Mute } from '@capgo/capacitor-mute';
import { Howler } from 'howler';
import { range } from 'lodash';
import { Observable, Subscription, interval, tap } from 'rxjs';
import { ChromaticTunerComponent } from 'src/app/components/chromatic-tuner/chromatic-tuner.component';
import { NoteSelectorComponent } from 'src/app/components/note-selector/note-selector.component';
import { ScoreViewComponent } from 'src/app/components/score/score.component';
import { SemaphoreLightComponent } from 'src/app/components/semaphore-light/semaphore-light.component';
import { TempoSelectorComponent } from 'src/app/components/tempo-selector/tempo-selector.component';
import { TrumpetDiagramComponent } from 'src/app/components/trumpet-diagram/trumpet-diagram.component';
import { AppBeat } from 'src/app/models/appbeat.types';
import { Score } from 'src/app/models/score.types';
import { FirebaseService } from 'src/app/services/firebase.service';
import { PitchService } from 'src/app/services/pitch.service';
import { RefFreqService } from 'src/app/services/ref-freq.service';
import { SoundsService } from 'src/app/services/sounds.service';
import { TabsService } from 'src/app/services/tabs.service';
import { scoreFromNote } from 'src/app/utils/score.utils';
import { DYNAMICS, INITIAL_NOTE, MAXCYCLES, MAXREFFREQUENCY, MAXTEMPO, MINREFFREQUENCY, MINTEMPO, TRUMPET_NOTES, CLARINET_NOTES, POSITIONS, TRUMPET_BTN, CLARINET_POSITIONS,OBOE_NOTES,OBOE_POSITIONS} from '../../constants';
import { BeatService } from '../../services/beat.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    IonicModule,
    ScoreViewComponent,
    CommonModule, SemaphoreLightComponent,
    TrumpetDiagramComponent, TempoSelectorComponent, NoteSelectorComponent,
    ChromaticTunerComponent],
})
/**
 * HomePage class represents the home page of the music education interface.
 */
export class HomePage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(ChromaticTunerComponent) private chromaticTuner!: ChromaticTunerComponent;
  private readonly boundRefreshSettings = () => this.handleSettingsUpdated();
  private beatSubscription?: Subscription;

  selectedInstrument = 'trumpet';
  private readonly instrumentDisplayNames: Record<string, string> = {
    trumpet: 'Trumpet',
    clarinet: 'Clarinet',
    oboe: 'Oboe',
    tuner: 'Tuner',
  };
  language: string = 'en'; // Default language
  /**
   * Array of notes corresponding to the selected instrument.
   */
  NOTES: string[][] = TRUMPET_NOTES;

  /**
   * Indicates whether the mute alert has been triggered.
   */
  muteAlert = false;

  /**
   * Indicates whether to use flats and sharps.
   */
  useFlatsAndSharps = false;

  /**
   * Indicates whether dynamics are enabled.
   */
  useDynamics = false;
  
  /**
   * Indicates whether dark mode is enabled.
   */
  isDarkMode = false;

  // Shared CSS hook so options-menu selects can be themed in light and dark mode.
  instrumentSelectInterfaceOptions = { cssClass: 'settings-select-overlay' };
  nomenclatureSelectInterfaceOptions = { cssClass: 'settings-select-overlay' };
  
  /**
   * The audio context used for playing sounds.
   */
  audioContext = new AudioContext();

  /**
   * The FontAwesome icon for a circle chevron down.
   */
  /**
   * The observable for the tempo.
   */
  tempo$ = this._tempo.tempo$;
  soundsLoading$ = this.soundsService.loading$;

  /**
   * The high note.
   */
  highNote = INITIAL_NOTE;

  /**
   * The low note.
   */
  lowNote = INITIAL_NOTE;

  /**
   * The current note.
   */
  currentNote: number = INITIAL_NOTE;

  /**
   * The score.
   */
  score: Score = scoreFromNote(this.NOTES[this.currentNote][0], this.selectedInstrument);

  /**
   * The audio nodes.
   */
  audioNodes = {};

  /**
   * The current action.
   */
  currentAction = '';

  clarinetPosition = "assets/images/clarinet_positions/A3.svg";
  oboePosition = "assets/images/oboe_positions/A4.svg";

  /**
   * The trumpet buttons to highlight for each note.
   */
  trumpetBtns: number[] = [];

  /**
   * The observable for the beat.
   */
  beat$!: Observable<AppBeat>;

  /**
   * The observable for playing state.
   */
  playing$!: Observable<boolean>;

  /**
   * The observable for the reference frequency.
   */
  refFrequencyValue$!: number;

  showIOSWebAudioHint = false;

  // Pitch feedback during exercise
  pitchCents = 0;
  pitchAccuracyClass: 'in-tune' | 'close' | 'far' | 'waiting' = 'waiting';
  pitchFeedbackLabel = 'Waiting';
  pitchBarPosition = 50;
  private pitchSubscription: Subscription | null = null;

  /**
   * An object to collect all the notes played.
   */
  collectedMeansObject: { [key: string]: number[] } = {};

  /**
   * Creates an instance of HomePage.
   * @param _picker - The picker controller.
   * @param _tempo - The beat service.
   * @param _sounds - The sounds service.
   * @param firebase - The Firebase service.
   * @param alertController - The alert controller.
   * @param refFrequencyService - The Reference Frequency Service.
   */
  constructor(
    private soundsService: SoundsService,
    private _picker: PickerController,
    private _tempo: BeatService,
    public firebase: FirebaseService,
    private alertController: AlertController,
    private refFrequencyService: RefFreqService,
    private tabsService: TabsService,
    private pitchService: PitchService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {
    this.NOTES = this.getNotesForInstrument(this.selectedInstrument);
  
    this.beat$ = this._tempo.tick$.pipe(
      tap((tempo: AppBeat) => this.intervalHandler(tempo))
    );
    this.playing$ = this._tempo.playing$.asObservable();

    interval(1000).subscribe(async () => this.checkMuted());
  }

  /**
   * Retrieves the notes for the selected instrument.
   * @param instrument - The instrument to get notes for.
   * @returns An array of notes for the specified instrument.
   */
  private getNotesForInstrument(instrument: string | null): string[][] {
    if (instrument === 'trumpet') {
      return TRUMPET_NOTES; // Use trumpet notes
    } else if (instrument === 'clarinet') {
      return CLARINET_NOTES; // Use clarinet notes
    } else if (instrument === 'oboe') {
      return OBOE_NOTES;
    } else if (instrument === 'tuner') {
      return TRUMPET_NOTES;
    }
    return [];
  }

  /**
   * Lifecycle hook that is called after the component has been initialized.
   */
  ngOnInit(): void {
    console.log(localStorage.getItem('LoggedInUser '));
    this.refFrequencyService.getRefFrequency().subscribe(value => {
      this.refFrequencyValue$ = value;
    });
    this.showIOSWebAudioHint = this.isIOSWebBrowser()
      && sessionStorage.getItem('ios-web-audio-hint-dismissed') !== 'true';
    this.loadStateFromLocalStorage();
    this.beatSubscription = this.beat$.subscribe();
  }

  ngOnDestroy(): void {
    window.removeEventListener('mei-settings-updated', this.boundRefreshSettings);
    this.beatSubscription?.unsubscribe();
  }

  /**
   * Loads the state from local storage.
   * @returns void
   */
  private loadStateFromLocalStorage() {
    const savedMode = localStorage.getItem('mode');
    const savedInstrument = localStorage.getItem('selectedInstrument');
    const savedLanguage = localStorage.getItem('language');

    // Load the selected instrument and its settings
    if (savedInstrument) {
      this.selectedInstrument = savedInstrument;
    }

    // Legacy: exercise tuner was stored in `mode`, not as an instrument.
    if (savedMode === 'tuner' && this.selectedInstrument !== 'tuner') {
      this.selectedInstrument = 'tuner';
    }

    this.NOTES = this.getNotesForInstrument(this.selectedInstrument);
    this.soundsService.setInstrument(this.selectedInstrument);

    // Load settings based on the selected instrument
    this.loadInstrumentSettings(this.selectedInstrument);

    // Load common settings
    this.useFlatsAndSharps = this.retrieveAndParseFromLocalStorage('useFlatsAndSharps', false);
    this.useDynamics = this.retrieveAndParseFromLocalStorage('useDynamics', false);
    this.language = savedLanguage ?? 'en';
    // dark mode state load & apply
    this.isDarkMode = this.retrieveAndParseFromLocalStorage('isDarkMode', false);
    this.applyDarkMode(this.isDarkMode);
  }

  private handleSettingsUpdated() {
    this.loadStateFromLocalStorage();
  }
  
  /**
   * Toggles the Dark Mode.
   * @param event - The event containing the checked state.
   * @returns void
   */
  switchDarkMode(event: any) {
    this.isDarkMode = event.detail.checked;
    localStorage.setItem('isDarkMode', JSON.stringify(this.isDarkMode));
    this.applyDarkMode(this.isDarkMode);
    console.log('Dark Mode:', this.isDarkMode ? 'ON' : 'OFF');
  }

  /**
   * Applies the dark theme CSS class to the document body.
   * @param isDark - Boolean indicating if dark mode should be active.
   * @returns void
   */
  applyDarkMode(isDark: boolean) {
    if (isDark) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }

  /**
   * Loads instrument-specific settings.
   * @param instrument - The instrument to load settings for.
   * @returns void
   */
  private loadInstrumentSettings(instrument: string) {
    // Load low and high notes specific to the instrument
    this.lowNote = this.retrieveAndParseFromLocalStorage(`${instrument}_lowNote`, INITIAL_NOTE);
    this.highNote = this.retrieveAndParseFromLocalStorage(`${instrument}_highNote`, INITIAL_NOTE);
    // Tempo is common for both instruments
    const tempoSaved = this.retrieveAndParseFromLocalStorage('tempo', MINTEMPO);
    if (tempoSaved !== MINTEMPO) {
      this._tempo.setTempo(tempoSaved);
    }
  }

  /**
   * Lifecycle hook that is called when the view has entered.
   * @returns void
   */
  /**
   * Lifecycle hook that is called when the view is about to leave.
   * @returns void
   */
  ionViewWillLeave(): void {
    this._tempo.stop();
    if (this.isTunerExercise()) {
      this.chromaticTuner?.stop();
    }
  }

  /**
   * Retrieves and parses a value from local storage.
   * @param key - The key to retrieve the value for.
   * @param defaultValue - The default value to return if the key does not exist.
   * @returns The parsed value from local storage or the default value.
   */
  retrieveAndParseFromLocalStorage(key: string, defaultValue: any): any {
    const storedValue = localStorage.getItem(key);
    return storedValue ? JSON.parse(storedValue) : defaultValue;
  }

  /**
   * Selects an instrument based on user input.
   * @param event - The event containing the selected instrument.
   * @returns void
   */
  selectInstrument(event: any) {
    this.selectedInstrument = event.detail.value;
    console.log('Selected Instrument:', this.selectedInstrument);
    this.NOTES = this.getNotesForInstrument(this.selectedInstrument);
    this.soundsService.setInstrument(this.selectedInstrument);

    // Load settings for the newly selected instrument
    this.loadInstrumentSettings(this.selectedInstrument);

    // Save the current state to local storage
    this.saveCurrentStateToLocalStorage();
  }

  /**
   * Saves the current state to local storage.
   * @returns void
   */
  private saveCurrentStateToLocalStorage() {
    localStorage.setItem('selectedInstrument', this.selectedInstrument);
    localStorage.setItem('useFlatsAndSharps', JSON.stringify(this.useFlatsAndSharps));
    localStorage.setItem('useDynamics', JSON.stringify(this.useDynamics));
    localStorage.setItem(`${this.selectedInstrument}_lowNote`, this.lowNote.toString());
    localStorage.setItem(`${this.selectedInstrument}_highNote`, this.highNote.toString());
    localStorage.setItem('tempo', this._tempo.tempo$.value.toString());
    localStorage.setItem('mode', this.selectedInstrument);
    localStorage.setItem('refFrequencyValue', this.refFrequencyValue$.toString());
  }

  /**
   * Checks if the device is muted and displays an alert if it is.
   * @returns void
   */
  async checkMuted() {
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
        buttons: ['OK'],
      });
      alert.present();
    } catch (e) {}
  }

  private isIOSWebBrowser(): boolean {
    if (Capacitor.isNativePlatform()) {
      return false;
    }

    const userAgent = navigator.userAgent || navigator.vendor || '';
    return /iPad|iPhone|iPod/.test(userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  dismissIOSWebAudioHint() {
    this.showIOSWebAudioHint = false;
    sessionStorage.setItem('ios-web-audio-hint-dismissed', 'true');
  }

  /**
   * Toggles the use of flats and sharps.
   * @param event - The event containing the checked state.
   * @returns void
   */
  switchUseFlatsAndSharps(event: any) {
    this.useFlatsAndSharps = event.detail.checked;
    localStorage.setItem('useFlatsAndSharps', JSON.stringify(this.useFlatsAndSharps));
    console.log(event);
    if (!this.useFlatsAndSharps) {
      // Check that low and high notes are not on accidentals
      // If they are, move them up by a half step
      if (this.NOTES[this.lowNote].length == 2) {
        this.lowNote++;
      }
      if (this.NOTES[this.highNote].length == 2) {
        this.highNote++;
      }
    }
  }

  /**
   * Toggles the use of dynamics.
   * @param event - The event containing the checked state.
   * @returns void
   */
  switchUseDynamics(event: any) {
    this.useDynamics = event.detail.checked;
    localStorage.setItem('useDynamics', JSON.stringify(this.useDynamics));
    if (!this.useDynamics) {
      this.score = scoreFromNote(this.NOTES[this.currentNote][0], this.selectedInstrument);
      this.soundsService.setVolume(1.0);
    }
  }

  /**
   * Changes the low note to the specified index.
   * @param index - The new index for the low note.
   * @returns void
   */
  changeLowNote(index: number) {
    this.lowNote = index;
    if (!this.useFlatsAndSharps) {
      if (this.NOTES[this.lowNote].length == 2) {
        this.lowNote++;
      }
    }
    if (this.lowNote > this.highNote) {
      this.highNote = this.lowNote;
    }
    this.saveNotes();
  }

  /**
   * Changes the high note to the specified index.
   * @param index - The new index for the high note.
   * @returns void
   */
  changeHighNote(index: number) {
    this.highNote = index;
    if (!this.useFlatsAndSharps) {
      if (this.NOTES[this.highNote].length == 2) {
        this.highNote--;
      }
    }

    if (this.highNote < this.lowNote) {
      this.lowNote = this.highNote;
    }
    this.saveNotes();
  }

  /**
   * Saves the current low and high notes to local storage.
   * @returns void
   */
  saveNotes() {
    localStorage.setItem(`${this.selectedInstrument}_lowNote`, this.lowNote.toString());
    localStorage.setItem(`${this.selectedInstrument}_highNote`, this.highNote.toString());
  }

  /**
   * Updates the position of the trumpet image based on the given note.
   * @param note - The note to update the trumpet position to.
   * @returns void
   */
  updateTrumpetPosition(note: number) {
    const trumpetImg = POSITIONS[note];
    this.trumpetBtns = TRUMPET_BTN[note];
  }

  /**
   * Updates the position of the clarinet image based on the given note.
   * @param note - The note to update the clarinet position to.
   * @returns void
   */
  updateClarinetPosition(note: number) {
    const clarinetImg = CLARINET_POSITIONS[note];
    this.clarinetPosition = `assets/images/clarinet_positions/${clarinetImg}.svg`;
  }
    updateOboePosition(note: number) {
    const oboeImg = OBOE_POSITIONS[note];
    this.oboePosition = `assets/images/oboe_positions/${oboeImg}.svg`;
  }

  /**
   * Updates the score image based on the given note.
   * @param noteNumber - The index of the note to use for updating the score image.
   * @returns void
   */
  updateScore(noteNumber: number) {
    const _notes = this.NOTES[noteNumber];
    const scoreImage = _notes.length == 1 ? _notes[0] : _notes[Math.floor(Math.random() * 2)];
    if (this.useDynamics) {
      const dynamic = DYNAMICS[Math.floor(Math.random() * DYNAMICS.length)];
      this.soundsService.setVolume(dynamic.volume);
      this.score = scoreFromNote(scoreImage,this.selectedInstrument, dynamic.label);
    } else {
      this.score = scoreFromNote(scoreImage, this.selectedInstrument);
    }
  }

  /**
   * Generates a random note within the range of lowNote and highNote.
   * @returns {number} The generated note index.
   */
  nextNote() {
    const next = Math.round(Math.random() * (this.highNote - this.lowNote)) + this.lowNote;
    if (!this.useFlatsAndSharps) {
      if (this.NOTES[next].length == 2) {
        return next + 1;
      }
    }
    return next;
  }

  /**
   * Handles the interval for the given tempo.
   * @param {AppBeat} tempo - The tempo to handle the interval for.
   * @returns void
   */
  intervalHandler(tempo: AppBeat) {
    if (tempo.beat == 0) {
      if (tempo.measure == 0) {
        this.currentNote = this.nextNote();
        this.soundsService.currentNote = this.currentNote;
        this.updateScore(this.currentNote);
        if (this.selectedInstrument === "trumpet") {
          this.updateTrumpetPosition(this.currentNote);
        } else if (this.selectedInstrument === "clarinet") {
          this.updateClarinetPosition(this.currentNote);
        }else if(this.selectedInstrument === "oboe"){
          this.updateOboePosition(this.currentNote);
        }
      }

      switch (tempo.measure) {
        case 0:
          this.currentAction = "Rest";
          if (this.isTunerExercise()) {
            const meansArray = this.chromaticTuner.stopCapture();
            if (meansArray.length > 0) {
              this.collectedMeansObject = {
                ...this.collectedMeansObject,
                [Object.keys(this.collectedMeansObject).length + 1]: meansArray
              };
            }
          } else {
            this.setPitchFeedbackWaiting('Waiting');
          }
          break;
        case 1:
          this.currentAction = "Listen";
          if (!this.isTunerExercise()) {
            this.setPitchFeedbackWaiting('Listen');
          }
          break;
        case 2:
          this.currentAction = "Play";
          if (this.isTunerExercise()) {
            this.chromaticTuner.startCapture();
          } else {
            this.setPitchFeedbackWaiting('Waiting');
            this.startPitchFeedback();
          }
          break;
      }
    }

    if (tempo.cycle === MAXCYCLES) {
      this.firebase.saveStop('finished', this.collectedMeansObject);
      console.log('finished');
      console.log('Collected Means', this.collectedMeansObject);
      this.tabsService.setDisabled(false);
      this.teardownAfterExercise();
    }
  }

  /**
   * Toggles between starting and stopping the tempo.
   * If the tempo is currently playing, it will stop it.
   * If the tempo is currently stopped, it will start it.
   * @returns void
   */
  async startStop() {
    if (this._tempo.playing$.value) {
      this.stop();
      this.tabsService.setDisabled(false);
      this.cdr.markForCheck();
      return;
    }

    try {
      await this.soundsService.unlockAudio();
      await this.soundsService.ensureSoundsReady();

      if (!this.isTunerExercise()) {
        await this.pitchService.primeMicrophoneAccess();
        await this.pitchService.connect();
      }

      this.start();
      this.tabsService.setDisabled(true);
      this.cdr.detectChanges();

      if (this.isTunerExercise() && this.chromaticTuner) {
        await this.chromaticTuner.prepare();
      }
    } catch (error) {
      console.error('Failed to start exercise', error);
      this._tempo.stop();
      this.tabsService.setDisabled(false);
    }

    this.cdr.markForCheck();
  }

  /**
   * Starts the tempo and saves the current state to Firebase.
   * @returns void
   */
  start() {
    this.collectedMeansObject = {};
    this._tempo.start();
    this.firebase.saveStart(
      this.tempo$.value,
      this.lowNote,
      this.highNote,
      this.refFrequencyValue$,
      this.useFlatsAndSharps,
      this.useDynamics
    );
  }

  /**
   * Converts an app note name to frequency in Hz.
   * Handles formats: C4, C4s, D4f, B3f, etc.
   */
  private noteNameToFrequency(noteName: string): number {
    const match = noteName.match(/^([A-Ga-g])(#|s|b|f)?(\d+)$/);
    if (!match) return 0;

    const letter = match[1].toUpperCase();
    const accidental = match[2];
    const octave = parseInt(match[3], 10);

    const semitoneMap: { [key: string]: number } = {
      'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11
    };

    let semitone = semitoneMap[letter];
    if (accidental === '#' || accidental === 's') semitone += 1;
    if (accidental === 'b' || accidental === 'f') semitone -= 1;

    const midi = (octave + 1) * 12 + semitone;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  private startPitchFeedback() {
    if (this.pitchSubscription) {
      return;
    }

    this.pitchSubscription = this.pitchService.pitch$.subscribe(pitch => {
      if (this.currentAction !== 'Play') {
        return;
      }

      if (pitch <= 0 || this.currentNote < 0 || this.currentNote >= this.NOTES.length) {
        this.setPitchFeedbackWaiting('Waiting');
        return;
      }

      const targetNoteName = this.NOTES[this.currentNote][0];
      const targetFreq = this.noteNameToFrequency(targetNoteName);
      if (targetFreq <= 0) return;

      const cents = 1200 * Math.log2(pitch / targetFreq);
      this.pitchCents = cents;

      // Map cents (-50 to +50) to bar position (0% to 100%)
      const clampedCents = Math.max(-50, Math.min(50, cents));
      this.pitchBarPosition = 50 + (clampedCents / 50) * 50;

      if (cents >= -10 && cents <= 10) {
        this.pitchAccuracyClass = 'in-tune';
        this.pitchFeedbackLabel = 'In Tune';
      } else if (cents >= -30 && cents <= 30) {
        this.pitchAccuracyClass = 'close';
        this.pitchFeedbackLabel = cents > 0 ? 'Sharp' : 'Flat';
      } else {
        this.pitchAccuracyClass = 'far';
        this.pitchFeedbackLabel = cents > 0 ? 'Too Sharp' : 'Too Flat';
      }
    });
  }

  private stopPitchFeedback() {
    this.pitchSubscription?.unsubscribe();
    this.pitchSubscription = null;
    this.resetPitchFeedback();
  }

  private setPitchFeedbackWaiting(label = 'Waiting') {
    this.pitchCents = 0;
    this.pitchAccuracyClass = 'waiting';
    this.pitchFeedbackLabel = label;
    this.pitchBarPosition = 50;
  }

  private resetPitchFeedback() {
    this.setPitchFeedbackWaiting('Waiting');
  }

  private resetInstrumentVisual() {
    if (this.selectedInstrument === 'trumpet') {
      this.trumpetBtns = [];
    } else if (this.selectedInstrument === 'clarinet') {
      this.clarinetPosition = 'assets/images/clarinet_positions/A3.svg';
    } else if (this.selectedInstrument === 'oboe') {
      this.oboePosition = 'assets/images/oboe_positions/A4.svg';
    }
  }

  private teardownAfterExercise() {
    this.stopPitchFeedback();
    this.resetInstrumentVisual();
    this.currentAction = '';
  }

  /**
   * Stops the tempo and all audio playback, and saves the stop event to Firebase.
   * @returns void
   */
  stop() {
    this._tempo.stop();
    if (this.isTunerExercise() && this.chromaticTuner) {
      const meansArray = this.chromaticTuner.stop();
      if (meansArray.length > 0) {
        this.collectedMeansObject = {
          ...this.collectedMeansObject,
          [Object.keys(this.collectedMeansObject).length + 1]: meansArray
        };
      }
      console.log('Collected Means', this.collectedMeansObject);
    }

    // Disconnect pitch feedback
    this.pitchSubscription?.unsubscribe();
    this.pitchSubscription = null;
    this.pitchService.disconnect();
    this.resetPitchFeedback();

    this.teardownAfterExercise();

    Howler.stop();
    this.firebase.saveStop('interrupted', this.collectedMeansObject);
    this.cdr.markForCheck();
  }

  /** Display name for the selected instrument (idle screen label). */
  get selectedInstrumentDisplayName(): string {
    return this.instrumentDisplayNames[this.selectedInstrument]
      ?? this.selectedInstrument.charAt(0).toUpperCase() + this.selectedInstrument.slice(1);
  }

  /** Exercise uses the chromatic tuner instrument (not trumpet/clarinet/oboe diagrams). */
  isTunerExercise(): boolean {
    return this.selectedInstrument === 'tuner';
  }

  /**
   * Returns a boolean indicating whether the tempo is currently playing or not.
   * @returns {boolean} A boolean indicating whether the tempo is currently playing.
   */
  isPlaying(): boolean {
    return this._tempo.playing$.value;
  }
  //return this.NOTES.map(note => `
  getNoteImg(note: number): string {
   return 'assets/images/clarinet_notes_images/_${this.NOTES[note][0]}.png';
    //return `assets/images/${this.NOTES}_notes_images/_${this.NOTES[note][0]}.png`;
  }
  /**
   * Opens a picker for selecting frequency or tempo.
   * @param type - The type of picker to open ('frequency' or 'tempo').
   * @returns void
   */
  async openPicker(type: 'frequency' | 'tempo') {
    if (this.isPlaying()) {
      return;
    }

    let options: { value: number, text: string }[];
    let selectedIndex = 0;
    let selectedValue: number;
    let rangeValues: number[] = [];
    let unit: string;

    if (type === 'frequency') {
      selectedValue = this.refFrequencyValue$;
      rangeValues = range(MINREFFREQUENCY, MAXREFFREQUENCY + 1, 1);
      unit = 'Hz';
    } else if (type === 'tempo') {
      selectedValue = this.tempo$.value;
      rangeValues = range(MINTEMPO, MAXTEMPO + 1, 5);
      unit = 'bpm';
    }

    options = rangeValues.map(value => ({
      value: value,
      text: `${value} ${unit}`
    }));

    selectedIndex = options.findIndex(option => option.value === selectedValue);

    const picker = await this._picker.create({
      cssClass: 'settings-picker-overlay',
      columns: [
        {
          name: type,
          options: options,
          selectedIndex: selectedIndex
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Confirm',
          handler: (value) => {
            if (type === 'frequency') {
              this.refFrequencyValue$ = value[type].value;
              this.refFrequencyService.setRefFrequency(this.refFrequencyValue$);
              this.saveCurrentStateToLocalStorage();
            } else if (type === 'tempo') {
              this._tempo.setTempo(value[type].value);
            }
          }
        },
      ],
    });

    await picker.present();
  }

  /**
   * Changes the tempo to the specified value.
   * @param tempo - The new tempo value.
   * @returns void
   */
  changeTempo(tempo: number) {
    this._tempo.setTempo(tempo);
  }

  /**
   * Determines whether the modal can be dismissed or not.
   * @param data - Optional data passed to the modal.
   * @param role - Optional role of the modal.
   * @returns A Promise that resolves to a boolean indicating whether the modal can be dismissed.
   */
  async canDismiss(data?: any, role?: string) {
    return role !== 'gesture';
  }

  /**
   * Navigates to the user profile page.
   * @returns void
   */
  goToProfile() {
    this.router.navigate(['/profile']);
  }

  /**
   * Lifecycle hook that is called after the view has been initialized.
   * @returns void
   */
  ngAfterViewInit() {
    window.addEventListener('mei-settings-updated', this.boundRefreshSettings);
  }

  changeLanguage(event: any) {
    this.language = event.detail.value; // Update the language based on the selected value
    localStorage.setItem('language', this.language); // Optionally save the language to local storage
    console.log('Language:', this.language);
  }
}
