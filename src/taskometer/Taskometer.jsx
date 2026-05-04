import React, { useEffect, useMemo, useRef, useState } from 'react';
import WheelView, { MiniWheel } from './WheelView.jsx';
import WheelPickerModal from './WheelPickerModal.jsx';
import WheelPainter from './WheelPainter.jsx';
import SaveAsRhythmModal from './year/SaveAsRhythmModal.jsx';
import CalendarView from './CalendarView.jsx';
import { MonthInsights, QuarterInsights, YearInsights } from './TimelineViews.jsx';
import DailyWrap from './DailyWrap.jsx';
import WheelsPanel from './WheelsPanel.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import { QuickCapture, InboxPanel } from './Inbox.jsx';
import RightNow from './RightNow.jsx';
import SleepPSA from './SleepPSA.jsx';
import DayStrip from './DayStrip.jsx';
import ComingUp from './ComingUp.jsx';
import BlockBoard from './BlockBoard.jsx';
import WeekCanvas from './WeekCanvas.jsx';
import LifeCanvas from './LifeCanvas.jsx';
import TimeBreakdown from './TimeBreakdown.jsx';
import Snoozed from './Snoozed.jsx';
import FamousSpotlight from './FamousSpotlight.jsx';
import PackPicker from './PackPicker.jsx';
import PathPicker from './PathPicker.jsx';
import DiscoveryStrip from './DiscoveryStrip.jsx';
import WelcomePopup, { readAuth, AUTH_EVENT } from './WelcomePopup.jsx';
import { hasSeenOnboarding, startOnboarding } from './Onboarding.jsx';
import AccountPanel from './AccountPanel.jsx';
import { useTaskometerAPI } from '../services/api';
import { STARTER_WHEELS } from '../services/api/TaskometerAPI';
import { DEFAULT_DAY_WHEEL_ID } from '../defaults/defaultSchedule';
import { FAMOUS_WHEELS } from '../defaults/famousWheels';
import { ARCHETYPES, ARCHETYPE_WHEELS } from '../defaults/scheduleArchetypes';
import { listRhythms, listExceptions, dateIsExcepted, addRhythm } from '../services/rhythms.js';
import { useMultiSelect } from '../hooks/useMultiSelect.js';
import { pendingRhythmSlotsForDate } from '../services/rhythmsToSlots.js';
import { findScheduleTarget } from '../services/scheduling.js';
import { emit, EVENTS } from '../services/events.js';
import useTaskNotifications from '../hooks/useTaskNotifications.js';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';
import KeyboardShortcuts from '../components/KeyboardShortcuts.jsx';
import { log as telemetryLog, snapshotState } from '../services/telemetry.js';
import './taskometer.css';

/**
 * Single-page dashboard. The only chrome above the fold is a scale
 * selector (slot → year), a date nav, the wheel library, ics export,
 * and settings. Everything that used to be a separate tab (gauge, fit,
 * rules) is gone. Each scale picks its own body component.
 */

const SCALES = ['block', 'day', 'week', 'month', 'quarter', 'year', 'life'];
const CALENDAR_SCOPES = new Set(['month', 'quarter', 'year', 'life']);

const DEFAULT_UI = {
  palette: 'warm',
  rules: 'lines',
  notifications: false,
};

function readSafeAuth() {
  try {
    // taskometer.auth is the current key; smartcircle.auth is the legacy
    // location migrated by main.jsx on first load. Read both for the
    // brief overlap window.
    return JSON.parse(
      localStorage.getItem('taskometer.auth')
      || localStorage.getItem('smartcircle.auth')
      || 'null'
    );
  } catch (_) { return null; }
}

function readStoredUI() {
  try {
    const raw = localStorage.getItem('tm.ui') || localStorage.getItem('tm.tweaks');
    if (!raw) return DEFAULT_UI;
    return { ...DEFAULT_UI, ...JSON.parse(raw) };
  } catch (_) {
    return DEFAULT_UI;
  }
}

