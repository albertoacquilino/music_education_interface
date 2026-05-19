/**
 * This file is part of the Music Education Interface project.
 * Copyright (C) 2025 Alberto Acquilino
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */

import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { IonModal, IonicModule } from '@ionic/angular';
import { TRUMPET_NOTES, CLARINET_NOTES,OBOE_NOTES } from 'src/app/constants';
import { ScrollImageComponent } from '../scroll-image-selector/scroll-image-selector.component';

/**
 * NoteSelectorComponent is responsible for displaying a note selector interface.
 * It allows users to select musical notes and emits changes when a note is selected.
 * 
 * @example
 * <note-selector [label]="Note" [note]="1" [selectedInstrument]="selectedInstrument" (change)="onNoteChange($event)"></note-selector>
 */
@Component({
  selector: 'note-selector',
  template: `
      <div class="simulate-input">
        <div class="title-section-wrapper">{{this.label}}</div>
        <div [id]="_id" expand="block" class="note-image">
          <img id="note-image-id" [src]="getNoteImg(note)">
        </div>
        <ion-modal [trigger]="_id"
            #noteModal
            [canDismiss]="canDismiss"
            cssClass="note-modal"
            (willPresent)="resetDraftNote()"
            [handle]="false"
            >
            <ng-template>
              <div class="modal-shell">
                <div class="modal-toolbar">
                  <ion-button fill="clear" size="small" (click)="cancelSelection()">Cancel</ion-button>
                  <ion-button fill="clear" size="small" (click)="confirmSelection()">Confirm</ion-button>
                </div>
                <scroll-image-component
                  [images]="noteImages"
                  [index]="draftNote"
                  (indexChange)="draftNote = $event"
                ></scroll-image-component>
              </div>
          </ng-template>
        </ion-modal>
      </div>
  `,
  styles: [`

  
  .note-image {
    display: flex;
    align-items: center;
    justify-content: center; 
    width: 90%;
    height: auto;
    padding: 1em;
    box-sizing: border-box;
  }

  .title-section-wrapper {
    font-size: 1em;
    text-align: center;
    margin-bottom: 0.1em;
  }

  #note-image-id {
    width: 90%;
    max-width: 100%;
    height: auto;
    object-fit: contain;
  }

  .simulate-input {
    background-color: #fff;
    border: 2px solid #009dda;
    border-radius: 6px;
    padding: 1px 1px;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    color: black;
    width: 90%;
    max-width: 250px;
    box-sizing: border-box;
    margin:auto;
    max-height:250px;
  }

  .modal-shell {
    background-color: var(--note-modal-bg, #ffffff);
    color: var(--note-modal-text, #000000);
  }

  .modal-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.35rem 0.5rem;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  }

  .modal-toolbar ion-button {
    margin: 0;
    --padding-start: 0.4rem;
    --padding-end: 0.4rem;
    font-weight: 500;
  }

  @media screen and (max-width: 480px) {
    .simulate-input {
      width: 100%;
      max-width: none;
      max-height: none;
      aspect-ratio: 1 / 1;
      padding: 6px;
    }

    .title-section-wrapper {
      font-size: 0.95rem;
    }

    .note-image {
      width: 100%;
      flex: 1;
      min-height: 0;
      padding: 0.35rem;
    }

    #note-image-id {
      width: 100%;
    }

    .modal-toolbar {
      padding: 0.25rem 0.35rem;
    }
  }
@media screen and (orientation: landscape) {
    .simulate-input {
      width: 85%;
      max-width: 250px;
     
      padding: 10px;
     
    }
  }
  @media screen and (min-width: 768px) {
    .simulate-input {
      width: 80%;
      max-width: 230px;
    }

    .title-section-wrapper {
      font-size: 1.1em;
    }
  }
      @media screen and (min-width: 900px) {
    .simulate-input {
      width: 80%;
      max-width: 300px;
    }

    .title-section-wrapper {
      font-size: 1.1em;
    }
  }
    @media screen and (min-width: 1200px) {
    .simulate-input {
      width: 80%;
      max-width: 400px;
    }

    .title-section-wrapper {
      font-size: 1.5em;
    }
  }
    @media screen and (min-width: 1200px) {
    .simulate-input {
      width: 68%;
      max-width: 600px;
    }

    .title-section-wrapper {
      font-size: 1.5em;
    }
  }
`],
  
  standalone: true,
  imports: [
    ScrollImageComponent, CommonModule, IonicModule
  ]
})
export class NoteSelectorComponent implements OnInit {
  @ViewChild('noteModal') noteModal?: IonModal;
  private _selectedInstrument: string = 'trumpet'; // Default instrument
  _id = `note-selector-${Math.round(Math.random() * 100)}`;
  draftNote: number = 0;
  
  /**
   * The label for the note selector.
   * @type {string}
   */
  @Input() label: string = '';

  /**
   * The currently selected note index.
   * @type {number}
   */
  @Input() note!: number;

  /**
   * Flag to indicate whether to use flats and sharps.
   * @type {boolean}
   */
  @Input() useFlatsAndSharps: boolean = true;

  /**
   * The selected instrument for the note selector.
   * Updates the note images when the instrument changes.
   * @type {string}
   */
  @Input() set selectedInstrument(value: string) {
    this._selectedInstrument = value;
    this.updateNoteImages(); // Update note images when the instrument changes
  }

  /**
   * Event emitted when the selected note changes.
   * @type {EventEmitter<number>}
   */
  @Output() change: EventEmitter<number> = new EventEmitter<number>();

  noteImages: string[] = []; // Initialize as an empty array

  constructor() { }

  /**
   * Initializes the component and sets up the note images based on the selected instrument.
   */
  ngOnInit() {
    this.updateNoteImages(); // Initialize note images based on the default instrument
    this.draftNote = this.note;
  }

  /**
   * Updates the note images based on the selected instrument.
   * It sets the noteImages array to the corresponding images for the selected instrument.
   */
  private updateNoteImages() {
    let notes;
  
    if (this._selectedInstrument === 'trumpet') {
      notes = TRUMPET_NOTES;
    } else if (this._selectedInstrument === 'clarinet') {
      notes = CLARINET_NOTES;
    } else if (this._selectedInstrument === 'oboe') {
      notes = OBOE_NOTES;
    } else if (this._selectedInstrument === 'tuner') {
      notes = TRUMPET_NOTES;
    } else {
      console.warn('Unknown instrument:', this._selectedInstrument);
      return;
    }
    this.noteImages = notes.map(note => `assets/images/clarinet_notes_images/_${note[0]}.svg`);
  }

  /**
   * Gets the image source for the currently selected note.
   * @param {number} note - The index of the note.
   * @returns {string} The image source for the note.
   */
  getNoteImg(note: number): string {
    return note >= 0 && note < this.noteImages.length ? this.noteImages[note] : '';
  }

  resetDraftNote() {
    this.draftNote = this.note;
  }

  async cancelSelection() {
    this.draftNote = this.note;
    await this.noteModal?.dismiss(undefined, 'cancel');
  }

  async confirmSelection() {
    if (this.draftNote !== this.note) {
      this.change.emit(this.draftNote);
    }
    await this.noteModal?.dismiss(undefined, 'confirm');
  }

  /**
   * Determines whether the modal can be dismissed or not.
   * @param {any} data - Optional data passed to the modal.
   * @param {string} role - Optional role of the modal.
   * @returns {Promise<boolean>} A Promise that resolves to a boolean indicating whether the modal can be dismissed or not.
   */
  async canDismiss(data?: any, role?: string): Promise<boolean> {
    return role !== 'gesture';
  }
}
