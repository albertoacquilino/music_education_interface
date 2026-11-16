/**
 * This file is part of the Music Education Interface project.
 * Copyright (C) 2025 Alberto Acquilino
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */

class AudioAccumulator extends AudioWorkletProcessor {
    process(inputs, outputs, parameters) {
        // Get the input and output
        const input = inputs[0];
        const output = outputs[0];

        // Disconnected microphone nodes can receive an empty input during cleanup.
        if (!input || !input[0] || input[0].length === 0) {
            return true;
        }

        let inputLeft = input[0];
        output[0].set(inputLeft);
        let inputRight = input[1];

        // Check if right channel exists (is not undefined) and average the channels
        // mono input stored in inputLeft
        if (inputRight) {
            output[1].set(inputRight);
            for (let i = 0; i < inputLeft.length; i++) {
                inputLeft[i] = (inputLeft[i] + inputRight[i]) / 2;
            }
        }

        // send message to main thread containing the audio data
        this.port.postMessage({data: inputLeft});

        // If you want the audio processing to continue, return true.
        return true;
    }
}

registerProcessor('audio-accumulator', AudioAccumulator);
