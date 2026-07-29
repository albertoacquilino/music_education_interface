/**
 * This file is part of the Music Education Interface project.
 * Copyright (C) 2025 Alberto Acquilino
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */

import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, IonTabs, MenuController, PickerController } from '@ionic/angular';
import { TabsService } from 'src/app/services/tabs.service';
import { NavigationEnd, Router } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { range } from 'lodash';
import {
  APP_BRAND_ICON,
  APP_BRAND_ICON_SRCSET_MOBILE,
  APP_BRAND_ICON_SRCSET_NAV,
  MAXREFFREQUENCY,
  MINREFFREQUENCY,
} from 'src/app/constants';
import { RefFreqService } from 'src/app/services/ref-freq.service';
import { SoundsService } from 'src/app/services/sounds.service';
import { addIcons } from 'ionicons';
import { close, musicalNote, musicalNotes, optionsOutline, pulseOutline, settingsOutline, textOutline, volumeHighOutline, moonOutline, eyeOutline, languageOutline } from 'ionicons/icons';

type ExerciseMode = 'instrument' | 'tuner';
const INSTRUMENT_OPTIONS = ['trumpet', 'clarinet', 'oboe'] as const;

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  imports: [IonicModule, CommonModule],
  standalone: true
})
/**
 * TabsComponent class represents the tab navigation interface of the music education application.
 */
export class TabsComponent implements OnInit, OnDestroy {
  private routerSub?: Subscription;
  exerciseMode: ExerciseMode = 'instrument';
  selectedInstrument = 'trumpet';
  useFlatsAndSharps = false;
  useDynamics = false;
  isDarkMode = false;
  language = 'en';
  refFrequencyValue$ = 440;
  readonly brandIcon = APP_BRAND_ICON;
  readonly brandIconSrcSetMobile = APP_BRAND_ICON_SRCSET_MOBILE;
  readonly brandIconSrcSetNav = APP_BRAND_ICON_SRCSET_NAV;
  instrumentSelectInterfaceOptions = { cssClass: 'settings-select-overlay' };
  nomenclatureSelectInterfaceOptions = { cssClass: 'settings-select-overlay' };

  constructor(
    private tabsService: TabsService,
    private router: Router,
    private menu: MenuController,
    private pickerController: PickerController,
    private refFrequencyService: RefFreqService,
    private soundsService: SoundsService,
  ) { }
  @ViewChild('tabs', { static: false }) tabs: IonTabs | undefined;

  ngOnInit(): void {
    addIcons({ close, musicalNote, musicalNotes, optionsOutline, pulseOutline, settingsOutline, textOutline, volumeHighOutline, moonOutline, eyeOutline, languageOutline });
    this.refFrequencyService.getRefFrequency().subscribe(value => {
      this.refFrequencyValue$ = value;
    });
    this.loadStateFromLocalStorage();
    this.ensureExerciseRoute();
    this.routerSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.ensureExerciseRoute());
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  private ensureExerciseRoute(): void {
    if (!this.router.url.includes('/home/exercise')) {
      void this.router.navigate(['/home', 'exercise'], { replaceUrl: true });
    }
    void this.syncIonTabsSelection();
  }

  private async syncIonTabsSelection(): Promise<void> {
    try {
      await this.tabs?.select('exercise');
    } catch {
      // Tab may already be selected or tabs not ready yet.
    }
  }

  isDisabled(): boolean {
    return this.tabsService.getDisabled();
  }

  isInstrumentSelectDisabled(): boolean {
    return this.exerciseMode === 'tuner';
  }

  onTabsChange(event: { detail?: { tab?: string }; tab?: string }) {
    const tabId = event.detail?.tab ?? event.tab;
    if (tabId === 'exercise' && !this.router.url.includes('/home/exercise')) {
      void this.router.navigate(['/home', 'exercise']);
    }
  }

  async closeMenu() {
    await this.menu.close('settingsMenu');
  }

  private loadStateFromLocalStorage() {
    const { mode, instrument } = this.parseStoredModeAndInstrument();
    this.exerciseMode = mode;
    this.selectedInstrument = instrument;
    this.applyExerciseModeToSounds();
    this.useFlatsAndSharps = this.retrieveAndParseFromLocalStorage('useFlatsAndSharps', false);
    this.useDynamics = this.retrieveAndParseFromLocalStorage('useDynamics', false);
    this.isDarkMode = this.retrieveAndParseFromLocalStorage('isDarkMode', false);
    this.language = localStorage.getItem('language') ?? 'en';
    this.applyDarkMode(this.isDarkMode);
  }

