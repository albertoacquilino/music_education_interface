/**
 * This file is part of the Music Education Interface project.
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */

/**
 * Down-sampled history of the input, used to draw the scrolling waveform of
 * the Attack tab.
 *
 * The time axis is divided into columns of 5 ms. For each column it keeps
 * the peak of the raw samples and, from the envelope frames of the
 * analyzer (`[time, input, harmonic, noise, pitchHz]` at 1 kHz), the
 * largest harmonic and noise levels and the pitch. Columns are addressed by
 * their absolute index, `floor(t * COLUMNS_PER_S)`, with `t` in seconds from
 * the start of the stream, the same clock as the analyzer events.
 *
 * A `ring` track keeps the last `capacityS` seconds; a `linear` one stops
 * accepting samples once full (used for a recording).
 */

export const COLUMNS_PER_S = 200;

const ENVELOPE_FIELDS = 5;

export class WaveformTrack {
  readonly capacity: number;
  readonly peak: Float32Array;
  readonly harmonic: Float32Array;
  readonly noise: Float32Array;
  readonly pitch: Float32Array;

  /** First column kept (absolute index), -1 before any sample. */
  private firstCol = -1;
  /** One past the last column written. */
  private endCol = 0;
  private writeCol = -1;
  private writeSlot = 0;
  /** First sample index of the next column. */
  private nextBoundary = 0;
  private endSample = 0;
  private isFull = false;

  constructor(
    readonly sampleRate: number,
    capacityS: number,
    readonly mode: 'ring' | 'linear' = 'ring'
  ) {
    this.capacity = Math.round(capacityS * COLUMNS_PER_S);
    this.peak = new Float32Array(this.capacity);
    this.harmonic = new Float32Array(this.capacity);
    this.noise = new Float32Array(this.capacity);
    this.pitch = new Float32Array(this.capacity);
  }

  /** Time, in seconds, of the oldest column kept. */
  get startS(): number {
    return this.firstCol < 0 ? 0 : this.firstCol / COLUMNS_PER_S;
  }

  /** Time, in seconds, just after the last sample written. */
  get endS(): number {
    return this.endSample / this.sampleRate;
  }

  get full(): boolean {
    return this.isFull;
  }

  get firstColumn(): number {
    return this.firstCol;
  }

  get endColumn(): number {
    return this.endCol;
  }

  /** Storage slot of an absolute column, or -1 when it is not kept. */
  slot(col: number): number {
    if (this.firstCol < 0 || col < this.firstCol || col >= this.endCol) {
      return -1;
    }
    return col % this.capacity;
  }

  /**
   * Adds raw samples; `first` is the stream index of `samples[0]`. Returns
   * false when a linear track is full and some samples were dropped.
   */
  addSamples(samples: ArrayLike<number>, first: number): boolean {
    for (let i = 0; i < samples.length; i += 1) {
      const index = first + i;
      if (this.writeCol < 0 || index >= this.nextBoundary) {
        if (!this.openColumn(Math.floor((index * COLUMNS_PER_S) / this.sampleRate))) {
          return false;
        }
      }
      const v = samples[i];
      const a = v < 0 ? -v : v;
      if (a > this.peak[this.writeSlot]) {
        this.peak[this.writeSlot] = a;
      }
      this.endSample = index + 1;
    }
    return true;
  }

  /** Adds envelope frames; frames outside the columns written are ignored. */
  addEnvelopes(frames: ArrayLike<number>): void {
    for (let i = 0; i + ENVELOPE_FIELDS <= frames.length; i += ENVELOPE_FIELDS) {
      const s = this.slot(Math.floor(frames[i] * COLUMNS_PER_S));
      if (s < 0) {
        continue;
      }
      const harmonic = frames[i + 2];
      const noise = frames[i + 3];
      const pitch = frames[i + 4];
      if (harmonic > this.harmonic[s]) {
        this.harmonic[s] = harmonic;
      }
      if (noise > this.noise[s]) {
        this.noise[s] = noise;
      }
      if (pitch > 0) {
        this.pitch[s] = pitch;
      }
    }
  }

  private openColumn(col: number): boolean {
    if (this.mode === 'linear' && this.firstCol >= 0 && col - this.firstCol >= this.capacity) {
      this.isFull = true;
      return false;
    }
    if (this.firstCol < 0) {
      this.firstCol = col;
    }
    // Columns skipped (gaps in the input) are cleared too.
    for (let c = Math.max(this.endCol, col - this.capacity + 1, this.firstCol); c <= col; c += 1) {
      const s = c % this.capacity;
      this.peak[s] = 0;
      this.harmonic[s] = 0;
      this.noise[s] = 0;
      this.pitch[s] = 0;
    }
    this.writeCol = col;
    this.writeSlot = col % this.capacity;
    this.endCol = Math.max(this.endCol, col + 1);
    this.firstCol = Math.max(this.firstCol, this.endCol - this.capacity);
    this.nextBoundary = Math.ceil(((col + 1) * this.sampleRate) / COLUMNS_PER_S);
    return true;
  }
}
