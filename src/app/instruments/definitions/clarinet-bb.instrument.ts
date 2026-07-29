import { CLARINET_NOTES, CLARINET_POSITIONS } from '../../constants';
import { FingeringRepresentation } from '../instrument-definition';
import { createInstrumentDefinition } from './create-instrument-definition';

export const CLARINET_BB_INSTRUMENT = createInstrumentDefinition({
  id: 'clarinet-bb',
  legacyId: 'clarinet',
  displayName: 'B-flat Clarinet',
  transpositionSemitones: -2,
  transpositionLabel: 'B-flat',
  notes: CLARINET_NOTES,
  fingeringForIndex: (index): FingeringRepresentation => ({
    kind: 'asset',
    assetPath: `assets/images/clarinet_positions/${CLARINET_POSITIONS[index]}.svg`,
    altText: `Clarinet fingering for ${CLARINET_NOTES[index][0]}`
  })
});
