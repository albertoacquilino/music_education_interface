import {
  FingeringRepresentation,
  InstrumentDefinition,
  InstrumentId,
  LegacyInstrumentId,
  ReferenceAudioAsset,
  buildInstrumentNote
} from '../instrument-definition';

interface DefinitionSource {
  readonly id: InstrumentId;
  readonly legacyId: LegacyInstrumentId;
  readonly displayName: string;
  readonly transpositionSemitones: number;
  readonly transpositionLabel: 'B-flat' | 'C';
  readonly notes: readonly (readonly string[])[];
  readonly fingeringForIndex: (index: number) => FingeringRepresentation;
  readonly audioFileForIndex?: (index: number, primaryToken: string) => string;
}

export function createInstrumentDefinition(source: DefinitionSource): InstrumentDefinition {
  const notes = source.notes.map((displayTokens, index) => {
    const audioFile = source.audioFileForIndex?.(index, displayTokens[0])
      ?? displayTokens[0];
    const referenceAssetPath = (
      `assets/sounds/${source.legacyId}_note_sounds/${audioFile}.m4a`
    ) as ReferenceAudioAsset['path'];

    return buildInstrumentNote(
      source.id,
      index,
      displayTokens,
      source.transpositionSemitones,
      source.fingeringForIndex(index),
      referenceAssetPath
    );
  });

  return {
    id: source.id,
    legacyId: source.legacyId,
    displayName: source.displayName,
    transposition: {
      writtenToSoundingSemitones: source.transpositionSemitones,
      label: source.transpositionLabel
    },
    notes,
    supportedRange: {
      lowNoteId: notes[0].id,
      highNoteId: notes[notes.length - 1].id
    },
    supportedReferenceA4Hz: {
      minimum: 430,
      maximum: 450,
      default: 440
    }
  };
}
