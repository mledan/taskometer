import React, { useEffect, useMemo, useRef, useState } from 'react';
import WheelView, { MiniWheel } from './WheelView.jsx';
import WheelPickerModal from './WheelPickerModal.jsx';
import WheelPainter from './WheelPainter.jsx';
import CalendarView from './CalendarView.jsx';
import { WeekTimeline, MonthInsights, QuarterInsights, YearInsights } from './TimelineViews.jsx';
import DailyWrap from './DailyWrap.jsx';
import WheelsPanel from './WheelsPanel.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import { TaskComposer } from './Composers.jsx';
import WelcomePopup, { readAuth } from './WelcomePopup.jsx';
import Onboarding, { hasSeenOnboarding } from './Onboarding.jsx';
import AccountPanel from './AccountPanel.jsx';
import { useTaskometerAPI } from '../services/api';
import { STARTER_WHEELS } from '../services/api/TaskometerAPI';
import { DEFAULT_DAY_WHEEL_ID } from '../defaults/defaultSchedule';
import { FAMOUS_WHEELS } from '../defaults/famousWheels';
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

const SCALES = ['block', 'day', 'week', 'month', 'quarter', 'year'];
const CALENDAR_SCOPES = new Set(['month', 'quarter', 'year']);

const DEFAULT_UI = {
  palette: 'warm',
  rules: 'lines',
  notifications: false,
};

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
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [ui, setUI] = useState(readStoredUI);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [wheelsPanelOpen, setWheelsPanelOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(() => !readAuth());
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  // The wheel currently being painted across a range. Null = painter
  // closed. Object = { wheel } where wheel may need to be added to the
  // user's library before applyToRange can target it by ID.
  const [painterTarget, setPainterTarget] = useState(null);
  // When the user lassos days in a calendar view we open the picker in
  // "range mode" — the user picks a wheel and it paints the lassoed
  // range. Null = picker is in single-day mode (the default).
  const [pendingRange, setPendingRange] = useState(null); // { startDate, endDate } | null
  const auth = (() => {
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
  })();
  const isLoggedIn = auth?.mode === 'account';
  const accountInitial = (auth?.profile?.firstName?.[0] || auth?.profile?.username?.[0] || 'G').toUpperCase();
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState(null);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const searchRef = useRef(null);

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
  useEffect(() => {
    if (loggedReadyRef.current) return;
    if (state.isLoading || !state.isInitialized) return;
    loggedReadyRef.current = true;
    telemetryLog('app:ready', { scale, ...snapshotState(state) });

    // First-run: paint the Weekday (Typical) wheel onto today so a brand-new
    // user lands on the colorful circle with the default wheel pre-selected.
    const hasSlots = (state.slots?.length || 0) > 0;
    if (!hasSlots) {
      (async () => {
        try {
          const existing = (state.settings?.wheels || []).find(w => w.id === DEFAULT_DAY_WHEEL_ID);
          let wheelId = existing?.id;
          if (!wheelId) {
            const tmpl = STARTER_WHEELS.find(w => w.id === DEFAULT_DAY_WHEEL_ID);
            if (!tmpl) return;
            const added = await api.wheels.add({
              id: tmpl.id, name: tmpl.name, color: tmpl.color, blocks: tmpl.blocks,
            });
            wheelId = added.id;
          }
          const today = (() => {
            const d = new Date();
            const m = d.getMonth() + 1, day = d.getDate();
            return `${d.getFullYear()}-${m<10?'0'+m:m}-${day<10?'0'+day:day}`;
          })();
          await api.wheels.applyToDate(wheelId, today);
          telemetryLog('autopaint:applied', { wheelId, date: today });
        } catch (err) {
          telemetryLog('autopaint:error', { message: err?.message });
        }
      })();
    }
  }, [state, scale, api]);

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
    newTask: () => searchRef.current?.focus?.() || null,
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

  const handleAddTask = (data) => {
    let payload = data;
    const daySlots = (state.slots || [])
      .filter(s => s.date === viewKey)
      .slice()
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

    // Resolve which slot to land in. Priority:
    //   1. user explicitly clicked a wedge → selectedSlot
    //   2. user picked a type that matches a slot today → first match
    //   3. nothing matched → drop into the slot that covers "now" today,
    //      or the first slot of the day if we're not on today.
    let targetSlot = selectedSlot && selectedSlotIsForDay ? selectedSlot : null;
    if (!targetSlot && data?.primaryType) {
      targetSlot = daySlots.find(s => s.slotType === data.primaryType) || null;
    }
    if (!targetSlot && daySlots.length) {
      const isToday = viewKey === formatYMD(new Date());
      if (isToday) {
        const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
        const inSpan = (s) => {
          const [sh, sm] = (s.startTime || '00:00').split(':').map(Number);
          const [eh, em] = (s.endTime || '00:00').split(':').map(Number);
          const start = (sh || 0) * 60 + (sm || 0);
          let end = (eh || 0) * 60 + (em || 0);
          if (end <= start) end += 24 * 60;
          return nowMin >= start && nowMin < end;
        };
        targetSlot = daySlots.find(inSpan) || daySlots[0];
      } else {
        targetSlot = daySlots[0];
      }
    }

    if (targetSlot) {
      // Find the next free minute inside this slot. New tasks line up
      // after whatever is already scheduled in there so three Study tasks
      // don't all stack at 1:00pm.
      const [sh, sm] = (targetSlot.startTime || '09:00').split(':').map(Number);
      const [eh, em] = (targetSlot.endTime || '17:00').split(':').map(Number);
      const slotStartMin = (sh || 0) * 60 + (sm || 0);
      let slotEndMin = (eh || 0) * 60 + (em || 0);
      if (slotEndMin <= slotStartMin) slotEndMin += 24 * 60;

      const existing = (state.tasks || []).filter(t => {
        if (t.status === 'cancelled') return false;
        if (t.scheduledSlotId === targetSlot.id) return true;
        if (!t.scheduledTime) return false;
        const ts = new Date(t.scheduledTime);
        if (formatYMD(ts) !== targetSlot.date) return false;
        const tMin = ts.getHours() * 60 + ts.getMinutes();
        return tMin >= slotStartMin && tMin < slotEndMin;
      });

      let nextMin = slotStartMin;
      for (const t of existing) {
        const ts = new Date(t.scheduledTime);
        const start = ts.getHours() * 60 + ts.getMinutes();
        const end = start + (t.duration || 30);
        if (end > nextMin) nextMin = end;
      }
      // Don't schedule past the slot end — clamp so the new task at least
      // starts inside the slot. Overflow is handled by the existing
      // overflow indicator.
      if (nextMin >= slotEndMin) nextMin = Math.max(slotStartMin, slotEndMin - (data?.duration || 30));

      const d = new Date(`${targetSlot.date}T00:00:00`);
      d.setHours(Math.floor(nextMin / 60), nextMin % 60, 0, 0);
      const iso = d.toISOString();
      payload = {
        ...data,
        scheduledSlotId: targetSlot.id,
        scheduledTime: iso,
        scheduledFor: iso,
      };
    } else {
      // No slots on this day at all — still give the task a scheduledTime
      // pinned to the day so it shows up in the day view's task list.
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
    });
    return api.tasks.add(payload);
  };

  const handleSeriesComplete = (id) => api.tasks.completeSeries(id);
  const handleSeriesDelete = (id) => {
    const segs = api.tasks.seriesOf(id);
    const count = segs.length;
    if (count > 1 && !window.confirm(`delete all ${count} parts of this task?`)) return;
    api.tasks.removeSeries(id);
  };
  const handleSeriesBump = (id, days) => api.tasks.bumpSeries(id, days);

  const rowHandlers = {
    onToggle: handleToggle,
    onDelete: handleDelete,
    onEdit: handleEdit,
    onSaveEdit: handleSaveEdit,
    onSeriesComplete: handleSeriesComplete,
    onSeriesDelete: handleSeriesDelete,
    onSeriesBump: handleSeriesBump,
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
      const tmpl = [...STARTER_WHEELS, ...FAMOUS_WHEELS].find(w => w.id === wheelId);
      if (!tmpl) return;
      const added = await api.wheels.add({
        id: tmpl.id, name: tmpl.name, color: tmpl.color, blocks: tmpl.blocks,
      });
      actualId = added.id;
    }
    await api.wheels.applyToDate(actualId, viewKey, { mode: 'replace' });
    telemetryLog('rail:applied', { wheelId, date: viewKey });
  };

  // Open the painter for a given wheel id. We resolve the wheel object
  // (looking through user wheels first, then the famous catalog) so the
  // modal can show a preview without having to add it to the library
  // until the user actually applies.
  const openPainter = (wheelId) => {
    const w = userWheels.find(x => x.id === wheelId)
      || FAMOUS_WHEELS.find(x => x.id === wheelId)
      || null;
    if (!w) return;
    setPainterTarget({ wheel: w });
  };

  // Paint a wheel onto a single arbitrary date — used when a chip is
  // dragged onto a calendar cell. Mirrors applyWheelToDay but takes the
  // date explicitly instead of using viewKey.
  const paintWheelOnDate = async (wheelId, dateKey) => {
    if (!wheelId || !dateKey) return;
    const existing = userWheels.find(w => w.id === wheelId);
    let actualId = existing?.id;
    if (!actualId) {
      const tmpl = [...STARTER_WHEELS, ...FAMOUS_WHEELS].find(w => w.id === wheelId);
      if (!tmpl) return;
      const added = await api.wheels.add({
        id: tmpl.id, name: tmpl.name, color: tmpl.color, blocks: tmpl.blocks,
      });
      actualId = added.id;
    }
    await api.wheels.applyToDate(actualId, dateKey, { mode: 'replace' });
    telemetryLog('drag-paint:applied', { wheelId, date: dateKey });
  };

  // Paint a wheel onto a closed date range with no day-of-week filter —
  // used by the lasso flow where the user has already picked their dates
  // visually. Honors the picker callback contract by taking wheelId.
  const paintWheelOverRange = async (wheelId, startDate, endDate) => {
    if (!wheelId || !startDate || !endDate) return;
    const existing = userWheels.find(w => w.id === wheelId);
    let actualId = existing?.id;
    if (!actualId) {
      const tmpl = [...STARTER_WHEELS, ...FAMOUS_WHEELS].find(w => w.id === wheelId);
      if (!tmpl) return;
      const added = await api.wheels.add({
        id: tmpl.id, name: tmpl.name, color: tmpl.color, blocks: tmpl.blocks,
      });
      actualId = added.id;
    }
    const result = await api.wheels.applyToRange(actualId, startDate, endDate, { mode: 'replace' });
    telemetryLog('lasso-paint:applied', { wheelId, count: result?.painted?.length || 0, startDate, endDate });
  };

  // Save today's blocks as a new shape, then chain into the painter so
  // the user can paint that shape across a range immediately.
  const saveAndPaint = async () => {
    const name = window.prompt('name this shape (e.g. "Workday", "Weekend", "Travel"):');
    if (!name?.trim()) return;
    const palette = ['#D4663A', '#A8BF8C', '#D9C98C', '#C7BEDD', '#F2C4A6'];
    const color = palette[(userWheels.length) % palette.length];
    try {
      const newWheel = await api.wheels.saveFromDate(viewKey, { name: name.trim(), color });
      if (newWheel?.id) {
        telemetryLog('save-paint:saved', { wheelId: newWheel.id });
        setPainterTarget({ wheel: newWheel });
      } else {
        // fall back: open the wheels panel so the user sees their save
        setWheelsPanelOpen(true);
      }
    } catch (err) {
      telemetryLog('save-paint:error', { message: err?.message });
      setWheelsPanelOpen(true);
    }
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
          title={activeWheel ? `current wheel — click to switch` : 'no wheel on this day — click to pick one'}
          data-onboard="wheel-picker"
        >
          <span
            className="tm-active-chip-dot"
            style={{ background: activeWheel?.color || 'transparent', border: activeWheel ? 'none' : '1.5px dashed var(--ink-mute)' }}
            aria-hidden
          />
          {activeWheel ? activeWheel.name : 'pick a wheel'}
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
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="tm-btn tm-sm"
              onClick={() => setOverflowOpen(o => !o)}
              aria-haspopup="menu"
              aria-expanded={overflowOpen}
              title="more"
            >
              ⋯
            </button>
            {overflowOpen && (
              <div
                role="menu"
                onMouseLeave={() => setOverflowOpen(false)}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 6px)',
                  background: 'var(--paper)',
                  border: '1.5px solid var(--ink)',
                  borderRadius: 10,
                  padding: 6,
                  boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
                  zIndex: 60,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  minWidth: 180,
                }}
              >
                <OverflowItem onClick={() => { setOverflowOpen(false); telemetryLog('ui:wheels-open'); setWheelsPanelOpen(true); }}>
                  manage wheels
                </OverflowItem>
                <OverflowItem onClick={() => { setOverflowOpen(false); telemetryLog('backup:export-ics'); api.backup.exportICS(); }}>
                  export .ics
                </OverflowItem>
                <OverflowItem onClick={() => { setOverflowOpen(false); setOnboardingOpen(true); }}>
                  replay tour
                </OverflowItem>
                <OverflowItem onClick={() => { setOverflowOpen(false); setSettingsOpen(true); }}>
                  settings
                </OverflowItem>
              </div>
            )}
          </div>
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
            <span
              aria-hidden
              style={{
                width: 22, height: 22, borderRadius: '50%',
                background: isLoggedIn ? 'var(--orange)' : 'var(--ink-mute)',
                color: 'var(--paper)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Caveat, cursive', fontSize: 16, fontWeight: 600, lineHeight: 1,
              }}
            >
              {accountInitial}
            </span>
            {isLoggedIn ? (auth.profile.firstName || auth.profile.username) : 'guest'}
          </button>
        </div>
      </header>

      {/* Promote the new annual-first flow. Customers told us they think
          year → day, not day → year, so we point them at the new canvas
          first. Dismissible — once dismissed, stays dismissed via
          localStorage. */}
      <YearPromoBanner />

      {showQuickStart && (
        <QuickStart
          onPick={handleQuickStart}
          wheels={state.settings?.wheels || STARTER_WHEELS}
        />
      )}

      {hasSlots && (
        <div
          data-onboard="composer"
          style={{
            marginBottom: 18,
            padding: '14px 18px',
            border: '2px solid var(--orange)',
            borderRadius: 12,
            background: 'var(--paper-warm, #FAF5EC)',
            boxShadow: '0 2px 8px rgba(212, 102, 58, 0.08)',
          }}
        >
          <div
            style={{
              fontFamily: 'Caveat, cursive',
              fontSize: 26,
              lineHeight: 1,
              color: 'var(--orange)',
              marginBottom: 8,
            }}
          >
            What do you need to do?
          </div>
          {selectedSlot && selectedSlotIsForDay && (
            <div
              className="tm-mono tm-sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 8,
                color: 'var(--ink-mute)',
                flexWrap: 'wrap',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: selectedSlot.color || 'var(--ink)',
                }}
              />
              <span>
                adding to <strong style={{ color: 'var(--ink)' }}>{selectedSlot.label || selectedSlot.slotType || 'block'}</strong>
                {' · '}{selectedSlot.startTime}–{selectedSlot.endTime}
              </span>
              <button
                type="button"
                className="tm-btn tm-sm"
                onClick={() => setSelectedSlotId(null)}
                title="stop targeting this section"
              >
                clear
              </button>
            </div>
          )}
          <TaskComposer
            onAdd={handleAddTask}
            taskTypes={state.taskTypes || []}
            autoFocus={!hasTasks}
            type={selectedType}
            onTypeChange={(id) => {
              setSelectedType(id);
              const match = (state.slots || []).find(
                (s) => s.slotType === id && s.date === formatYMD(selectedDate),
              );
              setSelectedSlotId(match?.id || null);
            }}
          />
        </div>
      )}

      {scale === 'block' && (
        <SlotView
          currentSlot={filteredDerived.currentSlot}
          nextSlot={filteredDerived.nextSlot}
          next={derived.next}
          slots={state.slots || []}
          api={api}
          rowHandlers={rowHandlers}
        />
      )}

      {scale === 'day' && (
        <div className="tm-dash">
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
            <WheelRail
              userWheels={userWheels}
              activeWheelId={activeWheelId}
              onApply={applyWheelToDay}
              onSchedule={openPainter}
              onBrowseAll={() => setPickerOpen(true)}
              onSaveToday={saveAndPaint}
            />
          </aside>
        </div>
      )}

      {scale === 'week' && (
        <WeekTimeline
          selectedDate={selectedDate}
          slots={state.slots || []}
          tasks={filteredState.tasks || []}
          taskTypes={state.taskTypes || []}
          onPickDate={(d) => {
            telemetryLog('ui:week-pick-day', { date: formatYMD(d) });
            setSelectedDate(d);
            setScale('day');
          }}
        />
      )}

      {scale === 'month' && (
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
        />
      )}

      {scale === 'quarter' && (
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
        />
      )}

      {scale === 'year' && (
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
        />
      )}

      {pickerOpen && (
        <WheelPickerModal
          wheels={[...userWheels, ...FAMOUS_WHEELS.filter(fw => !userWheels.some(uw => uw.id === fw.id))]}
          currentWheelId={activeWheelId}
          rangeContext={pendingRange}
          onApply={async (wheelId) => {
            if (pendingRange) {
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
            if (!hasSeenOnboarding()) setOnboardingOpen(true);
          }}
        />
      )}

      {onboardingOpen && !welcomeOpen && (
        <Onboarding
          onClose={() => setOnboardingOpen(false)}
          signals={{
            wheelPicked: derived.dayAssignments?.[formatYMD(selectedDate)] || '',
            blockClicked: selectedSlotId || '',
            taskAdded: (state.tasks || []).length,
            accountOpened: accountOpen ? 1 : 0,
          }}
        />
      )}

      {accountOpen && (
        <AccountPanel
          onClose={() => setAccountOpen(false)}
          onSignOut={() => { setAccountOpen(false); setWelcomeOpen(true); }}
          onCreateAccount={() => setWelcomeOpen(true)}
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

function QuickStart({ onPick, wheels }) {
  const options = Array.isArray(wheels) && wheels.length > 0 ? wheels : STARTER_WHEELS;
  return (
    <div className="tm-card tm-dashed" style={{ padding: '18px 22px', marginBottom: 18 }}>
      <div style={{ fontSize: 24, marginBottom: 2 }}>pick a day to start with</div>
      <div className="tm-mono tm-md" style={{ color: 'var(--ink-mute)', marginBottom: 14 }}>
        one click paints a set of time blocks onto today. edit or reshape it any time from the day view.
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {options.map(s => (
          <button
            key={s.id}
            className="tm-btn tm-primary"
            onClick={() => onPick(s)}
            title={(s.blocks || []).map(b => `${b.startTime}–${b.endTime} ${b.label}`).join(' · ')}
          >
            {s.name}
          </button>
        ))}
        <button className="tm-btn tm-ghost" onClick={() => onPick(null)}>
          build my own →
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
            <div style={{ fontFamily: 'Caveat', fontSize: 22, lineHeight: 1, color: isToday ? 'var(--orange)' : 'var(--ink)' }}>
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

// IDs we surface in the rail's "Featured" group — a small, opinionated
// taste of the library. Users hit "Browse all" for the rest.
const RAIL_FEATURED_IDS = [
  'system_early_bird',
  'system_night_owl',
  'system_pomodoro',
  'famous_buffett',
  'famous_cook',
  'famous_franklin',
];

function OverflowItem({ children, onClick }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        all: 'unset',
        cursor: 'pointer',
        padding: '6px 10px',
        borderRadius: 6,
        fontSize: 14,
        color: 'var(--ink)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--paper-warm, #FAF5EC)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}

function YearPromoBanner() {
  const KEY = 'taskometer.yearPromoDismissed';
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(KEY) === '1'; } catch (_) { return false; }
  });
  if (dismissed) return null;
  const dismiss = () => {
    try { localStorage.setItem(KEY, '1'); } catch (_) {}
    setDismissed(true);
  };
  return (
    <div
      style={{
        marginBottom: 18,
        padding: '14px 18px',
        border: '2px dashed var(--orange)',
        borderRadius: 12,
        background: 'var(--paper-warm, #FAF5EC)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontFamily: 'Caveat, cursive', fontSize: 26, lineHeight: 1, color: 'var(--orange)', marginBottom: 4 }}>
          Plan your year first.
        </div>
        <div className="tm-mono tm-sm" style={{ color: 'var(--ink-soft)' }}>
          New: define recurring rhythms (weekly all-hands, biweekly retro, monthly review)
          and watch them paint your year. Add tasks here on top.
        </div>
      </div>
      <a href="/app/year" className="tm-btn tm-primary">Open year canvas →</a>
      <button type="button" className="tm-btn tm-sm" onClick={dismiss} title="hide this banner">
        ×
      </button>
    </div>
  );
}

function WheelRail({ userWheels, activeWheelId, onApply, onSchedule, onBrowseAll, onSaveToday }) {
  // The rail is "shape this day fast" — your saved shapes plus a tiny
  // curated set so first-time users see something useful without the
  // 100-wheel dump. Everything else lives behind "Browse all".
  const featured = useMemo(() => {
    const userIds = new Set(userWheels.map(w => w.id));
    return RAIL_FEATURED_IDS
      .map(id => FAMOUS_WHEELS.find(w => w.id === id))
      .filter(Boolean)
      .filter(w => !userIds.has(w.id));
  }, [userWheels]);

  const renderChip = (w) => {
    const slotsForMini = (w.blocks || []).map(b => ({
      startTime: b.startTime,
      endTime: b.endTime,
      color: b.color,
    }));
    const on = activeWheelId === w.id;
    return (
      <div
        key={w.id}
        role="listitem"
        className={`tm-chip-wheel${on ? ' tm-chip-on' : ''}`}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/wheel-id', w.id);
          e.dataTransfer.effectAllowed = 'copy';
        }}
      >
        <button
          type="button"
          className="tm-chip-wheel-main"
          onClick={() => onApply(w.id)}
          title={`apply "${w.name}" to this day · drag onto a calendar cell to paint a different day`}
        >
          <MiniWheel slots={slotsForMini} size={32} thickness={4} />
          <span className="tm-chip-wheel-name">{w.name}</span>
        </button>
        <button
          type="button"
          className="tm-chip-wheel-schedule"
          onClick={(e) => { e.stopPropagation(); onSchedule(w.id); }}
          title="schedule across a range — weekdays, this month, custom"
          aria-label={`schedule ${w.name} across a range`}
        >
          📅
        </button>
      </div>
    );
  };

  return (
    <div className="tm-rail" role="list" aria-label="wheel library">
      <div className="tm-rail-head">
        <span className="tm-rail-title">Shapes</span>
        <button type="button" className="tm-btn tm-sm tm-ghost" onClick={onBrowseAll} title="open the full library">
          browse all →
        </button>
      </div>
      <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', marginTop: -8 }}>
        Click to paint this day. Use 📅 to paint a range.
      </div>

      {userWheels.length > 0 && (
        <div>
          <div className="tm-rail-cat">Mine</div>
          <div className="tm-rail-list">{userWheels.map(renderChip)}</div>
        </div>
      )}

      {featured.length > 0 && (
        <div>
          <div className="tm-rail-cat">Featured</div>
          <div className="tm-rail-list">{featured.map(renderChip)}</div>
        </div>
      )}

      <button
        type="button"
        className="tm-btn tm-sm tm-ghost"
        onClick={onSaveToday}
        title="save today's blocks as a reusable shape"
        style={{ alignSelf: 'flex-start', marginTop: 4 }}
      >
        + save today as shape
      </button>
    </div>
  );
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
