/**
 * This file is part of the Music Education Interface project.
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * See the LICENSE file for more details.
 */

/**
 * Dark Mode setting: the value saved in localStorage ('isDarkMode') once
 * the user has saved their settings, otherwise the OS colour scheme, so
 * that a first launch matches the device.
 *
 * index.html applies the same rule before Angular starts, to avoid a flash
 * of the wrong theme.
 */
export function initialDarkMode(
  storage: Pick<Storage, 'getItem'> = localStorage,
  systemPrefersDark: () => boolean = () =>
    typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
): boolean {
  try {
    const stored = storage.getItem('isDarkMode');
    if (stored !== null) {
      return JSON.parse(stored) === true;
    }
  } catch {
    // Unreadable or invalid value: fall back to the system.
  }
  return systemPrefersDark();
}
