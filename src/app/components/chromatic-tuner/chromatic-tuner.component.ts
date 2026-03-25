/**
 * This file is part of the Music Education Interface project.
 * Copyright (C) 2025 Alberto Acquilino
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */

import { ChangeDetectorRef, Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Observable, map, tap, Subject, bufferTime, Subscription, BehaviorSubject, bufferCount } from 'rxjs';
import { PitchService } from 'src/app/services/pitch.service';
import { IonicModule } from '@ionic/angular';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ScrollImageComponent } from '../scroll-image-selector/scroll-image-selector.component';
import { CommonModule } from '@angular/common';
import { RefFreqService } from 'src/app/services/ref-freq.service';//to inject global service
const baseNotes: { [note: string]: { freq: number, key: number } } = {
    "A0": { "freq": 27.5, "key": 1 }, "A#0/Bb0": { "freq": 29.14, "key": 2 }, "B0": { "freq": 30.87, "key": 3 },
    "C1": { "freq": 32.7, "key": 4 }, "C#1/Db1": { "freq": 34.65, "key": 5 }, "D1": { "freq": 36.71, "key": 6 },
    "D#1/Eb1": { "freq": 38.89, "key": 7 }, "E1": { "freq": 41.2, "key": 8 }, "F1": { "freq": 43.65, "key": 9 },
    "F#1/Gb1": { "freq": 46.25, "key": 10 }, "G1": { "freq": 49, "key": 11 }, "G#1/Ab1": { "freq": 51.91, "key": 12 },
    "A1": { "freq": 55, "key": 13 }, "A#1/Bb1": { "freq": 58.27, "key": 14 }, "B1": { "freq": 61.74, "key": 15 },
    "C2": { "freq": 65.41, "key": 16 }, "C#2/Db2": { "freq": 69.3, "key": 17 }, "D2": { "freq": 73.42, "key": 18 },
    "D#2/Eb2": { "freq": 77.78, "key": 19 }, "E2": { "freq": 82.41, "key": 20 }, "F2": { "freq": 87.31, "key": 21 },
    "F#2/Gb2": { "freq": 92.5, "key": 22 }, "G2": { "freq": 98, "key": 23 }, "G#2/Ab2": { "freq": 103.83, "key": 24 },
    "A2": { "freq": 110, "key": 25 }, "A#2/Bb2": { "freq": 116.54, "key": 26 }, "B2": { "freq": 123.47, "key": 27 },
    "C3": { "freq": 130.81, "key": 28 }, "C#3/Db3": { "freq": 138.59, "key": 29 }, "D3": { "freq": 146.83, "key": 30 },
    "D#3/Eb3": { "freq": 155.56, "key": 31 }, "E3": { "freq": 164.81, "key": 32 }, "F3": { "freq": 174.61, "key": 33 },
    "F#3/Gb3": { "freq": 185, "key": 34 }, "G3": { "freq": 196, "key": 35 }, "G#3/Ab3": { "freq": 207.65, "key": 36 },
    "A3": { "freq": 220, "key": 37 }, "A#3/Bb3": { "freq": 233.08, "key": 38 }, "B3": { "freq": 246.94, "key": 39 },
    "C4": { "freq": 261.63, "key": 40 }, "C#4/Db4": { "freq": 277.18, "key": 41 }, "D4": { "freq": 293.66, "key": 42 },
    "D#4/Eb4": { "freq": 311.13, "key": 43 }, "E4": { "freq": 329.63, "key": 44 }, "F4": { "freq": 349.23, "key": 45 },
    "F#4/Gb4": { "freq": 369.99, "key": 46 }, "G4": { "freq": 392, "key": 47 }, "G#4/Ab4": { "freq": 415.3, "key": 48 },
    "A4": { "freq": 440, "key": 49 }, "A#4/Bb4": { "freq": 466.16, "key": 50 }, "B4": { "freq": 493.88, "key": 51 },
    "C5": { "freq": 523.25, "key": 52 }, "C#5/Db5": { "freq": 554.37, "key": 53 }, "D5": { "freq": 587.33, "key": 54 },
    "D#5/Eb5": { "freq": 622.25, "key": 55 }, "E5": { "freq": 659.25, "key": 56 }, "F5": { "freq": 698.46, "key": 57 },
    "F#5/Gb5": { "freq": 739.99, "key": 58 }, "G5": { "freq": 783.99, "key": 59 }, "G#5/Ab5": { "freq": 830.61, "key": 60 },
    "A5": { "freq": 880, "key": 61 }, "A#5/Bb5": { "freq": 932.33, "key": 62 }, "B5": { "freq": 987.77, "key": 63 },
    "C6": { "freq": 1046.5, "key": 64 }, "C#6/Db6": { "freq": 1108.73, "key": 65 }, "D6": { "freq": 1174.66, "key": 66 },
    "D#6/Eb6": { "freq": 1244.51, "key": 67 }, "E6": { "freq": 1318.51, "key": 68 }, "F6": { "freq": 1396.91, "key": 69 },
    "F#6/Gb6": { "freq": 1479.98, "key": 70 }, "G6": { "freq": 1567.98, "key": 71 }, "G#6/Ab6": { "freq": 1661.22, "key": 72 },
    "A6": { "freq": 1760, "key": 73 }, "A#6/Bb6": { "freq": 1864.66, "key": 74 }, "B6": { "freq": 1975.53, "key": 75 },
    "C7": { "freq": 2093, "key": 76 }, "C#7/Db7": { "freq": 2217.46, "key": 77 }, "D7": { "freq": 2349.32, "key": 78 },
    "D#7/Eb7": { "freq": 2489.02, "key": 79 }, "E7": { "freq": 2637.02, "key": 80 }, "F7": { "freq": 2793.83, "key": 81 },
    "F#7/Gb7": { "freq": 2959.96, "key": 82 }, "G7": { "freq": 3135.96, "key": 83 }, "G#7/Ab7": { "freq": 3322.44, "key": 84 },
    "A7": { "freq": 3520, "key": 85 }, "A#7/Bb7": { "freq": 3729.31, "key": 86 }, "B7": { "freq": 3951.07, "key": 87 },
    "C8": { "freq": 4186.01, "key": 88 }, "C#8/Db8": { "freq": 4434.92, "key": 89 }, "D8": { "freq": 4698.63, "key": 90 },
    "D#8/Eb8": { "freq": 4978.03, "key": 91 }, "E8": { "freq": 5274.04, "key": 92 }, "F8": { "freq": 5587.65, "key": 93 },
    "F#8/Gb8": { "freq": 5919.91, "key": 94 }, "G8": { "freq": 6271.93, "key": 95 }, "G#8/Ab8": { "freq": 6644.88, "key": 96 },
    "A8": { "freq": 7040, "key": 97 }, "A#8/Bb8": { "freq": 7458.62, "key": 98 }, "B8": { "freq": 7902.13, "key": 99 }
};

