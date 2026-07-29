import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  TargetIntonationController
} from '../../activities/target-intonation/target-intonation.controller';
import {
  IntonationFeedback,
  TARGET_INTONATION_DEFAULTS,
  TargetIntonationCommand,
  TargetIntonationConfig,
  TargetIntonationResult,
  TargetIntonationState
} from '../../activities/target-intonation/target-intonation.types';
import { RxjsClockAdapter } from '../../adapters/clock/rxjs-clock.adapter';
import { ScoreNotationAdapter } from '../../adapters/notation/score-notation.adapter';
import {
  FirebaseActivityAdapter
} from '../../adapters/persistence/firebase-activity.adapter';
import {
  ChromaticTunerComponent
} from '../../components/chromatic-tuner/chromatic-tuner.component';
import { ScoreViewComponent } from '../../components/score/score.component';
import { INITIAL_NOTE } from '../../constants';
import { ActivityContext } from '../../core/activity/activity-context';
import { ActivitySnapshot } from '../../core/activity/activity.types';
import {
  ActivitySessionService
} from '../../core/activity/activity-session.service';
import {
  InstrumentDefinition,
  LegacyInstrumentId
} from '../../instruments/instrument-definition';
import {
  InstrumentRegistryService
} from '../../instruments/instrument-registry.service';
import { Score } from '../../models/score.types';
import { PitchService } from '../../services/pitch.service';
import { RefFreqService } from '../../services/ref-freq.service';
import { SoundsService } from '../../services/sounds.service';
import { TabsService } from '../../services/tabs.service';

@Component({
  selector: 'app-target-intonation',
  templateUrl: './target-intonation.page.html',
  styleUrls: ['./target-intonation.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ScoreViewComponent,
    ChromaticTunerComponent
  ]
})
export class TargetIntonationPage implements OnInit, OnDestroy {
  private readonly controller = new TargetIntonationController();
  private readonly subscriptions = new Subscription();
  private readonly boundSettingsUpdated = () => this.loadSettings();
  private navigationCancellationRequested = false;

  selectedInstrument: LegacyInstrumentId = 'trumpet';
  language = 'en';
  includeAccidentals = false;
  playReferenceTone = true;
  referenceA4Hz = 440;
  lowNoteIndex = INITIAL_NOTE;
  highNoteIndex = INITIAL_NOTE;
  activityRunning = false;
  activityStarting = false;
  state: TargetIntonationState | null = null;
  score: Score | null = null;
  feedback: IntonationFeedback | null = null;
  detectedPitchHz = 0;
  terminalResult: TargetIntonationResult | null = null;
  terminalMessage = '';

  constructor(
    private readonly sounds: SoundsService,
    private readonly pitch: PitchService,
    private readonly referenceFrequency: RefFreqService,
    private readonly tabs: TabsService,
    private readonly activitySession: ActivitySessionService,
    private readonly clock: RxjsClockAdapter,
    private readonly instruments: InstrumentRegistryService,
    private readonly notation: ScoreNotationAdapter,
    private readonly persistence: FirebaseActivityAdapter,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadSettings();
    this.subscriptions.add(
      this.referenceFrequency.getRefFrequency().subscribe(value => {
        this.referenceA4Hz = value;
      })
    );
    this.subscriptions.add(
      this.controller.snapshot$.subscribe(snapshot => {
        this.mapSnapshot(snapshot);
      })
    );
    window.addEventListener(
      'mei-settings-updated',
      this.boundSettingsUpdated
    );
  }

  ngOnDestroy(): void {
    window.removeEventListener(
      'mei-settings-updated',
      this.boundSettingsUpdated
    );
    this.subscriptions.unsubscribe();
    this.cancelForNavigation();
  }

  ionViewWillLeave(): void {
    this.cancelForNavigation();
  }

