import React, { useEffect, useMemo, useRef, useState } from 'react';
import WheelView, { MiniWheel } from './WheelView.jsx';
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
  const auth = (() => { try { return JSON.parse(localStorage.getItem('smartcircle.auth') || 'null'); } catch (_) { return null; } })();
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
    if (selectedSlot && selectedSlotIsForDay) {
      const [h, m] = (selectedSlot.startTime || '09:00').split(':').map(Number);
      const d = new Date(`${selectedSlot.date}T00:00:00`);
      d.setHours(h || 0, m || 0, 0, 0);
      const iso = d.toISOString();
      payload = {
        ...data,
        scheduledSlotId: selectedSlot.id,
        scheduledTime: iso,
        scheduledFor: iso,
      };
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

  return (
    <div id="tm-root-frame" className="tm-root tm-paper">
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
          marginBottom: 14,
          paddingBottom: 10,
          borderBottom: '1px solid var(--rule-soft)',
        }}
      >
        <div
          className="tm-logo"
          style={{ fontFamily: 'Caveat', fontSize: 30, lineHeight: 1, color: 'var(--ink)' }}
        >
          taskometer
        </div>

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
          <button
            className="tm-btn tm-sm"
            onClick={() => { telemetryLog('ui:wheels-open'); setWheelsPanelOpen(true); }}
            title="wheel library — save, edit, apply templates"
          >
            wheels
          </button>
          <button
            className="tm-btn tm-sm"
            onClick={() => { telemetryLog('backup:export-ics'); api.backup.exportICS(); }}
            title="export as iCalendar (.ics) for Google/Apple/Outlook import"
          >
            ⤓ ics
          </button>
          <button
            className="tm-btn tm-sm"
            onClick={() => setOnboardingOpen(true)}
            title="replay the getting-started tour"
            aria-label="help"
          >
            ?
          </button>
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
          <button
            className="tm-btn tm-sm"
            onClick={() => setSettingsOpen(true)}
            title="settings, notifications, backup, wipe"
          >
            ⚙
          </button>
        </div>
      </header>

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
      )}

      {scale === 'day' && (
        <DailyWrap
          selectedDate={selectedDate}
          slots={state.slots || []}
          tasks={state.tasks || []}
          taskTypes={state.taskTypes || []}
        />
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
        />
      )}

      {scale === 'quarter' && (
        <QuarterInsights
          selectedDate={selectedDate}
          slots={state.slots || []}
          taskTypes={state.taskTypes || []}
          onPickDate={(d) => { setSelectedDate(d); setScale('day'); }}
        />
      )}

      {scale === 'year' && (
        <YearInsights
          selectedDate={selectedDate}
          slots={state.slots || []}
          taskTypes={state.taskTypes || []}
          onPickDate={(d) => { setSelectedDate(d); setScale('day'); }}
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
          onPickWheel={async (wheelId) => {
            try {
              const today = formatYMD(new Date());
              const existing = (state.settings?.wheels || []).find(w => w.id === wheelId);
              let actualId = existing?.id;
              if (!actualId) {
                const tmpl = STARTER_WHEELS.find(w => w.id === wheelId);
                if (tmpl) {
                  const added = await api.wheels.add({
                    id: tmpl.id, name: tmpl.name, color: tmpl.color, blocks: tmpl.blocks,
                  });
                  actualId = added.id;
                }
              }
              if (actualId) {
                await api.wheels.applyToDate(actualId, today, { mode: 'replace' });
                telemetryLog('rhythm:applied', { wheelId, date: today });
              }
            } catch (err) {
              telemetryLog('rhythm:error', { message: err?.message });
            }
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
