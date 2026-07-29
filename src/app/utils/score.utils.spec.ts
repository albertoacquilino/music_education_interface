import { scoreFromNote } from './score.utils';

describe('scoreFromNote current notation contract', () => {
  it('always returns treble clef, C key, 4/4, and three whole-measure phases', () => {
    const score = scoreFromNote('C4', 'trumpet');

    expect(score.clef).toBe('treble');
    expect(score.keySignature).toBe('C');
    expect(score.timeSignature).toBe('4/4');
    expect(score.dynamicPosition).toBe(2);
    expect(score.measures).toEqual([
      [{ notes: ['c/5'], duration: 'wr' }],
      [{ notes: ['C/4'], duration: 'w' }],
      [{ notes: ['C/4'], duration: 'w' }]
    ]);
  });

  it('maps sharp and flat suffixes into VexFlow accidental tokens', () => {
    expect(scoreFromNote('C4s', 'trumpet').measures[1][0].notes).toEqual(['C#/4']);
    expect(scoreFromNote('D4f', 'trumpet').measures[1][0].notes).toEqual(['Db/4']);
  });

  it('accepts a dynamic only as a fixed second-measure marking', () => {
    const score = scoreFromNote('A4', 'oboe', 'mf');

    expect(score.dynamic).toBe('mf');
    expect(score.dynamicPosition).toBe(2);
  });

  it('ignores the instrument argument and applies no transposition', () => {
    const trumpet = scoreFromNote('A4', 'trumpet');
    const clarinet = scoreFromNote('A4', 'clarinet');
    const oboe = scoreFromNote('A4', 'oboe');

    expect(clarinet).toEqual(trumpet);
    expect(oboe).toEqual(trumpet);
  });
});
