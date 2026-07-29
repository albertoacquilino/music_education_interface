import { Observable } from 'rxjs';
import { ActivityContext } from './activity-context';
import {
  ActivityCancelReason,
  ActivityResultBase,
  ActivitySnapshot
} from './activity.types';

export interface LearningActivityController<
  C,
  S,
  R extends ActivityResultBase
> {
  readonly activityId: R['activityId'];
  readonly activityVersion: string;
  readonly snapshot$: Observable<ActivitySnapshot<S, R>>;

  start(config: C, context: ActivityContext, signal: AbortSignal): Promise<void>;
  cancel(reason: ActivityCancelReason): Promise<R>;
  whenSettled(): Promise<R>;
}
