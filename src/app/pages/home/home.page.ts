/**
 * This file is part of the Music Education Interface project.
 * Copyright (C) 2025 Alberto Acquilino
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */
import { Component, OnInit, ViewChild } from '@angular/core';
import { AlertController, IonicModule, PickerController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Mute } from '@capgo/capacitor-mute';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCircleChevronDown, faCircleChevronUp } from '@fortawesome/free-solid-svg-icons';
import { range } from 'lodash';
import { Observable, interval, tap } from 'rxjs';
import { ChromaticTunerComponent } from 'src/app/components/chromatic-tuner/chromatic-tuner.component';
import { NoteSelectorComponent } from 'src/app/components/note-selector/note-selector.component';
import { ScoreViewComponent } from 'src/app/components/score/score.component';
import { SemaphoreLightComponent } from 'src/app/components/semaphore-light/semaphore-light.component';
import { SessionSummaryData, SessionSummaryModalComponent } from 'src/app/components/session-summary-modal/session-summary-modal.component';
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
    IonicModule, FontAwesomeModule,
    ScoreViewComponent,
    CommonModule, SemaphoreLightComponent,
    TrumpetDiagramComponent, TempoSelectorComponent, NoteSelectorComponent,
    ChromaticTunerComponent, SessionSummaryModalComponent],
})
/**
 * HomePage class represents the home page of the music education interface.
 */
export class HomePage implements OnInit {
  @ViewChild(ChromaticTunerComponent) private chromaticTuner!: ChromaticTunerComponent;

  /**
   * Indicates the mode - tuner or trumpet.
   * @default 'trumpet'
   */
  selectedInstrument = 'trumpet';
  language: string = 'en'; // Default language
  /**
   * Array of notes corresponding to the selected instrument.
   */
  NOTES: string[][] = TRUMPET_NOTES;

  /**
   * Current mode of the application.
   * @default 'trumpet'
   */
  mode = 'trumpet';

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
  
  /**
   * The audio context used for playing sounds.
   */
  audioContext = new AudioContext();

  /**
   * The FontAwesome icon for a circle chevron down.
   */
  faCircleChevronDown = faCircleChevronDown;

  /**
   * The FontAwesome icon for a circle chevron up.
   */
  faCircleChevronUp = faCircleChevronUp;

  /**
   * The observable for the tempo.
   */
  tempo$ = this._tempo.tempo$;

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

  /**
   * The trumpet position image path.
   */
  trumpetPosition ="assets/images/trumpet_positions/pos_1.png";

  /**
   * The clarinet position image path.
   */
  clarinetPosition = "assets/images/clarinet_positions/A3.svg";
  oboePosition = "assets/images/oboe_positions/A4.svg";
  /**
   * The score image path.
   */
  scoreImage = "assets/images/score_images/G2.svg";

  /**
   * The trumpet buttons to highlight for each note.
   */
  trumpetBtns: number[] = [];

  /**
   * The note images.
   */
  noteImages: string[] = this.getNoteImages();

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

  /**
   * An object to collect all the notes played.
   */
  collectedMeansObject: { [key: string]: number[] } = {};

