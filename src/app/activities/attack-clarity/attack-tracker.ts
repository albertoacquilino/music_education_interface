/**
 * This file is part of the Music Education Interface project.
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */

/**
 * Turns the flat event and envelope arrays returned by the streaming
 * attack-clarity analyzer (WebAssembly) into a list of attacks.
 *
 * The analyzer reports, for each note:
 * - an onset, as soon as the note is detected;
 * - the noise ducking time (t_nd), possibly several times while it settles;
 * - the end of the note, telling whether the noise was ducked at all.
 */

/** Numbers per event in the analyzer output: `[kind, onset, a, b, c]`. */
export const EVENT_FIELDS = 5;
/** Numbers per envelope frame: `[time, input, harmonic, noise, pitchHz]`. */
export const ENVELOPE_FIELDS = 5;

const EVENT_ONSET = 0;
const EVENT_NOISE_DUCKING = 1;
const EVENT_NOTE_END = 2;

/** Seconds of envelope history kept to estimate the pitch of each note. */
const PITCH_HISTORY_S = 6;
/** Window, after the end of the attack, over which the pitch is taken. */
const PITCH_WINDOW_S = 0.15;

export type AttackStatus =
  /** Note detected, attack not measured yet. */
  | 'measuring'
  /** A value is available but the analyzer may still refine it. */
  | 'updating'
  /** The note has ended; the value is final. */
  | 'final'
  /** The harmonic sound never rose clear of the noise. */
  | 'not-measured';

export interface AttackRecord {
  readonly id: number;
  /** Seconds from the start of listening. */
  readonly onsetS: number;
  /** Attack (noise ducking) time in milliseconds, null when not available. */
  readonly attackMs: number | null;
  readonly status: AttackStatus;
  /** Median sounding pitch just after the attack, null when unknown. */
  readonly pitchHz: number | null;
}

export class AttackTracker {
  private records: AttackRecord[] = [];
  private nextId = 1;
  private envTime: number[] = [];
  private envPitch: number[] = [];

  get attacks(): readonly AttackRecord[] {
    return this.records;
  }

  /** Latest record, measured or not. */
  get latest(): AttackRecord | null {
    return this.records.length ? this.records[this.records.length - 1] : null;
  }

  /** Latest record that carries a value. */
  get latestMeasured(): AttackRecord | null {
    for (let i = this.records.length - 1; i >= 0; i -= 1) {
      if (this.records[i].attackMs !== null) {
        return this.records[i];
      }
    }
    return null;
  }

  clear(): void {
    this.records = [];
    this.nextId = 1;
  }

  /** Stores envelope frames; must be called before {@link applyEvents}. */
  addEnvelopes(frames: ArrayLike<number>): void {
    for (let i = 0; i + ENVELOPE_FIELDS <= frames.length; i += ENVELOPE_FIELDS) {
      this.envTime.push(frames[i]);
      this.envPitch.push(frames[i + 4]);
    }
    const last = this.envTime[this.envTime.length - 1];
    if (last === undefined) {
      return;
    }
    let drop = 0;
    while (drop < this.envTime.length && this.envTime[drop] < last - PITCH_HISTORY_S) {
      drop += 1;
    }
    if (drop > 0) {
      this.envTime.splice(0, drop);
      this.envPitch.splice(0, drop);
    }
  }

  /** Applies analyzer events. Returns true when the list changed. */
  applyEvents(events: ArrayLike<number>): boolean {
    let changed = false;
    for (let i = 0; i + EVENT_FIELDS <= events.length; i += EVENT_FIELDS) {
      const kind = events[i];
      const onset = events[i + 1];
      if (kind === EVENT_ONSET) {
        this.records.push({
          id: this.nextId++,
          onsetS: onset,
          attackMs: null,
          status: 'measuring',
          pitchHz: null
        });
        changed = true;
      } else if (kind === EVENT_NOISE_DUCKING) {
        const tNd = events[i + 2];
        changed = this.update(onset, record => ({
          ...record,
          attackMs: Number.isFinite(tNd) ? tNd * 1000 : null,
          status: Number.isFinite(tNd) ? 'updating' : 'measuring',
          pitchHz: this.pitchAround(onset, tNd) ?? record.pitchHz
        })) || changed;
      } else if (kind === EVENT_NOTE_END) {
        const ducked = events[i + 3] !== 0;
        changed = this.update(onset, record => {
          if (!ducked || record.attackMs === null) {
            return {
              ...record,
              attackMs: null,
              status: 'not-measured',
              pitchHz: record.pitchHz ?? this.pitchAround(onset, 0)
            };
          }
          return {
            ...record,
            status: 'final',
            pitchHz: this.pitchAround(onset, record.attackMs / 1000) ?? record.pitchHz
          };
        }) || changed;
      }
    }
    return changed;
  }

  private update(onset: number, change: (record: AttackRecord) => AttackRecord): boolean {
    for (let i = this.records.length - 1; i >= 0; i -= 1) {
      if (Math.abs(this.records[i].onsetS - onset) < 1e-6) {
        this.records = [
          ...this.records.slice(0, i),
          change(this.records[i]),
          ...this.records.slice(i + 1)
        ];
        return true;
      }
    }
    return false;
  }

  /** Median pitch over the short window following the end of the attack. */
  private pitchAround(onset: number, tNd: number): number | null {
    const start = onset + (Number.isFinite(tNd) ? tNd : 0);
    const values: number[] = [];
    for (let i = 0; i < this.envTime.length; i += 1) {
      const t = this.envTime[i];
      if (t >= start && t <= start + PITCH_WINDOW_S && this.envPitch[i] > 0) {
        values.push(this.envPitch[i]);
      }
    }
    if (!values.length) {
      return null;
    }
    values.sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  }
}
