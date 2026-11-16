import { IonModal } from '@ionic/angular';
import { NoteSelectorComponent } from './note-selector.component';

describe('Note selector dismissal', () => {
  for (const label of ['Lowest Note:', 'Highest Note:']) {
    let selector: NoteSelectorComponent;
    beforeEach(() => {
      selector = new NoteSelectorComponent();
      selector.label = label;
      selector.note = 3;
      selector.resetDraftNote();
      selector.noteModal = { dismiss: jasmine.createSpy('dismiss').and.callFake(async (_data, role) => {
        selector.commitSelection(role);
        return true;
      }) } as unknown as IonModal;
      spyOn(selector.change, 'emit');
    });

    it(label + ' Confirm applies the latest draft exactly once', async () => {
      selector.draftNote = 5;
      await selector.confirmSelection();
      selector.commitSelection('confirm');
      expect(selector.change.emit).toHaveBeenCalledOnceWith(5);
      expect(selector.noteModal?.dismiss).toHaveBeenCalledWith(undefined, 'confirm');
    });

    it(label + ' backdrop/Escape applies the latest draft exactly once', () => {
      selector.draftNote = 4;
      selector.draftNote = 7;
      selector.commitSelection('backdrop');
      selector.commitSelection('backdrop');
      expect(selector.change.emit).toHaveBeenCalledOnceWith(7);
    });

    for (const role of ['confirm', 'backdrop']) {
      it(label + ' unchanged ' + role + ' preserves the value without an update', () => {
        selector.commitSelection(role);
        expect(selector.change.emit).not.toHaveBeenCalled();
        expect(selector.note).toBe(3);
      });
    }

    it(label + ' Cancel discards the draft', async () => {
      selector.draftNote = 8;
      await selector.cancelSelection();
      expect(selector.draftNote).toBe(3);
      expect(selector.change.emit).not.toHaveBeenCalled();
    });

    it(label + ' resets the draft and commit guard when reopened', () => {
      selector.draftNote = 8;
      selector.commitSelection('backdrop');
      selector.note = 6; // The parent can constrain a selection before reopening.
      selector.resetDraftNote();
      expect(selector.draftNote).toBe(6);
      selector.draftNote = 9;
      selector.commitSelection('backdrop');
      expect(selector.change.emit).toHaveBeenCalledWith(9);
      expect(selector.change.emit).toHaveBeenCalledTimes(2);
    });

    it(label + ' still blocks swipe dismissal and ignores other roles', async () => {
      selector.draftNote = 8;
      expect(await selector.canDismiss(undefined, 'gesture')).toBeFalse();
      selector.commitSelection(undefined);
      expect(selector.change.emit).not.toHaveBeenCalled();
    });
  }
});
