import React, { useEffect, useRef, useState } from 'react';
import GaugeView from './GaugeView.jsx';
import WheelView from './WheelView.jsx';
import FitView from './FitView.jsx';
import { useTaskometerAPI } from '../services/api';
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
  loadOverride: null, // only used when there are no real slots
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

  const { state, api, derived } = useTaskometerAPI({
    loadOverride: tweaks.loadOverride,
  });

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

  const { todayDone, todayTotal, pushed } = derived.stats;
  const isEmpty = (state.tasks?.length || 0) === 0 && (state.slots?.length || 0) === 0;

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
          <span className="tm-mono tm-md">
            {todayDone} of {todayTotal} today · {pushed} pushed
          </span>
        </div>
      </div>

      <div className="tm-subhead">
        {VIEW_LABELS[view].title} <span className="tm-sub">— {VIEW_LABELS[view].sub}</span>
      </div>

      {isEmpty && <EmptyStateHint api={api} />}

      {view === 'gauge' && (
        <GaugeView
          load={derived.load}
          next={derived.next}
          pressure={derived.pressure}
          timeline={derived.timeline}
          stats={derived.stats}
          showCoach={tweaks.showCoach}
          onToggle={handleToggle}
          onNavigate={setView}
        />
      )}
      {view === 'wheel' && (
        <WheelView
          wedges={derived.wedges}
          nowTask={derived.nowTask}
          upcoming={derived.upcoming}
          pushed={derived.pushed}
          onToggle={handleToggle}
          onNavigate={setView}
        />
      )}
      {view === 'fit' && (
        <FitView
          weekFit={derived.weekFit}
          backlog={derived.backlog}
          onToggle={handleToggle}
          onNavigate={setView}
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
          hasSlots={(state.slots?.length || 0) > 0}
          onClose={() => setTweaksOpen(false)}
        />
      )}
    </div>
  );
}

function EmptyStateHint({ api }) {
  return (
    <div className="tm-card tm-dashed" style={{ padding: '16px 20px', marginBottom: 18 }}>
      <div style={{ fontSize: 22 }}>empty slate — nothing scheduled yet</div>
      <div className="tm-mono" style={{ marginTop: 4 }}>
        add your first task, or drop in a sample to see how things work.
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button
          className="tm-btn tm-primary tm-sm"
          onClick={() => seedDemoData(api)}
        >
          add sample tasks
        </button>
        <button
          className="tm-btn tm-sm"
          onClick={() => api.backup.exportICS()}
        >
          export calendar
        </button>
      </div>
    </div>
  );
}

async function seedDemoData(api) {
  const today = new Date();
  const mk = (h, title, type, dur = 30) => {
    const d = new Date(today);
    d.setHours(h, 0, 0, 0);
    return {
      text: title,
      primaryType: type,
      duration: dur,
      status: 'pending',
      scheduledTime: d.toISOString(),
    };
  };
  const ymd = (d) => {
    const dd = new Date(d);
    const m = dd.getMonth() + 1;
    const day = dd.getDate();
    return `${dd.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
  };
  const dayKey = ymd(today);
  const demoSlots = [
    { date: dayKey, startTime: '08:00', endTime: '09:00', label: 'morning',   slotType: 'routine' },
    { date: dayKey, startTime: '09:00', endTime: '12:00', label: 'deep work', slotType: 'deep' },
    { date: dayKey, startTime: '12:00', endTime: '13:00', label: 'lunch',     slotType: 'break' },
    { date: dayKey, startTime: '13:00', endTime: '15:00', label: 'meetings',  slotType: 'mtgs' },
    { date: dayKey, startTime: '15:00', endTime: '17:00', label: 'admin',     slotType: 'admin' },
    { date: dayKey, startTime: '17:00', endTime: '18:00', label: 'workout',   slotType: 'play' },
  ];
  for (const s of demoSlots) await api.slots.add(s);

  const demoTasks = [
    mk(9, 'finish Q2 planning doc', 'deep', 90),
    mk(11, 'reply to Sam re: contract', 'deep', 30),
    mk(13, 'standup', 'mtgs', 15),
    mk(14, '1:1 with Dana', 'mtgs', 30),
    mk(15, 'review PRs', 'admin', 45),
    mk(17, 'workout', 'play', 45),
    { text: 'draft blog post outline', primaryType: 'deep', duration: 60, status: 'pending' },
    { text: 'call mom', primaryType: 'calls', duration: 20, status: 'pending' },
    { text: "plan Josie's birthday", primaryType: 'play', duration: 45, status: 'pending' },
  ];
  for (const t of demoTasks) await api.tasks.add(t);
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
        load: {derivedLoad}% {hasSlots ? '· live' : '· demo'}
      </div>
      {!hasSlots && (
        <label>
          preview load
          <input
            type="range"
            min="0"
            max="120"
            value={tweaks.loadOverride ?? 0}
            onChange={(e) => setTweak('loadOverride', +e.target.value)}
          />
        </label>
      )}

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
