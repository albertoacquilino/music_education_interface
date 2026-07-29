import { Observable } from 'rxjs';
import { Score } from '../../models/score.types';
import { InstrumentDefinition, NoteTarget } from '../../instruments/instrument-definition';
import { InstrumentRegistryPort } from '../../instruments/instrument-registry.service';
import { ActivityResultBase } from './activity.types';

export interface CancelHandle {
  cancel(): void;
}

export interface ClockTick {
  readonly sequence: number;
  readonly scheduledAtMs: number;
  readonly observedAtMs: number;
}

export interface ClockPort {
  nowMs(): number;
  after(
    delayMs: number,
    onElapsed: (observedAtMs: number) => void,
    signal: AbortSignal
  ): CancelHandle;
  every(
    periodMs: number,
    onTick: (tick: ClockTick) => void,
    signal: AbortSignal
  ): CancelHandle;
}

export interface AudioPlayback {
  stop(fadeMs?: number): void;
}

export interface ReferencePlaybackOptions {
  readonly durationMs: number;
  readonly gain: number;
  readonly desiredReferenceA4Hz: number;
}

export interface AudioPort {
  unlockFromUserGesture(): Promise<void>;
  preloadInstrument(instrument: InstrumentDefinition): Promise<void>;
  playMetronome(accent: 'strong' | 'weak'): AudioPlayback;
  playReference(
    target: NoteTarget,
    options: ReferencePlaybackOptions
  ): AudioPlayback;
  stopAll(): void;
}

export type PitchEstimate =
  | {
      readonly kind: 'voiced';
      readonly frequencyHz: number;
      readonly capturedAtMs: number;
      readonly emittedAtMs: number;
    }
  | {
      readonly kind: 'unvoiced';
      readonly reason: 'silence' | 'invalid' | 'out-of-range';
      readonly capturedAtMs: number;
      readonly emittedAtMs: number;
    };

export interface PitchInputSession {
  release(): Promise<void>;
}

export interface PitchInputPort {
  readonly estimates$: Observable<PitchEstimate>;
  acquire(signal: AbortSignal): Promise<PitchInputSession>;
}

export interface NotationPort {
  forPrepareListenPlay(target: NoteTarget, dynamic?: string): Score;
  forTarget(target: NoteTarget): Score;
}

export interface ActivitySessionEnvelope {
  readonly schemaVersion: 2;
  readonly sessionId: string;
  readonly activityId: ActivityResultBase['activityId'];
  readonly activityVersion: string;
  readonly instrumentId: InstrumentDefinition['id'];
  readonly config: unknown;
  readonly startedAtMs: number;
}

export interface ActivityPersistencePort {
  open(envelope: ActivitySessionEnvelope): Promise<void>;
  close(result: ActivityResultBase): Promise<void>;
}

export interface ActivityContext {
  readonly clock: ClockPort;
  readonly audio: AudioPort;
  readonly pitch: PitchInputPort;
  readonly notation: NotationPort;
  readonly instruments: InstrumentRegistryPort;
  readonly persistence: ActivityPersistencePort;
  readonly random: () => number;
}
