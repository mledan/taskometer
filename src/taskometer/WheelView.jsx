import React from 'react';
import { TaskRow } from './shared.jsx';

export default function WheelView({ wedges, nowTask, upcoming, pushed, onToggle, onNavigate }) {
  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const currentWedge = wedges.find(w => w.current);
  const currentLabel = currentWedge
    ? `now · ${currentWedge.label} · ${fmtHr(currentWedge.start)}–${fmtHr(currentWedge.end)}`
    : `now · ${fmtHr(nowHour)}`;

  const nowTaskRow = nowTask ? toRow(nowTask, { now: true }) : null;
  const upcomingRows = (upcoming || []).map(t => toRow(t));
  const pushedRows = (pushed || []).map(t => toRow(t, { pushed: true }));

  return (
    <div className="tm-fade-up tm-grid-2" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 28, alignItems: 'start' }}>
      <div style={{ position: 'relative' }}>
        <WheelSvg wedges={wedges} nowHour={nowHour} stats={computeStats(nowTask, upcoming, pushed)} />
      </div>

      <div style={{ paddingTop: 8 }}>
        <div className="tm-mono tm-md" style={{ color: 'var(--orange)', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 6 }}>
          {currentLabel.toLowerCase()}
        </div>
        <div className="tm-card tm-flush" style={{ marginBottom: 20 }}>
          {nowTaskRow && <TaskRow task={nowTaskRow} onToggle={onToggle} />}
          {upcomingRows.map(t => <TaskRow key={t.id} task={t} onToggle={onToggle} />)}
          {!nowTaskRow && upcomingRows.length === 0 && (
            <div style={{ padding: '14px 16px' }} className="tm-mono">nothing scheduled right now</div>
          )}
        </div>

        <div className="tm-mono tm-md" style={{ letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 4 }}>
          pushed to tomorrow
        </div>
        <div className="tm-card tm-dashed tm-flush" style={{ background: 'rgba(242,196,166,0.18)', borderColor: 'var(--ink-mute)' }}>
          {pushedRows.length > 0
            ? pushedRows.map(t => <TaskRow key={t.id} task={t} onToggle={onToggle} />)
            : <div style={{ padding: '12px 14px' }} className="tm-mono">nothing pushed yet</div>}
        </div>
      </div>

      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, alignItems: 'baseline', marginTop: 18, paddingTop: 14, borderTop: '1px dashed var(--rule)' }}>
        <button className="tm-btn tm-primary tm-sm">+ task</button>
        <button className="tm-btn tm-sm">edit day shape</button>
        <button className="tm-btn tm-sm" onClick={() => onNavigate('fit')}>week view</button>
        <span className="tm-mono tm-md" style={{ marginLeft: 'auto' }}>drag a task to any wedge to override</span>
      </div>
    </div>
  );
}

function toRow(t, extras = {}) {
  const dur = typeof t.duration === 'number' ? t.duration : 30;
  return {
    id: t.id || t.key,
    title: t.text || t.title || 'untitled',
    ctx: t.primaryType || t.taskType || 'task',
    when: t.scheduledTime ? fmtTimeRange(t.scheduledTime, dur) : 'unscheduled',
    status: extras.pushed ? 'pushed' : t.status,
    done: t.status === 'completed',
    now: !!extras.now,
    note: extras.now ? `in progress · ${dur}m` : null,
    duration: dur,
  };
}

function fmtTimeRange(iso, dur) {
  const d = new Date(iso);
  const end = new Date(d.getTime() + dur * 60 * 1000);
  return `${fmtClock(d)}–${fmtClock(end)}`;
}

function fmtClock(d) {
  const h = d.getHours();
  const hr = ((h % 12) || 12);
  const ampm = h < 12 ? 'a' : 'p';
  const m = d.getMinutes();
  return m ? `${hr}:${m < 10 ? '0' + m : m}${ampm}` : `${hr}${ampm}`;
}

function fmtHr(h) {
  const base = Math.floor(h) % 24;
  const mins = Math.round((h - Math.floor(h)) * 60);
  const hr = ((base % 12) || 12);
  const ampm = base < 12 ? 'a' : 'p';
  return mins ? `${hr}:${mins < 10 ? '0' + mins : mins}${ampm}` : `${hr}${ampm}`;
}

function computeStats(nowTask, upcoming, pushed) {
  const total = (upcoming?.length || 0) + (pushed?.length || 0) + (nowTask ? 1 : 0);
  const done = 0;
  return { total, done, pushed: pushed?.length || 0 };
}

