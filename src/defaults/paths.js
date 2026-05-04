/**
 * Paths — combinations of a schedule + a task pack, applied together.
 *
 * The user's vision: "we can even have a 'path' where we set up not
 * only a schedule for you, but help you fill it with the various
 * packs."
 *
 * A Path bundles three things:
 *   schedule  — id of a wheel (famous, archetype, or starter)
 *   pack      — id of a TASK_PACKS entry to seed the inbox/today
 *   duration  — number of days the path applies the schedule across
 *
 * Adopting a path:
 *   1. Paints the schedule across the next `duration` days
 *      (weekday/weekend filters honored when set)
 *   2. Adds the pack's tasks to the inbox so the user plans them in
 *      themselves, OR auto-schedules them today if the user picks
 *      that variant on adoption.
 *
 * Same discipline as the famous profiles + packs: narrow, real
 * combinations that pair well. Don't manufacture paths just to fill
 * a list.
 */

export const PATHS = [
  {
    id: 'path_morning_person',
    name: 'Become a morning person',
    icon: '🌅',
    duration: 14,
    weekdaysOnly: false,
    schedule: 'famous_franklin',
    pack: 'pack_morning_routine',
    blurb: 'Two weeks on Franklin\'s 5am rise + dawn-focus block, paired with the morning-routine pack so light, movement, and a written priority anchor every day.',
  },
  {
    id: 'path_deep_work_sprint',
    name: 'Deep-work sprint',
    icon: '🎯',
    duration: 5,
    weekdaysOnly: true,
    schedule: 'famous_buffett',
    pack: 'pack_deep_work_day',
    blurb: 'Five weekdays on a Buffett-style "thinking time" schedule — light meetings, long reading + maker blocks. Maker-day pack supplies the structure each morning.',
  },
  {
    id: 'path_agile_two_week',
    name: 'Agile sprint — two weeks',
    icon: '🏃',
    duration: 14,
    weekdaysOnly: true,
    schedule: 'archetype_office',
    fallbackSchedule: 'famous_cook',
    pack: 'pack_agile_sprint_week',
    blurb: 'Standard 2-week sprint cadence — weekdays painted with an office-style schedule, ceremonies (planning, daily standups, refinement, demo, retro) seeded as tasks.',
  },
  {
    id: 'path_writers_routine',
    name: "Writer's routine",
    icon: '✍️',
    duration: 30,
    weekdaysOnly: false,
    schedule: 'famous_hemingway',
    pack: 'pack_journal_daily',
    blurb: 'A month on Hemingway\'s dawn-writing schedule with daily journaling prompts. Write at first light, stop while still going.',
  },
  {
    id: 'path_recover_from_burnout',
    name: 'Recovery week',
    icon: '🌱',
    duration: 7,
    weekdaysOnly: false,
    schedule: 'starter_weekend',
    pack: 'pack_evening_winddown',
    blurb: 'Seven days of Weekend-chill cadence + evening wind-down ritual. Sleep-protective, light obligations. Reset before re-engaging.',
  },
  {
    id: 'path_first_week_new_job',
    name: 'First week at a new job',
    icon: '🪪',
    duration: 5,
    weekdaysOnly: true,
    schedule: 'archetype_office',
    fallbackSchedule: 'famous_cook',
    pack: 'pack_new_job_week_1',
    blurb: 'Five weekdays on an office schedule with the standard onboarding loop — paperwork, accounts, manager 1:1, teammate coffees, ship-something-tiny.',
  },
];

export default PATHS;
