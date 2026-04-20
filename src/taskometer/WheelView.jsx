import React from 'react';
import { TaskRow } from './shared.jsx';

export default function WheelView({ tasks, onToggle, onNavigate }) {
  const wedges = [
    { label: 'sleep', start: 0, end: 6, kind: 'rest' },
    { label: 'morning', start: 6, end: 8, kind: 'light', count: 2 },
    { label: 'breakfast', start: 8, end: 9, kind: 'blank' },
    { label: 'deep work', start: 9, end: 12, kind: 'hot', count: 3, current: true },
    { label: 'lunch', start: 12, end: 13, kind: 'blank' },
    { label: 'meetings', start: 13, end: 15, kind: 'light', count: 2 },
    { label: 'admin', start: 15, end: 17, kind: 'light', count: 1 },
    { label: 'workout', start: 17, end: 18, kind: 'light' },
    { label: 'family', start: 18, end: 21, kind: 'soft' },
    { label: 'wind down', start: 21, end: 24, kind: 'rest' },
  ];

  const now = tasks.find(t => t.now);
  const upcoming = tasks.filter(t => !t.now && t.status === 'open').slice(0, 2);
  const pushed = tasks.filter(t => t.status === 'pushed').slice(0, 2);

  return (
    <div className="tm-fade-up tm-grid-2" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 28, alignItems: 'start' }}>
      <div style={{ position: 'relative' }}>
        <WheelSvg wedges={wedges} nowHour={11 + 23 / 60} />
      </div>

      <div style={{ paddingTop: 8 }}>
        <div className="tm-mono tm-md" style={{ color: 'var(--orange)', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 6 }}>
          now · deep work · 9a–12p
        </div>
        <div className="tm-card tm-flush" style={{ marginBottom: 20 }}>
          {now && (
            <TaskRow
              task={{ ...now, title: now.title || 'finish Q2 planning doc' }}
              onToggle={onToggle}
              metaOverride="in progress · 23m left"
            />
          )}
          {upcoming.map(t => <TaskRow key={t.id} task={t} onToggle={onToggle} />)}
        </div>

        <div className="tm-mono tm-md" style={{ letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 4 }}>up next · lunch · 12p</div>
        <div className="tm-mono tm-md" style={{ letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 6 }}>moved to tomorrow</div>
        <div className="tm-card tm-dashed tm-flush" style={{ background: 'rgba(242,196,166,0.18)', borderColor: 'var(--ink-mute)' }}>
          {pushed.length > 0
            ? pushed.map(t => <TaskRow key={t.id} task={t} onToggle={onToggle} />)
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

function WheelSvg({ wedges, nowHour = 11.4 }) {
  const cx = 220, cy = 220, rOuter = 200, rInner = 78;
  const labelR = (rOuter + rInner) / 2;

  const ang = (h) => (h / 24) * 360 - 90;
  const polar = (h, r) => {
    const a = ang(h) * Math.PI / 180;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };

  const wedgePath = (start, end, rO = rOuter, rI = rInner) => {
    const [x0, y0] = polar(start, rO);
    const [x1, y1] = polar(end, rO);
    const [x2, y2] = polar(end, rI);
    const [x3, y3] = polar(start, rI);
    const large = (end - start) > 12 ? 1 : 0;
    return `M${x0} ${y0} A${rO} ${rO} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${rI} ${rI} 0 ${large} 0 ${x3} ${y3} Z`;
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
          <g key={i}>
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
      <text x={10} y={cy + 4} fontFamily="Caveat" fontSize="18" fill="var(--ink-mute)" fontStyle="italic">18p</text>
      <text x={420} y={cy + 4} fontFamily="Caveat" fontSize="18" fill="var(--ink-mute)" fontStyle="italic">6a</text>

      <line x1={cx} y1={cy} x2={nxEnd} y2={nyEnd} stroke="var(--orange)" strokeWidth="2" opacity="0.5" />
      <circle cx={nxEnd} cy={nyEnd} r="5" fill="var(--orange)" />

      <text x={cx} y={cy - 14} fontFamily="JetBrains Mono" fontSize="10" fill="var(--ink-mute)" textAnchor="middle" letterSpacing="2">TODAY</text>
      <text x={cx} y={cy + 10} fontFamily="Caveat" fontSize="26" fill="var(--ink)" textAnchor="middle" fontStyle="italic">6 of 9</text>
      <text x={cx} y={cy + 28} fontFamily="JetBrains Mono" fontSize="9" fill="var(--ink-mute)" textAnchor="middle" letterSpacing="1">3 pushed · 0 dropped</text>
    </svg>
  );
}
