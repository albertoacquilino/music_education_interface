/**
 * This file is part of the Music Education Interface project.
 * Copyright (C) 2025 Alberto Acquilino
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */

import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, HostListener, Input } from '@angular/core';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { filter } from 'rxjs/operators';
import { Flow } from 'vexflow';
import { Score } from 'src/app/models/score.types';
import { generateNotes } from 'src/app/utils/score.utils';
//@ts-ignore
import { RenderContext, Renderer } from 'vexflow';

/**
 * ScoreViewComponent is responsible for displaying a musical score interface.
 * It allows users to view a musical score and updates the score when changes are made.
 * 
 * @example
 * <score-view [score]="score"></score-view>
 */
@Component({
  selector: 'score-view',
  template: `
    <div id="score" class="score-surface"></div>
    <div *ngIf="displayNoteName" class="score-note-name">
      <strong>{{ displayNoteName }}</strong>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      width: 100%;
      height: 100%;
      min-height: 0;
    }

    .score-surface {
      flex: 1 1 auto;
      min-height: 0;
      width: 100%;
      background-color: white;
    }

    .score-note-name {
      flex: 0 0 auto;
      min-height: 2.35rem;
      margin-top: 0.25rem;
      padding: 0 0 0.45rem;
      text-align: center;
      color: #111111;
      font-size: clamp(1.3rem, 2.6vw, 1.8rem);
      line-height: 1.1;
      letter-spacing: 0.02em;
    }
  `],
  standalone: true,
  imports: [CommonModule]
})
export class ScoreViewComponent implements AfterViewInit {
  private size$ = new BehaviorSubject<{ width: number, height: number }>({ width: 0, height: 0 });

  private score$ = new BehaviorSubject<Score | null>(null);

  /**
   * Input property for the musical score.
   * 
   * This property accepts a Score object that contains the musical data to be displayed.
   * When the score is updated, the component will re-render the score.
   * 
   * @param _score - The Score object containing the measures, clef, key signature,
   *                 time signature, dynamic, and dynamic position.
   */
  @Input() set score(_score: Score) {
    this.score$.next(_score);
  }
  @Input() instrument: string = 'clarinet';
  @Input() language: string = 'en';
  private _renderer!: Renderer;
  private _context!: RenderContext;
  displayNoteName = '';
  /**
   * Constructor for the ScoreViewComponent.
   * 
   * @param hostElement - The ElementRef of the host element, used to determine the size of the component.
   */
  constructor(private hostElement: ElementRef) { }

  @HostListener('window:resize')
  /**
   * Sets the size of the score component based on the dimensions of the host element.
   * This method is triggered whenever the window is resized, ensuring the score
   * is displayed correctly in the available space.
   */
  setSize() {
    const hostRect = this.hostElement.nativeElement.getBoundingClientRect();
    const noteLabelReserve = 38;
    const size = {
      width: Math.max(hostRect.width, 220),
      height: Math.max(hostRect.height - noteLabelReserve, 96)
    };

    this.size$.next(size);
  }

  /**
   * Updates the size of the score component.
   * 
   * This method is called to resize the renderer based on the new dimensions provided.
   * It ensures that the score is displayed correctly within the component's bounds.
   * 
   * @param size - An object containing the new width and height of the score component.
   */
  updateSize(size: { width: number, height: number }) {
    if (size.height === 0 || size.width === 0) {
      return;
    }
    this._renderer.resize(size.width, size.height);
  }

  /**
   * Lifecycle hook that is called after the view has been initialized.
   * 
   * This method initializes the VexFlow renderer and context, subscribes to changes
   * in size and score, and sets the size of the component after a short delay.
   */
  ngAfterViewInit(): void {
    const div = document.getElementById("score");
    if (!div) {
      throw new Error("Div not found");
    }
    this._renderer = new Flow.Renderer(div as HTMLDivElement, Flow.Renderer.Backends.SVG);
    this._context = this._renderer.getContext();

    combineLatest([this.size$, this.score$]).pipe(
      filter(([_, score]) => score !== null),
    ).subscribe(([size, score]) => {
      this.updateSize(size);
      this.updateScore(score as Score)

      // aleksandra - not use cuz of document selector - didnt find other way :(
      // const dynamic = document.querySelector('#score > svg > text')
      // if (dynamic) {
      //   dynamic.setAttribute('font-style', 'italic')
      // }
    });

    setTimeout(() => {
      this.setSize();
    }, 1000);
  }

