import { useEffect, useMemo, useState } from 'react';
import { MiniWheel } from './WheelView.jsx';
import TimeBreakdown from './TimeBreakdown.jsx';
import PaintMaterialToolbar from './PaintMaterialToolbar.jsx';
import { formatYMD } from '../utils/time.js';
import './screens.css';

function startOfMonday(d) {
  const out = new Date(d);
  const day = out.getDay();
  out.setDate(out.getDate() + (day === 0 ? -6 : 1 - day));
  out.setHours(0, 0, 0, 0);
  return out;
}

/**
 * WeekCanvas — seven days at a glance, painted the same way as every
 * other zoom: pick a material, drag a range (or hit a shortcut), and
 * the Library asks which schedule. One paint model across the app.
 */
export default function WeekCanvas({
  selectedDate,
  slots = [],
  tasks = [],
  taskTypes = [],
  wheels = [],
  dayAssignments = {},
  dayOverrides = {},
  paintMaterial = 'schedule',
  setPaintMaterial,
  onPickDate,
  onPaintRange,
  onPaintDays,
}) {
  const [lassoAnchor, setLassoAnchor] = useState(null);
  const [lassoEnd, setLassoEnd] = useState(null);
  const lassoActive = !!(lassoAnchor && lassoEnd);

  const monday = useMemo(() => startOfMonday(selectedDate), [selectedDate]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  }), [monday]);
  const keys = useMemo(() => days.map(formatYMD), [days]);
  const range = useMemo(() => ({ startKey: keys[0], endKey: keys[6] }), [keys]);

  const lassoSelection = useMemo(() => {
    if (!lassoActive) return new Set();
    const a = keys.indexOf(lassoAnchor);
    const b = keys.indexOf(lassoEnd);
    if (a < 0 || b < 0) return new Set();
    return new Set(keys.slice(Math.min(a, b), Math.max(a, b) + 1));
  }, [keys, lassoAnchor, lassoEnd, lassoActive]);

  const todayKey = formatYMD(new Date());
  const wheelsById = useMemo(() => new Map(wheels.map(w => [w.id, w])), [wheels]);

  const tasksByDay = useMemo(() => {
    const map = new Map();
    for (const t of tasks) {
      if (!t?.scheduledTime || t.status === 'cancelled') continue;
      const k = formatYMD(new Date(t.scheduledTime));
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

  useEffect(() => {
    if (!lassoAnchor) return undefined;
    const onUp = () => {
      if (lassoAnchor && lassoEnd) {
        const sel = [...lassoSelection];
        if (sel.length) onPaintRange?.(sel[0], sel[sel.length - 1], paintMaterial);
      }
      setLassoAnchor(null);
      setLassoEnd(null);
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [lassoAnchor, lassoEnd, lassoSelection, onPaintRange, paintMaterial]);

  const paintDows = (dows) => onPaintDays?.(keys.filter((_, i) => dows.includes(i)), paintMaterial);
  const weekLabel = `${monday.toLocaleDateString('en', { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString('en', { month: 'short', day: 'numeric' })}`;
  const verb = paintMaterial === 'blank' ? 'clear' : 'paint';

  return (
    <div className="tm-screen">
      <PaintMaterialToolbar material={paintMaterial} setMaterial={setPaintMaterial} />

      <div className="tm-week-shortcuts">
        <span className="tm-picker-eyebrow">{verb} this week</span>
        <button type="button" className="tm-btn tm-sm" onClick={() => paintDows([0, 1, 2, 3, 4])} title={`${verb} Monday → Friday`}>weekdays</button>
        <button type="button" className="tm-btn tm-sm" onClick={() => paintDows([5, 6])} title={`${verb} Saturday + Sunday`}>weekend</button>
        <button type="button" className={`tm-btn tm-sm${paintMaterial === 'blank' ? '' : ' tm-primary'}`} onClick={() => paintDows([0, 1, 2, 3, 4, 5, 6])} title={`${verb} all 7 days`}>full week</button>
        <span className="tm-mono tm-sm tm-paint-toolbar-hint">{weekLabel} · click + drag days too</span>
      </div>

      <div className="tm-week-strip" role="list" aria-label="days this week">
        {days.map((d, i) => {
          const key = keys[i];
          const isToday = key === todayKey;
          const wheel = dayAssignments[key] ? wheelsById.get(dayAssignments[key]) : null;
          const override = dayOverrides[key] || null;
          const daySlots = slotsByDay.get(key) || [];
          const dayTasks = tasksByDay.get(key) || [];
          const done = dayTasks.filter(t => t.status === 'completed').length;
          const cls = [
            'tm-week-day',
            isToday ? 'tm-today' : '',
            lassoSelection.has(key) ? 'tm-lasso' : '',
            lassoAnchor ? 'tm-lassoing' : '',
          ].filter(Boolean).join(' ');
          return (
            <div
              key={key}
              role="listitem"
              tabIndex={0}
              className={cls}
              onClick={() => { if (!lassoActive) onPickDate?.(d); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPickDate?.(d); } }}
              onMouseDown={(e) => {
                if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
                setLassoAnchor(key);
                setLassoEnd(key);
              }}
              onMouseEnter={() => { if (lassoAnchor) setLassoEnd(key); }}
              title={`open ${d.toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })} · drag across days to ${verb}`}
            >
              <div className="tm-week-dow">{d.toLocaleDateString('en', { weekday: 'short' })}</div>
              <div className="tm-week-num">{d.getDate()}</div>
              <MiniWheel slots={daySlots} size={84} thickness={10} highlight={isToday} />
              <div className="tm-week-meta">{wheel ? wheel.name : override ? (override.label || override.type) : '—'}</div>
              <div className="tm-week-meta">{dayTasks.length > 0 ? `${done}/${dayTasks.length} task${dayTasks.length === 1 ? '' : 's'}` : '—'}</div>
            </div>
          );
        })}
      </div>

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
