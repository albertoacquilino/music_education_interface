import { OBOE_NOTES, OBOE_POSITIONS } from '../../constants';
import { FingeringRepresentation } from '../instrument-definition';
import { createInstrumentDefinition } from './create-instrument-definition';
import { noteAssetName } from '../note-asset-name';

export const OBOE_C_INSTRUMENT = createInstrumentDefinition({
  id: 'oboe-c',
  legacyId: 'oboe',
  displayName: 'C Oboe',
  transpositionSemitones: 0,
  transpositionLabel: 'C',
  notes: OBOE_NOTES,
  fingeringForIndex: (index): FingeringRepresentation => ({
    kind: 'asset',
    assetPath: `assets/images/oboe_positions/${noteAssetName(OBOE_POSITIONS[index])}.svg`,
    altText: `Oboe fingering for ${OBOE_NOTES[index][0]}`
  }),
  // Keep the alternative G6 recording as the active reference recording.
  audioFileForIndex: (_index, primaryToken) => primaryToken === 'G6' ? 'G6_2' : primaryToken
});
