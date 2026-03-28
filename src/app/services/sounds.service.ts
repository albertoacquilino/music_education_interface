/**
 * This file is part of the Music Education Interface project.
 * Copyright (C) 2025 Alberto Acquilino
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */

import { Injectable } from "@angular/core";
import { BeatService } from "./beat.service";
import { AppBeat } from '../models/appbeat.types';
import { Howl, Howler } from "howler";
import { BehaviorSubject } from "rxjs";
import { TRUMPET_NOTES, CLARINET_NOTES,OBOE_NOTES} from "../constants";

// Predefined beat sounds
export const BEAT_SOUNDS = [
    new Howl({ src: ['assets/sounds/tick_strong.m4a'] }),
    new Howl({ src: ['assets/sounds/tick_weak.m4a'] }),
    new Howl({ src: ['assets/sounds/tick_weak.m4a'] }),
    new Howl({ src: ['assets/sounds/tick_weak.m4a'] })
]

/**
 * Plays an audio file and fades it out after a specified duration.
 * @param audio - The Howl audio object to play.
 * @param duration - The duration in milliseconds to play the audio before fading it out.
 * @param volume - The volume level to set for the audio.
 */
function playAndFade(audio: Howl, duration: number, volume: number = 1.0) {
    audio.volume(volume);
    const id1 = audio.play();
    const fade = Math.max(duration / 10, 100);
    setTimeout(() => {
        audio.fade(volume, 0, fade, id1);
    }, duration - fade);
    setTimeout(() => {
        audio.stop(id1);
    }, duration);
}

@Injectable({
    providedIn: 'root'
})
/**
 * Service for managing and playing sounds in the application.
 */
export class SoundsService {
    private selectedInstrument: string = 'trumpet'; // Default instrument
    private preloadedNotes: Howl[] = []; // Array to hold preloaded note sounds
    private preloadVersion = 0; // Guards against overlapping async preload calls
    private preloadTask: Promise<void> = Promise.resolve();
    private audioUnlocked = false;
    private loadingSubject = new BehaviorSubject<boolean>(true);
    currentNote: number = 0; // Index of the current note
    volume: number = 1.0; // Volume level for sound playback
    loading$ = this.loadingSubject.asObservable();

    /**
     * Creates an instance of SoundsService.
     * @param {BeatService} _beat - The BeatService instance for synchronizing sounds with beats.
     */
    constructor(private _beat: BeatService) {
        this.preloadTask = this.preloadSounds(); // Preload sounds on initialization
        this._beat.tick$.subscribe((beat) => this.playSounds(beat)); // Subscribe to beat ticks
    }

    /**
     * Preloads all the sounds used in the app based on the selected instrument.
     * @returns void
     */
    // private preloadSounds() {
    //     let notesToLoad;

    // if (this.selectedInstrument === 'trumpet') {
    //     notesToLoad = TRUMPET_NOTES;
    // } else if (this.selectedInstrument === 'clarinet') {
    //     notesToLoad = CLARINET_NOTES;
    // } else if (this.selectedInstrument === 'oboe') {
    //     notesToLoad = OBOE_NOTES;
    // } else {
    //     console.warn('Unknown instrument:', this.selectedInstrument);
    //     return;
    // }
    //     for (let sound of BEAT_SOUNDS) {
    //         sound.load(); // Load beat sounds
    //     }
    //     this.preloadedNotes = [];
    //     for (let i = 0; i < notesToLoad.length; i++) {
    //         const note = notesToLoad[i];
    //         const soundFile = note[0];

    //         const audio = new Howl({ src: [`assets/sounds/${this.selectedInstrument}_note_sounds/${soundFile}.m4a`] });
    //         this.preloadedNotes.push(audio); // Store preloaded note sounds
    //     }
    // }
    private async preloadSounds() {
        const preloadVersion = ++this.preloadVersion;
        const instrument = this.selectedInstrument;
        this.loadingSubject.next(true);
        let notesToLoad;

        if (instrument === 'trumpet') {
            notesToLoad = TRUMPET_NOTES;
        } else if (instrument === 'clarinet') {
            notesToLoad = CLARINET_NOTES;
        } else if (instrument === 'oboe') {
            notesToLoad = OBOE_NOTES;
        } else {
            console.warn('Unknown instrument:', instrument);
            if (preloadVersion === this.preloadVersion) {
                this.loadingSubject.next(false);
            }
            return;
        }

        try {
            for (const sound of BEAT_SOUNDS) {
                sound.load();
            }

            // Build note sounds off to the side so overlapping async preloads cannot
            // scramble the index-to-note mapping used during playback.
            const loadedNotes = await Promise.all(
                notesToLoad.map(async (noteVariants) => {
                    const filePath = await this.resolveAudioPath(instrument, noteVariants);
                    return this.createLoadedHowl(filePath);
                })
            );

            if (preloadVersion !== this.preloadVersion || instrument !== this.selectedInstrument) {
                return;
            }

            this.preloadedNotes = loadedNotes;
        } finally {
            if (preloadVersion === this.preloadVersion && instrument === this.selectedInstrument) {
                this.loadingSubject.next(false);
            }
        }
    }

