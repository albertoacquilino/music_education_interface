import { NavigationEnd } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';
import { TabsComponent } from './tabs.page';

describe('TabsComponent activity selection', () => {
  let routerEvents: Subject<NavigationEnd>;
  let router: {
    url: string;
    events: Subject<NavigationEnd>;
    navigate: jasmine.Spy;
  };
  let session: {
    isActive: boolean;
    cancel: jasmine.Spy;
  };
  let component: TabsComponent;

  beforeEach(() => {
    localStorage.clear();
    routerEvents = new Subject<NavigationEnd>();
    router = {
      url: '/home/exercise',
      events: routerEvents,
      navigate: jasmine.createSpy('navigate').and.callFake(
        async (commands: string[]) => {
          router.url = commands.join('/');
          return true;
        }
      )
    };
    session = {
      isActive: false,
      cancel: jasmine.createSpy('cancel').and.callFake(async () => {
        session.isActive = false;
        return null;
      })
    };
    component = new TabsComponent(
      { getDisabled: () => false } as any,
      router as any,
      jasmine.createSpyObj('MenuController', ['close', 'open', 'isOpen']),
      jasmine.createSpyObj('PickerController', ['create']),
      {
        getRefFrequency: () => new BehaviorSubject(440),
        setRefFrequency: jasmine.createSpy('setRefFrequency')
      } as any,
      {
        setInstrument: jasmine.createSpy('setInstrument'),
        unlockAudio: jasmine.createSpy('unlockAudio').and.resolveTo()
      } as any,
      session as any
    );
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('selects the target-intonation activity route', async () => {
    await component.openActivity('tuner');

    expect(router.navigate).toHaveBeenCalledOnceWith([
      '/home',
      'intonation'
    ]);
    expect(component.exerciseMode).toBe('tuner');
    expect(localStorage.getItem('mode')).toBe('tuner');
  });

  it('cancels one active session as superseded before switching activities', async () => {
    session.isActive = true;

    await component.openActivity('tuner');

    expect(session.cancel).toHaveBeenCalledOnceWith('superseded');
    expect(router.navigate).toHaveBeenCalledTimes(1);
  });

  it('does not cancel or navigate when the selected activity is already open', async () => {
    session.isActive = true;

    await component.openActivity('instrument');

    expect(session.cancel).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('keeps both exercise routes instead of redirecting intonation to PLP', () => {
    router.url = '/home/intonation';
    component.ngOnInit();

    expect(component.exerciseMode).toBe('tuner');
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
