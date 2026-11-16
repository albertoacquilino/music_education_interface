import { FLUTE_NOTES } from '../../constants';
import { createInstrumentDefinition } from './create-instrument-definition';
import { noteAssetName } from '../note-asset-name';

export const FLUTE_C_INSTRUMENT = createInstrumentDefinition({
  id: 'flute-c',
  legacyId: 'flute',
  displayName: 'Flute',
  transpositionSemitones: 0,
  transpositionLabel: 'C',
  notes: FLUTE_NOTES,
  fingeringForIndex: index => ({
    kind: 'asset',
    assetPath: `assets/images/flute_positions/${noteAssetName(FLUTE_NOTES[index][0])}.svg`,
    altText: `Flute fingering for ${FLUTE_NOTES[index][0]}`
  })
});
