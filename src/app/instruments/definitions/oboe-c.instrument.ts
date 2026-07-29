import { OBOE_NOTES, OBOE_POSITIONS } from '../../constants';
import { FingeringRepresentation } from '../instrument-definition';
import { createInstrumentDefinition } from './create-instrument-definition';

export const OBOE_C_INSTRUMENT = createInstrumentDefinition({
  id: 'oboe-c',
  legacyId: 'oboe',
  displayName: 'C Oboe',
  transpositionSemitones: 0,
  transpositionLabel: 'C',
  notes: OBOE_NOTES,
  fingeringForIndex: (index): FingeringRepresentation => ({
    kind: 'asset',
    assetPath: `assets/images/oboe_positions/${OBOE_POSITIONS[index]}.svg`,
    altText: `Oboe fingering for ${OBOE_NOTES[index][0]}`
  }),
  // The checked-in G6 reference recording uses the historical G62 filename.
  audioFileForIndex: (_index, primaryToken) => primaryToken === 'G6' ? 'G62' : primaryToken
});
