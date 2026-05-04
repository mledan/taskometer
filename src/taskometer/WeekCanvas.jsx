import React, { useEffect, useMemo, useState } from 'react';
import { MiniWheel } from './WheelView.jsx';
import TimeBreakdown from './TimeBreakdown.jsx';

function ymd(d) {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

function startOfMonday(d) {
  const out = new Date(d);
  const day = out.getDay(); // 0 Sun .. 6 Sat
  const offset = day === 0 ? -6 : 1 - day;
  out.setDate(out.getDate() + offset);
  out.setHours(0, 0, 0, 0);
  return out;
}

/**
 * WeekCanvas — replaces the old WeekTimeline. Three priorities:
 *
 *   1. Density. The whole week visible at once, with mini-wheels and
 *      task counts per day. No scrolling to see Friday.
 *   2. Stats. TimeBreakdown gives the user the percentage-of-time
 *      view they asked for ("23% deep work, 15% sleep…").
 *   3. Paint controls. The signature controls for this scale:
 *      - Apply <schedule> to weekdays
 *      - Apply <schedule> to weekends
 *      - Apply <schedule> to the whole week
 *      - Save this week as a recurring template (dispatch upstream)
 *
 * One scale, one set of decisions. The user said: "each of the views
 * should give the user a unique control to paint their schedule …
 * act at a large scale to repeat things."
 */
export default function WeekCanvas({
  selectedDate,
  slots = [],
  tasks = [],
  taskTypes = [],
  wheels = [],
  dayAssignments = {},
  dayOverrides = {},
  onPickDate,
  onPaintRange,
}) {
  const [paintWheelId, setPaintWheelId] = useState(() => wheels[0]?.id || '');
  const [paintMaterial, setPaintMaterial] = useState('schedule'); // 'schedule' | 'blank'

  // Lasso state — click-drag across days paints the selected paint
  // material onto the range. The user said: "i want to do click and
  // drag, wether it's a path, a single task, blankness, or a full
  // day or week."
  const [lassoAnchor, setLassoAnchor] = useState(null);
  const [lassoEnd, setLassoEnd] = useState(null);
  const lassoActive = !!(lassoAnchor && lassoEnd);
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
  const monday = useMemo(() => startOfMonday(selectedDate), [selectedDate]);
  const days = useMemo(() => {
    const out = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      out.push(d);
    }
    return out;
  }, [monday]);

  const range = useMemo(() => ({
    startKey: ymd(days[0]),
    endKey: ymd(days[6]),
  }), [days]);

  const todayKey = ymd(new Date());
  const wheelsById = useMemo(() => {
    const m = new Map();
    for (const w of wheels) m.set(w.id, w);
    return m;
  }, [wheels]);

  const tasksByDay = useMemo(() => {
    const map = new Map();
    for (const t of tasks) {
      if (!t?.scheduledTime) continue;
      if (t.status === 'cancelled') continue;
      const k = ymd(new Date(t.scheduledTime));
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(t);
    }
    return map;
  }, [tasks]);

  const slotsByDay = useMemo(() => {
    const map = new Map();
    for (const s of slots) {
      if (!s?.date) continue;
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date).push(s);
    }
    return map;
  }, [slots]);

  const paintWheel = wheels.find(w => w.id === paintWheelId) || wheels[0] || null;

  // Mouseup anywhere finishes a lasso. If the anchor and end span >1
  // day, fire the range-paint with the current material.
  useEffect(() => {
    if (!lassoAnchor) return;
    const onUp = () => {
      if (lassoAnchor && lassoEnd) {
        const a = new Date(`${lassoAnchor}T00:00:00`);
        const b = new Date(`${lassoEnd}T00:00:00`);
        const startKey = a.getTime() <= b.getTime() ? lassoAnchor : lassoEnd;
        const endKey = a.getTime() <= b.getTime() ? lassoEnd : lassoAnchor;
        if (paintMaterial === 'blank') {
          onPaintRange?.({ wheelId: null, material: 'blank', startKey, endKey });
        } else if (paintWheel) {
          onPaintRange?.({ wheelId: paintWheel.id, startKey, endKey });
        }
      }
      setLassoAnchor(null);
      setLassoEnd(null);
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [lassoAnchor, lassoEnd, onPaintRange, paintMaterial, paintWheel]);

  const paintWeekdays = () => {
    if (!paintWheel) return;
    onPaintRange?.({
      wheelId: paintWheel.id,
      startKey: range.startKey,
      endKey: range.endKey,
      weekdaysOnly: true,
    });
  };
  const paintWeekends = () => {
    if (!paintWheel) return;
    onPaintRange?.({
      wheelId: paintWheel.id,
      startKey: range.startKey,
      endKey: range.endKey,
      weekendsOnly: true,
    });
  };
  const paintWeek = () => {
    if (!paintWheel) return;
    onPaintRange?.({
      wheelId: paintWheel.id,
      startKey: range.startKey,
      endKey: range.endKey,
    });
  };

  const weekLabel = `${monday.toLocaleDateString('en', { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString('en', { month: 'short', day: 'numeric' })}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Paint controls */}
      <div
        className="tm-card"
        style={{
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          paint this week
        </div>
        <div className="tm-seg">
          <button
            type="button"
            className={paintMaterial === 'schedule' ? 'tm-on' : ''}
            onClick={() => setPaintMaterial('schedule')}
            title="paint a schedule onto the dragged days"
            style={{ fontSize: 11 }}
          >
            schedule
          </button>
          <button
            type="button"
            className={paintMaterial === 'blank' ? 'tm-on' : ''}
            onClick={() => setPaintMaterial('blank')}
            title="erase blocks on the dragged days (clear the day)"
            style={{ fontSize: 11 }}
          >
            blank
          </button>
        </div>
        {paintMaterial === 'schedule' && (
          <select
            className="tm-composer-select"
            value={paintWheelId}
            onChange={(e) => setPaintWheelId(e.target.value)}
            aria-label="schedule to paint"
            style={{ fontSize: 13 }}
          >
            {wheels.length === 0 && <option value="">no schedules saved</option>}
            {wheels.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="tm-btn tm-sm"
          onClick={paintWeekdays}
          disabled={paintMaterial !== 'schedule' || !paintWheel}
          title="apply this schedule to Monday → Friday this week"
        >
          weekdays
        </button>
        <button
          type="button"
          className="tm-btn tm-sm"
          onClick={paintWeekends}
          disabled={paintMaterial !== 'schedule' || !paintWheel}
          title="apply this schedule to Saturday + Sunday"
        >
          weekends
        </button>
        <button
          type="button"
          className="tm-btn tm-primary tm-sm"
          onClick={paintWeek}
          disabled={paintMaterial !== 'schedule' || !paintWheel}
          title="apply this schedule to all 7 days"
        >
          full week
        </button>
        <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', marginLeft: 'auto' }}>
          {weekLabel} · click+drag days to paint
        </span>
      </div>

      {/* 7-day strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(110px, 1fr))',
          gap: 8,
        }}
      >
        {days.map(d => {
          const key = ymd(d);
          const isToday = key === todayKey;
          const wkLabel = d.toLocaleDateString('en', { weekday: 'short' }).toLowerCase();
          const dn = d.getDate();
          const wheelId = dayAssignments[key];
          const wheel = wheelId ? wheelsById.get(wheelId) : null;
          const override = dayOverrides[key] || null;
          const daySlots = slotsByDay.get(key) || [];
          const dayTasks = tasksByDay.get(key) || [];
          const doneTasks = dayTasks.filter(t => t.status === 'completed').length;

          const isInLasso = lassoSelection.has(key);
          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              onClick={() => { if (!lassoActive) onPickDate?.(d); }}
              onMouseDown={(e) => {
                if (e.button !== 0) return;
                if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                setLassoAnchor(key);
                setLassoEnd(key);
              }}
              onMouseEnter={() => {
                if (lassoAnchor) setLassoEnd(key);
              }}
              title={`open ${d.toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })} · click + drag to paint a range`}
              style={{
                cursor: lassoAnchor ? 'crosshair' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '10px 8px',
                border: `1.5px ${isInLasso ? 'solid var(--orange)' : isToday ? 'solid var(--orange)' : 'dashed var(--rule)'}`,
                borderRadius: 10,
                background: isInLasso ? 'var(--orange-pale, #FBE9DD)' : (isToday ? 'var(--paper-warm, #FAF5EC)' : 'var(--paper)'),
                transition: 'background 0.1s',
                userSelect: 'none',
              }}
              onMouseLeave={(e) => { if (!isToday && !isInLasso) e.currentTarget.style.background = 'var(--paper)'; }}
            >
              <div
                className="tm-mono tm-sm"
                style={{
                  color: 'var(--ink-mute)',
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                  fontSize: 10,
                }}
              >
                {wkLabel}
              </div>
              <div
                style={{
                  fontSize: 22,
                  lineHeight: 1,
                  color: isToday ? 'var(--orange)' : 'var(--ink)',
                  fontWeight: isToday ? 700 : 500,
                }}
              >
                {dn}
              </div>
              <MiniWheel slots={daySlots} size={84} thickness={10} highlight={isToday} />
              <div
                className="tm-mono tm-sm"
                style={{
                  color: 'var(--ink-mute)',
                  fontSize: 10,
                  textAlign: 'center',
                  lineHeight: 1.3,
                }}
              >
                {wheel ? wheel.name : override ? (override.label || override.type) : '—'}
              </div>
              <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', fontSize: 10 }}>
                {dayTasks.length > 0 ? `${doneTasks}/${dayTasks.length} task${dayTasks.length === 1 ? '' : 's'}` : '—'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time breakdown */}
      <TimeBreakdown
        slots={slots}
        range={range}
        taskTypes={taskTypes}
        tasks={tasks}
        title="Where the week goes"
        subtitle={`${weekLabel} · planned hours by category`}
      />
    </div>
  );
}
