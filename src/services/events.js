/**
 * Tiny app-wide event bus on top of window.dispatchEvent.
 *
 * Used by the Onboarding overlay (which lives at the App level) to
 * advance steps when components nested deep in the tree do the thing
 * the current step is waiting for. Eg., the day view dispatches
 * 'taskometer:wheel-applied' when a chip click paints a day, and the
 * tour's "Pick a shape" step auto-advances on hearing it.
 *
 * Names are namespaced under 'taskometer:' to avoid colliding with
 * anything else on the window.
 */

export const EVENTS = {
  WHEEL_APPLIED:        'taskometer:wheel-applied',
  SLOT_SELECTED:        'taskometer:slot-selected',
  TASK_ADDED:           'taskometer:task-added',
  RHYTHM_ADDED:         'taskometer:rhythm-added',
  NAVIGATED_TO_YEAR:    'taskometer:navigated-to-year',
  ONBOARDING_START:     'taskometer:onboarding-start',
};

export function emit(name, detail = {}) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch (_) { /* unsupported env, never throw */ }
}