export default function Taskometer() {
  const [scale, setScale] = useState(() => {
    const saved = localStorage.getItem('tm.scale');
    return SCALES.includes(saved) ? saved : 'day';
  });
  const [selectedDate, setSelectedDate] = useState(() => {
    // Allow deep-links from the year canvas: /app?date=YYYY-MM-DD
    // lands the user on that day instead of today. Falls back to today
    // for malformed or absent params.
    try {
      const params = new URLSearchParams(window.location.search);
      const d = params.get('date');
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
        const [y, m, day] = d.split('-').map(Number);
        const parsed = new Date(y, m - 1, day);
        if (!Number.isNaN(parsed.getTime())) return parsed;
      }
    } catch (_) { /* SSR or restricted env */ }
    return new Date();
  });
  const [ui, setUI] = useState(readStoredUI);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [wheelsPanelOpen, setWheelsPanelOpen] = useState(false);
  // welcomeOpen is intentionally not seeded from readAuth() at mount.
  // On a fresh tab, Clerk hasn't had a chance to mirror a signed-in
  // session into taskometer.auth yet, so initial readAuth() can be
  // null even for a logged-in user — that flashes the welcome popup
  // for a beat before AuthBoot catches up. Instead, we open welcome
  // from a deferred effect below, and close it reactively when auth
  // shows up. Net result: if you're already signed in (any tab, any
  // device), the popup never appears.
  // Onboarding state lives at the App level now (so it persists
  // across /app → /app/year navigation). Local triggers go through
  // startOnboarding() + the 'taskometer:onboarding-start' event.
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [packPickerOpen, setPackPickerOpen] = useState(false);
  const [pathPickerOpen, setPathPickerOpen] = useState(false);
  // The wheel currently being painted across a range. Null = painter
  // closed. Object = { wheel } where wheel may need to be added to the
  // user's library before applyToRange can target it by ID.
  const [painterTarget, setPainterTarget] = useState(null);
  // When the user lassos days in a calendar view we open the picker in
  // "range mode" — the user picks a wheel and it paints the lassoed
  // range. Null = picker is in single-day mode (the default).
  const [pendingRange, setPendingRange] = useState(null); // { startDate, endDate } | null
  // When the user multi-selects days (Cmd/Ctrl-click) and hits Paint,
  // we pass the explicit list to the picker. Mutually exclusive with
  // pendingRange — only one is active at a time.
  const [pendingDays, setPendingDays] = useState(null); // string[] | null
  const [saveDaysAsRhythmModal, setSaveDaysAsRhythmModal] = useState(null); // string[] | null
  // Single multi-select instance shared across the calendar scope tabs
  // so switching from month → quarter → year keeps the selection. The
  // 'app-calendar' storage key mirrors selection into sessionStorage so
  // an accidental refresh doesn't lose what the user just picked.
  const multiSelect = useMultiSelect('app-calendar');
  // Reactive auth — the source of truth is localStorage (taskometer.auth),
  // but the chip needs to update when AuthBoot mirrors a Clerk sign-in
  // or the user signs out via Clerk. WelcomePopup.writeAuth/clearAuth
  // dispatch AUTH_EVENT after every change; we listen and re-read.
  const [auth, setAuth] = useState(() => readSafeAuth());
  useEffect(() => {
    const onChange = () => setAuth(readSafeAuth());
    window.addEventListener(AUTH_EVENT, onChange);
    // Cross-tab updates fire the native `storage` event.
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(AUTH_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);
  const isLoggedIn = auth?.mode === 'account' || auth?.mode === 'clerk';

  // Decide whether to nag a fresh visitor — but only after Clerk's
  // mirror has had a chance to populate taskometer.auth. If auth is
  // still missing 400ms after mount, the user is genuinely anonymous.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!readSafeAuth()) setWelcomeOpen(true);
    }, 400);
    return () => clearTimeout(t);
  }, []);

  // If auth ever flips to logged-in (Clerk mirror, sign-in mid-session,
  // cross-tab storage event), the welcome popup is no longer welcome.
  useEffect(() => {
    if (isLoggedIn && welcomeOpen) setWelcomeOpen(false);
  }, [isLoggedIn, welcomeOpen]);
  const accountInitial = (auth?.profile?.firstName?.[0] || auth?.profile?.username?.[0] || 'G').toUpperCase();
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState(null);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const searchRef = useRef(null);
  const quickCaptureRef = useRef(null);

  const { state, api, derived } = useTaskometerAPI();

  useEffect(() => {
    localStorage.setItem('tm.scale', scale);
    telemetryLog('ui:scale', { scale });
  }, [scale]);

  useEffect(() => {
    try { localStorage.setItem('tm.ui', JSON.stringify(ui)); } catch (_) {}
  }, [ui]);

  // One-shot boot snapshot so the first console frame describes the landing state.
  const loggedReadyRef = useRef(false);
  const seededRef = useRef(false);
  useEffect(() => {
    if (loggedReadyRef.current) return;
    if (state.isLoading || !state.isInitialized) return;
    loggedReadyRef.current = true;
    telemetryLog('app:ready', { scale, ...snapshotState(state) });

    // Skeleton self-heal. The user complaint that drove this is "my
    // planner is always empty and i waste too much time planning."
    // Strategy: on every boot, walk today → today+29 and paint any
    // day that's truly empty (zero slots AND no manual assignment AND
    // no override). That respects user intent — if they cleared a day
    // *and* unassigned it, we leave it alone. But the default state is
    // "every day has a shape," so a wipe, a fresh install, or simply
    // navigating into an unpainted future day always shows a skeleton
    // with at least the sleep block.
    if (seededRef.current) return;

    const wheelsList = state.settings?.wheels || [];
    if (wheelsList.length < 1) return;
    const workday = wheelsList.find(w => w.id === DEFAULT_DAY_WHEEL_ID) || wheelsList[0];
    const weekend = wheelsList.find(w => w.id === 'starter_weekend')
      || wheelsList.find(w => w.id !== workday?.id)
      || workday;
    if (!workday) return;

    const slotsByDate = new Map();
    for (const s of state.slots || []) {
      if (!s?.date) continue;
      slotsByDate.set(s.date, (slotsByDate.get(s.date) || 0) + 1);
    }
    const assignments = state.settings?.dayAssignments || {};
    const overrides = state.settings?.dayOverrides || {};

    const targets = [];
    const cursor = new Date();
    for (let i = 0; i < 30; i++) {
      const key = formatYMD(cursor);
      const empty = (slotsByDate.get(key) || 0) === 0
        && !assignments[key]
        && !overrides[key];
      if (empty) {
        const dow = cursor.getDay(); // 0=Sun..6=Sat
        const wheel = (dow === 0 || dow === 6) ? weekend : workday;
        targets.push({ date: key, wheelId: wheel.id });
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    if (targets.length === 0) return;
    seededRef.current = true;
    (async () => {
      try {
        for (const t of targets) {
          // eslint-disable-next-line no-await-in-loop
          await api.wheels.applyToDate(t.wheelId, t.date, { mode: 'replace' });
        }
        telemetryLog('skeleton:self-heal', {
          painted: targets.length,
          first: targets[0]?.date,
          last: targets[targets.length - 1]?.date,
        });
      } catch (err) {
        telemetryLog('skeleton:self-heal-error', { message: err?.message });
        // Allow another attempt next boot
        seededRef.current = false;
      }
    })();
  }, [state, scale, api]);

  // Carry-forward sweep: incomplete tasks scheduled for past days
  // should not silently rot. On boot, find every pending task whose
  // scheduledTime lands before today, and reschedule into the next
  // available matching slot from today onwards. The user's words —
  // "carry tasks with us when they aren't completed by scheduling
  // in the next available slot."
  const carriedRef = useRef(false);
  useEffect(() => {
    if (carriedRef.current) return;
    if (state.isLoading || !state.isInitialized) return;
    // Wait until the skeleton self-heal has settled — running both in
    // the same tick races on settings updates.
    if (!seededRef.current) return;

    const now = new Date();
    const todayKey = formatYMD(now);
    const overdue = (state.tasks || []).filter(t => {
      if (!t || t.status === 'completed' || t.status === 'cancelled') return false;
      if (!t.scheduledTime) return false;
      const d = new Date(t.scheduledTime);
      if (Number.isNaN(d.getTime())) return false;
      const dayKey = formatYMD(d);
      // Past calendar day, OR earlier today and the scheduled window already ended.
      if (dayKey < todayKey) return true;
      if (dayKey === todayKey) {
        const dur = typeof t.duration === 'number' ? t.duration : 30;
        const end = d.getTime() + dur * 60 * 1000;
        return end < now.getTime();
      }
      return false;
    });

    if (overdue.length === 0) {
      carriedRef.current = true;
      return;
    }
    carriedRef.current = true;

    (async () => {
      let moved = 0;
      for (const t of overdue) {
        const target = findScheduleTarget({
          taskType: t.primaryType || t.taskType,
          duration: t.duration || 30,
          state,
          preferDate: todayKey,
        });
        if (!target) continue; // No fit in next 60 days; leave as-is
        let slotId = target.slot?.id || null;
        if (target.kind === 'rhythm') {
          const created = await api.slots.add(target.slotShape);
          slotId = created.id;
        }
        const d = new Date(`${target.date}T00:00:00`);
        d.setHours(Math.floor(target.startMin / 60), target.startMin % 60, 0, 0);
        const iso = d.toISOString();
        // eslint-disable-next-line no-await-in-loop
        await api.tasks.update(t.id || t.key, {
          scheduledTime: iso,
          scheduledFor: iso,
          scheduledSlotId: slotId,
          metadata: { ...(t.metadata || {}), carriedForwardAt: new Date().toISOString() },
        });
        moved++;
      }
      if (moved > 0) {
        telemetryLog('carry-forward', { moved, total: overdue.length });
      }
    })();
  }, [state, api]);

  // Paper backdrop
  useEffect(() => {
    document.body.classList.add('tm-body');
    const rootApp = document.getElementById('tm-root-frame');
    if (rootApp) rootApp.classList.add('tm-paper');
  }, []);

  useTaskNotifications({
    tasks: state.tasks || [],
    enabled: !!ui.notifications,
    lookAheadMin: 5,
  });

  useKeyboardShortcuts({
    goToDashboard: () => setScale('day'),
    goToPlan: () => setScale('week'),
    goToTodos: () => setScale('block'),
    newTask: () => { quickCaptureRef.current?.focus?.(); },
    search: () => { searchRef.current?.focus?.(); },
    cancel: () => {
      setSettingsOpen(false);
      setShortcutsOpen(false);
      setWheelsPanelOpen(false);
      setEditingTaskId(null);
    },
    showHelp: () => setShortcutsOpen(true),
  });

  const setUIField = (k, v) => {
    telemetryLog('ui:set', { [k]: v });
    setUI(prev => ({ ...prev, [k]: v }));
  };

  const handleToggle = (id) => {
    telemetryLog('task:toggle', { id });
    return api.tasks.toggleComplete(id);
  };
  const handleDelete = (id) => {
    telemetryLog('task:delete', { id });
    return api.tasks.remove(id);
  };
  const handleEdit = (id) => {
    telemetryLog('task:edit-open', { id });
    setEditingTaskId(prev => (prev === id ? null : id));
  };
  const handleSaveEdit = (id, updates) => {
    telemetryLog('task:edit-save', { id, keys: Object.keys(updates || {}) });
    api.tasks.update(id, updates);
    setEditingTaskId(null);
  };
  const viewKey = formatYMD(selectedDate);
  const selectedSlot = selectedSlotId
    ? (state.slots || []).find(s => s.id === selectedSlotId) || null
    : null;
  const selectedSlotIsForDay = !!(selectedSlot && selectedSlot.date === viewKey);

  // Navigating to a different day should clear a stale section pick rather
  // than silently routing new tasks into a slot on another date.
  useEffect(() => {
    if (!selectedSlotId) return;
    const slot = (state.slots || []).find(s => s.id === selectedSlotId);
    if (!slot || slot.date !== viewKey) setSelectedSlotId(null);
  }, [viewKey, selectedSlotId, state.slots]);

  // Quick-capture: text in, unscheduled task out. No type, no duration,
  // no block. Lands in the inbox; the user drags it into a slot when
  // they sit down to plan. This is the "right now is not the time to
  // plan" valve — the whole point of capture is to be cheaper than
  // forgetting.
  const handleQuickCapture = (text) => {
    const t = (text || '').trim();
    if (!t) return;
    telemetryLog('task:add', { text: t.slice(0, 40), kind: 'inbox' });
    return api.tasks.add({
      text: t,
      status: 'pending',
      priority: 'medium',
      recurrence: { frequency: 'none', interval: 1, daysOfWeek: [], dayOfMonth: null, endDate: null, occurrences: null },
      // Bypass the reducer's auto-scheduler — the whole point of the
      // inbox is unscheduled, so the user can drag it where they want.
      // The flag is consumed by ADD_TASK in AppContext and discarded.
      autoSchedule: false,
    });
  };

  const handleAddTask = async (data) => {
    const duration = data?.duration || 30;
    // Scheduler walks today → tomorrow → ... up to 60 days, looking for
    // a real fit. If today's preferred block is full, the task rolls
    // forward to the next matching slot — concrete or rhythm-projected.
    const target = findScheduleTarget({
      taskType: data?.primaryType,
      duration,
      state,
      preferDate: viewKey,
      preferSlotId: selectedSlot && selectedSlotIsForDay ? selectedSlot.id : null,
    });

    let payload = data;

    if (target) {
      let slotId;

      if (target.kind === 'rhythm') {
        // Rhythm projection — materialize the slot first so the task
        // can attach by id. Once materialized it's a real slot like
        // any other; the rhythm doesn't "own" it after this.
        const created = await api.slots.add(target.slotShape);
        slotId = created.id;
        telemetryLog('rhythm:materialized-on-rollover', { rhythmId: target.rhythm.id, date: target.date });
      } else {
        slotId = target.slot.id;
      }

      const d = new Date(`${target.date}T00:00:00`);
      d.setHours(Math.floor(target.startMin / 60), target.startMin % 60, 0, 0);
      const iso = d.toISOString();
      payload = {
        ...data,
        scheduledSlotId: slotId,
        scheduledTime: iso,
        scheduledFor: iso,
      };

      // Rollover feedback: a sticky breadcrumb (not a 4s toast) so
      // the task is *visible* after it auto-scheduled forward. The
      // user explicitly said "tasks shouldn't just go disappearing
      // once they are added" — ComingUp surfaces this with a click
      // to follow.
      if (target.date !== viewKey) {
        setRecentRollover({
          text: data?.text || 'task',
          dayKey: target.date,
          scheduledTime: iso,
          at: Date.now(),
        });
      }
    } else {
      // No fit anywhere in the next 60 days. Give it a date but no slot
      // so it shows up as a task without a home — the user can drag it
      // into a slot manually.
      const d = new Date(`${viewKey}T09:00:00`);
      const iso = d.toISOString();
      payload = { ...data, scheduledTime: iso, scheduledFor: iso };
    }

    telemetryLog('task:add', {
      text: (payload?.text || '').slice(0, 40),
      type: payload?.primaryType,
      duration: payload?.duration,
      priority: payload?.priority,
      slotId: payload?.scheduledSlotId || null,
      rolledOver: target?.date !== viewKey,
      kind: target?.kind || 'unscheduled',
    });
    emit(EVENTS.TASK_ADDED, { slotId: payload?.scheduledSlotId || null });
    return api.tasks.add(payload);
  };

  // Recent-rollover breadcrumb. When the auto-scheduler pushes a task
  // forward, ComingUp highlights it as "just rolled forward" with a
  // click-to-jump. We auto-clear after 60s so a stale breadcrumb
  // doesn't linger across sessions, but it's far longer than a toast.
  const [recentRollover, setRecentRollover] = useState(null);
  const rolloverTimerRef = useRef(null);
  useEffect(() => {
    if (!recentRollover) return;
    if (rolloverTimerRef.current) clearTimeout(rolloverTimerRef.current);
    rolloverTimerRef.current = setTimeout(() => setRecentRollover(null), 60000);
  }, [recentRollover]);
  useEffect(() => () => {
    if (rolloverTimerRef.current) clearTimeout(rolloverTimerRef.current);
  }, []);

  const handleSeriesComplete = (id) => api.tasks.completeSeries(id);
  const handleSeriesDelete = (id) => {
    const segs = api.tasks.seriesOf(id);
    const count = segs.length;
    if (count > 1 && !window.confirm(`delete all ${count} parts of this task?`)) return;
    api.tasks.removeSeries(id);
  };
  const handleSeriesBump = (id, days) => api.tasks.bumpSeries(id, days);

  // Drag a task from one slot to another (within or across days). The
  // task lands at the next free minute of the destination slot, picking
  // the earliest start time after any existing tasks. If the slot is
  // already saturated we fall back to slot-start so the task is at
  // least visible — the rollover logic only kicks in for fresh adds.
  const handleTaskMoveToSlot = async (taskId, slotId) => {
    if (!taskId || !slotId) return;
    const slot = (state.slots || []).find(s => s.id === slotId);
    const task = (state.tasks || []).find(t => t.id === taskId);
    if (!slot || !task) return;
    if (task.scheduledSlotId === slotId) return; // no-op

    const [sh, sm] = (slot.startTime || '09:00').split(':').map(Number);
    const [eh, em] = (slot.endTime || '17:00').split(':').map(Number);
    const slotStartMin = (sh || 0) * 60 + (sm || 0);
    let slotEndMin = (eh || 0) * 60 + (em || 0);
    if (slotEndMin <= slotStartMin) slotEndMin += 24 * 60;
    const duration = task.duration || 30;

    const existing = (state.tasks || []).filter(t => {
      if (t.id === taskId) return false;
      if (t.status === 'cancelled') return false;
      if (t.scheduledSlotId === slotId) return true;
      if (!t.scheduledTime) return false;
      const ts = new Date(t.scheduledTime);
      if (formatYMD(ts) !== slot.date) return false;
      const m = ts.getHours() * 60 + ts.getMinutes();
      return m >= slotStartMin && m < slotEndMin;
    });

    let nextMin = slotStartMin;
    for (const t of existing) {
      const ts = new Date(t.scheduledTime);
      const start = ts.getHours() * 60 + ts.getMinutes();
      const end = start + (t.duration || 30);
      if (end > nextMin) nextMin = end;
    }
    if (nextMin + duration > slotEndMin) nextMin = slotStartMin; // saturated → drop at top

    const d = new Date(`${slot.date}T00:00:00`);
    d.setHours(Math.floor(nextMin / 60), nextMin % 60, 0, 0);
    const iso = d.toISOString();

    await api.tasks.update(taskId, {
      scheduledSlotId: slotId,
      scheduledTime: iso,
      scheduledFor: iso,
    });
    telemetryLog('task:drag-move', { id: taskId, toSlot: slotId, date: slot.date });
  };

  const rowHandlers = {
    onToggle: handleToggle,
    onDelete: handleDelete,
    onEdit: handleEdit,
    onSaveEdit: handleSaveEdit,
    onSeriesComplete: handleSeriesComplete,
    onSeriesDelete: handleSeriesDelete,
    onSeriesBump: handleSeriesBump,
    onTaskMoveTo: handleTaskMoveToSlot,
    editingTaskId,
  };

  const handleQuickStart = async (template) => {
    if (!template) {
      telemetryLog('quickstart:custom');
      setScale('day');
      return;
    }
    telemetryLog('quickstart:pick', { name: template.name });
    try {
      const existing = (state.settings?.wheels || []).find(w => w.id === template.id);
      const wheelId = existing?.id
        || (await api.wheels.add({
          id: template.id,
          name: template.name,
          color: template.color,
          blocks: template.blocks,
        })).id;
      const today = formatYMD(new Date());
      await api.wheels.applyToDate(wheelId, today);
      telemetryLog('quickstart:applied', { wheelId, date: today });
    } catch (err) {
      telemetryLog('quickstart:error', { message: err?.message });
    }
  };

  const filteredState = useMemo(() => {
    if (!search.trim()) return state;
    const q = search.trim().toLowerCase();
    const matchTask = (t) => {
      const text = (t.text || t.title || '').toLowerCase();
      const desc = (t.description || '').toLowerCase();
      return text.includes(q) || desc.includes(q);
    };
    return { ...state, tasks: (state.tasks || []).filter(matchTask) };
  }, [state, search]);

  const filteredDerived = useMemo(() => {
    if (!search.trim()) return derived;
    const ids = new Set((filteredState.tasks || []).map(t => t.id || t.key));
    const keep = (t) => ids.has(t.id || t.key);
    const todayKeep = (entry) => keep(entry.task);
    return {
      ...derived,
      todayTasks: (derived.todayTasks || []).filter(todayKeep),
      upcoming: (derived.upcoming || []).filter(keep),
      pushed: (derived.pushed || []).filter(keep),
      backlog: (derived.backlog || []).filter(keep),
      currentSlot: derived.currentSlot
        ? { ...derived.currentSlot, tasks: (derived.currentSlot.tasks || []).filter(keep) }
        : derived.currentSlot,
      nextSlot: derived.nextSlot
        ? { ...derived.nextSlot, tasks: (derived.nextSlot.tasks || []).filter(keep) }
        : derived.nextSlot,
    };
  }, [derived, search, filteredState.tasks]);

  const hasSlots = (state.slots?.length || 0) > 0;
  const hasTasks = (state.tasks?.length || 0) > 0;
  const showQuickStart = !hasSlots;

  const dateStep = scale === 'week' ? 7 : 1;
  const dateNavHidden = CALENDAR_SCOPES.has(scale);
  const shiftDate = (dir) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + dir * dateStep);
    setSelectedDate(next);
    telemetryLog('ui:date', { date: formatYMD(next), scale });
  };
  const resetDate = () => {
    setSelectedDate(new Date());
    telemetryLog('ui:date:today');
  };

  const { todayDone, todayTotal, pushed } = derived.stats;

  const activeWheelId = derived.dayAssignments?.[viewKey] || null;
  const userWheels = state.settings?.wheels || [];
  const activeWheel = activeWheelId
    ? (userWheels.find(w => w.id === activeWheelId)
       || FAMOUS_WHEELS.find(w => w.id === activeWheelId)
       || null)
    : null;

  const applyWheelToDay = async (wheelId) => {
    if (!wheelId) {
      await api.days.unassign(viewKey);
      return;
    }
    const existing = userWheels.find(w => w.id === wheelId);
    let actualId = existing?.id;
    if (!actualId) {
      const tmpl = [...STARTER_WHEELS, ...ARCHETYPE_WHEELS, ...FAMOUS_WHEELS].find(w => w.id === wheelId);
      if (!tmpl) return;
      const added = await api.wheels.add({
        id: tmpl.id, name: tmpl.name, color: tmpl.color, blocks: tmpl.blocks,
      });
      actualId = added.id;
    }
    await api.wheels.applyToDate(actualId, viewKey, { mode: 'replace' });
    telemetryLog('rail:applied', { wheelId, date: viewKey });
    emit(EVENTS.WHEEL_APPLIED, { wheelId, date: viewKey });
  };

  // Paint a wheel onto a single arbitrary date — used when a chip is
  // dragged onto a calendar cell. Mirrors applyWheelToDay but takes the
  // date explicitly instead of using viewKey.
  const paintWheelOnDate = async (wheelId, dateKey) => {
    if (!wheelId || !dateKey) return;
    const existing = userWheels.find(w => w.id === wheelId);
    let actualId = existing?.id;
    if (!actualId) {
      const tmpl = [...STARTER_WHEELS, ...ARCHETYPE_WHEELS, ...FAMOUS_WHEELS].find(w => w.id === wheelId);
      if (!tmpl) return;
      const added = await api.wheels.add({
        id: tmpl.id, name: tmpl.name, color: tmpl.color, blocks: tmpl.blocks,
      });
      actualId = added.id;
    }
    await api.wheels.applyToDate(actualId, dateKey, { mode: 'replace' });
    telemetryLog('drag-paint:applied', { wheelId, date: dateKey });
    emit(EVENTS.WHEEL_APPLIED, { wheelId, date: dateKey });
  };

  // Paint a wheel onto an explicit list of dates — used by the
  // multi-select flow where the user picks discrete (often
  // non-contiguous) days and then opens the picker.
  const paintWheelOverDays = async (wheelId, dates) => {
    if (!wheelId || !Array.isArray(dates) || dates.length === 0) return;
    const existing = userWheels.find(w => w.id === wheelId);
    let actualId = existing?.id;
    if (!actualId) {
      const tmpl = [...STARTER_WHEELS, ...ARCHETYPE_WHEELS, ...FAMOUS_WHEELS].find(w => w.id === wheelId);
      if (!tmpl) return;
      const added = await api.wheels.add({
        id: tmpl.id, name: tmpl.name, color: tmpl.color, blocks: tmpl.blocks,
      });
      actualId = added.id;
    }
    for (const dateKey of dates) {
      // eslint-disable-next-line no-await-in-loop
      await api.wheels.applyToDate(actualId, dateKey, { mode: 'replace' });
    }
    telemetryLog('multi-paint:applied', { wheelId, count: dates.length });
    emit(EVENTS.WHEEL_APPLIED, { wheelId, count: dates.length });
  };

  // "Save selection as rhythm" from a calendar view. Open the focused
  // modal so the user can name / color / time-of-day the new rhythm.
  const saveDaysAsRhythm = (dates) => {
    if (!Array.isArray(dates) || dates.length === 0) return;
    setSaveDaysAsRhythmModal(dates);
  };

  // Paint a wheel onto a closed date range with no day-of-week filter —
  // used by the lasso flow where the user has already picked their dates
  // visually. Honors the picker callback contract by taking wheelId.
  const paintWheelOverRange = async (wheelId, startDate, endDate) => {
    if (!wheelId || !startDate || !endDate) return;
    const existing = userWheels.find(w => w.id === wheelId);
    let actualId = existing?.id;
    if (!actualId) {
      const tmpl = [...STARTER_WHEELS, ...ARCHETYPE_WHEELS, ...FAMOUS_WHEELS].find(w => w.id === wheelId);
      if (!tmpl) return;
      const added = await api.wheels.add({
        id: tmpl.id, name: tmpl.name, color: tmpl.color, blocks: tmpl.blocks,
      });
      actualId = added.id;
    }
    const result = await api.wheels.applyToRange(actualId, startDate, endDate, { mode: 'replace' });
    telemetryLog('lasso-paint:applied', { wheelId, count: result?.painted?.length || 0, startDate, endDate });
    emit(EVENTS.WHEEL_APPLIED, { wheelId, startDate, endDate });
  };

  const paintWheelAcrossRange = async ({ startDate, endDate, weekdaysOnly, weekendsOnly, customDow, mode }) => {
    if (!painterTarget?.wheel) return;
    const target = painterTarget.wheel;
    // Make sure the wheel is in the user's library so applyToRange can
    // resolve it by id. Famous-only wheels get cloned in here on first
    // use — same approach the rail-click path uses.
    const existing = userWheels.find(w => w.id === target.id);
    let actualId = existing?.id;
    if (!actualId) {
      const added = await api.wheels.add({
        id: target.id, name: target.name, color: target.color, blocks: target.blocks,
      });
      actualId = added.id;
    }

    if (customDow && customDow.length > 0 && customDow.length < 7) {
      // applyToRange only knows about weekdays/weekends. For an arbitrary
      // weekday set we walk the dates ourselves and call applyToDate on
      // the matching ones.
      const set = new Set(customDow);
      const out = [];
      const cur = new Date(`${startDate}T00:00:00`);
      const end = new Date(`${endDate}T00:00:00`);
      while (cur.getTime() <= end.getTime()) {
        const dow = (cur.getDay() + 6) % 7; // 0=Mon..6=Sun
        if (set.has(dow)) {
          const m = cur.getMonth() + 1;
          const dd = cur.getDate();
          const key = `${cur.getFullYear()}-${m < 10 ? '0' + m : m}-${dd < 10 ? '0' + dd : dd}`;
          out.push(key);
        }
        cur.setDate(cur.getDate() + 1);
      }
      for (const dateKey of out) {
        // eslint-disable-next-line no-await-in-loop
        await api.wheels.applyToDate(actualId, dateKey, { mode });
      }
      telemetryLog('painter:applied', { wheelId: actualId, count: out.length, customDow });
    } else {
      const result = await api.wheels.applyToRange(actualId, startDate, endDate, {
        weekdaysOnly,
        weekendsOnly,
        mode,
      });
      telemetryLog('painter:applied', {
        wheelId: actualId,
        count: result?.painted?.length || 0,
        weekdaysOnly,
        weekendsOnly,
      });
    }

    setPainterTarget(null);
  };

  return (
    <div id="tm-root-frame" className="tm-root tm-paper">
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 18,
          paddingTop: 24,
          paddingBottom: 14,
          borderBottom: '1px solid var(--rule-soft)',
        }}
      >
        <button
          type="button"
          className={`tm-active-chip${activeWheel ? '' : ' tm-active-chip-empty'}`}
          onClick={() => setPickerOpen(true)}
          title={activeWheel ? `current schedule — click to switch` : 'no schedule on this day — click to pick one'}
          data-onboard="wheel-picker"
        >
          <span
            className="tm-active-chip-dot"
            style={{ background: activeWheel?.color || 'transparent', border: activeWheel ? 'none' : '1.5px dashed var(--ink-mute)' }}
            aria-hidden
          />
          {activeWheel ? activeWheel.name : 'pick a schedule'}
          <span aria-hidden style={{ fontSize: 14, color: 'var(--ink-mute)', marginLeft: 2 }}>▾</span>
        </button>

        <div className="tm-seg" style={{ marginLeft: 4 }}>
          {SCALES.map(s => (
            <button
              key={s}
              className={scale === s ? 'tm-on' : ''}
              onClick={() => setScale(s)}
            >
              {s}
            </button>
          ))}
        </div>

        {!dateNavHidden && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button className="tm-btn tm-sm" onClick={() => shiftDate(-1)} aria-label="previous">‹</button>
            <span
              className="tm-mono tm-md"
              style={{ minWidth: 120, textAlign: 'center', color: 'var(--ink)' }}
              title={formatYMD(selectedDate)}
            >
              {formatDateLabel(selectedDate)}
            </span>
            <button className="tm-btn tm-sm" onClick={() => shiftDate(1)} aria-label="next">›</button>
            <button className="tm-btn tm-sm" onClick={resetDate} title="jump to today">today</button>
          </div>
        )}

        {hasTasks && (
          <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
            {todayDone}/{todayTotal} today · {pushed} pushed
          </span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {hasTasks && (
            <input
              ref={searchRef}
              className="tm-composer-input"
              placeholder="search…  /"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setSearch(''); }}
              style={{ width: 180, fontSize: 14, padding: '4px 8px' }}
              aria-label="search"
            />
          )}
          {/* The `⋯` overflow menu (manage wheels, export .ics, replay
              tour, settings) was consolidated into the account panel —
              click the avatar in the header to access all of those.
              One surface is easier to scan than two. */}
          <button
            data-onboard="account"
            className="tm-btn tm-sm"
            onClick={() => setAccountOpen(true)}
            title={isLoggedIn ? `signed in as @${auth.profile.username}` : 'guest — click to create an account'}
            aria-label="account"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              paddingLeft: 4,
              paddingRight: 10,
            }}
          >
            {auth?.profile?.avatarUrl ? (
              <img
                src={auth.profile.avatarUrl}
                alt=""
                width={22}
                height={22}
                style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <span
                aria-hidden
                style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: isLoggedIn ? 'var(--orange)' : 'var(--ink-mute)',
                  color: 'var(--paper)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Inter, system-ui, sans-serif', fontSize: 16, fontWeight: 600, lineHeight: 1,
                }}
              >
                {accountInitial}
              </span>
            )}
            {isLoggedIn ? (auth.profile.firstName || auth.profile.username) : 'guest'}
          </button>
        </div>
      </header>

      {/* Quick capture is the always-on entry point. The story is
          "capture now, plan later" — anything you type here lands in
          the inbox unscheduled until you drag it onto a block. Hotkey
          `n` focuses this from anywhere. */}
      <QuickCapture
        ref={quickCaptureRef}
        onCapture={handleQuickCapture}
        inboxCount={(filteredDerived.backlog || []).length}
      />

      {/* Day breadcrumb strip — yesterday → +5 days. Each chip shows
          the day's task count and is click-to-jump, so a task that
          rolled forward never feels lost: the user sees "tomorrow ·
          3 tasks" and one click is there. */}
      <DayStrip
        selectedDate={selectedDate}
        tasks={state.tasks || []}
        onPickDate={(d) => {
          setSelectedDate(d);
          telemetryLog('ui:day-strip', { date: formatYMD(d) });
        }}
      />

      {/* Discovery strip — three always-visible CTAs for paths,
          packs, and famous routines. Per the user note: "i don't
          really see any of your WAVE changes... make them more
          impactful." So the entry points to all four waves now sit
          right above the schedule, not buried in a drawer. */}
      {scale === 'day' && (
        <DiscoveryStrip
          onOpenPaths={() => setPathPickerOpen(true)}
          onOpenPacks={() => setPackPickerOpen(true)}
          onOpenRoutines={() => {
            // Make sure the spotlight drawer is expanded, then scroll to it.
            try { localStorage.setItem('taskometer.famousSpotlight.collapsed', '0'); } catch (_) {}
            const el = document.querySelector('.tm-dash-left');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            else setPickerOpen(true); // narrow viewport — fall back to the picker modal
          }}
        />
      )}

      {/* When rhythms fire on the selected day but haven't been
          materialized as concrete slots yet, surface them so the user
          can apply with one click. This is the bridge that makes the
          year canvas feel "real" in the day view. */}
      <RhythmsForToday
        dateKey={viewKey}
        existingSlots={state.slots || []}
        api={api}
      />

      {showQuickStart && (
        <QuickStart onPick={handleQuickStart} />
      )}

      {/* Heavy composer removed. There is now one task input — the
          QuickCapture above. To plan a captured task into a specific
          block, drag it from the Inbox onto a wedge or onto the
          Right Now drop zone. One input, one mental model. */}

      {scale === 'block' && (
        <BlockBoard
          tasks={filteredState.tasks || []}
          slots={state.slots || []}
          date={selectedDate}
          api={api}
          rowHandlers={rowHandlers}
        />
      )}

      {scale === 'day' && (
        <div className="tm-dash">
          {/* Left drawer — discovery surfaces tucked to the side so
              the user's own schedule stays the centerpiece. The user
              said: "the main part is my schedule, perhaps they can be
              drawers on the side that I can put away if I choose." */}
          <aside className="tm-dash-left">
            <FamousSpotlight
              onApply={async (wheelId, slice) => {
                const partial = slice && (slice.from || slice.to);
                if (partial) {
                  const existing = userWheels.find(w => w.id === wheelId);
                  let actualId = existing?.id;
                  if (!actualId) {
                    const tmpl = [...STARTER_WHEELS, ...ARCHETYPE_WHEELS, ...FAMOUS_WHEELS].find(w => w.id === wheelId);
                    if (!tmpl) return;
                    const added = await api.wheels.add({
                      id: tmpl.id, name: tmpl.name, color: tmpl.color, blocks: tmpl.blocks,
                    });
                    actualId = added.id;
                  }
                  await api.wheels.applyToDate(actualId, viewKey, {
                    mode: 'replace',
                    from: slice.from,
                    to: slice.to,
                  });
                  telemetryLog('ui:famous-spotlight-slice', { wheelId, slice: slice.id, date: viewKey });
                  emit(EVENTS.WHEEL_APPLIED, { wheelId, date: viewKey, slice: slice.id });
                } else {
                  await applyWheelToDay(wheelId);
                  telemetryLog('ui:famous-spotlight-apply', { wheelId, date: viewKey });
                }
              }}
              onSeeAll={() => setPickerOpen(true)}
            />
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: '12px 14px',
                border: '1.5px dashed var(--rule)',
                borderRadius: 12,
                background: 'var(--paper)',
              }}
            >
              <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 6 }}>
                Discover
              </div>
              <button
                type="button"
                className="tm-btn tm-sm tm-ghost"
                onClick={() => setPathPickerOpen(true)}
                title="adopt a path — schedule + pack + duration applied as one move"
                style={{ color: 'var(--orange)', fontWeight: 600, alignSelf: 'flex-start' }}
              >
                paths ★ →
              </button>
              <button
                type="button"
                className="tm-btn tm-sm tm-ghost"
                onClick={() => setPackPickerOpen(true)}
                title="add a starter pack of tasks (chores, morning routine, sprint week, etc.)"
                style={{ alignSelf: 'flex-start' }}
              >
                task packs →
              </button>
              <button
                type="button"
                className="tm-btn tm-sm tm-ghost"
                onClick={() => setWheelsPanelOpen(true)}
                title="open your schedule library — design and save reusable day schedules"
                style={{ alignSelf: 'flex-start' }}
              >
                schedule library →
              </button>
            </div>
          </aside>
          <div className="tm-dash-main">
            <WheelView
              selectedDate={selectedDate}
              wedges={derived.wedges}
              nowTask={derived.nowTask}
              upcoming={filteredDerived.upcoming}
              pushed={filteredDerived.pushed}
              slots={state.slots || []}
              taskTypes={state.taskTypes || []}
              todayTasks={filteredDerived.todayTasks}
              wheels={derived.wheels}
              dayAssignments={derived.dayAssignments}
              dayOverrides={derived.dayOverrides}
              resolveDay={derived.resolveDay}
              api={api}
              rowHandlers={rowHandlers}
              onNavigate={() => {}}
              onOpenWheels={() => setWheelsPanelOpen(true)}
              selectedSlotId={selectedSlotId}
              onSelectWedge={(slot) => {
                setSelectedSlotId(slot?.id || null);
                if (slot?.slotType) setSelectedType(slot.slotType);
                if (slot) emit(EVENTS.SLOT_SELECTED, { slotId: slot.id });
              }}
            />
            <DailyWrap
              selectedDate={selectedDate}
              slots={state.slots || []}
              tasks={state.tasks || []}
              taskTypes={state.taskTypes || []}
            />
          </div>
          <aside className="tm-dash-side">
            <RightNow
              currentSlot={filteredDerived.currentSlot?.slot || null}
              currentTasks={filteredDerived.currentSlot?.tasks || []}
              nextSlot={filteredDerived.nextSlot?.slot || null}
              hoursLeft={hoursLeftToday(state.slots || [], viewKey, new Date())}
              onMoveTaskHere={handleTaskMoveToSlot}
              onToggle={handleToggle}
            />
            <InboxPanel
              tasks={filteredDerived.backlog || []}
              rowHandlers={{ onToggle: handleToggle, onDelete: handleDelete }}
              onScheduleToDate={(taskId, dateKey) => {
                // Schedule a captured task to any day at 9am — the
                // user can drag onto a specific wedge afterwards if
                // they want a precise block.
                const [y, m, d] = dateKey.split('-').map(Number);
                const dt = new Date(y, (m || 1) - 1, d || 1, 9, 0, 0, 0);
                api.tasks.reschedule(taskId, dt.toISOString(), null);
                telemetryLog('ui:inbox-schedule-to-date', { date: dateKey });
              }}
            />
            <ComingUp
              tasks={state.tasks || []}
              selectedDate={selectedDate}
              recentRollover={recentRollover}
              onJumpToDate={(d) => {
                setSelectedDate(d);
                setRecentRollover(null);
                telemetryLog('ui:coming-up-jump', { date: formatYMD(d) });
              }}
              onReschedule={(taskId, iso) => {
                api.tasks.reschedule(taskId, iso, null);
                telemetryLog('ui:coming-up-reschedule', { id: taskId });
              }}
            />
            <Snoozed
              tasks={state.tasks || []}
              onReschedule={(taskId, iso) => {
                api.tasks.reschedule(taskId, iso, null);
                telemetryLog('ui:snoozed-reschedule', { id: taskId });
              }}
              onComplete={(taskId) => api.tasks.toggleComplete(taskId)}
              onPushTomorrow={(taskId, when) => {
                const base = when || new Date();
                const next = new Date(base.getTime() + 24 * 60 * 60 * 1000);
                api.tasks.reschedule(taskId, next.toISOString(), null);
              }}
              onDelete={(taskId) => api.tasks.remove(taskId)}
            />
            <SleepPSA slots={state.slots || []} dateKey={viewKey} />
          </aside>
        </div>
      )}

      {scale === 'week' && (
        <WeekCanvas
          selectedDate={selectedDate}
          slots={state.slots || []}
          tasks={filteredState.tasks || []}
          taskTypes={state.taskTypes || []}
          wheels={userWheels}
          dayAssignments={derived.dayAssignments}
          dayOverrides={derived.dayOverrides}
          onPickDate={(d) => {
            telemetryLog('ui:week-pick-day', { date: formatYMD(d) });
            setSelectedDate(d);
            setScale('day');
          }}
          onPaintRange={async ({ wheelId, startKey, endKey, weekdaysOnly, weekendsOnly }) => {
            if (!wheelId) return;
            const result = await api.wheels.applyToRange(wheelId, startKey, endKey, {
              weekdaysOnly: !!weekdaysOnly,
              weekendsOnly: !!weekendsOnly,
              mode: 'replace',
            });
            telemetryLog('ui:week-paint', {
              wheelId,
              count: result?.painted?.length || 0,
              weekdaysOnly: !!weekdaysOnly,
              weekendsOnly: !!weekendsOnly,
            });
            emit(EVENTS.WHEEL_APPLIED, { wheelId });
          }}
        />
      )}

      {scale === 'month' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <TimeBreakdown
            slots={state.slots || []}
            tasks={filteredState.tasks || []}
            taskTypes={state.taskTypes || []}
            range={monthRangeFor(selectedDate)}
            title="Where the month goes"
            subtitle={`${selectedDate.toLocaleDateString('en', { month: 'long', year: 'numeric' })} · planned hours by category`}
          />
          <MonthInsights
            selectedDate={selectedDate}
            slots={state.slots || []}
            taskTypes={state.taskTypes || []}
            onPickDate={(d) => { setSelectedDate(d); setScale('day'); }}
            onPaintDay={paintWheelOnDate}
            onPaintRange={(startDate, endDate) => {
              setPendingRange({ startDate, endDate });
              setPickerOpen(true);
            }}
            onPaintDays={(dates) => {
              if (!dates || dates.length === 0) return;
              setPendingDays(dates);
              setPickerOpen(true);
            }}
            onSaveDaysAsRhythm={saveDaysAsRhythm}
            multiSelect={multiSelect}
          />
        </div>
      )}

      {scale === 'quarter' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <TimeBreakdown
            slots={state.slots || []}
            tasks={filteredState.tasks || []}
            taskTypes={state.taskTypes || []}
            range={quarterRangeFor(selectedDate)}
            title="Where the quarter goes"
            subtitle={`${quarterLabel(selectedDate)} · planned hours by category`}
          />
          <QuarterInsights
            selectedDate={selectedDate}
            slots={state.slots || []}
            taskTypes={state.taskTypes || []}
            onPickDate={(d) => { setSelectedDate(d); setScale('day'); }}
            onPaintDay={paintWheelOnDate}
            onPaintRange={(startDate, endDate) => {
              setPendingRange({ startDate, endDate });
              setPickerOpen(true);
            }}
            onPaintDays={(dates) => {
              if (!dates || dates.length === 0) return;
              setPendingDays(dates);
              setPickerOpen(true);
            }}
            onSaveDaysAsRhythm={saveDaysAsRhythm}
            multiSelect={multiSelect}
          />
        </div>
      )}

      {scale === 'year' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <TimeBreakdown
            slots={state.slots || []}
            tasks={filteredState.tasks || []}
            taskTypes={state.taskTypes || []}
            range={yearRangeFor(selectedDate)}
            title="Where the year goes"
            subtitle={`${selectedDate.getFullYear()} · planned hours by category`}
          />
          <YearInsights
            selectedDate={selectedDate}
            slots={state.slots || []}
            taskTypes={state.taskTypes || []}
            onPickDate={(d) => { setSelectedDate(d); setScale('day'); }}
            onPaintDay={paintWheelOnDate}
            onPaintRange={(startDate, endDate) => {
              setPendingRange({ startDate, endDate });
              setPickerOpen(true);
            }}
            onPaintDays={(dates) => {
              if (!dates || dates.length === 0) return;
              setPendingDays(dates);
              setPickerOpen(true);
            }}
            onSaveDaysAsRhythm={saveDaysAsRhythm}
            multiSelect={multiSelect}
          />
        </div>
      )}

      {scale === 'life' && (
        <LifeCanvas
          slots={state.slots || []}
          tasks={filteredState.tasks || []}
          taskTypes={state.taskTypes || []}
          onPickDate={(d) => { setSelectedDate(d); setScale('year'); }}
        />
      )}

      {pickerOpen && (
        <WheelPickerModal
          wheels={[...userWheels, ...FAMOUS_WHEELS.filter(fw => !userWheels.some(uw => uw.id === fw.id))]}
          currentWheelId={activeWheelId}
          rangeContext={pendingRange}
          paintingDays={pendingDays}
          onApply={async (wheelId) => {
            if (pendingDays && pendingDays.length > 0) {
              await paintWheelOverDays(wheelId, pendingDays);
              setPendingDays(null);
            } else if (pendingRange) {
              await paintWheelOverRange(wheelId, pendingRange.startDate, pendingRange.endDate);
              setPendingRange(null);
            } else {
              await applyWheelToDay(wheelId);
            }
            setPickerOpen(false);
          }}
          onClose={() => {
            setPickerOpen(false);
            setPendingRange(null);
            setPendingDays(null);
          }}
        />
      )}

      {saveDaysAsRhythmModal && (
        <SaveAsRhythmModal
          dates={saveDaysAsRhythmModal}
          onClose={() => setSaveDaysAsRhythmModal(null)}
          onSaved={() => {
            setSaveDaysAsRhythmModal(null);
            telemetryLog('rhythm:saved-from-selection', { count: saveDaysAsRhythmModal.length });
          }}
        />
      )}

      {painterTarget && (
        <WheelPainter
          wheel={painterTarget.wheel}
          anchorDate={selectedDate}
          onClose={() => setPainterTarget(null)}
          onApply={paintWheelAcrossRange}
        />
      )}

      {pathPickerOpen && (
        <PathPicker
          onClose={() => setPathPickerOpen(false)}
          onAdopt={async (path, wheel, pack) => {
            // 1. Make sure the wheel is in the user's library so applyToRange
            //    can address it by id (famous/archetype wheels need cloning in)
            const existing = userWheels.find(w => w.id === wheel.id);
            let actualId = existing?.id;
            if (!actualId) {
              const added = await api.wheels.add({
                id: wheel.id, name: wheel.name, color: wheel.color, blocks: wheel.blocks,
              });
              actualId = added.id;
            }
            // 2. Paint the schedule across the path's duration
            const start = new Date();
            const end = new Date();
            end.setDate(end.getDate() + (path.duration - 1));
            const startKey = formatYMD(start);
            const endKey = formatYMD(end);
            await api.wheels.applyToRange(actualId, startKey, endKey, {
              weekdaysOnly: !!path.weekdaysOnly,
              mode: 'replace',
            });
            // 3. Drop the pack's tasks straight into the inbox so the
            //    user can plan them themselves. Path adoption shouldn't
            //    surprise-schedule a bunch of tasks; the user has just
            //    committed to a structure, not a backlog.
            for (const t of pack.tasks) {
              // eslint-disable-next-line no-await-in-loop
              await api.tasks.add({
                text: t.text,
                duration: t.duration,
                primaryType: t.primaryType,
                status: 'pending',
                priority: 'medium',
                recurrence: { frequency: 'none', interval: 1, daysOfWeek: [], dayOfMonth: null, endDate: null, occurrences: null },
                autoSchedule: false,
              });
            }
            telemetryLog('path:adopted', {
              pathId: path.id,
              wheelId: actualId,
              packId: pack.id,
              days: path.duration,
              tasks: pack.tasks.length,
            });
          }}
        />
      )}

      {packPickerOpen && (
        <PackPicker
          onClose={() => setPackPickerOpen(false)}
          onAddToInbox={async (tasks) => {
            for (const t of tasks) {
              // eslint-disable-next-line no-await-in-loop
              await api.tasks.add({
                text: t.text,
                duration: t.duration,
                primaryType: t.primaryType,
                status: 'pending',
                priority: 'medium',
                recurrence: { frequency: 'none', interval: 1, daysOfWeek: [], dayOfMonth: null, endDate: null, occurrences: null },
                autoSchedule: false, // straight to inbox
              });
            }
            telemetryLog('packs:added-to-inbox', { count: tasks.length });
          }}
          onScheduleToday={async (tasks) => {
            for (const t of tasks) {
              // eslint-disable-next-line no-await-in-loop
              await api.tasks.add({
                text: t.text,
                duration: t.duration,
                primaryType: t.primaryType,
                status: 'pending',
                priority: 'medium',
                // Auto-schedule: lets the engine slot each task into a
                // matching block today (rolls forward if today's full).
              });
            }
            telemetryLog('packs:scheduled-today', { count: tasks.length });
          }}
        />
      )}

      {wheelsPanelOpen && (
        <WheelsPanel
          api={api}
          wheels={derived.wheels}
          taskTypes={state.taskTypes || []}
          onClose={() => setWheelsPanelOpen(false)}
        />
      )}

      {welcomeOpen && scale === 'day' && (
        <WelcomePopup
          onDone={() => {
            setWelcomeOpen(false);
            // Onboarding now mounts at the App level so it survives
            // route navigation. We just set the live flag here; the
            // overlay reads it on the next render.
            if (!hasSeenOnboarding()) {
              startOnboarding();
              // Force a re-render of App by dispatching a storage-like
              // event the App's pollIsLive picks up on path change.
              window.dispatchEvent(new Event('taskometer:onboarding-start'));
            }
          }}
        />
      )}

      {accountOpen && (
        <AccountPanel
          onClose={() => setAccountOpen(false)}
          onSignOut={() => { setAccountOpen(false); setWelcomeOpen(true); }}
          onCreateAccount={() => setWelcomeOpen(true)}
          onOpenSettings={() => { setAccountOpen(false); setSettingsOpen(true); }}
          onManageWheels={() => { telemetryLog('ui:wheels-open'); setWheelsPanelOpen(true); }}
          onExportIcs={() => { telemetryLog('backup:export-ics'); api.backup.exportICS(); }}
          onReplayTour={() => {
            startOnboarding();
            window.dispatchEvent(new Event('taskometer:onboarding-start'));
          }}
        />
      )}

      {shortcutsOpen && (
        <KeyboardShortcuts isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      )}

      {settingsOpen && (
        <SettingsPanel
          ui={ui}
          setUIField={setUIField}
          api={api}
          autoSchedule={state.settings?.autoSchedule !== false}
          onShowShortcuts={() => setShortcutsOpen(true)}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

// -------- subcomponents --------

function QuickStart({ onPick }) {
  // First-run picker: pick the archetype that sounds like you. Each
  // tile resolves the archetype's wheel from ARCHETYPE_WHEELS or
  // FAMOUS_WHEELS so we can show a MiniWheel preview alongside the
  // icon + name + blurb.
  const options = useMemo(() => {
    const map = new Map();
    for (const w of ARCHETYPE_WHEELS) map.set(w.id, w);
    for (const w of FAMOUS_WHEELS) if (!map.has(w.id)) map.set(w.id, w);
    return ARCHETYPES
      .map(a => ({ archetype: a, wheel: map.get(a.wheelId) }))
      .filter(x => !!x.wheel);
  }, []);

  return (
    <div className="tm-card tm-dashed" style={{ padding: '20px 22px', marginBottom: 18 }}>
      <div style={{ fontSize: 26, fontFamily: 'Inter, system-ui, sans-serif', lineHeight: 1, marginBottom: 4 }}>
        What kind of day are you?
      </div>
      <div className="tm-mono tm-md" style={{ color: 'var(--ink-mute)', marginBottom: 14 }}>
        Pick the archetype that sounds closest. We'll paint a starting day-shape for you.
        Tweak everything afterwards.
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 10,
        }}
      >
        {options.map(({ archetype, wheel }) => (
          <button
            key={archetype.id}
            type="button"
            onClick={() => onPick(wheel)}
            title={archetype.blurb}
            style={{
              all: 'unset',
              cursor: 'pointer',
              padding: '12px 14px',
              border: `1.5px solid ${archetype.color}`,
              borderRadius: 12,
              background: 'var(--paper)',
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              transition: 'background 0.12s, transform 0.08s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--paper-warm, #FAF5EC)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--paper)'; }}
          >
            <MiniWheel slots={wheel.blocks || []} size={56} thickness={7} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span aria-hidden style={{ fontSize: 18 }}>{archetype.icon}</span>
                <span style={{
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontSize: 22,
                  color: archetype.color,
                  lineHeight: 1.1,
                }}>
                  {archetype.name}
                </span>
              </div>
              <div style={{
                fontSize: 12,
                color: 'var(--ink-mute)',
                lineHeight: 1.35,
                marginTop: 2,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}>
                {archetype.blurb}
              </div>
            </div>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 14 }}>
        <button className="tm-btn tm-ghost tm-sm" onClick={() => onPick(null)}>
          build my own day from scratch →
        </button>
      </div>
    </div>
  );
}

function SlotView({ currentSlot, nextSlot, next, slots = [], api, rowHandlers }) {
  const slot = currentSlot?.slot || null;
  const tasks = currentSlot?.tasks || [];
  const upNext = nextSlot?.slot || null;
  const upNextTasks = nextSlot?.tasks || [];

  // Today's other slots become move targets. Dedupe by slotType + startTime so
  // the dropdown shows one entry per destination even when several days share
  // the same slot.
  const todayKey = formatYMD(new Date());
  const moveTargets = useMemo(() => {
    const list = (slots || []).filter(s => s?.date === todayKey);
    return list.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  }, [slots, todayKey]);

  const moveHandlers = {
    toSlot: (taskId, slotId) => {
      telemetryLog('task:move-slot', { id: taskId, slotId });
      api?.tasks?.moveToSlot?.(taskId, slotId);
    },
    toTomorrow: (task) => {
      const taskId = task.id || task.key;
      telemetryLog('task:push-tomorrow', { id: taskId });
      const base = task.scheduledTime ? new Date(task.scheduledTime) : new Date();
      if (Number.isNaN(base.getTime())) return;
      const bumped = new Date(base.getTime() + 24 * 60 * 60 * 1000);
      api?.tasks?.reschedule?.(taskId, bumped.toISOString(), null);
    },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {slot ? (
        <SlotPanel
          heading="now"
          slot={slot}
          tasks={tasks}
          emptyHint="nothing in this block yet — add a task above and it'll drop in here."
          moveTargets={moveTargets}
          moveHandlers={moveHandlers}
          rowHandlers={rowHandlers}
        />
      ) : (
        <div className="tm-card tm-dashed" style={{ padding: '18px 22px' }}>
          <div className="tm-mono tm-md" style={{ color: 'var(--ink-mute)', marginBottom: 6 }}>now</div>
          <div style={{ fontSize: 22 }}>no time block covers this moment</div>
          <div className="tm-mono tm-md" style={{ marginTop: 6, color: 'var(--ink-mute)' }}>
            {next
              ? `next up — ${next.text || 'untitled'}`
              : 'add a block from the day view and tasks will land here.'}
          </div>
        </div>
      )}

      {upNext && (
        <SlotPanel
          heading="up next"
          slot={upNext}
          tasks={upNextTasks}
          muted
          emptyHint="nothing parked here yet."
          moveTargets={moveTargets}
          moveHandlers={moveHandlers}
          rowHandlers={rowHandlers}
        />
      )}
    </div>
  );
}

function SlotPanel({ heading, slot, tasks, emptyHint, muted, moveTargets, moveHandlers, rowHandlers }) {
  const { onToggle, onDelete, onEdit } = rowHandlers || {};
  return (
    <div
      className="tm-card"
      style={{
        padding: '18px 22px',
        borderTop: `6px solid ${slot.color || 'var(--ink)'}`,
        opacity: muted ? 0.92 : 1,
      }}
    >
      <div className="tm-mono tm-md" style={{ color: 'var(--ink-mute)' }}>{heading}</div>
      <div style={{ fontSize: muted ? 22 : 28, marginTop: 2 }}>
        {slot.label || slot.slotType || 'block'}
      </div>
      <div className="tm-mono tm-md" style={{ marginTop: 4 }}>
        {slot.startTime}–{slot.endTime}
      </div>

      {tasks.length === 0 ? (
        <div className="tm-mono tm-md" style={{ marginTop: 14, color: 'var(--ink-mute)' }}>
          {emptyHint}
        </div>
      ) : (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column' }}>
          {tasks.map(t => {
            const id = t.id || t.key;
            const done = t.status === 'completed';
            const otherSlots = (moveTargets || []).filter(s => s.id !== slot.id);
            return (
              <div
                key={id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 0',
                  borderBottom: '1px solid var(--rule-soft)',
                  opacity: done ? 0.6 : 1,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 18,
                      textDecoration: done ? 'line-through' : 'none',
                    }}
                  >
                    {t.text || t.title || 'untitled'}
                  </div>
                  <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
                    est {t.duration || 30}m · {t.primaryType || t.taskType || 'task'}
                  </div>
                </div>
                {otherSlots.length > 0 && (
                  <select
                    className="tm-composer-select"
                    value=""
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      moveHandlers.toSlot(id, v);
                      e.target.value = '';
                    }}
                    title="move to another block today"
                  >
                    <option value="">move to…</option>
                    {otherSlots.map(s => (
                      <option key={s.id} value={s.id}>
                        {(s.label || s.slotType || 'block')} · {s.startTime}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  className="tm-btn tm-sm"
                  onClick={() => moveHandlers.toTomorrow(t)}
                  title="push to tomorrow (same time)"
                >
                  tmrw →
                </button>
                <button
                  className={`tm-btn tm-sm${done ? '' : ' tm-primary'}`}
                  onClick={() => onToggle?.(id)}
                >
                  {done ? 'undo' : 'done'}
                </button>
                <button className="tm-btn tm-sm" onClick={() => onEdit?.(id)}>edit</button>
                <button className="tm-btn tm-sm tm-danger" onClick={() => onDelete?.(id)}>×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WeekView({ selectedDate, slots, tasks, wheels = [], dayAssignments = {}, dayOverrides = {}, onPickDate }) {
  // Anchor the strip to the Monday of the selected week.
  const monday = new Date(selectedDate);
  const dow = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - dow);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const wheelsById = Object.fromEntries(wheels.map(w => [w.id, w]));
  const todayKey = formatYMD(new Date());

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, minmax(110px, 1fr))',
        gap: 12,
      }}
    >
      {days.map(d => {
        const key = formatYMD(d);
        const wheel = wheelsById[dayAssignments[key]] || null;
        const override = dayOverrides[key] || null;
        const daySlots = slots.filter(s => s.date === key);
        const taskCount = tasks.filter(t => {
          const st = t.scheduledTime ? new Date(t.scheduledTime) : null;
          return st && formatYMD(st) === key;
        }).length;
        const isToday = key === todayKey;
        const wkLabel = d.toLocaleDateString('en', { weekday: 'short' }).toLowerCase();
        const dayNum = d.getDate();
        return (
          <button
            key={key}
            type="button"
            onClick={() => onPickDate(d)}
            style={{
              all: 'unset',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              padding: '12px 10px',
              border: `1px ${isToday ? 'solid var(--orange)' : 'dashed var(--rule)'}`,
              borderRadius: 8,
              background: isToday ? 'var(--paper-warm)' : 'var(--paper)',
            }}
          >
            <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', letterSpacing: '.10em', textTransform: 'uppercase' }}>
              {wkLabel}
            </div>
            <div style={{ fontFamily: 'Inter', fontSize: 22, lineHeight: 1, color: isToday ? 'var(--orange)' : 'var(--ink)' }}>
              {dayNum}
            </div>
            <MiniWheel slots={daySlots} size={96} thickness={11} highlight={isToday} />
            <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', textAlign: 'center', lineHeight: 1.2 }}>
              {wheel ? wheel.name : override ? override.label || override.type : '—'}
            </div>
            <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
              {daySlots.length}b · {taskCount}t
            </div>
          </button>
        );
      })}
    </div>
  );
}

// (the Featured catch-all moved out — the rail now surfaces the
// archetype catalog from scheduleArchetypes.js as its primary lens.)

/**
 * Live preview under the composer showing where a 30-min task of the
 * currently-selected type would actually land if the user hit Add right
 * now. Reuses findScheduleTarget so the preview matches reality.
 */
function ComposerPreview({ taskType, state, preferDate, preferSlotId }) {
  const target = useMemo(() => findScheduleTarget({
    taskType,
    duration: 30,
    state,
    preferDate,
    preferSlotId,
  }), [taskType, state, preferDate, preferSlotId]);

  if (!target) {
    return (
      <div
        className="tm-mono tm-sm"
        style={{ marginTop: 6, color: 'var(--ink-mute)', fontStyle: 'italic' }}
      >
        no open block matches in the next 60 days
      </div>
    );
  }

  const onToday = target.date === preferDate;
  const dateLabel = onToday ? 'today' : formatRolloverLabel(target.date);
  const startLabel = minToHHMM(target.startMin);
  const slotName = target.kind === 'rhythm'
    ? target.rhythm?.name || 'rhythm'
    : (target.slot?.label || target.slot?.slotType || 'block');

  return (
    <div
      className="tm-mono tm-sm"
      style={{
        marginTop: 6,
        color: onToday ? 'var(--ink-mute)' : 'var(--orange)',
        fontWeight: onToday ? 400 : 600,
      }}
    >
      → lands {dateLabel} at {startLabel} · {slotName}
      {target.kind === 'rhythm' ? ' (will materialize from rhythm)' : ''}
    </div>
  );
}

function RhythmsForToday({ dateKey, existingSlots, api }) {
  // Re-fetch rhythms whenever the date changes (cheap — localStorage).
  // We can't put rhythms in state because they live outside AppContext;
  // this component effectively syncs that boundary.
  const [rhythms, setRhythms] = useState(() => listRhythms());
  const [exceptions, setExceptions] = useState(() => listExceptions());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRhythms(listRhythms());
    setExceptions(listExceptions());
  }, [dateKey]);

  // Refresh on window focus too — handles the "open year canvas in
  // another tab, add a rhythm, come back" workflow.
  useEffect(() => {
    const onFocus = () => { setRhythms(listRhythms()); setExceptions(listExceptions()); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const exception = useMemo(
    () => dateIsExcepted(dateKey, exceptions),
    [dateKey, exceptions],
  );

  const pending = useMemo(
    () => exception ? [] : pendingRhythmSlotsForDate(rhythms, existingSlots, dateKey),
    [rhythms, existingSlots, dateKey, exception],
  );

  if (exception) {
    return (
      <div
        role="status"
        style={{
          marginBottom: 18,
          padding: '10px 14px',
          border: `1.5px solid ${exception.color || 'var(--ink-mute)'}`,
          borderRadius: 10,
          background: 'rgba(0,0,0,0.04)',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 13,
          color: 'var(--ink-soft)',
        }}
      >
        <strong style={{ color: exception.color || 'var(--ink)' }}>
          {(exception.label || exception.type || 'exception').toUpperCase()}
        </strong>
        {' · '}rhythms suppressed on this day. You can still add tasks.
      </div>
    );
  }

  if (pending.length === 0) return null;

  const applyAll = async () => {
    if (busy) return;
    setBusy(true);
    try {
      for (const proj of pending) {
        // eslint-disable-next-line no-await-in-loop
        await api.slots.add({
          date: proj.date,
          startTime: proj.startTime,
          endTime: proj.endTime,
          slotType: proj.slotType,
          label: proj.label,
          color: proj.color,
        });
      }
      telemetryLog('rhythms:applied-day', { count: pending.length, date: dateKey });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        marginBottom: 18,
        padding: '12px 16px',
        border: '1.5px solid var(--orange)',
        borderRadius: 12,
        background: 'var(--paper-warm, #FAF5EC)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: 1, minWidth: 200 }}>
        <div className="tm-mono tm-sm" style={{ color: 'var(--orange)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>
          {pending.length} rhythm{pending.length === 1 ? '' : 's'} fire today
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {pending.map(p => (
            <span
              key={p._rhythmId}
              style={{
                fontSize: 12,
                padding: '2px 8px',
                borderRadius: 4,
                border: `1px solid ${p.color}`,
                background: 'var(--paper)',
                color: 'var(--ink)',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {p.startTime} {p._rhythmName}
            </span>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="tm-btn tm-primary"
        onClick={applyAll}
        disabled={busy}
      >
        {busy ? 'applying…' : `Apply ${pending.length} →`}
      </button>
    </div>
  );
}

// The day-view rail is gone. Shapes/wheels moved to a secondary screen:
// header chip swaps today's shape, the WheelsPanel modal manages the
// library, the calendar lasso paints across ranges, the WheelPickerModal
// is the "browse all" surface. Search Taskometer.jsx for `setPickerOpen`,
// `setWheelsPanelOpen`, and `setPainterTarget` if you need the entry
// points.

/**
 * Hours remaining until the start of today's sleep block (or end of
 * day if there isn't one). Used by RightNow to give "X hours left
 * today" — the user explicitly wanted "show what's left today."
 */
function hoursLeftToday(slots, dateKey, now) {
  if (!sameDayKey(now, dateKey)) return null;
  const todays = (slots || []).filter(s => s?.date === dateKey);
  if (todays.length === 0) return null;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  // Sleep slot starts after now — that's the bedtime cutoff.
  let cutoff = 24 * 60;
  for (const s of todays) {
    const isSleep = s.slotType === 'sleep' || /sleep/i.test(s.label || '');
    if (!isSleep) continue;
    const [h, m] = (s.startTime || '23:00').split(':').map(Number);
    const start = (h || 0) * 60 + (m || 0);
    if (start > nowMin && start < cutoff) cutoff = start;
  }
  const minsLeft = Math.max(0, cutoff - nowMin);
  return minsLeft / 60;
}
function sameDayKey(date, key) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const k = `${date.getFullYear()}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`;
  return k === key;
}

function monthRangeFor(date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return { startKey: formatYMD(start), endKey: formatYMD(end) };
}
function quarterRangeFor(date) {
  const y = date.getFullYear();
  const q = Math.floor(date.getMonth() / 3);
  const start = new Date(y, q * 3, 1);
  const end = new Date(y, q * 3 + 3, 0);
  return { startKey: formatYMD(start), endKey: formatYMD(end) };
}
function quarterLabel(date) {
  const q = Math.floor(date.getMonth() / 3) + 1;
  return `Q${q} ${date.getFullYear()}`;
}
function yearRangeFor(date) {
  const y = date.getFullYear();
  return { startKey: `${y}-01-01`, endKey: `${y}-12-31` };
}

function formatRolloverLabel(dateKey) {
  if (!dateKey) return '';
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cmp = new Date(date); cmp.setHours(0, 0, 0, 0);
  const diff = Math.round((cmp.getTime() - today.getTime()) / 86400000);
  if (diff === 1) return 'tomorrow';
  if (diff > 1 && diff <= 6) return date.toLocaleDateString('en', { weekday: 'long' }).toLowerCase();
  return date.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }).toLowerCase();
}

function minToHHMM(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const hLabel = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h < 12 ? 'a' : 'p';
  return m === 0 ? `${hLabel}${ampm}` : `${hLabel}:${m < 10 ? '0' + m : m}${ampm}`;
}

function formatYMD(date) {
  const m = date.getMonth() + 1;
  const day = date.getDate();
  return `${date.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

function formatDateLabel(d) {
  const wk = d.toLocaleDateString('en', { weekday: 'short' }).toLowerCase();
  const mo = d.toLocaleDateString('en', { month: 'short' }).toLowerCase();
  const day = d.getDate();
  return `${wk} · ${mo} ${day}`;
}
