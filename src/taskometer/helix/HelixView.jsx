import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveTypeColor } from '../Composers.jsx';
import { HELIX, project, unproject, ringPath, turnPath, splitSegments, hubCenter, helixExtent } from './geometry.js';
import { DAY_MIN, MIN_LEN_MIN, clamp, snapMin, slotSpan, minToHHMM, fmtMinutes } from './slotMath.js';
import './helix.css';

const CX = 320;
const CY = 320;
const R_OUTER = 295;
const R_INNER = 110;
const R_LABEL = (R_OUTER + R_INNER) / 2;
const VB_X = -20;
const VB_W = 680;

/**
 * One SVG for the whole family: at t=0 it is today's 24-hour wheel, at
 * t=1 the same ring unrolled into a helix with one turn per day. Day 0
 * (the day in view) keeps every editing affordance; later turns are
 * read-mostly — click to open the day, drop a task onto a block.
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
  days = 1,
  layers = [],
  onPickDate,
}) {
  const svgRef = useRef(null);
  const geom = { cx: CX, cy: CY, t, pitch: HELIX.pitch, tilt: HELIX.tilt };
  const P = (hour, r, dayIndex = 0) => project({ ...geom, hour, r, dayIndex });
  const ring = (startH, endH, rOuter, rInner, dayIndex = 0) => ringPath({ ...geom, startH, endH, rOuter, rInner, dayIndex });
  const [hubX, hubY] = hubCenter(geom);
  const hubDy = hubY - CY;
  const squash = 1 - HELIX.tilt * t;
  const { minY, maxY } = helixExtent({ cy: CY, rOuter: R_OUTER, days: t > 0 ? days : 1, t });
  const vbH = maxY - minY;

  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  useEffect(() => { dragRef.current = drag; }, [drag]);
  const [hoverHandle, setHoverHandle] = useState(null);
  const [dropHoverSlotId, setDropHoverSlotId] = useState(null);

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
    const scale = Math.min(rect.width / VB_W, rect.height / vbH);
    const ox = (rect.width - VB_W * scale) / 2;
    const oy = (rect.height - vbH * scale) / 2;
    const x = VB_X + (ev.clientX - rect.left - ox) / scale;
    const y = minY + (ev.clientY - rect.top - oy) / scale;
    const hit = unproject({ ...geom, x, y, days: 1, rMid: R_LABEL });
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
  }, [drag?.id, drag?.mode, t]);

  const onWedgePointerDown = (ev, slot) => {
    if (ev.button !== 0) return;
    ev.stopPropagation();
    ev.preventDefault();
    try { ev.currentTarget.setPointerCapture?.(ev.pointerId); } catch (_) { /* capture unsupported */ }
    const info = pointerToHour(ev);
    if (!info) return;
    const { sMin, eMin } = slotSpan(slot);
    const origin = snapMin(Math.round(info.hour * 60));
    setDrag({ id: slot.id, mode: 'move', originMin: nearestMin(origin, (sMin + eMin) / 2), startMin: sMin, endMin: eMin, origStartMin: sMin, origEndMin: eMin });
  };

  const onHandlePointerDown = (ev, slot, which) => {
    ev.stopPropagation();
    ev.preventDefault();
    try { ev.currentTarget.setPointerCapture?.(ev.pointerId); } catch (_) { /* capture unsupported */ }
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

  const renderGeom = slots.map(slot => {
    const isDraggingThis = drag && drag.id === slot.id;
    const { sMin: baseS, eMin: baseE } = slotSpan(slot);
    const startMin = isDraggingThis ? drag.startMin : baseS;
    const endMin = isDraggingThis ? drag.endMin : baseE;
    const wedge = wedgeById(slot.id);
    return { slot, wedge, startMin, endMin, startH: startMin / 60, endH: endMin / 60, isCurrent: wedge?.current && !isDraggingThis, isEditing: editingSlotId === slot.id, isDragging: isDraggingThis };
  });

  const [nxEnd, nyEnd] = P(nowHour, R_OUTER - 4);

  const renderWedgeShape = (startH, endH, fill, stroke, strokeW, slotId, onDown, onClick) => (
    splitSegments(startH, endH).map((seg, i) => {
      const path = ring(seg[0], seg[1], R_OUTER, R_INNER);
      if (!path) return null;
      const isHovered = dropHoverSlotId === slotId;
      return (
        <path
          key={`${slotId}-seg${i}`}
          d={path}
          fill={fill}
          stroke={isHovered ? 'var(--orange)' : stroke}
          strokeWidth={isHovered ? 3 : strokeW}
          onPointerDown={onDown}
          onClick={onClick}
          {...dropProps(slotId)}
          style={{ cursor: drag ? 'grabbing' : 'grab' }}
        />
      );
    })
  );

  const unrolled = t > 0;
  // Past half-way the squashed sides can't hold every label; keep the big ones.
  const dense = t > 0.5;
  const fadeFor = (dayIndex) => 1 - 0.55 * (dayIndex / Math.max(1, days - 1));

  return (
    <svg
      ref={svgRef}
      className={`tm-helix${unrolled ? ' tm-helix-unrolled' : ''}`}
      width="100%"
      viewBox={`${VB_X} ${minY} ${VB_W} ${vbH}`}
      style={{ maxWidth: 720, aspectRatio: `${VB_W} / ${vbH}`, touchAction: 'none', userSelect: 'none' }}
    >
      {/* Later turns first so today draws over them (today is nearest). */}
      {unrolled && layers.slice().reverse().map(layer => {
        const d = layer.dayIndex;
        // Bottom of the turn (noon) stays visible under the turns above it.
        const [lx0, ly0] = P(12, R_OUTER + 22, d);
        return (
          <g key={layer.dateKey} className="tm-helix-turn" opacity={fadeFor(d)}>
            <path
              d={ring(0, 24, R_OUTER, R_INNER, d)}
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
              const [lx, ly] = P(midH, R_LABEL, d);
              const span = endH - startH;
              const isHovered = dropHoverSlotId === slot.id;
              return (
                <g key={slot.id}>
                  {splitSegments(startH, endH).map((seg, i) => {
                    const path = ring(seg[0], seg[1], R_OUTER, R_INNER, d);
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
                  {span >= 2 && d <= 2 && (
                    <text x={lx} y={ly + 4} className="tm-helix-turn-label" fill="var(--ink)" textAnchor="middle" paintOrder="stroke" stroke={fill} strokeWidth={3} strokeLinejoin="round" style={{ pointerEvents: 'none' }}>
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
            <text x={lx0} y={ly0} className="tm-helix-day-label" fill="var(--ink-soft)" textAnchor="middle" style={{ pointerEvents: 'none' }}>
              {layer.label}
            </text>
          </g>
        );
      })}

      {/* Day 0: the ring background takes clicks on empty hours. */}
      {unrolled ? (
        <path d={ring(0, 24, R_OUTER, R_INNER)} fill="var(--paper)" stroke="none" onPointerDown={onRingPointerDown} style={{ cursor: 'crosshair' }} />
      ) : (
        <circle cx={CX} cy={CY} r={R_OUTER} fill="var(--paper)" stroke="none" onPointerDown={onRingPointerDown} style={{ cursor: 'crosshair' }} />
      )}
      <ellipse cx={hubX} cy={hubY} rx={R_INNER} ry={R_INNER * squash} fill="var(--paper)" stroke="none" />

      {renderGeom.map(({ slot, wedge, startH, endH, startMin, endMin, isCurrent, isEditing, isDragging }) => {
        const label = slot.label || slot.slotType || 'block';
        const stroke = strokeFor(slot, wedge, isCurrent, isEditing);
        const isSelected = selectedSlotId && slot.id === selectedSlotId;
        const strokeW = isEditing || isDragging ? 3 : isSelected ? 3.2 : isCurrent ? 2.6 : 1.6;
        const fill = fillFor(slot, wedge);
        const midH = (startH + endH) / 2;
        const [lx, ly] = P(((midH % 24) + 24) % 24, R_LABEL);

        const sNorm = ((startMin % DAY_MIN) + DAY_MIN) % DAY_MIN / 60;
        const eNorm = ((endMin % DAY_MIN) + DAY_MIN) % DAY_MIN / 60;
        const [sxH, syH] = P(sNorm, R_LABEL);
        const [exH, eyH] = P(eNorm === 0 && endMin !== 0 ? 24 : eNorm, R_LABEL);
        const isOvernight = endMin > DAY_MIN;

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
        const band = (a, b) => splitSegments(a, b).map(([s, e]) => ring(s, e, bandOuter, bandInner)).filter(Boolean).join(' ');

        return (
          <g key={slot.id}>
            {renderWedgeShape(startH, endH, fill, stroke, strokeW, slot.id,
              (ev) => onWedgePointerDown(ev, slot),
              (ev) => { ev.stopPropagation(); if (!isDragging) onWedgeClick(slot.id); })}

            {slotTasks.length > 0 && (
              <path d={band(startH, endH)} fill="rgba(0,0,0,0.06)" stroke="none" style={{ pointerEvents: 'none' }} />
            )}
            {taskBands.map(b => {
              const d = band(b.startH, b.endH);
              if (!d) return null;
              return <path key={`fill-${b.key}`} d={d} fill={b.color} fillOpacity={b.isDone ? 0.55 : 0.95} stroke="var(--ink)" strokeOpacity={b.isDone ? 0.25 : 0.5} strokeWidth={0.6} style={{ pointerEvents: 'none' }} />;
            })}
            {slotPlannedMin > 0 && (endH - startH) >= 1.2 && !dense && (() => {
              const [gx, gy] = P(((midH % 24) + 24) % 24, R_INNER + 26);
              return (
                <text x={gx} y={gy} className="tm-helix-gauge" fill="var(--ink-mute)" textAnchor="middle" style={{ pointerEvents: 'none' }}>
                  {fmtMinutes(slotDoneMin)} / {fmtMinutes(slotPlannedMin)}{slotPlannedMin > (slotEndMin - slotStartMin) ? ' ⚠' : ''}
                </text>
              );
            })()}
            {(!dense || (endH - startH) >= 1.5 || isCurrent || isSelected) && (
              <text
                x={lx}
                y={ly - 2}
                className={`tm-helix-label${isCurrent || isEditing ? ' tm-helix-label-live' : ''}`}
                fill="var(--ink)"
                textAnchor="middle"
                paintOrder="stroke"
                stroke={fill}
                strokeWidth={4}
                strokeLinejoin="round"
                style={{ pointerEvents: 'none' }}
              >
                {label}{isOvernight ? ' ↷' : ''}
              </text>
            )}
            <WedgeTaskChips slotId={slot.id} tasksBySlotId={tasksBySlotId} cx={lx} startY={ly + 14} maxChips={dense ? ((endH - startH) >= 2 ? 1 : 0) : (endH - startH) >= 1.5 ? 3 : (endH - startH) >= 0.75 ? 2 : 1} />
            {!slotTasks.length && wedge?.count ? (
              <text x={lx} y={ly + 14} className="tm-helix-gauge" fill="var(--ink-mute)" textAnchor="middle" style={{ pointerEvents: 'none' }}>
                {wedge.count} task{wedge.count > 1 ? 's' : ''}
              </text>
            ) : null}

            {(isSelected || isEditing || isDragging) && (
              <>
                <HandleWithNudge cx={sxH} cy={syH} slotId={slot.id} which="start" hover={hoverHandle} setHover={setHoverHandle} onDown={(ev) => onHandlePointerDown(ev, slot, 'start')} onNudge={onNudgeEdge} />
                <HandleWithNudge cx={exH} cy={eyH} slotId={slot.id} which="end" hover={hoverHandle} setHover={setHoverHandle} onDown={(ev) => onHandlePointerDown(ev, slot, 'end')} onNudge={onNudgeEdge} />
              </>
            )}
          </g>
        );
      })}

      {unrolled ? (
        <>
          <path d={turnPath({ ...geom, r: R_OUTER })} fill="none" stroke="var(--ink)" strokeWidth="2" pointerEvents="none" />
          <path d={turnPath({ ...geom, r: R_INNER })} fill="none" stroke="var(--ink)" strokeWidth="2" pointerEvents="none" />
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
        const [x2, y2] = P(h, R_OUTER + (isMajor ? 10 : isMid ? 8 : 6));
        return <line key={h} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink)" strokeWidth={isMajor ? 1.6 : isMid ? 1.2 : 1} strokeLinecap="round" opacity={isMajor ? 1 : isMid ? 0.85 : 0.7} />;
      })}

      <g pointerEvents="none">
        {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => {
          const [x, y] = P(h, R_OUTER + 22);
          const isMajor = h % 6 === 0;
          return (
            <text key={h} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className={`tm-helix-hour${isMajor ? ' tm-helix-hour-major' : ''}`} fill={isMajor ? 'var(--ink-soft)' : 'var(--ink-mute)'} opacity={isMajor ? 1 : 0.8}>
              {`${(h % 12) || 12}${h < 12 ? 'a' : 'p'}`}
            </text>
          );
        })}
      </g>

      <line x1={hubX} y1={hubY} x2={nxEnd} y2={nyEnd} stroke="var(--orange)" strokeWidth="2" opacity="0.5" pointerEvents="none" />
      <circle cx={nxEnd} cy={nyEnd} r="5" fill="var(--orange)" pointerEvents="none" />

      {/* The hub is the Do surface; it rides along with today's turn. */}
      {center && !drag && (
        <g pointerEvents="none" transform={`translate(0 ${hubDy})`}>
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

      {drag && (() => {
        const s = ((drag.startMin % DAY_MIN) + DAY_MIN) % DAY_MIN;
        const e = ((drag.endMin % DAY_MIN) + DAY_MIN) % DAY_MIN;
        return (
          <g pointerEvents="none" transform={`translate(0 ${hubDy})`}>
            <rect x={CX - 72} y={CY + 38} width={144} height={20} rx={6} fill="var(--paper)" stroke="var(--orange)" strokeWidth="1" />
            <text x={CX} y={CY + 52} className="tm-helix-sub" fill="var(--orange)" textAnchor="middle">
              {minToHHMM(s)}–{minToHHMM(e)}{drag.endMin > DAY_MIN ? ' +1d' : ''}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}

/** Flat ↔ helix slider and the days stepper. */
export function HelixControls({ t, onT, days, onDays, min = 1, max = 7 }) {
  return (
    <div className="tm-helix-ctl" role="group" aria-label="helix">
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
      <span className="tm-helix-days">
        <button type="button" className="tm-btn tm-sm" onClick={() => onDays(Math.max(min, days - 1))} disabled={days <= min} aria-label="fewer days">−</button>
        <span className="tm-mono tm-sm">{days} day{days === 1 ? '' : 's'}</span>
        <button type="button" className="tm-btn tm-sm" onClick={() => onDays(Math.min(max, days + 1))} disabled={days >= max} aria-label="more days">+</button>
      </span>
    </div>
  );
}

function WedgeTaskChips({ slotId, tasksBySlotId, cx, startY, maxChips = 3 }) {
  if (!tasksBySlotId || typeof tasksBySlotId.get !== 'function') return null;
  const entries = tasksBySlotId.get(slotId) || [];
  if (entries.length === 0 || maxChips <= 0) return null;
  const visible = entries.slice(0, maxChips);
  const overflow = entries.length - visible.length;
  return (
    <g style={{ pointerEvents: 'none' }}>
      {visible.map((entry, i) => {
        const task = entry.task || entry;
        const done = task.status === 'completed';
        return (
          <text key={task.id || task.key || i} x={cx} y={startY + i * 13} className="tm-helix-chip" fill={done ? 'var(--ink-mute)' : 'var(--ink-soft)'} textAnchor="middle" style={{ textDecoration: done ? 'line-through' : 'none' }}>
            {(task.text || task.title || 'task').slice(0, 18)}
          </text>
        );
      })}
      {overflow > 0 && (
        <text x={cx} y={startY + visible.length * 13} className="tm-helix-gauge" fill="var(--orange)" textAnchor="middle">+{overflow} more</text>
      )}
    </g>
  );
}

function HandleWithNudge({ cx, cy, slotId, which, hover, setHover, onDown, onNudge }) {
  const isHover = hover && hover.slotId === slotId && hover.which === which;
  const enter = () => setHover({ slotId, which });
  const leave = () => setHover(null);
  return (
    <g onPointerEnter={enter} onPointerLeave={leave}>
      <circle cx={cx} cy={cy - (isHover ? 10 : 0)} r={36} fill="transparent" onPointerEnter={enter} style={{ cursor: 'ew-resize' }} />
      <circle cx={cx} cy={cy} r={isHover ? 8 : 6} fill={isHover ? 'var(--orange-pale)' : 'var(--paper)'} stroke="var(--ink)" strokeWidth="1.4" style={{ cursor: 'ew-resize' }} onPointerDown={onDown} onPointerEnter={enter} />
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
