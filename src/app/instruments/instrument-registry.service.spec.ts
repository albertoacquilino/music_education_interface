import {
  CLARINET_NOTES,
  OBOE_NOTES,
  TRUMPET_NOTES
} from '../constants';
import {
  InstrumentDefinition,
  validateInstrumentDefinition
} from './instrument-definition';
import {
  INSTRUMENT_DEFINITIONS,
  InstrumentRegistryService
} from './instrument-registry.service';

describe('typed instrument definitions', () => {
  let registry: InstrumentRegistryService;

  beforeEach(() => {
    registry = new InstrumentRegistryService();
  });

  it('preserves note order and available spellings for all existing instruments', () => {
    expect(
      registry.get('trumpet-bb').notes.map(note => note.displayTokens)
    ).toEqual(TRUMPET_NOTES);
    expect(
      registry.get('clarinet-bb').notes.map(note => note.displayTokens)
    ).toEqual(CLARINET_NOTES);
    expect(
      registry.get('oboe-c').notes.map(note => note.displayTokens)
    ).toEqual(OBOE_NOTES);
  });

  it('validates IDs, ordered ranges, transposition, and declared assets', () => {
    const declaredAssets = new Set(
      INSTRUMENT_DEFINITIONS.reduce<string[]>(
        (assets, instrument) => [
          ...assets,
          ...instrument.notes.reduce<string[]>(
            (noteAssets, note) => [
              ...noteAssets,
              note.referenceAudio.path,
              ...(note.fingering.kind === 'asset'
                ? [note.fingering.assetPath]
                : [])
            ],
            []
          )
        ],
        []
      )
    );

    INSTRUMENT_DEFINITIONS.forEach(instrument => {
      expect(
        validateInstrumentDefinition(
          instrument,
          assetPath => declaredAssets.has(assetPath)
        )
      ).toEqual([]);
    });
  });

  it('detects duplicate IDs, missing assets, and range corruption', () => {
    const source = registry.get('trumpet-bb');
    const broken: InstrumentDefinition = {
      ...source,
      notes: [
        source.notes[0],
        {
          ...source.notes[1],
          id: source.notes[0].id
        }
      ],
      supportedRange: {
        lowNoteId: 'missing',
        highNoteId: 'missing'
      }
    };

    const codes = validateInstrumentDefinition(broken, () => false)
      .map(issue => issue.code);
    expect(codes).toContain('duplicate-id');
    expect(codes).toContain('missing-asset');
    expect(codes).toContain('invalid-range');
  });

  it('converts written B-flat and C-instrument pitches to sounding targets', () => {
    const trumpetA4 = registry.get('trumpet-bb').notes
      .find(note => note.displayTokens[0] === 'A4')!;
    const clarinetA4 = registry.get('clarinet-bb').notes
      .find(note => note.displayTokens[0] === 'A4')!;
    const oboeA4 = registry.get('oboe-c').notes
      .find(note => note.displayTokens[0] === 'A4')!;

    expect(trumpetA4.writtenMidi).toBe(69);
    expect(trumpetA4.soundingMidiAtA4_440).toBe(67);
    expect(clarinetA4.soundingMidiAtA4_440).toBe(67);
    expect(oboeA4.soundingMidiAtA4_440).toBe(69);

    expect(
      registry.resolveTarget('trumpet-bb', trumpetA4.id, 440)
        .expectedSoundingFrequencyHz
    ).toBeCloseTo(391.995436, 5);
    expect(
      registry.resolveTarget('oboe-c', oboeA4.id, 440)
        .expectedSoundingFrequencyHz
    ).toBe(440);
  });

  it('uses the selected A4 consistently at 430, 440, and 450 Hz', () => {
    const note = registry.get('clarinet-bb').notes
      .find(candidate => candidate.displayTokens[0] === 'A4')!;

    expect(
      registry.resolveTarget('clarinet-bb', note.id, 430)
        .expectedSoundingFrequencyHz
    ).toBeCloseTo(383.086451, 5);
    expect(
      registry.resolveTarget('clarinet-bb', note.id, 440)
        .expectedSoundingFrequencyHz
    ).toBeCloseTo(391.995436, 5);
    expect(
      registry.resolveTarget('clarinet-bb', note.id, 450)
        .expectedSoundingFrequencyHz
    ).toBeCloseTo(400.904422, 5);
  });

  it('rejects unsupported targets, A4 values, and invalid or empty ranges', () => {
    const trumpet = registry.get('trumpet-bb');
    expect(() => registry.resolveTarget('trumpet-bb', 'missing', 440)).toThrow();
    expect(() => registry.resolveTarget(
      'trumpet-bb',
      trumpet.notes[0].id,
      429
    )).toThrow();
    expect(() => registry.selectableNotes('trumpet-bb', {
      lowNoteId: trumpet.notes[2].id,
      highNoteId: trumpet.notes[2].id,
      includeAccidentals: false
    })).toThrow();
    expect(() => registry.selectableNotes('trumpet-bb', {
      lowNoteId: trumpet.notes[2].id,
      highNoteId: trumpet.notes[1].id,
      includeAccidentals: true
    })).toThrow();
  });

  it('uses an exact checked-in historical asset name for oboe G6', () => {
    const oboeG6 = registry.get('oboe-c').notes
      .find(note => note.displayTokens[0] === 'G6')!;
    expect(oboeG6.referenceAudio.path)
      .toBe('assets/sounds/oboe_note_sounds/G62.m4a');
  });
});
