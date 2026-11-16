/**
 * This file is part of the Music Education Interface project.
 * Copyright (C) 2025 Alberto Acquilino
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Howler } from 'howler';
import * as pitchlite from 'src/app/services/pitchlite';
import {
    PitchEstimate,
    PitchInputPort,
    PitchInputSession
} from '../core/activity/activity-context';

const workletChunkSize = 128;
const bigWindow = 4096;
const smallWindow = 512;
export const PITCH_MINIMUM_HZ = 140; // lower pitch of mpm, 140 hz is close to trumpet
const useYin = false; // use MPM by default

/**
 * Scales an array of Float32 values to the range of -1 to 1.
 * @param array - The Float32Array to scale.
 * @returns A new Float32Array scaled to the range of -1 to 1.
 */
export type AudioFrameNormalization =
    | { kind: 'normalized'; data: Float32Array }
    | { kind: 'silence'; data: Float32Array }
    | { kind: 'invalid'; data: Float32Array };

export function normalizeAudioFrame(array: Float32Array): AudioFrameNormalization {
    if (array.some(value => !Number.isFinite(value))) {
        return {
            kind: 'invalid',
            data: new Float32Array(array.length)
        };
    }

    const maxAbsValue = Math.max(...array.map(Math.abs));
    if (maxAbsValue === 0) {
        return {
            kind: 'silence',
            data: new Float32Array(array.length)
        };
    }

    return {
        kind: 'normalized',
        data: array.map(value => value / maxAbsValue)
    };
}

export function scaleArrayToMinusOneToOne(array: Float32Array): Float32Array {
    return normalizeAudioFrame(array).data;
}

@Injectable({
    providedIn: 'root'
})
/**
 * Service for pitch detection using Web Audio API and WebAssembly.
 */
export class PitchService implements PitchInputPort {
    private isStopped = false;
    private accumNode!: AudioWorkletNode;
    private analyser!: AnalyserNode;
    private sourceNode!: MediaStreamAudioSourceNode;
    private wasmModule: any;
    private ptr: any;
    private ptrPitches: any;
    private stream: MediaStream | undefined;
    private primedStream: MediaStream | null = null;
    private nAccumulated = 0;
    private n_pitches!: number;
    private audioContext: AudioContext | null = null;
    private connectPromise: Promise<void> | null = null;
    private usingSharedAudioContext = false;
    private activitySessionActive = false;

    /**
     * Observable that emits the detected pitch.
     */
    pitch$ = new BehaviorSubject<number>(0);
    estimates$ = new BehaviorSubject<PitchEstimate>({
        kind: 'unvoiced',
        reason: 'silence',
        capturedAtMs: 0,
        emittedAtMs: 0
    });

    /**
     * Connects to the audio input and initializes the pitch detection.
     * @returns {Promise<void>} A promise that resolves when the connection is established.
     * @example
     * await pitchService.connect();
     */
    constructor(

    ) { }

    private async ensureAudioContext(): Promise<AudioContext> {
        if (Howler.usingWebAudio && Howler.ctx) {
            this.audioContext = Howler.ctx as AudioContext;
            this.usingSharedAudioContext = true;
        } else if (!this.audioContext || this.audioContext.state === 'closed') {
            this.audioContext = new AudioContext();
            this.usingSharedAudioContext = false;
        }

        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        return this.audioContext;
    }

    async primeMicrophoneAccess() {
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error('Microphone access is not available in this browser.');
        }

        try {
            if (this.stream?.active || this.primedStream?.active) {
                return;
            }

            await this.ensureAudioContext();

            this.primedStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (error) {
            console.warn('Unable to prime microphone access', error);
            throw error;
        }
    }

    async connect() {
        if (this.connectPromise) {
            return this.connectPromise;
        }
        if (this.audioContext && this.stream?.active && this.accumNode) {
            return;
        }

        this.connectPromise = this.initializeConnection();
        try {
            await this.connectPromise;
        } finally {
            this.connectPromise = null;
        }
    }

