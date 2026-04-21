import React from 'react';
import { SectionLabel } from './shared.jsx';
import { TaskRowEditor } from './Composers.jsx';

export default function GaugeView({
  load,
  next,
  pressure,
  timeline,
  stats,
  showCoach,
  currentSlot,
  todayTasks = [],
  rowHandlers = {},
  onNavigate,
}) {
  const { onToggle, onDelete, onEdit, onSaveEdit, editingTaskId } = rowHandlers;
  const angle = 180 + Math.min(120, Math.max(0, load)) / 120 * 180;
  const nextLabel = buildNextLabel(next);
  const nextId = next ? (next.id || next.key) : null;
  const editingNext = nextId && editingTaskId === nextId;

  return (
    <div className="tm-fade-up">
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginTop: 20, marginBottom: 10 }}>
        <GaugeSvg angle={angle} load={load} />
      </div>

      <div style={{ textAlign: 'center', marginTop: -10, marginBottom: 24 }}>
        <div className="tm-mono tm-md" style={{ letterSpacing: '.14em', color: 'var(--orange)', textTransform: 'uppercase' }}>
          {nextLabel.meta}
        </div>
        {editingNext ? (
          <div style={{ maxWidth: 560, margin: '10px auto 0' }}>
            <TaskRowEditor
              task={next}
              onSave={(updates) => onSaveEdit && onSaveEdit(nextId, updates)}
              onCancel={() => onEdit && onEdit(nextId)}
              onDelete={() => onDelete && onDelete(nextId)}
            />
          </div>
        ) : (
          <>
            <div style={{ fontSize: 44, lineHeight: 1.05, marginTop: 4, marginBottom: 4 }}>
              {nextLabel.title}
            </div>
            <div className="tm-mono tm-md">{nextLabel.note}</div>
            {next && (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14 }}>
                <button className="tm-btn tm-primary" onClick={() => onToggle && onToggle(nextId)}>done</button>
                <button className="tm-btn" onClick={() => onEdit && onEdit(nextId)}>edit</button>
                <button className="tm-btn tm-danger" onClick={() => onDelete && onDelete(nextId)}>delete</button>
              </div>
            )}
          </>
        )}
      </div>

      <CurrentSlotSection
        currentSlot={currentSlot}
        next={next}
        rowHandlers={rowHandlers}
      />

      <TodayTasksSection
        todayTasks={todayTasks}
        rowHandlers={rowHandlers}
      />

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
    const dur = next.duration || 30;
    const diffMin = Math.round((d.getTime() - Date.now()) / 60000);
    const endMs = d.getTime() + dur * 60 * 1000;
    const isLive = d.getTime() <= Date.now() && Date.now() < endMs;
    const windowLabel = formatWindow(d, dur);
    let meta;
    if (isLive) meta = `in progress · ${windowLabel}`;
    else if (diffMin <= 1) meta = `starting now · ${windowLabel}`;
    else if (diffMin < 60) meta = `next · in ${diffMin} min · ${windowLabel}`;
    else if (diffMin < 24 * 60) {
      const hrs = Math.floor(diffMin / 60);
      const rem = diffMin % 60;
      meta = `later today · in ${hrs}h${rem ? ` ${rem}m` : ''} · ${windowLabel}`;
    } else {
      meta = `upcoming · ${windowLabel}`;
    }
    return {
      meta: meta.toLowerCase(),
      title: next.text || next.title || 'untitled',
      note: next.description ? next.description : `est ${dur}m`,
    };
  }
  return {
    meta: 'next (unscheduled)',
    title: next.text || next.title || 'untitled',
    note: `est ${next.duration || 30}m · not yet slotted`,
  };
}

function formatClock(d) {
  const h = d.getHours();
  const hr = ((h % 12) || 12);
  const ampm = h < 12 ? 'a' : 'p';
  const m = d.getMinutes();
  return m ? `${hr}:${m < 10 ? '0' + m : m}${ampm}` : `${hr}${ampm}`;
}

function taskWindowLabel(task) {
  if (!task?.scheduledTime) return 'unscheduled';
  const start = new Date(task.scheduledTime);
  if (Number.isNaN(start.getTime())) return 'unscheduled';
  const dur = typeof task.duration === 'number' ? task.duration : 30;
  const end = new Date(start.getTime() + dur * 60 * 1000);
  return `${formatClock(start)}–${formatClock(end)}`;
}

