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
import { range } from 'lodash';
import { MAXTEMPO, MINTEMPO } from 'src/app/constants';

/**
 * TempoSelectorComponent is responsible for displaying a tempo selector interface.
 * It allows users to select a tempo value and emits changes when a tempo is selected.
 * 
 * @example
 * <tempo-selector [tempo]="120" (change)="onTempoChange($event)"></tempo-selector>
 */
@Component({
  selector: 'tempo-selector',
  template: `
  <div class="simulate-input">
  <div class="title-section-wrapper">Tempo:</div>
  <div class="tempo" (click)="openPicker()">
    <h1>
        &#9833;=
        <span id="tempo">{{ tempo }} bpm</span>
    </h1>
  </div>
  </div>
  `,
  styles: [`
  .tempo h1 {
    font-size: 1em;
    text-align: center;
    margin:10px 10px 10px 10px;
  }
  .title-section-wrapper{
    font-size: 1em;
  }
  .tempo {
    flex-grow: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%; /* Fill container */
    cursor: pointer;
  }
  .simulate-input {
    background-color: #fff;
    border: 2px solid #009dda;
    border-radius: 6px;
    padding: 8px 10px;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    color: black;
    width: 90%;
    max-width: 250px;
    height: 100%;
    box-sizing: border-box;
    margin: auto;
  }

  @media screen and (max-width: 480px) {
    .simulate-input {
      width: 80%;
      max-width: 200px;
    }

    .title-section-wrapper {
      font-size: 0.9em;
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
    IonicModule, CommonModule
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

  /**
   * Opens the picker to select a new tempo value.
   * 
   * This method creates a list of tempo options based on the defined minimum and maximum tempo values.
   * It presents a picker to the user, allowing them to select a tempo value.
   */
  async openPicker() {
    // Create list of options to be selected
    let options: { value: number, text: string }[];
    let selectedIndex = 0;
    let selectedValue: number;
    let rangeValues: number[] = [];
    let unit: string;

    selectedValue = this.tempo; // Get the current tempo value
    rangeValues = range(MINTEMPO, MAXTEMPO + 1, 5); // Generate tempo values from MINTEMPO to MAXTEMPO in steps of 5
    unit = 'bpm'; // Define the unit for the tempo

    // Map the range values to options for the picker
    options = rangeValues.map(value => ({
      value: value,
      text: `${value} ${unit}`
    }));

    // Find the index of the currently selected value
    selectedIndex = options.findIndex(option => option.value === selectedValue);

    // Create the picker with the tempo options
    const picker = await this._picker.create({
      cssClass: 'tempo-picker-overlay',
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