    private createLoadedHowl(filePath: string): Promise<Howl> {
        return new Promise((resolve) => {
            let settled = false;
            let howl!: Howl;

            const finish = () => {
                if (!settled) {
                    settled = true;
                    resolve(howl);
                }
            };

            howl = new Howl({
                src: [filePath],
                preload: true,
                onload: finish,
                onloaderror: (_id, error) => {
                    console.warn(`Unable to preload audio file: ${filePath}`, error);
                    finish();
                }
            });

            if (howl.state() === 'loaded') {
                finish();
            } else if (howl.state() === 'unloaded') {
                howl.load();
            }
        });
    }

/**
 * Utility function to check if a file exists
 */
private async fileExists(url: string): Promise<boolean> {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
    } catch {
        return false;
    }
}

private async resolveAudioPath(instrument: string, noteVariants: string[]): Promise<string> {
    const candidates: string[] = [];

    for (const noteName of noteVariants) {
        candidates.push(`assets/sounds/${instrument}_note_sounds/${noteName}.m4a`);
    }

    for (const candidate of candidates) {
        if (await this.fileExists(candidate)) {
            return candidate;
        }
    }

    return candidates[0];
}

        /**
     * Sets the instrument for sound playback and reloads the corresponding sounds.
     * @param {string} instrument - The name of the instrument to set (e.g., 'trumpet', 'clarinet').
     * @returns void
     * @example
     * soundsService.setInstrument('clarinet');
     */
    public setInstrument(instrument: string): Promise<void> {
        if (this.selectedInstrument === instrument && this.preloadedNotes.length > 0) {
            return this.preloadTask;
        }

        this.selectedInstrument = instrument;
        this.preloadedNotes = [];
        this.preloadTask = this.preloadSounds(); // Reload sounds for the new instrument
        return this.preloadTask;
    }

    public async ensureSoundsReady() {
        await this.preloadTask;
    }

    /**
     * Unlocks audio playback after a direct user gesture.
     * This is especially important on iOS Safari, which can keep
     * Web Audio suspended until the first trusted interaction.
     */
    async unlockAudio() {
        if (this.audioUnlocked) {
            return;
        }

        try {
            if (Howler.ctx?.state === 'suspended') {
                await Howler.ctx.resume();
            }

            if (Howler.ctx) {
                const buffer = Howler.ctx.createBuffer(1, 1, 22050);
                const source = Howler.ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(Howler.ctx.destination);
                source.start(0);
            }

            this.audioUnlocked = true;
        } catch (error) {
            console.warn('Unable to unlock audio playback', error);
        }
    }

    /**
     * Plays the trumpet sound for the current note.
     * @param {number} currentNote - The current note index.
     */
    playNoteSound(currentNote: number) {
        const audio = this.preloadedNotes[currentNote];
        if (audio) {
            playAndFade(audio, 4 * 60000 / this._beat.tempo$.value, this.volume); // Play and fade the note sound
        }
    }
    // playTrumpetSound(currentNote: number) {
    //     const audio = this.preloadedNotes[currentNote];
    //     playAndFade(audio, 4 * 60000 / this._beat.tempo$.value, this.volume);
    // }

    /**
     * Plays the metronome sound for the given beat counter.
     * @param {number} beatCounter - The beat counter indicating which sound to play.
     * @returns void
     * @example
     * soundsService.playMetronome(0); // Plays the strong tick sound
     */
    playMetronome(beatCounter: number) {
        BEAT_SOUNDS[beatCounter].play();
    }

    /**
     * Plays the sounds for the given tempo.
     * @param {AppBeat} tempo - The tempo object containing beat and measure information.
     * @returns void
     * @example
     * soundsService.playSounds({ beat: 0, measure: 1 }); // Plays sounds for the first beat
     */
    playSounds(tempo: AppBeat) {
        this.playMetronome(tempo.beat);// Play the metronome sound

        if (tempo.beat == 0) {
            if (tempo.measure == 1) {
                this.playNoteSound(this.currentNote); // Play the note sound on the first beat of the measure
            }
        }
    }

    /**
     * Sets the volume of the sounds.
     * @param {number} volume - The volume level to set (0.0 to 1.0).
     * @returns void
     * @example
     * soundsService.setVolume(0.5); // Sets the volume to 50%
     */
    setVolume(volume: number) {
        this.volume = volume; // Update the volume level
    }
}