const minCents = -40;
const maxCents = 40;

/**
 * ChromaticTunerComponent is responsible for displaying a chromatic tuner interface.
 * It displays the detected pitch and note, and provides visual feedback to the user through emojis.
 * 
 * @example
 * <chromatic-tuner [refFrequencyValue$]="440"></chromatic-tuner>
 */
@Component({
    selector: 'chromatic-tuner',
    templateUrl: './chromatic-tuner.component.html',
    styleUrls: ['./chromatic-tuner.component.scss'],
    standalone: true,
    imports: [IonicModule, FontAwesomeModule, CommonModule]
})
export class ChromaticTunerComponent implements OnInit, OnDestroy {
    /**
     * Reference frequency value in Hz for tuning.
     * @type {number}
     */
    @Input() refFrequencyValue$!: number;

    /**
     * Observable that emits the detected pitch.
     * @type {Observable<number>}
     */
    pitch$: Observable<number>;

    /**
     * Observable that emits the detected note and cents deviation.
     * @type {Observable<{ note: string, cents: number }>}
     */
    note$: Observable<{ note: string, cents: number }>;

    private pitchSubject = new Subject<number>();
    private pitchSubscription: Subscription | null = null;

    pointerTransform: string = '';
    currentEmoji: string = '';
    NOTES: { [note: string]: { freq: number, key: number } } = {};

    detectedPitch: number = 0;
    currentNote: string = '';
    currentCents: number = 0;

    meansArray: number[] = [];  // Array to store the means
    private freqSubscription!: Subscription;//to track Service

    constructor(
        private pitchService: PitchService,
        private changeDetectorRef: ChangeDetectorRef,
        private refFreqService: RefFreqService
    ) {
        this.pitch$ = this.pitchSubject.pipe(
            bufferCount(4),
            map(pitches => {
                if (pitches.length === 0) return 0;
                const buckets = new Map<number, number[]>();
                for (const pitch of pitches) {
                    let bucketFound = false;
                    for (const [key, bucket] of buckets.entries()) {
                        if (Math.abs(pitch - key) <= 2) {
                            bucket.push(pitch);
                            bucketFound = true;
                            break;
                        }
                    }
                    if (!bucketFound) {
                        buckets.set(pitch, [pitch]);
                    }
                }

                let maxBucket: number[] = [];
                for (const bucket of buckets.values()) {
                    if (bucket.length > maxBucket.length) {
                        maxBucket = bucket;
                    }
                }

                const mean = maxBucket.reduce((a, b) => a + b, 0) / maxBucket.length;
                return mean;
            }),
            tap(mean => {
                if (mean > 0) {
                    if (this.meansArray.length === 0 || this.meansArray[this.meansArray.length - 1] !== mean) {
                        this.meansArray.push(mean);
                    }
                    console.log("Mean of the most frequent bucket:", mean);
                }
                this.detectedPitch = mean;
                this.changeDetectorRef.detectChanges();
            })
        );

        this.note$ = this.pitch$.pipe(
            map((pitch) => {
                if (pitch <= 0) return { note: '', cents: 0 };

                let noteDist = Object.keys(this.NOTES).map((note) => ({ note, err: this.NOTES[note].freq - pitch }));
                noteDist.sort((a, b) => Math.abs(a.err) - Math.abs(b.err));

                let cents = 1200 * Math.log2(pitch / this.NOTES[noteDist[0].note].freq);
                return { note: noteDist[0].note, cents: cents };
            }),
            tap((note) => {
                this.showEmoji(note.cents);
                this.rotatePointer(note.cents);
                this.changeDetectorRef.detectChanges();
            })
        );
    }

