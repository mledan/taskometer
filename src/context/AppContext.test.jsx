import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { appReducer, initialState, ACTION_TYPES } from './AppContext.jsx';

// Pin the clock so the scheduler's "future slot" checks are deterministic.
// Tuesday 2026-03-10 at 08:00 local time.
const NOW = new Date(2026, 2, 10, 8, 0, 0);
const TODAY = '2026-03-10';
const YMD = /^\d{4}-\d{2}-\d{2}$/;

function baseState(overrides = {}) {
  return {
    ...initialState,
    tasks: [],
    slots: [],
    isLoading: false,
    isInitialized: true,
    settings: { ...initialState.settings, autoSchedule: false },
    ...overrides,
  };
}

function task(id, extra = {}) {
  return {
    id,
    key: id,
    text: `task ${id}`,
    status: 'pending',
    primaryType: 'work',
    taskType: 'work',
    tags: [],
    duration: 30,
    priority: 'medium',
    scheduledTime: null,
    scheduledSlotId: null,
    specificTime: null,
    specificDay: null,
    scheduledFor: null,
    recurrence: { frequency: 'none', interval: 1, daysOfWeek: [], dayOfMonth: null, endDate: null, occurrences: null },
    subtasks: [],
    metadata: {},
    isTemplateBlock: false,
    ...extra,
  };
}

function slot(id, extra = {}) {
  return {
    id,
    date: TODAY,
    startTime: '09:00',
    endTime: '10:00',
    slotType: 'work',
    allowedTags: [],
    assignedTaskId: null,
    flexibility: 'preferred',
    label: 'Work',
    ...extra,
  };
}

const ids = (list) => list.map((t) => t.id);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

describe('INIT_STATE', () => {
  it('hydrates payload, clears loading, and mirrors tasks onto items', () => {
    const next = appReducer(initialState, {
      type: ACTION_TYPES.INIT_STATE,
      payload: { tasks: [task('a')], slots: [slot('s1')] },
    });
    expect(next.isLoading).toBe(false);
    expect(next.isInitialized).toBe(true);
    expect(next.error).toBeNull();
    expect(next.items).toBe(next.tasks);
    expect(ids(next.tasks)).toEqual(['a']);
  });

  it('falls back to legacy items when tasks is absent', () => {
    const next = appReducer(initialState, {
      type: ACTION_TYPES.INIT_STATE,
      payload: { items: [task('legacy')] },
    });
    expect(ids(next.items)).toEqual(['legacy']);
  });

  it('SET_ERROR records the error and stops loading', () => {
    const next = appReducer(initialState, { type: ACTION_TYPES.SET_ERROR, payload: 'boom' });
    expect(next.error).toBe('boom');
    expect(next.isLoading).toBe(false);
  });

  it('unknown actions return the same state reference', () => {
    const state = baseState();
    expect(appReducer(state, { type: 'NOPE' })).toBe(state);
  });
});

// ---------------------------------------------------------------------------
// ADD_TASK
// ---------------------------------------------------------------------------

