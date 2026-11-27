import { initialDarkMode } from './dark-mode-preference';

describe('initialDarkMode', () => {
  const storage = (value: string | null) => ({ getItem: () => value });

  it('follows the system when nothing is saved', () => {
    expect(initialDarkMode(storage(null), () => true)).toBeTrue();
    expect(initialDarkMode(storage(null), () => false)).toBeFalse();
  });

  it('keeps the saved setting over the system', () => {
    expect(initialDarkMode(storage('false'), () => true)).toBeFalse();
    expect(initialDarkMode(storage('true'), () => false)).toBeTrue();
  });

  it('falls back to the system on an invalid value', () => {
    expect(initialDarkMode(storage('{oops'), () => true)).toBeTrue();
  });
});
