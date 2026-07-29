import { Score } from '../../models/score.types';
import {
  InstrumentId,
  NoteTarget
} from '../../instruments/instrument-definition';
import {
  ActivityCancelReason,
  ActivityResultBase
} from '../../core/activity/activity.types';

export const TARGET_INTONATION_ACTIVITY_VERSION = '1.0.0';

/**
 * These are implementation defaults, not validated pedagogical thresholds.
 * Every value remains explicit in the persisted activity configuration.
 */
export const TARGET_INTONATION_DEFAULTS = {
  targetCount: 3,
  playReferenceTone: true,
  targetPresentationMs: 1000,
  referenceToneDurationMs: 1000,
  toleranceCents: 10,
  farThresholdCents: 30,
  requiredStableMs: 1500,
  maximumSpreadCents: 12,
  minimumValidEstimates: 4,
  maximumSignalGapMs: 350,
  attemptTimeoutMs: 10000,
  maximumAttemptsPerTarget: 3,
  detectorMinimumHz: 140,
  detectorMaximumHz: 2000
} as const;

export interface TargetIntonationConfig {
  readonly instrumentId: InstrumentId;
  readonly lowNoteId: string;
  readonly highNoteId: string;
  readonly lowNoteIndex: number;
  readonly highNoteIndex: number;
  readonly includeAccidentals: boolean;
  readonly referenceA4Hz: number;
  readonly targetCount: number;
  readonly playReferenceTone: boolean;
  readonly targetPresentationMs: number;
  readonly referenceToneDurationMs: number;
  readonly toleranceCents: number;
  readonly farThresholdCents: number;
  readonly requiredStableMs: number;
  readonly maximumSpreadCents: number;
  readonly minimumValidEstimates: number;
  readonly maximumSignalGapMs: number;
  readonly attemptTimeoutMs: number;
  readonly maximumAttemptsPerTarget: number;
  readonly detectorMinimumHz: number;
  readonly detectorMaximumHz: number;
}

export interface IntonationEvaluationConfig {
  readonly toleranceCents: number;
  readonly farThresholdCents: number;
  readonly requiredStableMs: number;
  readonly maximumSpreadCents: number;
  readonly minimumValidEstimates: number;
  readonly maximumSignalGapMs: number;
  readonly detectorMinimumHz: number;
  readonly detectorMaximumHz: number;
}

export type IntonationBand =
  | 'no-signal'
  | 'invalid-estimate'
  | 'out-of-detector-range'
  | 'wrong-note'
  | 'far-flat'
  | 'flat'
  | 'within-tolerance'
  | 'sharp'
  | 'far-sharp'
  | 'unstable';

export interface IntonationFeedback {
  readonly band: IntonationBand;
  readonly target: NoteTarget;
  readonly capturedAtMs: number;
  readonly detectedFrequencyHz?: number;
  readonly detectedSoundingMidi?: number;
  readonly centsFromTarget?: number;
  readonly stableForMs: number;
  readonly requiredStableMs: number;
  readonly stableProgress: number;
  readonly stabilityEstimateCount: number;
  readonly validEstimateCount: number;
  readonly wrongNoteCount: number;
}

export interface IntonationEvaluation {
  readonly feedback: IntonationFeedback;
  readonly stableHoldAchieved: boolean;
}

export interface IntonationAttemptMetrics {
  readonly timeToFirstValidEstimateMs?: number;
  readonly timeToStableHoldMs?: number;
  readonly validEstimateCount: number;
  readonly wrongNoteCount: number;
  readonly medianCents?: number;
  readonly absoluteErrorP95Cents?: number;
  readonly spreadCents?: number;
}

export type IntonationAttemptOutcome =
  | 'stable-hold'
  | 'timeout'
  | 'skipped'
  | 'cancelled';

export interface IntonationAttemptResult extends IntonationAttemptMetrics {
  readonly target: NoteTarget;
  readonly targetNumber: number;
  readonly attemptIndex: number;
  readonly outcome: IntonationAttemptOutcome;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
}

interface TargetIntonationStateBase {
  readonly target: NoteTarget;
  readonly score: Score;
  readonly targetNumber: number;
  readonly targetCount: number;
  readonly attemptIndex: number;
  readonly maximumAttempts: number;
}

export interface PresentingTargetState extends TargetIntonationStateBase {
  readonly kind: 'presenting-target';
  readonly referencePlayback: 'not-requested' | 'playing' | 'failed';
}

export interface AwaitingSignalState extends TargetIntonationStateBase {
  readonly kind: 'awaiting-signal';
  readonly attemptStartedAtMs: number;
  readonly attemptDeadlineAtMs: number;
  readonly feedback: IntonationFeedback;
}

export interface TrackingState extends TargetIntonationStateBase {
  readonly kind: 'tracking';
  readonly attemptStartedAtMs: number;
  readonly attemptDeadlineAtMs: number;
  readonly feedback: IntonationFeedback;
}

export interface AttemptResultState extends TargetIntonationStateBase {
  readonly kind: 'attempt-result';
  readonly result: IntonationAttemptResult;
  readonly canRetry: boolean;
  readonly canSkip: boolean;
  readonly canProceed: boolean;
}

export type TargetIntonationState =
  | PresentingTargetState
  | AwaitingSignalState
  | TrackingState
  | AttemptResultState;

export type TargetIntonationCommand =
  | { readonly type: 'retry-attempt' }
  | { readonly type: 'next-target' }
  | { readonly type: 'skip-target' }
  | { readonly type: 'stop' };

export interface TargetIntonationResult extends ActivityResultBase {
  readonly activityId: 'target-intonation';
  readonly configuration: TargetIntonationConfig;
  readonly plannedTargets: number;
  readonly completedTargets: number;
  readonly successfulTargets: number;
  readonly attempts: readonly IntonationAttemptResult[];
  readonly cancelReason?: ActivityCancelReason;
}
