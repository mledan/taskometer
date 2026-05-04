/**
 * Task starter packs — curated lists of common, well-known todos.
 *
 * The user explicitly asked for these: "offer some starter packs for
 * todos as well for each day... like chores are pretty well known...
 * trash, dishes, clean, mop, dust, organize, de-clutter."
 *
 * Same discipline as the famous-people profiles: stay narrow to what
 * is actually well-defined and useful, don't pad with junk just to
 * fill out a list. Each pack is a small, intentional set the user
 * can adopt, drop, or edit.
 *
 * Each task in a pack has:
 *   text     — the visible task title
 *   duration — minutes (rough estimate; user can edit)
 *   primaryType — maps to one of the seeded task types so it slots
 *     into the right block-type when auto-scheduled.
 *
 * Packs themselves carry a name, a one-line description, an icon
 * hint, and a category tag so the picker can group them.
 */

export const TASK_PACKS = [
  // ─── Household ──────────────────────────────────────────────────
  {
    id: 'pack_weekly_chores',
    name: 'Weekly chores',
    icon: '🧹',
    category: 'Home',
    description: 'The standard household maintenance loop — pick the ones that apply, delete the rest.',
    tasks: [
      { text: 'Take out trash + recycling', duration: 10, primaryType: 'chores' },
      { text: 'Wash dishes / load dishwasher', duration: 15, primaryType: 'chores' },
      { text: 'Sweep + mop floors', duration: 30, primaryType: 'chores' },
      { text: 'Vacuum carpets + rugs', duration: 25, primaryType: 'chores' },
      { text: 'Wipe down counters + sinks', duration: 15, primaryType: 'chores' },
      { text: 'Clean bathroom (toilet, sink, mirror)', duration: 30, primaryType: 'chores' },
      { text: 'Dust shelves + surfaces', duration: 15, primaryType: 'chores' },
      { text: 'Change bed sheets', duration: 10, primaryType: 'chores' },
      { text: 'Laundry — wash, dry, fold', duration: 60, primaryType: 'chores' },
      { text: 'Take a 10-min decluttering pass', duration: 10, primaryType: 'chores' },
    ],
  },

  // ─── Personal foundations ───────────────────────────────────────
  {
    id: 'pack_morning_routine',
    name: 'Morning routine',
    icon: '🌅',
    category: 'Habits',
    description: 'A balanced, evidence-based start: hydration, light, movement, intention.',
    tasks: [
      { text: 'Drink a full glass of water', duration: 5, primaryType: 'health' },
      { text: 'Get outside light for 10 min', duration: 10, primaryType: 'health' },
      { text: 'Stretch or move for 10 min', duration: 10, primaryType: 'health' },
      { text: 'Write down 3 priorities for today', duration: 5, primaryType: 'planning' },
      { text: 'Eat a real breakfast', duration: 20, primaryType: 'food' },
    ],
  },
  {
    id: 'pack_evening_winddown',
    name: 'Evening wind-down',
    icon: '🌙',
    category: 'Habits',
    description: 'Sleep-protective rituals — screens off, body cooled, mind unloaded.',
    tasks: [
      { text: 'Tidy 5 things — reset the room', duration: 5, primaryType: 'chores' },
      { text: 'Set tomorrow\'s top priority', duration: 5, primaryType: 'planning' },
      { text: 'Brain-dump anything still on your mind', duration: 10, primaryType: 'planning' },
      { text: 'Phone away from bed (ideally another room)', duration: 2, primaryType: 'health' },
      { text: 'Read a book for 20 min', duration: 20, primaryType: 'mind' },
    ],
  },

  // ─── Work patterns ──────────────────────────────────────────────
  {
    id: 'pack_agile_sprint_week',
    name: 'Agile sprint — week ceremonies',
    icon: '🏃',
    category: 'Work',
    description: 'A week of standard Scrum events: standups, planning, refinement, retro, demo.',
    tasks: [
      { text: 'Sprint planning', duration: 90, primaryType: 'mtgs' },
      { text: 'Daily standup (Mon)', duration: 15, primaryType: 'mtgs' },
      { text: 'Daily standup (Tue)', duration: 15, primaryType: 'mtgs' },
      { text: 'Backlog refinement', duration: 60, primaryType: 'mtgs' },
      { text: 'Daily standup (Wed)', duration: 15, primaryType: 'mtgs' },
      { text: 'Daily standup (Thu)', duration: 15, primaryType: 'mtgs' },
      { text: 'Sprint review / demo', duration: 60, primaryType: 'mtgs' },
      { text: 'Sprint retrospective', duration: 60, primaryType: 'mtgs' },
    ],
  },
  {
    id: 'pack_deep_work_day',
    name: 'Deep-work day',
    icon: '🎯',
    category: 'Work',
    description: 'A maker day — three focus blocks, hard limits on meetings.',
    tasks: [
      { text: 'Pick the one thing that matters today', duration: 5, primaryType: 'planning' },
      { text: 'Deep-work block 1 (90 min, no notifications)', duration: 90, primaryType: 'deep' },
      { text: 'Walk + lunch', duration: 60, primaryType: 'health' },
      { text: 'Deep-work block 2 (90 min)', duration: 90, primaryType: 'deep' },
      { text: 'Inbox triage (timeboxed)', duration: 20, primaryType: 'admin' },
      { text: 'Deep-work block 3 (60 min)', duration: 60, primaryType: 'deep' },
    ],
  },

  // ─── Life events ────────────────────────────────────────────────
  {
    id: 'pack_travel_prep',
    name: 'Travel prep',
    icon: '🧳',
    category: 'Life',
    description: 'The night-before-a-trip checklist that prevents the airport scramble.',
    tasks: [
      { text: 'Pack clothes (per day + 1 spare)', duration: 30, primaryType: 'admin' },
      { text: 'Pack toiletries + meds', duration: 15, primaryType: 'admin' },
      { text: 'Charge phone, headphones, laptop', duration: 5, primaryType: 'admin' },
      { text: 'Confirm reservations + tickets', duration: 10, primaryType: 'admin' },
      { text: 'Set out-of-office on email', duration: 5, primaryType: 'admin' },
      { text: 'Arrange transport to airport / station', duration: 5, primaryType: 'admin' },
      { text: 'Take out trash, lock windows', duration: 10, primaryType: 'chores' },
      { text: 'Hold mail / arrange pet care', duration: 10, primaryType: 'admin' },
    ],
  },
  {
    id: 'pack_new_job_week_1',
    name: 'New job — week 1',
    icon: '🪪',
    category: 'Life',
    description: 'The standard onboarding loop — accounts, intros, calendar, expectations.',
    tasks: [
      { text: 'Complete HR paperwork + benefits enrollment', duration: 60, primaryType: 'admin' },
      { text: 'Set up laptop + accounts (email, chat, code)', duration: 90, primaryType: 'admin' },
      { text: '1:1 with manager — expectations + first 30 days', duration: 45, primaryType: 'mtgs' },
      { text: 'Coffee chats with 5 teammates', duration: 150, primaryType: 'mtgs' },
      { text: 'Read team docs + recent project history', duration: 90, primaryType: 'mind' },
      { text: 'Ship something tiny by end of week', duration: 60, primaryType: 'deep' },
      { text: 'End-of-week reflection — what worked, what\'s unclear', duration: 15, primaryType: 'planning' },
    ],
  },

  // ─── Wellbeing ──────────────────────────────────────────────────
  {
    id: 'pack_journal_daily',
    name: 'Daily journaling',
    icon: '📓',
    category: 'Habits',
    description: 'Short reflective prompts — one in the morning, one at night.',
    tasks: [
      { text: 'Morning page — 3 things you\'re looking forward to', duration: 10, primaryType: 'mind' },
      { text: 'Evening page — what went well, what to change tomorrow', duration: 10, primaryType: 'mind' },
    ],
  },
];

// Group packs by category for the picker UI.
export function groupPacks(packs = TASK_PACKS) {
  const byCat = new Map();
  for (const p of packs) {
    const cat = p.category || 'Other';
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(p);
  }
  return [...byCat.entries()].map(([category, items]) => ({ category, items }));
}

export default TASK_PACKS;
