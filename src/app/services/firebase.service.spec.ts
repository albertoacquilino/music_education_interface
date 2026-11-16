import { DeviceWeb } from '@capacitor/device/dist/esm/web';
import { Activity } from '../models/firebase.types';
import { FirebaseService } from './firebase.service';

describe('Firebase activity device metadata', () => {
  beforeEach(() => {
    spyOn(localStorage, 'getItem').and.returnValue(null);
    spyOn(localStorage, 'setItem');
    spyOn(DeviceWeb.prototype, 'getId').and.resolveTo({ identifier: 'existing-vendor-id' });
  });

  for (const platform of ['ios', 'android'] as const) {
    for (const typed of [false, true]) {
      it('preserves exactly the telemetry fields for ' + platform + ', typed=' + typed, async () => {
        spyOn(DeviceWeb.prototype, 'getInfo').and.resolveTo({
          model: 'existing-model', platform, operatingSystem: platform,
          osVersion: '15.0', manufacturer: 'fixture', isVirtual: false,
          webViewVersion: '15.0',
          // iOS omits optional disk fields; Android continues returning them.
          ...(platform === 'android' ? { diskFree: 123, diskTotal: 456,
            realDiskFree: 123, realDiskTotal: 456 } : {})
        });
        const service = new FirebaseService();
        const upload = spyOn<any>(service, 'saveActivity').and.resolveTo({ id: 'fixture' });
        if (typed) {
          await service.saveTypedActivityStart({
            schemaVersion: 2, sessionId: 'fixture-session', activityId: 'target-intonation',
            activityVersion: '1', instrumentId: 'flute-c',
            configuration: { referenceA4Hz: 442 }, sessionStartedAtMs: 1
          });
        } else {
          await service.saveStart(120, 0, 36, 440, true, true);
        }
        const expected = { id: 'existing-vendor-id', model: 'existing-model',
          platform, osVersion: '15.0' };
        expect(service.currentActivity.device).toEqual(expected);
        const stored = JSON.parse((localStorage.setItem as jasmine.Spy).calls.mostRecent().args[1]);
        expect(stored[0].device).toEqual(expected);
        await service.saveStop('finished', {});
        expect(upload).toHaveBeenCalledTimes(1);
        expect((upload.calls.mostRecent().args[0] as Activity).device).toEqual(expected);
        expect(DeviceWeb.prototype.getInfo).toHaveBeenCalledTimes(1);
        expect(DeviceWeb.prototype.getId).toHaveBeenCalledTimes(1);
      });
    }
  }
});
