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
import { FirebaseService } from '../../services/firebase.service';

@Injectable({
  providedIn: 'root'
})
export class FirebaseActivityAdapter implements ActivityPersistencePort {
  private openedSessionId: string | null = null;
  private closed = false;

  constructor(private readonly firebase: FirebaseService) {}

  async open(envelope: ActivitySessionEnvelope): Promise<void> {
    if (this.openedSessionId) {
      throw new Error(`Persistence session ${this.openedSessionId} is already open`);
    }

    const config = envelope.config as PrepareListenPlayConfig;
    await this.firebase.saveStart(
      config.tempoBpm,
      config.lowNoteIndex,
      config.highNoteIndex,
      config.referenceA4Hz,
      config.includeAccidentals,
      config.useDynamics
    );
    this.openedSessionId = envelope.sessionId;
    this.closed = false;
  }

  async close(result: ActivityResultBase): Promise<void> {
    if (!this.openedSessionId || this.closed) {
      return;
    }

    this.closed = true;
    const collectedMeans = result.activityId === 'prepare-listen-play'
      ? Object.keys((result as PrepareListenPlayResult).collectedMeans).reduce<{
        [cycle: string]: number[];
      }>((means, cycle) => {
        means[cycle] = [
          ...(result as PrepareListenPlayResult).collectedMeans[cycle]
        ];
        return means;
      }, {})
      : {};
    await this.firebase.saveStop(
      result.outcome === 'completed' ? 'finished' : 'interrupted',
      collectedMeans
    );
    this.openedSessionId = null;
  }
}