  /**
   * Updates the score with the given Score object.
   * 
   * This method clears the previous score from the context and draws the new score
   * based on the provided Score object. It handles the rendering of measures, clefs,
   * key signatures, time signatures, and dynamics.
   * 
   * @param score - The Score object containing the measures, clef, key signature,
   *                time signature, dynamic, and dynamic position.
   */
  updateScore(score: Score) {
    if (!this._context) {
      return;
    }
    this._context.clear();
    const measureWidth = (this.size$.value.width - 20) / score.measures.length;
    this.displayNoteName = this.getDisplayNoteName(score);

    let staveMeasure = null;

    for (const [index, measure] of score.measures.entries()) {
      if (staveMeasure === null) {
        staveMeasure = new Flow.Stave(10, 20, measureWidth);
        if (score.clef) {
          staveMeasure.addClef(score.clef);
        }
        if (score.keySignature) {
          staveMeasure.addKeySignature(score.keySignature);
        }
        if (score.timeSignature) {
          staveMeasure.addTimeSignature(score.timeSignature);
        }
      } else {
        staveMeasure = new Flow.Stave(staveMeasure.getWidth() + staveMeasure.getX(), 20, measureWidth);
      }

      // Handle dynamics
      if (score.dynamic) {
        if (score.dynamicPosition === undefined) {
          score.dynamicPosition = 1;
        }
        if (score.dynamicPosition === index + 1) {
          staveMeasure.setText(score.dynamic,
            Flow.Modifier.Position.BELOW, {
            shift_y: 30,
            shift_x: (-measureWidth / 2) + 10,
          });
        }
      }

      staveMeasure
        .setContext(this._context)
        .draw();

      const notesMeasure = measure.map((measure) => generateNotes(measure.notes, measure.duration));
      Flow.Formatter.FormatAndDraw(this._context, staveMeasure, notesMeasure);
    }

// // After all measures drawn (i.e. after your for loop)
// setTimeout(() => {
//   const svg = document.querySelector("#score > svg");
//   if (!svg) return;
//   svg.querySelectorAll("text").forEach((textEl: any) => {
//     const val = textEl.textContent?.trim();
//     if (val === "mf" || val === "f" || val === "p") {
//       textEl.setAttribute("font-style", "italic");
//       textEl.setAttribute("font-weight", "bold");
//       // textEl.setAttribute("font-size", "22px");
//     }
//   });
// }, 1);
// === MutationObserver version, no need for setTimeout! ===
const div = document.getElementById("score");
if (!div) return;

// Observer callback function
const observer = new MutationObserver((mutations, obs) => {
  const svg = div.querySelector("svg");
  if (svg) {
    svg.querySelectorAll("text").forEach((textEl: any) => {
      const val = textEl.textContent?.trim();
      if (val === "mf" || val === "f" || val === "p") {
        textEl.setAttribute("font-style", "italic");
        textEl.setAttribute("font-weight", "bold");
      }
    });
    obs.disconnect(); // Stop observing once done!
  }
});

observer.observe(div, { childList: true, subtree: true });


  }

  private getDisplayNoteName(score: Score): string {
    let noteToken = '';

    for (const measureGroup of score.measures) {
      for (const measure of measureGroup) {
        if (measure.duration.includes('r')) {
          continue;
        }

        const note = measure.notes[0];
        if (note && !note.endsWith('r')) {
          noteToken = note;
          break;
        }
      }

      if (noteToken) {
        break;
      }
    }

    if (!noteToken) {
      return '';
    }

    const rawName = noteToken.split('/')[0].toUpperCase();
    return this.formatNoteName(rawName);
  }

  private formatNoteName(noteName: string): string {
    if (this.language !== 'it') {
      return noteName;
    }

    switch (noteName) {
      case 'C':
        return 'Do';
      case 'D':
        return 'Re';
      case 'E':
        return 'Mi';
      case 'F':
        return 'Fa';
      case 'G':
        return 'Sol';
      case 'A':
        return 'La';
      case 'B':
        return 'Si';
      case 'CB':
        return 'Do b';
      case 'DB':
        return 'Re b';
      case 'EB':
        return 'Mi b';
      case 'FB':
        return 'Fa b';
      case 'GB':
        return 'Sol b';
      case 'AB':
        return 'La b';
      case 'BB':
        return 'Si b';
      case 'C#':
        return 'Do #';
      case 'D#':
        return 'Re #';
      case 'E#':
        return 'Mi #';
      case 'F#':
        return 'Fa #';
      case 'G#':
        return 'Sol #';
      case 'A#':
        return 'La #';
      case 'B#':
        return 'Si #';
      default:
        return noteName;
    }
  }
}
