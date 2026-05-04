import React, { useMemo } from 'react';

const DAY_MIN = 24 * 60;
function hhmmToMin(s) {
  if (!s) return 0;
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
function spanMin(startTime, endTime) {
  const s = hhmmToMin(startTime);
  const e = hhmmToMin(endTime);
  return e <= s ? e + DAY_MIN - s : e - s;
}

/**
 * DayBlockCell — a calendar-grid cell that's actually readable.
 *
 * The user said: "month and year, quarter and life same issues...
 * not really sure what to do, it's hard to see the circles but
 * maybe we can get creative with how we fill each grid cell."
 *
 * So: ditch the tiny mini-wheel that was illegible at small sizes.
 * Each cell becomes a horizontal stacked bar — segments sized by
 * minutes-per-category, colored by the type's color. The day number
 * sits on top in high contrast. A small footer line shows scheduled
 * hours. Glanceable, dense, no SVG required.
 *
 * Three sizes:
 *   "lg" — month grid, ~140px tall, segment names visible
 *   "md" — quarter grid, ~80px tall, just the bar + day
 *   "sm" — year/life grids, ~32px, color stripe + day number
 */
export default function DayBlockCell({
  date,
  daySlots = [],
  taskCount = 0,
  isToday = false,
  isSelected = false,
  size = 'md',
  onClick,
  onPointerDown,
  onPointerEnter,
  onDragOver,
  onDrop,
  emptyHint,
  ...rest
}) {
  const segments = useMemo(() => {
    const byColor = new Map();
    let total = 0;
    for (const s of daySlots) {
      const min = spanMin(s.startTime, s.endTime);
      const color = s.color || 'var(--ink-mute)';
      byColor.set(color, (byColor.get(color) || 0) + min);
      total += min;
    }
    if (total === 0) return [];
    return [...byColor.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([color, min]) => ({ color, min, pct: (min / total) * 100 }));
  }, [daySlots]);

  const totalMin = useMemo(
    () => daySlots.reduce((sum, s) => sum + spanMin(s.startTime, s.endTime), 0),
    [daySlots],
  );
  const hours = totalMin / 60;
  const dayNum = date.getDate();
  const empty = segments.length === 0;

  const sizing = size === 'lg'
    ? { h: 110, dayFont: 18, footerFont: 11, padding: 8, barH: 32 }
    : size === 'sm'
      ? { h: 36, dayFont: 11, footerFont: 9, padding: 4, barH: 6 }
      : { h: 64, dayFont: 14, footerFont: 10, padding: 6, barH: 14 };

  const dominantColor = segments[0]?.color || null;

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onDragOver={onDragOver}
      onDrop={onDrop}
      title={emptyHint || `${date.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}${empty ? ' · empty' : ` · ${Math.round(hours)}h scheduled`}${taskCount > 0 ? ` · ${taskCount} task${taskCount === 1 ? '' : 's'}` : ''}`}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: size === 'sm' ? 2 : 4,
        height: sizing.h,
        padding: sizing.padding,
        border: `1.5px ${isSelected ? 'solid var(--orange)' : isToday ? 'solid var(--ink)' : empty ? 'dashed var(--rule)' : 'solid var(--rule-soft)'}`,
        borderRadius: 8,
        background: empty
          ? 'var(--paper)'
          : `linear-gradient(180deg, var(--paper) 0%, var(--paper) 60%, ${dominantColor}15 100%)`,
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 0.1s, transform 0.08s',
      }}
      {...rest}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 4 }}>
        <span
          style={{
            fontSize: sizing.dayFont,
            fontWeight: isToday ? 700 : 500,
            color: isToday ? 'var(--orange)' : 'var(--ink)',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {dayNum}
        </span>
        {taskCount > 0 && size !== 'sm' && (
          <span
            className="tm-mono"
            style={{
              fontSize: sizing.footerFont,
              color: 'var(--orange)',
              fontWeight: 600,
            }}
          >
            {taskCount}t
          </span>
        )}
      </div>

      {/* Stacked bar — the heart of the cell. Replaces the tiny mini-wheel
          with a horizontal stripe that's actually legible. */}
      <div
        aria-hidden
        style={{
          display: 'flex',
          height: sizing.barH,
          borderRadius: 4,
          overflow: 'hidden',
          background: 'var(--rule-soft)',
          opacity: empty ? 0.3 : 1,
        }}
      >
        {segments.map((seg, i) => (
          <div
            key={i}
            style={{
              width: `${seg.pct}%`,
              background: seg.color,
              transition: 'width 0.18s',
            }}
          />
        ))}
      </div>

      {size !== 'sm' && (
        <div
          className="tm-mono"
          style={{
            fontSize: sizing.footerFont,
            color: 'var(--ink-mute)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 4,
          }}
        >
          <span>{empty ? '—' : `${Math.round(hours)}h`}</span>
          <span>{!empty && `${daySlots.length}b`}</span>
        </div>
      )}
    </button>
  );
}
