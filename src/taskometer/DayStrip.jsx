import React, { useMemo } from 'react';

function ymd(d) {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

/**
 * DayStrip — a row of clickable day chips that anchors the user in
 * time. Yesterday on the left, today in the middle, the next 5 days
 * on the right. Each chip shows the day-of-week, the date, and the
 * count of tasks scheduled on that day. The user complained that
 * "tasks just go disappearing once they are added" when the
 * auto-scheduler pushes them forward — this is the breadcrumb that
 * shows them *where* the tasks went, in one click reachable.
 */
export default function DayStrip({ selectedDate, tasks = [], onPickDate }) {
  const days = useMemo(() => {
    const out = [];
    const today = new Date();
    for (let i = -1; i <= 5; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      out.push({ date: d, key: ymd(d), offset: i });
    }
    return out;
  }, []);

  const counts = useMemo(() => {
    const map = new Map();
    for (const t of tasks) {
      if (!t?.scheduledTime) continue;
      if (t.status === 'cancelled') continue;
      const k = ymd(new Date(t.scheduledTime));
      map.set(k, (map.get(k) || 0) + 1);
    }
    return map;
  }, [tasks]);

  const selectedKey = ymd(selectedDate);

  return (
    <div
      role="navigation"
      aria-label="day strip"
      style={{
        display: 'flex',
        gap: 6,
        marginBottom: 14,
        flexWrap: 'wrap',
      }}
    >
      {days.map(({ date, key, offset }) => {
        const isSelected = key === selectedKey;
        const isToday = offset === 0;
        const count = counts.get(key) || 0;
        const wk = date.toLocaleDateString('en', { weekday: 'short' }).toLowerCase();
        const dn = date.getDate();
        return (
          <button
            key={key}
            type="button"
            onClick={() => onPickDate?.(new Date(date))}
            title={`${date.toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })} · ${count} task${count === 1 ? '' : 's'}`}
            style={{
              all: 'unset',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '6px 10px',
              minWidth: 56,
              border: `1.5px ${isSelected ? 'solid' : 'dashed'} ${isSelected ? 'var(--orange)' : 'var(--rule)'}`,
              borderRadius: 8,
              background: isSelected ? 'var(--paper-warm, #FAF5EC)' : 'var(--paper)',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--paper-warm, #FAF5EC)'; }}
            onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--paper)'; }}
          >
            <span
              className="tm-mono tm-sm"
              style={{
                color: 'var(--ink-mute)',
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
                fontSize: 10,
              }}
            >
              {isToday ? 'today' : wk}
            </span>
            <span
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: 22,
                lineHeight: 1,
                color: isSelected ? 'var(--orange)' : 'var(--ink)',
              }}
            >
              {dn}
            </span>
            <span
              className="tm-mono tm-sm"
              style={{
                color: count > 0 ? 'var(--orange)' : 'var(--ink-mute)',
                fontSize: 10,
              }}
            >
              {count > 0 ? `${count} task${count === 1 ? '' : 's'}` : '—'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
