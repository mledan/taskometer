import { useEffect, useMemo, useRef, useState } from 'react';
import { hmToMin, WEEKDAY_KEYS } from '../services/api/derive';
import { ymd, isoAt, parseCapture, fmtClock } from './quickAdd';
import PlaceMenu from './PlaceMenu.jsx';

/**
 * SpiralBoard — a 2D time-spiral canvas paired with a todo list.
 * Each loop = one day, midnight at top, winding outward from "now".
 * Continuous zoom (scroll / pinch / buttons); click to place, drag to
 * move, drag the trailing dot to stretch.
 *
 * Reads main's state directly:
 *   - tasks            → events (scheduled tasks)
 *   - slots            → concrete ad-hoc backdrop bands
 *   - settings.scheduleTypes → faint tag-window backdrop bands
 *
 * Adds go through `onAdd` (parent's handleAddTask) so tag-routing and
 * the existing scheduler logic stay in one place. Explicit times and
 * pending click-placements bypass routing and pin exactly where dropped.
 */

const VIEW = 460;
const CX = VIEW / 2;
const CY = VIEW / 2;
const A0 = 44;
const MAX_R = 206;
const RADIAL = MAX_R - A0;
const SNAP = 15;
const TAU = Math.PI * 2;
const DAY_MS = 86400000;
const DEFAULT_PXPERDAY = 32;
const MIN_PXPERDAY = 4;
const MAX_PXPERDAY = 520;
const FOCUS_PXPERDAY = 190;

const hm = (mm) => {
  const v = ((Math.round(mm) % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
};
function addDays(date, d) {
  const out = new Date(date); out.setHours(0, 0, 0, 0); out.setDate(out.getDate() + d); return out;
}
function startOfDayMs(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime();
}
function spanLabel(days) {
  if (days < 1) return `≈ ${Math.round(days * 24)}h`;
  if (days < 14) return `≈ ${days.toFixed(days < 3 ? 1 : 0)} days`;
  if (days < 70) return `≈ ${Math.round(days / 7)} weeks`;
  return `≈ ${Math.round(days / 30)} months`;
}

function useIsNarrow(bp = 760) {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < bp);
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < bp);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [bp]);
  return narrow;
}

/** A day's blocks + events, computed locally from main's state. */
function deriveDayBlocks({ settings = {}, slots = [], tasks = [], date }) {
  const dayKey = ymd(date);
  const weekdayKey = WEEKDAY_KEYS[date.getDay()];

  const splitWindow = (b, idBase, source, extra = {}) => {
    const startMin = hmToMin(b.startTime);
    let endMin = hmToMin(b.endTime);
    const base = { label: b.label || b.slotType || 'block', color: b.color || null, source, ...extra };
    if (endMin > startMin) return [{ ...base, id: idBase, startMin, endMin }];
    return [
      { ...base, id: `${idBase}:e`, startMin, endMin: 24 * 60 },
      { ...base, id: `${idBase}:m`, startMin: 0, endMin },
    ];
  };

  const typeBlocks = (settings.scheduleTypes || [])
    .filter(ty => ty.startTime && ty.endTime && (!Array.isArray(ty.days) || ty.days.length === 0 || ty.days.includes(weekdayKey)))
    .flatMap(ty => splitWindow({
      startTime: ty.startTime, endTime: ty.endTime,
      label: ty.name || ty.tag, color: ty.color,
    }, `type:${ty.id}:${dayKey}`, 'type', { typeId: ty.id, tag: ty.tag }));

  const adhoc = (slots || []).filter(s => s?.date === dayKey).map(s => {
    const startMin = hmToMin(s.startTime);
    let endMin = hmToMin(s.endTime);
    if (endMin <= startMin) endMin += 24 * 60;
    return { id: s.id, label: s.label || s.slotType || 'block', color: s.color || null, startMin, endMin, source: 'adhoc' };
  });

  const events = (tasks || [])
    .filter(t => {
      if (!t?.scheduledTime || t.status === 'cancelled') return false;
      const d = new Date(t.scheduledTime);
      return !Number.isNaN(d.getTime()) && ymd(d) === dayKey;
    })
    .map(t => {
      const d = new Date(t.scheduledTime);
      const startMin = d.getHours() * 60 + d.getMinutes();
      const duration = typeof t.duration === 'number' ? t.duration : 30;
      return {
        id: t.id || t.key,
        text: t.text || t.title || 'task',
        status: t.status,
        startMin,
        endMin: startMin + duration,
        duration,
        scheduleTypeId: t.metadata?.scheduleTypeId || null,
        tags: t.tags || [],
      };
    })
    .sort((a, b) => a.startMin - b.startMin);

  return {
    dayKey,
    weekdayKey,
    blocks: [...typeBlocks, ...adhoc].sort((a, b) => a.startMin - b.startMin),
    events,
  };
}

