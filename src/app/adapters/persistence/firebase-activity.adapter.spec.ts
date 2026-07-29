import {
  PrepareListenPlayConfig,
  PrepareListenPlayResult
} from '../../activities/prepare-listen-play/prepare-listen-play.types';
import {
  TARGET_INTONATION_DEFAULTS,
  TargetIntonationConfig,
  TargetIntonationResult
} from '../../activities/target-intonation/target-intonation.types';
import { InstrumentRegistryService } from '../../instruments/instrument-registry.service';
import { FirebaseService } from '../../services/firebase.service';
import { FirebaseActivityAdapter } from './firebase-activity.adapter';

describe('FirebaseActivityAdapter', () => {
  let firebase: {
    saveStart: jasmine.Spy;
    saveStop: jasmine.Spy;
    saveTypedActivityStart: jasmine.Spy;
    saveTypedActivityStop: jasmine.Spy;
  };
  let adapter: FirebaseActivityAdapter;

  beforeEach(() => {
    firebase = {
      saveStart: jasmine.createSpy('saveStart').and.resolveTo(),
      saveStop: jasmine.createSpy('saveStop').and.resolveTo(),
      saveTypedActivityStart:
        jasmine.createSpy('saveTypedActivityStart').and.resolveTo(),
      saveTypedActivityStop:
        jasmine.createSpy('saveTypedActivityStop').and.resolveTo()
    };
    adapter = new FirebaseActivityAdapter(
      firebase as unknown as FirebaseService
    );
  });

  it('retains the existing PLP persistence shape', async () => {
    const config: PrepareListenPlayConfig = {
      instrumentId: 'trumpet-bb',
      lowNoteId: 'low',
      highNoteId: 'high',
      lowNoteIndex: 1,
      highNoteIndex: 2,
      tempoBpm: 80,
      beatsPerPhase: 4,
      cycles: 1,
      includeAccidentals: true,
      useDynamics: false,
      pitchDisplay: 'target',
      referenceA4Hz: 440
    };
    await adapter.open({
      schemaVersion: 2,
      sessionId: 'plp-session',
      activityId: 'prepare-listen-play',
      activityVersion: '1.0.0',
      instrumentId: 'trumpet-bb',
      config,
      startedAtMs: 100
    });
    const result: PrepareListenPlayResult = {
      activityId: 'prepare-listen-play',
      activityVersion: '1.0.0',
      sessionId: 'plp-session',
      outcome: 'completed',
      startedAtMs: 100,
      endedAtMs: 200,
      plannedCycles: 1,
      completedCycles: 1,
      presentedTargetIds: ['target'],
      collectedMeans: { 1: [440, 441] }
    };
    await adapter.close(result);

    expect(firebase.saveStart).toHaveBeenCalledOnceWith(
      80,
      1,
      2,
      440,
      true,
      false
    );
    expect(firebase.saveStop).toHaveBeenCalledOnceWith(
      'finished',
      { 1: [440, 441] }
    );
    expect(firebase.saveTypedActivityStart).not.toHaveBeenCalled();
  });

  it('persists bounded typed target-intonation configuration and results', async () => {
    const registry = new InstrumentRegistryService();
    const instrument = registry.get('oboe-c');
    const note = instrument.notes[0];
    const target = registry.resolveTarget('oboe-c', note.id, 440);
    const config: TargetIntonationConfig = {
      instrumentId: 'oboe-c',
      lowNoteId: note.id,
      highNoteId: note.id,
      lowNoteIndex: note.index,
      highNoteIndex: note.index,
      includeAccidentals: false,
      referenceA4Hz: 440,
      targetCount: 1,
      playReferenceTone: false,
      targetPresentationMs: TARGET_INTONATION_DEFAULTS.targetPresentationMs,
      referenceToneDurationMs:
        TARGET_INTONATION_DEFAULTS.referenceToneDurationMs,
      toleranceCents: TARGET_INTONATION_DEFAULTS.toleranceCents,
      farThresholdCents: TARGET_INTONATION_DEFAULTS.farThresholdCents,
      requiredStableMs: TARGET_INTONATION_DEFAULTS.requiredStableMs,
      maximumSpreadCents: TARGET_INTONATION_DEFAULTS.maximumSpreadCents,
      minimumValidEstimates:
        TARGET_INTONATION_DEFAULTS.minimumValidEstimates,
      maximumSignalGapMs: TARGET_INTONATION_DEFAULTS.maximumSignalGapMs,
      attemptTimeoutMs: TARGET_INTONATION_DEFAULTS.attemptTimeoutMs,
      maximumAttemptsPerTarget:
        TARGET_INTONATION_DEFAULTS.maximumAttemptsPerTarget,
      detectorMinimumHz: TARGET_INTONATION_DEFAULTS.detectorMinimumHz,
      detectorMaximumHz: TARGET_INTONATION_DEFAULTS.detectorMaximumHz
    };
    await adapter.open({
      schemaVersion: 2,
      sessionId: 'intonation-session',
      activityId: 'target-intonation',
      activityVersion: '1.0.0',
      instrumentId: 'oboe-c',
      config,
      startedAtMs: 100
    });
    const result: TargetIntonationResult = {
      activityId: 'target-intonation',
      activityVersion: '1.0.0',
      sessionId: 'intonation-session',
      outcome: 'completed',
      startedAtMs: 100,
      endedAtMs: 1800,
      configuration: config,
      plannedTargets: 1,
      completedTargets: 1,
      successfulTargets: 1,
      attempts: [{
        target,
        targetNumber: 1,
        attemptIndex: 1,
        outcome: 'stable-hold',
        startedAtMs: 200,
        endedAtMs: 1800,
        timeToFirstValidEstimateMs: 100,
        timeToStableHoldMs: 1600,
        validEstimateCount: 20,
        wrongNoteCount: 2,
        medianCents: -1,
        absoluteErrorP95Cents: 6,
        spreadCents: 9
      }]
    };
    await adapter.close(result);
    await adapter.close(result);

    const start = firebase.saveTypedActivityStart.calls.mostRecent().args[0];
    const persisted = firebase.saveTypedActivityStop.calls.mostRecent().args[0];
    expect(start.activityId).toBe('target-intonation');
    expect(start.configuration).toEqual(config);
    expect(persisted.attempts[0].target.noteId).toBe(note.id);
    expect(persisted.attempts[0].target.writtenToken)
      .toBe(target.displayToken);
    expect(persisted.attempts[0].timeToStableHoldMs).toBe(1600);
    expect(persisted.attempts[0].wrongNoteCount).toBe(2);
    expect(firebase.saveTypedActivityStop).toHaveBeenCalledTimes(1);

    const serialized = JSON.stringify(persisted);
    expect(serialized).not.toContain('samples');
    expect(serialized).not.toContain('pitchTrace');
    expect(serialized).not.toContain('rawAudio');
  });

  it('rejects a result for a different session', async () => {
    const config = {
      instrumentId: 'oboe-c',
      lowNoteIndex: 0,
      highNoteIndex: 0,
      referenceA4Hz: 440,
      includeAccidentals: false
    };
    await adapter.open({
      schemaVersion: 2,
      sessionId: 'open-session',
      activityId: 'target-intonation',
      activityVersion: '1.0.0',
      instrumentId: 'oboe-c',
      config,
      startedAtMs: 100
    });

    await expectAsync(adapter.close({
      activityId: 'target-intonation',
      activityVersion: '1.0.0',
      sessionId: 'other-session',
      outcome: 'cancelled',
      startedAtMs: 100,
      endedAtMs: 200
    })).toBeRejectedWithError(
      'Persistence result does not match the open activity session'
    );
    expect(firebase.saveTypedActivityStop).not.toHaveBeenCalled();
  });
});
