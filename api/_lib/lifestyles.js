/**
 * Curated whitelist of lifestyle tags. Hardcoded for v2 — the list
 * is small enough that a code deploy to add one is fine. Move to a
 * config file or admin-managed table when it grows past ~20 entries.
 *
 * Order is the order the picker should display them. Add new entries
 * at the bottom so existing UI doesn't reshuffle.
 */
export const LIFESTYLES = [
  'Night Owl',
  'Early Bird',
  'Office 9-to-5',
  'Remote Worker',
  'Parent',
  'Student',
  'Pomodoro Focus',
  'Freelancer',
  'Caregiver',
  'Athlete',
];

const SET = new Set(LIFESTYLES);

export function isValidLifestyle(s) {
  return typeof s === 'string' && SET.has(s);
}
