/**
 * Schedule archetypes — the social-first organizing principle.
 *
 * People describe their days in terms of *kind* of person they are
 * ("I'm a night owl", "I'm a parent of two") not in terms of
 * minute-by-minute breakdown. Archetypes give us the categorization
 * users can self-identify with — and find others on similar
 * schedules.
 *
 * Each archetype maps to a default wheel (an existing system_* or a
 * new one defined here). When the user picks an archetype they get
 * the wheel pre-applied AND get associated with that bucket — so the
 * social layer (when it ships) can show "12 other Night Owls also
 * use a 25/5 pomodoro pattern."
 *
 * Famous-people wheels (Buffett, Mozart, Kafka, …) are NOT archetypes.
 * They live in their own "Famous routines" easter-egg section as
 * curated examples; the main UI surfaces archetypes.
 */

const C = {
  sleep:  '#6B46C1',
  deep:   '#D4663A',
  work:   '#EA580C',
  health: '#10B981',
  food:   '#A8BF8C',
  social: '#EC4899',
  fun:    '#F59E0B',
  family: '#3B82F6',
  mind:   '#0EA5E9',
  travel: '#06B6D4',
  down:   '#78716C',
  create: '#8B5CF6',
};

function b(start, end, slotType, label, color) {
  return { startTime: start, endTime: end, slotType, label, color };
}

/**
 * Wheels owned by the archetype catalog. These don't live in
 * famousWheels.js because they're not famous — they're prototypical.
 *
 * IDs prefixed `arch_` so they're easy to search and don't collide
 * with anything in famousWheels or defaultSchedule.
 */
export const ARCHETYPE_WHEELS = [
  {
    id: 'arch_office_9_5',
    name: 'Office 9–5',
    category: 'Archetype',
    color: '#D4663A',
    blocks: [
      b('00:00', '06:30', 'sleep',  'Sleep',         C.sleep),
      b('06:30', '07:15', 'food',   'Breakfast',     C.food),
      b('07:15', '08:00', 'health', 'Get ready',     C.health),
      b('08:00', '08:45', 'travel', 'Commute',       C.travel),
      b('08:45', '12:00', 'work',   'Morning work',  C.work),
      b('12:00', '13:00', 'food',   'Lunch',         C.food),
      b('13:00', '17:00', 'work',   'Afternoon',     C.work),
      b('17:00', '17:45', 'travel', 'Commute home',  C.travel),
      b('17:45', '19:30', 'food',   'Cook & dinner', C.food),
      b('19:30', '22:00', 'fun_hobby', 'Free time',  C.fun),
      b('22:00', '00:00', 'sleep',  'Wind down',     C.down),
    ],
  },
  {
    id: 'arch_remote',
    name: 'Remote Worker',
    category: 'Archetype',
    color: '#3B82F6',
    blocks: [
      b('00:00', '07:00', 'sleep',     'Sleep',          C.sleep),
      b('07:00', '08:00', 'health',    'Workout',        C.health),
      b('08:00', '09:00', 'food',      'Breakfast',      C.food),
      b('09:00', '12:00', 'work',      'Deep work',      C.deep),
      b('12:00', '13:00', 'food',      'Lunch',          C.food),
      b('13:00', '15:00', 'work',      'Meetings',       C.work),
      b('15:00', '17:00', 'work',      'Async / writing',C.work),
      b('17:00', '18:00', 'health',    'Walk',           C.health),
      b('18:00', '21:00', 'family',    'Dinner & family',C.family),
      b('21:00', '23:00', 'fun_hobby', 'Hobby / read',   C.fun),
      b('23:00', '00:00', 'sleep',     'Wind down',      C.sleep),
    ],
  },
  {
    id: 'arch_parent',
    name: 'Parent of School-Age',
    category: 'Archetype',
    color: '#EC4899',
    blocks: [
      b('00:00', '06:30', 'sleep',     'Sleep',          C.sleep),
      b('06:30', '07:30', 'family',    'Wake the kids',  C.family),
      b('07:30', '08:30', 'travel',    'School drop-off',C.travel),
      b('08:30', '12:00', 'work',      'Work block',     C.work),
      b('12:00', '13:00', 'food',      'Lunch',          C.food),
      b('13:00', '15:00', 'work',      'Work block',     C.work),
      b('15:00', '16:00', 'travel',    'School pick-up', C.travel),
      b('16:00', '18:00', 'family',    'Activities',     C.family),
      b('18:00', '19:30', 'food',      'Family dinner',  C.food),
      b('19:30', '20:30', 'family',    'Bedtime routine',C.family),
      b('20:30', '22:30', 'downtime',  'Solo / partner', C.down),
      b('22:30', '00:00', 'sleep',     'Sleep',          C.sleep),
    ],
  },
  {
    id: 'arch_student',
    name: 'Student',
    category: 'Archetype',
    color: '#10B981',
    blocks: [
      b('00:00', '07:30', 'sleep',     'Sleep',           C.sleep),
      b('07:30', '08:30', 'food',      'Breakfast',       C.food),
      b('08:30', '12:00', 'work',      'Classes',         C.mind),
      b('12:00', '13:00', 'food',      'Lunch',           C.food),
      b('13:00', '15:00', 'work',      'More classes',    C.mind),
      b('15:00', '17:00', 'work',      'Study session',   C.deep),
      b('17:00', '18:00', 'health',    'Workout',         C.health),
      b('18:00', '19:30', 'food',      'Dinner',          C.food),
      b('19:30', '22:00', 'work',      'Homework',        C.work),
      b('22:00', '00:00', 'social',    'Friends',         C.social),
    ],
  },
  {
    id: 'arch_freelancer',
    name: 'Freelance Flow',
    category: 'Archetype',
    color: '#8B5CF6',
    blocks: [
      b('00:00', '07:30', 'sleep',     'Sleep',           C.sleep),
      b('07:30', '09:00', 'health',    'Workout & coffee',C.health),
      b('09:00', '12:00', 'work',      'Client work',     C.deep),
      b('12:00', '13:00', 'food',      'Lunch',           C.food),
      b('13:00', '15:00', 'work',      'Client calls',    C.work),
      b('15:00', '17:00', 'work',      'Admin / billing', C.work),
      b('17:00', '19:00', 'fun_hobby', 'Hobby / errands', C.fun),
      b('19:00', '20:00', 'food',      'Dinner',          C.food),
      b('20:00', '22:00', 'work',      'Side project',    C.create),
      b('22:00', '00:00', 'sleep',     'Wind down',       C.sleep),
    ],
  },
];

