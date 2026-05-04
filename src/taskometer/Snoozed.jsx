import React, { useMemo } from 'react';

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
  const a = new Date(`${dayKey}T00:00:00`);
  const b = new Date(`${todayKey}T00:00:00`);
  const diff = Math.round((a.getTime() - b.getTime()) / 86400000);
  if (diff === 0) return 'earlier today';
  if (diff === -1) return 'yesterday';
  if (diff >= -7 && diff < 0) return `${-diff}d ago`;
  return a.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }).toLowerCase();
}

/**
 * Snoozed — past-due incomplete tasks. The user asked for a category
 * "for things not done in the past."
 *
 * The carry-forward sweep on boot moves overdue tasks into the next
 * matching slot, but two cases leave tasks visibly snoozed:
 *   1. No fit anywhere in the next 60 days — task stays put.
 *   2. The user has navigated forward; new misses are caught by the
 *      next boot, but mid-session misses stack up here as the day
 *      progresses and earlier blocks pass without check-off.
 *
 * Per row: reschedule date picker, mark done, push to tomorrow,
 * delete. Hidden when empty so it doesn't crowd the sidebar.
 */
export default function Snoozed({
  tasks = [],
  onReschedule,
  onComplete,
  onDelete,
  onPushTomorrow,
  limit = 8,
}) {
  const { items, todayKey } = useMemo(() => {
    const now = new Date();
    const todayKey = ymd(now);
    const nowMs = now.getTime();
    const items = (tasks || [])
      .filter(t => t?.status !== 'completed' && t?.status !== 'cancelled')
      .filter(t => !!t.scheduledTime)
      .map(t => {
        const dt = new Date(t.scheduledTime);
        if (Number.isNaN(dt.getTime())) return null;
        const dur = typeof t.duration === 'number' ? t.duration : 30;
        const end = dt.getTime() + dur * 60 * 1000;
        const dayKey = ymd(dt);
        // Past calendar day OR earlier today + window already ended
        const isSnoozed = dayKey < todayKey || (dayKey === todayKey && end < nowMs);
        if (!isSnoozed) return null;
        return {
          id: t.id || t.key,
          text: t.text || t.title || 'untitled',
          when: dt,
          dayKey,
          duration: dur,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.when.getTime() - b.when.getTime())
      .slice(0, limit);
    return { items, todayKey };
  }, [tasks, limit]);

  if (items.length === 0) return null;

  return (
    <div
      className="tm-rail"
      role="region"
      aria-label="snoozed"
      data-onboard="snoozed"
      style={{ borderTop: '3px solid var(--orange)' }}
    >
      <div className="tm-rail-head">
        <span className="tm-rail-title">Snoozed</span>
        <span className="tm-mono tm-sm" style={{ color: 'var(--orange)' }}>
          {items.length}
        </span>
      </div>
      <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', marginTop: -8 }}>
        past tasks not done — reschedule, finish, or drop.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map(it => (
          <div
            key={it.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/task-id', it.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            style={{
              padding: '8px 0',
              borderBottom: '1px solid var(--rule-soft)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              cursor: 'grab',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => onComplete?.(it.id)}
                title="mark done"
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  border: '1.5px solid var(--ink-mute)',
                  background: 'transparent',
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--ink)' }}>
                {it.text}
              </span>
            </div>
            <div className="tm-mono tm-sm" style={{ color: 'var(--orange)' }}>
              {fmtRelDay(it.dayKey, todayKey)} · {fmtClock(it.when)}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <input
                type="date"
                className="tm-composer-num"
                value={it.dayKey}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  const [y, m, d] = v.split('-').map(Number);
                  const next = new Date(y, (m || 1) - 1, d || 1, it.when.getHours(), it.when.getMinutes(), 0, 0);
                  onReschedule?.(it.id, next.toISOString());
                }}
                title="reschedule (keeps time-of-day)"
                style={{ fontSize: 11, width: 130 }}
              />
              <button
                type="button"
                className="tm-btn tm-sm"
                onClick={() => onPushTomorrow?.(it.id, it.when)}
                title="push to tomorrow (same time)"
                style={{ fontSize: 11 }}
              >
                tmrw →
              </button>
              <button
                type="button"
                className="tm-btn tm-sm tm-danger"
                onClick={() => onDelete?.(it.id)}
                title="delete"
                style={{ fontSize: 11 }}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
