import React, { useEffect, useRef, useState } from 'react';
import GaugeView from './GaugeView.jsx';
import WheelView from './WheelView.jsx';
import FitView from './FitView.jsx';
import CalendarView from './CalendarView.jsx';
import WheelsPanel from './WheelsPanel.jsx';
import { TaskComposer } from './Composers.jsx';
import { useTaskometerAPI } from '../services/api';
import './taskometer.css';

const VIEW_LABELS = {
  gauge: { title: 'today', sub: 'load + pressure' },
  wheel: { title: 'wheel', sub: '24h slots' },
  fit: { title: 'fit', sub: 'week capacity' },
  calendar: { title: 'calendar', sub: 'month · quarter · year' },
};

const DEFAULT_TWEAKS = {
  palette: 'warm',
  rules: 'lines',
  showCoach: true,
};

function readStoredTweaks() {
  try {
    const raw = localStorage.getItem('tm.tweaks');
    if (!raw) return DEFAULT_TWEAKS;
    return { ...DEFAULT_TWEAKS, ...JSON.parse(raw) };
  } catch (_) {
    return DEFAULT_TWEAKS;
  }
}

export default function Taskometer() {
  const [view, setView] = useState(() => localStorage.getItem('tm.view') || 'gauge');
  const [tweaks, setTweaks] = useState(readStoredTweaks);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [nowLabel, setNowLabel] = useState(formatNowLabel());
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [wheelsPanelOpen, setWheelsPanelOpen] = useState(false);

  const { state, api, derived } = useTaskometerAPI();

  useEffect(() => { localStorage.setItem('tm.view', view); }, [view]);
  useEffect(() => {
    try { localStorage.setItem('tm.tweaks', JSON.stringify(tweaks)); } catch (_) {}
  }, [tweaks]);

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
    applyPalette(tweaks.palette);
    if (!rootApp) return;
    rootApp.classList.remove('tm-paper');
    rootApp.style.backgroundImage = '';
    if (tweaks.rules === 'lines') rootApp.classList.add('tm-paper');
    else if (tweaks.rules === 'grid') {
      rootApp.style.backgroundImage = `
        repeating-linear-gradient(to right, transparent 0 31px, var(--rule-soft) 31px 32px),
        repeating-linear-gradient(to bottom, transparent 0 31px, var(--rule-soft) 31px 32px)
      `;
    }
  }, [tweaks.palette, tweaks.rules]);

  const setTweak = (k, v) => setTweaks(prev => ({ ...prev, [k]: v }));

  const handleToggle = (id) => api.tasks.toggleComplete(id);
  const handleDelete = (id) => api.tasks.remove(id);
  const handleEdit = (id) => setEditingTaskId(prev => (prev === id ? null : id));
  const handleSaveEdit = (id, updates) => {
    api.tasks.update(id, updates);
    setEditingTaskId(null);
  };
  const handleAddTask = (data) => api.tasks.add(data);

  const { todayDone, todayTotal, pushed } = derived.stats;
  const hasSlots = (state.slots?.length || 0) > 0;
  const hasTasks = (state.tasks?.length || 0) > 0;
  const isEmpty = !hasSlots && !hasTasks;

  const rowHandlers = {
    onToggle: handleToggle,
    onDelete: handleDelete,
    onEdit: handleEdit,
    onSaveEdit: handleSaveEdit,
    editingTaskId,
  };

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
          <button
            className="tm-btn tm-sm"
            onClick={() => setWheelsPanelOpen(true)}
            title="save today as a wheel, pick a starter, apply to dates"
          >
            wheels
          </button>
          <span className="tm-mono tm-md">
            {todayDone} of {todayTotal} today · {pushed} pushed
          </span>
        </div>
      </div>

      <div className="tm-subhead">
        {VIEW_LABELS[view].title} <span className="tm-sub">— {VIEW_LABELS[view].sub}</span>
      </div>

      <div style={{ marginBottom: 18 }}>
        <TaskComposer onAdd={handleAddTask} taskTypes={state.taskTypes || []} />
        {!hasSlots && (
          <div className="tm-mono tm-md" style={{ marginTop: 6, color: 'var(--ink-mute)' }}>
            tip: add time blocks in the <button
              type="button"
              onClick={() => setView('wheel')}
              style={{ background: 'none', border: 'none', color: 'var(--orange)', cursor: 'pointer', padding: 0, textDecoration: 'underline', font: 'inherit' }}
            >wheel view</button> so new tasks auto-route into them.
          </div>
        )}
      </div>

      {isEmpty && <EmptyStateHint />}

      {view === 'gauge' && (
        <GaugeView
          load={derived.load}
          next={derived.next}
          pressure={derived.pressure}
          timeline={derived.timeline}
          stats={derived.stats}
          showCoach={tweaks.showCoach}
          currentSlot={derived.currentSlot}
          todayTasks={derived.todayTasks}
          rowHandlers={rowHandlers}
          onNavigate={setView}
        />
      )}
      {view === 'wheel' && (
        <WheelView
          wedges={derived.wedges}
          nowTask={derived.nowTask}
          upcoming={derived.upcoming}
          pushed={derived.pushed}
          slots={state.slots || []}
          taskTypes={state.taskTypes || []}
          todayTasks={derived.todayTasks}
          dayOverrides={derived.dayOverrides}
          api={api}
          rowHandlers={rowHandlers}
          onNavigate={setView}
          onOpenWheels={() => setWheelsPanelOpen(true)}
        />
      )}
      {view === 'fit' && (
        <FitView
          weekFit={derived.weekFit}
          backlog={derived.backlog}
          taskTypes={state.taskTypes || []}
          api={api}
          rowHandlers={rowHandlers}
          onNavigate={setView}
        />
      )}
      {view === 'calendar' && (
        <CalendarView
          wheels={derived.wheels}
          slots={state.slots || []}
          dayAssignments={derived.dayAssignments}
          dayOverrides={derived.dayOverrides}
          api={api}
          onNavigate={setView}
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

      {!tweaksOpen && (
        <button className="tm-tweaks-toggle" onClick={() => setTweaksOpen(true)}>
          tweaks
        </button>
      )}
      {tweaksOpen && (
        <TweaksPanel
          tweaks={tweaks}
          setTweak={setTweak}
          api={api}
          derivedLoad={derived.load}
          hasSlots={hasSlots}
          onClose={() => setTweaksOpen(false)}
        />
      )}
    </div>
  );
}

