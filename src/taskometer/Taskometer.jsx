import React, { useEffect, useMemo, useRef, useState } from 'react';
import GaugeView from './GaugeView.jsx';
import WheelView from './WheelView.jsx';
import FitView from './FitView.jsx';
import CalendarView from './CalendarView.jsx';
import WheelsPanel from './WheelsPanel.jsx';
import RulesPanel from './RulesPanel.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import { TaskComposer } from './Composers.jsx';
import { useTaskometerAPI } from '../services/api';
import { STARTER_WHEELS } from '../services/api/TaskometerAPI';
import useTaskNotifications from '../hooks/useTaskNotifications.js';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';
import KeyboardShortcuts from '../components/KeyboardShortcuts.jsx';
import { log as telemetryLog, snapshotState } from '../services/telemetry.js';
import './taskometer.css';

const VIEW_LABELS = {
  gauge: { title: 'today', sub: 'load + pressure' },
  wheel: { title: 'wheel', sub: '24h slots' },
  fit: { title: 'itinerary', sub: 'next 14 days in order' },
  calendar: { title: 'calendar', sub: 'month · quarter · year' },
};

const DEFAULT_UI = {
  palette: 'warm',
  rules: 'lines',
  showCoach: true,
  notifications: false,
};

function readStoredUI() {
  try {
    // Prefer the new key, fall back to the old "tm.tweaks" so we don't lose
    // people who already customised the look.
    const raw = localStorage.getItem('tm.ui') || localStorage.getItem('tm.tweaks');
    if (!raw) return DEFAULT_UI;
    return { ...DEFAULT_UI, ...JSON.parse(raw) };
  } catch (_) {
    return DEFAULT_UI;
  }
}

