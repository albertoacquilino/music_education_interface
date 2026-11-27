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
import { close, micOutline, pause, play, refresh, volumeHighOutline } from 'ionicons/icons';
import { AttackRecord } from '../../activities/attack-clarity/attack-tracker';
import { BackgroundCondition } from '../../activities/attack-clarity/background-monitor';
import { midiToSpelledPitch } from '../../core/music/pitch-math';
import { LegacyInstrumentId } from '../../instruments/instrument-definition';
import { InstrumentRegistryService } from '../../instruments/instrument-registry.service';
import {
  AttackClarityService,
  AttackListenerState,
  MAX_RECORDING_S,
  RecorderState
} from '../../services/attack-clarity.service';
import { RefFreqService } from '../../services/ref-freq.service';
import { TabsService } from '../../services/tabs.service';
import { AttackStageComponent } from './stage/attack-stage.component';
import { StageData } from './stage/stage-model';

const ITALIAN_NAMES: Record<string, string> = {
  C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si'
};
/** Circumference of the progress ring around the record button (r = 30). */
const RING = 2 * Math.PI * 30;

@Component({
  selector: 'app-attack',
  templateUrl: './attack.page.html',
  styleUrls: ['./attack.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, AttackStageComponent]
})
export class AttackPage implements OnInit, OnDestroy {
  private readonly subscriptions = new Subscription();
  private readonly boundSettingsUpdated = () => this.loadSettings();
  private readonly boundVisibility = () => this.onVisibilityChange();
  private ticker: ReturnType<typeof setInterval> | null = null;
  private active = false;

  readonly ring = RING;
  readonly maxRecordingS = MAX_RECORDING_S;

  selectedInstrument: LegacyInstrumentId = 'trumpet';
  language = 'en';
  referenceA4Hz = 440;
  state: AttackListenerState = 'idle';
  recorder: RecorderState = 'empty';
  attacks: readonly AttackRecord[] = [];
  background: BackgroundCondition = 'normal';
  suspended = false;
  errorMessage = '';
  /** Seconds recorded, or played back, refreshed while it happens. */
  clockS = 0;

  constructor(
    private readonly listener: AttackClarityService,
    private readonly instruments: InstrumentRegistryService,
    private readonly referenceFrequency: RefFreqService,
    private readonly tabs: TabsService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    addIcons({ close, micOutline, pause, play, refresh, volumeHighOutline });
    this.loadSettings();
    this.subscriptions.add(
      this.referenceFrequency.getRefFrequency().subscribe(value => {
        this.referenceA4Hz = value;
      })
    );
    this.subscriptions.add(this.listener.state$.subscribe(state => {
      this.state = state;
      this.cdr.markForCheck();
    }));
    this.subscriptions.add(this.listener.recorder$.subscribe(recorder => {
      this.recorder = recorder;
      // Options stay available while listening; only a take in progress locks them.
      this.tabs.setDisabled(recorder === 'recording' || recorder === 'playing');
      this.updateTicker();
      this.cdr.markForCheck();
    }));
    this.subscriptions.add(this.listener.attacks$.subscribe(attacks => {
      this.attacks = attacks;
    }));
    this.subscriptions.add(this.listener.background$.subscribe(background => {
      this.background = background;
      this.cdr.markForCheck();
    }));
    this.subscriptions.add(this.listener.suspended$.subscribe(suspended => {
      this.suspended = suspended;
      this.cdr.markForCheck();
    }));
    window.addEventListener('mei-settings-updated', this.boundSettingsUpdated);
    document.addEventListener('visibilitychange', this.boundVisibility);
  }

  ngOnDestroy(): void {
    window.removeEventListener('mei-settings-updated', this.boundSettingsUpdated);
    document.removeEventListener('visibilitychange', this.boundVisibility);
    this.active = false;
    this.stopIfListening();
    this.stopTicker();
    this.subscriptions.unsubscribe();
  }

  ionViewDidEnter(): void {
    this.active = true;
    void this.start();
  }

  ionViewWillLeave(): void {
    this.active = false;
    this.stopIfListening();
    this.tabs.setDisabled(false);
  }

  async start(): Promise<void> {
    if (this.state !== 'idle') {
      return;
    }
    this.errorMessage = '';
    try {
      await this.listener.start();
    } catch (error) {
      console.error('Attack listener failed to start', error);
      this.errorMessage = error instanceof Error && error.name === 'NotAllowedError'
        ? 'Microphone access denied'
        : 'Microphone unavailable';
    }
    this.cdr.markForCheck();
  }

  /** Tap on the overlay shown while iOS keeps the audio suspended. */
  resume(): void {
    this.listener.resumeAudio();
  }

  toggleRecord(): void {
    if (this.recorder === 'recording') {
      this.listener.stopRecording();
    } else {
      this.listener.startRecording();
    }
  }

  togglePlay(): void {
    if (this.recorder === 'playing') {
      this.listener.stopPlayback();
    } else {
      this.listener.play(0);
    }
  }

  discard(): void {
    this.listener.discardRecording();
  }

  seek(seconds: number): void {
    this.listener.play(seconds);
  }

  get listening(): boolean {
    return this.state === 'listening';
  }

  get hasRecording(): boolean {
    return this.recorder === 'ready' || this.recorder === 'playing';
  }

  get recordingDurationS(): number {
    const take = this.listener.recording;
    return take ? take.length / take.sampleRate : 0;
  }

  /** Stroke offset of the ring: full when the recording reaches its limit. */
  get ringOffset(): number {
    const fraction = this.recorder === 'recording'
      ? this.clockS / MAX_RECORDING_S
      : this.recorder === 'playing'
        ? this.clockS / Math.max(0.1, this.recordingDurationS)
        : 0;
    return RING * (1 - Math.max(0, Math.min(1, fraction)));
  }

  get selectedInstrumentName(): string {
    return this.instruments.fromLegacyId(this.selectedInstrument).displayName;
  }

  readonly stageSource = (): StageData | null => {
    const take = this.listener.recording;
    if (this.recorder === 'playing' && take) {
      return {
        track: take.track,
        attacks: take.attacks,
        nowS: take.startS + this.listener.playbackPositionS,
        live: false,
        overview: { startS: take.startS, endS: take.endS },
        noteName: this.noteName
      };
    }
    const track = this.listener.liveTrack;
    if (!track) {
      return null;
    }
    return {
      track,
      attacks: this.attacks,
      nowS: this.listener.nowS,
      live: true,
      overview: null,
      noteName: this.noteName
    };
  };

  formatClock(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  }

  /** Written note name for the selected instrument, from a sounding pitch. */
  readonly noteName = (pitchHz: number | null): string => {
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
  };

  private updateTicker(): void {
    if (this.recorder === 'recording' || this.recorder === 'playing') {
      if (!this.ticker) {
        this.ticker = setInterval(() => {
          this.clockS = this.recorder === 'recording'
            ? this.recordingDurationS
            : this.listener.playbackPositionS;
          this.cdr.markForCheck();
        }, 100);
      }
    } else {
      this.stopTicker();
      this.clockS = 0;
    }
  }

  private stopTicker(): void {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  private onVisibilityChange(): void {
    if (document.hidden) {
      this.stopIfListening();
    } else if (this.active) {
      void this.start();
    }
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
