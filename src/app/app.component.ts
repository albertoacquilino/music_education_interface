/**
 * This file is part of the Music Education Interface project.
 * Copyright (C) 2025 Alberto Acquilino
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */

import { AfterViewInit, Component } from '@angular/core';
import { IonicModule, Platform } from '@ionic/angular';
import { StatusBar } from '@capacitor/status-bar';
import { Microphone, PermissionStatus } from '@mozartec/capacitor-microphone';
import { PitchService } from './services/pitch.service';
import { KeepAwake } from '@capacitor-community/keep-awake';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [IonicModule],
})
/**
 * Main application component that initializes the app and manages microphone permissions.
 */
export class AppComponent implements AfterViewInit {
  /**
   * Creates an instance of AppComponent.
   * @param {Platform} platform - The platform service to check the current platform.
   * @param {PitchService} pitchService - The service for pitch detection.
   */
  constructor(private platform: Platform, private pitchService: PitchService) {
    StatusBar.show(); // Show the status bar
  }

  /**
   * Lifecycle hook that is called after the component's view has been fully initialized.
   * This method checks for microphone permissions and starts the pitch monitoring service.
   * @returns {Promise<void>} A promise that resolves when the initialization is complete.
   * @example
   * await appComponent.ngAfterViewInit();
   */
  async ngAfterViewInit(): Promise<void> {
    // Keep the screen awake using the KeepAwake plugin
    await KeepAwake.keepAwake();

    // Check and request microphone permissions on Android and iOS platforms
    if (this.platform.is('android') || this.platform.is('ios')) {
      const checkPermissionsResult = await Microphone.checkPermissions();
      if (checkPermissionsResult.microphone === 'denied') {
        const requestPermissionsResult = await Microphone.requestPermissions();
        if (requestPermissionsResult.microphone === 'denied') {
          alert('Microphone permissions denied: Some features may not work as expected');
          return; // Exit if permissions are denied
        }
      }
    }

    // start the pitch monitoring service
    // pitch monitoring will be started by the exercise component when needed
  }
}
