import { useMemo } from 'react';
import PlaceMenu from './PlaceMenu.jsx';
import { fmtDuration } from './quickAdd';

function ymd(d) {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

function fmtClock(date) {
  const h = date.getHours();
  const hr = ((h % 12) || 12);
  const ampm = h < 12 ? 'a' : 'p';
  const m = date.getMinutes();
  return m ? `${hr}:${m < 10 ? '0' + m : m}${ampm}` : `${hr}${ampm}`;
}

function fmtRelDay(dayKey, todayKey) {
  if (dayKey === todayKey) return 'today';
  const a = new Date(`${dayKey}T00:00:00`);
  const b = new Date(`${todayKey}T00:00:00`);
  const diff = Math.round((a.getTime() - b.getTime()) / 86400000);
  if (diff === -1) return 'yesterday';
  if (diff < -1 && diff >= -7) return `${-diff}d ago`;
  if (diff === 1) return 'tomorrow';
  if (diff > 1 && diff <= 7) return a.toLocaleDateString('en', { weekday: 'long' }).toLowerCase();
  return a.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }).toLowerCase();
}

function isOverdue(task, now) {
  if (!task?.scheduledTime) return false;
  if (task.status === 'completed' || task.status === 'cancelled') return false;
  const start = new Date(task.scheduledTime).getTime();
  if (Number.isNaN(start)) return false;
  const dur = typeof task.duration === 'number' ? task.duration : 30;
  const end = start + dur * 60 * 1000;
  return end < now.getTime();
}

/**
 * LooseEnds — what the column can't show: tasks that missed their block
 * (overdue) and tasks scheduled today that match no block. The blocks
 * themselves are drawn by the stage; the inbox lives in the side column.
 * Every row has one placement control (the shared PlaceMenu).
 */
