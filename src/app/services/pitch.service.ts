/**
 * This file is part of the Music Education Interface project.
 * Copyright (C) 2025 Alberto Acquilino
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import * as pitchlite from 'src/app/services/pitchlite';

const workletChunkSize = 128;
const bigWindow = 4096;
const smallWindow = 512;
const minPitch = 140; // lower pitch of mpm, 140 hz is close to trumpet
const useYin = false; // use MPM by default

/**
 * Scales an array of Float32 values to the range of -1 to 1.
 * @param array - The Float32Array to scale.
 * @returns A new Float32Array scaled to the range of -1 to 1.
 */
function scaleArrayToMinusOneToOne(array: Float32Array) {
    const maxAbsValue = Math.max(...array.map(Math.abs));
    if (maxAbsValue === 0) {
        return array;
    }
    return array.map((value) => value / maxAbsValue);
}

@Injectable({
    providedIn: 'root'
})
/**
 * Service for pitch detection using Web Audio API and WebAssembly.
 */
export class PitchService {
    private isStopped = false;
    private isConnected = false;
    private connectPromise: Promise<void> | null = null;
    private accumNode: AudioWorkletNode | null = null;
    private analyser!: AnalyserNode;
    private wasmModule: any;
    private ptr: any;
    private ptrPitches: any;
    private stream: MediaStream | undefined;
    private nAccumulated = 0;
    private n_pitches!: number;
    private audioContext: AudioContext | null = null;

    /**
     * Observable that emits the detected pitch.
     */
    pitch$ = new BehaviorSubject<number>(0);

    /**
     * Connects to the audio input and initializes the pitch detection.
     * @returns {Promise<void>} A promise that resolves when the connection is established.
     * @example
     * await pitchService.connect();
     */
    constructor(

    ) { }

    async connect() {
        if (this.isConnected) {
            if (this.audioContext && this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            return;
        }

        if (this.connectPromise) {
            return this.connectPromise;
        }

        this.connectPromise = this.initializeConnection();
        try {
            await this.connectPromise;
        } finally {
            this.connectPromise = null;
        }
    }

    private async initializeConnection() {
        this.audioContext = new AudioContext();
        console.log("Sample rate:", this.audioContext.sampleRate);
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.wasmModule = await pitchlite();

        this.n_pitches = this.wasmModule._pitchliteInit(
            bigWindow,
            smallWindow,
            this.audioContext.sampleRate, // use the actual sample rate of the audio context
            useYin, // use yin
            minPitch, // mpm low pitch cutoff
        );

        // Create WASM views of the buffers, do it once and reuse
        this.ptr = this.wasmModule._malloc(bigWindow * Float32Array.BYTES_PER_ELEMENT);
        this.ptrPitches = this.wasmModule._malloc(this.n_pitches * Float32Array.BYTES_PER_ELEMENT);

        await this.audioContext.audioWorklet.addModule('assets/audio-accumulator.js');
        // Create an instance of your custom AudioWorkletNode
        this.accumNode = new AudioWorkletNode(this.audioContext, 'audio-accumulator', {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [2],
        });

        // Connect the microphone stream to the processor
        const source = this.audioContext.createMediaStreamSource(this.stream);
        if (this.accumNode) {
            try {
                source.connect(this.accumNode);
            } catch (e) {
                console.warn('Error connecting source to accumNode', e);
            }
        }

        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;

        if (this.accumNode) {
            try {
                this.accumNode.connect(this.analyser);
            } catch (e) {
                console.warn('Error connecting accumNode to analyser', e);
            }
        }

        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = 0.0;
        this.analyser.connect(gainNode);

        gainNode.connect(this.audioContext.destination);
        
        if (this.accumNode && this.accumNode.port) {
            this.accumNode.port.onmessage = (event) => {
            // Check if the "stop" button has been clicked
            // event.data contains 128 samples of audio data from
            // the microphone through the AudioWorkletProcessor

            // scale event.data.data up to [-1, 1]
            if (!this.wasmModule || !this.ptr || !this.ptrPitches) {
                return;
            }

            const scaledData = scaleArrayToMinusOneToOne(event.data.data);

            // Calculate the offset in bytes based on nAccumulated
            const offset = (this.nAccumulated * workletChunkSize) * Float32Array.BYTES_PER_ELEMENT;

            // store latest 128 samples into the WASM buffer
            if (!this.wasmModule || !this.wasmModule.HEAPF32) {
                return;
            }
            this.wasmModule.HEAPF32.set(scaledData, (this.ptr + offset) / Float32Array.BYTES_PER_ELEMENT);
            this.nAccumulated += 1;

            // Check if we have enough data to calculate the pitch
            if (this.nAccumulated >= (bigWindow / workletChunkSize)) {
                this.nAccumulated = 0; // reset the accumulator

                // Call the WASM function
                this.wasmModule._pitchlitePitches(this.ptr, this.ptrPitches);

                // copy the results back into a JS array
                if (!this.wasmModule || !this.wasmModule.HEAPF32) {
                    return;
                }
                let wasmArrayPitches = new Float32Array(this.wasmModule.HEAPF32.buffer, this.ptrPitches, this.n_pitches);
                // Do something with the pitch
                this.pitch$.next(wasmArrayPitches[this.n_pitches - 1]);

                // clear the entire buffer
                this.wasmModule._memset(this.ptr, 0, bigWindow * Float32Array.BYTES_PER_ELEMENT);
            }
            };
        }
    

        this.isConnected = true;
    }

    /**
     * Disconnects the audio input and cleans up resources.
     * @returns void
     * @example
     * pitchService.disconnect();
     */
    disconnect() {
        if (!this.isConnected && !this.audioContext && !this.stream && !this.wasmModule) {
            return;
        }

        console.log("Stopping and disconnecting and cleaning up");
        this.isStopped = true;

        if (this.accumNode) {
            try {
                if (this.accumNode.port) {
                    try {
                        // remove message handler to avoid callbacks after cleanup
                        // @ts-ignore
                        this.accumNode.port.onmessage = null;
                    } catch (e) {
                        // ignore
                    }
                }
                this.accumNode.disconnect();
            } catch (e) {
                console.warn('Error disconnecting accumNode', e);
            }
            this.accumNode = null;
        }

        if (this.stream) {
            // stop tracks
            this.stream.getTracks().forEach(function (track: any) {
                console.log('Stopping stream');
                // Here you can free the allocated memory
                track.stop();
            });
            this.stream = undefined;
        }

        if (this.wasmModule) {
            // cleanup
            this.wasmModule._free(this.ptrPitches);
            this.wasmModule._free(this.ptr);
            this.wasmModule = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.nAccumulated = 0;
        this.isConnected = false;
        this.pitch$.next(0);
    }
}

