import { BehaviorSubject } from 'rxjs';
import { ActivityContext } from './activity-context';
import { LearningActivityController } from './activity-controller';
import { ActivitySessionService } from './activity-session.service';
import {
  ActivityCancelReason,
  ActivityResultBase,
  ActivitySnapshot
} from './activity.types';

interface TestResult extends ActivityResultBase {
  readonly activityId: 'prepare-listen-play';
}

class TestController implements LearningActivityController<{}, string, TestResult> {
  readonly activityId = 'prepare-listen-play' as const;
  readonly activityVersion = 'test';
  readonly snapshot$ = new BehaviorSubject<ActivitySnapshot<string, TestResult>>({
    lifecycle: 'idle'
  });
  cancelCalls: ActivityCancelReason[] = [];
  private result: TestResult = {
    activityId: 'prepare-listen-play',
    activityVersion: 'test',
    sessionId: 'test',
    outcome: 'cancelled',
    startedAtMs: 0,
    endedAtMs: 1,
    cancelReason: 'learner-stop'
  };

  async start(_config: {}, _context: ActivityContext, _signal: AbortSignal): Promise<void> {
    this.snapshot$.next({
      lifecycle: 'starting',
      sessionId: 'test',
      startedAtMs: 0
    });
    this.snapshot$.next({
      lifecycle: 'running',
      sessionId: 'test',
      state: 'running'
    });
  }

  async cancel(reason: ActivityCancelReason): Promise<TestResult> {
    this.cancelCalls.push(reason);
    this.result = { ...this.result, cancelReason: reason };
    this.snapshot$.next({
      lifecycle: 'cancelled',
      sessionId: 'test',
      reason,
      result: this.result
    });
    return this.result;
  }

  whenSettled(): Promise<TestResult> {
    return Promise.resolve(this.result);
  }
}

describe('ActivitySessionService', () => {
  it('restarts a reused controller after each terminal state without replay clearing the new boundary', async () => {
    const service = new ActivitySessionService();
    const controller = new TestController();
    for (const lifecycle of ['completed', 'cancelled', 'failed'] as const) {
      await service.start(controller, {}, {} as ActivityContext);
      const result = await controller.whenSettled();
      if (lifecycle === 'completed') {
        controller.snapshot$.next({ lifecycle, sessionId: 'old', result });
      } else if (lifecycle === 'failed') {
        controller.snapshot$.next({ lifecycle, sessionId: 'old', result,
          failure: { code: 'resource-failed', message: 'fixture', recoverable: true } });
      } else {
        await service.cancel('learner-stop');
      }
      expect(service.isActive).toBeFalse();
      await service.start(controller, {}, {} as ActivityContext);
      expect(service.isActive).toBeTrue();
      await service.cancel('learner-stop');
    }
  });

  it('releases a thrown initialization failure so Start can retry', async () => {
    const service = new ActivitySessionService();
    const controller = new TestController();
    const start = spyOn(controller, 'start').and.rejectWith(new Error('fixture'));
    await expectAsync(service.start(controller, {}, {} as ActivityContext)).toBeRejected();
    expect(service.isActive).toBeFalse();
    start.and.callThrough();
    await service.start(controller, {}, {} as ActivityContext);
    expect(service.isActive).toBeTrue();
    await service.cancel('learner-stop');
  });

  it('owns exactly one controller boundary and cancels a superseded session', async () => {
    const service = new ActivitySessionService();
    const first = new TestController();
    const second = new TestController();

    await service.start(first, {}, {} as ActivityContext);
    expect(service.isActive).toBeTrue();

    await service.start(second, {}, {} as ActivityContext);

    expect(first.cancelCalls).toEqual(['superseded']);
    expect(service.isActive).toBeTrue();
    await service.cancel('navigation');
    expect(second.cancelCalls).toEqual(['navigation']);
    expect(service.isActive).toBeFalse();
  });
});
