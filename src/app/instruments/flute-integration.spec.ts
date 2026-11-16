import { InstrumentRegistryService } from './instrument-registry.service';
import { noteAssetName } from './note-asset-name';
import { scoreFromNote } from '../utils/score.utils';
import { IntonationEvaluator } from '../activities/target-intonation/intonation-evaluator';
import { TARGET_INTONATION_DEFAULTS } from '../activities/target-intonation/target-intonation.types';
import { FluteFingeringComponent } from '../components/flute-fingering/flute-fingering.component';
import * as pitchlite from 'src/app/services/pitchlite';

describe('concert flute integration', () => {
  const registry = new InstrumentRegistryService();
  const flute = registry.get('flute-c');
  const stems = 'B3 C4 Cs4 D4 Ef4 E4 F4 Fs4 G4 Gs4 A4 Bf4 B4 C5 Cs5 D5 Ef5 E5 F5 Fs5 G5 Gs5 A5 Bf5 B5 C6 Cs6 D6 Ef6 E6 F6 Fs6 G6 Gs6 A6 Bf6 B6'.split(' ');

  it('maps all 37 non-transposing notes and every alias to exact accessible assets', async () => {
    expect(flute.notes.length).toBe(37);
    for (const [index, note] of flute.notes.entries()) {
      expect(note.writtenMidi).toBe(59 + index);
      expect(note.soundingMidiAtA4_440).toBe(note.writtenMidi);
      expect(note.referenceAudio.path).toBe('assets/sounds/flute_note_sounds/' + stems[index] + '.m4a');
      expect(note.fingering.kind).toBe('asset');
      if (note.fingering.kind !== 'asset') { throw new Error('Expected SVG'); }
      expect(note.fingering.assetPath).toBe('assets/images/flute_positions/' + stems[index] + '.svg');
      for (const token of note.displayTokens) {
        const target = registry.resolveTarget(flute.id, note.id, 440, token);
        expect(target.referenceAudio).toBe(note.referenceAudio);
        expect(target.fingering).toBe(note.fingering);
      }
      for (const path of [
        note.referenceAudio.path, note.fingering.assetPath,
        'assets/images/clarinet_notes_images/_' + noteAssetName(note.displayTokens[0]) + '.svg'
      ]) {
        const response = await fetch('/' + path);
        expect(response.ok).withContext(path).toBeTrue();
        expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
      }
    }
  });

  it('uses inclusive ranges, optional accidentals and the existing written score', () => {
    expect(flute.displayName).toBe('Flute');
    expect(flute.id).toBe('flute-c');
    expect(registry.selectableNotes(flute.id, {
      lowNoteId: flute.notes[0].id, highNoteId: flute.notes[36].id, includeAccidentals: true
    }).length).toBe(37);
    expect(registry.selectableNotes(flute.id, {
      lowNoteId: flute.notes[0].id, highNoteId: flute.notes[36].id, includeAccidentals: false
    }).length).toBe(22);
    const score = scoreFromNote('E6f', flute.id);
    expect(score.measures.length).toBe(3);
    expect(score.measures[1][0].notes).toEqual(['Eb/6']);
  });

  for (const referenceA4Hz of [430, 440, 450]) {
    it('accepts B6 at A4=' + referenceA4Hz + ' without changing intonation thresholds', () => {
      const target = registry.resolveTarget(flute.id, flute.notes[36].id, referenceA4Hz);
      const evaluator = new IntonationEvaluator(target, { ...TARGET_INTONATION_DEFAULTS, detectorMaximumHz: 2100 }, 0);
      const result = evaluator.evaluate({
        kind: 'voiced', frequencyHz: target.expectedSoundingFrequencyHz,
        capturedAtMs: 0, emittedAtMs: 0
      });
      expect(result.feedback.band).toBe('within-tolerance');
      expect(TARGET_INTONATION_DEFAULTS.detectorMaximumHz).toBe(2000);
    });
  }

  it('enlarges a snapshot without changing the live note and bounds zoom', () => {
    const component = new FluteFingeringComponent();
    component.src = 'B6.svg'; component.alt = 'Flute B6';
    component.open();
    component.src = 'C4.svg';
    expect(component.enlargedSrc).toBe('B6.svg');
    expect(component.enlargedAlt).toBe('Flute B6');
    component.setZoom(10); expect(component.zoom).toBe(4);
    component.setZoom(0); expect(component.zoom).toBe(1);
  });

  it('processes synthetic high-register signals through the actual bundled WASM detector', async () => {
    const wasm = await pitchlite({ locateFile: () => '/assets/pitchlite.wasm' });
    for (const rate of [44100, 48000]) {
      const count = wasm._pitchliteInit(4096, 512, rate, false, 140);
      const input = wasm._malloc(4096 * 4), output = wasm._malloc(count * 4);
      try {
        for (const hz of [1930.6347, 1975.5332, 2020.4317, 2100]) {
          const frame = Float32Array.from({ length: 4096 }, (_, i) => Math.sin(2 * Math.PI * hz * i / rate));
          wasm.HEAPF32.set(frame, input / 4);
          wasm._pitchlitePitches(input, output);
          const detected = wasm.HEAPF32[output / 4 + count - 1];
          expect(Math.abs(1200 * Math.log2(detected / hz))).withContext(rate + ' Hz / ' + hz).toBeLessThan(10);
        }
      } finally { wasm._free(input); wasm._free(output); }
    }
  });
});