    /**
     * Initializes the component and subscribes to the note observable.
     */
    ngOnInit() {
        //Bypass parent OnPush blocks by subscribing directly to the global state!
        this.freqSubscription = this.refFreqService.getRefFrequency().subscribe(value => {
            this.refFrequencyValue$ = value;
            console.log(`[Tuner] A4 Calibration Auto-Updated to: ${value} Hz`);
            this.updateNotes(); // Table instantly recalibrate to new value
            this.changeDetectorRef.detectChanges(); // force update UI
        });
        this.note$.subscribe((note) => {
            this.currentNote = note.note;
            this.currentCents = note.cents;
            this.changeDetectorRef.detectChanges();
        });
    }
  
   /**
     * Clean up subscriptions to prevent memory leaks.
     */
    ngOnDestroy() {
        if (this.freqSubscription) {
            this.freqSubscription.unsubscribe();
        }
    }

    /**
     * Updates the note frequencies based on the reference frequency.
     */
    updateNotes() {
        this.NOTES = Object.keys(baseNotes).reduce((acc, note) => {
            acc[note] = {
                freq: baseNotes[note].freq * (this.refFrequencyValue$ / 440),
                key: baseNotes[note].key
            };
            return acc;
        }, {} as { [note: string]: { freq: number, key: number } });
    }

    /**
     * Rotates the pointer based on the cents deviation.
     * @param {number} cents - The cents deviation from the target pitch.
     */
    rotatePointer(cents: number) {
        if (cents < minCents) cents = minCents;
        else if (cents > maxCents) cents = maxCents;
        let angle = 9 * cents / 4;
        this.pointerTransform = `rotate(${angle}deg)`;
    }

    /**
     * Displays an emoji based on the cents deviation.
     * @param {number} cents - The cents deviation from the target pitch.
     */
    showEmoji(cents: number) {
    if (this.detectedPitch == 0) {
        this.currentEmoji = '';
        return;
    }
    if (cents == 0) this.currentEmoji = '';
    else if (cents >= -10 && cents <= 10) {
        this.currentEmoji = 'happy';
    } else if ((cents > 10 && cents <= 30) || (cents < -10 && cents >= -30)) {
        this.currentEmoji = 'confused';
    } else if (cents > 30 || cents < -30) {
        this.currentEmoji = 'notHappy';
    }
    }
    /**
     * Starts the pitch detection process.
     * Clears the means array and subscribes to the pitch service.
     */
    start() {
        this.meansArray = [];  // Clear the array when starting
        this.pitchService.connect();
        this.pitchSubscription = this.pitchService.pitch$.subscribe(pitch => {
            this.pitchSubject.next(pitch);
        });
    }

    /**
     * Stops the pitch detection process and returns the array of means.
     * @returns {number[]} The array of means calculated during the pitch detection.
     */
    stop(): number[] {
        this.pitchService.disconnect();

        if (this.pitchSubscription) {
            this.pitchSubscription.unsubscribe();
            this.pitchSubscription = null;
        }

        this.showEmoji(0);
        this.rotatePointer(0);
        this.currentNote = '';
        this.detectedPitch = 0;
        this.changeDetectorRef.detectChanges();

        console.log(this.meansArray);
        return this.meansArray;  // Return the array of means
    }

    /**
     * Scales the content of the tuner based on the viewport size.
     */
    scaleContent() {
        const container = document.getElementById('tuner');

        // Base dimensions of the container
        const baseWidth = container!.offsetWidth;
        const baseHeight = container!.offsetHeight;

        // Dimensions of the viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Calculate the scaling factor to fit both width and height
        const scaleX = viewportWidth / baseWidth;
        const scaleY = viewportHeight / baseHeight;

        // Take the minimum scaling factor between width and height
        let scale = Math.min(scaleX, scaleY);

        // Leave a margin of at least 20%
        scale = scale * 0.8;

        // Apply the scaling factor to the container
        // container!.style.transform = `scale(${scale})`;
    }

    /**
     * Lifecycle hook that is called after the component's view has been fully initialized.
     * It sets up event listeners for resizing and scaling the content.
     */
    ngAfterViewInit() {
        // On event resize, scale the content
        window.addEventListener('resize', (event) => this.scaleContent());
        window.addEventListener('load', (event) => this.scaleContent());
        this.scaleContent();
    }
}