function WheelSvg({ wedges, nowHour, stats }) {
  const cx = 220, cy = 220, rOuter = 200, rInner = 78;
  const labelR = (rOuter + rInner) / 2;

  const ang = (h) => (h / 24) * 360 - 90;
  const polar = (h, r) => {
    const a = ang(h) * Math.PI / 180;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };

  const wedgePath = (start, end) => {
    const [x0, y0] = polar(start, rOuter);
    const [x1, y1] = polar(end, rOuter);
    const [x2, y2] = polar(end, rInner);
    const [x3, y3] = polar(start, rInner);
    const large = (end - start) > 12 ? 1 : 0;
    return `M${x0} ${y0} A${rOuter} ${rOuter} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${rInner} ${rInner} 0 ${large} 0 ${x3} ${y3} Z`;
  };

  const hourTicks = [];
  for (let h = 0; h < 24; h++) {
    const [x1, y1] = polar(h, rOuter);
    const [x2, y2] = polar(h, rOuter + (h % 6 === 0 ? 10 : 5));
    hourTicks.push(<line key={h} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink)" strokeWidth={h % 6 === 0 ? 1.6 : 1} />);
  }

  const fillFor = (k, cur) => {
    if (cur) return 'var(--orange-pale)';
    if (k === 'hot') return 'var(--orange-pale)';
    if (k === 'light') return 'var(--sage-pale)';
    if (k === 'rest') return '#EAE4DA';
    if (k === 'soft') return '#F3EFE5';
    return 'var(--paper)';
  };

  const [nxEnd, nyEnd] = polar(nowHour, rOuter - 4);

  return (
    <svg width="100%" height="460" viewBox="0 0 440 440" style={{ maxWidth: 460 }}>
      {wedges.map((w, i) => {
        const [lx, ly] = polar((w.start + w.end) / 2, labelR);
        const isCurrent = w.current;
        return (
          <g key={w.id || i}>
            <path d={wedgePath(w.start, w.end)} fill={fillFor(w.kind, isCurrent)}
              stroke={isCurrent ? 'var(--ink)' : 'var(--rule)'}
              strokeWidth={isCurrent ? 2.2 : 1} />
            <text x={lx} y={ly - 2} fontFamily="Caveat" fontSize={isCurrent ? 22 : 18}
              fill="var(--ink)" textAnchor="middle"
              fontStyle={isCurrent ? 'italic' : 'normal'}
              fontWeight={isCurrent ? 600 : 400}>
              {w.label}
            </text>
            {w.count ? (
              <text x={lx} y={ly + 14} fontFamily="JetBrains Mono" fontSize="10"
                fill="var(--ink-mute)" textAnchor="middle">
                {w.count} task{w.count > 1 ? 's' : ''}
              </text>
            ) : null}
          </g>
        );
      })}

      <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="var(--ink)" strokeWidth="2" />
      <circle cx={cx} cy={cy} r={rInner} fill="var(--paper)" stroke="var(--ink)" strokeWidth="2" />
      {hourTicks}

      <text x={cx} y={18} fontFamily="Caveat" fontSize="18" fill="var(--ink-mute)" textAnchor="middle" fontStyle="italic">12a</text>
      <text x={cx} y={438} fontFamily="Caveat" fontSize="18" fill="var(--ink-mute)" textAnchor="middle" fontStyle="italic">12p</text>
      <text x={10} y={cy + 4} fontFamily="Caveat" fontSize="18" fill="var(--ink-mute)" fontStyle="italic">6p</text>
      <text x={420} y={cy + 4} fontFamily="Caveat" fontSize="18" fill="var(--ink-mute)" fontStyle="italic">6a</text>

      <line x1={cx} y1={cy} x2={nxEnd} y2={nyEnd} stroke="var(--orange)" strokeWidth="2" opacity="0.5" />
      <circle cx={nxEnd} cy={nyEnd} r="5" fill="var(--orange)" />

      <text x={cx} y={cy - 14} fontFamily="JetBrains Mono" fontSize="10" fill="var(--ink-mute)" textAnchor="middle" letterSpacing="2">TODAY</text>
      <text x={cx} y={cy + 10} fontFamily="Caveat" fontSize="26" fill="var(--ink)" textAnchor="middle" fontStyle="italic">
        {stats.done} of {stats.total}
      </text>
      <text x={cx} y={cy + 28} fontFamily="JetBrains Mono" fontSize="9" fill="var(--ink-mute)" textAnchor="middle" letterSpacing="1">
        {stats.pushed} pushed
      </text>
    </svg>
  );
}
