import React, { useEffect, useMemo, useState } from 'react';
import GaugeView from './GaugeView.jsx';
import WheelView from './WheelView.jsx';
import FitView from './FitView.jsx';
import { SAMPLE_TASKS, adaptTask } from './shared.jsx';
import './taskometer.css';

const VIEW_LABELS = {
  gauge: { title: 'today', sub: 'load + pressure' },
  wheel: { title: 'wheel', sub: '24h slots' },
  fit: { title: 'fit', sub: 'week capacity' },
};

const DEFAULT_TWEAKS = {
  palette: 'warm',
  rules: 'lines',
  showCoach: true,
  load: 62,
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

export default function Taskometer({ tasks: externalTasks, onToggleTask }) {
  const [view, setView] = useState(() => localStorage.getItem('tm.view') || 'gauge');
  const [tweaks, setTweaks] = useState(readStoredTweaks);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [localToggles, setLocalToggles] = useState({});

  useEffect(() => { localStorage.setItem('tm.view', view); }, [view]);
  useEffect(() => {
    try { localStorage.setItem('tm.tweaks', JSON.stringify(tweaks)); } catch (_) {}
  }, [tweaks]);

  // Apply palette vars + rule background
  useEffect(() => {
    document.body.classList.add('tm-body');
    const rootApp = document.getElementById('tm-root-frame');

    if (tweaks.palette === 'cool') {
      document.documentElement.style.setProperty('--paper', '#F5F3EE');
      document.documentElement.style.setProperty('--paper-warm', '#EDEAE2');
      document.documentElement.style.setProperty('--ink', '#1C1A16');
      document.documentElement.style.setProperty('--ink-soft', '#4A433C');
      document.documentElement.style.setProperty('--ink-mute', '#8A8078');
      document.documentElement.style.setProperty('--rule-soft', '#DFDCD2');
      document.documentElement.style.setProperty('--rule', '#CFCCC0');
    } else if (tweaks.palette === 'dusk') {
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

    if (!rootApp) return;
    rootApp.classList.remove('tm-paper');
    rootApp.style.backgroundImage = '';
    if (tweaks.rules === 'lines') {
      rootApp.classList.add('tm-paper');
    } else if (tweaks.rules === 'grid') {
      rootApp.style.backgroundImage = `
        repeating-linear-gradient(to right, transparent 0 31px, var(--rule-soft) 31px 32px),
        repeating-linear-gradient(to bottom, transparent 0 31px, var(--rule-soft) 31px 32px)
      `;
    }
  }, [tweaks.palette, tweaks.rules]);

  // Build task view model
  const tasks = useMemo(() => {
    const source = (externalTasks && externalTasks.length > 0) ? externalTasks : SAMPLE_TASKS;
    return source
      .map((t, i) => adaptTask(t, i))
      .filter(Boolean)
      .map(t => ({ ...t, done: localToggles[t.id] != null ? localToggles[t.id] : !!t.done }));
  }, [externalTasks, localToggles]);

  const handleToggle = (id) => {
    if (onToggleTask) {
      onToggleTask(id);
      return;
    }
    setLocalToggles(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const setTweak = (k, v) => setTweaks(prev => ({ ...prev, [k]: v }));

  const nowLabel = useMemo(() => formatNowLabel(), []);

  return (
    <div id="tm-root-frame" className="tm-root tm-paper">
      <header className="tm-hdr">
        <div className="tm-logo">taskometer</div>
        <div className="tm-hdr-meta">
          <span className="tm-mono tm-md">{nowLabel}</span>
        </div>
      </header>

      <div className="tm-tabs">
        {['gauge', 'wheel', 'fit'].map(v => (
          <button
            key={v}
            className={`tm-tab${view === v ? ' tm-active' : ''}`}
            onClick={() => setView(v)}
          >
            {v}
          </button>
        ))}
        <div className="tm-tabs-right">
          <span className="tm-mono tm-md">{tasks.filter(t => t.done).length} of {tasks.length} today · {tasks.filter(t => t.status === 'pushed').length} pushed</span>
        </div>
      </div>

      <div className="tm-subhead">
        {VIEW_LABELS[view].title} <span className="tm-sub">— {VIEW_LABELS[view].sub}</span>
      </div>

      {view === 'gauge' && (
        <GaugeView
          load={tweaks.load}
          tasks={tasks}
          onToggle={handleToggle}
          showCoach={tweaks.showCoach}
          onNavigate={setView}
        />
      )}
      {view === 'wheel' && (
        <WheelView tasks={tasks} onToggle={handleToggle} onNavigate={setView} />
      )}
      {view === 'fit' && (
        <FitView tasks={tasks} onToggle={handleToggle} onNavigate={setView} />
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
          onClose={() => setTweaksOpen(false)}
        />
      )}
    </div>
  );
}

function TweaksPanel({ tweaks, setTweak, onClose }) {
  return (
    <div className="tm-tweaks">
      <h4 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        tweaks
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', fontFamily: 'Caveat', fontSize: 18, cursor: 'pointer', color: 'var(--ink-mute)' }}
        >×</button>
      </h4>
      <label>
        load <span>{tweaks.load}%</span>
        <input
          type="range"
          min="0"
          max="120"
          value={tweaks.load}
          onChange={(e) => setTweak('load', +e.target.value)}
        />
      </label>
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
    </div>
  );
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