function nextOpenStart({ events = [], now = new Date(), snap = 15 }) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const lastEnd = events.reduce((mx, e) => Math.max(mx, e.endMin), 0);
  let start = Math.max(nowMin, lastEnd);
  return Math.min(Math.ceil(start / snap) * snap, 23 * 60);
}

export default function SpiralBoard({
  settings = {},
  slots = [],
  tasks = [],
  api,
  onAdd, // (data) => Promise — main's handleAddTask, for tag-routing etc.
  onPlaceOnDate,
  onPlaceInSlot,
  now = new Date(),
}) {
  const [addText, setAddText] = useState('');
  const [centerDayMs, setCenterDayMs] = useState(() => startOfDayMs(now));
  const [pxPerDay, setPxPerDay] = useState(() => {
    const v = parseFloat(localStorage.getItem('tm.spiralZoom') || '');
    return Number.isFinite(v) && v >= MIN_PXPERDAY && v <= MAX_PXPERDAY ? v : DEFAULT_PXPERDAY;
  });
  const [selectedId, setSelectedId] = useState(null);
  const [selectedLaterId, setSelectedLaterId] = useState(null);
  const [pending, setPending] = useState(null); // {dayKey, startMin}
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [drag, setDrag] = useState(null);   // {id, dayKey, startMin, duration}
  const [resize, setResize] = useState(null); // {id, duration}
  const svgRef = useRef(null);
  const dragInfo = useRef(null);
  const suppressClick = useRef(false);
  const inputRef = useRef(null);
  const pxPerDayRef = useRef(pxPerDay);
  pxPerDayRef.current = pxPerDay;
  const pinchRef = useRef(null);
  const multiTouchRef = useRef(false);
  const isNarrow = useIsNarrow();

  useEffect(() => { if (pending && inputRef.current) inputRef.current.focus(); }, [pending]);

  const scheduleTypes = settings.scheduleTypes || [];
  const colorForEvent = (ev) => {
    const ty = scheduleTypes.find(t => t.id === ev.scheduleTypeId || (ev.tags || []).includes(String(t.tag || '').toLowerCase()));
    return ty ? ty.color : 'var(--orange)';
  };

  const centerDay = useMemo(() => new Date(centerDayMs), [centerDayMs]);
  const todayMs = startOfDayMs(now);
  const nowFrac = (now.getHours() * 60 + now.getMinutes()) / 1440;
  const bRing = pxPerDay;
  const bandWidth = Math.min(28, bRing * 0.5);
  const maxT = RADIAL / bRing;
  const loopCount = Math.max(1, Math.ceil(maxT) + 1);

  const setZoom = (px) => {
    const v = Math.min(MAX_PXPERDAY, Math.max(MIN_PXPERDAY, px));
    try { localStorage.setItem('tm.spiralZoom', String(v)); } catch (_) { /* storage unavailable */ }
    setPxPerDay(v);
    return v;
  };
  const zoom = (factor) => setZoom(pxPerDayRef.current * factor);

  // Wheel + pinch zoom (non-passive listeners so we can preventDefault).
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const dist = (ts) => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
    const onWheel = (e) => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15); };
    const onTouchStart = (e) => {
      if (e.touches.length >= 2) {
        multiTouchRef.current = true;
        pinchRef.current = { startDist: dist(e.touches), startPx: pxPerDayRef.current };
        e.preventDefault();
      }
    };
    const onTouchMove = (e) => {
      if (pinchRef.current && e.touches.length >= 2) {
        e.preventDefault();
        const ratio = dist(e.touches) / (pinchRef.current.startDist || 1);
        setZoom(pinchRef.current.startPx * ratio);
      }
    };
    const onTouchEnd = (e) => {
      if (e.touches.length < 2) pinchRef.current = null;
      if (e.touches.length === 0) multiTouchRef.current = false;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  const dayModels = useMemo(() => {
    const out = [];
    for (let d = 0; d < loopCount; d++) {
      const date = addDays(centerDay, d);
      out.push({ d, ...deriveDayBlocks({ settings, slots, tasks, date }) });
    }
    return out;
  }, [settings, slots, tasks, centerDayMs, loopCount]);

  const laterTodos = useMemo(
    () => tasks.filter(t => t && t.status !== 'completed' && t.status !== 'cancelled' && !t.scheduledTime),
    [tasks]
  );
  const scheduledTodos = useMemo(
    () => tasks
      .filter(t => t && t.status !== 'cancelled' && t.scheduledTime)
      .sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime)),
    [tasks]
  );

  // ----- geometry ---------------------------------------------------------
  const project = (T) => {
    const f = T - Math.floor(T);
    const r = A0 + bRing * T;
    return { x: CX + r * Math.sin(TAU * f), y: CY - r * Math.cos(TAU * f) };
  };
  const arcPath = (T0, T1) => {
    const span = T1 - T0;
    const n = Math.max(2, Math.ceil(span * 48));
    let s = '';
    for (let i = 0; i <= n; i++) {
      const T = T0 + (span * i) / n;
      const { x, y } = project(T);
      s += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)} `;
    }
    return s.trim();
  };
  const svgXY = (clientX, clientY) => {
    const r = svgRef.current.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * VIEW, y: ((clientY - r.top) / r.height) * VIEW };
  };
  const hitToTime = (px, py) => {
    const dx = px - CX, dy = py - CY;
    const r = Math.hypot(dx, dy);
    let f = Math.atan2(dx, -dy) / TAU; if (f < 0) f += 1;
    let d = Math.round((r - A0) / bRing - f);
    d = Math.max(0, Math.min(loopCount - 1, d));
    return { d, startMin: Math.round((f * 1440) / SNAP) * SNAP };
  };
  const angleFrac = (px, py) => {
    let f = Math.atan2(px - CX, -(py - CY)) / TAU; if (f < 0) f += 1; return f;
  };

  // ----- operations -------------------------------------------------------
  const placeAt = (id, dayKey, startMin) => {
    const iso = isoAt(dayKey, startMin);
    const date = new Date(`${dayKey}T00:00:00`);
    api.tasks.update(id, {
      scheduledTime: iso, scheduledFor: iso,
      specificTime: hm(startMin), specificDay: date.toLocaleDateString('en', { weekday: 'long' }),
    });
  };

  const submitAdd = (e) => {
    e?.preventDefault?.();
    const parsed = parseCapture(addText, now);
    const label = parsed.text;
    if (!label) return;
    const base = { text: label, duration: parsed.durationMin || 30 };
    if (parsed.tags.length) base.tags = parsed.tags;
    if (pending) {
      const iso = isoAt(pending.dayKey, pending.startMin);
      api.tasks.add({ ...base, scheduledTime: iso, scheduledFor: iso, autoSchedule: false });
      setPending(null);
    } else if (parsed.startMin != null) {
      const iso = isoAt(parsed.dateKey || dayModels[0].dayKey, parsed.startMin);
      api.tasks.add({ ...base, scheduledTime: iso, scheduledFor: iso, autoSchedule: false });
    } else if (parsed.dateKey) {
      const iso = isoAt(parsed.dateKey, 9 * 60);
      api.tasks.add({ ...base, scheduledTime: iso, scheduledFor: iso, autoSchedule: false });
    } else if (typeof onAdd === 'function') {
      // Delegate to main's handleAddTask so tag routing + the scheduler apply.
      onAdd(base);
    } else {
      api.tasks.add({ ...base, autoSchedule: false });
    }
    setAddText('');
  };

  const bump = (t, delta) => api.tasks.update(t.id, { duration: Math.max(15, (t.duration || 30) + delta) });
  const kick = (t) => {
    if (!t.scheduledTime) return;
    const d = new Date(t.scheduledTime); d.setDate(d.getDate() + 1);
    api.tasks.update(t.id, { scheduledTime: d.toISOString(), scheduledFor: d.toISOString() });
  };
  const push = (t) => {
    if (!t.scheduledTime) return;
    const d = new Date(t.scheduledTime); d.setMinutes(d.getMinutes() + 60);
    api.tasks.update(t.id, { scheduledTime: d.toISOString(), scheduledFor: d.toISOString() });
  };
  const unschedule = (t) => api.tasks.update(t.id, { scheduledTime: null, scheduledFor: null, scheduledSlotId: null });
  const scheduleLater = (t) => {
    const start = nextOpenStart({ events: dayModels[0].events, now });
    placeAt(t.id, dayModels[0].dayKey, start);
    setSelectedLaterId(null);
  };
  const focusOn = (t) => {
    if (!t.scheduledTime) return;
    setCenterDayMs(startOfDayMs(new Date(t.scheduledTime)));
    setZoom(FOCUS_PXPERDAY);
  };
  const startRename = (t) => { setEditingId(t.id); setEditText(t.text); };
  const saveRename = (id) => { const v = editText.trim(); if (v) api.tasks.update(id, { text: v }); setEditingId(null); };

  // ----- spiral interactions ---------------------------------------------
  const onEventDown = (e, ev, dm) => {
    if (e.button !== 0 || multiTouchRef.current) return;
    e.stopPropagation();
    suppressClick.current = false;
    const duration = Math.max(15, ev.endMin - ev.startMin);
    dragInfo.current = { id: ev.id, duration, dayKey: dm.dayKey, startMin: ev.startMin, moved: false };
    const move = (me) => {
      const { x, y } = svgXY(me.clientX, me.clientY);
      const hit = hitToTime(x, y);
      dragInfo.current.moved = true;
      dragInfo.current.dayKey = dayModels[hit.d].dayKey;
      dragInfo.current.startMin = hit.startMin;
      setDrag({ id: ev.id, dayKey: dragInfo.current.dayKey, startMin: hit.startMin, duration });
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      const di = dragInfo.current;
      if (di && di.moved) { suppressClick.current = true; placeAt(di.id, di.dayKey, di.startMin); }
      dragInfo.current = null; setDrag(null);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  const onResizeDown = (e, ev) => {
    if (e.button !== 0 || multiTouchRef.current) return;
    e.stopPropagation();
    let nextDur = ev.endMin - ev.startMin;
    const move = (me) => {
      const { x, y } = svgXY(me.clientX, me.clientY);
      const f = angleFrac(x, y);
      let endMin = Math.round((f * 1440) / SNAP) * SNAP;
      if (endMin <= ev.startMin) endMin = Math.min(1440, ev.startMin + SNAP);
      nextDur = Math.max(SNAP, endMin - ev.startMin);
      setResize({ id: ev.id, duration: nextDur });
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      suppressClick.current = true;
      api.tasks.update(ev.id, { duration: nextDur });
      setResize(null);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  const onBgClick = (e) => {
    if (multiTouchRef.current) return;
    const { x, y } = svgXY(e.clientX, e.clientY);
    const hit = hitToTime(x, y);
    if (selectedLaterId) { placeAt(selectedLaterId, dayModels[hit.d].dayKey, hit.startMin); setSelectedLaterId(null); return; }
    setSelectedId(null);
    setPending({ dayKey: dayModels[hit.d].dayKey, startMin: hit.startMin });
  };

  // ----- render helpers ---------------------------------------------------
  const guides = [0, 0.25, 0.5, 0.75].map((f, i) => {
    const p = project(f), pO = project(Math.max(0, loopCount - 1) + f);
    return { f, label: ['12a', '6a', '12p', '6p'][i], x1: p.x, y1: p.y, x2: pO.x, y2: pO.y };
  });
  const dayLabel = (d) => {
    const date = addDays(centerDay, d);
    if (startOfDayMs(date) === todayMs) return 'today';
    return date.toLocaleDateString('en', { weekday: 'short' });
  };
  const pendingIdx = pending ? dayModels.findIndex(m => m.dayKey === pending.dayKey) : -1;
  const nowT = (todayMs - centerDayMs) / DAY_MS + nowFrac;

  return (
    <div className="tm-board">
      <form onSubmit={submitAdd} className="tm-spiral-add">
        <input
          ref={inputRef}
          className={`tm-flow-input${pending ? ' tm-pending' : ''}`}
          value={addText}
          onChange={(e) => setAddText(e.target.value)}
          placeholder={pending
            ? `name for ${fmtClock(pending.startMin)} ${dayLabel(pendingIdx)}…`
            : 'add a todo… "gym 6pm", "call mom tomorrow 20m", "#deep write spec"'}
        />
        <button type="submit" className="tm-btn tm-primary">add</button>
        {pending && <button type="button" className="tm-btn tm-spiral-cancel" onClick={() => setPending(null)}>×</button>}
      </form>

      <div className={`tm-spiral-layout${isNarrow ? ' tm-narrow' : ''}`}>
        <div className="tm-spiral-stage">
          <div className="tm-spiral-ctl">
            <button className="tm-btn tm-sm" onClick={() => setCenterDayMs(d => d - DAY_MS)} title="pan back one day">‹</button>
            <button className="tm-btn tm-sm" onClick={() => { setCenterDayMs(todayMs); setZoom(DEFAULT_PXPERDAY); }} title="reset to today">today</button>
            <button className="tm-btn tm-sm" onClick={() => setCenterDayMs(d => d + DAY_MS)} title="pan forward one day">›</button>
            <span className="tm-spiral-gap" />
            <button className="tm-btn tm-sm" onClick={() => zoom(1 / 1.5)} title="zoom out">−</button>
            <span className="tm-mono tm-sm tm-spiral-span">{spanLabel(maxT)}</span>
            <button className="tm-btn tm-sm" onClick={() => zoom(1.5)} title="zoom in">+</button>
            {selectedLaterId && <span className="tm-mono tm-sm tm-spiral-place-hint">click the spiral to place it</span>}
          </div>

          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            className="tm-spiral-svg"
            onClick={onBgClick}
          >
            {guides.map(g => (
              <g key={g.f}>
                <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke="var(--rule-soft)" strokeWidth="1" strokeDasharray="2 4" />
                <text x={g.x2} y={g.y2} fontSize="10" fill="var(--ink-mute)" textAnchor="middle" dy="-3" className="tm-mono">{g.label}</text>
              </g>
            ))}
            <path d={arcPath(0, Math.max(0.002, maxT))} fill="none" stroke="var(--rule-soft)" strokeWidth="1" opacity="0.7" />

            {dayModels.map(dm => dm.blocks.map(b => {
              const T0 = dm.d + b.startMin / 1440;
              const T1 = dm.d + b.endMin / 1440;
              if (T0 > maxT) return null;
              const spanMin = b.endMin - b.startMin;
              const showLabel = spanMin >= 75 && pxPerDay >= 16 && T1 <= maxT;
              const mid = showLabel ? project((T0 + T1) / 2) : null;
              return (
                <g key={`${dm.dayKey}-b-${b.id}`}>
                  <path d={arcPath(T0, Math.min(T1, maxT))} fill="none" stroke={b.color || 'var(--ink-mute)'}
                    strokeOpacity={b.source === 'type' ? 0.2 : 0.34}
                    strokeWidth={bandWidth} strokeLinecap="round"
                    strokeDasharray={b.source === 'type' ? '1 6' : undefined}>
                    <title>{`${b.label} · ${fmtClock(b.startMin)}–${fmtClock(b.endMin)}${b.source === 'type' ? ' (type window)' : ''}`}</title>
                  </path>
                  {showLabel && (
                    <text x={mid.x} y={mid.y} fontSize="8.5" fill={b.color || 'var(--ink-mute)'} fillOpacity="0.65"
                      textAnchor="middle" dy="3" className="tm-mono" style={{ pointerEvents: 'none' }}>{b.label}</text>
                  )}
                </g>
              );
            }))}

            {dayModels.map(dm => dm.events.map(ev => {
              if (drag && drag.id === ev.id) return null;
              const dur = (resize && resize.id === ev.id) ? resize.duration : (ev.endMin - ev.startMin);
              const T0 = dm.d + ev.startMin / 1440;
              const T1 = dm.d + (ev.startMin + dur) / 1440;
              if (T0 > maxT) return null;
              const isSel = selectedId === ev.id;
              const done = ev.status === 'completed';
              const mid = project((T0 + Math.max(T1, T0 + 0.012)) / 2);
              const end = project(Math.min(T1, maxT));
              const stroke = colorForEvent(ev);
              return (
                <g key={`${dm.dayKey}-e-${ev.id}`} style={{ cursor: 'grab' }}
                  onPointerDown={(e) => onEventDown(e, ev, dm)}
                  onClick={(e) => { e.stopPropagation(); if (suppressClick.current) { suppressClick.current = false; return; } setSelectedId(ev.id); setSelectedLaterId(null); setPending(null); }}>
                  <path d={arcPath(T0, Math.min(Math.max(T1, T0 + 0.012), maxT))} fill="none" stroke={stroke} strokeOpacity={done ? 0.4 : 1}
                    strokeWidth={isSel ? bandWidth * 0.95 : bandWidth * 0.62} strokeLinecap="round" />
                  <text x={mid.x} y={mid.y} fontSize="9.5" fill="var(--ink)" textAnchor="middle" dy="3"
                    style={{ pointerEvents: 'none', textDecoration: done ? 'line-through' : 'none' }}>
                    {ev.text.length > 10 ? ev.text.slice(0, 9) + '…' : ev.text}
                  </text>
                  {isSel && (
                    <g style={{ cursor: 'ns-resize' }} onPointerDown={(e) => onResizeDown(e, ev)}>
                      <circle cx={end.x} cy={end.y} r="16" fill="transparent" />
                      <circle cx={end.x} cy={end.y} r="8" fill="var(--paper)" stroke={stroke} strokeWidth="2.5">
                        <title>drag to stretch / shorten</title>
                      </circle>
                    </g>
                  )}
                </g>
              );
            }))}

            {drag && (() => {
              const dIdx = dayModels.findIndex(m => m.dayKey === drag.dayKey);
              if (dIdx < 0) return null;
              const T0 = dIdx + drag.startMin / 1440;
              const T1 = dIdx + (drag.startMin + drag.duration) / 1440;
              const mid = project((T0 + T1) / 2);
              return (
                <g pointerEvents="none">
                  <path d={arcPath(T0, Math.min(Math.max(T1, T0 + 0.012), maxT))} fill="none" stroke="var(--orange)" strokeWidth={bandWidth * 0.95} strokeLinecap="round" opacity="0.9" />
                  <text x={mid.x} y={mid.y} fontSize="9.5" fill="var(--ink)" textAnchor="middle" dy="3" className="tm-mono">{fmtClock(drag.startMin)}</text>
                </g>
              );
            })()}

            {pending && pendingIdx >= 0 && (() => {
              const p = project(pendingIdx + pending.startMin / 1440);
              return <circle cx={p.x} cy={p.y} r="6" fill="none" stroke="var(--orange)" strokeWidth="2" strokeDasharray="3 2" />;
            })()}

            {dayModels.map(dm => {
              if (dm.d > maxT) return null;
              const p = project(dm.d + 0.5 / 24);
              return <text key={`l-${dm.dayKey}`} x={p.x} y={p.y} fontSize="9" fill="var(--ink-mute)" textAnchor="middle" dy="3" className="tm-mono" style={{ pointerEvents: 'none' }}>{dayLabel(dm.d)}</text>;
            })}

            {nowT >= 0 && nowT <= maxT && (() => {
              const p = project(nowT);
              return (<g pointerEvents="none">
                <circle cx={p.x} cy={p.y} r="5" fill="var(--orange)" />
                <text x={CX} y={CY} fontSize="11" fill="var(--ink-mute)" textAnchor="middle" className="tm-mono">now</text>
              </g>);
            })()}
          </svg>

          <div className="tm-mono tm-sm tm-spiral-hint">
            each loop is a day. click the spiral to place · drag a block to move · scroll or pinch to zoom.
          </div>
        </div>

        <div>
          <Section label="placed">
            {scheduledTodos.length === 0 && <Empty>nothing on the spiral yet — add a time, or place from below</Empty>}
            {scheduledTodos.map(t => (
              <TodoRow key={t.id} t={t} scheduled
                selected={selectedId === t.id}
                editing={editingId === t.id} editText={editText} setEditText={setEditText}
                colorForTask={() => {
                  const tags = (t.tags || []).map(x => String(x).toLowerCase());
                  const ty = scheduleTypes.find(x => x.id === t.metadata?.scheduleTypeId || tags.includes(String(x.tag || '').toLowerCase()));
                  return ty ? ty.color : null;
                }}
                onSelect={() => { setSelectedId(selectedId === t.id ? null : t.id); setSelectedLaterId(null); }}
                onRename={() => startRename(t)} onSaveRename={() => saveRename(t.id)}
                onToggle={() => api.tasks.toggleComplete(t.id)}
                onShorter={() => bump(t, -15)} onLonger={() => bump(t, 15)}
                onPush={() => push(t)} onKick={() => kick(t)} onFocus={() => focusOn(t)}
                onUnschedule={() => unschedule(t)} onCancel={() => api.tasks.remove(t.id)} />
            ))}
          </Section>

          <Section label="unplaced">
            {laterTodos.length === 0 && <Empty>none — add one above</Empty>}
            {laterTodos.map(t => (
              <TodoRow key={t.id} t={t}
                selected={selectedLaterId === t.id}
                editing={editingId === t.id} editText={editText} setEditText={setEditText}
                onSelect={() => { setSelectedLaterId(selectedLaterId === t.id ? null : t.id); setSelectedId(null); }}
                onRename={() => startRename(t)} onSaveRename={() => saveRename(t.id)}
                onToggle={() => api.tasks.toggleComplete(t.id)}
                onShorter={() => bump(t, -15)} onLonger={() => bump(t, 15)}
                onSchedule={() => scheduleLater(t)} onCancel={() => api.tasks.remove(t.id)}
                placeMenu={(
                  <PlaceMenu
                    taskId={t.id}
                    daySlots={slots.filter(s => s.date === dayModels[0]?.dayKey)}
                    dayKey={dayModels[0]?.dayKey}
                    onPlaceInSlot={onPlaceInSlot || ((id, sid) => api.tasks.moveToSlot?.(id, sid))}
                    onPlaceOnDate={onPlaceOnDate || ((id, day) => placeAt(id, day, 9 * 60))}
                  />
                )} />
            ))}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div className="tm-spiral-section">
      <div className="tm-mono tm-md tm-spiral-section-lbl">{label}</div>
      <div className="tm-card tm-flush">{children}</div>
    </div>
  );
}
function Empty({ children }) {
  return <div className="tm-mono tm-sm tm-spiral-empty">{children}</div>;
}

function TodoRow({
  t, scheduled, selected, editing, editText, setEditText, colorForTask,
  onSelect, onRename, onSaveRename, onToggle, onShorter, onLonger,
  onPush, onKick, onFocus, onUnschedule, onSchedule, onCancel, placeMenu,
}) {
  const done = t.status === 'completed';
  const time = t.scheduledTime ? new Date(t.scheduledTime) : null;
  const timeLabel = time
    ? `${time.toLocaleDateString('en', { weekday: 'short' })} ${((time.getHours() % 12) || 12)}${time.getMinutes() ? ':' + String(time.getMinutes()).padStart(2, '0') : ''}${time.getHours() < 12 ? 'a' : 'p'}`
    : '';
  const dotColor = colorForTask ? colorForTask() : null;
  return (
    <div className={`tm-spiral-row${selected ? ' tm-selected' : ''}`}>
      <div className="tm-spiral-row-main">
        <button onClick={onToggle} title="complete" className={`tm-spiral-toggle${done ? ' tm-done' : ''}`}>{done ? '●' : '○'}</button>
        {dotColor && <span aria-hidden className="tm-spiral-dot" style={{ background: dotColor }} />}
        {editing ? (
          <input autoFocus value={editText} onChange={(e) => setEditText(e.target.value)} onBlur={onSaveRename}
            onKeyDown={(e) => { if (e.key === 'Enter') onSaveRename(); }}
            className="tm-spiral-edit" />
        ) : (
          <span onClick={onSelect} className={`tm-spiral-text${done ? ' tm-done' : ''}`}>{t.text}</span>
        )}
        {timeLabel && <span className="tm-mono tm-sm">{timeLabel}</span>}
        <span className="tm-mono tm-sm tm-spiral-dur">{t.duration || 30}m</span>
        {placeMenu}
      </div>
      {selected && (
        <div className="tm-spiral-actions">
          <Mini onClick={onShorter} title="15 min shorter">−15m</Mini>
          <Mini onClick={onLonger} title="15 min longer">+15m</Mini>
          {scheduled ? (
            <>
              <Mini onClick={onPush} title="nudge an hour later">+1h</Mini>
              <Mini onClick={onKick} title="bump to tomorrow">+1 day</Mini>
              {onFocus && <Mini onClick={onFocus} title="zoom the spiral into this day">focus</Mini>}
              <Mini onClick={onUnschedule} title="lift off the spiral (back to unplaced)">unplace</Mini>
            </>
          ) : (
            <Mini onClick={onSchedule} title="drop onto the spiral at the next open time" primary>place</Mini>
          )}
          <Mini onClick={onRename} title="rename">rename</Mini>
          <Mini onClick={onCancel} title="cancel" danger>cancel</Mini>
        </div>
      )}
    </div>
  );
}
function Mini({ children, onClick, title, danger, primary }) {
  return (
    <button onClick={onClick} title={title}
      className={`tm-mono tm-mini${primary ? ' tm-mini-primary' : ''}${danger ? ' tm-mini-danger' : ''}`}>
      {children}
    </button>
  );
}