function EmptyStateHint() {
  return (
    <div className="tm-card tm-dashed" style={{ padding: '16px 20px', marginBottom: 18 }}>
      <div style={{ fontSize: 22 }}>empty slate — shape your day first</div>
      <div className="tm-mono" style={{ marginTop: 4 }}>
        add time blocks in the wheel view (morning, deep work, lunch…), then type a task above. tasks flow into the right block automatically; overflow pushes to the next available slot.
      </div>
    </div>
  );
}

function TweaksPanel({ tweaks, setTweak, api, derivedLoad, hasSlots, onClose }) {
  const fileRef = useRef(null);
  const [status, setStatus] = useState(null);

  const pick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await api.backup.restoreJSON(reader.result);
        setStatus('restored from backup');
      } catch (err) {
        setStatus(`restore failed: ${err.message}`);
      }
      setTimeout(() => setStatus(null), 3000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmWipe = async () => {
    if (!window.confirm('delete all tasks and time blocks? this cannot be undone.')) return;
    await api.backup.wipe();
    setStatus('wiped');
    setTimeout(() => setStatus(null), 2000);
  };

  return (
    <div className="tm-tweaks">
      <h4 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        tweaks
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', fontFamily: 'Caveat', fontSize: 18, cursor: 'pointer', color: 'var(--ink-mute)' }}
        >×</button>
      </h4>

      <div className="tm-mono tm-md" style={{ marginTop: 2 }}>
        load: {derivedLoad}% {hasSlots ? '· live' : '· no blocks yet'}
      </div>

      <label>
        show coach
        <input
          type="checkbox"
          checked={!!tweaks.showCoach}
          onChange={(e) => setTweak('showCoach', e.target.checked)}
        />
      </label>

      <div>
        <div className="tm-mono tm-md" style={{ marginTop: 6 }}>palette</div>
        <div className="tm-seg">
          {['warm', 'cool', 'dusk'].map(p => (
            <button
              key={p}
              className={tweaks.palette === p ? 'tm-on' : ''}
              onClick={() => setTweak('palette', p)}
            >
              {p === 'warm' ? 'warm cream' : p === 'cool' ? 'cool paper' : 'dusk'}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="tm-mono tm-md" style={{ marginTop: 8 }}>rules</div>
        <div className="tm-seg">
          {['lines', 'grid', 'blank'].map(r => (
            <button
              key={r}
              className={tweaks.rules === r ? 'tm-on' : ''}
              onClick={() => setTweak('rules', r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--rule)' }}>
        <div className="tm-mono tm-md">backup</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          <button
            className="tm-btn tm-sm"
            onClick={() => api.backup.exportICS()}
            title="iCalendar file for Google, Apple, Outlook"
          >
            export .ics
          </button>
          <button className="tm-btn tm-sm" onClick={() => api.backup.exportJSON()}>
            export .json
          </button>
          <button className="tm-btn tm-sm" onClick={() => fileRef.current?.click()}>
            restore .json
          </button>
          <button className="tm-btn tm-sm tm-danger" onClick={confirmWipe}>
            wipe
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={pick}
            style={{ display: 'none' }}
          />
        </div>
        {status && <div className="tm-mono tm-sm" style={{ marginTop: 6, color: 'var(--orange)' }}>{status}</div>}
      </div>
    </div>
  );
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