  isSessionSummaryOpen = false;
  currentSessionSummary: SessionSummaryData = { score: 0, accuracy: 0 };
  previousSessionSummary: SessionSummaryData | null = null;
  private readonly lastSessionStorageKey = 'lastSession';

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
    private _sounds: SoundsService,
    public firebase: FirebaseService,
    private alertController: AlertController,
    private refFrequencyService: RefFreqService,
    private tabsService: TabsService,
    private pitchService: PitchService,
    private router: Router,
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
    }else if(instrument === 'oboe'){
      return OBOE_NOTES
    }
    return []; // Return an empty array if no valid instrument is selected
  }

  /**
   * Retrieves the note images for the selected instrument.
   * @returns An array of paths to note images.
   */
  private getNoteImages(): string[] {
    return this.NOTES.map(note => `assets/images/clarinet_notes_images/_${note[0]}.svg`);
  }

  /**
   * Lifecycle hook that is called after the component has been initialized.
   */
  ngOnInit(): void {
    console.log(localStorage.getItem('LoggedInUser '));
    this.refFrequencyService.getRefFrequency().subscribe(value => {
      this.refFrequencyValue$ = value;
    });
    this.loadStateFromLocalStorage();
  }

  /**
   * Loads the state from local storage.
   * @returns void
   */
  private loadStateFromLocalStorage() {
    const savedMode = localStorage.getItem('mode');
    const savedInstrument = localStorage.getItem('selectedInstrument');

    // Load the selected instrument and its settings
    if (savedInstrument) {
      this.selectedInstrument = savedInstrument;
      this.NOTES = this.getNotesForInstrument(this.selectedInstrument);
      this.noteImages = this.getNoteImages();
      this.soundsService.setInstrument(this.selectedInstrument);
    }
    // Load the mode
    if (savedMode) {
      this.mode = savedMode;
    } else {
      this.mode = this.selectedInstrument; // Default to the selected instrument if no saved mode
    }

    // Load settings based on the selected instrument
    this.loadInstrumentSettings(this.selectedInstrument);

    // Load common settings
    this.useFlatsAndSharps = this.retrieveAndParseFromLocalStorage('useFlatsAndSharps', false);
    this.useDynamics = this.retrieveAndParseFromLocalStorage('useDynamics', false);
    // dark mode state load & apply
    this.isDarkMode = this.retrieveAndParseFromLocalStorage('isDarkMode', false);
    this.applyDarkMode(this.isDarkMode);
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
  ionViewDidEnter(): void {}

  /**
   * Lifecycle hook that is called when the view is about to leave.
   * @returns void
   */
  ionViewWillLeave(): void {
    this._tempo.stop();
    if (this.mode == "tuner") this.chromaticTuner.stop();
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
    this.selectedInstrument = event.detail.value; // Store the selected instrument
    this.mode = this.selectedInstrument; // Set mode to the same value as selected instrument
    console.log('Selected Instrument:', this.selectedInstrument);
    this.NOTES = this.getNotesForInstrument(this.selectedInstrument);
    this.noteImages = this.getNoteImages();
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
    localStorage.setItem('tempo', this._tempo.tempo$.value.toString()); // Save tempo for the selected instrument
    localStorage.setItem('mode', this.mode);
    localStorage.setItem('refFrequencyValue', this.refFrequencyValue$.toString());
  }

  /**
   * Checks if the device is muted and displays an alert if it is.
   * @returns void
   */
  async checkMuted() {
    try {
      const muted = await Mute.isMuted();

      if (!muted.value || this.muteAlert) {
        return;
      }
      this.muteAlert = true;
      const alert = await this.alertController.create({
        header: 'Mute Alert',
        message: 'Your device is currently muted. Please unmute to hear the trumpet sounds.',
        buttons: ['OK'],
      });
      alert.present();
    } catch (e) {}
  }

  /**
   * Switches the mode of the application.
   * @param event - The event containing the new mode.
   * @returns void
   */
  switchMode(event: any) {
    if (this.mode == 'tuner') {
      this.chromaticTuner.stop();
    }
    this.mode = event.detail.value;
    this.saveCurrentStateToLocalStorage();
    console.log(event);
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
      this._sounds.setVolume(1.0);
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
    this.trumpetPosition = `assets/images/trumpet_positions/${trumpetImg}.png`;
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
    this.scoreImage = `assets/images/score_images/${scoreImage}.svg`;

    if (this.useDynamics) {
      const dynamic = DYNAMICS[Math.floor(Math.random() * DYNAMICS.length)];
      this._sounds.setVolume(dynamic.volume);
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
        this._sounds.currentNote = this.currentNote;
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
          if (this.mode == 'tuner') {
            const meansArray = this.chromaticTuner.stop();
            this.collectedMeansObject = {
              ...this.collectedMeansObject,
              [Object.keys(this.collectedMeansObject).length + 1]: meansArray
            };
          }
          break;
        case 1:
          this.currentAction = "Listen";
          break;
        case 2:
          this.currentAction = "Play";
          if (this.mode == 'tuner') {
            this.chromaticTuner.start();
          }
          break;
      }

      if (this.mode == this.selectedInstrument) {
        // Additional logic can be added here if needed
      }
    }

    if (tempo.cycle === MAXCYCLES) {
      this.firebase.saveStop('finished', this.collectedMeansObject);
      console.log('finished');
      console.log('Collected Means', this.collectedMeansObject);
      this.openSessionSummaryModal();
      this.tabsService.setDisabled(false);
    }
  }

  /**
   * Toggles between starting and stopping the tempo.
   * If the tempo is currently playing, it will stop it.
   * If the tempo is currently stopped, it will start it.
   * @returns void
   */
  startStop() {
    if (this._tempo.playing$.value) {
      this.stop();
      this.tabsService.setDisabled(false);
    } else {
      this.start();
      this.tabsService.setDisabled(true);
    }
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
   * Stops the tempo and all audio playback, and saves the stop event to Firebase.
   * @returns void
   */
  stop() {
    this._tempo.stop();
    if (this.mode == 'tuner') {
      const meansArray = this.chromaticTuner.stop();
      this.collectedMeansObject = {
        ...this.collectedMeansObject,
        [Object.keys(this.collectedMeansObject).length + 1]: meansArray
      };
      console.log('Collected Means', this.collectedMeansObject);
    }
    else if (this.mode == this.selectedInstrument) {
      // this.pitchService.disconnect();
    }
    Howler.stop();
    this.firebase.saveStop('interrupted', this.collectedMeansObject);
    this.openSessionSummaryModal();
  }

  onSessionSummaryClosed() {
    this.isSessionSummaryOpen = false;
    this.saveLastSession(this.currentSessionSummary);
  }

  private openSessionSummaryModal() {
    if (this.isSessionSummaryOpen) {
      return;
    }

    this.currentSessionSummary = this.buildCurrentSessionSummary();
    this.previousSessionSummary = this.loadLastSession();
    this.isSessionSummaryOpen = true;
  }

  private buildCurrentSessionSummary(): SessionSummaryData {
    const allMeans = Object.keys(this.collectedMeansObject).reduce((acc: number[], key: string) => {
      const values = this.collectedMeansObject[key];
      if (!Array.isArray(values)) {
        return acc;
      }

      return acc.concat(values);
    }, []);

    const validPitches = allMeans.filter((pitch) => Number.isFinite(pitch) && pitch > 0);
    if (validPitches.length === 0) {
      return { score: 0, accuracy: 0 };
    }

    const referenceA4 = Number.isFinite(this.refFrequencyValue$) && this.refFrequencyValue$ > 0
      ? this.refFrequencyValue$
      : 440;

    const inTuneCount = validPitches.reduce((count: number, pitch: number) => {
      const semitoneOffset = Math.round(12 * Math.log2(pitch / referenceA4));
      const nearestFrequency = referenceA4 * Math.pow(2, semitoneOffset / 12);
      const centsDifference = 1200 * Math.log2(pitch / nearestFrequency);
      return Math.abs(centsDifference) <= 10 ? count + 1 : count;
    }, 0);

    const accuracy = Number(((inTuneCount / validPitches.length) * 100).toFixed(1));

    return {
      score: inTuneCount,
      accuracy,
    };
  }

  private loadLastSession(): SessionSummaryData | null {
    try {
      const raw = localStorage.getItem(this.lastSessionStorageKey);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      const score = Number(parsed?.score);
      const accuracy = Number(parsed?.accuracy);

      if (!Number.isFinite(score) || !Number.isFinite(accuracy)) {
        return null;
      }

      return {
        score,
        accuracy,
      };
    } catch (_error) {
      return null;
    }
  }

  private saveLastSession(session: SessionSummaryData) {
    const score = Number(session?.score);
    const accuracy = Number(session?.accuracy);

    const safeSession: SessionSummaryData = {
      score: Number.isFinite(score) ? score : 0,
      accuracy: Number.isFinite(accuracy) ? Number(accuracy.toFixed(1)) : 0,
    };

    localStorage.setItem(this.lastSessionStorageKey, JSON.stringify(safeSession));
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
  switchToMode(mode_new: string) {
    if (this.isPlaying()) {
      return;
    }
    const event = {
      detail: {
        value: mode_new
      }
    };
    this.switchMode(event);
    this.saveCurrentStateToLocalStorage();
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
              if (this.mode==='tuner'){
                this.mode='tuner';
              }else{
                this.mode = this.selectedInstrument;
              }
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
   * Scales the content of the page based on the viewport size.
   * @returns void
   */
  scaleContent() {
    const container = document.getElementById('wrapper');

    const baseWidth = container!.offsetWidth;
    const baseHeight = container!.offsetHeight;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const scaleX = viewportWidth / baseWidth;
    const scaleY = viewportHeight / baseHeight * 0.8;

    let scale = Math.min(scaleX, scaleY);

    container!.style.transform = `scale(${scale})`;
    container!.style.position = 'absolute';
    container!.style.left = `calc(50% - ${baseWidth * scale / 2}px)`;
    container!.style.top = `calc(50% - ${baseHeight * scale / 2}px)`;
  }

  /**
   * Lifecycle hook that is called after the view has been initialized.
   * @returns void
   */
  ngAfterViewInit() {
    window.addEventListener('resize', () => this.scaleContent());
    window.addEventListener('load', () => this.scaleContent());

    setTimeout(() => this.scaleContent(), 250);
  }
  changeLanguage(event: any) {
    this.language = event.detail.value; // Update the language based on the selected value
    localStorage.setItem('language', this.language); // Optionally save the language to local storage
    console.log('Language:', this.language);
  }
}

