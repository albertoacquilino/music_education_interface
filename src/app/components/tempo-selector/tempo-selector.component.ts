/**
 * This file is part of the Music Education Interface project.
 * Copyright (C) 2025 Alberto Acquilino
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */

import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { IonicModule, PickerController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { range } from 'lodash';
import { MAXTEMPO, MINTEMPO } from 'src/app/constants';

// Preset tempos with simple, clear labels
const TEMPO_PRESETS = [
  { name: 'Very Slow', bpm: 45 },
  { name: 'Slow', bpm: 76 },
  { name: 'Medium', bpm: 108 },
  { name: 'Fast', bpm: 132 },
  { name: 'Very Fast', bpm: 168 }
];

/**
 * TempoSelectorComponent is responsible for displaying an enhanced tempo selector interface.
 * It features a smooth slider, preset tempo buttons, and real-time BPM display.
 * 
 * @example
 * <tempo-selector [tempo]="120" (change)="onTempoChange($event)"></tempo-selector>
 */
@Component({
  selector: 'tempo-selector',
  template: `
  <div class="tempo-container">
    <div class="tempo-header">
      <div class="title-section">Tempo</div>
      <div class="tempo-display">
        <span class="note-symbol">&#9833;</span>=
        <span class="tempo-value">{{ tempo }}</span>
        <span class="tempo-unit">bpm</span>
      </div>
    </div>

    <div class="slider-container">
      <ion-range
        [min]="minTempo"
        [max]="maxTempo"
        [value]="tempo"
        [pin]="true"
        [pinFormatter]="pinFormatter"
        [color]="'primary'"
        (ionChange)="onSliderChange($event)"
        (ionKnobMoveEnd)="onSliderRelease()"
      >
        <ion-label slot="start">{{ minTempo }}</ion-label>
        <ion-label slot="end">{{ maxTempo }}</ion-label>
      </ion-range>
    </div>

    <div class="tempo-presets">
      <ion-button
        *ngFor="let preset of presets"
        size="small"
        fill="outline"
        [color]="tempo === preset.bpm ? 'primary' : 'medium'"
        (click)="setPreset(preset.bpm)"
        class="preset-button"
      >
        <div class="preset-content">
          <div class="preset-name">{{ preset.name }}</div>
          <div class="preset-bpm">{{ preset.bpm }}</div>
        </div>
      </ion-button>
    </div>
  </div>
  `,
  styles: [`
  .tempo-container {
    background-color: #fff;
    border: 2px solid #009dda;
    border-radius: 6px;
    padding: 12px;
    color: black;
    min-width: 280px;
  }

  .tempo-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .title-section {
    font-size: 1em;
    font-weight: normal;
    color: black;
  }

  .tempo-display {
    display: flex;
    align-items: baseline;
    gap: 4px;
    font-weight: normal;
  }

  .note-symbol {
    font-size: 1.2em;
    color: black;
  }

  .tempo-value {
    font-size: 1.5em;
    color: black;
    min-width: 45px;
    text-align: center;
  }

  .tempo-unit {
    font-size: 0.9em;
    color: black;
  }

  .slider-container {
    margin: 16px 0;
  }

  ion-range {
    --bar-background: #e0e0e0;
    --bar-background-active: #009dda;
    --bar-height: 4px;
    --bar-border-radius: 2px;
    --knob-background: #009dda;
    --knob-size: 24px;
    --pin-background: #009dda;
    --pin-color: white;
  }

  ion-range::part(tick) {
    background: #d0d0d0;
  }

  ion-range::part(tick-active) {
    background: #009dda;
  }

  ion-label {
    font-size: 0.85em;
    color: #666;
  }

  .tempo-presets {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 12px;
    justify-content: space-between;
  }

  .preset-button {
    --padding-start: 8px;
    --padding-end: 8px;
    --padding-top: 6px;
    --padding-bottom: 6px;
    height: auto;
    min-width: 52px;
    font-size: 0.75em;
    flex: 1;
  }

  .preset-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.2;
  }

  .preset-name {
    font-weight: 600;
    font-size: 0.9em;
  }

  .preset-bpm {
    font-size: 0.85em;
    opacity: 0.8;
  }

  /* Animation for tempo value change */
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
  }

  .tempo-value.changed {
    animation: pulse 0.3s ease-in-out;
  }
  `],
  standalone: true,
  imports: [
    IonicModule, CommonModule, FormsModule
  ]
})
export class TempoSelectorComponent implements OnInit {
  /**
   * The current tempo value in beats per minute (bpm).
   * 
   * This property is bound to the tempo displayed in the component.
   */
  @Input() tempo!: number;

  /**
   * Event emitted when the tempo value changes.
   * 
   * This event is emitted with the new tempo value when the user confirms their selection.
   */
  @Output() change: EventEmitter<number> = new EventEmitter<number>();

  /**
   * Minimum tempo value
   */
  readonly minTempo = MINTEMPO;

  /**
   * Maximum tempo value
   */
  readonly maxTempo = MAXTEMPO;

  /**
   * Tempo presets for quick selection
   */
  readonly presets = TEMPO_PRESETS;

  /**
   * Tracks if slider is being actively dragged
   */
  private isDragging = false;

  /**
   * Constructor for the TempoSelectorComponent.
   * 
   * @param _picker - The PickerController used to create and manage the tempo picker.
   */
  constructor(
    private _picker: PickerController,
  ) { }

  /**
   * Lifecycle hook that is called after the component has been initialized.
   * 
   * This method can be used to perform any additional initialization tasks.
   */
  ngOnInit() { }

  pinFormatter = (value: number) => {
    return `${Math.round(value)} bpm`;
  }

  onSliderChange(event: any) {
    this.isDragging = true;
    const newTempo = Math.round(event.detail.value);
    if (newTempo !== this.tempo) {
      this.tempo = newTempo;
    }
  }

  /**
   * Handles slider release - emits final tempo value
   */
  onSliderRelease() {
    if (this.isDragging) {
      this.isDragging = false;
      this.change.emit(this.tempo);
    }
  }

  setPreset(bpm: number) {
    this.tempo = bpm;
    this.change.emit(this.tempo);
  }

  async openPicker() {
    // Create list of options to be selected
    let options: { value: number, text: string }[];
    let selectedIndex = 0;
    let selectedValue: number;
    let rangeValues: number[] = [];
    let unit: string;

    selectedValue = this.tempo;
    rangeValues = range(MINTEMPO, MAXTEMPO + 1, 5);
    unit = 'bpm';

    // Map the range values to options for the picker
    options = rangeValues.map(value => ({
      value: value,
      text: `${value} ${unit}`
    }));

    // Find the index of the currently selected value
    selectedIndex = options.findIndex(option => option.value === selectedValue);

    // Create the picker with the tempo options
    const picker = await this._picker.create({
      columns: [
        {
          name: 'tempo',
          options: options,
          selectedIndex: selectedIndex // Set the selected index
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel', // Cancel button
        },
        {
          text: 'Confirm',
          handler: (value) => {
            this.tempo = value['tempo'].value; // Update the tempo with the selected value
            this.change.emit(this.tempo); // Emit the change event with the new tempo
          }
        },
      ],
    });

    await picker.present(); // Present the picker to the user
  }
}
