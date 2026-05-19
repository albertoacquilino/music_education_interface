/**
 * This file is part of the Music Education Interface project.
 * Copyright (C) 2025 Alberto Acquilino
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */
/**
 * Maximum number of cycles allowed in the application.
 * @constant {number}
 */
export const MAXCYCLES = 12;

/**
 * Maximum note value in the application.
 * @constant {number}
 */
export const MAXNOTE = 44;

/**
 * Minimum note value in the application.
 * @constant {number}
 */
export const MINNOTE = 0;

/**
 * Maximum tempo value in beats per minute (BPM).
 * @constant {number}
 */
export const MAXTEMPO = 180;

/**
 * Minimum tempo value in beats per minute (BPM).
 * @constant {number}
 */
export const MINTEMPO = 40;

/**
 * Minimum reference frequency in Hertz (Hz).
 * @constant {number}
 */
export const MINREFFREQUENCY = 430;

/**
 * Maximum reference frequency in Hertz (Hz).
 * @constant {number}
 */
export const MAXREFFREQUENCY = 450;

/**
 * Initial note value used in the application.
 * @constant {number}
 */
export const INITIAL_NOTE = 13;

/**
 * Array of trumpet notes represented as strings.
 * Each sub-array contains variations of notes.
 * @constant {string[][]}
 */
export const TRUMPET_NOTES = [
    ['F3s', 'G3f'],
    ['G3'],
    ['G3s', 'A3f'],
    ['A3'],
    ['B3f', 'A3s'],
    ['B3'],
    ['C4'],
    ['C4s', 'D4f'],
    ['D4'],
    ['E4f', 'D4s'],
    ['E4'],
    ['F4'],
    ['F4s', 'G4f'],
    ['G4'],
    ['G4s', 'A4f'],
    ['A4'],
    ['B4f', 'A4s'],
    ['B4'],
    ['C5'],
    ['C5s', 'D5f'],
    ['D5'],
    ['E5f', 'D5s'],
    ['E5'],
    ['F5'],
    ['F5s', 'G5f'],
    ['G5'],
    ['G5s', 'A5f'],
    ['A5'],
    ['B5f', 'A5s'],
    ['B5'],
    ['C6'],
    
];

/**
 * Array of position identifiers for musical notes.
 * @constant {string[]}
 */
export const POSITIONS = [
    'pos_7',
    'pos_6',
    'pos_5',
    'pos_4',
    'pos_3',
    'pos_2',
    'pos_1',
    'pos_7a',
    'pos_6a',
    'pos_5',
    'pos_4',
    'pos_3',
    'pos_2',
    'pos_1',
    'pos_5',
    'pos_4',
    'pos_3',
    'pos_2',
    'pos_1',
    'pos_4',
    'pos_3',
    'pos_2',
    'pos_1',
    'pos_3',
    'pos_2',
    'pos_1',
    'pos_5',
    'pos_4',
    'pos_3',
    'pos_2',
    'pos_1',
];

/**
 * Array of button configurations for trumpet notes.
 * Each sub-array represents the button combinations for a specific note.
 * @constant {number[][]}
 */
export const TRUMPET_BTN = [
    [1, 2, 3],
    [1, 3],
    [2, 3],
    [1, 2],
    [1],
    [2],
    [],
    [0, 1, 2, 3],
    [0, 1, 3],
    [2, 3],
    [1, 2],
    [1],
    [2],
    [],
    [2, 3],
    [1, 2],
    [1],
    [2],
    [],
    [1, 2],
    [1],
    [2],
    [],
    [1],
    [2],
    [],
    [2, 3],
    [1, 2],
    [1],
    [2],
    [],
];

/**
 * Array of dynamic markings with corresponding volume levels.
 * Each object contains a label and a volume value.
 * @constant {Object[]}
 */
export const DYNAMICS = [
    { label: 'p', volume: 0.15 }, // Piano
    { label: 'mf', volume: 0.4 }, // Mezzo-forte
    { label: 'f', volume: 1.0 },  // Forte
];

/**
 * Array of clarinet notes represented as strings.
 * Each sub-array contains variations of notes.
 * @constant {string[][]}
 */
