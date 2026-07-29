import {
  SpelledPitch,
  frequencyForMidi,
  midiToSpelledPitch,
  parseAppPitchToken,
  spelledPitchToMidi
} from '../core/music/pitch-math';

export type InstrumentId = 'trumpet-bb' | 'clarinet-bb' | 'oboe-c';
export type LegacyInstrumentId = 'trumpet' | 'clarinet' | 'oboe';

export type FingeringRepresentation =
  | {
      readonly kind: 'valves';
      readonly pressedValveNumbers: readonly (1 | 2 | 3)[];
      readonly thirdValveSlide: 'none' | 'extend';
    }
  | {
      readonly kind: 'asset';
      readonly assetPath: `assets/images/${string}.svg`;
      readonly altText: string;
    };

export interface ReferenceAudioAsset {
  readonly path: `assets/sounds/${string}.m4a`;
  readonly recordedReferenceA4Hz: 440;
  readonly recordedSoundingFrequencyHz: number;
  readonly validationStatus: 'declared-unmeasured';
}

export interface InstrumentNoteDefinition {
  readonly id: string;
  readonly index: number;
  readonly written: SpelledPitch;
  readonly writtenMidi: number;
  readonly sounding: SpelledPitch;
  readonly soundingMidiAtA4_440: number;
  readonly displaySpellings: readonly SpelledPitch[];
  readonly displayTokens: readonly string[];
  readonly fingering: FingeringRepresentation;
  readonly referenceAudio: ReferenceAudioAsset;
}

export interface InstrumentDefinition {
  readonly id: InstrumentId;
  readonly legacyId: LegacyInstrumentId;
  readonly displayName: string;
  readonly transposition: {
    readonly writtenToSoundingSemitones: number;
    readonly label: 'B-flat' | 'C';
  };
  readonly notes: readonly InstrumentNoteDefinition[];
  readonly supportedRange: {
    readonly lowNoteId: string;
    readonly highNoteId: string;
  };
  readonly supportedReferenceA4Hz: {
    readonly minimum: 430;
    readonly maximum: 450;
    readonly default: 440;
  };
}

export interface NoteTarget {
  readonly instrumentId: InstrumentId;
  readonly noteId: string;
  readonly noteIndex: number;
  readonly written: SpelledPitch;
  readonly sounding: SpelledPitch;
  readonly displayedSpelling: SpelledPitch;
  readonly displayToken: string;
  readonly expectedSoundingFrequencyHz: number;
  readonly referenceA4Hz: number;
  readonly fingering: FingeringRepresentation;
  readonly referenceAudio: ReferenceAudioAsset;
}

export type InstrumentDefinitionIssueCode =
  | 'duplicate-id'
  | 'missing-asset'
  | 'invalid-range'
  | 'invalid-transposition'
  | 'invalid-spelling';

export interface InstrumentDefinitionIssue {
  readonly code: InstrumentDefinitionIssueCode;
  readonly path: string;
  readonly message: string;
}

export function buildInstrumentNote(
  instrumentId: InstrumentId,
  index: number,
  displayTokens: readonly string[],
  writtenToSoundingSemitones: number,
  fingering: FingeringRepresentation,
  referenceAssetPath: ReferenceAudioAsset['path']
): InstrumentNoteDefinition {
  const displaySpellings = displayTokens.map(parseAppPitchToken);
  const written = displaySpellings[0];
  const writtenMidi = spelledPitchToMidi(written);
  const soundingMidiAtA4_440 = writtenMidi + writtenToSoundingSemitones;

  return {
    id: `${instrumentId}:${displayTokens[0]}`,
    index,
    written,
    writtenMidi,
    sounding: midiToSpelledPitch(soundingMidiAtA4_440),
    soundingMidiAtA4_440,
    displaySpellings,
    displayTokens: [...displayTokens],
    fingering,
    referenceAudio: {
      path: referenceAssetPath,
      recordedReferenceA4Hz: 440,
      recordedSoundingFrequencyHz: frequencyForMidi(soundingMidiAtA4_440, 440),
      validationStatus: 'declared-unmeasured'
    }
  };
}

