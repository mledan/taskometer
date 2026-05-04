import React, { useMemo } from 'react';
import { CategoryBreakdownBar } from './TimelineViews.jsx';

/**
 * End-of-day reflection card. Shows:
 *  - tasks done / scheduled
 *  - total time scheduled
 *  - top 3 categories (via CategoryBreakdownBar)
 *  - a short story-telling line about how the day went
 *
 * Lives below the wheel on the day scope. Dismissible per-day via
 * sessionStorage so we don't nag.
 */

function pad(n) { return n < 10 ? `0${n}` : `${n}`; }
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export default function DailyWrap({ selectedDate, slots = [], tasks = [], taskTypes = [] }) {
  const dateKey = ymd(selectedDate);
  const daySlots = useMemo(() => slots.filter(s => s.date === dateKey), [slots, dateKey]);
  const dayTasks = useMemo(
    () => tasks.filter(t => {
      const st = t.scheduledTime ? new Date(t.scheduledTime) : null;
      return st && ymd(st) === dateKey;
    }),
    [tasks, dateKey],
  );

  const done = dayTasks.filter(t => t.status === 'completed').length;
  const total = dayTasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const isToday = dateKey === ymd(new Date());
  const isPast = new Date(dateKey).getTime() < new Date(ymd(new Date())).getTime();

  // Story-telling headline picks based on completion + load.
  const headline = (() => {
    if (!total && !daySlots.length) return "blank slate — paint a wheel and add a task to start.";
    if (!total) return "wheel is set, no tasks yet — drop something into a block.";
    if (pct === 100) return isPast ? "every task done. clean wrap." : "every task done so far. keep it rolling.";
    if (pct >= 75) return "most of the day cleared. nice work.";
    if (pct >= 50) return "halfway there. push through the next block.";
    if (pct > 0) return "a few wins down. plenty of day left.";
    return isPast ? "no tasks closed today. tomorrow's a reset." : "nothing crossed off yet — pick the easiest one.";
  })();

  return (
    <div
      style={{
        marginTop: 18,
        padding: '16px 20px',
        border: '1.5px solid var(--rule)',
        borderRadius: 12,
        background: 'var(--paper-warm, #FAF5EC)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', fontSize: 26, color: 'var(--ink)', lineHeight: 1 }}>
          {isToday ? "Today's wrap" : isPast ? 'How that day went' : 'A look ahead'}
        </span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--ink-mute)' }}>
          {selectedDate.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
      </div>

      <div style={{ fontSize: 16, color: 'var(--ink)', marginBottom: 14, lineHeight: 1.4 }}>
        {headline}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
        <Stat label="tasks done" value={`${done} / ${total}`} accent={pct === 100 ? 'var(--orange)' : undefined} />
        <Stat label="completion" value={`${pct}%`} />
        <Stat label="blocks scheduled" value={daySlots.length} />
      </div>

      <CategoryBreakdownBar slots={daySlots} taskTypes={taskTypes} label="day" />
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        background: 'var(--paper)',
        border: '1px solid var(--rule)',
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: 0.6, textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', fontSize: 28, lineHeight: 1, color: accent || 'var(--ink)' }}>
        {value}
      </span>
    </div>
  );
}
