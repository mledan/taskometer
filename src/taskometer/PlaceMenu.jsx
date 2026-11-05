import { useEffect, useRef, useState } from 'react';
import { fmtClock } from './quickAdd';
import { formatYMD } from '../utils/time.js';
import './capture.css';

function hhmmToMin(s) {
  const [h, m] = (s || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function slotName(s) {
  return s.label || s.name || s.title || s.type || s.slotType || 'block';
}

/**
 * The tap alternative to dragging a task onto the wheel. One menu, four
 * ways to place: next open block today, tomorrow, a specific block on
 * the day in view, or any date.
 */
export default function PlaceMenu({
  taskId,
  daySlots = [],
  dayKey,
  onPlaceInSlot,
  onPlaceOnDate,
  label = 'place ▾',
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const todayKey = formatYMD(new Date());
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = formatYMD(tomorrow);
  const viewingToday = !dayKey || dayKey === todayKey;
  const sorted = daySlots.slice().sort((a, b) => hhmmToMin(a.startTime) - hhmmToMin(b.startTime));

  const pick = (fn) => { setOpen(false); fn(); };

  return (
    <span className="tm-place" ref={rootRef} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="tm-place-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        title="put this task into a block"
      >
        {label}
      </button>
      {open && (
        <div className="tm-place-menu" role="menu">
          <button type="button" role="menuitem" className="tm-place-item" onClick={() => pick(() => onPlaceOnDate(taskId, todayKey))}>
            Next open block
            <span className="tm-place-when">today</span>
          </button>
          <button type="button" role="menuitem" className="tm-place-item" onClick={() => pick(() => onPlaceOnDate(taskId, tomorrowKey))}>
            Next open block
            <span className="tm-place-when">tomorrow</span>
          </button>

          <div className="tm-place-group">{viewingToday ? "today's blocks" : `blocks on ${dayKey}`}</div>
          {sorted.length === 0 && (
            <div className="tm-place-item tm-place-empty">no blocks painted on this day</div>
          )}
          {sorted.map(s => (
            <button
              key={s.id}
              type="button"
              role="menuitem"
              className="tm-place-item"
              onClick={() => pick(() => onPlaceInSlot(taskId, s.id))}
            >
              <span className="tm-place-dot" style={{ background: s.color || 'var(--ink-mute)' }} aria-hidden />
              {slotName(s)}
              <span className="tm-place-when">{fmtClock(hhmmToMin(s.startTime))}–{fmtClock(hhmmToMin(s.endTime))}</span>
            </button>
          ))}

          <div className="tm-place-group">any day</div>
          <div className="tm-place-date">
            <input
              type="date"
              aria-label="pick a day"
              onChange={(e) => { const v = e.target.value; if (v) pick(() => onPlaceOnDate(taskId, v)); }}
            />
            <span className="tm-mono tm-sm">→ next open block</span>
          </div>
        </div>
      )}
    </span>
  );
}
