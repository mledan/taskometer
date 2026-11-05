import { useMemo } from 'react';
import { CategoryBreakdownBar } from './TimelineViews.jsx';
import { formatYMD } from '../utils/time.js';
import './screens.css';

/**
 * End-of-day reflection: done / scheduled, completion, blocks, and a
 * one-line read on how the day went. Sits below the wheel.
 */
export default function DailyWrap({ selectedDate, slots = [], tasks = [], taskTypes = [] }) {
  const dateKey = formatYMD(selectedDate);
  const daySlots = useMemo(() => slots.filter(s => s.date === dateKey), [slots, dateKey]);
  const dayTasks = useMemo(
    () => tasks.filter(t => t.scheduledTime && formatYMD(new Date(t.scheduledTime)) === dateKey && t.status !== 'cancelled'),
    [tasks, dateKey],
  );

  const done = dayTasks.filter(t => t.status === 'completed').length;
  const total = dayTasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const todayKey = formatYMD(new Date());
  const isToday = dateKey === todayKey;
  const isPast = dateKey < todayKey;

  const headline = (() => {
    if (!total && !daySlots.length) return 'Blank slate — paint a schedule and capture a task to start.';
    if (!total) return 'Schedule is set, no tasks yet — drop something into a block.';
    if (pct === 100) return isPast ? 'Every task done. Clean wrap.' : 'Every task done so far. Keep it rolling.';
    if (pct >= 75) return 'Most of the day cleared. Nice work.';
    if (pct >= 50) return 'Halfway there. Push through the next block.';
    if (pct > 0) return 'A few wins down. Plenty of day left.';
    return isPast ? 'No tasks closed that day. The next one is a reset.' : 'Nothing crossed off yet — pick the easiest one.';
  })();

  return (
    <section className="tm-wrap" aria-label="daily wrap">
      <div className="tm-wrap-head">
        <span className="tm-wrap-title">{isToday ? "Today's wrap" : isPast ? 'How that day went' : 'A look ahead'}</span>
        <span className="tm-mono tm-sm">{selectedDate.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
      </div>
      <div className="tm-wrap-headline">{headline}</div>
      <div className="tm-wrap-stats">
        <Stat label="tasks done" value={`${done} / ${total}`} accent={total > 0 && pct === 100} />
        <Stat label="completion" value={`${pct}%`} />
        <Stat label="blocks" value={daySlots.length} />
      </div>
      <CategoryBreakdownBar slots={daySlots} taskTypes={taskTypes} label="day" />
    </section>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="tm-wrap-stat">
      <span className="tm-wrap-stat-label">{label}</span>
      <span className={`tm-wrap-stat-value${accent ? ' tm-accent' : ''}`}>{value}</span>
    </div>
  );
}
