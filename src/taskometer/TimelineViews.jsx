import React, { useEffect, useMemo, useState } from 'react';
import { resolveTypeColor } from './Composers.jsx';
import { MiniWheel } from './WheelView.jsx';
import { useMultiSelect } from '../hooks/useMultiSelect.js';
import SelectionBar from '../components/SelectionBar.jsx';

/**
 * New visualizations for non-day scopes. The mini-wheel grid reads as
 * pretty wallpaper but doesn't tell you what your week actually looked
 * like. These views answer "where did my time go?" with timelines and
 * a category breakdown bar.
 *
 * - WeekTimeline:  7 horizontal 24h ribbons (one per day) with blocks
 *                  drawn proportionally and tasks as pinned dots.
 * - MonthInsights / QuarterInsights / YearInsights:
 *                  Header summary (category-time stacked bar + legend)
 *                  + a compact heatmap grid where each day-cell shows
 *                  its dominant category color and task density.
 */

function pad(n) { return n < 10 ? `0${n}` : `${n}`; }
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function startOfWeek(d) {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function hhmmToMin(s) {
  if (!s) return 0;
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
function durationMin(slot) {
  const s = hhmmToMin(slot.startTime);
  let e = hhmmToMin(slot.endTime);
  if (e <= s) e += 24 * 60; // overnight wrap
  return e - s;
}

/**
 * Aggregate minutes per slotType across a list of slots.
 * Returns Map<slotType, minutes> sorted descending.
 */
function aggregateByType(slots, taskTypes) {
  const m = new Map();
  for (const s of slots) {
    const key = s.slotType || 'other';
    m.set(key, (m.get(key) || 0) + durationMin(s));
  }
  const totals = [...m.entries()]
    .map(([id, mins]) => ({
      id,
      mins,
      color: resolveTypeColor(taskTypes, id) || '#94A3B8',
      name: typeName(taskTypes, id),
    }))
    .sort((a, b) => b.mins - a.mins);
  const total = totals.reduce((acc, t) => acc + t.mins, 0);
  return { totals, total };
}

function typeName(taskTypes, id) {
  const t = (taskTypes || []).find(x => x.id === id);
  if (t?.name) return t.name;
  return (id || 'other').replace(/_/g, ' ');
}

function fmtH(mins) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${m}m`;
}

/* ────────────────── shared category-breakdown bar ────────────────── */

export function CategoryBreakdownBar({ slots, taskTypes, label }) {
  const { totals, total } = useMemo(() => aggregateByType(slots, taskTypes), [slots, taskTypes]);
  if (!total) {
    return (
      <div
        style={{
          padding: '14px 18px',
          border: '1px dashed var(--rule)',
          borderRadius: 10,
          color: 'var(--ink-mute)',
          fontSize: 14,
        }}
      >
        no time blocks scheduled in this {label} yet — open a day to start filling the wheel.
      </div>
    );
  }
  return (
    <div
      style={{
        padding: '14px 18px',
        border: '1.5px solid var(--rule)',
        borderRadius: 12,
        background: 'var(--paper-warm, #FAF5EC)',
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <span style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', fontSize: 22, color: 'var(--ink)' }}>
          where the {label} goes
        </span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--ink-mute)' }}>
          {fmtH(total)} scheduled · {totals.length} categor{totals.length === 1 ? 'y' : 'ies'}
        </span>
      </div>

      {/* stacked bar */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: 18,
          borderRadius: 9,
          overflow: 'hidden',
          border: '1px solid var(--rule)',
        }}
      >
        {totals.map(t => (
          <div
            key={t.id}
            title={`${t.name} — ${fmtH(t.mins)} (${Math.round((t.mins / total) * 100)}%)`}
            style={{
              flex: t.mins,
              background: t.color,
              minWidth: 2,
            }}
          />
        ))}
      </div>

      {/* legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 10 }}>
        {totals.slice(0, 10).map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: t.color }} />
            <span style={{ color: 'var(--ink)' }}>{t.name}</span>
            <span style={{ color: 'var(--ink-mute)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
              {Math.round((t.mins / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── WEEK TIMELINE ─────────────────────────── */

export function WeekTimeline({ selectedDate, slots = [], tasks = [], taskTypes = [], onPickDate }) {
  const monday = useMemo(() => startOfWeek(selectedDate), [selectedDate]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(monday, i)),
    [monday],
  );
  const todayKey = ymd(new Date());
  const weekSlots = useMemo(() => {
    const keys = new Set(days.map(d => ymd(d)));
    return slots.filter(s => keys.has(s.date));
  }, [slots, days]);

  return (
    <div className="tm-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <CategoryBreakdownBar slots={weekSlots} taskTypes={taskTypes} label="week" />

      {/* hour ruler */}
      <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', alignItems: 'center', gap: 8 }}>
        <div />
        <HourRuler />
      </div>

      {days.map(d => {
        const key = ymd(d);
        const isToday = key === todayKey;
        const daySlots = (slots || []).filter(s => s.date === key);
        const dayTasks = (tasks || []).filter(t => {
          const st = t.scheduledTime ? new Date(t.scheduledTime) : null;
          return st && ymd(st) === key;
        });
        return (
          <DayTimelineRow
            key={key}
            date={d}
            isToday={isToday}
            slots={daySlots}
            tasks={dayTasks}
            taskTypes={taskTypes}
            onClick={() => onPickDate?.(d)}
          />
        );
      })}
    </div>
  );
}

function HourRuler() {
  return (
    <div
      style={{
        position: 'relative',
        height: 18,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
        color: 'var(--ink-mute)',
      }}
    >
      {[0, 3, 6, 9, 12, 15, 18, 21, 24].map(h => (
        <div
          key={h}
          style={{
            position: 'absolute',
            left: `${(h / 24) * 100}%`,
            transform: 'translateX(-50%)',
            top: 0,
          }}
        >
          {h === 24 ? '12a' : `${(h % 12) || 12}${h < 12 ? 'a' : 'p'}`}
        </div>
      ))}
    </div>
  );
}

function DayTimelineRow({ date, isToday, slots, tasks, taskTypes, onClick }) {
  const totalMin = 24 * 60;
  const wkLabel = date.toLocaleDateString('en', { weekday: 'short' });
  const dayNum = date.getDate();
  const sortedSlots = [...slots].sort((a, b) => hhmmToMin(a.startTime) - hhmmToMin(b.startTime));
  const totalScheduled = sortedSlots.reduce((acc, s) => acc + durationMin(s), 0);

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick?.(); }}
      style={{
        display: 'grid',
        gridTemplateColumns: '70px 1fr',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
      }}
      title={`open ${date.toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' }).toLowerCase()}`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            letterSpacing: 1,
            color: isToday ? 'var(--orange)' : 'var(--ink-mute)',
            textTransform: 'uppercase',
          }}
        >
          {wkLabel}
        </span>
        <span
          style={{
            fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
            fontSize: 24,
            color: isToday ? 'var(--orange)' : 'var(--ink)',
          }}
        >
          {dayNum}
        </span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)' }}>
          {fmtH(totalScheduled)}
        </span>
      </div>

      <div
        style={{
          position: 'relative',
          height: 36,
          background: isToday ? 'var(--paper-warm, #FAF5EC)' : 'var(--paper)',
          border: `1px ${isToday ? 'solid var(--orange)' : 'dashed var(--rule)'}`,
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {/* hour grid lines */}
        {[6, 12, 18].map(h => (
          <div
            key={h}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${(h / 24) * 100}%`,
              width: 1,
              background: 'var(--rule)',
              opacity: 0.5,
            }}
          />
        ))}

        {sortedSlots.map(s => {
          const sMin = hhmmToMin(s.startTime);
          const dur = durationMin(s);
          const left = (sMin / totalMin) * 100;
          const width = (dur / totalMin) * 100;
          const color = s.color || resolveTypeColor(taskTypes, s.slotType) || '#94A3B8';
          return (
            <div
              key={s.id}
              title={`${s.label || s.slotType} · ${s.startTime}–${s.endTime}`}
              style={{
                position: 'absolute',
                top: 4,
                bottom: 4,
                left: `${left}%`,
                width: `calc(${width}% - 1px)`,
                background: color,
                opacity: 0.85,
                borderRadius: 4,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                color: '#fff',
                padding: '0 4px',
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textShadow: '0 1px 2px rgba(0,0,0,0.4)',
              }}
            >
              {s.label || ''}
            </div>
          );
        })}

        {/* task pins */}
        {tasks.map(t => {
          const st = t.scheduledTime ? new Date(t.scheduledTime) : null;
          if (!st) return null;
          const m = st.getHours() * 60 + st.getMinutes();
          const left = (m / totalMin) * 100;
          return (
            <div
              key={t.id}
              title={t.text || t.title || 'task'}
              style={{
                position: 'absolute',
                left: `${left}%`,
                top: -3,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--ink)',
                border: '1.5px solid var(--paper)',
                transform: 'translateX(-50%)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}
            />
          );
        })}

        {/* now indicator */}
        {isToday && (() => {
          const now = new Date();
          const m = now.getHours() * 60 + now.getMinutes();
          const left = (m / totalMin) * 100;
          return (
            <div
              style={{
                position: 'absolute',
                left: `${left}%`,
                top: 0,
                bottom: 0,
                width: 2,
                background: 'var(--orange)',
                boxShadow: '0 0 6px rgba(212,102,58,0.6)',
              }}
            />
          );
        })()}
      </div>
    </div>
  );
}

/* ─────────────────────────── INSIGHTS HEATMAP ───────────────────────────
 * Shared by month/quarter/year. Each cell is a small square colored by the
 * dominant category for that day, with intensity reflecting how packed the
 * day was. Clicking a cell jumps to day view.
 */

function dominantCategory(slots, taskTypes) {
  if (!slots.length) return null;
  const m = new Map();
  for (const s of slots) {
    m.set(s.slotType, (m.get(s.slotType) || 0) + durationMin(s));
  }
  let bestId = null, bestMin = 0;
  for (const [id, mins] of m) {
    if (mins > bestMin) { bestMin = mins; bestId = id; }
  }
  if (!bestId) return null;
  return {
    id: bestId,
    mins: bestMin,
    color: resolveTypeColor(taskTypes, bestId) || '#94A3B8',
  };
}

function dayDensity(slots) {
  // 0..1, normalized against 24h
  const total = slots.reduce((acc, s) => acc + durationMin(s), 0);
  return Math.min(1, total / (24 * 60));
}

function dayBreakdown(slots, taskTypes) {
  const m = new Map();
  for (const s of slots) {
    m.set(s.slotType, (m.get(s.slotType) || 0) + durationMin(s));
  }
  const arr = [...m.entries()].map(([id, mins]) => ({
    id,
    mins,
    color: resolveTypeColor(taskTypes, id) || '#94A3B8',
    name: typeName(taskTypes, id),
  }));
  arr.sort((a, b) => b.mins - a.mins);
  const total = arr.reduce((acc, t) => acc + t.mins, 0);
  return { arr, total };
}

export function InsightsGrid({
  startDate,
  endDate,
  slots,
  taskTypes,
  onPickDate,
  cellSize = 16,
  gap = 3,
}) {
  const [hover, setHover] = useState(null); // { date, slots, x, y }
  const days = useMemo(() => {
    const out = [];
    const cur = new Date(startDate); cur.setHours(0, 0, 0, 0);
    const end = new Date(endDate); end.setHours(0, 0, 0, 0);
    while (cur.getTime() <= end.getTime()) {
      out.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }, [startDate, endDate]);

  const slotsByDay = useMemo(() => {
    const m = new Map();
    for (const s of slots) {
      if (!m.has(s.date)) m.set(s.date, []);
      m.get(s.date).push(s);
    }
    return m;
  }, [slots]);

  // group by week (column = ISO week, row = weekday) → github-style heatmap
  const weeks = useMemo(() => {
    if (days.length === 0) return [];
    const out = [];
    let weekCol = [];
    for (const d of days) {
      const dow = (d.getDay() + 6) % 7; // mon=0
      if (dow === 0 && weekCol.length > 0) {
        out.push(weekCol);
        weekCol = [];
      }
      // pad first column so weekdays align
      if (weekCol.length === 0 && out.length === 0) {
        for (let i = 0; i < dow; i++) weekCol.push(null);
      }
      weekCol.push(d);
    }
    if (weekCol.length) out.push(weekCol);
    // pad last column
    while (out[out.length - 1].length < 7) out[out.length - 1].push(null);
    return out;
  }, [days]);

  const todayKey = ymd(new Date());

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: gap }}>
      {/* weekday labels */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: `repeat(7, ${cellSize}px)`,
          rowGap: gap,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9,
          color: 'var(--ink-mute)',
          marginRight: 4,
        }}
      >
        {['M', '', 'W', '', 'F', '', 'S'].map((l, i) => (
          <div key={i} style={{ height: cellSize, display: 'flex', alignItems: 'center' }}>{l}</div>
        ))}
      </div>

      {weeks.map((col, ci) => (
        <div
          key={ci}
          style={{
            display: 'grid',
            gridTemplateRows: `repeat(7, ${cellSize}px)`,
            rowGap: gap,
          }}
        >
          {col.map((d, ri) => {
            if (!d) return <div key={ri} />;
            const key = ymd(d);
            const daySlots = slotsByDay.get(key) || [];
            const dom = dominantCategory(daySlots, taskTypes);
            const density = dayDensity(daySlots);
            const isToday = key === todayKey;
            return (
              <div
                key={ri}
                onClick={() => onPickDate?.(d)}
                onMouseEnter={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setHover({ date: d, slots: daySlots, x: r.left + r.width / 2, y: r.top });
                }}
                onMouseLeave={() => setHover(null)}
                style={{
                  width: cellSize,
                  height: cellSize,
                  borderRadius: 3,
                  background: dom
                    ? hexAlpha(dom.color, 0.25 + density * 0.65)
                    : 'var(--paper)',
                  border: isToday ? '1.5px solid var(--orange)' : '1px solid var(--rule)',
                  cursor: 'pointer',
                  transition: 'transform 0.1s',
                }}
              />
            );
          })}
        </div>
      ))}

      {hover && (
        <DayHoverCard
          date={hover.date}
          slots={hover.slots}
          taskTypes={taskTypes}
          x={hover.x}
          y={hover.y}
        />
      )}
    </div>
  );
}

function DayHoverCard({ date, slots, taskTypes, x, y }) {
  const { arr, total } = useMemo(() => dayBreakdown(slots, taskTypes), [slots, taskTypes]);
  const cardW = 240;
  // position above the cell, clamp to viewport
  const left = Math.max(8, Math.min((typeof window !== 'undefined' ? window.innerWidth : 1024) - cardW - 8, x - cardW / 2));
  const top = Math.max(8, y - 12);
  return (
    <div
      style={{
        position: 'fixed',
        left,
        top,
        transform: 'translateY(-100%)',
        width: cardW,
        background: 'var(--paper)',
        border: '1.5px solid var(--ink)',
        borderRadius: 10,
        padding: '10px 12px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        zIndex: 220,
        pointerEvents: 'none',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', fontSize: 22, lineHeight: 1, color: 'var(--ink)' }}>
        {date.toLocaleDateString('en', { weekday: 'long' })}
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-mute)', fontFamily: 'JetBrains Mono, monospace', marginBottom: 8 }}>
        {date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })} · {total ? fmtH(total) + ' scheduled' : 'no blocks'}
      </div>
      {arr.slice(0, 4).map(t => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 13 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: t.color, flexShrink: 0 }} />
          <span style={{ flex: 1, color: 'var(--ink)' }}>{t.name}</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--ink-mute)' }}>
            {fmtH(t.mins)} · {Math.round((t.mins / total) * 100)}%
          </span>
        </div>
      ))}
      {arr.length > 4 && (
        <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>
          +{arr.length - 4} more
        </div>
      )}
      {total > 0 && (
        <div style={{ fontSize: 11, color: 'var(--orange)', marginTop: 6, fontFamily: 'JetBrains Mono, monospace' }}>
          click to open this day →
        </div>
      )}
    </div>
  );
}

function hexAlpha(hex, a) {
  const h = (hex || '#94A3B8').replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/* ─────────────────── month / quarter / year wrappers ─────────────────── */

export function MonthInsights({ selectedDate, slots, taskTypes, onPickDate, onPaintDay, onPaintRange, onPaintDays, onSaveDaysAsRhythm, multiSelect }) {
  const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
  const monthSlots = (slots || []).filter(s => {
    const k = s.date;
    return k >= ymd(start) && k <= ymd(end);
  });
  // Shared instance from Taskometer keeps the selection across scope
  // switches. If a caller forgets to pass one we fall back to a local
  // hook so older surfaces still work.
  const localMs = useMultiSelect();
  const ms = multiSelect || localMs;
  return (
    <div className="tm-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <CategoryBreakdownBar slots={monthSlots} taskTypes={taskTypes} label="month" />
      <MonthCalendar
        year={selectedDate.getFullYear()}
        month={selectedDate.getMonth()}
        slots={monthSlots}
        taskTypes={taskTypes}
        onPickDate={onPickDate}
        onPaintDay={onPaintDay}
        onPaintRange={onPaintRange}
        selectedKeys={ms.selected}
        onToggleKey={ms.toggle}
        onExtendKey={ms.extend}
        wheelSize={62}
        showHeader
      />
      <SelectionBar
        selected={ms.selected}
        actions={[
          {
            label: 'Paint with wheel →',
            primary: true,
            title: 'Apply a wheel to every selected day',
            onClick: () => { onPaintDays?.([...ms.selected]); ms.clear(); },
          },
          {
            label: 'Save as rhythm',
            title: 'Turn this exact list of days into a reusable rhythm',
            onClick: () => { onSaveDaysAsRhythm?.([...ms.selected]); ms.clear(); },
          },
        ]}
        onClear={ms.clear}
      />
    </div>
  );
}

export function QuarterInsights({ selectedDate, slots, taskTypes, onPickDate, onPaintDay, onPaintRange, onPaintDays, onSaveDaysAsRhythm, multiSelect }) {
  const q = Math.floor(selectedDate.getMonth() / 3);
  const year = selectedDate.getFullYear();
  const start = new Date(year, q * 3, 1);
  const end = new Date(year, q * 3 + 3, 0);
  const slice = (slots || []).filter(s => s.date >= ymd(start) && s.date <= ymd(end));
  // Shared instance from Taskometer keeps the selection across scope
  // switches. If a caller forgets to pass one we fall back to a local
  // hook so older surfaces still work.
  const localMs = useMultiSelect();
  const ms = multiSelect || localMs;
  return (
    <div className="tm-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <CategoryBreakdownBar slots={slice} taskTypes={taskTypes} label="quarter" />
      <ScopeHeatmapHeader title={`Q${q + 1} ${year}`} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
        {[0, 1, 2].map(off => (
          <MonthCalendar
            key={off}
            year={year}
            month={q * 3 + off}
            slots={slice}
            taskTypes={taskTypes}
            onPickDate={onPickDate}
            onPaintDay={onPaintDay}
            onPaintRange={onPaintRange}
            selectedKeys={ms.selected}
            onToggleKey={ms.toggle}
            onExtendKey={ms.extend}
            wheelSize={28}
            compact
            showHeader
          />
        ))}
      </div>
      <SelectionBar
        selected={ms.selected}
        actions={[
          {
            label: 'Paint with wheel →',
            primary: true,
            title: 'Apply a wheel to every selected day',
            onClick: () => { onPaintDays?.([...ms.selected]); ms.clear(); },
          },
          {
            label: 'Save as rhythm',
            title: 'Turn this exact list of days into a reusable rhythm',
            onClick: () => { onSaveDaysAsRhythm?.([...ms.selected]); ms.clear(); },
          },
        ]}
        onClear={ms.clear}
      />
    </div>
  );
}

export function YearInsights({ selectedDate, slots, taskTypes, onPickDate, onPaintDay, onPaintRange, onPaintDays, onSaveDaysAsRhythm, multiSelect }) {
  const y = selectedDate.getFullYear();
  const start = new Date(y, 0, 1);
  const end = new Date(y, 11, 31);
  const slice = (slots || []).filter(s => s.date >= ymd(start) && s.date <= ymd(end));
  // Shared instance from Taskometer keeps the selection across scope
  // switches. If a caller forgets to pass one we fall back to a local
  // hook so older surfaces still work.
  const localMs = useMultiSelect();
  const ms = multiSelect || localMs;
  return (
    <div className="tm-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <CategoryBreakdownBar slots={slice} taskTypes={taskTypes} label="year" />
      <ScopeHeatmapHeader title={`${y}`} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
        {Array.from({ length: 12 }, (_, m) => (
          <MonthCalendar
            key={m}
            year={y}
            month={m}
            slots={slice}
            taskTypes={taskTypes}
            onPickDate={onPickDate}
            onPaintDay={onPaintDay}
            onPaintRange={onPaintRange}
            selectedKeys={ms.selected}
            onToggleKey={ms.toggle}
            onExtendKey={ms.extend}
            wheelSize={22}
            compact
            showHeader
          />
        ))}
      </div>
      <SelectionBar
        selected={ms.selected}
        actions={[
          {
            label: 'Paint with wheel →',
            primary: true,
            title: 'Apply a wheel to every selected day',
            onClick: () => { onPaintDays?.([...ms.selected]); ms.clear(); },
          },
          {
            label: 'Save as rhythm',
            title: 'Turn this exact list of days into a reusable rhythm',
            onClick: () => { onSaveDaysAsRhythm?.([...ms.selected]); ms.clear(); },
          },
        ]}
        onClear={ms.clear}
      />
    </div>
  );
}

/**
 * A clean month calendar — day numbers laid out in the standard
 * Mon–Sun grid, each cell rendering a MiniWheel of that day's blocks.
 * Today is outlined in orange. Click any cell to jump to the day view.
 *
 * Used standalone for MonthInsights, and tiled for QuarterInsights and
 * YearInsights with `compact` reducing the visual weight per cell.
 */
function MonthCalendar({
  year,
  month,
  slots,
  taskTypes,
  onPickDate,
  onPaintDay,
  onPaintRange,
  // Multi-select hooks (Cmd/Ctrl+click toggles, Shift+click extends).
  // When undefined, multi-select is disabled and clicks behave normally.
  selectedKeys,
  onToggleKey,
  onExtendKey,
  wheelSize = 56,
  compact = false,
  showHeader = false,
}) {
  const monthLabel = useMemo(
    () => new Date(year, month, 1).toLocaleDateString('en', { month: 'long', year: 'numeric' }),
    [year, month],
  );

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const lead = (first.getDay() + 6) % 7;
    const out = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= last.getDate(); d++) out.push(new Date(year, month, d));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [year, month]);

  const slotsByDate = useMemo(() => {
    const m = new Map();
    for (const s of slots || []) {
      if (!m.has(s.date)) m.set(s.date, []);
      m.get(s.date).push(s);
    }
    return m;
  }, [slots]);

  // Drag-drop state for chips dropped from the rail. dragOverKey is the
  // date currently under the cursor — we highlight it so the user sees
  // the drop target.
  const [dragOverKey, setDragOverKey] = useState(null);

  // Lasso state. lassoAnchor is the date the user started dragging
  // from. lassoEnd is the date currently under the pointer. Selection
  // is an ordered range of YMD strings between them.
  const [lassoAnchor, setLassoAnchor] = useState(null);
  const [lassoEnd, setLassoEnd] = useState(null);
  const lassoActive = lassoAnchor && lassoEnd;
  const lassoSelection = useMemo(() => {
    if (!lassoActive) return new Set();
    const a = new Date(`${lassoAnchor}T00:00:00`);
    const b = new Date(`${lassoEnd}T00:00:00`);
    const start = a.getTime() <= b.getTime() ? a : b;
    const end = a.getTime() <= b.getTime() ? b : a;
    const set = new Set();
    const cur = new Date(start);
    while (cur.getTime() <= end.getTime()) {
      set.add(ymd(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return set;
  }, [lassoAnchor, lassoEnd, lassoActive]);

  // Once mouse is up anywhere, finish the lasso. Window listener so the
  // user can release outside any cell.
  useEffect(() => {
    if (!lassoAnchor) return;
    const onUp = () => {
      if (lassoAnchor && lassoEnd && onPaintRange) {
        const a = new Date(`${lassoAnchor}T00:00:00`);
        const b = new Date(`${lassoEnd}T00:00:00`);
        const startKey = a.getTime() <= b.getTime() ? lassoAnchor : lassoEnd;
        const endKey = a.getTime() <= b.getTime() ? lassoEnd : lassoAnchor;
        // Only fire for ranges of 2+ days. Single click should still
        // open the day, not the painter — preserves existing behavior.
        if (startKey !== endKey) onPaintRange(startKey, endKey);
      }
      setLassoAnchor(null);
      setLassoEnd(null);
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [lassoAnchor, lassoEnd, onPaintRange]);

  const todayKey = ymd(new Date());
  const cellPad = compact ? 4 : 8;
  const dayFontSize = compact ? 11 : 13;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {showHeader && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', fontSize: compact ? 20 : 26, color: 'var(--ink)', lineHeight: 1 }}>
            {monthLabel}
          </span>
        </div>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 2,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: compact ? 9 : 10,
          color: 'var(--ink-mute)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(l => (
          <div key={l} style={{ padding: '2px 0', textAlign: 'center' }}>{l[0]}</div>
        ))}
      </div>
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}
        onMouseLeave={() => { setDragOverKey(null); }}
      >
        {cells.map((d, i) => {
          if (!d) {
            return <div key={i} style={{ minHeight: wheelSize + cellPad * 2 }} />;
          }
          const key = ymd(d);
          const cellSlots = slotsByDate.get(key) || [];
          const isToday = key === todayKey;
          const isDragOver = dragOverKey === key;
          const isInLasso = lassoSelection.has(key);
          const isMultiSelected = !!(selectedKeys && selectedKeys.has(key));

          // Resolve background + border for the cell's current state.
          // Drag-over wins, then multi-select, then lasso, then today,
          // then default.
          let background = 'var(--paper)';
          let borderStyle = 'dashed';
          let borderColor = 'var(--rule)';
          if (isToday) {
            background = 'var(--paper-warm, #FAF5EC)';
            borderStyle = 'solid';
            borderColor = 'var(--orange)';
          }
          if (isInLasso) {
            background = 'var(--orange-pale, #FBE9DD)';
            borderStyle = 'solid';
            borderColor = 'var(--orange)';
          }
          if (isMultiSelected) {
            background = 'var(--orange-pale, #FBE9DD)';
            borderStyle = 'solid';
            borderColor = 'var(--orange)';
          }
          if (isDragOver) {
            background = 'var(--orange-pale, #FBE9DD)';
            borderStyle = 'solid';
            borderColor = 'var(--orange)';
          }

          return (
            <div
              key={i}
              role="button"
              tabIndex={0}
              onClick={(e) => {
                // Multi-select gestures take priority over plain
                // navigation. Cmd/Ctrl toggles a single day in the
                // selection; Shift extends from the most recent. Plain
                // click clears selection AND opens the day.
                if (selectedKeys && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  onToggleKey?.(key);
                  return;
                }
                if (selectedKeys && e.shiftKey && selectedKeys.size > 0) {
                  e.preventDefault();
                  onExtendKey?.(key);
                  return;
                }
                if (lassoAnchor) return; // suppress click-end-of-drag
                onPickDate?.(d);
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') onPickDate?.(d); }}
              onMouseDown={(e) => {
                if (e.button !== 0) return;
                // Don't start a lasso when a modifier key is held — those
                // are reserved for multi-select toggles.
                if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                if (!onPaintRange) return;
                setLassoAnchor(key);
                setLassoEnd(key);
              }}
              onMouseEnter={() => {
                if (lassoAnchor) setLassoEnd(key);
              }}
              onDragOver={(e) => {
                if (!onPaintDay) return;
                if (e.dataTransfer.types.includes('text/wheel-id')) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                  setDragOverKey(key);
                }
              }}
              onDragLeave={() => {
                if (dragOverKey === key) setDragOverKey(null);
              }}
              onDrop={(e) => {
                if (!onPaintDay) return;
                e.preventDefault();
                const wheelId = e.dataTransfer.getData('text/wheel-id');
                setDragOverKey(null);
                if (wheelId) onPaintDay(wheelId, key);
              }}
              title={`open ${d.toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' }).toLowerCase()} · drop a schedule to paint · drag across days to range-paint`}
              style={{
                cursor: lassoAnchor ? 'crosshair' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                padding: cellPad,
                border: `${isDragOver || isInLasso ? '2px' : '1px'} ${borderStyle} ${borderColor}`,
                borderRadius: 6,
                background,
                transition: 'background 0.08s, border-color 0.08s',
                userSelect: 'none',
                outline: 'none',
              }}
            >
              <span style={{
                fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
                fontSize: dayFontSize + (compact ? 2 : 6),
                lineHeight: 1,
                color: isToday || isInLasso || isDragOver ? 'var(--orange)' : 'var(--ink)',
              }}>
                {d.getDate()}
              </span>
              <MiniWheel slots={cellSlots} size={wheelSize} thickness={Math.max(3, Math.round(wheelSize / 9))} />
              {!compact && (
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--ink-mute)' }}>
                  {cellSlots.length ? `${cellSlots.length}b` : '·'}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {lassoActive && lassoSelection.size > 1 && (
        <div className="tm-mono tm-sm" style={{ color: 'var(--orange)', textAlign: 'center', marginTop: 4 }}>
          {lassoSelection.size} days selected · release to pick a wheel
        </div>
      )}
    </div>
  );
}

function ScopeHeatmapHeader({ title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
      <span style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', fontSize: 22, color: 'var(--ink)' }}>
        {title}
      </span>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--ink-mute)' }}>
        click to open · drag to lasso · ⌘/ctrl + click to multi-select · shift + click to extend
      </span>
    </div>
  );
}