  private parseStoredModeAndInstrument(): { mode: ExerciseMode; instrument: string } {
    const savedMode = localStorage.getItem('mode');
    const savedInstrument = localStorage.getItem('selectedInstrument');

    let mode: ExerciseMode = 'instrument';
    let instrument = 'trumpet';

    if (savedInstrument && savedInstrument !== 'tuner' && INSTRUMENT_OPTIONS.includes(savedInstrument as typeof INSTRUMENT_OPTIONS[number])) {
      instrument = savedInstrument;
    }

    if (savedMode === 'tuner') {
      mode = 'tuner';
    } else if (savedMode === 'instrument') {
      mode = 'instrument';
    } else if (savedInstrument === 'tuner') {
      mode = 'tuner';
    } else if (savedMode && INSTRUMENT_OPTIONS.includes(savedMode as typeof INSTRUMENT_OPTIONS[number])) {
      mode = 'instrument';
      instrument = savedMode;
    }

    return { mode, instrument };
  }

  private retrieveAndParseFromLocalStorage(key: string, defaultValue: any): any {
    const storedValue = localStorage.getItem(key);
    return storedValue ? JSON.parse(storedValue) : defaultValue;
  }

  private emitSettingsUpdated() {
    window.dispatchEvent(new CustomEvent('mei-settings-updated'));
  }

  private saveStateToLocalStorage() {
    localStorage.setItem('mode', this.exerciseMode);
    localStorage.setItem('selectedInstrument', this.selectedInstrument);
    localStorage.setItem('useFlatsAndSharps', JSON.stringify(this.useFlatsAndSharps));
    localStorage.setItem('useDynamics', JSON.stringify(this.useDynamics));
    localStorage.setItem('isDarkMode', JSON.stringify(this.isDarkMode));
    localStorage.setItem('language', this.language);
  }

  private applyExerciseModeToSounds() {
    this.soundsService.setInstrument(this.selectedInstrument);
  }

  applyDarkMode(isDark: boolean) {
    if (isDark) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }

  async switchMode(event: CustomEvent) {
    const mode = event.detail.value as ExerciseMode;
    if (mode !== 'instrument' && mode !== 'tuner') {
      return;
    }

    this.exerciseMode = mode;
    this.applyExerciseModeToSounds();

    if (mode === 'tuner') {
      await this.prepareTunerMedia();
    } else {
      await this.prepareExerciseMedia();
    }

    this.saveStateToLocalStorage();
    this.emitSettingsUpdated();
  }

  selectInstrument(event: CustomEvent) {
    if (this.isInstrumentSelectDisabled()) {
      return;
    }

    const value = event.detail.value;
    if (!INSTRUMENT_OPTIONS.includes(value)) {
      return;
    }

    this.selectedInstrument = value;
    this.applyExerciseModeToSounds();
    this.saveStateToLocalStorage();
    this.emitSettingsUpdated();
  }

  switchUseFlatsAndSharps(event: CustomEvent) {
    this.useFlatsAndSharps = event.detail.checked;
    this.saveStateToLocalStorage();
    this.emitSettingsUpdated();
  }

  switchUseDynamics(event: CustomEvent) {
    this.useDynamics = event.detail.checked;
    this.saveStateToLocalStorage();
    this.emitSettingsUpdated();
  }

  switchDarkMode(event: CustomEvent) {
    this.isDarkMode = event.detail.checked;
    this.applyDarkMode(this.isDarkMode);
    this.saveStateToLocalStorage();
    this.emitSettingsUpdated();
  }

  changeLanguage(event: CustomEvent) {
    this.language = event.detail.value;
    this.saveStateToLocalStorage();
    this.emitSettingsUpdated();
  }

  async prepareExerciseMedia() {
    await this.soundsService.unlockAudio();
  }

  async prepareTunerMedia() {
    // The active activity controller acquires microphone access from the
    // trusted Start gesture. The settings view only unlocks shared audio.
    await this.soundsService.unlockAudio();
  }

  async openPicker(type: 'frequency') {
    if (this.isDisabled()) {
      return;
    }

    const options = range(MINREFFREQUENCY, MAXREFFREQUENCY + 1, 1).map(value => ({
      value,
      text: `${value} Hz`,
    }));

    const selectedIndex = options.findIndex(option => option.value === this.refFrequencyValue$);

    const picker = await this.pickerController.create({
      cssClass: 'settings-picker-overlay',
      columns: [
        {
          name: type,
          options,
          selectedIndex,
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
            this.refFrequencyValue$ = value[type].value;
            this.refFrequencyService.setRefFrequency(this.refFrequencyValue$);
            localStorage.setItem('refFrequencyValue', this.refFrequencyValue$.toString());
            this.emitSettingsUpdated();
          }
        },
      ],
    });

    await picker.present();
  }

  async openMenu() {
    if (await this.menu.isOpen('settingsMenu')) {
      await this.menu.close('settingsMenu');
    } else {
      await this.menu.open('settingsMenu');
    }
  }
}
