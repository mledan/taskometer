import React from 'react';
import { SectionLabel } from './shared.jsx';

export default function GaugeView({ load, tasks, onToggle, showCoach, onNavigate }) {
  const angle = 180 + Math.min(120, Math.max(0, load)) / 120 * 180;

  const next = tasks.find(t => t.now) || tasks[0] || { title: 'nothing scheduled', note: 'add a task to begin' };

  const days = [
    { d: 'M', h: 42, hot: false },
    { d: 'T', h: 55, hot: false },
    { d: 'W', h: 95, hot: true },
    { d: 'T', h: 110, hot: true },
    { d: 'F', h: 70, hot: false },
    { d: 'S', h: 30, hot: false },
    { d: 'S', h: 25, hot: false },
    { d: 'M', h: 50, hot: false },
    { d: 'T', h: 60, hot: false },
    { d: 'W', h: 90, hot: true },
    { d: 'T', h: 105, hot: true },
    { d: 'F', h: 72, hot: false },
    { d: 'S', h: 35, hot: false },
    { d: 'N', h: load, hot: load > 85, now: true },
  ];

  const slots = [
    { label: 'morning', start: 6, end: 8, kind: 'light' },
    { label: 'deep work', start: 9, end: 13, kind: 'hot', current: true },
    { label: 'lunch', start: 13, end: 14, kind: 'blank' },
    { label: 'meetings', start: 14, end: 18, kind: 'light' },
    { label: 'errands', start: 18, end: 23, kind: 'blank' },
  ];

  return (
    <div className="tm-fade-up">
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginTop: 20, marginBottom: 10 }}>
        <GaugeSvg angle={angle} load={load} />
      </div>

      <div style={{ textAlign: 'center', marginTop: -10, marginBottom: 24 }}>
        <div className="tm-mono tm-md" style={{ letterSpacing: '.14em', color: 'var(--orange)', textTransform: 'uppercase' }}>
          next · in 23 min · deep work 11a–1p
        </div>
        <div style={{ fontSize: 44, lineHeight: 1.05, marginTop: 4, marginBottom: 4 }}>{next.title}</div>
        <div className="tm-mono tm-md">{next.note || `est ${next.est || 45}m remaining`}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14 }}>
          <button className="tm-btn tm-primary">resume</button>
          <button className="tm-btn">do later</button>
          <button className="tm-btn" onClick={() => next.id && onToggle && onToggle(next.id)}>done</button>
        </div>
      </div>

      <div className="tm-mb-lg">
        <SectionLabel right={`4 overworked · avg 62%`}>Pressure · last 14 days</SectionLabel>
        <div className="tm-card tm-soft" style={{ padding: '14px 16px' }}>
          <PressureBars days={days} />
        </div>
      </div>

      {showCoach && (
        <div className="tm-card tm-dashed tm-mb-lg" style={{ padding: '14px 18px' }}>
          <div className="tm-coach-quote">
            noticed: <b>wed + thu</b> ran hot this week and last. want to shift one <i>deep work</i> block to mon or fri?
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button className="tm-btn tm-sage tm-sm">try it</button>
            <button className="tm-btn tm-sm">what's going on?</button>
            <button className="tm-btn tm-ghost tm-sm">dismiss</button>
          </div>
        </div>
      )}

      <div>
        <SectionLabel right="5 slots · 3 full · 2 open">Today</SectionLabel>
        <DayTimeline slots={slots} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 32, alignItems: 'baseline' }}>
        <button className="tm-btn tm-ghost tm-sm" onClick={() => onNavigate('wheel')}>day wheel →</button>
        <button className="tm-btn tm-ghost tm-sm" onClick={() => onNavigate('fit')}>week fit →</button>
      </div>
    </div>
  );
}