    private async initializeConnection() {
        this.isStopped = false;
        this.nAccumulated = 0;
        const audioContext = await this.ensureAudioContext();

        console.log("Sample rate:", audioContext.sampleRate);

        this.stream = this.primedStream?.active
            ? this.primedStream
            : await navigator.mediaDevices.getUserMedia({ audio: true });
        this.primedStream = null;

        this.wasmModule = await pitchlite();

        this.n_pitches = this.wasmModule._pitchliteInit(
            bigWindow,
            smallWindow,
            audioContext.sampleRate,
            useYin,
            PITCH_MINIMUM_HZ,
        );

        this.ptr = this.wasmModule._malloc(bigWindow * Float32Array.BYTES_PER_ELEMENT);
        this.ptrPitches = this.wasmModule._malloc(this.n_pitches * Float32Array.BYTES_PER_ELEMENT);

        await audioContext.audioWorklet.addModule('assets/audio-accumulator.js');

        this.accumNode = new AudioWorkletNode(audioContext, 'audio-accumulator', {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [2],
        });

        this.sourceNode = audioContext.createMediaStreamSource(this.stream);
        this.sourceNode.connect(this.accumNode);

        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = 2048;

        this.accumNode.connect(this.analyser);

        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0.0;
        this.analyser.connect(gainNode);
        gainNode.connect(audioContext.destination);

        this.accumNode.port.onmessage = (event) => {
            const capturedAtMs = performance.now();
            const normalization = normalizeAudioFrame(event.data.data);
            if (normalization.kind !== 'normalized') {
                this.nAccumulated = 0;
                this.pitch$.next(0);
                this.estimates$.next({
                    kind: 'unvoiced',
                    reason: normalization.kind,
                    capturedAtMs,
                    emittedAtMs: performance.now()
                });
                return;
            }

            const scaledData = normalization.data;
            const offset = (this.nAccumulated * workletChunkSize) * Float32Array.BYTES_PER_ELEMENT;

            this.wasmModule.HEAPF32.set(scaledData, (this.ptr + offset) / Float32Array.BYTES_PER_ELEMENT);
            this.nAccumulated += 1;

            if (this.nAccumulated >= (bigWindow / workletChunkSize)) {
                this.nAccumulated = 0;
                this.wasmModule._pitchlitePitches(this.ptr, this.ptrPitches);

                const wasmArrayPitches = new Float32Array(this.wasmModule.HEAPF32.buffer, this.ptrPitches, this.n_pitches);
                const pitch = wasmArrayPitches[this.n_pitches - 1];
                if (Number.isFinite(pitch) && pitch > 0) {
                    this.pitch$.next(pitch);
                    this.estimates$.next({
                        kind: 'voiced',
                        frequencyHz: pitch,
                        capturedAtMs,
                        emittedAtMs: performance.now()
                    });
                } else {
                    this.pitch$.next(0);
                    this.estimates$.next({
                        kind: 'unvoiced',
                        reason: 'invalid',
                        capturedAtMs,
                        emittedAtMs: performance.now()
                    });
                }
                this.wasmModule._memset(this.ptr, 0, bigWindow * Float32Array.BYTES_PER_ELEMENT);
            }
        };
    }

    async acquire(signal: AbortSignal): Promise<PitchInputSession> {
        if (this.activitySessionActive) {
            throw new Error('The microphone is already owned by an activity session');
        }

        this.activitySessionActive = true;
        let released = false;
        const release = async () => {
            if (released) {
                return;
            }
            released = true;
            signal.removeEventListener('abort', abortRelease);
            this.disconnect();
            this.activitySessionActive = false;
        };
        const abortRelease = () => {
            void release();
        };

        try {
            await this.primeMicrophoneAccess();
            await this.connect();
            signal.addEventListener('abort', abortRelease, { once: true });
            return { release };
        } catch (error) {
            this.activitySessionActive = false;
            this.disconnect();
            throw error;
        }
    }
    /**
     * Disconnects the audio input and cleans up resources.
     * @returns void
     * @example
     * pitchService.disconnect();
     */
    disconnect() {
        console.log("Stopping and disconnecting and cleaning up");
        this.isStopped = true;

        if (this.accumNode) {
            this.accumNode.disconnect();
        }

        if (this.sourceNode) {
            this.sourceNode.disconnect();
        }

        if (this.stream) {
            this.stream.getTracks().forEach(function (track: any) {
                console.log('Stopping stream');
                track.stop();
            });
        }

        if (this.primedStream) {
            this.primedStream.getTracks().forEach(track => track.stop());
            this.primedStream = null;
        }

        if (this.wasmModule) {
            this.wasmModule._free(this.ptrPitches);
            this.wasmModule._free(this.ptr);
        }

        if (this.audioContext && !this.usingSharedAudioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        if (this.usingSharedAudioContext) {
            this.audioContext = null;
        }

        this.usingSharedAudioContext = false;
        this.stream = undefined;
        this.ptr = null;
        this.ptrPitches = null;
        this.wasmModule = null;
        this.nAccumulated = 0;
        this.pitch$.next(0);
        const nowMs = performance.now();
        this.estimates$.next({
            kind: 'unvoiced',
            reason: 'silence',
            capturedAtMs: nowMs,
            emittedAtMs: nowMs
        });
    }
}
