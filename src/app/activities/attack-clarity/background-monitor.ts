/**
 * This file is part of the Music Education Interface project.
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */

/**
 * Tells when sound is being played but cannot be detected as notes because
 * of the background noise.
 *
 * The note tracker of attack-clarity-rs (streaming/notes.rs) measures the
 * background level between notes and starts a note only when the input
 * envelope (the maximum of each period) exceeds `2 * quiet`, with
 * `quiet = max(abs_min, 4 * background)`: about 18 dB above the background.
 * With a loud background (a car, a laptop microphone) the sound played may
 * never get that far above it, and no note starts any more.
 *
 * The condition feeds itself: while no note is open the tracker keeps
 * measuring the background, so the sound being played raises the estimate
 * and the threshold with it.
 *
 * This class replays the tracker's note segmentation on the envelope frames
 * (same formulas and parameters, without its 40 ms smoothing delay) and
 * counts the frames that look like sound being played while no note is open:
 * a pitch is detected, the level is clearly above the actual noise (the
 * lowest 100 ms average of the last 3 s, which unlike the tracker's estimate
 * does not follow the playing) and close to the recent playing level (so
 * that the fading end of a note does not count). When enough of them
 * accumulate in a short window, the condition is `too-loud`.
 */

const ENVELOPE_FIELDS = 5;

/** Values of NoteParams::default() in attack-clarity-rs, frames at 1 kHz. */
const ABS_MIN = 1e-3;
const BACKGROUND_FRAMES = 300;
const PEAK_DECAY_FRAMES = 500;
const REF_WINDOW_FRAMES = 250;
const REL_ON = 0.2;
const REL_OFF = 0.1;
const OFF_FRAMES = 5;
const YOUNG_OFF_FRAMES = 40;
const SLUR_FRAMES = 300;

/** A frame counts as sound when at least this far above the actual noise... */
const SOUND_OVER_NOISE = 2;
/** ...and at least this fraction of the recent playing peak. */
const SOUND_OF_PEAK = 0.3;
/** Length, in frames, of the blocks used for the noise and peak levels. */
const BLOCK_FRAMES = 100;
/** Blocks over which they are taken (3 s). */
const LEVEL_BLOCKS = 30;
/** Window, in frames, over which undetected sound is counted. */
const MISSED_WINDOW_FRAMES = 3000;
/** Undetected sound, in frames, that raises the condition. */
const MISSED_ENTER_FRAMES = 300;

export type BackgroundCondition = 'normal' | 'too-loud';

export class BackgroundMonitor {
  private floor = NaN;
  private peakHold = 0;
  private recent: { index: number; level: number }[] = [];
  private count = 0;
  private inNote = false;
  private noteFrames = 0;
  private below = 0;
  private missed = new Uint8Array(MISSED_WINDOW_FRAMES);
  private missedCount = 0;
  private current: BackgroundCondition = 'normal';
  private blockSum = 0;
  private blockMax = 0;
  private blockFill = 0;
  private blockMeans: number[] = [];
  private blockMaxima: number[] = [];
  private noise = Infinity;
  private playPeak = 0;

  get condition(): BackgroundCondition {
    return this.current;
  }

  /** Estimated background level (linear, full scale = 1). */
  get background(): number {
    return Number.isFinite(this.floor) ? this.floor : 0;
  }

  get quiet(): number {
    return Math.max(ABS_MIN, 4 * this.background);
  }

  /** Level the input envelope must exceed to start a note (linear). */
  get onsetThreshold(): number {
    return Math.max(2 * this.quiet, REL_ON * this.peakHold);
  }

  get noteOpen(): boolean {
    return this.inNote;
  }

  /** Frames of undetected sound in the last three seconds. */
  get missedFrames(): number {
    return this.missedCount;
  }

  reset(): void {
    this.floor = NaN;
    this.peakHold = 0;
    this.recent = [];
    this.count = 0;
    this.inNote = false;
    this.noteFrames = 0;
    this.below = 0;
    this.missed.fill(0);
    this.missedCount = 0;
    this.current = 'normal';
    this.blockSum = 0;
    this.blockMax = 0;
    this.blockFill = 0;
    this.blockMeans = [];
    this.blockMaxima = [];
    this.noise = Infinity;
    this.playPeak = 0;
  }

  /** Lowest 100 ms average level of the last 3 s (linear). */
  get actualNoise(): number {
    return Number.isFinite(this.noise) ? this.noise : 0;
  }

  /** Returns true when the condition changed. */
  addEnvelopes(frames: ArrayLike<number>): boolean {
    for (let i = 0; i + ENVELOPE_FIELDS <= frames.length; i += ENVELOPE_FIELDS) {
      this.step(Math.max(0, frames[i + 1]), frames[i + 4] > 0);
    }
    const next: BackgroundCondition = this.missedCount >= MISSED_ENTER_FRAMES
      ? 'too-loud'
      : this.missedCount === 0 ? 'normal' : this.current;
    const changed = next !== this.current;
    this.current = next;
    return changed;
  }

  private step(level: number, pitched: boolean): void {
    this.count += 1;
    if (!Number.isFinite(this.floor)) {
      this.floor = level;
    } else if (!this.inNote) {
      this.floor += (level - this.floor) / BACKGROUND_FRAMES;
    }
    const quiet = this.quiet;

    while (this.recent.length && this.recent[this.recent.length - 1].level <= level) {
      this.recent.pop();
    }
    this.recent.push({ index: this.count, level });
    while (this.recent[0].index + REF_WINDOW_FRAMES <= this.count) {
      this.recent.shift();
    }
    const recentMax = this.recent[0].level;
    this.peakHold = Math.max(this.peakHold * Math.exp(-1 / PEAK_DECAY_FRAMES), level);

    this.blockSum += level;
    this.blockMax = Math.max(this.blockMax, level);
    this.blockFill += 1;
    if (this.blockFill === BLOCK_FRAMES) {
      this.blockMeans.push(this.blockSum / BLOCK_FRAMES);
      this.blockMaxima.push(this.blockMax);
      if (this.blockMeans.length > LEVEL_BLOCKS) {
        this.blockMeans.shift();
        this.blockMaxima.shift();
      }
      this.noise = Math.min(...this.blockMeans);
      this.playPeak = Math.max(...this.blockMaxima);
      this.blockSum = 0;
      this.blockMax = 0;
      this.blockFill = 0;
    }

    let missed = false;
    if (this.inNote) {
      this.noteFrames += 1;
      this.below = level < Math.max(quiet, REL_OFF * recentMax) ? this.below + 1 : 0;
      if (this.below >= (this.noteFrames < SLUR_FRAMES ? YOUNG_OFF_FRAMES : OFF_FRAMES)) {
        this.inNote = false;
      }
    } else if (level > Math.max(2 * quiet, REL_ON * this.peakHold)) {
      this.inNote = true;
      this.noteFrames = 0;
      this.below = 0;
    } else {
      missed = pitched
        && level > SOUND_OVER_NOISE * this.noise
        && level > SOUND_OF_PEAK * Math.max(this.playPeak, this.blockMax);
    }

    const slot = this.count % MISSED_WINDOW_FRAMES;
    this.missedCount += (missed ? 1 : 0) - this.missed[slot];
    this.missed[slot] = missed ? 1 : 0;
  }
}
