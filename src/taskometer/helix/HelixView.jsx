import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { resolveTypeColor } from '../Composers.jsx';
import { splitSegments } from './geometry.js';
import { makePose, buildHourMap, staggered } from './pose.js';
import { DAY_MIN, MIN_LEN_MIN, clamp, snapMin, slotSpan, minToHHMM, fmtMinutes, fmtHr } from './slotMath.js';
import './helix.css';

const CX = 320;
const CY = 320;
const R_OUTER = 295;
const R_INNER = 110;
const R_LABEL = (R_OUTER + R_INNER) / 2;
const VB_X = -20;
const VB_W = 680;
const MAX_W_RING = 720;
const MAX_W_COLUMN = 560;

/**
 * One SVG for the whole family. `t` unrolls the 24-hour wheel into a
 * helix with one turn per day; `u` straightens the helix into a column
 * where each block is a row. Every element is placed through the same
 * pose, so the schedule never leaves the screen while the lens changes.
 * Day 0 (the day in view) keeps every editing affordance; later turns
 * are read-mostly — click to open the day, drop a task onto a block.
 */
export default function HelixView({
  wedges,
  slots,
  taskTypes,
  nowHour,
  tasksBySlotId,
  onWedgeCommit,
  onWedgeClick,
  onEmptyHourClick,
  onNudgeEdge,
  editingSlotId,
  selectedSlotId,
  onTaskMoveTo,
  center,
  t = 0,
  u = 0,
  days = 1,
  layers = [],
  onPickDate,
}) {
  const svgRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  useEffect(() => { dragRef.current = drag; }, [drag]);
  const [hoverHandle, setHoverHandle] = useState(null);
  const [dropHoverSlotId, setDropHoverSlotId] = useState(null);

  // The column's hour map comes from the committed blocks, so a drag
  // moves inside a fixed ruler instead of re-flowing the page under it.
  const hourMap = useMemo(() => buildHourMap(slots.map(s => {
    const { sMin, eMin } = slotSpan(s);
    return { startH: sMin / 60, endH: eMin / 60 };
  })), [slots]);

  const pose = makePose({ t, u, cx: CX, cy: CY, rOuter: R_OUTER, rInner: R_INNER, days: t > 0 || u > 0 ? days : 1, hourMap, vbX: VB_X, vbW: VB_W });
  const { viewBox, column } = pose;
  const P = (hour, r, dayIndex = 0, uu) => pose.point(hour, r, dayIndex, uu);
  const squash = 1 - 0.62 * t;
  const now = Math.max(0, Math.min(24, nowHour));
  const [hubX, hubY] = pose.hub(0, nowHour >= 0 ? now : 12);
  const inColumn = u > 0.5;
  const unrolled = t > 0 || u > 0;
  const dense = t > 0.5 && u < 0.5;
  const ringAlpha = 1 - Math.min(1, u * 1.6);          // ring-style text fades early
  const colAlpha = Math.max(0, (u - 0.55) / 0.45);      // column-style text fades in late
  const maxWidth = MAX_W_RING + (MAX_W_COLUMN - MAX_W_RING) * u;

  const wedgeById = (id) => wedges.find(w => w.id === id);

  const fillFor = (slot, wedge) => {
    const typeColor = slot.color || resolveTypeColor(taskTypes, slot.slotType);
    const isSelected = selectedSlotId && slot.id === selectedSlotId;
    if (typeColor) return `color-mix(in oklab, ${typeColor} var(${isSelected ? '--wedge-mix-selected' : '--wedge-mix'}), var(--paper))`;
    if (wedge?.current) return 'var(--orange-pale)';
    if (wedge?.kind === 'hot') return 'var(--orange-pale)';
    if (wedge?.kind === 'light') return 'var(--sage-pale)';
    if (wedge?.kind === 'rest') return 'var(--wedge-rest)';
    if (wedge?.kind === 'soft') return 'var(--wedge-soft)';
    return 'var(--paper)';
  };

  const strokeFor = (slot, wedge, isCurrent, isEditing) => {
    if (isEditing) return 'var(--orange)';
    const isSelected = selectedSlotId && slot.id === selectedSlotId;
    if (isSelected) return 'var(--ink)';
    const typeColor = slot.color || resolveTypeColor(taskTypes, slot.slotType);
    if (typeColor && !isCurrent) return `color-mix(in oklab, ${typeColor} var(--wedge-edge-mix), var(--ink))`;
    return isCurrent ? 'var(--ink)' : 'var(--rule)';
  };

  // Pointer → viewBox units, honouring preserveAspectRatio centring.
  const pointerToHour = (ev) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const scale = Math.min(rect.width / viewBox.w, rect.height / viewBox.h);
    const ox = (rect.width - viewBox.w * scale) / 2;
    const oy = (rect.height - viewBox.h * scale) / 2;
    const x = viewBox.x + (ev.clientX - rect.left - ox) / scale;
    const y = viewBox.y + (ev.clientY - rect.top - oy) / scale;
    const hit = pose.unproject(x, y, R_LABEL);
    return { hour: hit.hour, dist: hit.dist };
  };

  const nearestMin = (rawMin, near) => {
    const candidates = [rawMin, rawMin + DAY_MIN, rawMin - DAY_MIN, rawMin + 2 * DAY_MIN];
    let best = rawMin;
    let bestDist = Infinity;
    for (const c of candidates) {
      const d = Math.abs(c - near);
      if (d < bestDist) { bestDist = d; best = c; }
    }
    return best;
  };

  const commitDrag = useCallback(async (d) => {
    if (!d) return;
    await onWedgeCommit(d.id, {
      startMin: ((d.startMin % DAY_MIN) + DAY_MIN) % DAY_MIN,
      endMinUnwrapped: d.endMin,
    });
  }, [onWedgeCommit]);

  useEffect(() => {
    if (!drag) return undefined;
    const move = (ev) => {
      const info = pointerToHour(ev);
      if (!info) return;
      const rawMin = snapMin(Math.round(info.hour * 60));
      setDrag(prev => {
        if (!prev) return prev;
        if (prev.mode === 'start') {
          const snapped = nearestMin(rawMin, prev.origStartMin);
          return { ...prev, startMin: clamp(snapped, prev.endMin - DAY_MIN + MIN_LEN_MIN, prev.endMin - MIN_LEN_MIN) };
        }
        if (prev.mode === 'end') {
          const snapped = nearestMin(rawMin, prev.origEndMin);
          return { ...prev, endMin: clamp(snapped, prev.startMin + MIN_LEN_MIN, prev.startMin + DAY_MIN) };
        }
        const snapped = nearestMin(rawMin, prev.originMin);
        const delta = snapped - prev.originMin;
        const length = prev.origEndMin - prev.origStartMin;
        return { ...prev, startMin: prev.origStartMin + delta, endMin: prev.origStartMin + delta + length };
      });
    };
    const up = () => {
      const current = dragRef.current;
      setDrag(null);
      if (current) commitDrag(current);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [drag?.id, drag?.mode, t, u]);

  const capture = (ev) => { try { ev.currentTarget.setPointerCapture?.(ev.pointerId); } catch (_) { /* unsupported */ } };

  const onWedgePointerDown = (ev, slot) => {
    if (ev.button !== 0) return;
    ev.stopPropagation();
    ev.preventDefault();
    capture(ev);
    const info = pointerToHour(ev);
    if (!info) return;
    const { sMin, eMin } = slotSpan(slot);
    const origin = snapMin(Math.round(info.hour * 60));
    setDrag({ id: slot.id, mode: 'move', originMin: nearestMin(origin, (sMin + eMin) / 2), startMin: sMin, endMin: eMin, origStartMin: sMin, origEndMin: eMin });
  };

  const onHandlePointerDown = (ev, slot, which) => {
    ev.stopPropagation();
    ev.preventDefault();
    capture(ev);
    const info = pointerToHour(ev);
    if (!info) return;
    const { sMin, eMin } = slotSpan(slot);
    const raw = snapMin(Math.round(info.hour * 60));
    setDrag({ id: slot.id, mode: which, originMin: nearestMin(raw, which === 'start' ? sMin : eMin), startMin: sMin, endMin: eMin, origStartMin: sMin, origEndMin: eMin });
  };

  const onRingPointerDown = (ev) => {
    const info = pointerToHour(ev);
    if (!info) return;
    if (info.dist < R_INNER || info.dist > R_OUTER) return;
    onEmptyHourClick(info.hour);
  };

  const dropProps = (slotId) => ({
    onDragOver: (ev) => {
      if (!ev.dataTransfer.types.includes('text/task-id')) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
      if (dropHoverSlotId !== slotId) setDropHoverSlotId(slotId);
    },
    onDragLeave: () => { if (dropHoverSlotId === slotId) setDropHoverSlotId(null); },
    onDrop: (ev) => {
      const taskId = ev.dataTransfer.getData('text/task-id');
      setDropHoverSlotId(null);
      if (taskId && onTaskMoveTo) {
        ev.preventDefault();
        onTaskMoveTo(taskId, slotId);
      }
    },
  });

  const renderGeom = slots.map((slot, index) => {
    const isDraggingThis = drag && drag.id === slot.id;
    const { sMin: baseS, eMin: baseE } = slotSpan(slot);
    const startMin = isDraggingThis ? drag.startMin : baseS;
    const endMin = isDraggingThis ? drag.endMin : baseE;
    const wedge = wedgeById(slot.id);
    return {
      slot, wedge, startMin, endMin, startH: startMin / 60, endH: endMin / 60,
      isCurrent: wedge?.current && !isDraggingThis, isEditing: editingSlotId === slot.id, isDragging: isDraggingThis,
      ui: staggered(u, index, slots.length),
    };
  });

  const nowVisible = nowHour >= 0;
  const [nxEnd, nyEnd] = P(now, R_OUTER - 4);
  // Other turns dim with distance and leave entirely as the helix drops into the column.
  const fadeFor = (dayIndex) => (1 - 0.55 * (dayIndex / Math.max(1, days - 1))) * Math.max(0, 1 - u * 1.4);
  const handleCursor = inColumn ? 'ns-resize' : 'ew-resize';

  return (
    <svg
      ref={svgRef}
      className={`tm-helix${unrolled ? ' tm-helix-unrolled' : ''}${inColumn ? ' tm-helix-column' : ''}`}
      width="100%"
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
      style={{ maxWidth, aspectRatio: `${viewBox.w} / ${viewBox.h}`, touchAction: 'none', userSelect: 'none' }}
    >
      {/* Later turns first so today draws over them (today is nearest). */}
      {unrolled && u < 0.7 && layers.slice().reverse().map(layer => {
        const d = layer.dayIndex;
        const [lx0, ly0] = pose.blend(P(12, R_OUTER + 22, d, 0), [column.left, pose.colY(0, d) - 10]);
        return (
          <g key={layer.dateKey} className="tm-helix-turn" opacity={fadeFor(d)}>
            <path
              d={pose.band(0, 24, R_OUTER, R_INNER, d)}
              fill="var(--paper)"
              stroke="var(--rule)"
              strokeWidth={1}
              onClick={() => onPickDate?.(layer.date)}
              style={{ cursor: 'pointer' }}
            >
              <title>{`open ${layer.label}`}</title>
            </path>
            {layer.slots.map(({ slot, startH, endH, count, done }) => {
              const fill = fillFor(slot, null);
              const stroke = strokeFor(slot, null, false, false);
              const midH = ((startH + endH) / 2) % 24;
              const [lx, ly] = pose.blend(P(midH, R_LABEL, d, 0), [column.left + 12, pose.colY(Math.max(0, startH), d) + 18]);
              const span = endH - startH;
              const isHovered = dropHoverSlotId === slot.id;
              return (
                <g key={slot.id}>
                  {splitSegments(startH, endH).map((seg, i) => {
                    const path = pose.band(seg[0], seg[1], R_OUTER, R_INNER, d);
                    if (!path) return null;
                    return (
                      <path
                        key={`${slot.id}-${i}`}
                        d={path}
                        fill={fill}
                        stroke={isHovered ? 'var(--orange)' : stroke}
                        strokeWidth={isHovered ? 3 : 1.2}
                        onClick={(ev) => { ev.stopPropagation(); onPickDate?.(layer.date); }}
                        {...dropProps(slot.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <title>{`${slot.label || slot.slotType || 'block'} · ${layer.label}${count ? ` · ${count} task${count === 1 ? '' : 's'}` : ''}`}</title>
                      </path>
                    );
                  })}
                  {(span >= 2 || inColumn) && (d <= 2 || inColumn) && (
                    <text x={lx} y={ly + 4} className="tm-helix-turn-label" fill="var(--ink)" textAnchor={inColumn ? 'start' : 'middle'} paintOrder="stroke" stroke={fill} strokeWidth={3} strokeLinejoin="round" style={{ pointerEvents: 'none' }}>
                      {(slot.label || slot.slotType || 'block').slice(0, 14)}
                    </text>
                  )}
                  {count > 0 && Array.from({ length: Math.min(count, 4) }, (_, i) => {
                    const n = Math.min(count, 4);
                    const [dx, dy] = P(midH + (i - (n - 1) / 2) * 0.3, R_INNER + 12, d);
                    return <circle key={i} cx={dx} cy={dy} r={3.2} fill={i < done ? 'var(--ink-mute)' : (slot.color || 'var(--ink)')} stroke="var(--paper)" strokeWidth={1} style={{ pointerEvents: 'none' }} />;
                  })}
                </g>
              );
            })}
            <text x={lx0} y={ly0} className="tm-helix-day-label" fill="var(--ink-soft)" textAnchor={inColumn ? 'start' : 'middle'} style={{ pointerEvents: 'none' }}>
              {layer.label}
            </text>
          </g>
        );
      })}

      {/* Day 0: the ring background takes clicks on empty hours. */}
      {unrolled ? (
        <path d={pose.band(0, 24, R_OUTER, R_INNER)} fill="var(--paper)" stroke="none" onPointerDown={onRingPointerDown} style={{ cursor: 'crosshair' }} />
      ) : (
        <circle cx={CX} cy={CY} r={R_OUTER} fill="var(--paper)" stroke="none" onPointerDown={onRingPointerDown} style={{ cursor: 'crosshair' }} />
      )}
      {u < 1 && <ellipse cx={hubX} cy={hubY} rx={R_INNER * (1 - u)} ry={R_INNER * squash * (1 - u)} fill="var(--paper)" stroke="none" />}

      {renderGeom.map(({ slot, wedge, startH, endH, startMin, endMin, isCurrent, isEditing, isDragging, ui }) => {
        const label = slot.label || slot.slotType || 'block';
        const stroke = strokeFor(slot, wedge, isCurrent, isEditing);
        const isSelected = selectedSlotId && slot.id === selectedSlotId;
        const strokeW = isEditing || isDragging ? 3 : isSelected ? 3.2 : isCurrent ? 2.6 : 1.6;
        const fill = fillFor(slot, wedge);
        const midH = (startH + endH) / 2;
        const midNorm = ((midH % 24) + 24) % 24;
        const [lx, ly] = P(midNorm, R_LABEL, 0, ui);

        const sNorm = ((startMin % DAY_MIN) + DAY_MIN) % DAY_MIN / 60;
        const eNorm = ((endMin % DAY_MIN) + DAY_MIN) % DAY_MIN / 60;
        const [sxH, syH] = P(sNorm, R_LABEL, 0, ui);
        const [exH, eyH] = P(eNorm === 0 && endMin !== 0 ? 24 : eNorm, R_LABEL, 0, ui);
        const isOvernight = endMin > DAY_MIN;
        const isHovered = dropHoverSlotId === slot.id;

        const slotTasks = tasksBySlotId?.get?.(slot.id) || [];
        const { sMin: slotStartMin, eMin: slotEndMin } = slotSpan(slot);
        const slotDoneMin = slotTasks.filter(e => e.task?.status === 'completed').reduce((acc, e) => acc + ((e.task?.duration) || 30), 0);
        const slotPlannedMin = slotTasks.reduce((acc, e) => acc + ((e.task?.duration) || 30), 0);
        const taskBands = slotTasks.map((entry, idx) => {
          const ts = new Date(entry.start);
          const m = ts.getHours() * 60 + ts.getMinutes();
          const norm = m < slotStartMin ? m + DAY_MIN : m;
          const dur = entry.task?.duration || 30;
          return { key: entry.task?.id || `t${idx}`, startH: norm / 60, endH: Math.min(slotEndMin / 60, (norm + dur) / 60), color: slot.color || 'var(--ink)', isDone: entry.task?.status === 'completed' };
        });
        const bandInner = R_INNER + 2;
        const bandOuter = R_INNER + 16;
        const band = (a, b) => splitSegments(a, b).map(([s, e]) => pose.band(s, e, bandOuter, bandInner, 0, ui)).filter(Boolean).join(' ');

        // Column-pose row: the first visible segment hosts the text.
        const firstSeg = splitSegments(startH, endH)[0];
        const rowTop = pose.colY(firstSeg[0]);
        const rowBottom = pose.colY(Math.min(24, firstSeg[1]));
        const rowH = rowBottom - rowTop;
        const chipRoom = Math.max(0, Math.floor((rowH - 34) / 15));

        return (
          <g key={slot.id}>
            {splitSegments(startH, endH).map((seg, i) => {
              const path = pose.band(seg[0], seg[1], R_OUTER, R_INNER, 0, ui);
              if (!path) return null;
              return (
                <path
                  key={`${slot.id}-seg${i}`}
                  d={path}
                  fill={fill}
                  stroke={isHovered ? 'var(--orange)' : stroke}
                  strokeWidth={isHovered ? 3 : strokeW}
                  strokeLinejoin="round"
                  onPointerDown={(ev) => onWedgePointerDown(ev, slot)}
                  onClick={(ev) => { ev.stopPropagation(); if (!isDragging) onWedgeClick(slot.id); }}
                  {...dropProps(slot.id)}
                  style={{ cursor: drag ? 'grabbing' : 'grab' }}
                />
              );
            })}

            {slotTasks.length > 0 && (
              <path d={band(startH, endH)} fill="rgba(0,0,0,0.06)" stroke="none" style={{ pointerEvents: 'none' }} />
            )}
            {taskBands.map(b => {
              const d = band(b.startH, b.endH);
              if (!d) return null;
              return <path key={`fill-${b.key}`} d={d} fill={b.color} fillOpacity={b.isDone ? 0.55 : 0.95} stroke="var(--ink)" strokeOpacity={b.isDone ? 0.25 : 0.5} strokeWidth={0.6} style={{ pointerEvents: 'none' }} />;
            })}

            {/* Ring-style text: centred on the wedge, fades as it drops. */}
            {ringAlpha > 0 && (
              <g opacity={ringAlpha} style={{ pointerEvents: 'none' }}>
                {slotPlannedMin > 0 && (endH - startH) >= 1.2 && !dense && (() => {
                  const [gx, gy] = P(midNorm, R_INNER + 26, 0, ui);
                  return (
                    <text x={gx} y={gy} className="tm-helix-gauge" fill="var(--ink-mute)" textAnchor="middle">
                      {fmtMinutes(slotDoneMin)} / {fmtMinutes(slotPlannedMin)}{slotPlannedMin > (slotEndMin - slotStartMin) ? ' ⚠' : ''}
                    </text>
                  );
                })()}
                {(!dense || (endH - startH) >= 1.5 || isCurrent || isSelected) && (
                  <text x={lx} y={ly - 2} className={`tm-helix-label${isCurrent || isEditing ? ' tm-helix-label-live' : ''}`} fill="var(--ink)" textAnchor="middle" paintOrder="stroke" stroke={fill} strokeWidth={4} strokeLinejoin="round">
                    {label}{isOvernight ? ' ↷' : ''}
                  </text>
                )}
                <WedgeTaskChips entries={slotTasks} x={lx} startY={ly + 14} anchor="middle" maxChips={dense ? ((endH - startH) >= 2 ? 1 : 0) : (endH - startH) >= 1.5 ? 3 : (endH - startH) >= 0.75 ? 2 : 1} />
                {!slotTasks.length && wedge?.count ? (
                  <text x={lx} y={ly + 14} className="tm-helix-gauge" fill="var(--ink-mute)" textAnchor="middle">
                    {wedge.count} task{wedge.count > 1 ? 's' : ''}
                  </text>
                ) : null}
              </g>
            )}

            {/* Column-style row: label, time span and tasks read left to right. */}
            {colAlpha > 0 && (
              <g opacity={colAlpha} style={{ pointerEvents: 'none' }}>
                <text x={column.left + 12} y={rowTop + 20} className={`tm-helix-row-label${isCurrent || isEditing ? ' tm-helix-label-live' : ''}`} fill="var(--ink)" textAnchor="start">
                  {label}{isOvernight ? ' ↷' : ''}
                </text>
                <text x={column.right - 24} y={rowTop + 19} className="tm-helix-row-time" fill="var(--ink-mute)" textAnchor="end">
                  {fmtHr(sNorm)}–{fmtHr(eNorm === 0 && endMin !== 0 ? 24 : eNorm)}{slotPlannedMin > 0 ? ` · ${fmtMinutes(slotDoneMin)}/${fmtMinutes(slotPlannedMin)}` : ''}
                </text>
                <WedgeTaskChips entries={slotTasks} x={column.left + 12} startY={rowTop + 38} anchor="start" maxChips={chipRoom} />
                {!slotTasks.length && wedge?.count && chipRoom > 0 ? (
                  <text x={column.left + 12} y={rowTop + 38} className="tm-helix-gauge" fill="var(--ink-mute)" textAnchor="start">
                    {wedge.count} task{wedge.count > 1 ? 's' : ''}
                  </text>
                ) : null}
              </g>
            )}

            {(isSelected || isEditing || isDragging) && (
              <>
                <HandleWithNudge cx={sxH} cy={syH} slotId={slot.id} which="start" hover={hoverHandle} setHover={setHoverHandle} onDown={(ev) => onHandlePointerDown(ev, slot, 'start')} onNudge={onNudgeEdge} cursor={handleCursor} />
                <HandleWithNudge cx={exH} cy={eyH} slotId={slot.id} which="end" hover={hoverHandle} setHover={setHoverHandle} onDown={(ev) => onHandlePointerDown(ev, slot, 'end')} onNudge={onNudgeEdge} cursor={handleCursor} />
              </>
            )}
          </g>
        );
      })}

      {unrolled ? (
        <>
          <path d={pose.rail(R_OUTER)} fill="none" stroke="var(--ink)" strokeWidth="2" pointerEvents="none" />
          <path d={pose.rail(R_INNER)} fill="none" stroke="var(--ink)" strokeWidth="2" pointerEvents="none" />
        </>
      ) : (
        <>
          <circle cx={CX} cy={CY} r={R_OUTER} fill="none" stroke="var(--ink)" strokeWidth="2" pointerEvents="none" />
          <circle cx={CX} cy={CY} r={R_INNER} fill="none" stroke="var(--ink)" strokeWidth="2" pointerEvents="none" />
        </>
      )}

      {Array.from({ length: 24 }, (_, h) => {
        const isMajor = h % 6 === 0;
        const isMid = h % 3 === 0;
        const [x1, y1] = P(h, R_OUTER);
        const [x2, y2] = P(h, R_OUTER + (isMajor ? 10 : isMid ? 8 : 6) * (1 - 0.5 * u));
        return <line key={h} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink)" strokeWidth={isMajor ? 1.6 : isMid ? 1.2 : 1} strokeLinecap="round" opacity={isMajor ? 1 : isMid ? 0.85 : 0.7} />;
      })}

      <g pointerEvents="none">
        {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => {
          const [x, y] = pose.blend(P(h, R_OUTER + 22, 0, 0), [column.left - 14, pose.colY(h) + 4]);
          const isMajor = h % 6 === 0;
          return (
            <text key={h} x={x} y={y} textAnchor={inColumn ? 'end' : 'middle'} dominantBaseline={inColumn ? 'auto' : 'middle'} className={`tm-helix-hour${isMajor ? ' tm-helix-hour-major' : ''}`} fill={isMajor ? 'var(--ink-soft)' : 'var(--ink-mute)'} opacity={isMajor ? 1 : 0.8}>
              {`${(h % 12) || 12}${h < 12 ? 'a' : 'p'}`}
            </text>
          );
        })}
        {/* In the column every day gets a top rule and the stacked days a label. */}
        {inColumn && (
          <text x={column.left - 14} y={pose.colY(24) + 4} textAnchor="end" className="tm-helix-hour tm-helix-hour-major" fill="var(--ink-soft)">12a</text>
        )}
      </g>

      {nowVisible && (
        <>
          <line x1={hubX} y1={hubY} x2={nxEnd} y2={nyEnd} stroke="var(--orange)" strokeWidth="2" opacity={0.5 + 0.4 * u} pointerEvents="none" />
          <circle cx={nxEnd} cy={nyEnd} r="5" fill="var(--orange)" pointerEvents="none" />
        </>
      )}

      {/* The hub is the Do surface; it rides along with today's turn and
          becomes the now-line's caption once the day is a column. */}
      {center && !drag && ringAlpha > 0 && (
        <g pointerEvents="none" opacity={ringAlpha} transform={`translate(${hubX - CX} ${hubY - CY})`}>
          {center.color && <ellipse cx={CX} cy={CY} rx={R_INNER - 6} ry={(R_INNER - 6) * squash} fill="none" stroke={center.color} strokeWidth="2" opacity="0.6" />}
          {center.kicker && (
            <text x={CX} y={CY - 30} className="tm-helix-kicker" fill="var(--ink-mute)" textAnchor="middle">{center.kicker.toUpperCase()}</text>
          )}
          <text x={CX} y={CY - 6} className={`tm-helix-title${center.title.length > 12 ? ' tm-helix-title-long' : ''}`} fill="var(--ink)" textAnchor="middle">{center.title.slice(0, 18)}</text>
          {center.sub && <text x={CX} y={CY + 12} className="tm-helix-sub" fill="var(--ink-mute)" textAnchor="middle">{center.sub}</text>}
          {center.task && !dense && (
            <text x={CX} y={CY + 32} className="tm-helix-task" fill="var(--ink-soft)" textAnchor="middle">▸ {center.task.slice(0, 24)}{center.task.length > 24 ? '…' : ''}</text>
          )}
          {center.next && !dense && <text x={CX} y={CY + (center.task ? 50 : 32)} className="tm-helix-kicker" fill="var(--ink-mute)" textAnchor="middle">{center.next}</text>}
        </g>
      )}
      {center && !drag && colAlpha > 0 && nowVisible && (
        <g pointerEvents="none" opacity={colAlpha}>
          <text x={column.right - 4} y={hubY - 7} className="tm-helix-kicker" fill="var(--orange)" textAnchor="end">NOW · {center.title.slice(0, 18).toUpperCase()}</text>
          {center.sub && <text x={column.right - 4} y={hubY + 13} className="tm-helix-sub" fill="var(--ink-mute)" textAnchor="end">{center.sub}</text>}
        </g>
      )}

      {drag && (() => {
        const s = ((drag.startMin % DAY_MIN) + DAY_MIN) % DAY_MIN;
        const e = ((drag.endMin % DAY_MIN) + DAY_MIN) % DAY_MIN;
        const [bx, by] = inColumn ? [column.left + (column.right - column.left) / 2, pose.colY(s / 60) - 14] : [hubX, hubY + 48];
        return (
          <g pointerEvents="none">
            <rect x={bx - 72} y={by - 10} width={144} height={20} rx={6} fill="var(--paper)" stroke="var(--orange)" strokeWidth="1" />
            <text x={bx} y={by + 4} className="tm-helix-sub" fill="var(--orange)" textAnchor="middle">
              {minToHHMM(s)}–{minToHHMM(e)}{drag.endMin > DAY_MIN ? ' +1d' : ''}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}

/** Flat ↔ helix slider and the days stepper. */
export function HelixControls({ t, onT, days, onDays, min = 1, max = 7, showSlider = true, daysLabel = 'day' }) {
  return (
    <div className="tm-helix-ctl" role="group" aria-label="helix">
      {showSlider && (
        <>
          <span className="tm-mono tm-sm">◎</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={t}
            aria-label="unroll the wheel into a helix"
            onChange={(e) => onT(parseFloat(e.target.value))}
          />
          <span className="tm-mono tm-sm">֎</span>
        </>
      )}
      <span className="tm-helix-days">
        <button type="button" className="tm-btn tm-sm" onClick={() => onDays(Math.max(min, days - 1))} disabled={days <= min} aria-label="fewer days">−</button>
        <span className="tm-mono tm-sm">{days} {daysLabel}{days === 1 ? '' : 's'}</span>
        <button type="button" className="tm-btn tm-sm" onClick={() => onDays(Math.min(max, days + 1))} disabled={days >= max} aria-label="more days">+</button>
      </span>
    </div>
  );
}

function WedgeTaskChips({ entries = [], x, startY, anchor = 'middle', maxChips = 3 }) {
  if (entries.length === 0 || maxChips <= 0) return null;
  const visible = entries.slice(0, maxChips);
  const overflow = entries.length - visible.length;
  const limit = anchor === 'start' ? 34 : 18;
  return (
    <g style={{ pointerEvents: 'none' }}>
      {visible.map((entry, i) => {
        const task = entry.task || entry;
        const done = task.status === 'completed';
        return (
          <text key={task.id || task.key || i} x={x} y={startY + i * (anchor === 'start' ? 15 : 13)} className="tm-helix-chip" fill={done ? 'var(--ink-mute)' : 'var(--ink-soft)'} textAnchor={anchor} style={{ textDecoration: done ? 'line-through' : 'none' }}>
            {anchor === 'start' ? (done ? '✓ ' : '○ ') : ''}{(task.text || task.title || 'task').slice(0, limit)}
          </text>
        );
      })}
      {overflow > 0 && (
        <text x={x} y={startY + visible.length * (anchor === 'start' ? 15 : 13)} className="tm-helix-gauge" fill="var(--orange)" textAnchor={anchor}>+{overflow} more</text>
      )}
    </g>
  );
}

function HandleWithNudge({ cx, cy, slotId, which, hover, setHover, onDown, onNudge, cursor = 'ew-resize' }) {
  const isHover = hover && hover.slotId === slotId && hover.which === which;
  const enter = () => setHover({ slotId, which });
  const leave = () => setHover(null);
  return (
    <g onPointerEnter={enter} onPointerLeave={leave}>
      <circle cx={cx} cy={cy - (isHover ? 10 : 0)} r={36} fill="transparent" onPointerEnter={enter} style={{ cursor }} />
      <circle cx={cx} cy={cy} r={isHover ? 8 : 6} fill={isHover ? 'var(--orange-pale)' : 'var(--paper)'} stroke="var(--ink)" strokeWidth="1.4" style={{ cursor }} onPointerDown={onDown} onPointerEnter={enter} />
      {isHover && (
        <g onPointerEnter={enter}>
          <NudgeChip cx={cx - 20} cy={cy - 20} label="−15" onClick={(ev) => { ev.stopPropagation(); onNudge(slotId, which, -15); }} />
          <NudgeChip cx={cx + 20} cy={cy - 20} label="+15" onClick={(ev) => { ev.stopPropagation(); onNudge(slotId, which, +15); }} />
        </g>
      )}
    </g>
  );
}

function NudgeChip({ cx, cy, label, onClick }) {
  return (
    <g style={{ cursor: 'pointer' }} onClick={onClick} onPointerDown={(ev) => ev.stopPropagation()}>
      <rect x={cx - 14} y={cy - 9} width={28} height={18} rx={9} fill="var(--paper)" stroke="var(--orange)" strokeWidth="1.2" />
      <text x={cx} y={cy + 4} className="tm-helix-gauge" fill="var(--orange)" textAnchor="middle">{label}</text>
    </g>
  );
}
