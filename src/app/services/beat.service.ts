/**
 * This file is part of the Music Education Interface project.
 * Copyright (C) 2025 Alberto Acquilino
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */

import { EventEmitter, Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, TimeInterval } from 'rxjs';
import { interval, take } from 'rxjs';
import { MAXTEMPO, MAXCYCLES, MINTEMPO } from '../constants';
import { AppBeat } from '../models/appbeat.types';

const DEFAULT_TEMPO = 80;

@Injectable({
  providedIn: 'root'
})
/**
 * Service that handles the beat of a music piece.
 */
export class BeatService {
  /**
   * The tempo of the beat as an observable.
   */
  public tempo$ = new BehaviorSubject<number>(this.storedTempo());

  /**
   * Whether the beat is currently playing as an observable.
   */
  public playing$ = new BehaviorSubject<boolean>(false);

  /**
   * Event emitter for each tick of the beat.
   */
  public tick$ = new EventEmitter<AppBeat>();

  private _interval!: Subscription;

  private set _playing(value: boolean) {
    this.playing$.next(value);
  }

  private get _playing(): boolean {
    return this.playing$.value;
  }

  public _beat: number = -1;
  public _measure: number = -1;
  public _cycle: number = -1;

  constructor() { }

  /**
   * Retrieves the stored tempo from local storage or returns the default tempo.
   * @returns {number} The stored tempo or the default tempo.
   */
  private storedTempo(): number {
    const tempo = localStorage.getItem('tempo');
    return tempo ? parseInt(tempo) : DEFAULT_TEMPO;
  }

  /**
   * Sets the tempo of the beat.
   * @param value - The new tempo value.
   * @returns void
   * @throws Will not set the tempo if the beat is currently playing or if the value is out of bounds.
   * @example
   * beatService.setTempo(120);
   */
  public setTempo(value: number) {
    if (this._playing) return;

    if (value > MAXTEMPO || value < MINTEMPO) return;

    this.tempo$.next(value);
    localStorage.setItem('tempo', value.toString());
  }

  /**
   * Starts the beat.
   * @returns void
   * @throws Will not start the beat if it is already playing.
   * @example
   * beatService.start();
   */
  public start() {
    if (this._playing) return;

    if (this._interval) this._interval.unsubscribe();

    this._playing = true;
    this._cycle = 0;
    this._beat = -1;
    this._measure = -1;

    this._interval =
      interval(60000 / this.tempo$.value)
        .subscribe(() => {
          this._beat = (this._beat + 1) % 4;
          if (this._beat == 0) {
            this._measure = (this._measure + 1) % 3;
            if (this._measure == 0) {
              this._cycle += 1;
              if (this._cycle == MAXCYCLES) {
                this.stop();
              }
            }
          }

          this.tick$.emit(({
            playing: true,
            measure: this._measure,
            beat: this._beat,
            cycle: this._cycle
          }));
        });
  }

  /**
   * Stops the beat.
   * @returns void
   * @throws Will not stop the beat if it is not currently playing.
   * @example
   * beatService.stop();
   */
  public stop() {
    if (!this._playing) return;

    this._playing = false;

    if (this._interval) {
      this._interval.unsubscribe();
    }

    this._beat = -1;
    this._measure = -1;
    this._cycle = -1;

    this.tick$.emit(({
      playing: false,
      measure: this._measure,
      beat: this._beat,
      cycle: this._cycle
    }))
  }
}
