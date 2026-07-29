/**
 * This file is part of the Music Education Interface project.
 * Copyright (C) 2025 Alberto Acquilino
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */

import {
    AfterViewInit,
    ChangeDetectorRef,
    Component,
    ElementRef,
    Input,
    OnDestroy,
    ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { frequencyForMidi } from '../../core/music/pitch-math';
import {
    IntonationFeedback
} from '../../activities/target-intonation/target-intonation.types';

const MIN_CENTS = -40;
const MAX_CENTS = 40;
const LOWEST_MIDI = 21;
const HIGHEST_MIDI = 119;
const PITCH_CLASS_NAMES = [
    'C',
    'C#/Db',
    'D',
    'D#/Eb',
    'E',
    'F',
    'F#/Gb',
    'G',
    'G#/Ab',
    'A',
    'A#/Bb',
    'B'
] as const;

@Component({
    selector: 'chromatic-tuner',
    templateUrl: './chromatic-tuner.component.html',
    styleUrls: ['./chromatic-tuner.component.scss'],
    standalone: true,
    imports: [IonicModule, FontAwesomeModule, CommonModule]
})
export class ChromaticTunerComponent implements AfterViewInit, OnDestroy {
    @ViewChild('tunerSurface') private tunerSurface?: ElementRef<HTMLDivElement>;

    private referenceA4Hz = 440;
    private currentPitchHz = 0;
    private explicitTargetFeedback: IntonationFeedback | null = null;
    private readonly boundScaleContent = () => this.scaleContent();

    @Input() set refFrequencyValue$(value: number) {
        if (Number.isFinite(value) && value > 0) {
            this.referenceA4Hz = value;
            this.updateNotes();
            this.refreshDisplay();
        }
    }

    get refFrequencyValue$(): number {
        return this.referenceA4Hz;
    }

    @Input() set pitchHz(value: number) {
        this.currentPitchHz = Number.isFinite(value) && value > 0 ? value : 0;
        this.refreshDisplay();
    }

    @Input() set targetFeedback(value: IntonationFeedback | null) {
        this.explicitTargetFeedback = value;
        this.refreshDisplay();
    }

    get targetFeedback(): IntonationFeedback | null {
        return this.explicitTargetFeedback;
    }

    pointerTransform = 'rotate(0deg)';
    currentEmoji = '';
    NOTES: { [note: string]: { freq: number; key: number } } = {};
    detectedPitch = 0;
    currentNote = '';
    currentCents = 0;

    constructor(private readonly changeDetectorRef: ChangeDetectorRef) {
        this.updateNotes();
    }

    ngAfterViewInit(): void {
        window.addEventListener('resize', this.boundScaleContent);
        window.addEventListener('load', this.boundScaleContent);
        this.scaleContent();
    }

    ngOnDestroy(): void {
        window.removeEventListener('resize', this.boundScaleContent);
        window.removeEventListener('load', this.boundScaleContent);
    }

    updateNotes(): void {
        const notes: { [note: string]: { freq: number; key: number } } = {};
        for (let midi = LOWEST_MIDI; midi <= HIGHEST_MIDI; midi += 1) {
            const name = this.noteNameForMidi(midi);
            notes[name] = {
                freq: frequencyForMidi(midi, this.referenceA4Hz),
                key: midi - LOWEST_MIDI + 1
            };
        }
        this.NOTES = notes;
    }

    displayPitch(pitchHz: number): void {
        if (!Number.isFinite(pitchHz) || pitchHz <= 0) {
            this.resetDisplay();
            return;
        }

        const midi = Math.max(
            LOWEST_MIDI,
            Math.min(
                HIGHEST_MIDI,
                Math.round(69 + 12 * Math.log2(pitchHz / this.referenceA4Hz))
            )
        );
        const note = this.noteNameForMidi(midi);
        const targetFrequency = frequencyForMidi(midi, this.referenceA4Hz);
        const cents = 1200 * Math.log2(pitchHz / targetFrequency);

        this.detectedPitch = pitchHz;
        this.currentNote = note;
        this.currentCents = cents;
        this.showEmoji(cents);
        this.rotatePointer(cents);
        this.changeDetectorRef.markForCheck();
    }

    displayTargetFeedback(feedback: IntonationFeedback): void {
        const pitchHz = feedback.detectedFrequencyHz ?? 0;
        if (!Number.isFinite(pitchHz) || pitchHz <= 0) {
            this.resetDisplay();
            return;
        }

        const midi = feedback.detectedSoundingMidi ?? Math.round(
            69 + 12 * Math.log2(pitchHz / this.referenceA4Hz)
        );
        this.detectedPitch = pitchHz;
        this.currentNote = this.noteNameForMidi(
            Math.max(LOWEST_MIDI, Math.min(HIGHEST_MIDI, midi))
        );
        this.currentCents = feedback.centsFromTarget ?? 0;
        this.rotatePointer(this.currentCents);

        if (feedback.band === 'within-tolerance') {
            this.currentEmoji = 'happy';
        } else if (
            feedback.band === 'flat'
            || feedback.band === 'sharp'
            || feedback.band === 'unstable'
        ) {
            this.currentEmoji = 'confused';
        } else {
            this.currentEmoji = 'notHappy';
        }
        this.changeDetectorRef.markForCheck();
    }

    rotatePointer(cents: number): void {
        const clamped = Math.max(MIN_CENTS, Math.min(MAX_CENTS, cents));
        this.pointerTransform = `rotate(${9 * clamped / 4}deg)`;
    }

    showEmoji(cents: number): void {
        if (this.detectedPitch === 0) {
            this.currentEmoji = '';
        } else if (Math.abs(cents) <= 10) {
            this.currentEmoji = 'happy';
        } else if (Math.abs(cents) <= 30) {
            this.currentEmoji = 'confused';
        } else {
            this.currentEmoji = 'notHappy';
        }
    }

    scaleContent(): void {
        // CSS owns sizing. Reading the instance-local element here preserves the
        // existing resize hook without introducing a global DOM identifier.
        void this.tunerSurface?.nativeElement.getBoundingClientRect();
    }

    private refreshDisplay(): void {
        if (this.explicitTargetFeedback) {
            this.displayTargetFeedback(this.explicitTargetFeedback);
            return;
        }
        this.displayPitch(this.currentPitchHz);
    }

    private resetDisplay(): void {
        this.detectedPitch = 0;
        this.currentNote = '';
        this.currentCents = 0;
        this.currentEmoji = '';
        this.pointerTransform = 'rotate(0deg)';
        this.changeDetectorRef.markForCheck();
    }

    private noteNameForMidi(midi: number): string {
        const pitchClass = ((midi % 12) + 12) % 12;
        const octave = Math.floor(midi / 12) - 1;
        return `${PITCH_CLASS_NAMES[pitchClass]}${octave}`;
    }
}
