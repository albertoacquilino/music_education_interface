/**
 * This file is part of the Music Education Interface project.
 * Copyright (C) 2025 Alberto Acquilino
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */
import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { IonicModule, ViewDidEnter, ViewDidLeave } from '@ionic/angular';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CommonModule } from '@angular/common';
import { ScrollImageComponent } from '../../components/scroll-image-selector/scroll-image-selector.component';
import { ChromaticTunerComponent } from 'src/app/components/chromatic-tuner/chromatic-tuner.component';
import { RefFreqService } from 'src/app/services/ref-freq.service';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-pitchlite',
  templateUrl: 'pitchlite.page.html',
  styleUrls: ['pitchlite.page.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicModule, FontAwesomeModule, ScrollImageComponent, CommonModule, ChromaticTunerComponent],
})
/**
 * PitchComponent class represents the pitch detection interface of the music education application.
 */
export class PitchComponent implements OnInit, OnDestroy, ViewDidEnter, ViewDidLeave {
  private destroy$ = new Subject<void>();
  @ViewChild(ChromaticTunerComponent) private chromaticTuner!: ChromaticTunerComponent;

  /**
   * The reference frequency value for tuning.
   */
  refFrequencyValue$!: number;

  /**
   * Indicates whether pitch detection is currently active.
   * @default false
   */
  detecting = false;

  /**
   * Creates an instance of PitchComponent.
   * @param refFreqService - The service for managing reference frequency.
   * @param tabsService - The service for managing tab states.
   * @param router - The router for navigation.
   */
  constructor(
    private refFreqService: RefFreqService,
    private router: Router
  ) { }

  /**
   * Lifecycle hook that is called after the component has been initialized.
   * Retrieves the reference frequency from the service.
   * @returns void
   */
  ngOnInit(): void {
    this.refFreqService.getRefFrequency().pipe(takeUntil(this.destroy$)).subscribe(value => {
      this.refFrequencyValue$ = value;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Lifecycle hook that is called when the view has entered.
   * Starts the chromatic tuner and sets detecting to true.
   * @returns void
   */
  ionViewDidEnter() {
    this.detecting = true;
    this.chromaticTuner.start();
    // Optionally disable tabs while detecting
    // this.tabsService.setDisabled(true);
  }

  /**
   * Lifecycle hook that is called when the view is about to leave.
   * Stops the chromatic tuner and sets detecting to false.
   * @returns void
   */
  ionViewDidLeave() {
    this.detecting = false;
    this.chromaticTuner.stop();
    // Optionally enable tabs after detecting
    // this.tabsService.setDisabled(false);
  }

  /**
   * Navigates to the user profile page.
   * @returns void
   */
  goToProfile() {
    this.router.navigate(['/profile']);
  }
}