export const CLARINET_NOTES = [
    ['E3'],
    ['F3'],
    ['F3s', 'G3f'],
    ['G3'],
    ['G3s', 'A3f'],
    ['A3'],
    [ 'B3f','A3s'],
    ['B3'],
    ['C4'],
    ['C4s', 'D4f'],
    ['D4'],
    ['E4f','D4s'],
    ['E4'],
    ['F4'],
    ['F4s', 'G4f'],
    ['G4'],
    ['G4s', 'A4f'],
    ['A4'],
    ['B4f', 'A4s'],
    ['B4'],
    ['C5'],
    ['C5s', 'D5f'],
    ['D5'],
    ['E5f', 'D5s'],
    ['E5'],
    ['F5'],
    ['F5s', 'G5f'],
    ['G5'],
    ['G5s', 'A5f'],
    ['A5'],
    ['B5f','A5s'],
    ['B5'],
    ['C6'],
    ['C6s', 'D6f'],
    ['D6'],
    ['E6f','D6s'],
    ['E6'],
    ['F6'],
    ['F6s', 'G6f'],
    ['G6'],
    ['G6s', 'A6f'],
    ['A6'],
    ['B6f','A6s'],
    ['B6'],
    ['C7'],
];

/**
 * Array of position identifiers for clarinet notes.
 * @constant {string[]}
 */
export const CLARINET_POSITIONS = [
    'E3',
    'F3',
    'F3s',
    'G3',
    'G3s',
    'A3',
    'B3f',
    'B3',
    'C4',
    'C4s',
    'D4',
    'E4f',
    'E4',
    'F4',
    'F4s',
    'G4',
    'G4s',
    'A4',
    'B4f',
    'B4',
    'C5',
    'C5s',
    'D5',
    'E5f',
    'E5',
    'F5',
    'F5s',
    'G5',
    'G5s',
    'A5',
    'B5f',
    'B5',
    'C6',
    'C6s',
    'D6',
    'E6f',
    'E6',
    'F6',
    'F6s',
    'G6',
    'G6s',
    'A6',
    'B6f',
    'B6',
    'C7',
];

export const OBOE_NOTES = [
    ['B3'],
    ['C4'],
    ['C4s', 'D4f'],
    ['D4'],
    ['E4f','D4s'],
    ['E4'],
    ['F4'],
    ['F4s', 'G4f'],
    ['G4'],
    ['G4s', 'A4f'],
    ['A4'],
    ['B4f','A4s'],
    ['B4'],
    ['C5'],
    ['C5s', 'D5f'],
    ['D5'],
    ['E5f','D5s'],
    ['E5'],
    ['F5'],
    ['F5s', 'G5f'],
    ['G5'],
    ['G5s', 'A5f'],
    ['A5'],
    ['B5f','A5s'],
    ['B5'],
    ['C6'],
    ['C6s', 'D6f'],
    ['D6'],
    ['E6f','D6s'],
    ['E6'],
    ['F6'],
    ['F6s', 'G6f'],
    ['G6'],
    ['G6s', 'A6f'],
];

export const OBOE_POSITIONS = [
    'B3',
    'C4',
    'C4s',
    'D4',
    'E4f',
    'E4',
    'F4',
    'F4s',
    'G4',
    'G4s',
    'A4',
    'B4f',
    'B4',
    'C5',
    'C5s',
    'D5',
    'E5f',
    'E5',
    'F5',
    'F5s',
    'G5',
    'G5s',
    'A5',
    'B5f',
    'B5',
    'C6',
    'C6s',
    'D6',
    'E6f',
    'E6',
    'F6',
    'F6s',
    'G6',
    'G6s',
];

/** App brand icons (served from /icons after build). Use root-relative paths for routed pages. */
export const APP_BRAND_ICON = '/icons/icon-48.webp';
export const APP_BRAND_ICON_SRCSET_MOBILE = '/icons/icon-48.webp 48w, /icons/icon-72.webp 72w';
export const APP_BRAND_ICON_SRCSET_NAV = '/icons/icon-48.webp 48w, /icons/icon-72.webp 72w, /icons/icon-96.webp 96w';
