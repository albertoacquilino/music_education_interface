import { Injectable } from '@angular/core';
import {
  CancelHandle,
  ClockPort,
  ClockTick
} from '../../core/activity/activity-context';

@Injectable({
  providedIn: 'root'
})
export class RxjsClockAdapter implements ClockPort {
  nowMs(): number {
    return performance.now();
  }

  every(
    periodMs: number,
    onTick: (tick: ClockTick) => void,
    signal: AbortSignal
  ): CancelHandle {
    const startedAtMs = this.nowMs();
    let sequence = 0;
    let cancelled = false;
    const timerId = window.setInterval(() => {
      if (cancelled || signal.aborted) {
        return;
      }

      const nextSequence = sequence++;
      onTick({
        sequence: nextSequence,
        scheduledAtMs: startedAtMs + periodMs * (nextSequence + 1),
        observedAtMs: this.nowMs()
      });
    }, periodMs);

    const cancel = () => {
      if (cancelled) {
        return;
      }
      cancelled = true;
      window.clearInterval(timerId);
      signal.removeEventListener('abort', cancel);
    };

    signal.addEventListener('abort', cancel, { once: true });
    return { cancel };
  }
}