  async start(): Promise<void> {
    if (this.activityRunning || this.activityStarting) {
      return;
    }

    this.navigationCancellationRequested = false;
    this.terminalResult = null;
    this.terminalMessage = '';
    localStorage.setItem(
      'targetIntonationPlayReference',
      JSON.stringify(this.playReferenceTone)
    );
    const instrument = this.instruments.fromLegacyId(this.selectedInstrument);
    const range = this.normaliseRange(instrument);
    const config: TargetIntonationConfig = {
      instrumentId: instrument.id,
      lowNoteId: instrument.notes[range.low].id,
      highNoteId: instrument.notes[range.high].id,
      lowNoteIndex: range.low,
      highNoteIndex: range.high,
      includeAccidentals: this.includeAccidentals,
      referenceA4Hz: this.referenceA4Hz,
      targetCount: TARGET_INTONATION_DEFAULTS.targetCount,
      playReferenceTone: this.playReferenceTone,
      targetPresentationMs:
        TARGET_INTONATION_DEFAULTS.targetPresentationMs,
      referenceToneDurationMs:
        TARGET_INTONATION_DEFAULTS.referenceToneDurationMs,
      toleranceCents: TARGET_INTONATION_DEFAULTS.toleranceCents,
      farThresholdCents: TARGET_INTONATION_DEFAULTS.farThresholdCents,
      requiredStableMs: TARGET_INTONATION_DEFAULTS.requiredStableMs,
      maximumSpreadCents: TARGET_INTONATION_DEFAULTS.maximumSpreadCents,
      minimumValidEstimates:
        TARGET_INTONATION_DEFAULTS.minimumValidEstimates,
      maximumSignalGapMs: TARGET_INTONATION_DEFAULTS.maximumSignalGapMs,
      attemptTimeoutMs: TARGET_INTONATION_DEFAULTS.attemptTimeoutMs,
      maximumAttemptsPerTarget:
        TARGET_INTONATION_DEFAULTS.maximumAttemptsPerTarget,
      detectorMinimumHz: TARGET_INTONATION_DEFAULTS.detectorMinimumHz,
      detectorMaximumHz: TARGET_INTONATION_DEFAULTS.detectorMaximumHz
    };

    await this.activitySession.start(
      this.controller,
      config,
      this.createActivityContext()
    );
    this.tabs.setDisabled(this.activitySession.isActive);
    this.cdr.markForCheck();
  }

  async dispatch(command: TargetIntonationCommand): Promise<void> {
    await this.controller.dispatch(command);
    this.cdr.markForCheck();
  }

  async stop(): Promise<void> {
    await this.dispatch({ type: 'stop' });
  }

  feedbackLabel(): string {
    switch (this.feedback?.band) {
      case 'invalid-estimate':
        return 'Invalid pitch estimate';
      case 'out-of-detector-range':
        return 'Outside detector range';
      case 'wrong-note':
        return 'Wrong note — match the written target';
      case 'far-flat':
        return 'Far flat';
      case 'flat':
        return 'Flat';
      case 'within-tolerance':
        return 'Within tolerance — hold steady';
      case 'sharp':
        return 'Sharp';
      case 'far-sharp':
        return 'Far sharp';
      case 'unstable':
        return 'Pitch unstable — steady the sound';
      case 'no-signal':
      default:
        return 'No signal';
    }
  }

  detectedPitchLabel(): string {
    return this.detectedPitchHz > 0
      ? `${this.detectedPitchHz.toFixed(1)} Hz`
      : 'No signal';
  }

  centsLabel(): string {
    const cents = this.feedback?.centsFromTarget;
    if (cents === undefined) {
      return '—';
    }
    return `${cents >= 0 ? '+' : ''}${cents.toFixed(1)} cents`;
  }

  targetLabel(): string {
    return this.state
      ? this.state.target.displayToken
        .replace('s', '♯')
        .replace('f', '♭')
      : '—';
  }

  attemptMessage(): string {
    if (this.state?.kind !== 'attempt-result') {
      return '';
    }
    return this.state.result.outcome === 'stable-hold'
      ? 'Target held successfully'
      : this.state.result.outcome === 'timeout'
        ? 'Attempt timed out'
        : 'Target skipped';
  }

  get stabilityProgress(): number {
    return this.feedback?.stableProgress ?? 0;
  }

  get selectedInstrumentName(): string {
    return this.instruments.fromLegacyId(this.selectedInstrument).displayName;
  }

