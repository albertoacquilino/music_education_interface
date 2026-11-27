import { AttackTracker } from './attack-tracker';

describe('AttackTracker', () => {
  let tracker: AttackTracker;

  beforeEach(() => {
    tracker = new AttackTracker();
  });

  it('adds a measuring record on onset', () => {
    expect(tracker.applyEvents([0, 1.5, 0, 0, 0])).toBeTrue();
    expect(tracker.attacks.length).toBe(1);
    expect(tracker.attacks[0]).toEqual(jasmine.objectContaining({
      id: 1, onsetS: 1.5, attackMs: null, status: 'measuring'
    }));
  });

  it('updates the value on noise ducking and finalises on note end', () => {
    // Envelope frames: [t, input, harmonic, noise, pitch]
    tracker.addEnvelopes([1.55, 0, 0, 0, 466, 1.56, 0, 0, 0, 466, 1.57, 0, 0, 0, 467]);
    tracker.applyEvents([0, 1.5, 0, 0, 0, 1, 1.5, 0.04, 0, 0]);
    expect(tracker.attacks[0].attackMs).toBeCloseTo(40);
    expect(tracker.attacks[0].status).toBe('updating');
    expect(tracker.attacks[0].pitchHz).toBe(466);

    tracker.applyEvents([1, 1.5, 0.05, 0, 0]);
    expect(tracker.attacks[0].attackMs).toBeCloseTo(50);

    tracker.applyEvents([2, 1.5, 2.3, 1, 0.8]);
    expect(tracker.attacks[0].status).toBe('final');
    expect(tracker.attacks[0].attackMs).toBeCloseTo(50);
  });

  it('voids the value when the note ends without ducking', () => {
    tracker.applyEvents([0, 1, 0, 0, 0, 1, 1, 0.2, 0, 0, 2, 1, 1.4, 0, 0.4]);
    expect(tracker.attacks[0].status).toBe('not-measured');
    expect(tracker.attacks[0].attackMs).toBeNull();
    expect(tracker.latestMeasured).toBeNull();
  });

  it('keeps notes apart by onset', () => {
    tracker.applyEvents([0, 1, 0, 0, 0, 0, 2, 0, 0, 0, 1, 1, 0.03, 0, 0]);
    expect(tracker.attacks.map(a => a.attackMs)).toEqual([30, null]);
    tracker.clear();
    expect(tracker.attacks.length).toBe(0);
  });
});