/**
 * The catalog itself. Each archetype names a wheel by id; that wheel
 * lives either in ARCHETYPE_WHEELS above or in famousWheels.js (for
 * archetypes whose canonical example is a system_* wheel).
 */
export const ARCHETYPES = [
  {
    id: 'early-bird',
    name: 'Early Bird',
    icon: '🌅',
    color: '#F59E0B',
    blurb: 'Up before sunrise. Best work before 10am, asleep by 9.',
    wheelId: 'system_early_bird',
  },
  {
    id: 'night-owl',
    name: 'Night Owl',
    icon: '🌙',
    color: '#7C3AED',
    blurb: 'Comes alive after dark. Deep work after 9pm.',
    wheelId: 'system_night_owl',
  },
  {
    id: 'office-9-5',
    name: 'Office 9-to-5',
    icon: '🏢',
    color: '#D4663A',
    blurb: 'Classic in-office workday. Commute, meetings, evening unwinds.',
    wheelId: 'arch_office_9_5',
  },
  {
    id: 'remote',
    name: 'Remote Worker',
    icon: '🏡',
    color: '#3B82F6',
    blurb: 'Home office, async-heavy, walks instead of commutes.',
    wheelId: 'arch_remote',
  },
  {
    id: 'parent',
    name: 'Parent',
    icon: '👨‍👧',
    color: '#EC4899',
    blurb: 'School runs, work between drop-off and pick-up, family evenings.',
    wheelId: 'arch_parent',
  },
  {
    id: 'student',
    name: 'Student',
    icon: '🎓',
    color: '#10B981',
    blurb: 'Classes, study sessions, and a real social life.',
    wheelId: 'arch_student',
  },
  {
    id: 'pomodoro',
    name: 'Pomodoro Focus',
    icon: '🍅',
    color: '#DC2626',
    blurb: '25-minute sprints with paced breaks. For deep solo work.',
    wheelId: 'system_pomodoro',
  },
  {
    id: 'freelancer',
    name: 'Freelancer',
    icon: '✍️',
    color: '#8B5CF6',
    blurb: 'Mixed client + admin + creative blocks. Flexible but bounded.',
    wheelId: 'arch_freelancer',
  },
];

/** Lookup by archetype id. */
export function archetypeById(id) {
  return ARCHETYPES.find(a => a.id === id) || null;
}

/** Lookup the archetype that owns a given wheel id (if any). */
export function archetypeForWheel(wheelId) {
  return ARCHETYPES.find(a => a.wheelId === wheelId) || null;
}
