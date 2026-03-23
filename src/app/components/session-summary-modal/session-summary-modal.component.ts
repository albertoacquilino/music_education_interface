import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

export type SessionSummaryData = {
  score: number;
  accuracy: number;
};

@Component({
  selector: 'session-summary-modal',
  templateUrl: './session-summary-modal.component.html',
  styleUrls: ['./session-summary-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionSummaryModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() currentSession: SessionSummaryData = { score: 0, accuracy: 0 };
  @Input() previousSession: SessionSummaryData | null = null;

  @Output() closed = new EventEmitter<void>();

  hasPreviousSession = false;
  scoreDiff = 0;
  accuracyDiff = 0;
  feedbackText = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['currentSession'] || changes['previousSession'] || changes['isOpen']) {
      this.computeComparison();
    }
  }

  requestClose(): void {
    this.closed.emit();
  }

  formatScore(value: number): string {
    return `${this.toSafeNumber(value).toFixed(0)}`;
  }

  formatAccuracy(value: number): string {
    return `${this.toSafeNumber(value).toFixed(1)}%`;
  }

  formatSigned(value: number, decimals = 0): string {
    const safeValue = this.toSafeNumber(value);
    if (safeValue === 0) {
      return `0${decimals > 0 ? '.0' : ''}`;
    }

    const prefix = safeValue > 0 ? '+' : '';
    return `${prefix}${safeValue.toFixed(decimals)}`;
  }

  trendClass(value: number): 'positive' | 'negative' | 'neutral' {
    if (value > 0) {
      return 'positive';
    }

    if (value < 0) {
      return 'negative';
    }

    return 'neutral';
  }

  trendArrow(value: number): string {
    if (value > 0) {
      return '↑';
    }

    if (value < 0) {
      return '↓';
    }

    return '→';
  }

  private computeComparison(): void {
    if (!this.previousSession) {
      this.hasPreviousSession = false;
      this.scoreDiff = 0;
      this.accuracyDiff = 0;
      this.feedbackText = '';
      return;
    }

    this.hasPreviousSession = true;

    const currentScore = this.toSafeNumber(this.currentSession?.score);
    const currentAccuracy = this.toSafeNumber(this.currentSession?.accuracy);

    const previousScore = this.toSafeNumber(this.previousSession.score);
    const previousAccuracy = this.toSafeNumber(this.previousSession.accuracy);

    this.scoreDiff = currentScore - previousScore;
    this.accuracyDiff = Number((currentAccuracy - previousAccuracy).toFixed(1));

    if (this.scoreDiff > 0 || this.accuracyDiff > 0) {
      this.feedbackText = 'Nice improvement!';
      return;
    }

    if (this.scoreDiff < 0 || this.accuracyDiff < 0) {
      this.feedbackText = 'Keep practicing!';
      return;
    }

    this.feedbackText = 'Consistent performance!';
  }

  private toSafeNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
