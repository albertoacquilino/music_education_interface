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
import { PitchService } from 'src/app/services/pitch.service';
import { RefFreqService } from 'src/app/services/ref-freq.service';
import { SoundsService } from 'src/app/services/sounds.service';
import { addIcons } from 'ionicons';
import { close, musicalNote, musicalNotes, optionsOutline, pulseOutline, radio, settingsOutline, textOutline, volumeHighOutline, moonOutline, eyeOutline, languageOutline } from 'ionicons/icons';
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
  selectedInstrument = 'trumpet';
  mode = 'trumpet';
  useFlatsAndSharps = false;
  useDynamics = false;
  isDarkMode = false;
  language = 'en';
  refFrequencyValue$ = 440;
  activeTab = 'exercise';
  readonly brandIcon = APP_BRAND_ICON;
  readonly brandIconSrcSetMobile = APP_BRAND_ICON_SRCSET_MOBILE;
  readonly brandIconSrcSetNav = APP_BRAND_ICON_SRCSET_NAV;
  instrumentSelectInterfaceOptions = { cssClass: 'settings-select-overlay' };
  nomenclatureSelectInterfaceOptions = { cssClass: 'settings-select-overlay' };

  /**
   * Creates an instance of TabsComponent.
   * @param tabsService - The service for managing tab states.
   * @param router - The router for navigation.
   * @param menu - The menu controller for managing side menus.
   */
  constructor(
    private tabsService: TabsService,
    private router: Router,
    private menu: MenuController,
    private pickerController: PickerController,
    private refFrequencyService: RefFreqService,
    private soundsService: SoundsService,
    private pitchService: PitchService,
  ) { }
  @ViewChild('tabs', { static: false }) tabs: IonTabs | undefined;

  ngOnInit(): void {
    addIcons({ close, musicalNote, musicalNotes, optionsOutline, pulseOutline, radio, settingsOutline, textOutline, volumeHighOutline, moonOutline, eyeOutline, languageOutline });
    this.refFrequencyService.getRefFrequency().subscribe(value => {
      this.refFrequencyValue$ = value;
    });
    this.loadStateFromLocalStorage();
    this.syncActiveTabFromUrl();
    this.routerSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.syncActiveTabFromUrl());
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  private syncActiveTabFromUrl(): void {
    const tab: 'exercise' | 'tuner' = this.router.url.includes('/tuner') ? 'tuner' : 'exercise';
    this.activeTab = tab;
    if (tab === 'tuner') {
      this.syncSettingsModeForTunerRoute();
    }
    void this.syncIonTabsSelection(tab);
  }

  /** Keeps the Options menu segment aligned with the standalone tuner route only. */
  private syncSettingsModeForTunerRoute(): void {
    if (this.mode !== 'tuner') {
      this.mode = 'tuner';
      this.saveStateToLocalStorage();
    }
  }

  private restoreInstrumentModeAfterTunerRoute(): void {
    if (this.mode === 'tuner') {
      this.mode = this.selectedInstrument;
      this.saveStateToLocalStorage();
    }
  }

  private async syncIonTabsSelection(tab: 'exercise' | 'tuner'): Promise<void> {
    try {
      await this.tabs?.select(tab);
    } catch {
      // Tab may already be selected or tabs not ready yet.
    }
  }

  /**
   * Checks if the tabs are disabled.
   * @returns {boolean} True if the tabs are disabled, otherwise false.
   */
  isDisabled(): boolean {
    return this.tabsService.getDisabled();
  }

  onTabsChange(event: { detail?: { tab?: string }; tab?: string }) {
    const tabId = event.detail?.tab ?? event.tab;
    if (!tabId) {
      return;
    }
    const tab: 'exercise' | 'tuner' = tabId === 'tuner' ? 'tuner' : 'exercise';
    void this.navigateToTab(tab, true);
  }

  async goToExercise() {
    await this.navigateToTab('exercise', true);
  }

  async goToTuner() {
    await this.navigateToTab('tuner', true);
  }

  private async navigateToTab(tab: 'exercise' | 'tuner', shouldNavigate: boolean): Promise<void> {
    if (this.isDisabled()) {
      return;
    }

    const wasOnTunerRoute = this.router.url.includes('/tuner');
    const routeChanged = !this.router.url.includes(`/${tab}`);
    this.activeTab = tab;

    if (tab === 'tuner') {
      this.syncSettingsModeForTunerRoute();
    } else if (wasOnTunerRoute) {
      this.restoreInstrumentModeAfterTunerRoute();
    }

    this.emitSettingsUpdated();

    if (tab === 'exercise') {
      await this.prepareExerciseMedia();
    } else {
      await this.prepareTunerMedia();
    }

    if (shouldNavigate && routeChanged) {
      await this.router.navigate(['/home', tab]);
    }

    await this.syncIonTabsSelection(tab);
  }

  async closeMenu() {
    await this.menu.close('settingsMenu');
  }

  private loadStateFromLocalStorage() {
    const savedInstrument = localStorage.getItem('selectedInstrument');
    const savedMode = localStorage.getItem('mode');
    const savedLanguage = localStorage.getItem('language');

    if (savedInstrument) {
      this.selectedInstrument = savedInstrument;
      this.soundsService.setInstrument(this.selectedInstrument);
    }

    this.mode = savedMode ?? this.selectedInstrument;
    this.useFlatsAndSharps = this.retrieveAndParseFromLocalStorage('useFlatsAndSharps', false);
    this.useDynamics = this.retrieveAndParseFromLocalStorage('useDynamics', false);
    this.isDarkMode = this.retrieveAndParseFromLocalStorage('isDarkMode', false);
    this.language = savedLanguage ?? 'en';
    this.applyDarkMode(this.isDarkMode);
  }

  private retrieveAndParseFromLocalStorage(key: string, defaultValue: any): any {
    const storedValue = localStorage.getItem(key);
    return storedValue ? JSON.parse(storedValue) : defaultValue;
  }

  private emitSettingsUpdated() {
    window.dispatchEvent(new CustomEvent('mei-settings-updated'));
  }

  private saveStateToLocalStorage() {
    localStorage.setItem('selectedInstrument', this.selectedInstrument);
    localStorage.setItem('mode', this.mode);
    localStorage.setItem('useFlatsAndSharps', JSON.stringify(this.useFlatsAndSharps));
    localStorage.setItem('useDynamics', JSON.stringify(this.useDynamics));
    localStorage.setItem('isDarkMode', JSON.stringify(this.isDarkMode));
    localStorage.setItem('language', this.language);
  }

  applyDarkMode(isDark: boolean) {
    if (isDark) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }

  selectInstrument(event: any) {
    this.selectedInstrument = event.detail.value;
    this.mode = this.selectedInstrument;
    this.soundsService.setInstrument(this.selectedInstrument);
    this.saveStateToLocalStorage();
    this.emitSettingsUpdated();
  }

  switchMode(event: { detail: { value?: string | number } }) {
    const value = event.detail.value == null ? '' : String(event.detail.value);
    if (!value) {
      return;
    }
    this.mode = value;
    this.saveStateToLocalStorage();
    this.emitSettingsUpdated();

    if (value === 'tuner') {
      void this.navigateToTab('tuner', true);
    } else if (this.router.url.includes('/tuner')) {
      void this.navigateToTab('exercise', true);
    }
  }

  switchUseFlatsAndSharps(event: any) {
    this.useFlatsAndSharps = event.detail.checked;
    this.saveStateToLocalStorage();
    this.emitSettingsUpdated();
  }

  switchUseDynamics(event: any) {
    this.useDynamics = event.detail.checked;
    this.saveStateToLocalStorage();
    this.emitSettingsUpdated();
  }

  switchDarkMode(event: any) {
    this.isDarkMode = event.detail.checked;
    this.applyDarkMode(this.isDarkMode);
    this.saveStateToLocalStorage();
    this.emitSettingsUpdated();
  }

  changeLanguage(event: any) {
    this.language = event.detail.value;
    this.saveStateToLocalStorage();
    this.emitSettingsUpdated();
  }

  async prepareExerciseMedia() {
    await this.soundsService.unlockAudio();
  }

  async prepareTunerMedia() {
    await this.soundsService.unlockAudio();
    const ua = navigator.userAgent;
    const isiPhoneOrIPad = /iPhone|iPad|iPod/i.test(ua);
    const isChromeOniOS = /CriOS/i.test(ua);

    if (isiPhoneOrIPad && isChromeOniOS && (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)) {
      alert('Chrome on iPhone/iPad requires HTTPS for microphone access. This local HTTP version may not allow the tuner. Please use Safari locally or test on a hosted HTTPS URL.');
      return;
    }

    try {
      await this.pitchService.primeMicrophoneAccess();
    } catch (error) {
      if (isiPhoneOrIPad && isChromeOniOS) {
        alert('Chrome on iPhone/iPad requires HTTPS for microphone access. This local HTTP version may not allow the tuner. Please use Safari locally or test on a hosted HTTPS URL.');
      } else {
        alert('Unable to access the microphone in this browser. Please allow microphone access and try again.');
      }
    }
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

  /**
   * Opens or closes the settings menu.
   * @returns {Promise<void>} A promise that resolves when the menu is opened or closed.
   */
  async openMenu() {
    if (await this.menu.isOpen('settingsMenu')) {
      await this.menu.close('settingsMenu');
    } else {
      await this.menu.open('settingsMenu');
    }
  }
}
