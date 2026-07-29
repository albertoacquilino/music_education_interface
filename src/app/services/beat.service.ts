/**
 * This file is part of the Music Education Interface project.
 * Copyright (C) 2025 Alberto Acquilino
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { MAXTEMPO, MINTEMPO } from '../constants';

const DEFAULT_TEMPO = 80;

/**
 * Stores the user-selected tempo.
 *
 * Activity timing and phase semantics deliberately live in activity-specific
 * controllers. This legacy service name remains to avoid a settings migration.
 */
@Injectable({
  providedIn: 'root'
})
export class BeatService {
  readonly tempo$ = new BehaviorSubject<number>(this.storedTempo());

  setTempo(value: number): void {
    if (value > MAXTEMPO || value < MINTEMPO) {
      return;
    }

    this.tempo$.next(value);
    localStorage.setItem('tempo', value.toString());
  }

  private storedTempo(): number {
    const storedValue = Number(localStorage.getItem('tempo'));
    return Number.isFinite(storedValue)
      && storedValue >= MINTEMPO
      && storedValue <= MAXTEMPO
      ? storedValue
      : DEFAULT_TEMPO;
  }
}
