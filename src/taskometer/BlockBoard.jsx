import React, { useMemo } from 'react';
import SleepCycleHint from './SleepCycleHint.jsx';
import { isSleepSlot } from '../services/sleepCycles.js';

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
 * BlockBoard — the consolidated task workspace.
 *
 * The "block" scale used to be a tiny "now / up next" duo. The user
 * asked for one place where tasks live whether scheduled or not, with
 * granular actions. So this view answers four questions in order:
 *
 *   1. What did I miss? (overdue)
 *   2. What am I doing right now? (current slot)
 *   3. What's coming today? (the rest of today, by slot)
 *   4. What's still loose? (inbox)
 *
 * Each row exposes: toggle done, delete, push to tomorrow, move to a
 * specific slot, and is itself draggable to drop onto a wheel wedge.
 */
export default function BlockBoard({
  tasks = [],
  slots = [],
  date,
  api,
  rowHandlers = {},
}) {
  const now = useMemo(() => new Date(), [tasks.length, slots.length]);
  const todayKey = ymd(now);
  const dateKey = date ? ymd(date) : todayKey;
  const isToday = dateKey === todayKey;

  // Today's slots in time order
  const daySlots = useMemo(
    () => (slots || [])
      .filter(s => s?.date === dateKey)
      .slice()
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')),
    [slots, dateKey],
  );

  // Bucket tasks
  const { overdue, scheduledByDay, inbox } = useMemo(() => {
    const overdue = [];
    const scheduledByDay = new Map(); // dayKey -> [{slot, tasks: []}]
    const inbox = [];

    for (const t of tasks) {
      if (!t || t.status === 'cancelled') continue;
      if (!t.scheduledTime) {
        if (t.status !== 'completed') inbox.push(t);
        continue;
      }
      const dt = new Date(t.scheduledTime);
      if (Number.isNaN(dt.getTime())) continue;
      const dKey = ymd(dt);
      if (isToday && isOverdue(t, now) && dKey <= todayKey) {
        overdue.push(t);
        continue;
      }
      // Group only the day in view (today by default)
      if (dKey !== dateKey) continue;
      if (!scheduledByDay.has(dKey)) scheduledByDay.set(dKey, []);
      scheduledByDay.get(dKey).push(t);
    }

    overdue.sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
    return { overdue, scheduledByDay, inbox };
  }, [tasks, dateKey, isToday, todayKey, now]);

  const tasksForDay = scheduledByDay.get(dateKey) || [];

  // Group today's scheduled tasks by slot
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
        // Snap by time window
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
    // Order groups by slot start
    const ordered = daySlots
      .map(s => bySlot.get(s.id))
      .filter(Boolean);
    return { ordered, loose: looseScheduled };
  }, [tasksForDay, daySlots]);

  // Sleep slots for the day — surfaced as their own section so the
  // SleepCycleHint shows even when no tasks are scheduled (which is
  // basically always for sleep blocks).
  const sleepSlots = useMemo(
    () => daySlots.filter(isSleepSlot),
    [daySlots],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {sleepSlots.length > 0 && (
        <Section
          title={`Sleep · ${sleepSlots.length} block${sleepSlots.length === 1 ? '' : 's'}`}
          accent="#6B46C1"
          subtitle="cycle-aware wake / bedtime suggestions for each sleep window."
        >
          {sleepSlots.map(s => (
            <div
              key={s.id}
              style={{
                borderLeft: `3px solid ${s.color || '#6B46C1'}`,
                paddingLeft: 10,
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>
                  {s.label || s.slotType || 'sleep'}
                </span>
                <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
                  {s.startTime}–{s.endTime}
                </span>
              </div>
              <SleepCycleHint slot={s} />
            </div>
          ))}
        </Section>
      )}

      {/* Overdue */}
      {overdue.length > 0 && (
        <Section
          title={`Overdue · ${overdue.length}`}
          accent="var(--orange)"
          tone="warn"
          subtitle="rescheduled into the next matching block automatically — these are the ones that didn't have a fit."
        >
          {overdue.map(t => (
            <TaskRow
              key={t.id || t.key}
              task={t}
              relativeDay={fmtRelDay(ymd(new Date(t.scheduledTime)), todayKey)}
              api={api}
              slots={daySlots}
              rowHandlers={rowHandlers}
              showOverdue
            />
          ))}
        </Section>
      )}

      {/* Today's scheduled, grouped by slot */}
      {slotGroups.ordered.length > 0 && (
        <Section
          title={`${isToday ? 'Today' : fmtRelDay(dateKey, todayKey)} · ${tasksForDay.length} task${tasksForDay.length === 1 ? '' : 's'}`}
          accent="var(--ink)"
          subtitle="grouped by block — drag a task to move it · click a row for actions"
        >
          {slotGroups.ordered.map(({ slot, tasks: slotTasks }) => (
            <SlotGroup
              key={slot.id}
              slot={slot}
              tasks={slotTasks}
              api={api}
              slots={daySlots}
              rowHandlers={rowHandlers}
            />
          ))}
          {slotGroups.loose.length > 0 && (
            <SlotGroup
              key="loose"
              slot={null}
              tasks={slotGroups.loose}
              api={api}
              slots={daySlots}
              rowHandlers={rowHandlers}
            />
          )}
        </Section>
      )}

      {/* Inbox — unscheduled */}
      {inbox.length > 0 && (
        <Section
          title={`Inbox · ${inbox.length}`}
          accent="var(--sage)"
          subtitle="unscheduled. drag onto a block to plan, or use the day view."
        >
          {inbox.map(t => (
            <TaskRow
              key={t.id || t.key}
              task={t}
              api={api}
              slots={daySlots}
              rowHandlers={rowHandlers}
              isInbox
            />
          ))}
        </Section>
      )}

      {overdue.length === 0 && slotGroups.ordered.length === 0 && slotGroups.loose.length === 0 && inbox.length === 0 && (
        <div className="tm-card tm-dashed" style={{ padding: '20px 22px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>nothing to act on</div>
          <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
            no overdue tasks, nothing scheduled for {isToday ? 'today' : fmtRelDay(dateKey, todayKey)}, inbox empty.
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, accent, subtitle, tone, children }) {
  return (
    <div
      className="tm-card"
      style={{
        padding: '14px 18px',
        borderTop: `4px solid ${accent}`,
        background: tone === 'warn' ? 'var(--paper-warm, #FAF5EC)' : 'var(--paper)',
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 600, color: accent, marginBottom: subtitle ? 2 : 8 }}>
        {title}
      </div>
      {subtitle && (
        <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', marginBottom: 10 }}>
          {subtitle}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column' }}>{children}</div>
    </div>
  );
}

function SlotGroup({ slot, tasks, api, slots, rowHandlers }) {
  const color = slot?.color || 'var(--ink-mute)';
  return (
    <div style={{ borderLeft: `3px solid ${color}`, paddingLeft: 10, marginBottom: 8 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          marginBottom: 4,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600 }}>
          {slot ? (slot.label || slot.slotType || 'block') : 'unmatched'}
        </span>
        {slot && (
          <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
            {slot.startTime}–{slot.endTime}
          </span>
        )}
      </div>
      {slot && isSleepSlot(slot) && <SleepCycleHint slot={slot} compact />}
      {tasks.map(t => (
        <TaskRow
          key={t.id || t.key}
          task={t}
          api={api}
          slots={slots}
          rowHandlers={rowHandlers}
        />
      ))}
    </div>
  );
}

function TaskRow({ task, relativeDay, isInbox, showOverdue, api, slots, rowHandlers }) {
  const id = task.id || task.key;
  const done = task.status === 'completed';
  const dur = typeof task.duration === 'number' ? task.duration : 30;
  const dt = task.scheduledTime ? new Date(task.scheduledTime) : null;
  const time = dt ? fmtClock(dt) : null;

  const dateInputValue = dt ? ymd(dt) : '';
  const timeInputValue = dt
    ? `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
    : '09:00';

  const rescheduleTo = (newDateStr, newTimeStr) => {
    if (!newDateStr) return;
    const [y, m, d] = newDateStr.split('-').map(Number);
    const [h, mi] = (newTimeStr || timeInputValue || '09:00').split(':').map(Number);
    const next = new Date(y, (m || 1) - 1, d || 1, h || 0, mi || 0, 0, 0);
    api?.tasks?.reschedule?.(id, next.toISOString(), null);
  };

  const moveTomorrow = () => {
    const base = dt || new Date();
    const next = new Date(base.getTime() + 24 * 60 * 60 * 1000);
    api?.tasks?.reschedule?.(id, next.toISOString(), null);
  };

  const moveToInbox = () => {
    api?.tasks?.update?.(id, { scheduledTime: null, scheduledFor: null, scheduledSlotId: null });
  };

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/task-id', id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 0',
        borderBottom: '1px solid var(--rule-soft)',
        opacity: done ? 0.55 : 1,
        cursor: 'grab',
        flexWrap: 'wrap',
      }}
    >
      <button
        type="button"
        onClick={() => rowHandlers.onToggle?.(id)}
        title={done ? 'undo' : 'mark done'}
        style={{
          all: 'unset',
          cursor: 'pointer',
          width: 18,
          height: 18,
          borderRadius: 4,
          border: `1.5px solid ${done ? 'var(--sage)' : 'var(--ink-mute)'}`,
          background: done ? 'var(--sage)' : 'transparent',
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 160 }}>
        <div
          style={{
            fontSize: 15,
            textDecoration: done ? 'line-through' : 'none',
            color: 'var(--ink)',
          }}
        >
          {task.text || task.title || 'untitled'}
        </div>
        <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
          {showOverdue && relativeDay && (
            <>
              <span style={{ color: 'var(--orange)', fontWeight: 600 }}>{relativeDay} · {time}</span>
              {' · '}
            </>
          )}
          {!showOverdue && time && <>{time} · </>}
          {dur}m
          {task.primaryType && <> · {task.primaryType}</>}
          {isInbox && <> · unscheduled</>}
        </div>
      </div>

      {/* Inline date+time pickers — full cross-day control. The user
          asked: "i don't have enough control ability to change them
          to where i want them to show up." Now any task can be moved
          to any day at any time without leaving the row. */}
      <input
        type="date"
        className="tm-composer-num"
        value={dateInputValue}
        onChange={(e) => rescheduleTo(e.target.value, timeInputValue)}
        title="move to a different day (preserves time-of-day; sets to 9:00 if previously unscheduled)"
        style={{ fontSize: 12, width: 130 }}
      />
      <input
        type="time"
        className="tm-composer-num"
        value={timeInputValue}
        onChange={(e) => rescheduleTo(dateInputValue || ymd(new Date()), e.target.value)}
        title="change the time"
        style={{ fontSize: 12, width: 90 }}
      />

      {slots.length > 0 && (
        <select
          className="tm-composer-select"
          value=""
          onChange={(e) => {
            const sid = e.target.value;
            if (!sid) return;
            api?.tasks?.moveToSlot?.(id, sid);
            e.target.value = '';
          }}
          title="snap into a block on this day"
          style={{ fontSize: 12 }}
        >
          <option value="">snap to block…</option>
          {slots.map(s => (
            <option key={s.id} value={s.id}>
              {(s.label || s.slotType || 'block')} · {s.startTime}
            </option>
          ))}
        </select>
      )}
      <button
        className="tm-btn tm-sm"
        onClick={moveTomorrow}
        title="push to tomorrow (same time)"
      >
        tmrw →
      </button>
      {!isInbox && (
        <button
          className="tm-btn tm-sm tm-ghost"
          onClick={moveToInbox}
          title="unschedule — send back to inbox"
        >
          ↩ inbox
        </button>
      )}
      <button
        className="tm-btn tm-sm tm-danger"
        onClick={() => rowHandlers.onDelete?.(id)}
        title="delete"
      >
        ×
      </button>
    </div>
  );
}
