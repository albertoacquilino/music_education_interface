import { TRUMPET_BTN, TRUMPET_NOTES } from '../../constants';
import { FingeringRepresentation } from '../instrument-definition';
import { createInstrumentDefinition } from './create-instrument-definition';

export const TRUMPET_BB_INSTRUMENT = createInstrumentDefinition({
  id: 'trumpet-bb',
  legacyId: 'trumpet',
  displayName: 'B-flat Trumpet',
  transpositionSemitones: -2,
  transpositionLabel: 'B-flat',
  notes: TRUMPET_NOTES,
  fingeringForIndex: (index): FingeringRepresentation => ({
    kind: 'valves',
    pressedValveNumbers: TRUMPET_BTN[index]
      .filter((valve): valve is 1 | 2 | 3 => valve === 1 || valve === 2 || valve === 3),
    thirdValveSlide: TRUMPET_BTN[index].includes(0) ? 'extend' : 'none'
  })
});
