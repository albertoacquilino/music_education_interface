import { Injectable } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { ActivityContext } from './activity-context';
import { LearningActivityController } from './activity-controller';
import {
  ActivityCancelReason,
  ActivityResultBase,
  ActivitySnapshot
} from './activity.types';

type AnyController = LearningActivityController<unknown, unknown, ActivityResultBase>;

@Injectable({
  providedIn: 'root'
})
export class ActivitySessionService {
  readonly active$ = new BehaviorSubject<boolean>(false);
  readonly snapshot$ = new BehaviorSubject<
    ActivitySnapshot<unknown, ActivityResultBase>
  >({ lifecycle: 'idle' });

  private activeController: AnyController | null = null;
  private activeAbortController: AbortController | null = null;
  private snapshotSubscription: Subscription | null = null;

  get isActive(): boolean {
    return this.active$.value;
  }

  async start<C, S, R extends ActivityResultBase>(
    controller: LearningActivityController<C, S, R>,
    config: C,
    context: ActivityContext
  ): Promise<void> {
    if (this.activeController) {
      await this.cancel('superseded');
    }

    this.activeController = controller as unknown as AnyController;
    const abortController = new AbortController();
    this.activeAbortController = abortController;
    let subscribing = true;
    this.snapshotSubscription = controller.snapshot$.subscribe(snapshot => {
      // BehaviorSubject replays the previous session's terminal snapshot on
      // subscription. Only snapshots emitted by this start own the new boundary.
      if (subscribing) { return; }
      this.snapshot$.next(snapshot as ActivitySnapshot<unknown, ActivityResultBase>);
      const active = snapshot.lifecycle === 'starting' || snapshot.lifecycle === 'running';
      this.active$.next(active);

      if (!active && snapshot.lifecycle !== 'idle') {
        this.releaseSessionBoundary();
      }
    });

    subscribing = false;
    try {
      await controller.start(config, context, abortController.signal);
    } catch (error) {
      if (this.activeAbortController === abortController) {
        abortController.abort();
        this.releaseSessionBoundary();
      }
      throw error;
    }
  }

  async cancel(reason: ActivityCancelReason): Promise<ActivityResultBase | null> {
    const controller = this.activeController;
    if (!controller) {
      return null;
    }

    const result = await controller.cancel(reason);
    this.activeAbortController?.abort();
    this.releaseSessionBoundary();
    return result;
  }

  private releaseSessionBoundary(): void {
    this.active$.next(false);
    this.snapshotSubscription?.unsubscribe();
    this.snapshotSubscription = null;
    this.activeAbortController = null;
    this.activeController = null;
  }
}
