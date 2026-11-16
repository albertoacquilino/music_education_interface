import { PickerController } from '@ionic/angular';
import { PickerOptions } from '@ionic/core';
import { MINTEMPO, MAXTEMPO } from '../../constants';
import { TempoSelectorComponent } from './tempo-selector.component';

describe('Tempo selector dismissal', () => {
  let selector: TempoSelectorComponent;
  let config: PickerOptions;
  let close: (event: { role?: string }) => void;
  let picker: any;
  beforeEach(() => {
    picker = {
      present: jasmine.createSpy('present').and.resolveTo(),
      onWillDismiss: () => new Promise(resolve => { close = resolve; }),
      getColumn: jasmine.createSpy('getColumn').and.callFake(async () => config.columns![0])
    };
    const controller = { create: async (options: PickerOptions) => { config = options; return picker; } };
    selector = new TempoSelectorComponent(controller as PickerController);
    selector.tempo = 80;
    spyOn(selector.change, 'emit');
  });

  async function dismiss(role?: string) {
    close({ role });
    await Promise.resolve();
    await Promise.resolve();
  }

  for (const role of ['confirm', 'backdrop']) {
    it(role + ' commits the latest column selection once', async () => {
      await selector.openPicker();
      const column = config.columns![0];
      column.selectedIndex = 1;
      column.selectedIndex = column.options.findIndex(option => option.value === 120);
      await dismiss(role);
      await dismiss(role); // A resolved dismissal promise cannot apply twice.
      expect(selector.tempo).toBe(120);
      expect(selector.change.emit).toHaveBeenCalledOnceWith(120);
      expect(config.buttons).toContain(jasmine.objectContaining({ text: 'Confirm', role: 'confirm' }));
    });

    it('unchanged ' + role + ' keeps the original tempo', async () => {
      await selector.openPicker();
      await dismiss(role);
      expect(selector.tempo).toBe(80);
      expect(selector.change.emit).not.toHaveBeenCalled();
    });
  }

  it('explicit Cancel discards changes', async () => {
    await selector.openPicker();
    config.columns![0].selectedIndex = 0;
    await dismiss('cancel');
    expect(selector.tempo).toBe(80);
    expect(selector.change.emit).not.toHaveBeenCalled();
    expect(config.buttons).toContain(jasmine.objectContaining({ text: 'Cancel', role: 'cancel' }));
  });

  it('retains the existing bounded five-bpm options and accepts both limits', async () => {
    for (const value of [MINTEMPO, MAXTEMPO]) {
      await selector.openPicker();
      const column = config.columns![0];
      expect(column.options.map(option => option.value)).toEqual(
        Array.from({ length: (MAXTEMPO - MINTEMPO) / 5 + 1 }, (_, i) => MINTEMPO + i * 5));
      column.selectedIndex = column.options.findIndex(option => option.value === value);
      await dismiss('backdrop');
      expect(selector.tempo).toBe(value);
    }
  });
});
