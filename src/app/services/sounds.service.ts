/**
 * This file is part of the Music Education Interface project.
 * Copyright (C) 2025 Alberto Acquilino
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */

import { Injectable } from '@angular/core';
import { Howl, Howler } from 'howler';
import { BehaviorSubject } from 'rxjs';
import {
    AudioPlayback,
    AudioPort,
    ReferencePlaybackOptions
} from '../core/activity/activity-context';
import {
    InstrumentDefinition,
    LegacyInstrumentId,
    NoteTarget
} from '../instruments/instrument-definition';
import { INSTRUMENT_DEFINITIONS } from '../instruments/instrument-registry.service';
import { ExpressiveDynamicsPlayer, calibrateReferenceDynamics } from './expressive-dynamics';
import { SoftDynamic } from '../core/music/dynamics-profiles';

export const BEAT_SOUNDS = [
    new Howl({ src: ['assets/sounds/tick_strong.m4a'] }),
    new Howl({ src: ['assets/sounds/tick_weak.m4a'] })
];

function playAndFade(
    audio: Howl,
    durationMs: number,
    volume: number,
    playbackRate: number
): AudioPlayback {
    audio.volume(volume);
    const soundId = audio.play();
    audio.rate(playbackRate, soundId);
    const fadeMs = Math.max(durationMs / 10, 100);
    const fadeTimer = window.setTimeout(() => {
        audio.fade(volume, 0, fadeMs, soundId);
    }, durationMs - fadeMs);
    const stopTimer = window.setTimeout(() => {
        audio.stop(soundId);
    }, durationMs);

    return {
        stop: (requestedFadeMs = 0) => {
            window.clearTimeout(fadeTimer);
            window.clearTimeout(stopTimer);
            if (requestedFadeMs > 0) {
                audio.fade(audio.volume(), 0, requestedFadeMs, soundId);
                window.setTimeout(() => audio.stop(soundId), requestedFadeMs);
            } else {
                audio.stop(soundId);
            }
        }
    };
}

@Injectable({
    providedIn: 'root'
})
export class SoundsService implements AudioPort {
    private readonly expressive = new ExpressiveDynamicsPlayer();
    private expressiveGeneration = 0;
    private expressiveNotes = new Map<string, {
        buffer: AudioBuffer; gains: Record<SoftDynamic, number>; referenceA4Hz: number;
    }>();
    private selectedInstrument: LegacyInstrumentId = 'trumpet';
    private preloadedNotes = new Map<string, Howl>();
    private preloadVersion = 0;
    private preloadTask: Promise<void> = Promise.resolve();
    private audioUnlocked = false;
    private loadingSubject = new BehaviorSubject<boolean>(true);

    volume = 1.0;
    loading$ = this.loadingSubject.asObservable();

    constructor() {
        this.preloadTask = this.preloadSounds();
    }

    private async preloadSounds(): Promise<void> {
        const preloadVersion = ++this.preloadVersion;
        const instrumentId = this.selectedInstrument;
        const instrument = INSTRUMENT_DEFINITIONS.find(
            candidate => candidate.legacyId === instrumentId
        );
        this.loadingSubject.next(true);

        if (!instrument) {
            this.loadingSubject.next(false);
            throw new Error(`Unsupported instrument: ${instrumentId}`);
        }

        try {
            BEAT_SOUNDS.forEach(sound => sound.load());
            const loadedNotes = await Promise.all(
                instrument.notes.map(async note => {
                    const audio = await this.createLoadedHowl(note.referenceAudio.path);
                    return [note.id, audio] as const;
                })
            );

            if (
                preloadVersion === this.preloadVersion
                && instrumentId === this.selectedInstrument
            ) {
                this.preloadedNotes = new Map(loadedNotes);
            }
        } finally {
            if (
                preloadVersion === this.preloadVersion
                && instrumentId === this.selectedInstrument
            ) {
                this.loadingSubject.next(false);
            }
        }
    }

