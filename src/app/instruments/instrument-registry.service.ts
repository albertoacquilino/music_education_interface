import { Injectable } from '@angular/core';
import { CLARINET_BB_INSTRUMENT } from './definitions/clarinet-bb.instrument';
import { OBOE_C_INSTRUMENT } from './definitions/oboe-c.instrument';
import { TRUMPET_BB_INSTRUMENT } from './definitions/trumpet-bb.instrument';
import {
  InstrumentDefinition,
  InstrumentId,
  LegacyInstrumentId,
  NoteTarget,
  createNoteTarget
} from './instrument-definition';

export interface TargetRange {
  readonly lowNoteId: string;
  readonly highNoteId: string;
  readonly includeAccidentals: boolean;
}

export interface InstrumentRegistryPort {
  get(instrumentId: InstrumentId): InstrumentDefinition;
  fromLegacyId(legacyId: LegacyInstrumentId): InstrumentDefinition;
  resolveTarget(
    instrumentId: InstrumentId,
    noteId: string,
    referenceA4Hz: number,
    displayToken?: string
  ): NoteTarget;
  selectableNotes(
    instrumentId: InstrumentId,
    targetRange: TargetRange
  ): readonly InstrumentDefinition['notes'][number][];
}

export const INSTRUMENT_DEFINITIONS: readonly InstrumentDefinition[] = [
  TRUMPET_BB_INSTRUMENT,
  CLARINET_BB_INSTRUMENT,
  OBOE_C_INSTRUMENT
];

@Injectable({
  providedIn: 'root'
})
export class InstrumentRegistryService implements InstrumentRegistryPort {
  private readonly byId = new Map(
    INSTRUMENT_DEFINITIONS.map(definition => [definition.id, definition])
  );

  private readonly byLegacyId = new Map(
    INSTRUMENT_DEFINITIONS.map(definition => [definition.legacyId, definition])
  );

  get(instrumentId: InstrumentId): InstrumentDefinition {
    const instrument = this.byId.get(instrumentId);
    if (!instrument) {
      throw new Error(`Unsupported instrument: ${instrumentId}`);
    }
    return instrument;
  }

  fromLegacyId(legacyId: LegacyInstrumentId): InstrumentDefinition {
    const instrument = this.byLegacyId.get(legacyId);
    if (!instrument) {
      throw new Error(`Unsupported instrument: ${legacyId}`);
    }
    return instrument;
  }

  resolveTarget(
    instrumentId: InstrumentId,
    noteId: string,
    referenceA4Hz: number,
    displayToken?: string
  ): NoteTarget {
    const instrument = this.get(instrumentId);
    const note = instrument.notes.find(candidate => candidate.id === noteId);
    if (!note) {
      throw new Error(`Unsupported target ${noteId} for ${instrumentId}`);
    }
    return createNoteTarget(instrument, note, referenceA4Hz, displayToken);
  }

  selectableNotes(
    instrumentId: InstrumentId,
    targetRange: TargetRange
  ): readonly InstrumentDefinition['notes'][number][] {
    const instrument = this.get(instrumentId);
    const lowIndex = instrument.notes.findIndex(note => note.id === targetRange.lowNoteId);
    const highIndex = instrument.notes.findIndex(note => note.id === targetRange.highNoteId);

    if (lowIndex < 0 || highIndex < 0 || lowIndex > highIndex) {
      throw new Error(
        `Invalid target range ${targetRange.lowNoteId}..${targetRange.highNoteId} `
        + `for ${instrumentId}`
      );
    }

    const notes = instrument.notes
      .slice(lowIndex, highIndex + 1)
      .filter(note => targetRange.includeAccidentals || note.displayTokens.length === 1);

    if (notes.length === 0) {
      throw new Error(`Target range contains no supported notes for current accidental setting`);
    }

    return notes;
  }
}