function GaugeSvg({ angle, load }) {
  const cx = 200, cy = 200, r = 165;
  const ticks = [];
  for (let i = 0; i <= 12; i++) {
    const t = 180 + (i / 12) * 180;
    const rad = t * Math.PI / 180;
    const x1 = cx + Math.cos(rad) * (r - 8);
    const y1 = cy + Math.sin(rad) * (r - 8);
    const x2 = cx + Math.cos(rad) * (r + 4);
    const y2 = cy + Math.sin(rad) * (r + 4);
    ticks.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" />);
  }

  const arcPath = (startPct, endPct, offset = 0) => {
    const a0 = (180 + (startPct / 120) * 180) * Math.PI / 180;
    const a1 = (180 + (endPct / 120) * 180) * Math.PI / 180;
    const rr = r + offset;
    const x0 = cx + Math.cos(a0) * rr;
    const y0 = cy + Math.sin(a0) * rr;
    const x1 = cx + Math.cos(a1) * rr;
    const y1 = cy + Math.sin(a1) * rr;
    return `M${x0} ${y0} A${rr} ${rr} 0 0 1 ${x1} ${y1}`;
  };

  const stroke = 22;

  return (
    <svg width="420" height="240" viewBox="0 0 400 230" style={{ overflow: 'visible' }}>
      <g opacity="0.7" transform="translate(1.5, 2.5)">
        <path d={arcPath(0, 60)} stroke="var(--sage)" strokeWidth={stroke} fill="none" strokeLinecap="butt" />
        <path d={arcPath(60, 80)} stroke="var(--sand)" strokeWidth={stroke} fill="none" strokeLinecap="butt" />
        <path d={arcPath(80, 120)} stroke="var(--orange-soft)" strokeWidth={stroke} fill="none" strokeLinecap="butt" />
      </g>
      <path d={arcPath(0, 120)} stroke="var(--ink)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {ticks}

      <text x="55" y="210" fontFamily="Caveat" fontSize="20" fill="var(--sage)" fontStyle="italic">room</text>
      <text x="200" y="25" fontFamily="Caveat" fontSize="20" fill="var(--sand)" fontStyle="italic" textAnchor="middle">tight</text>
      <text x="345" y="210" fontFamily="Caveat" fontSize="20" fill="var(--orange)" fontStyle="italic">overflow</text>

      <g style={{ transformOrigin: `${cx}px ${cy}px`, transform: `rotate(${angle}deg)`, transition: 'transform .7s cubic-bezier(.34,1.56,.64,1)' }}>
        <line x1={cx} y1={cy} x2={cx + r * 0.88} y2={cy} stroke="var(--orange)" strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx + r * 0.88} cy={cy} r="3.5" fill="var(--orange)" />
      </g>

      <circle cx={cx} cy={cy} r="9" fill="var(--paper)" stroke="var(--ink)" strokeWidth="2" />
      <circle cx={cx} cy={cy} r="3" fill="var(--ink)" />

      <text x={cx} y={cy + 64} fontFamily="Caveat" fontSize="28" fill="var(--ink)" textAnchor="middle" fontStyle="italic">
        {Math.round(load)}%
      </text>
    </svg>
  );
}

function PressureBars({ days }) {
  const max = 130;
  return (
    <div>
      <div style={{ position: 'relative', height: 100, display: 'flex', alignItems: 'flex-end', gap: 6 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: (100 / max) * 100, height: 0, borderTop: '1.5px dashed var(--orange)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 0, bottom: (100 / max) * 100 + 2 }} className="tm-mono">overflow</div>

        {days.map((d, i) => {
          const h = Math.min(max, d.h) / max * 100;
          const bg = d.now ? 'var(--ink)' : (d.hot ? 'var(--orange)' : 'var(--sage-pale)');
          const bd = d.hot ? 'var(--orange)' : (d.now ? 'var(--ink)' : 'var(--sage)');
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ width: '100%', height: `${h}%`, background: bg, border: `1.5px solid ${bd}`, borderRadius: 3, minHeight: 4, transition: 'height .5s ease' }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        {days.map((d, i) => (
          <div key={i} className="tm-mono tm-sm" style={{ flex: 1, textAlign: 'center', color: d.now ? 'var(--orange)' : 'var(--ink-mute)', fontWeight: d.now ? 500 : 400 }}>
            {d.now ? 'now' : d.d}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayTimeline({ slots }) {
  const startHr = 6, endHr = 23;
  const total = endHr - startHr;
  return (
    <div className="tm-card tm-flush" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', height: 58, position: 'relative' }}>
        {slots.map((s, i) => {
          const w = ((s.end - s.start) / total) * 100;
          let bg = 'transparent';
          if (s.kind === 'hot') bg = 'var(--orange-pale)';
          else if (s.kind === 'light') bg = 'var(--sage-pale)';
          return (
            <div
              key={i}
              style={{
                width: `${w}%`,
                background: bg,
                borderRight: i < slots.length - 1 ? '1px dashed var(--rule)' : 'none',
                padding: '8px 10px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ fontSize: 18, lineHeight: 1.05 }}>{s.label}</div>
              {s.current && (
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: '18%', width: 3, background: 'var(--orange)', boxShadow: '0 0 0 1px var(--paper)' }} />
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', padding: '2px 0 6px' }}>
        {['6a', '', '', '12p', '', '', '6p', '', '11p'].map((t, i) => (
          <div key={i} className="tm-mono tm-sm" style={{ flex: 1, textAlign: 'left', paddingLeft: 6 }}>{t}</div>
        ))}
      </div>
    </div>
  );
}