    private createLoadedHowl(filePath: string): Promise<Howl> {
        return new Promise(resolve => {
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

    setInstrument(instrument: string): Promise<void> {
        if (!this.isLegacyInstrumentId(instrument)) {
            return Promise.reject(new Error(`Unsupported instrument: ${instrument}`));
        }
        if (
            this.selectedInstrument === instrument
            && this.preloadedNotes.size > 0
        ) {
            return this.preloadTask;
        }

        this.selectedInstrument = instrument;
        this.expressiveGeneration++;
        this.expressive.stopAll();
        this.expressiveNotes.clear();
        this.preloadedNotes = new Map();
        this.preloadTask = this.preloadSounds();
        return this.preloadTask;
    }

    async ensureSoundsReady(): Promise<void> {
        await this.preloadTask;
    }

    async unlockAudio(): Promise<void> {
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

    unlockFromUserGesture(): Promise<void> {
        return this.unlockAudio();
    }

    async preloadInstrument(instrument: InstrumentDefinition, options?: {
        expressiveDynamics: boolean; referenceA4Hz: number;
    }): Promise<void> {
        const preload = this.setInstrument(instrument.legacyId);
        const generation = ++this.expressiveGeneration;
        await preload;
        if (!options?.expressiveDynamics || !Howler.usingWebAudio || !Howler.ctx
            || generation !== this.expressiveGeneration) { return; }
        const notes = new Map<string, {
            buffer: AudioBuffer; gains: Record<SoftDynamic, number>; referenceA4Hz: number;
        }>();
        // Bound memory/concurrency on mobile; prepare before the timer starts.
        for (const note of instrument.notes) {
            if (generation !== this.expressiveGeneration) { return; }
            try {
                const response = await fetch(note.referenceAudio.path);
                if (generation !== this.expressiveGeneration) { return; }
                if (!response.ok) { throw new Error('HTTP ' + response.status); }
                const context = new OfflineAudioContext(2, 96000, 48000);
                const buffer = await context.decodeAudioData(await response.arrayBuffer());
                if (generation !== this.expressiveGeneration) { return; }
                const rate = options.referenceA4Hz / note.referenceAudio.recordedReferenceA4Hz;
                const hz = note.referenceAudio.recordedSoundingFrequencyHz * rate;
                const gains = await calibrateReferenceDynamics(buffer, instrument.id, hz, rate);
                notes.set(note.id, { buffer, gains, referenceA4Hz: options.referenceA4Hz });
            } catch (error) {
                console.warn('Expressive dynamics unavailable; using gain-only playback:', note.id, error);
            }
        }
        if (generation === this.expressiveGeneration) { this.expressiveNotes = notes; }
    }

    playMetronome(accent: 'strong' | 'weak'): AudioPlayback {
        const audio = BEAT_SOUNDS[accent === 'strong' ? 0 : 1];
        const soundId = audio.play();
        return {
            stop: () => audio.stop(soundId)
        };
    }

    playReference(
        target: NoteTarget,
        options: ReferencePlaybackOptions
    ): AudioPlayback {
        const audio = this.preloadedNotes.get(target.noteId);
        if (!audio) {
            throw new Error(`Reference audio was not preloaded for ${target.noteId}`);
        }

        const playbackRate =
            options.desiredReferenceA4Hz / target.referenceAudio.recordedReferenceA4Hz;
        const prepared = this.expressiveNotes.get(target.noteId);
        if ((options.plpDynamic === 'mf' || options.plpDynamic === 'p')
            && prepared?.referenceA4Hz === options.desiredReferenceA4Hz
            && Howler.usingWebAudio && Howler.ctx && Howler.masterGain) {
            return this.expressive.play(Howler.ctx, Howler.masterGain, prepared.buffer,
                target.instrumentId, target.expectedSoundingFrequencyHz, options.plpDynamic,
                prepared.gains[options.plpDynamic], playbackRate, options.durationMs);
        }
        return playAndFade(audio, options.durationMs, options.gain, playbackRate);
    }

    stopAll(): void {
        this.expressiveGeneration++;
        this.expressive.stopAll();
        this.expressiveNotes.clear();
        Howler.stop();
    }

    setVolume(volume: number): void {
        this.volume = volume;
    }

    private isLegacyInstrumentId(value: string): value is LegacyInstrumentId {
        return value === 'trumpet' || value === 'clarinet' || value === 'oboe' || value === 'flute';
    }
}