export default function LooseEnds({
  tasks = [],
  slots = [],
  date,
  api,
  rowHandlers = {},
  onPlaceOnDate,
}) {
  const now = new Date();
  const todayKey = ymd(now);
  const dateKey = date ? ymd(date) : todayKey;
  const isToday = dateKey === todayKey;

  const daySlots = useMemo(
    () => (slots || [])
      .filter(s => s?.date === dateKey)
      .slice()
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')),
    [slots, dateKey],
  );

  const { overdue, scheduledByDay } = useMemo(() => {
    const overdue = [];
    const scheduledByDay = new Map();

    for (const t of tasks) {
      if (!t || t.status === 'cancelled') continue;
      if (!t.scheduledTime) continue;
      const dt = new Date(t.scheduledTime);
      if (Number.isNaN(dt.getTime())) continue;
      const dKey = ymd(dt);
      if (isToday && isOverdue(t, now) && dKey <= todayKey) {
        overdue.push(t);
        continue;
      }
      if (dKey !== dateKey) continue;
      if (!scheduledByDay.has(dKey)) scheduledByDay.set(dKey, []);
      scheduledByDay.get(dKey).push(t);
    }

    overdue.sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
    return { overdue, scheduledByDay };
  }, [tasks, dateKey, isToday, todayKey]);

  const tasksForDay = scheduledByDay.get(dateKey) || [];

  const slotGroups = useMemo(() => {
    const bySlot = new Map();
    const looseScheduled = [];
    for (const t of tasksForDay) {
      const slot = t.scheduledSlotId
        ? daySlots.find(s => s.id === t.scheduledSlotId)
        : null;
      if (slot) {
        if (!bySlot.has(slot.id)) bySlot.set(slot.id, { slot, tasks: [] });
        bySlot.get(slot.id).tasks.push(t);
      } else {
        const dt = new Date(t.scheduledTime);
        const min = dt.getHours() * 60 + dt.getMinutes();
        const matched = daySlots.find(s => {
          const [sh, sm] = (s.startTime || '0:0').split(':').map(Number);
          const [eh, em] = (s.endTime || '0:0').split(':').map(Number);
          let start = (sh || 0) * 60 + (sm || 0);
          let end = (eh || 0) * 60 + (em || 0);
          if (end <= start) end += 24 * 60;
          return min >= start && min < end;
        });
        if (matched) {
          if (!bySlot.has(matched.id)) bySlot.set(matched.id, { slot: matched, tasks: [] });
          bySlot.get(matched.id).tasks.push(t);
        } else {
          looseScheduled.push(t);
        }
      }
    }
    const ordered = daySlots.map(s => bySlot.get(s.id)).filter(Boolean);
    return { ordered, loose: looseScheduled };
  }, [tasksForDay, daySlots]);

  const rowProps = { api, daySlots, dateKey, rowHandlers, onPlaceOnDate };
  if (overdue.length === 0 && slotGroups.loose.length === 0) return null;

  return (
    <div className="tm-blocks">
      {overdue.length > 0 && (
        <Section title={`Overdue · ${overdue.length}`} accent="var(--orange)" tone="warn" subtitle="these didn't fit anywhere — give each a block, or let them go.">
          {overdue.map(t => (
            <TaskRow key={t.id || t.key} task={t} relativeDay={fmtRelDay(ymd(new Date(t.scheduledTime)), todayKey)} showOverdue {...rowProps} />
          ))}
        </Section>
      )}

      {slotGroups.loose.length > 0 && (
        <Section title={`Outside any block · ${slotGroups.loose.length}`} accent="var(--ink)" subtitle="scheduled today but no block holds them. tap move to pick one.">
          {slotGroups.loose.map(t => (
            <TaskRow key={t.id || t.key} task={t} {...rowProps} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, accent, subtitle, tone, children }) {
  return (
    <div className={`tm-card tm-blocks-section${tone === 'warn' ? ' tm-warn' : ''}`} style={{ '--section-accent': accent }}>
      <div className="tm-blocks-title">{title}</div>
      {subtitle && <div className="tm-mono tm-sm tm-blocks-sub">{subtitle}</div>}
      <div style={{ display: 'flex', flexDirection: 'column' }}>{children}</div>
    </div>
  );
}

function TaskRow({ task, relativeDay, isInbox, showOverdue, api, daySlots, dateKey, rowHandlers, onPlaceOnDate }) {
  const id = task.id || task.key;
  const done = task.status === 'completed';
  const dur = typeof task.duration === 'number' ? task.duration : 30;
  const dt = task.scheduledTime ? new Date(task.scheduledTime) : null;
  const time = dt ? fmtClock(dt) : null;

  const moveToInbox = () => {
    api?.tasks?.update?.(id, { scheduledTime: null, scheduledFor: null, scheduledSlotId: null });
  };
  const placeInSlot = (taskId, slotId) => {
    if (rowHandlers.onTaskMoveTo) rowHandlers.onTaskMoveTo(taskId, slotId);
    else api?.tasks?.moveToSlot?.(taskId, slotId);
  };

  return (
    <div
      className={`tm-blocks-row${done ? ' tm-done' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/task-id', id);
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      <button
        type="button"
        className={`tm-rightnow-check${done ? ' tm-on' : ''}`}
        onClick={() => rowHandlers.onToggle?.(id)}
        title={done ? 'undo' : 'mark done'}
        aria-label={done ? 'mark not done' : 'mark done'}
      />
      <div className="tm-blocks-body">
        <div className="tm-blocks-text">{task.text || task.title || 'untitled'}</div>
        <div className="tm-mono tm-sm tm-blocks-meta">
          {showOverdue && relativeDay && <><span className="tm-blocks-late">{relativeDay} · {time}</span>{' · '}</>}
          {!showOverdue && time && <>{time} · </>}
          {fmtDuration(dur)}
          {task.primaryType && task.primaryType !== 'work' && <> · {task.primaryType}</>}
        </div>
      </div>

      <div className="tm-blocks-actions">
        <PlaceMenu
          taskId={id}
          daySlots={daySlots}
          dayKey={dateKey}
          onPlaceInSlot={placeInSlot}
          onPlaceOnDate={onPlaceOnDate || ((taskId, day) => {
            const [y, m, d] = day.split('-').map(Number);
            api?.tasks?.reschedule?.(taskId, new Date(y, (m || 1) - 1, d || 1, 9, 0, 0, 0).toISOString(), null);
          })}
          label={isInbox ? 'place ▾' : 'move ▾'}
        />
        {!isInbox && (
          <button className="tm-place-btn" onClick={moveToInbox} title="unschedule — send back to inbox">↩ inbox</button>
        )}
        <button className="tm-place-btn" onClick={() => rowHandlers.onDelete?.(id)} title="delete" aria-label="delete">×</button>
      </div>
    </div>
  );
}