  private createActivityContext(): ActivityContext {
    return {
      clock: this.clock,
      audio: this.sounds,
      pitch: this.pitch,
      notation: this.notation,
      instruments: this.instruments,
      persistence: this.persistence,
      random: Math.random
    };
  }

  private mapSnapshot(
    snapshot: ActivitySnapshot<TargetIntonationState, TargetIntonationResult>
  ): void {
    this.activityStarting = snapshot.lifecycle === 'starting';
    this.activityRunning = snapshot.lifecycle === 'running';

    if (snapshot.lifecycle === 'running') {
      this.state = snapshot.state;
      this.score = snapshot.state.score;
      if (
        snapshot.state.kind === 'awaiting-signal'
        || snapshot.state.kind === 'tracking'
      ) {
        this.feedback = snapshot.state.feedback;
        this.detectedPitchHz =
          snapshot.state.feedback.detectedFrequencyHz ?? 0;
      } else if (snapshot.state.kind === 'presenting-target') {
        this.feedback = null;
        this.detectedPitchHz = 0;
      }
    } else if (
      snapshot.lifecycle === 'completed'
      || snapshot.lifecycle === 'cancelled'
      || snapshot.lifecycle === 'failed'
    ) {
      this.terminalResult = snapshot.result;
      this.terminalMessage = snapshot.lifecycle === 'completed'
        ? `Completed ${snapshot.result.completedTargets} targets`
        : snapshot.lifecycle === 'cancelled'
          ? 'Activity stopped'
          : `Activity failed: ${snapshot.result.failure?.message ?? 'unknown error'}`;
      this.tabs.setDisabled(false);
    }
    this.cdr.markForCheck();
  }

  private loadSettings(): void {
    const savedInstrument = localStorage.getItem('selectedInstrument');
    if (
      savedInstrument === 'trumpet'
      || savedInstrument === 'clarinet'
      || savedInstrument === 'oboe'
    ) {
      this.selectedInstrument = savedInstrument;
    }
    this.includeAccidentals = this.storedBoolean(
      'useFlatsAndSharps',
      false
    );
    this.playReferenceTone = this.storedBoolean(
      'targetIntonationPlayReference',
      true
    );
    this.language = localStorage.getItem('language') ?? 'en';

    const instrument = this.instruments.fromLegacyId(this.selectedInstrument);
    this.lowNoteIndex = this.storedNumber(
      `${this.selectedInstrument}_lowNote`,
      INITIAL_NOTE
    );
    this.highNoteIndex = this.storedNumber(
      `${this.selectedInstrument}_highNote`,
      INITIAL_NOTE
    );
    const range = this.normaliseRange(instrument);
    this.lowNoteIndex = range.low;
    this.highNoteIndex = range.high;
    this.cdr.markForCheck();
  }

  private normaliseRange(
    instrument: InstrumentDefinition
  ): { low: number; high: number } {
    let low = Math.max(
      0,
      Math.min(instrument.notes.length - 1, this.lowNoteIndex)
    );
    let high = Math.max(
      low,
      Math.min(instrument.notes.length - 1, this.highNoteIndex)
    );

    if (!this.includeAccidentals) {
      while (
        low <= high
        && instrument.notes[low].displayTokens.length > 1
      ) {
        low += 1;
      }
      while (
        high >= low
        && instrument.notes[high].displayTokens.length > 1
      ) {
        high -= 1;
      }
      if (low > high) {
        const naturalIndex = instrument.notes.findIndex(
          note => note.displayTokens.length === 1
        );
        low = naturalIndex;
        high = naturalIndex;
      }
    }
    return { low, high };
  }

  private storedBoolean(key: string, fallback: boolean): boolean {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  }

  private storedNumber(key: string, fallback: number): number {
    const storedValue = localStorage.getItem(key);
    if (storedValue === null) {
      return fallback;
    }
    const value = Number(storedValue);
    return Number.isFinite(value) ? value : fallback;
  }

  private cancelForNavigation(): void {
    if (this.navigationCancellationRequested) {
      return;
    }
    this.navigationCancellationRequested = true;
    if (this.activitySession.isActive) {
      void this.activitySession.cancel('navigation');
    }
  }
}
