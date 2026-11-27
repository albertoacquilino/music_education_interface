/**
 * This file is part of the Music Education Interface project.
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import { informationCircleOutline } from 'ionicons/icons';
import { AttackRecord } from '../../activities/attack-clarity/attack-tracker';
import { BackgroundCondition } from '../../activities/attack-clarity/background-monitor';
import { midiToSpelledPitch } from '../../core/music/pitch-math';
import { LegacyInstrumentId } from '../../instruments/instrument-definition';
import { InstrumentRegistryService } from '../../instruments/instrument-registry.service';
import {
  AttackClarityService,
  AttackListenerState
} from '../../services/attack-clarity.service';
import { RefFreqService } from '../../services/ref-freq.service';
import { TabsService } from '../../services/tabs.service';

const ITALIAN_NAMES: Record<string, string> = {
  C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si'
};
/** Number of attacks drawn in the "recent attacks" strip. */
const RECENT_COUNT = 16;
/** Lowest full scale, in ms, of the bars. */
const MIN_SCALE_MS = 100;

@Component({
  selector: 'app-attack',
  templateUrl: './attack.page.html',
  styleUrls: ['./attack.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class AttackPage implements OnInit, OnDestroy {
  private readonly subscriptions = new Subscription();
  private readonly boundSettingsUpdated = () => this.loadSettings();

  selectedInstrument: LegacyInstrumentId = 'trumpet';
  language = 'en';
  referenceA4Hz = 440;
  state: AttackListenerState = 'idle';
  attacks: readonly AttackRecord[] = [];
  level = 0;
  background: BackgroundCondition = 'normal';
  errorMessage = '';

  constructor(
    private readonly listener: AttackClarityService,
    private readonly instruments: InstrumentRegistryService,
    private readonly referenceFrequency: RefFreqService,
    private readonly tabs: TabsService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    addIcons({ informationCircleOutline });
    this.loadSettings();
    this.subscriptions.add(
      this.referenceFrequency.getRefFrequency().subscribe(value => {
        this.referenceA4Hz = value;
      })
    );
    this.subscriptions.add(this.listener.state$.subscribe(state => {
      this.state = state;
      this.tabs.setDisabled(state !== 'idle');
      this.cdr.markForCheck();
    }));
    this.subscriptions.add(this.listener.attacks$.subscribe(attacks => {
      this.attacks = attacks;
      this.cdr.markForCheck();
    }));
    this.subscriptions.add(this.listener.background$.subscribe(background => {
      this.background = background;
      this.cdr.markForCheck();
    }));
    this.subscriptions.add(this.listener.level$.subscribe(level => {
      this.level = level;
      this.cdr.markForCheck();
    }));
    window.addEventListener('mei-settings-updated', this.boundSettingsUpdated);
  }

  ngOnDestroy(): void {
    window.removeEventListener('mei-settings-updated', this.boundSettingsUpdated);
    this.stopIfListening();
    this.subscriptions.unsubscribe();
  }

  ionViewWillLeave(): void {
    this.stopIfListening();
  }

  async start(): Promise<void> {
    this.errorMessage = '';
    try {
      await this.listener.start();
    } catch (error) {
      console.error('Attack listener failed to start', error);
      this.errorMessage = error instanceof Error && error.name === 'NotAllowedError'
        ? 'Microphone access was denied.'
        : 'The microphone could not be opened.';
    }
    this.cdr.markForCheck();
  }

  stop(): void {
    this.listener.stop();
  }

  clear(): void {
    this.listener.clear();
  }

  get listening(): boolean {
    return this.state === 'listening';
  }

  get selectedInstrumentName(): string {
    return this.instruments.fromLegacyId(this.selectedInstrument).displayName;
  }

  /** Newest first. */
  get attacksNewestFirst(): readonly AttackRecord[] {
    return [...this.attacks].reverse();
  }

  get measuredCount(): number {
    return this.attacks.filter(a => a.attackMs !== null).length;
  }

  get latest(): AttackRecord | null {
    return this.attacks.length ? this.attacks[this.attacks.length - 1] : null;
  }

  /** Last attack with a value, shown in the big readout. */
  get shown(): AttackRecord | null {
    for (let i = this.attacks.length - 1; i >= 0; i -= 1) {
      if (this.attacks[i].attackMs !== null) {
        return this.attacks[i];
      }
    }
    return null;
  }

  get recent(): readonly AttackRecord[] {
    return this.attacks.filter(a => a.attackMs !== null).slice(-RECENT_COUNT);
  }

  get scaleMs(): number {
    const max = Math.max(MIN_SCALE_MS, ...this.recent.map(a => a.attackMs ?? 0));
    return Math.ceil(max / 50) * 50;
  }

  barPercent(record: AttackRecord): number {
    return record.attackMs === null
      ? 0
      : Math.max(2, Math.min(100, (record.attackMs / this.scaleMs) * 100));
  }

  statusLabel(): string {
    if (this.state === 'starting') {
      return 'Opening microphone…';
    }
    const latest = this.latest;
    if (!latest || latest.status === 'final' || latest.status === 'not-measured') {
      return 'Listening — play a note';
    }
    return latest.status === 'measuring' ? 'Note detected — measuring…' : 'Refining the value…';
  }

  backgroundLabel(): string {
    return this.background === 'too-loud'
      ? 'Some of the sound is not far enough above the background noise to be '
        + 'detected as notes. A quieter place, or a microphone closer to the '
        + 'sound, helps.'
      : '';
  }

  recordStatusLabel(record: AttackRecord): string {
    switch (record.status) {
      case 'measuring':
        return 'measuring…';
      case 'updating':
        return 'refining';
      case 'not-measured':
        return 'not measurable';
      default:
        return '';
    }
  }

  formatMs(record: AttackRecord | null): string {
    return record?.attackMs == null ? '—' : Math.round(record.attackMs).toString();
  }

  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds - minutes * 60;
    return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`;
  }

  /** Written note name for the selected instrument, from a sounding pitch. */
  noteName(pitchHz: number | null): string {
    if (!pitchHz || !Number.isFinite(pitchHz)) {
      return '—';
    }
    const instrument = this.instruments.fromLegacyId(this.selectedInstrument);
    const soundingMidi = Math.round(69 + 12 * Math.log2(pitchHz / this.referenceA4Hz));
    const pitch = midiToSpelledPitch(
      soundingMidi - instrument.transposition.writtenToSoundingSemitones
    );
    const sharp = pitch.accidental === 'sharp' ? '♯' : '';
    return this.language === 'it'
      ? `${ITALIAN_NAMES[pitch.letter]}${sharp}${pitch.octave}`
      : `${pitch.letter}${sharp}${pitch.octave}`;
  }

  trackById(_: number, record: AttackRecord): number {
    return record.id;
  }

  private loadSettings(): void {
    const saved = localStorage.getItem('selectedInstrument');
    if (saved === 'trumpet' || saved === 'clarinet' || saved === 'oboe' || saved === 'flute') {
      this.selectedInstrument = saved;
    }
    this.language = localStorage.getItem('language') ?? 'en';
    this.cdr.markForCheck();
  }

  private stopIfListening(): void {
    if (this.state !== 'idle') {
      this.listener.stop();
    }
  }
}
