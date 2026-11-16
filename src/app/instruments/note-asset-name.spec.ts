import { noteAssetName } from './note-asset-name';

describe('noteAssetName', () => {
  it('normalizes accidentals while retaining variants and historical names', () => {
    const cases = {
      C4: 'C4', C4s: 'Cs4', E4f: 'Ef4', G6s: 'Gs6',
      C4s_2: 'Cs4_2', E6f_3beginners: 'Ef6_3beginners',
      B5f_2: 'Bf5_2', G6_2: 'G6_2', D6_2: 'D6_2', B4fbis: 'Bf4bis'
    };
    Object.entries(cases).forEach(([token, filename]) => {
      expect(noteAssetName(token)).toBe(filename);
      expect(noteAssetName(filename)).toBe(filename);
    });
  });
});
