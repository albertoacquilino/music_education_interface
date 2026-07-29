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
import { Capacitor } from '@capacitor/core';
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
   */
  constructor(private platform: Platform) {
    void this.configureStatusBar();
  }

  private async configureStatusBar(): Promise<void> {
    await this.platform.ready();

    if (!Capacitor.isNativePlatform()) {
      return;
    }

    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.show();
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
  }
}
