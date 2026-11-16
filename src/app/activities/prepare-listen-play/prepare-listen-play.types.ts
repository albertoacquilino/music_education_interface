import { Score } from '../../models/score.types';
import { InstrumentId, NoteTarget } from '../../instruments/instrument-definition';
import {
  ActivityCancelReason,
  ActivityResultBase
} from '../../core/activity/activity.types';

export type PrepareListenPlayPhase = 'preparing' | 'listening' | 'playing';
export type BeatIndex = 0 | 1 | 2 | 3;

export interface PrepareListenPlayConfig {
  readonly instrumentId: InstrumentId;
  readonly lowNoteId: string;
  readonly highNoteId: string;
  readonly lowNoteIndex: number;
  readonly highNoteIndex: number;
  readonly tempoBpm: number;
  readonly beatsPerPhase: 4;
  readonly cycles: number;
  readonly includeAccidentals: boolean;
  readonly useDynamics: boolean;
  readonly pitchDisplay: 'off' | 'target' | 'chromatic';
  readonly referenceA4Hz: number;
}

export type NonGatingPitchFeedback =
  | { readonly kind: 'unvoiced' }
  | {
      readonly kind: 'voiced';
      readonly frequencyHz: number;
      readonly cents: number;
      readonly band: 'in-tune' | 'close' | 'far';
    };

export interface PrepareListenPlayState {
  readonly phase: PrepareListenPlayPhase;
  readonly cycleNumber: number;
  readonly beatIndex: BeatIndex;
  readonly target: NoteTarget;
  readonly score: Score;
  readonly dynamic?: string;
  readonly dynamicGain: number;
  readonly pitchFeedback?: NonGatingPitchFeedback;
  readonly chromaticPitchHz?: number;
}

export interface PrepareListenPlayResult extends ActivityResultBase {
  readonly activityId: 'prepare-listen-play';
  readonly plannedCycles: number;
  readonly completedCycles: number;
  readonly presentedTargetIds: readonly string[];
  readonly collectedMeans: { readonly [cycle: string]: readonly number[] };
  readonly cancelReason?: ActivityCancelReason;
}
