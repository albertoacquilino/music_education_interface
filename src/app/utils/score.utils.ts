/**
 * This file is part of the Music Education Interface project.
 * Copyright (C) 2025 Alberto Acquilino
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */

import { Flow } from "vexflow";
// @ts-ignore
import { StaveNote } from "vexflow";
import { Score } from '../models/score.types';

/**
 * Generates a StaveNote object based on the provided notes and duration.
 * 
 * @param {string[]} notes - An array of strings representing the notes (e.g., ['c/4', 'd/4']).
 * @param {string} duration - A string representing the duration of the notes (e.g., 'q' for quarter note).
 * @returns {StaveNote} A StaveNote object representing the musical notes.
 * @example
 * const staveNote = generateNotes(['c/4', 'd/4'], 'q');
 */
export function generateNotes(notes: string[], duration: string): StaveNote {
    const accidentals = notes.map((note) => {
        const [_note, octave] = note.split("/")
        if (_note.length === 1) return null;
        if (_note[1] === "b") {
            return new Flow.Accidental("b")
        } else if (_note[1] === "#") {
            return new Flow.Accidental("#")
        }
        else return null;
    });

    let staveNotes = new Flow.StaveNote({ keys: notes, duration: duration });
    for (const [index, accidental] of accidentals.entries()) {
        if (accidental === null) continue;
        staveNotes.addModifier(accidental, index);
    }

    return staveNotes;
}

/**
 * Converts a MEI note to a Score object.
 * 
 * @param {string} meiNote - The MEI note to convert (e.g., 'c4', 'd#5').
 * @param {string} instrument - The instrument for which the note is being converted (e.g., 'clarinet').
 * @param {string | undefined} dynamic - The dynamic marking for the note (optional).
 * @returns {Score} The converted Score object representing the musical note.
 * @example
 * const score = scoreFromNote('c4', 'trumpet', 'mf');
 */
export function scoreFromNote(meiNote: string, instrument: string, dynamic: string | undefined = undefined): Score {
    let scoreNote;
    const note = meiNote[0];
    const octave = meiNote[1];
    scoreNote = note + '/' + (Number(octave));

    
    if (meiNote.length == 3) {
        const accidental = meiNote[2] == 's' ? '#' : 'b';
       // if (instrument === "clarinet") {
            scoreNote = note + accidental + '/' + (Number(octave));
        // } else {
        //     scoreNote = note + accidental + '/' + (Number(octave) + 2);
        // }
    }

    const score = {
        clef: 'treble',
        dynamic: dynamic,
        dynamicPosition: 2,
        timeSignature: "4/4",
        keySignature: "C",
        measures: [
            [
                { notes: ['c/5'], duration: 'wr' },
            ],
            [
                { notes: [scoreNote], duration: 'w' },
            ],
            [
                { notes: [scoreNote], duration: 'w' },
            ]
        ]
    }
    return score;
}

/**
 * Creates the single-target notation used by event-driven intonation work.
 * This intentionally differs from the three-measure PLP presentation.
 */
export function scoreForTarget(meiNote: string): Score {
    const note = meiNote[0];
    const octave = meiNote[1];
    const accidental = meiNote.length === 3
        ? (meiNote[2] === 's' ? '#' : 'b')
        : '';

    return {
        clef: 'treble',
        dynamicPosition: 0,
        timeSignature: '4/4',
        keySignature: 'C',
        measures: [
            [
                {
                    notes: [`${note}${accidental}/${Number(octave)}`],
                    duration: 'w'
                }
            ]
        ]
    };
}
