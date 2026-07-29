import { Injectable } from '@angular/core';
import {
  ActivityPersistencePort,
  ActivitySessionEnvelope
} from '../../core/activity/activity-context';
import { ActivityResultBase } from '../../core/activity/activity.types';
import {
  PrepareListenPlayConfig,
  PrepareListenPlayResult
} from '../../activities/prepare-listen-play/prepare-listen-play.types';
import {
  IntonationAttemptResult,
  TargetIntonationConfig,
  TargetIntonationResult
} from '../../activities/target-intonation/target-intonation.types';
import { formatAppPitchToken } from '../../core/music/pitch-math';
import {
  PersistedIntonationAttempt,
  TypedActivityResult
} from '../../models/firebase.types';
import { FirebaseService } from '../../services/firebase.service';

@Injectable({
  providedIn: 'root'
})
export class FirebaseActivityAdapter implements ActivityPersistencePort {
  private openedSessionId: string | null = null;
  private openedActivityId: ActivityResultBase['activityId'] | null = null;
  private closed = false;

  constructor(private readonly firebase: FirebaseService) {}

  async open(envelope: ActivitySessionEnvelope): Promise<void> {
    if (this.openedSessionId) {
      throw new Error(`Persistence session ${this.openedSessionId} is already open`);
    }

    if (envelope.activityId === 'prepare-listen-play') {
      const config = envelope.config as PrepareListenPlayConfig;
      await this.firebase.saveStart(
        config.tempoBpm,
        config.lowNoteIndex,
        config.highNoteIndex,
        config.referenceA4Hz,
        config.includeAccidentals,
        config.useDynamics
      );
    } else {
      const config = envelope.config as TargetIntonationConfig;
      await this.firebase.saveTypedActivityStart({
        schemaVersion: envelope.schemaVersion,
        sessionId: envelope.sessionId,
        activityId: envelope.activityId,
        activityVersion: envelope.activityVersion,
        instrumentId: envelope.instrumentId,
        configuration: { ...config },
        sessionStartedAtMs: envelope.startedAtMs
      });
    }
    this.openedSessionId = envelope.sessionId;
    this.openedActivityId = envelope.activityId;
    this.closed = false;
  }

  async close(result: ActivityResultBase): Promise<void> {
    if (!this.openedSessionId || this.closed) {
      return;
    }

    if (
      result.sessionId !== this.openedSessionId
      || result.activityId !== this.openedActivityId
    ) {
      throw new Error('Persistence result does not match the open activity session');
    }

    this.closed = true;
    try {
      if (result.activityId === 'target-intonation') {
        await this.firebase.saveTypedActivityStop(
          this.toTypedResult(result as TargetIntonationResult)
        );
        return;
      }

      const collectedMeans = Object.keys(
        (result as PrepareListenPlayResult).collectedMeans
      ).reduce<{
        [cycle: string]: number[];
      }>((means, cycle) => {
        means[cycle] = [
          ...(result as PrepareListenPlayResult).collectedMeans[cycle]
        ];
        return means;
      }, {});
      await this.firebase.saveStop(
        result.outcome === 'completed' ? 'finished' : 'interrupted',
        collectedMeans
      );
    } finally {
      this.openedSessionId = null;
      this.openedActivityId = null;
    }
  }

  private toTypedResult(result: TargetIntonationResult): TypedActivityResult {
    return {
      activityId: result.activityId,
      activityVersion: result.activityVersion,
      sessionId: result.sessionId,
      outcome: result.outcome,
      startedAtMs: result.startedAtMs,
      endedAtMs: result.endedAtMs,
      plannedTargets: result.plannedTargets,
      completedTargets: result.completedTargets,
      successfulTargets: result.successfulTargets,
      attempts: result.attempts.map(attempt => this.toTypedAttempt(attempt)),
      ...(result.cancelReason ? { cancelReason: result.cancelReason } : {}),
      ...(result.failure ? { failure: { ...result.failure } } : {})
    };
  }

  private toTypedAttempt(
    attempt: IntonationAttemptResult
  ): PersistedIntonationAttempt {
    return {
      target: {
        instrumentId: attempt.target.instrumentId,
        noteId: attempt.target.noteId,
        noteIndex: attempt.target.noteIndex,
        writtenToken: formatAppPitchToken(attempt.target.written),
        soundingToken: formatAppPitchToken(attempt.target.sounding),
        displayToken: attempt.target.displayToken,
        expectedSoundingFrequencyHz:
          attempt.target.expectedSoundingFrequencyHz,
        referenceA4Hz: attempt.target.referenceA4Hz
      },
      targetNumber: attempt.targetNumber,
      attemptIndex: attempt.attemptIndex,
      outcome: attempt.outcome,
      startedAtMs: attempt.startedAtMs,
      endedAtMs: attempt.endedAtMs,
      validEstimateCount: attempt.validEstimateCount,
      wrongNoteCount: attempt.wrongNoteCount,
      ...(attempt.timeToFirstValidEstimateMs === undefined
        ? {}
        : {
          timeToFirstValidEstimateMs: attempt.timeToFirstValidEstimateMs
        }),
      ...(attempt.timeToStableHoldMs === undefined
        ? {}
        : { timeToStableHoldMs: attempt.timeToStableHoldMs }),
      ...(attempt.medianCents === undefined
        ? {}
        : { medianCents: attempt.medianCents }),
      ...(attempt.absoluteErrorP95Cents === undefined
        ? {}
        : { absoluteErrorP95Cents: attempt.absoluteErrorP95Cents }),
      ...(attempt.spreadCents === undefined
        ? {}
        : { spreadCents: attempt.spreadCents })
    };
  }
}
