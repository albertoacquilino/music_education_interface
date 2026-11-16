export type ActivityId = 'prepare-listen-play' | 'target-intonation';

export type ActivityCancelReason =
  | 'learner-stop'
  | 'navigation'
  | 'superseded'
  | 'app-backgrounded'
  | 'resource-lost';

export interface ActivityFailure {
  readonly code: 'invalid-config' | 'resource-failed' | 'unexpected';
  readonly message: string;
  readonly recoverable: boolean;
}

export interface ActivityResultBase {
  readonly activityId: ActivityId;
  readonly activityVersion: string;
  readonly sessionId: string;
  readonly outcome: 'completed' | 'cancelled' | 'failed';
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly cancelReason?: ActivityCancelReason;
  readonly failure?: ActivityFailure;
}

export type ActivitySnapshot<S, R extends ActivityResultBase> =
  | { readonly lifecycle: 'idle' }
  | {
      readonly lifecycle: 'starting';
      readonly sessionId: string;
      readonly startedAtMs: number;
    }
  | {
      readonly lifecycle: 'running';
      readonly sessionId: string;
      readonly state: S;
    }
  | {
      readonly lifecycle: 'completed';
      readonly sessionId: string;
      readonly result: R;
    }
  | {
      readonly lifecycle: 'cancelled';
      readonly sessionId: string;
      readonly reason: ActivityCancelReason;
      readonly result: R;
    }
  | {
      readonly lifecycle: 'failed';
      readonly sessionId: string;
      readonly failure: ActivityFailure;
      readonly result: R;
    };