export default function Taskometer() {
  const [view, setView] = useState(() => localStorage.getItem('tm.view') || 'gauge');
  const [ui, setUI] = useState(readStoredUI);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [nowLabel, setNowLabel] = useState(formatNowLabel());
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [wheelsPanelOpen, setWheelsPanelOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef(null);

  const { state, api, derived } = useTaskometerAPI();

  useEffect(() => {
    localStorage.setItem('tm.view', view);
    telemetryLog('ui:view', { view });
  }, [view]);

  // Log a one-shot snapshot when the state finishes hydrating so the
  // very first console frame tells us what the user landed on.
  const loggedReadyRef = useRef(false);
  useEffect(() => {
    if (loggedReadyRef.current) return;
    if (state.isLoading || !state.isInitialized) return;
    loggedReadyRef.current = true;
    telemetryLog('app:ready', { view, ...snapshotState(state) });
  }, [state, view]);
  useEffect(() => {
    try { localStorage.setItem('tm.ui', JSON.stringify(ui)); } catch (_) {}
  }, [ui]);

  // Keep the header clock ticking every 30s
  useEffect(() => {
    const tick = () => setNowLabel(formatNowLabel());
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  // Apply palette + rules
  useEffect(() => {
    document.body.classList.add('tm-body');
    const rootApp = document.getElementById('tm-root-frame');
    applyPalette(ui.palette);
    if (!rootApp) return;
    rootApp.classList.remove('tm-paper');
    rootApp.style.backgroundImage = '';
    if (ui.rules === 'lines') rootApp.classList.add('tm-paper');
    else if (ui.rules === 'grid') {
      rootApp.style.backgroundImage = `
        repeating-linear-gradient(to right, transparent 0 31px, var(--rule-soft) 31px 32px),
        repeating-linear-gradient(to bottom, transparent 0 31px, var(--rule-soft) 31px 32px)
      `;
    }
  }, [ui.palette, ui.rules]);

  // Notifications for upcoming tasks
  useTaskNotifications({
    tasks: state.tasks || [],
    enabled: !!ui.notifications,
    lookAheadMin: 5,
  });

  // Keyboard shortcuts — routed to the actions the UI exposes
  useKeyboardShortcuts({
    goToDashboard: () => setView('gauge'),
    goToPlan: () => setView('fit'),
    goToTodos: () => setView('wheel'),
    newTask: () => searchRef.current?.focus?.() || null,
    search: () => { searchRef.current?.focus?.(); },
    cancel: () => {
      setSettingsOpen(false);
      setRulesOpen(false);
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
      repeats: data?.recurrence?.frequency !== 'none',
    });
    return api.tasks.add(data);
  };

  const handleQuickStart = async (template) => {
    if (!template) {
      telemetryLog('quickstart:custom');
      setView('wheel');
      return;
    }
    telemetryLog('quickstart:pick', { name: template.name, blocks: template.blocks.length });
    try {
      const created = await api.wheels.add({
        name: template.name,
        color: template.color,
        blocks: template.blocks,
      });
      const today = formatYMD(new Date());
      await api.wheels.applyToDate(created.id, today);
      telemetryLog('quickstart:applied', { wheelId: created.id, date: today });
    } catch (err) {
      telemetryLog('quickstart:error', { message: err?.message });
    }
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

  // Global text search: filter the state tasks + slots derived view by the
  // current query. Empty query is a no-op pass-through. We run the search on
  // the raw collections so views receive a pre-filtered view and everything
  // downstream naturally reflects it.
  const filteredState = useMemo(() => {
    if (!search.trim()) return state;
    const q = search.trim().toLowerCase();
    const matchTask = (t) => {
      const text = (t.text || t.title || '').toLowerCase();
      const desc = (t.description || '').toLowerCase();
      const tags = (t.tags || []).join(' ').toLowerCase();
      const type = (t.primaryType || t.taskType || '').toLowerCase();
      const prio = (t.priority || '').toLowerCase();
      return text.includes(q) || desc.includes(q) || tags.includes(q) || type.includes(q) || prio.includes(q);
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
      backlog: (derived.backlog || []).filter(keep),
      upcoming: (derived.upcoming || []).filter(keep),
      pushed: (derived.pushed || []).filter(keep),
      currentSlot: derived.currentSlot
        ? { ...derived.currentSlot, tasks: (derived.currentSlot.tasks || []).filter(keep) }
        : derived.currentSlot,
      weekFit: derived.weekFit
        ? {
            ...derived.weekFit,
            placed: (derived.weekFit.placed || []).filter(p => ids.has(p.id)),
            itinerary: (derived.weekFit.itinerary || []).map(day => ({
              ...day,
              tasks: (day.tasks || []).filter(keep),
            })).filter(day => day.tasks.length > 0 || day.today),
          }
        : derived.weekFit,
    };
  }, [derived, search, filteredState.tasks]);

  const { todayDone, todayTotal, pushed } = derived.stats;
  const hasSlots = (state.slots?.length || 0) > 0;
  const hasTasks = (state.tasks?.length || 0) > 0;
  const hasWheels = (state.settings?.wheels?.length || 0) > 0;
  const showQuickStart = !hasSlots && !hasWheels;

  return (
    <div id="tm-root-frame" className="tm-root tm-paper">
      <header className="tm-hdr">
        <div className="tm-logo">taskometer</div>
        <div className="tm-hdr-meta">
          <span className="tm-mono tm-md">{nowLabel}</span>
        </div>
      </header>

      <div className="tm-tabs">
        {['gauge', 'wheel', 'fit', 'calendar'].map(v => (
          <button
            key={v}
            className={`tm-tab${view === v ? ' tm-active' : ''}`}
            onClick={() => setView(v)}
          >
            {v}
          </button>
        ))}
        <div className="tm-tabs-right">
          {hasTasks && (
            <input
              ref={searchRef}
              className="tm-composer-input"
              placeholder="search tasks…  /"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setSearch(''); }}
              style={{ width: 220, fontSize: 14, padding: '4px 8px' }}
              aria-label="search"
            />
          )}
          {hasSlots && (
            <>
              <button
                className="tm-btn tm-sm"
                onClick={() => setRulesOpen(true)}
                title="weekday/weekend defaults, vacation ranges, holiday rules"
              >
                rules
              </button>
              <button
                className="tm-btn tm-sm"
                onClick={() => setWheelsPanelOpen(true)}
                title="save today as a wheel, pick a starter, apply to dates"
              >
                wheels
              </button>
            </>
          )}
          {hasTasks && (
            <span className="tm-mono tm-md">
              {todayDone} of {todayTotal} today · {pushed} pushed
            </span>
          )}
        </div>
      </div>

      <div className="tm-subhead">
        {VIEW_LABELS[view].title} <span className="tm-sub">— {VIEW_LABELS[view].sub}</span>
      </div>

      {showQuickStart && <QuickStart onPick={handleQuickStart} />}

      {hasSlots && (
        <div style={{ marginBottom: 18 }}>
          <TaskComposer onAdd={handleAddTask} taskTypes={state.taskTypes || []} autoFocus={!hasTasks} />
        </div>
      )}

      {view === 'gauge' && (
        <GaugeView
          load={derived.load}
          next={derived.next}
          pressure={derived.pressure}
          timeline={derived.timeline}
          stats={derived.stats}
          showCoach={ui.showCoach}
          currentSlot={filteredDerived.currentSlot}
          todayTasks={filteredDerived.todayTasks}
          rowHandlers={rowHandlers}
          onNavigate={setView}
          hasContent={hasSlots || hasTasks}
        />
      )}
      {view === 'wheel' && (
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
          onNavigate={setView}
          onOpenWheels={() => setWheelsPanelOpen(true)}
        />
      )}
      {view === 'fit' && (
        <FitView
          weekFit={filteredDerived.weekFit}
          backlog={filteredDerived.backlog}
          taskTypes={state.taskTypes || []}
          wheels={derived.wheels}
          dayAssignments={derived.dayAssignments}
          dayOverrides={derived.dayOverrides}
          resolveDay={derived.resolveDay}
          api={api}
          rowHandlers={rowHandlers}
          onNavigate={setView}
          onOpenWheels={() => setWheelsPanelOpen(true)}
          onOpenRules={() => setRulesOpen(true)}
        />
      )}
      {view === 'calendar' && (
        <CalendarView
          wheels={derived.wheels}
          slots={state.slots || []}
          dayAssignments={derived.dayAssignments}
          dayOverrides={derived.dayOverrides}
          resolveDay={derived.resolveDay}
          api={api}
          onNavigate={setView}
          onOpenWheels={() => setWheelsPanelOpen(true)}
          onOpenRules={() => setRulesOpen(true)}
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

      {rulesOpen && (
        <RulesPanel
          api={api}
          wheels={derived.wheels}
          rules={state.settings?.scheduleRules || []}
          onClose={() => setRulesOpen(false)}
        />
      )}

      {shortcutsOpen && (
        <KeyboardShortcuts isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      )}

      {!settingsOpen && (
        <button
          className="tm-tweaks-toggle"
          onClick={() => setSettingsOpen(true)}
          title="settings, look, notifications, backup"
        >
          settings
        </button>
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

function QuickStart({ onPick }) {
  return (
    <div className="tm-card tm-dashed" style={{ padding: '18px 22px', marginBottom: 18 }}>
      <div style={{ fontSize: 24, marginBottom: 2 }}>pick a day to start with</div>
      <div className="tm-mono tm-md" style={{ color: 'var(--ink-mute)', marginBottom: 14 }}>
        one click drops a set of time blocks onto today. you can edit, reshape, or save it as your own from the wheel view.
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {STARTER_WHEELS.map(s => (
          <button
            key={s.id}
            className="tm-btn tm-primary"
            onClick={() => onPick(s)}
            title={s.blocks.map(b => `${b.startTime}–${b.endTime} ${b.label}`).join(' · ')}
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

function formatYMD(date) {
  const m = date.getMonth() + 1;
  const day = date.getDate();
  return `${date.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

function applyPalette(palette) {
  if (palette === 'cool') {
    document.documentElement.style.setProperty('--paper', '#F5F3EE');
    document.documentElement.style.setProperty('--paper-warm', '#EDEAE2');
    document.documentElement.style.setProperty('--ink', '#1C1A16');
    document.documentElement.style.setProperty('--ink-soft', '#4A433C');
    document.documentElement.style.setProperty('--ink-mute', '#8A8078');
    document.documentElement.style.setProperty('--rule-soft', '#DFDCD2');
    document.documentElement.style.setProperty('--rule', '#CFCCC0');
  } else if (palette === 'dusk') {
    document.documentElement.style.setProperty('--paper', '#1E1C1A');
    document.documentElement.style.setProperty('--paper-warm', '#2A2724');
    document.documentElement.style.setProperty('--ink', '#F2EADB');
    document.documentElement.style.setProperty('--ink-soft', '#C9BFAD');
    document.documentElement.style.setProperty('--ink-mute', '#9A8E78');
    document.documentElement.style.setProperty('--rule', '#3A3631');
    document.documentElement.style.setProperty('--rule-soft', '#2E2B27');
  } else {
    document.documentElement.style.setProperty('--paper', '#FAF3EB');
    document.documentElement.style.setProperty('--paper-warm', '#F5EBE0');
    document.documentElement.style.setProperty('--ink', '#1C1A16');
    document.documentElement.style.setProperty('--ink-soft', '#4A433C');
    document.documentElement.style.setProperty('--ink-mute', '#8A8078');
    document.documentElement.style.setProperty('--rule', '#D8CEC0');
    document.documentElement.style.setProperty('--rule-soft', '#E8DFD2');
  }
}

function formatNowLabel(date = new Date()) {
  const wk = date.toLocaleDateString('en', { weekday: 'short' }).toLowerCase();
  const mo = date.toLocaleDateString('en', { month: 'short' }).toLowerCase();
  const day = date.getDate();
  const h = date.getHours();
  const m = date.getMinutes();
  const hr = ((h % 12) || 12);
  const mm = m < 10 ? `0${m}` : `${m}`;
  const ampm = h < 12 ? 'a' : 'p';
  return `${wk} · ${mo} ${day} · ${hr}:${mm}${ampm}`;
}