function CurrentSlotSection({ currentSlot, next, rowHandlers }) {
  const slot = currentSlot?.slot || null;
  const tasks = currentSlot?.tasks || [];
  const { onToggle, onDelete, onEdit } = rowHandlers || {};

  if (!slot) {
    return (
      <div className="tm-mb-lg">
        <SectionLabel right="no active slot">now</SectionLabel>
        <div className="tm-card tm-dashed" style={{ padding: '12px 14px' }}>
          <div className="tm-mono">
            no time block covers this moment — tasks you add will be placed in the
            next matching slot. add a block in the wheel view to shape the current hour.
          </div>
        </div>
      </div>
    );
  }

  const timeRange = `${slot.startTime}–${slot.endTime}`;
  const nextId = next ? (next.id || next.key) : null;

  return (
    <div className="tm-mb-lg">
      <SectionLabel right={`${tasks.length} in slot`}>
        now · {slot.label} · {timeRange}
      </SectionLabel>
      <div className="tm-card tm-flush">
        {tasks.length === 0 && (
          <div style={{ padding: '12px 14px' }} className="tm-mono">
            this slot is empty — add a {slot.slotType || slot.label} task above and
            it will drop in here.
          </div>
        )}
        {tasks.map(t => {
          const id = t.id || t.key;
          const isNow = id === nextId;
          return (
            <div
              key={id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderBottom: '1px solid var(--rule-soft)',
                background: isNow ? 'var(--orange-pale)' : 'transparent',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 20, lineHeight: 1.15 }}>
                  {t.text || t.title || 'untitled'}
                </div>
                <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
                  {taskWindowLabel(t)} · {t.primaryType || t.taskType || 'task'} · est {t.duration || 30}m
                  {isNow ? ' · now' : ''}
                </div>
              </div>
              {onToggle && (
                <button className="tm-btn tm-sm tm-primary" onClick={() => onToggle(id)}>done</button>
              )}
              {onEdit && (
                <button className="tm-btn tm-sm" onClick={() => onEdit(id)}>edit</button>
              )}
              {onDelete && (
                <button className="tm-btn tm-sm tm-danger" onClick={() => onDelete(id)}>×</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TodayTasksSection({ todayTasks = [], rowHandlers }) {
  const { onToggle, onDelete, onEdit } = rowHandlers || {};
  if (!todayTasks.length) {
    return (
      <div className="tm-mb-lg">
        <SectionLabel right="0 scheduled">today's tasks</SectionLabel>
        <div className="tm-card tm-dashed" style={{ padding: '12px 14px' }}>
          <div className="tm-mono">no tasks scheduled yet — add one above.</div>
        </div>
      </div>
    );
  }

  const counts = todayTasks.reduce((acc, t) => {
    acc[t.state] = (acc[t.state] || 0) + 1;
    return acc;
  }, {});
  const summary = [
    counts.live ? `${counts.live} now` : null,
    counts.upcoming ? `${counts.upcoming} upcoming` : null,
    counts.done ? `${counts.done} done` : null,
    counts.past ? `${counts.past} past` : null,
  ].filter(Boolean).join(' · ') || `${todayTasks.length} total`;

  return (
    <div className="tm-mb-lg">
      <SectionLabel right={summary}>today's tasks</SectionLabel>
      <div className="tm-card tm-flush">
        {todayTasks.map(({ task, state }) => {
          const id = task.id || task.key;
          let tint = 'transparent';
          if (state === 'live') tint = 'var(--orange-pale)';
          else if (state === 'past') tint = 'var(--rule-soft)';
          else if (state === 'done') tint = 'var(--sage-pale)';
          return (
            <div
              key={id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 14px',
                borderBottom: '1px solid var(--rule-soft)',
                background: tint,
                opacity: state === 'done' ? 0.6 : 1,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 18,
                    lineHeight: 1.2,
                    textDecoration: state === 'done' ? 'line-through' : 'none',
                  }}
                >
                  {task.text || task.title || 'untitled'}
                </div>
                <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
                  {taskWindowLabel(task)} · {task.primaryType || task.taskType || 'task'}
                  {state === 'live' ? ' · now' : ''}
                  {state === 'upcoming' ? ' · later' : ''}
                  {state === 'past' ? ' · past' : ''}
                </div>
              </div>
              {onToggle && (
                <button
                  className={`tm-btn tm-sm${state === 'done' ? '' : ' tm-primary'}`}
                  onClick={() => onToggle(id)}
                >
                  {state === 'done' ? 'undo' : 'done'}
                </button>
              )}
              {onEdit && (
                <button className="tm-btn tm-sm" onClick={() => onEdit(id)}>edit</button>
              )}
              {onDelete && (
                <button className="tm-btn tm-sm tm-danger" onClick={() => onDelete(id)}>×</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
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

      <text x="10" y="210" fontFamily="Caveat" fontSize="20" fill="var(--sage)" fontStyle="italic" textAnchor="start">free as a bird</text>
      <text x="200" y="25" fontFamily="Caveat" fontSize="20" fill="var(--sand)" fontStyle="italic" textAnchor="middle">tight</text>
      <text x="390" y="210" fontFamily="Caveat" fontSize="20" fill="var(--orange)" fontStyle="italic" textAnchor="end">busy as a bee</text>

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
        <div style={{ position: 'absolute', right: 0, bottom: (100 / max) * 100 + 2 }} className="tm-mono">busy line</div>
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