describe('ADD_TASK', () => {
  it('appends a task to the inbox when autoSchedule is off', () => {
    const next = appReducer(baseState(), {
      type: ACTION_TYPES.ADD_TASK,
      payload: { text: 'write tests' },
    });
    expect(next.tasks).toHaveLength(1);
    expect(next.tasks[0].text).toBe('write tests');
    expect(next.tasks[0].scheduledTime).toBeNull();
    expect(next.tasks[0].status).toBe('pending');
    expect(next.items).toBe(next.tasks);
  });

  it('honours autoSchedule:false on the payload even when the setting is on', () => {
    const state = baseState({
      settings: { ...initialState.settings, autoSchedule: true },
      slots: [slot('s1')],
    });
    const next = appReducer(state, {
      type: ACTION_TYPES.ADD_TASK,
      payload: { text: 'later', autoSchedule: false },
    });
    expect(next.tasks[0].scheduledTime).toBeNull();
    expect(next.slots[0].assignedTaskId).toBeNull();
  });

  it('places a task into a matching future slot when autoSchedule is on', () => {
    const state = baseState({
      settings: { ...initialState.settings, autoSchedule: true },
      slots: [slot('s1')],
    });
    const next = appReducer(state, {
      type: ACTION_TYPES.ADD_TASK,
      payload: { text: 'deep work', primaryType: 'work', duration: 30 },
    });
    const t = next.tasks[0];
    expect(t.scheduledSlotId).toBe('s1');
    expect(t.scheduledTime).toBeTruthy();
    expect(t.metadata.scheduledDate).toMatch(YMD);
    expect(next.slots[0].assignedTaskId).toBe(t.id);
  });

  it('does not overwrite a slot that already has a first occupant', () => {
    const state = baseState({
      settings: { ...initialState.settings, autoSchedule: true },
      slots: [slot('s1', { assignedTaskId: 'first', endTime: '12:00' })],
      tasks: [task('first', { scheduledSlotId: 's1', scheduledTime: new Date(2026, 2, 10, 9, 0).toISOString() })],
    });
    const next = appReducer(state, {
      type: ACTION_TYPES.ADD_TASK,
      payload: { text: 'second', duration: 30 },
    });
    expect(next.slots[0].assignedTaskId).toBe('first');
  });

  it('ADD_ITEM is an alias accepting the legacy `item` shape', () => {
    const next = appReducer(baseState(), {
      type: ACTION_TYPES.ADD_ITEM,
      item: { text: 'legacy', key: 42 },
    });
    expect(next.tasks[0].key).toBe(42);
    // createTask only honours `id`; a legacy `key` gets a fresh generated id.
    expect(next.tasks[0].id).toMatch(/^task_/);
  });

  it('skips the engine when the task already carries a scheduledTime', () => {
    const when = new Date(2026, 2, 11, 10, 0).toISOString();
    const state = baseState({
      settings: { ...initialState.settings, autoSchedule: true },
      slots: [slot('s1')],
    });
    const next = appReducer(state, {
      type: ACTION_TYPES.ADD_TASK,
      payload: { text: 'fixed', scheduledTime: when },
    });
    expect(next.tasks[0].scheduledTime).toBe(when);
    expect(next.tasks[0].scheduledSlotId).toBeNull();
    expect(next.slots[0].assignedTaskId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// UPDATE_TASK
// ---------------------------------------------------------------------------

describe('UPDATE_TASK', () => {
  it('merges fields and bumps updatedAt on the matching task only', () => {
    const state = baseState({ tasks: [task('a', { updatedAt: 'old' }), task('b', { updatedAt: 'old' })] });
    const next = appReducer(state, {
      type: ACTION_TYPES.UPDATE_TASK,
      payload: { id: 'a', text: 'renamed', priority: 'high' },
    });
    expect(next.tasks[0].text).toBe('renamed');
    expect(next.tasks[0].priority).toBe('high');
    expect(next.tasks[0].updatedAt).not.toBe('old');
    expect(next.tasks[1].updatedAt).toBe('old');
  });

  it('matches by numeric legacy key', () => {
    const state = baseState({ tasks: [task('x', { key: 7 })] });
    const next = appReducer(state, {
      type: ACTION_TYPES.UPDATE_ITEM,
      item: { key: 7, text: 'via key' },
    });
    expect(next.tasks[0].text).toBe('via key');
  });

  it('frees the old slot when a scheduled task is manually unscheduled', () => {
    const state = baseState({
      tasks: [task('a', { scheduledSlotId: 's1', scheduledTime: 'iso' })],
      slots: [slot('s1', { assignedTaskId: 'a' })],
    });
    const next = appReducer(state, {
      type: ACTION_TYPES.UPDATE_TASK,
      payload: { id: 'a', scheduledTime: null, scheduledSlotId: null },
    });
    expect(next.slots[0].assignedTaskId).toBeNull();
    expect(next.tasks[0].scheduledTime).toBeNull();
  });

  it('is a no-op on tasks when the id is unknown', () => {
    const state = baseState({ tasks: [task('a')] });
    const next = appReducer(state, { type: ACTION_TYPES.UPDATE_TASK, payload: { id: 'zzz', text: 'ghost' } });
    expect(next.tasks).toEqual(state.tasks);
  });
});

// ---------------------------------------------------------------------------
// DELETE_TASK
// ---------------------------------------------------------------------------

describe('DELETE_TASK', () => {
  it('removes the task and clears its slot assignment', () => {
    const state = baseState({
      tasks: [task('a', { scheduledSlotId: 's1' }), task('b', { status: 'completed' })],
      slots: [slot('s1', { assignedTaskId: 'a' })],
    });
    const next = appReducer(state, { type: ACTION_TYPES.DELETE_TASK, payload: { id: 'a' } });
    expect(ids(next.tasks)).toEqual(['b']);
    expect(next.slots[0].assignedTaskId).toBeNull();
    expect(next.items).toBe(next.tasks);
  });

  it('leaves a freed slot empty when settings.autoSchedule is false', () => {
    const state = baseState({
      tasks: [task('a', { scheduledSlotId: 's1' }), task('b')],
      slots: [slot('s1', { assignedTaskId: 'a' })],
    });
    expect(state.settings.autoSchedule).toBe(false);
    const next = appReducer(state, { type: ACTION_TYPES.DELETE_TASK, payload: { id: 'a' } });
    expect(next.slots[0].assignedTaskId).toBeNull();
    expect(next.tasks[0].scheduledSlotId).toBeNull();
  });

  it('DELETE_ITEM accepts the legacy `item` shape with a numeric key', () => {
    const state = baseState({ tasks: [task('a', { key: 1 }), task('b', { key: 2 })] });
    const next = appReducer(state, { type: ACTION_TYPES.DELETE_ITEM, item: { key: 1 } });
    expect(ids(next.tasks)).toEqual(['b']);
  });

  it('no task references a slot that was never assigned after delete', () => {
    const state = baseState({
      tasks: [task('a', { scheduledSlotId: 's1' })],
      slots: [slot('s1', { assignedTaskId: 'a' }), slot('s2')],
    });
    const next = appReducer(state, { type: ACTION_TYPES.DELETE_TASK, payload: { id: 'a' } });
    const slotIds = new Set(next.slots.map((s) => s.id));
    next.tasks.forEach((t) => {
      if (t.scheduledSlotId) expect(slotIds.has(t.scheduledSlotId)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// COMPLETE / PAUSE / RESUME
// ---------------------------------------------------------------------------

describe('COMPLETE_TASK', () => {
  it('marks completed, stamps completedAt, stops a running timer', () => {
    const state = baseState({ tasks: [task('a', { startedAt: 'running' })] });
    const next = appReducer(state, { type: ACTION_TYPES.COMPLETE_TASK, payload: { taskId: 'a' } });
    expect(next.tasks[0].status).toBe('completed');
    expect(next.tasks[0].completedAt).toBe(NOW.toISOString());
    expect(next.tasks[0].startedAt).toBeNull();
  });

  it('keeps the schedule on the task but frees the slot marker', () => {
    const state = baseState({
      tasks: [task('a', { scheduledSlotId: 's1', scheduledTime: 'iso' })],
      slots: [slot('s1', { assignedTaskId: 'a' })],
    });
    const next = appReducer(state, { type: ACTION_TYPES.COMPLETE_TASK, payload: { taskId: 'a' } });
    expect(next.tasks[0].scheduledSlotId).toBe('s1');
    expect(next.tasks[0].scheduledTime).toBe('iso');
    expect(next.slots[0].assignedTaskId).toBeNull();
  });

  it('spawns the next occurrence for a recurring task', () => {
    const state = baseState({
      tasks: [task('a', {
        scheduledTime: new Date(2026, 2, 10, 9, 0).toISOString(),
        recurrence: { frequency: 'daily', interval: 1, daysOfWeek: [], dayOfMonth: null, endDate: null, occurrences: null },
      })],
    });
    const next = appReducer(state, { type: ACTION_TYPES.COMPLETE_TASK, payload: { taskId: 'a' } });
    expect(next.tasks).toHaveLength(2);
    const spawned = next.tasks[1];
    expect(spawned.status).toBe('pending');
    expect(spawned.metadata.recurrenceParentId).toBe('a');
    expect(spawned.metadata.recurrenceCount).toBe(1);
    expect(new Set(ids(next.tasks)).size).toBe(2);
  });

  it('stops recurring once occurrences is reached', () => {
    const state = baseState({
      tasks: [task('a', {
        metadata: { recurrenceCount: 1 },
        recurrence: { frequency: 'daily', interval: 1, daysOfWeek: [], dayOfMonth: null, endDate: null, occurrences: 2 },
      })],
    });
    const next = appReducer(state, { type: ACTION_TYPES.COMPLETE_TASK, payload: { taskId: 'a' } });
    expect(next.tasks).toHaveLength(1);
  });
});

describe('PAUSE_TASK / RESUME_TASK', () => {
  it('pausing clears the schedule and frees the slot', () => {
    const state = baseState({
      tasks: [task('a', { scheduledSlotId: 's1', scheduledTime: 'iso', specificTime: '09:00' })],
      slots: [slot('s1', { assignedTaskId: 'a' })],
    });
    const next = appReducer(state, { type: ACTION_TYPES.PAUSE_TASK, payload: { taskId: 'a' } });
    expect(next.tasks[0]).toMatchObject({ status: 'paused', scheduledTime: null, scheduledSlotId: null, specificTime: null });
    expect(next.slots[0].assignedTaskId).toBeNull();
  });

  it('resuming returns the task to pending', () => {
    const state = baseState({ tasks: [task('a', { status: 'paused' })] });
    const next = appReducer(state, { type: ACTION_TYPES.RESUME_TASK, payload: { taskId: 'a' } });
    expect(next.tasks[0].status).toBe('pending');
  });

  it('resuming with autoSchedule on backfills into an open slot', () => {
    const state = baseState({
      settings: { ...initialState.settings, autoSchedule: true },
      tasks: [task('a', { status: 'paused' })],
      slots: [slot('s1')],
    });
    const next = appReducer(state, { type: ACTION_TYPES.RESUME_TASK, payload: { taskId: 'a' } });
    expect(next.tasks[0].scheduledSlotId).toBe('s1');
    expect(next.slots[0].assignedTaskId).toBe('a');
  });
});

// ---------------------------------------------------------------------------
// RESCHEDULE_TASK (manual move)
// ---------------------------------------------------------------------------

describe('RESCHEDULE_TASK', () => {
  it('moves a task to an explicit slot and frees the old one', () => {
    const state = baseState({
      tasks: [task('a', { scheduledSlotId: 's1', scheduledTime: 'old' })],
      slots: [slot('s1', { assignedTaskId: 'a' }), slot('s2', { startTime: '11:00', endTime: '12:00' })],
    });
    const next = appReducer(state, {
      type: ACTION_TYPES.RESCHEDULE_TASK,
      payload: { taskId: 'a', scheduledTime: 'new', specificTime: '11:00', specificDay: 'Tuesday', scheduledSlotId: 's2' },
    });
    expect(next.tasks[0].scheduledSlotId).toBe('s2');
    expect(next.tasks[0].scheduledTime).toBe('new');
    expect(next.tasks[0].scheduledFor).toBe('new');
    expect(next.slots[0].assignedTaskId).toBeNull();
  });

  it('accepts `id` as well as `taskId`', () => {
    const state = baseState({ tasks: [task('a')] });
    const next = appReducer(state, {
      type: ACTION_TYPES.RESCHEDULE_TASK,
      payload: { id: 'a', scheduledTime: 't', specificTime: '10:00', specificDay: 'Tuesday' },
    });
    expect(next.tasks[0].scheduledTime).toBe('t');
    expect(next.tasks[0].scheduledSlotId).toBeNull();
  });

  it('marks the target slot as occupied and frees the old one', () => {
    const state = baseState({
      tasks: [task('a', { scheduledSlotId: 's1', scheduledTime: 'iso' })],
      slots: [slot('s1', { assignedTaskId: 'a' }), slot('s2')],
    });
    const next = appReducer(state, {
      type: ACTION_TYPES.RESCHEDULE_TASK,
      payload: { taskId: 'a', scheduledTime: 't', scheduledSlotId: 's2' },
    });
    expect(next.tasks[0].scheduledSlotId).toBe('s2');
    expect(next.slots[0].assignedTaskId).toBeNull();
    expect(next.slots[1].assignedTaskId).toBe('a');
  });

  it('does not steal the first-occupant marker from a slot that already has one', () => {
    const state = baseState({
      tasks: [task('a'), task('b', { scheduledSlotId: 's2', scheduledTime: 'iso' })],
      slots: [slot('s2', { assignedTaskId: 'b' })],
    });
    const next = appReducer(state, {
      type: ACTION_TYPES.RESCHEDULE_TASK,
      payload: { taskId: 'a', scheduledTime: 't', scheduledSlotId: 's2' },
    });
    expect(next.tasks[0].scheduledSlotId).toBe('s2');
    expect(next.slots[0].assignedTaskId).toBe('b');
  });
});

// ---------------------------------------------------------------------------
// Subtasks & timers
// ---------------------------------------------------------------------------

describe('subtasks and timers', () => {
  it('ADD_SUBTASK / TOGGLE_SUBTASK / DELETE_SUBTASK round-trip', () => {
    let s = baseState({ tasks: [task('a')] });
    s = appReducer(s, { type: ACTION_TYPES.ADD_SUBTASK, payload: { taskId: 'a', text: 'step' } });
    expect(s.tasks[0].subtasks).toHaveLength(1);
    const subId = s.tasks[0].subtasks[0].id;
    s = appReducer(s, { type: ACTION_TYPES.TOGGLE_SUBTASK, payload: { taskId: 'a', subtaskId: subId } });
    expect(s.tasks[0].subtasks[0].completed).toBe(true);
    s = appReducer(s, { type: ACTION_TYPES.DELETE_SUBTASK, payload: { taskId: 'a', subtaskId: subId } });
    expect(s.tasks[0].subtasks).toHaveLength(0);
  });

  it('START_TIMER then STOP_TIMER accumulates actualDuration in minutes', () => {
    let s = baseState({ tasks: [task('a')] });
    s = appReducer(s, { type: ACTION_TYPES.START_TIMER, payload: { taskId: 'a' } });
    expect(s.tasks[0].startedAt).toBe(NOW.toISOString());
    vi.setSystemTime(new Date(NOW.getTime() + 25 * 60000));
    s = appReducer(s, { type: ACTION_TYPES.STOP_TIMER, payload: { taskId: 'a' } });
    expect(s.tasks[0].startedAt).toBeNull();
    expect(s.tasks[0].actualDuration).toBe(25);
  });

  it('STOP_TIMER on a task with no running timer is a no-op', () => {
    const state = baseState({ tasks: [task('a')] });
    const next = appReducer(state, { type: ACTION_TYPES.STOP_TIMER, payload: { taskId: 'a' } });
    expect(next.tasks[0]).toBe(state.tasks[0]);
  });

  it('BATCH_UPDATE_TASKS applies per-id patches', () => {
    const state = baseState({ tasks: [task('a'), task('b'), task('c')] });
    const next = appReducer(state, {
      type: ACTION_TYPES.BATCH_UPDATE_TASKS,
      payload: { updates: [{ id: 'a', updates: { priority: 'urgent' } }, { id: 'c', updates: { text: 'C!' } }] },
    });
    expect(next.tasks[0].priority).toBe('urgent');
    expect(next.tasks[1]).toBe(state.tasks[1]);
    expect(next.tasks[2].text).toBe('C!');
  });
});

// ---------------------------------------------------------------------------
// SCHEDULE_TASKS / RESCHEDULE_ALL_TASKS
// ---------------------------------------------------------------------------

describe('SCHEDULE_TASKS', () => {
  it('returns the same state for an empty list', () => {
    const state = baseState();
    expect(appReducer(state, { type: ACTION_TYPES.SCHEDULE_TASKS, payload: { tasks: [] } })).toBe(state);
  });

  it('places the requested tasks into open slots in priority order', () => {
    const a = task('a', { priority: 'low' });
    const b = task('b', { priority: 'urgent' });
    // 30-minute slots so each holds exactly one 30-minute task.
    const state = baseState({
      tasks: [a, b],
      slots: [slot('s1', { endTime: '09:30' }), slot('s2', { startTime: '11:00', endTime: '11:30' })],
    });
    const next = appReducer(state, { type: ACTION_TYPES.SCHEDULE_TASKS, payload: { tasks: [a, b] } });
    const byId = Object.fromEntries(next.tasks.map((t) => [t.id, t]));
    expect(byId.b.scheduledSlotId).toBe('s1');
    expect(byId.a.scheduledSlotId).toBe('s2');
    expect(byId.a.metadata.scheduledDate).toMatch(YMD);
    expect(next.slots.map((s) => s.assignedTaskId)).toEqual(['b', 'a']);
  });
});

describe('RESCHEDULE_ALL_TASKS', () => {
  it('returns the same state when nothing is pending or paused', () => {
    const state = baseState({ tasks: [task('a', { status: 'completed' })] });
    expect(appReducer(state, { type: ACTION_TYPES.RESCHEDULE_ALL_TASKS })).toBe(state);
  });

  it('clears old assignments and re-places pending tasks', () => {
    const state = baseState({
      tasks: [task('a', { scheduledSlotId: 's1', scheduledTime: 'stale' })],
      slots: [slot('s1', { assignedTaskId: 'a' })],
    });
    const next = appReducer(state, { type: ACTION_TYPES.RESCHEDULE_ALL_TASKS });
    expect(next.tasks[0].scheduledSlotId).toBe('s1');
    expect(next.tasks[0].scheduledTime).not.toBe('stale');
    expect(next.slots[0].assignedTaskId).toBe('a');
  });

  it('leaves completed tasks untouched', () => {
    const done = task('d', { status: 'completed', scheduledSlotId: 's1', scheduledTime: 'kept' });
    const state = baseState({ tasks: [done, task('p')], slots: [slot('s1'), slot('s2', { startTime: '11:00', endTime: '12:00' })] });
    const next = appReducer(state, { type: ACTION_TYPES.RESCHEDULE_ALL_TASKS });
    expect(next.tasks[0]).toBe(done);
  });
});

// ---------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------

describe('slot actions', () => {
  it('ADD_SLOT normalizes through createCalendarSlot', () => {
    const next = appReducer(baseState(), {
      type: ACTION_TYPES.ADD_SLOT,
      payload: { date: TODAY, startTime: '9:00', endTime: '10:00', slotType: 'work' },
    });
    expect(next.slots).toHaveLength(1);
    expect(next.slots[0].id).toMatch(/^slot_/);
    expect(next.slots[0].date).toMatch(YMD);
    expect(next.slots[0].allowedTags).toEqual([]);
  });

  it('ADD_SLOT backfills an unscheduled pending task when autoSchedule is on', () => {
    const state = baseState({
      settings: { ...initialState.settings, autoSchedule: true },
      tasks: [task('a')],
    });
    const next = appReducer(state, {
      type: ACTION_TYPES.ADD_SLOT,
      payload: { date: TODAY, startTime: '09:00', endTime: '10:00', slotType: 'work' },
    });
    expect(next.tasks[0].scheduledSlotId).toBe(next.slots[0].id);
    expect(next.slots[0].assignedTaskId).toBe('a');
  });

  it('UPDATE_SLOT accepts both {slotId, updates} and flat {id, ...} payloads', () => {
    const state = baseState({ slots: [slot('s1')] });
    const a = appReducer(state, { type: ACTION_TYPES.UPDATE_SLOT, payload: { slotId: 's1', updates: { label: 'A' } } });
    expect(a.slots[0].label).toBe('A');
    const b = appReducer(state, { type: ACTION_TYPES.UPDATE_SLOT, payload: { id: 's1', label: 'B' } });
    expect(b.slots[0].label).toBe('B');
  });

  it('DELETE_SLOT unschedules the task that lived there', () => {
    const state = baseState({
      tasks: [task('a', { scheduledSlotId: 's1', scheduledTime: 'iso', specificTime: '09:00' })],
      slots: [slot('s1', { assignedTaskId: 'a' })],
    });
    const next = appReducer(state, { type: ACTION_TYPES.DELETE_SLOT, payload: { slotId: 's1' } });
    expect(next.slots).toHaveLength(0);
    expect(next.tasks[0].scheduledSlotId).toBeNull();
    expect(next.tasks[0].scheduledTime).toBeNull();
    expect(next.tasks[0].specificTime).toBeNull();
  });

  it('unschedules every co-occupant of a deleted slot', () => {
    const state = baseState({
      tasks: [
        task('a', { scheduledSlotId: 's1', scheduledTime: 'iso' }),
        task('b', { scheduledSlotId: 's1', scheduledTime: 'iso' }),
      ],
      slots: [slot('s1', { assignedTaskId: 'a' })],
    });
    const next = appReducer(state, { type: ACTION_TYPES.DELETE_SLOT, payload: { slotId: 's1' } });
    expect(next.tasks[0].scheduledSlotId).toBeNull();
    expect(next.tasks[1].scheduledSlotId).toBeNull();
    expect(next.tasks[1].scheduledTime).toBeNull();
  });

  it('ASSIGN_TASK_TO_SLOT marks the occupant without touching tasks', () => {
    const state = baseState({ tasks: [task('a')], slots: [slot('s1')] });
    const next = appReducer(state, { type: ACTION_TYPES.ASSIGN_TASK_TO_SLOT, payload: { slotId: 's1', taskId: 'a' } });
    expect(next.slots[0].assignedTaskId).toBe('a');
    expect(next.tasks).toBe(state.tasks);
  });

  it('CLEAR_SLOT frees the slot when the occupant is not re-placeable', () => {
    const state = baseState({
      tasks: [task('a', { status: 'completed', scheduledTime: 'iso', scheduledSlotId: 's1' })],
      slots: [slot('s1', { assignedTaskId: 'a' })],
    });
    const next = appReducer(state, { type: ACTION_TYPES.CLEAR_SLOT, payload: { slotId: 's1' } });
    expect(next.slots[0].assignedTaskId).toBeNull();
    expect(next.tasks[0].scheduledSlotId).toBeNull();
    expect(next.tasks[0].scheduledTime).toBeNull();
  });

  it('CLEAR_SLOT sends the occupant to the inbox and leaves the slot empty, even with autoSchedule on', () => {
    const state = baseState({
      settings: { ...initialState.settings, autoSchedule: true },
      tasks: [task('a', { scheduledTime: 'iso', scheduledSlotId: 's1' })],
      slots: [slot('s1', { assignedTaskId: 'a' })],
    });
    const next = appReducer(state, { type: ACTION_TYPES.CLEAR_SLOT, payload: { slotId: 's1' } });
    expect(next.slots[0].assignedTaskId).toBeNull();
    expect(next.tasks[0].scheduledSlotId).toBeNull();
    expect(next.tasks[0].scheduledTime).toBeNull();
  });

  it('BATCH_CREATE_SLOTS appends normalized slots', () => {
    const next = appReducer(baseState(), {
      type: ACTION_TYPES.BATCH_CREATE_SLOTS,
      payload: { slots: [{ date: TODAY, startTime: '09:00', endTime: '10:00' }, { date: TODAY, startTime: '10:00', endTime: '11:00' }] },
    });
    expect(next.slots).toHaveLength(2);
    expect(new Set(next.slots.map((s) => s.id)).size).toBe(2);
  });

  it('CLEAR_SLOTS_FOR_DATE removes only that date (and optional source) and displaces tasks', () => {
    const state = baseState({
      settings: { ...initialState.settings, autoSchedule: true },
      tasks: [task('a', { scheduledSlotId: 's1', scheduledTime: 'iso' })],
      slots: [
        slot('s1', { assignedTaskId: 'a', sourceScheduleId: 'w1' }),
        slot('s2', { sourceScheduleId: 'w2' }),
        slot('s3', { date: '2026-03-11', sourceScheduleId: 'w1' }),
      ],
    });
    const next = appReducer(state, {
      type: ACTION_TYPES.CLEAR_SLOTS_FOR_DATE,
      payload: { date: TODAY, sourceScheduleId: 'w1' },
    });
    expect(next.slots.map((s) => s.id)).toEqual(['s2', 's3']);
    // Displaced from s1; backfill then re-homes it in the surviving s2.
    expect(next.tasks[0].scheduledSlotId).not.toBe('s1');
    expect(next.tasks[0].scheduledSlotId).toBe('s2');
  });
});

// ---------------------------------------------------------------------------
// Tags / task types / schedules
// ---------------------------------------------------------------------------

describe('tags, task types, schedules', () => {
  it('ADD_TAG / UPDATE_TAG / DELETE_TAG for a user tag', () => {
    let s = baseState({ tags: [] });
    s = appReducer(s, { type: ACTION_TYPES.ADD_TAG, payload: { name: 'deep' } });
    const id = s.tags[0].id;
    s = appReducer(s, { type: ACTION_TYPES.UPDATE_TAG, payload: { tagId: id, updates: { name: 'deeper' } } });
    expect(s.tags[0].name).toBe('deeper');
    s = appReducer(s, { type: ACTION_TYPES.DELETE_TAG, payload: { tagId: id } });
    expect(s.tags).toHaveLength(0);
  });

  it('refuses to delete a system tag', () => {
    const state = baseState();
    const sys = state.tags.find((t) => t.isSystem);
    const next = appReducer(state, { type: ACTION_TYPES.DELETE_TAG, payload: { tagId: sys.id } });
    expect(next).toBe(state);
  });

  it('refuses to delete the "default" task type', () => {
    const state = baseState({ taskTypes: [{ id: 'default', name: 'Default' }] });
    const next = appReducer(state, { type: ACTION_TYPES.DELETE_TASK_TYPE, payload: { typeId: 'default' } });
    expect(next).toBe(state);
  });

  it('ADD/UPDATE/DELETE_TASK_TYPE round-trip', () => {
    let s = baseState({ taskTypes: [] });
    s = appReducer(s, { type: ACTION_TYPES.ADD_TASK_TYPE, payload: { id: 'focus', name: 'Focus' } });
    s = appReducer(s, { type: ACTION_TYPES.UPDATE_TASK_TYPE, payload: { id: 'focus', name: 'Deep focus' } });
    expect(s.taskTypes[0].name).toBe('Deep focus');
    s = appReducer(s, { type: ACTION_TYPES.DELETE_TASK_TYPE, payload: { typeId: 'focus' } });
    expect(s.taskTypes).toHaveLength(0);
  });

  it('SET_ACTIVE_SCHEDULE then DELETE_SCHEDULE clears the active pointer', () => {
    let s = baseState();
    s = appReducer(s, { type: ACTION_TYPES.ADD_SCHEDULE, payload: { id: 'w1', name: 'Workday' } });
    s = appReducer(s, { type: ACTION_TYPES.SET_ACTIVE_SCHEDULE, payload: { schedule: s.schedules[0] } });
    expect(s.activeScheduleId).toBe('w1');
    s = appReducer(s, { type: ACTION_TYPES.DELETE_SCHEDULE, payload: { scheduleId: 'w1' } });
    expect(s.schedules).toHaveLength(0);
    expect(s.activeScheduleId).toBeNull();
    expect(s.activeSchedule).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// APPLY_SCHEDULE (painting blocks into slots)
// ---------------------------------------------------------------------------

describe('APPLY_SCHEDULE', () => {
  const blocks = [
    { date: TODAY, start: '9:00', end: '11:00', type: 'work', label: 'Deep work', templateId: 'w1', id: 'b1' },
    { date: TODAY, start: '12:00', end: '13:00', type: 'meals', label: 'Lunch', templateId: 'w1', id: 'b2' },
  ];

  it('creates one slot per block with YMD dates and HH:mm times', () => {
    const next = appReducer(baseState(), { type: ACTION_TYPES.APPLY_SCHEDULE, payload: { blocks } });
    expect(next.slots).toHaveLength(2);
    expect(next.slots[0]).toMatchObject({ date: TODAY, startTime: '09:00', endTime: '11:00', slotType: 'work', sourceScheduleId: 'w1', sourceBlockId: 'b1' });
    next.slots.forEach((s) => expect(s.date).toMatch(YMD));
  });

  it('is idempotent — re-applying the same blocks adds no duplicates', () => {
    const once = appReducer(baseState(), { type: ACTION_TYPES.APPLY_SCHEDULE, payload: { blocks } });
    const twice = appReducer(once, { type: ACTION_TYPES.APPLY_SCHEDULE, payload: { blocks } });
    expect(twice.slots).toHaveLength(2);
  });

  it('overrideExisting replaces that date and leaves other dates alone', () => {
    const state = baseState({ slots: [slot('old', { date: TODAY }), slot('other', { date: '2026-03-12' })] });
    const next = appReducer(state, {
      type: ACTION_TYPES.APPLY_SCHEDULE,
      payload: { blocks, options: { overrideExisting: true } },
    });
    expect(next.slots.map((s) => s.id)).not.toContain('old');
    expect(next.slots.map((s) => s.id)).toContain('other');
    expect(next.slots).toHaveLength(3);
  });

  it('drops legacy template-block tasks', () => {
    const state = baseState({ tasks: [task('tpl', { isTemplateBlock: true }), task('real')] });
    const next = appReducer(state, { type: ACTION_TYPES.APPLY_SCHEDULE, payload: { blocks } });
    expect(ids(next.tasks)).toEqual(['real']);
  });

  it('returns the same state for an empty block list', () => {
    const state = baseState();
    expect(appReducer(state, { type: ACTION_TYPES.APPLY_SCHEDULE, payload: { blocks: [] } })).toBe(state);
  });
});

// ---------------------------------------------------------------------------
// Settings / daily reset
// ---------------------------------------------------------------------------

describe('UPDATE_SETTINGS', () => {
  it('shallow-merges into settings', () => {
    const next = appReducer(baseState(), { type: ACTION_TYPES.UPDATE_SETTINGS, payload: { theme: 'light' } });
    expect(next.settings.theme).toBe('light');
    expect(next.settings.autoSchedule).toBe(false);
  });
});

describe('DAILY_RESET', () => {
  it('drops completed, un-pauses, clears schedules, and unassigns slots', () => {
    const state = baseState({
      tasks: [
        task('done', { status: 'completed' }),
        task('paused', { status: 'paused' }),
        task('p', { scheduledSlotId: 's1', scheduledTime: 'iso', specificTime: '09:00' }),
      ],
      slots: [slot('s1', { assignedTaskId: 'p' })],
    });
    const next = appReducer(state, { type: ACTION_TYPES.DAILY_RESET });
    expect(ids(next.tasks)).toEqual(['paused', 'p']);
    expect(next.tasks.every((t) => t.status === 'pending')).toBe(true);
    // Yesterday's placement is wiped, then backfill gives fresh placement.
    expect(next.tasks.every((t) => t.scheduledTime !== 'iso' && t.updatedAt === NOW.toISOString())).toBe(true);
    expect(next.date.year).toBe('2026');
  });

  it('unassigns every slot before backfilling', () => {
    const state = baseState({
      tasks: [task('done', { status: 'completed', scheduledSlotId: 's1' })],
      slots: [slot('s1', { assignedTaskId: 'done' })],
    });
    const next = appReducer(state, { type: ACTION_TYPES.DAILY_RESET });
    expect(next.tasks).toHaveLength(0);
    expect(next.slots[0].assignedTaskId).toBeNull();
  });

  it('materializes defaultDaySlots for today when none exist', () => {
    const state = baseState({
      settings: {
        ...initialState.settings,
        autoSchedule: false,
        defaultDaySlots: [{ id: 'd1', day: 'Tuesday', startTime: '09:00', endTime: '10:00', slotType: 'work' }],
      },
    });
    const next = appReducer(state, { type: ACTION_TYPES.DAILY_RESET });
    expect(next.slots).toHaveLength(1);
    expect(next.slots[0]).toMatchObject({ date: TODAY, sourceScheduleId: 'default-day-slots', sourceBlockId: 'd1' });
  });
});

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

describe('ADD_AUDIT_ENTRY', () => {
  it('appends and caps the log at 1000 entries', () => {
    const state = baseState({ auditLog: Array.from({ length: 1000 }, (_, i) => ({ id: `e${i}` })) });
    const next = appReducer(state, {
      type: ACTION_TYPES.ADD_AUDIT_ENTRY,
      payload: { action: 'create', entityType: 'task', entityId: 'x' },
    });
    expect(next.auditLog).toHaveLength(1000);
    expect(next.auditLog[0].id).toBe('e1');
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting invariants
// ---------------------------------------------------------------------------

describe('invariants', () => {
  it('items always mirrors tasks after every task-mutating action', () => {
    let s = baseState();
    s = appReducer(s, { type: ACTION_TYPES.ADD_TASK, payload: { text: 'one' } });
    s = appReducer(s, { type: ACTION_TYPES.ADD_TASK, payload: { text: 'two' } });
    expect(s.items).toBe(s.tasks);
    const id = s.tasks[0].id;
    s = appReducer(s, { type: ACTION_TYPES.COMPLETE_TASK, payload: { taskId: id } });
    expect(s.items).toBe(s.tasks);
    s = appReducer(s, { type: ACTION_TYPES.DELETE_TASK, payload: { id } });
    expect(s.items).toBe(s.tasks);
  });

  it('task ids stay unique across a burst of adds', () => {
    let s = baseState();
    for (let i = 0; i < 20; i++) {
      s = appReducer(s, { type: ACTION_TYPES.ADD_TASK, payload: { text: `t${i}` } });
    }
    expect(new Set(ids(s.tasks)).size).toBe(20);
  });

  it('scheduled dates are YMD strings when the engine places tasks', () => {
    const state = baseState({
      settings: { ...initialState.settings, autoSchedule: true },
      slots: [slot('s1'), slot('s2', { startTime: '11:00', endTime: '12:00' })],
    });
    let s = appReducer(state, { type: ACTION_TYPES.ADD_TASK, payload: { text: 'a' } });
    s = appReducer(s, { type: ACTION_TYPES.ADD_TASK, payload: { text: 'b' } });
    s.tasks.forEach((t) => {
      expect(t.metadata.scheduledDate).toMatch(YMD);
      expect(typeof t.scheduledTime).toBe('string');
    });
  });
});