export function createNoteTarget(
  instrument: InstrumentDefinition,
  note: InstrumentNoteDefinition,
  referenceA4Hz: number,
  displayToken = note.displayTokens[0]
): NoteTarget {
  if (
    referenceA4Hz < instrument.supportedReferenceA4Hz.minimum
    || referenceA4Hz > instrument.supportedReferenceA4Hz.maximum
  ) {
    throw new Error(
      `Unsupported A4 ${referenceA4Hz} Hz for ${instrument.id}; `
      + `expected ${instrument.supportedReferenceA4Hz.minimum}-${instrument.supportedReferenceA4Hz.maximum} Hz`
    );
  }

  const spellingIndex = note.displayTokens.indexOf(displayToken);
  if (spellingIndex < 0) {
    throw new Error(`Unsupported spelling ${displayToken} for ${note.id}`);
  }

  return {
    instrumentId: instrument.id,
    noteId: note.id,
    noteIndex: note.index,
    written: note.written,
    sounding: note.sounding,
    displayedSpelling: note.displaySpellings[spellingIndex],
    displayToken,
    expectedSoundingFrequencyHz: frequencyForMidi(
      note.soundingMidiAtA4_440,
      referenceA4Hz
    ),
    referenceA4Hz,
    fingering: note.fingering,
    referenceAudio: note.referenceAudio
  };
}

export function validateInstrumentDefinition(
  instrument: InstrumentDefinition,
  assetExists: (path: string) => boolean = () => true
): readonly InstrumentDefinitionIssue[] {
  const issues: InstrumentDefinitionIssue[] = [];
  const ids = new Set<string>();

  instrument.notes.forEach((note, index) => {
    if (ids.has(note.id)) {
      issues.push({
        code: 'duplicate-id',
        path: `notes.${index}.id`,
        message: `Duplicate note ID ${note.id}`
      });
    }
    ids.add(note.id);

    if (!assetExists(note.referenceAudio.path)) {
      issues.push({
        code: 'missing-asset',
        path: `notes.${index}.referenceAudio.path`,
        message: `Missing reference asset ${note.referenceAudio.path}`
      });
    }

    if (
      note.fingering.kind === 'asset'
      && !assetExists(note.fingering.assetPath)
    ) {
      issues.push({
        code: 'missing-asset',
        path: `notes.${index}.fingering.assetPath`,
        message: `Missing fingering asset ${note.fingering.assetPath}`
      });
    }

    if (note.displaySpellings.length === 0 || note.displayTokens.length === 0) {
      issues.push({
        code: 'invalid-spelling',
        path: `notes.${index}.displaySpellings`,
        message: `Note ${note.id} has no display spelling`
      });
    }

    if (
      note.soundingMidiAtA4_440 - note.writtenMidi
      !== instrument.transposition.writtenToSoundingSemitones
    ) {
      issues.push({
        code: 'invalid-transposition',
        path: `notes.${index}.soundingMidiAtA4_440`,
        message: `Note ${note.id} does not match the instrument transposition`
      });
    }

    if (index > 0 && note.writtenMidi <= instrument.notes[index - 1].writtenMidi) {
      issues.push({
        code: 'invalid-range',
        path: `notes.${index}.writtenMidi`,
        message: `Note ${note.id} is not strictly above the previous note`
      });
    }
  });

  if (
    instrument.notes.length === 0
    || instrument.supportedRange.lowNoteId !== instrument.notes[0]?.id
    || instrument.supportedRange.highNoteId !== instrument.notes[instrument.notes.length - 1]?.id
  ) {
    issues.push({
      code: 'invalid-range',
      path: 'supportedRange',
      message: 'Supported range must match the first and last ordered note IDs'
    });
  }

  return issues;
}
