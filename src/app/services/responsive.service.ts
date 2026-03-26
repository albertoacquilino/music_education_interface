/**
 * This file is part of the Music Education Interface project.
 * Copyright (C) 2025 Alberto Acquilino
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */

import { Injectable } from '@angular/core';
import { fromEvent, BehaviorSubject } from 'rxjs';
import { map, throttleTime } from 'rxjs/operators';

export interface ScreenSize {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isPortrait: boolean;
  isLandscape: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ResponsiveService {
  private readonly MOBILE_BREAKPOINT = 480;
  private readonly TABLET_BREAKPOINT = 768;

  readonly screenSize$ = new BehaviorSubject<ScreenSize>(this.getScreenSize());

  constructor() {
    if (typeof window !== 'undefined') {
      fromEvent(window, 'resize')
        .pipe(
          throttleTime(200),
          map(() => this.getScreenSize())
        )
        .subscribe(size => this.screenSize$.next(size));
    }
  }

  private getScreenSize(): ScreenSize {
    const width = typeof window !== 'undefined' ? window.innerWidth : 768;
    const height = typeof window !== 'undefined' ? window.innerHeight : 1024;

    return {
      width,
      height,
      isMobile: width < this.MOBILE_BREAKPOINT,
      isTablet: width >= this.MOBILE_BREAKPOINT && width < this.TABLET_BREAKPOINT,
      isDesktop: width >= this.TABLET_BREAKPOINT,
      isPortrait: height > width,
      isLandscape: height <= width
    };
  }

  get screenSizeSync(): ScreenSize {
    return this.getScreenSize();
  }
}
