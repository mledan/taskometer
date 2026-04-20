import React from 'react';
import { SectionLabel } from './shared.jsx';

export default function GaugeView({
  load,
  next,
  pressure,
  timeline,
  stats,
  showCoach,
  onToggle,
  onNavigate,
}) {
  const angle = 180 + Math.min(120, Math.max(0, load)) / 120 * 180;
  const nextLabel = buildNextLabel(next);

  return (
    <div className="tm-fade-up">
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginTop: 20, marginBottom: 10 }}>
        <GaugeSvg angle={angle} load={load} />
      </div>

      <div style={{ textAlign: 'center', marginTop: -10, marginBottom: 24 }}>
        <div className="tm-mono tm-md" style={{ letterSpacing: '.14em', color: 'var(--orange)', textTransform: 'uppercase' }}>
          {nextLabel.meta}
        </div>
        <div style={{ fontSize: 44, lineHeight: 1.05, marginTop: 4, marginBottom: 4 }}>
          {nextLabel.title}
        </div>
        <div className="tm-mono tm-md">{nextLabel.note}</div>
        {next && (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14 }}>
            <button className="tm-btn tm-primary">resume</button>
            <button className="tm-btn">do later</button>
            <button className="tm-btn" onClick={() => onToggle && onToggle(next.id || next.key)}>done</button>
          </div>
        )}
      </div>

      <div className="tm-mb-lg">
        <SectionLabel right={pressureSummary(pressure)}>Pressure · last {pressure.length} days</SectionLabel>
        <div className="tm-card tm-soft" style={{ padding: '14px 16px' }}>
          <PressureBars days={pressure} />
        </div>
      </div>

      {showCoach && <CoachCard pressure={pressure} />}

      <div>
        <SectionLabel right={timelineSummary(timeline)}>Today</SectionLabel>
        <DayTimeline slots={timeline} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 32, alignItems: 'baseline' }}>
        <button className="tm-btn tm-ghost tm-sm" onClick={() => onNavigate('wheel')}>day wheel →</button>
        <button className="tm-btn tm-ghost tm-sm" onClick={() => onNavigate('fit')}>week fit →</button>
      </div>
    </div>
  );
}

function buildNextLabel(next) {
  if (!next) {
    return {
      meta: 'nothing scheduled',
      title: 'add a task to begin',
      note: 'tap a slot on the day wheel or the fit view to plan',
    };
  }
  if (next.scheduledTime) {
    const d = new Date(next.scheduledTime);
    const diffMin = Math.round((d.getTime() - Date.now()) / 60000);
    const windowLabel = formatWindow(d, next.duration || 30);
    let meta;
    if (diffMin < -1) meta = `in progress · ${windowLabel}`;
    else if (diffMin <= 0) meta = `starting now · ${windowLabel}`;
    else meta = `next · in ${diffMin} min · ${windowLabel}`;
    return {
      meta: meta.toLowerCase(),
      title: next.text || next.title || 'untitled',
      note: next.description ? next.description : `est ${next.duration || 30}m`,
    };
  }
  return {
    meta: 'next (unscheduled)',
    title: next.text || next.title || 'untitled',
    note: `est ${next.duration || 30}m · not yet slotted`,
  };
}

function formatWindow(start, durationMin) {
  const end = new Date(start.getTime() + durationMin * 60 * 1000);
  const fmt = (d) => {
    const h = d.getHours();
    const hr = ((h % 12) || 12);
    const ampm = h < 12 ? 'a' : 'p';
    const m = d.getMinutes();
    return m ? `${hr}:${m < 10 ? '0' + m : m}${ampm}` : `${hr}${ampm}`;
  };
  return `${fmt(start)}–${fmt(end)}`;
}

function pressureSummary(pressure) {
  const hot = pressure.filter(d => d.hot).length;
  const avg = Math.round(pressure.reduce((s, d) => s + d.h, 0) / Math.max(1, pressure.length));
  return `${hot} overworked · avg ${avg}%`;
}

function timelineSummary(timeline) {
  const full = timeline.filter(s => s.kind === 'hot' || s.kind === 'light').length;
  const open = timeline.filter(s => s.kind === 'blank').length;
  return `${timeline.length} slots · ${full} full · ${open} open`;
}

function CoachCard({ pressure }) {
  const hotDays = pressure.filter(d => d.hot && !d.now);
  const message = hotDays.length >= 2
    ? `noticed: ${hotDays.length} of your last ${pressure.length} days ran hot. want to shift a block to a lighter day?`
    : `looking good — only ${hotDays.length} hot day in the last ${pressure.length}. keep it up.`;

  return (
    <div className="tm-card tm-dashed tm-mb-lg" style={{ padding: '14px 18px' }}>
      <div className="tm-coach-quote">{message}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button className="tm-btn tm-sage tm-sm">try it</button>
        <button className="tm-btn tm-sm">what's going on?</button>
        <button className="tm-btn tm-ghost tm-sm">dismiss</button>
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

  const arcPath = (startPct, endPct) => {
    const a0 = (180 + (startPct / 120) * 180) * Math.PI / 180;
    const a1 = (180 + (endPct / 120) * 180) * Math.PI / 180;
    const x0 = cx + Math.cos(a0) * r;
    const y0 = cy + Math.sin(a0) * r;
    const x1 = cx + Math.cos(a1) * r;
    const y1 = cy + Math.sin(a1) * r;
    return `M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`;
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
  if (!slots.length) {
    return (
      <div className="tm-card tm-dashed" style={{ padding: '18px 16px', textAlign: 'center' }}>
        <div className="tm-mono">no slots yet — add a schedule to shape your day</div>
      </div>
    );
  }
  const startHr = Math.min(...slots.map(s => s.start), 6);
  const endHr = Math.max(...slots.map(s => s.end), 23);
  const total = endHr - startHr;
  return (
    <div className="tm-card tm-flush" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', height: 58, position: 'relative' }}>
        {slots.map((s, i) => {
          const w = ((s.end - s.start) / total) * 100;
          let bg = 'transparent';
          if (s.kind === 'hot') bg = 'var(--orange-pale)';
          else if (s.kind === 'light' || s.kind === 'soft') bg = 'var(--sage-pale)';
          else if (s.kind === 'rest') bg = '#EAE4DA';
          return (
            <div
              key={s.id || i}
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
    </div>
  );
}
