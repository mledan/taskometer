import { FAMOUS_WHEELS } from './famousWheels';

/**
 * Default schedule shipped with a fresh install.
 *
 * Sourced from a real user export (2026-04-21) so a new user lands with a
 * realistic set of task types, a filled-out weekday wheel, and three
 * starter alternates instead of an empty app.
 *
 * On first load (no saved taskTypes, no saved wheels) these are seeded into
 * the AppContext. QuickStart uses DEFAULT_WHEELS to let the user pick which
 * one gets painted onto today.
 */

export const DEFAULT_TASK_TYPES = [
  { id: 'sleep',            name: 'Sleep',           color: '#6B46C1' },
  { id: 'work',             name: 'Work',            color: '#D4663A' },
  { id: 'food',             name: 'Food',            color: '#A8BF8C' },
  { id: 'business',         name: 'Business',        color: '#D9C98C' },
  { id: 'family',           name: 'Family',          color: '#C7BEDD' },
  { id: 'social',           name: 'Social',          color: '#F2C4A6' },
  { id: 'chores',           name: 'Chores',          color: '#3B82F6' },
  { id: 'fun_hobby',        name: 'Fun/Hobby',       color: '#D4663A' },
  { id: 'events',           name: 'Events',          color: '#10B981' },
  { id: 'health',           name: 'Health',          color: '#EC4899' },
  { id: 'mind',             name: 'Mind',            color: '#D4663A' },
  { id: 'financial',        name: 'Financial',       color: '#EF4444' },
  { id: 'planning',         name: 'Planning',        color: '#14B8A6' },
  { id: 'relationship',     name: 'Relationship',    color: '#F59E0B' },
  { id: 'downtime',         name: 'Downtime',        color: '#78716C' },
  { id: 'commuting_travel', name: 'Commuting/Travel', color: '#06B6D4' },
].map((t) => ({
  id: t.id,
  name: t.name,
  icon: '✳️',
  color: t.color,
  defaultDuration: 30,
  allowedDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  description: null,
  constraints: {
    preferredTimeStart: null,
    preferredTimeEnd: null,
    maxDailyMinutes: null,
    minBreakBetween: null,
    allowOverlap: false,
  },
  isSystem: false,
  isActive: true,
}));

/**
 * The wheel the user actually built and runs with day-to-day.
 * QuickStart offers this first; it's also the default `dayAssignments`
 * target if the user does nothing.
 */
export const DEFAULT_DAY_WHEEL_ID = 'default_weekday';

export const DEFAULT_WHEELS = [
  {
    id: DEFAULT_DAY_WHEEL_ID,
    name: 'Weekday 9-5 (Typical)',
    color: '#D4663A',
    blocks: [
      // Sleep is anchored 23:00 → 06:00 (7h, one full sleepyti.me cycle
      // count). The skeleton always carries a sleep block; users can
      // shorten it but the SleepPSA pings them when total sleep drops.
      { startTime: '23:00', endTime: '06:00', slotType: 'sleep',            label: 'Sleep',          color: '#6B46C1' },
      { startTime: '06:00', endTime: '07:00', slotType: 'food',             label: 'Breakfast',      color: '#A8BF8C' },
      { startTime: '07:00', endTime: '08:00', slotType: 'health',           label: 'Workout',        color: '#10B981' },
      { startTime: '08:00', endTime: '08:45', slotType: 'commuting_travel', label: 'Commute',        color: '#06B6D4' },
      { startTime: '08:45', endTime: '12:00', slotType: 'work',             label: 'Work',           color: '#D4663A' },
      { startTime: '12:00', endTime: '13:00', slotType: 'food',             label: 'Lunch',          color: '#A8BF8C' },
      { startTime: '13:00', endTime: '17:00', slotType: 'work',             label: 'Work',           color: '#D4663A' },
      { startTime: '17:00', endTime: '17:45', slotType: 'commuting_travel', label: 'Commute',        color: '#06B6D4' },
      { startTime: '17:45', endTime: '18:30', slotType: 'chores',           label: 'Cook',           color: '#3B82F6' },
      { startTime: '18:30', endTime: '19:30', slotType: 'food',             label: 'Dinner',         color: '#A8BF8C' },
      { startTime: '19:30', endTime: '22:00', slotType: 'fun_hobby',        label: 'Free Time',      color: '#F59E0B' },
      { startTime: '22:00', endTime: '23:00', slotType: 'downtime',         label: 'Wind Down',      color: '#78716C' },
    ],
  },
  {
    id: 'starter_weekend',
    name: 'Weekend chill',
    color: '#A8BF8C',
    blocks: [
      { startTime: '23:00', endTime: '06:00', slotType: 'sleep',     label: 'Sleep',         color: '#6B46C1' },
      { startTime: '09:00', endTime: '10:00', slotType: 'downtime',  label: 'Slow morning' },
      { startTime: '10:00', endTime: '12:00', slotType: 'fun_hobby', label: 'Hobby' },
      { startTime: '12:00', endTime: '13:30', slotType: 'food',      label: 'Lunch' },
      { startTime: '13:30', endTime: '17:00', slotType: 'fun_hobby', label: 'Free' },
      { startTime: '18:00', endTime: '20:00', slotType: 'social',    label: 'Social' },
    ],
  },
  {
    id: 'starter_early',
    name: 'Early riser',
    color: '#10B981',
    blocks: [
      { startTime: '05:30', endTime: '06:30', slotType: 'health',   label: 'workout' },
      { startTime: '07:00', endTime: '11:00', slotType: 'work',     label: 'morning focus' },
      { startTime: '11:00', endTime: '12:00', slotType: 'food',     label: 'walk + lunch' },
      { startTime: '12:00', endTime: '15:00', slotType: 'work',     label: 'meetings' },
      { startTime: '15:00', endTime: '17:00', slotType: 'work',     label: 'wrap up' },
      { startTime: '21:00', endTime: '05:00', slotType: 'sleep',    label: 'sleep' },
    ],
  },
  ...FAMOUS_WHEELS,
];

export default { DEFAULT_WHEELS, DEFAULT_TASK_TYPES, DEFAULT_DAY_WHEEL_ID };
