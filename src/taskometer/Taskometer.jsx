import React, { useEffect, useMemo, useRef, useState } from 'react';
import WheelView from './WheelView.jsx';
import CalendarView from './CalendarView.jsx';
import WheelsPanel from './WheelsPanel.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import { TaskComposer } from './Composers.jsx';
import { useTaskometerAPI } from '../services/api';
import { STARTER_WHEELS } from '../services/api/TaskometerAPI';
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

const SCALES = ['slot', 'day', 'week', 'month', 'quarter', 'year'];
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
  const [search, setSearch] = useState('');
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
  }, [state, scale]);

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
    goToTodos: () => setScale('slot'),
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
  const handleAddTask = (data) => {
    telemetryLog('task:add', {
      text: (data?.text || '').slice(0, 40),
      type: data?.primaryType,
      duration: data?.duration,
      priority: data?.priority,
    });
    return api.tasks.add(data);
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
      <header className="tm-hdr">
        <div className="tm-logo">taskometer</div>
        <div className="tm-hdr-meta">
          <span className="tm-mono tm-md">{formatDateLabel(selectedDate)}</span>
          {hasTasks && (
            <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', marginLeft: 14 }}>
              {todayDone}/{todayTotal} today · {pushed} pushed
            </span>
          )}
        </div>
      </header>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 14,
          paddingBottom: 10,
          borderBottom: '1px solid var(--rule-soft)',
        }}
      >
        <div className="tm-seg">
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
            <button className="tm-btn tm-sm" onClick={resetDate}>today</button>
            <button className="tm-btn tm-sm" onClick={() => shiftDate(1)} aria-label="next">›</button>
          </div>
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
            export .ics
          </button>
          <button
            className="tm-btn tm-sm"
            onClick={() => setSettingsOpen(true)}
          >
            settings
          </button>
        </div>
      </div>

      {showQuickStart && (
        <QuickStart
          onPick={handleQuickStart}
          wheels={state.settings?.wheels || STARTER_WHEELS}
        />
      )}

      {hasSlots && (
        <div style={{ marginBottom: 14 }}>
          <TaskComposer
            onAdd={handleAddTask}
            taskTypes={state.taskTypes || []}
            autoFocus={!hasTasks}
          />
        </div>
      )}

      {scale === 'slot' && (
        <SlotView
          currentSlot={filteredDerived.currentSlot}
          next={derived.next}
          rowHandlers={rowHandlers}
        />
      )}

      {scale === 'day' && (
        <WheelView
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
        />
      )}

      {scale === 'week' && (
        <WeekView
          selectedDate={selectedDate}
          slots={state.slots || []}
          tasks={filteredState.tasks || []}
          wheels={derived.wheels}
          dayAssignments={derived.dayAssignments}
          dayOverrides={derived.dayOverrides}
          onPickDate={(d) => {
            telemetryLog('ui:week-pick-day', { date: formatYMD(d) });
            setSelectedDate(d);
            setScale('day');
          }}
        />
      )}

      {CALENDAR_SCOPES.has(scale) && (
        <CalendarView
          scope={scale}
          wheels={derived.wheels}
          slots={state.slots || []}
          dayAssignments={derived.dayAssignments}
          dayOverrides={derived.dayOverrides}
          resolveDay={derived.resolveDay}
          api={api}
          onNavigate={() => {}}
          onOpenWheels={() => setWheelsPanelOpen(true)}
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

function SlotView({ currentSlot, next, rowHandlers }) {
  const { onToggle, onDelete, onEdit } = rowHandlers || {};
  const slot = currentSlot?.slot || null;
  const tasks = currentSlot?.tasks || [];

  if (!slot) {
    return (
      <div className="tm-card tm-dashed" style={{ padding: '18px 22px' }}>
        <div className="tm-mono tm-md" style={{ color: 'var(--ink-mute)', marginBottom: 6 }}>now</div>
        <div style={{ fontSize: 22 }}>no time block covers this moment</div>
        <div className="tm-mono tm-md" style={{ marginTop: 6, color: 'var(--ink-mute)' }}>
          {next
            ? `next up — ${next.text || 'untitled'}`
            : 'add a block from the day view and tasks will land here.'}
        </div>
      </div>
    );
  }

  return (
    <div
      className="tm-card"
      style={{
        padding: '18px 22px',
        borderTop: `6px solid ${slot.color || 'var(--ink)'}`,
      }}
    >
      <div className="tm-mono tm-md" style={{ color: 'var(--ink-mute)' }}>now</div>
      <div style={{ fontSize: 28, marginTop: 2 }}>{slot.label || slot.slotType || 'block'}</div>
      <div className="tm-mono tm-md" style={{ marginTop: 4 }}>
        {slot.startTime}–{slot.endTime}
      </div>

      {tasks.length === 0 ? (
        <div className="tm-mono tm-md" style={{ marginTop: 14, color: 'var(--ink-mute)' }}>
          nothing in this slot yet — add a task above and it'll drop in here.
        </div>
      ) : (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column' }}>
          {tasks.map(t => {
            const id = t.id || t.key;
            const done = t.status === 'completed';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {days.map(d => {
        const key = formatYMD(d);
        const label = d.toLocaleDateString('en', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
        const wheel = wheelsById[dayAssignments[key]] || null;
        const override = dayOverrides[key] || null;
        const slotCount = slots.filter(s => s.date === key).length;
        const taskCount = tasks.filter(t => {
          const st = t.scheduledTime ? new Date(t.scheduledTime) : null;
          return st && formatYMD(st) === key;
        }).length;
        const isToday = key === todayKey;
        const stripe = wheel?.color || override?.color || 'var(--rule)';
        return (
          <button
            key={key}
            type="button"
            onClick={() => onPickDate(d)}
            style={{
              all: 'unset',
              cursor: 'pointer',
              display: 'block',
              padding: '12px 16px',
              borderLeft: `6px solid ${stripe}`,
              border: '1px solid var(--rule-soft)',
              borderLeftWidth: 6,
              borderRadius: 4,
              background: isToday ? 'var(--paper-warm)' : 'var(--paper)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 20 }}>
                {label}{isToday ? ' · today' : ''}
              </div>
              <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
                {wheel
                  ? wheel.name
                  : override
                    ? `override — ${override.label || override.type}`
                    : '(unscheduled)'}
              </div>
              <div
                className="tm-mono tm-sm"
                style={{ marginLeft: 'auto', color: 'var(--ink-mute)' }}
              >
                {slotCount} blocks · {taskCount} tasks
              </div>
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
