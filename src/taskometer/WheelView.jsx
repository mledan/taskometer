import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TaskRow } from './shared.jsx';
import {
  SlotComposer,
  SlotTypeManager,
  TaskRowEditor,
  getEffectiveTypes,
  resolveTypeColor,
} from './Composers.jsx';

const SNAP_MIN = 15;          // snap resolution in minutes
const DEFAULT_LEN_MIN = 60;   // length for click-to-create
const MIN_LEN_MIN = 15;       // smallest allowed arc
const DAY_MIN = 24 * 60;

export default function WheelView({
  wedges,
  nowTask,
  upcoming,
  pushed,
  slots = [],
  taskTypes = [],
  todayTasks = [],
  wheels = [],
  dayAssignments = {},
  dayOverrides = {},
  resolveDay,
  api,
  rowHandlers = {},
  onNavigate,
  onOpenWheels,
  selectedDate,
}) {
  const {
    onToggle, onDelete, onEdit, onSaveEdit, editingTaskId,
    onSeriesComplete, onSeriesDelete, onSeriesBump,
  } = rowHandlers;
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState(null);
  const [typeMgrOpen, setTypeMgrOpen] = useState(false);
  const [draftSlot, setDraftSlot] = useState(null);
  const [expandedSlotIds, setExpandedSlotIds] = useState(() => new Set());

  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;

  // The view can look at any date, but "now" annotations (red sweep,
  // current-wedge highlight, now-task card) only make sense when we're
  // actually viewing today. viewKey is whatever day the user is looking
  // at; realTodayKey is real today for the comparison.
  const viewDate = selectedDate instanceof Date ? selectedDate : new Date();
  const viewKey = ymd(viewDate);
  const realTodayKey = ymd(now);
  const isToday = viewKey === realTodayKey;

  // Use live-derived wedges only for .current/.count annotations. When we're
  // on another day the upstream "wedges" prop is still today-shaped, so
  // skip those annotations and let the drawn slots stand alone.
  const currentWedge = isToday ? wedges.find(w => w.current) : null;
  const currentLabel = isToday
    ? (currentWedge
        ? `now · ${currentWedge.label} · ${fmtHr(currentWedge.start)}–${fmtHr(currentWedge.end % 24)}`
        : `now · ${fmtHr(nowHour)}`)
    : viewDate.toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' }).toLowerCase();

  const nowTaskRow = isToday && nowTask ? toRow(nowTask, { now: true }) : null;
  const upcomingRows = isToday ? (upcoming || []).map(t => toRow(t)) : [];
  const pushedRows = isToday ? (pushed || []).map(t => toRow(t, { pushed: true })) : [];

  const rowProps = () => ({
    onToggle, onEdit, onDelete,
    onSeriesComplete, onSeriesDelete, onSeriesBump,
  });

  const renderTaskEntry = (t, source) => {
    const id = t.id;
    if (editingTaskId === id) {
      const original = source?.find(x => (x.id || x.key) === id);
      return (
        <div key={id} style={{ padding: '6px 10px', borderBottom: '1px solid var(--rule-soft)' }}>
          <TaskRowEditor
            task={original || t}
            onSave={(updates) => onSaveEdit && onSaveEdit(id, updates)}
            onCancel={() => onEdit && onEdit(id)}
            onDelete={() => onDelete && onDelete(id)}
            taskTypes={taskTypes}
          />
        </div>
      );
    }
    return <TaskRow key={id} task={t} {...rowProps()} />;
  };

  const viewOverride = dayOverrides[viewKey] || null;
  const viewSlots = slots
    .filter(s => s?.date === viewKey)
    .slice()
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

  // todayTasks is derived against real-today upstream; only meaningful
  // when the user is viewing today. On other days we render slots bare.
  const tasksBySlotId = isToday ? groupTasksBySlot(todayTasks, viewSlots) : new Map();

  // The `wedges` prop is today-shaped (built by the derivation upstream
  // from now + today's slots). When we're viewing another day we
  // re-synthesise wedges from viewSlots so the SVG shows that day's
  // shape, not today's.
  const effectiveWedges = isToday ? wedges : wedgesFromSlots(viewSlots);

  const toggleExpanded = useCallback((slotId) => {
    setExpandedSlotIds(prev => {
      const next = new Set(prev);
      if (next.has(slotId)) next.delete(slotId);
      else next.add(slotId);
      return next;
    });
  }, []);

  const editingSlot = editingSlotId
    ? viewSlots.find(s => s.id === editingSlotId)
    : null;

  const handleWedgeCommit = useCallback(async (id, { startMin, endMinUnwrapped }) => {
    const startTime = minToHHMM(startMin);
    const endTime = minToHHMM(endMinUnwrapped % DAY_MIN === 0 && endMinUnwrapped !== 0 ? 0 : endMinUnwrapped % DAY_MIN);
    await api.slots.update(id, { startTime, endTime });
  }, [api]);

  const slotRowRefs = useRef(new Map());

  const handleWedgeClick = useCallback((id) => {
    let expanding = false;
    setExpandedSlotIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        expanding = true;
      }
      return next;
    });
    // When we're opening the row, pull it into view so the tasks underneath
    // are visible without a manual scroll.
    if (expanding) {
      requestAnimationFrame(() => {
        const node = slotRowRefs.current.get(id);
        if (node?.scrollIntoView) {
          node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
  }, []);

  const handleEmptyHourClick = useCallback((hourFloat) => {
    const startMin = snapMin(Math.round(hourFloat * 60));
    const endMin = Math.min(DAY_MIN, startMin + DEFAULT_LEN_MIN);
    setDraftSlot({
      date: viewKey,
      startTime: minToHHMM(startMin),
      endTime: minToHHMM(endMin % DAY_MIN),
      label: '',
    });
    setEditingSlotId(null);
    setComposerOpen(true);
  }, [viewKey]);

  const handleAddFromButton = useCallback(() => {
    // find first free gap of >= DEFAULT_LEN_MIN, else propose 09:00-10:00
    const gap = findFirstFreeGap(viewSlots, DEFAULT_LEN_MIN);
    const startMin = gap ? gap.startMin : 9 * 60;
    const endMin = gap ? gap.endMin : 10 * 60;
    setDraftSlot({
      date: viewKey,
      startTime: minToHHMM(startMin),
      endTime: minToHHMM(endMin % DAY_MIN),
      label: '',
    });
    setEditingSlotId(null);
    setComposerOpen(true);
  }, [viewSlots, viewKey]);

  const closeComposer = () => {
    setComposerOpen(false);
    setEditingSlotId(null);
    setDraftSlot(null);
  };

  const handleSplit = async () => {
    if (!editingSlot) return;
    const startMin = hhmmToMin(editingSlot.startTime);
    const endRaw = hhmmToMin(editingSlot.endTime);
    const endMin = endRaw <= startMin ? endRaw + DAY_MIN : endRaw;
    const midMin = snapMin(Math.round((startMin + endMin) / 2));
    if (midMin - startMin < MIN_LEN_MIN || endMin - midMin < MIN_LEN_MIN) return;

    await api.slots.update(editingSlot.id, {
      endTime: minToHHMM(midMin % DAY_MIN),
    });
    await api.slots.add({
      date: editingSlot.date,
      startTime: minToHHMM(midMin % DAY_MIN),
      endTime: minToHHMM(endMin % DAY_MIN),
      slotType: editingSlot.slotType,
      label: editingSlot.label,
      color: editingSlot.color,
    });
    setEditingSlotId(null);
  };

  const findMergeTarget = () => {
    if (!editingSlot) return null;
    const sMin = hhmmToMin(editingSlot.startTime);
    const eRaw = hhmmToMin(editingSlot.endTime);
    const eMin = eRaw <= sMin ? eRaw + DAY_MIN : eRaw;
    // candidate: a slot whose startTime == editingSlot.endTime (adjacent after)
    // or whose endTime == editingSlot.startTime (adjacent before)
    const after = viewSlots.find(s => {
      if (s.id === editingSlot.id) return false;
      const ss = hhmmToMin(s.startTime);
      return ss === eMin % DAY_MIN;
    });
    if (after) return { neighbor: after, direction: 'after' };
    const before = viewSlots.find(s => {
      if (s.id === editingSlot.id) return false;
      const se = hhmmToMin(s.endTime);
      return se === sMin;
    });
    if (before) return { neighbor: before, direction: 'before' };
    return null;
  };

  const handleMerge = async () => {
    if (!editingSlot) return;
    const target = findMergeTarget();
    if (!target) return;
    const { neighbor, direction } = target;
    const newStart = direction === 'before' ? neighbor.startTime : editingSlot.startTime;
    const newEnd = direction === 'before' ? editingSlot.endTime : neighbor.endTime;
    await api.slots.update(editingSlot.id, { startTime: newStart, endTime: newEnd });
    await api.slots.remove(neighbor.id);
    setEditingSlotId(null);
  };

  const handleNudgeEdge = useCallback(async (slotId, which, deltaMin) => {
    const slot = viewSlots.find(s => s.id === slotId);
    if (!slot) return;
    const sMin = hhmmToMin(slot.startTime);
    const eRaw = hhmmToMin(slot.endTime);
    const eMin = eRaw <= sMin ? eRaw + DAY_MIN : eRaw;
    if (which === 'start') {
      const newStart = clamp(sMin + deltaMin, 0, eMin - MIN_LEN_MIN);
      await api.slots.update(slotId, { startTime: minToHHMM(newStart) });
    } else {
      const newEnd = Math.max(sMin + MIN_LEN_MIN, Math.min(sMin + DAY_MIN, eMin + deltaMin));
      await api.slots.update(slotId, { endTime: minToHHMM(newEnd % DAY_MIN) });
    }
  }, [viewSlots, api]);

  const mergeTarget = findMergeTarget();

  return (
    <div className="tm-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {viewOverride && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: `1.5px solid ${viewOverride.color || 'var(--ink-mute)'}`,
            background: hexAlpha(viewOverride.color || '#94A3B8', 0.18),
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <span
            className="tm-mono tm-md"
            style={{
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: viewOverride.color || 'var(--ink-mute)',
              fontWeight: 700,
            }}
          >
            {isToday ? 'today' : viewKey} · {viewOverride.type}
          </span>
          <span className="tm-caveat" style={{ fontSize: 22 }}>{viewOverride.label || viewOverride.type}</span>
          {viewOverride.note && (
            <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>{viewOverride.note}</span>
          )}
          <button
            className="tm-btn tm-sm"
            style={{ marginLeft: 'auto' }}
            onClick={() => api.days.clearOverride(viewKey)}
          >
            clear override
          </button>
        </div>
      )}

      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
        <WheelSvg
          wedges={effectiveWedges}
          slots={viewSlots}
          taskTypes={taskTypes}
          nowHour={isToday ? nowHour : -1}
          tasksBySlotId={tasksBySlotId}
          stats={computeStats(nowTask, upcoming, pushed)}
          onWedgeCommit={handleWedgeCommit}
          onWedgeClick={handleWedgeClick}
          onEmptyHourClick={handleEmptyHourClick}
          onNudgeEdge={handleNudgeEdge}
          editingSlotId={editingSlotId}
        />
        {viewSlots.length === 0 && (
          <div className="tm-wheel-empty">
            <div className="tm-caveat" style={{ fontSize: 24, marginBottom: 4 }}>tap the ring to drop a block</div>
            <div className="tm-mono tm-md" style={{ color: 'var(--ink-mute)' }}>
              or use <span className="tm-mono" style={{ color: 'var(--orange)' }}>+ time block</span> below
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
          paddingTop: 10,
          borderTop: '1px dashed var(--rule)',
        }}
      >
        <span
          className="tm-mono tm-sm"
          style={{ color: 'var(--ink-mute)', letterSpacing: '.10em', textTransform: 'uppercase' }}
        >
          {viewSlots.length} block{viewSlots.length === 1 ? '' : 's'}
          {isToday ? '' : ` · ${viewDate.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }).toLowerCase()}`}
        </span>
        <select
          className="tm-composer-select"
          value={dayAssignments[viewKey] || ''}
          onChange={async (ev) => {
            const next = ev.target.value;
            if (!next) await api.days.unassign(viewKey);
            else await api.wheels.applyToDate(next, viewKey, { mode: 'replace' });
          }}
          title="apply a wheel to this day"
          style={{ fontSize: 13, padding: '3px 8px' }}
        >
          <option value="">apply wheel…</option>
          {wheels.map(w => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <button
          className="tm-btn tm-primary tm-sm"
          onClick={() => {
            if (composerOpen || editingSlot) closeComposer();
            else handleAddFromButton();
          }}
        >
          {(composerOpen || editingSlot) ? 'close' : '+ time block'}
        </button>
        <button className="tm-btn tm-sm" onClick={() => setTypeMgrOpen(true)}>types</button>
        {onOpenWheels && (
          <button
            className="tm-btn tm-sm"
            onClick={onOpenWheels}
            title="save this day as a wheel, or pick from the library"
          >
            save day
          </button>
        )}
        <span className="tm-mono tm-sm" style={{ marginLeft: 'auto', color: 'var(--ink-mute)' }}>
          click a wedge to expand · drag to move · click empty ring to add
        </span>
      </div>

      {(composerOpen || editingSlot) && (
        <SlotComposer
          initial={editingSlot || draftSlot || undefined}
          taskTypes={taskTypes}
          onOpenTypeManager={() => setTypeMgrOpen(true)}
          onSave={async (data) => {
            if (editingSlot) {
              await api.slots.update(editingSlot.id, data);
              setEditingSlotId(null);
            } else {
              await api.slots.add(data);
              setComposerOpen(false);
              setDraftSlot(null);
            }
          }}
          onCancel={closeComposer}
          onDelete={editingSlot ? async () => {
            await api.slots.remove(editingSlot.id);
            setEditingSlotId(null);
          } : undefined}
          extraActions={editingSlot ? (
            <>
              <button
                className="tm-btn tm-sm"
                onClick={handleSplit}
                title="split this block in half"
              >
                split
              </button>
              {mergeTarget && (
                <button
                  className="tm-btn tm-sm"
                  onClick={handleMerge}
                  title={`merge with the adjacent block (${mergeTarget.direction})`}
                >
                  merge {mergeTarget.direction === 'before' ? '←' : '→'}
                </button>
              )}
            </>
          ) : null}
        />
      )}

      {expandedSlotIds.size > 0 && (
        <ExpandedWedgePanel
          slots={viewSlots.filter(s => expandedSlotIds.has(s.id))}
          tasksBySlotId={tasksBySlotId}
          taskTypes={taskTypes}
          renderTaskEntry={renderTaskEntry}
          onCollapse={(id) => toggleExpanded(id)}
          onEditSlot={(id) => {
            setEditingSlotId(id);
            setComposerOpen(false);
            setDraftSlot(null);
          }}
        />
      )}

      {typeMgrOpen && (
        <SlotTypeManager
          taskTypes={taskTypes}
          api={api}
          onClose={() => setTypeMgrOpen(false)}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// Inline subcomponents
// -------------------------------------------------------------------------

/**
 * Tiny circular wheel — same shape as the big WheelSvg but reduced to its
 * essence: colored arcs for the day's slots, optional center label, no
 * text on wedges. Used on the week strip and the month/quarter/year
 * calendar cells so every scale visually echoes the day view.
 */
export function MiniWheel({
  slots = [],
  size = 80,
  thickness = 10,
  highlight = false,
  emptyColor = 'var(--rule-soft)',
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2 - 2;
  const ang = (h) => (h / 24) * 360 - 90;
  const polar = (h, rr) => {
    const a = ang(h) * Math.PI / 180;
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  };
  const arc = (startH, endH) => {
    const span = endH - startH;
    if (span <= 0) return null;
    const large = span > 12 ? 1 : 0;
    const [x0, y0] = polar(startH, r);
    const [x1, y1] = polar(endH, r);
    return `M${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
  };

  const wedges = slots
    .slice()
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
    .map((s) => {
      const [sh, sm] = (s.startTime || '00:00').split(':').map(Number);
      const [eh, em] = (s.endTime || '00:00').split(':').map(Number);
      const startH = (sh || 0) + (sm || 0) / 60;
      let endH = (eh || 0) + (em || 0) / 60;
      if (endH <= startH) endH += 24;
      return { id: s.id, startH, endH: Math.min(24, endH), color: s.color || 'var(--ink-mute)' };
    });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={emptyColor}
        strokeWidth={thickness}
      />
      {wedges.map((w) => {
        const d = arc(w.startH, w.endH);
        if (!d) return null;
        return (
          <path
            key={w.id}
            d={d}
            fill="none"
            stroke={w.color}
            strokeWidth={thickness}
            strokeLinecap="butt"
          />
        );
      })}
      {highlight && (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--orange)"
          strokeWidth={1.5}
          strokeDasharray="3 3"
        />
      )}
    </svg>
  );
}

/**
 * Renders short task labels stacked vertically inside a wedge so the user
 * can read what's actually scheduled in each block without expanding it.
 * Falls back to the count badge upstream when there are no tasks for the
 * slot (the parent renders that path conditionally).
 */
function WedgeTaskChips({ slotId, tasksBySlotId, cx, startY, maxChips = 3 }) {
  if (!tasksBySlotId || typeof tasksBySlotId.get !== 'function') return null;
  const entries = tasksBySlotId.get(slotId) || [];
  if (entries.length === 0) return null;
  const visible = entries.slice(0, maxChips);
  const overflow = entries.length - visible.length;
  return (
    <g style={{ pointerEvents: 'none' }}>
      {visible.map((entry, i) => {
        const t = entry.task || entry;
        const text = (t.text || t.title || 'task').slice(0, 18);
        const done = t.status === 'completed';
        return (
          <text
            key={t.id || t.key || i}
            x={cx}
            y={startY + i * 13}
            fontFamily="JetBrains Mono"
            fontSize={10.5}
            fill={done ? 'var(--ink-mute)' : 'var(--ink-soft)'}
            textAnchor="middle"
            style={{
              textDecoration: done ? 'line-through' : 'none',
              pointerEvents: 'none',
            }}
          >
            {text}
          </text>
        );
      })}
      {overflow > 0 && (
        <text
          x={cx}
          y={startY + visible.length * 13}
          fontFamily="JetBrains Mono"
          fontSize={10}
          fill="var(--orange)"
          textAnchor="middle"
          style={{ pointerEvents: 'none' }}
        >
          +{overflow} more
        </text>
      )}
    </g>
  );
}

/**
 * Inline panel shown below the wheel when one or more wedges are expanded.
 * Replaces the old long vertical slot-list — the wheel itself is now the
 * primary slot view, and this is where you go deep on a specific block.
 */
function ExpandedWedgePanel({
  slots,
  tasksBySlotId,
  taskTypes,
  renderTaskEntry,
  onCollapse,
  onEditSlot,
}) {
  if (!slots || slots.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {slots.map(s => {
        const color = s.color || resolveTypeColor(taskTypes, s.slotType) || 'var(--ink)';
        const overnight = isOvernightSlot(s);
        const slotTasks = tasksBySlotId?.get?.(s.id) || [];
        return (
          <div
            key={s.id}
            className="tm-card"
            style={{
              padding: '12px 14px',
              borderLeft: `4px solid ${color}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 18 }}>{s.label || s.slotType || 'block'}</span>
              <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
                {s.startTime}–{s.endTime}{overnight ? ' (+1d)' : ''}
              </span>
              {s.slotType && (
                <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
                  · {s.slotType}
                </span>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button className="tm-btn tm-sm" onClick={() => onEditSlot(s.id)}>edit block</button>
                <button className="tm-btn tm-sm" onClick={() => onCollapse(s.id)}>close</button>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              {slotTasks.length === 0 ? (
                <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
                  no tasks scheduled in this block yet
                </div>
              ) : (
                slotTasks.map(entry => {
                  const row = toRow(entry.task, { now: entry.state === 'live' });
                  const overflow = overflowsSlot(entry, s);
                  return (
                    <div
                      key={entry.task.id || entry.task.key}
                      style={{ borderTop: '1px solid var(--rule-soft)', padding: '4px 0' }}
                    >
                      {renderTaskEntry(row, slotTasks.map(e => e.task))}
                      {overflow ? (
                        <div className="tm-mono tm-sm" style={{ color: 'var(--orange)', marginTop: 2 }}>
                          overflows this block by {fmtMinutes(overflow)}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function ymd(d) {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

// Shape-compatible with deriveWheelWedges but without task counts or the
// `current` flag — used when the wheel is showing a day other than today
// so the SVG reflects that day's blocks rather than today's.
function wedgesFromSlots(slots) {
  return slots
    .slice()
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
    .map((s) => {
      const [sh, sm] = (s.startTime || '00:00').split(':').map(Number);
      const [eh, em] = (s.endTime || '00:00').split(':').map(Number);
      const startH = (sh || 0) + (sm || 0) / 60;
      let endH = (eh || 0) + (em || 0) / 60;
      if (endH <= startH) endH += 24;
      return {
        id: s.id,
        label: s.label || s.slotType || 'block',
        start: startH,
        end: Math.min(24, endH),
        kind: undefined,
        count: undefined,
        current: false,
      };
    });
}

function todayYMD() {
  const d = new Date();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

function toRow(t, extras = {}) {
  const dur = typeof t.duration === 'number' ? t.duration : 30;
  const meta = t.metadata || {};
  const inSeries = typeof meta.segmentsTotal === 'number' && meta.segmentsTotal > 1;
  const segmentLabel = inSeries ? `${(meta.segmentIndex ?? 0) + 1} of ${meta.segmentsTotal}` : null;
  const title = segmentLabel
    ? `${t.text || t.title || 'untitled'} · pt ${segmentLabel}`
    : (t.text || t.title || 'untitled');
  return {
    id: t.id || t.key,
    title,
    ctx: t.primaryType || t.taskType || 'task',
    when: t.scheduledTime ? fmtTimeRange(t.scheduledTime, dur) : 'unscheduled',
    status: extras.pushed ? 'pushed' : t.status,
    done: t.status === 'completed',
    now: !!extras.now,
    note: extras.now ? `in progress · ${dur}m` : null,
    duration: dur,
    priority: t.priority,
    tags: t.tags,
    recurrence: t.recurrence,
    seriesId: inSeries ? meta.seriesId : null,
    segmentIndex: meta.segmentIndex,
    segmentsTotal: meta.segmentsTotal,
  };
}

function fmtTimeRange(iso, dur) {
  const d = new Date(iso);
  const end = new Date(d.getTime() + dur * 60 * 1000);
  return `${fmtClock(d)}–${fmtClock(end)}`;
}

function fmtClock(d) {
  const h = d.getHours();
  const hr = ((h % 12) || 12);
  const ampm = h < 12 ? 'a' : 'p';
  const m = d.getMinutes();
  return m ? `${hr}:${m < 10 ? '0' + m : m}${ampm}` : `${hr}${ampm}`;
}

function fmtHr(h) {
  const base = Math.floor(h) % 24;
  const mins = Math.round((h - Math.floor(h)) * 60);
  const hr = ((base % 12) || 12);
  const ampm = base < 12 ? 'a' : 'p';
  return mins ? `${hr}:${mins < 10 ? '0' + mins : mins}${ampm}` : `${hr}${ampm}`;
}

function computeStats(nowTask, upcoming, pushed) {
  const total = (upcoming?.length || 0) + (pushed?.length || 0) + (nowTask ? 1 : 0);
  const done = 0;
  return { total, done, pushed: pushed?.length || 0 };
}

function hhmmToMin(s) {
  if (!s) return 0;
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minToHHMM(min) {
  const m = ((Math.round(min) % DAY_MIN) + DAY_MIN) % DAY_MIN;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${pad(h)}:${pad(mm)}`;
}

function pad(n) { return n < 10 ? `0${n}` : `${n}`; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function snapMin(min) { return Math.round(min / SNAP_MIN) * SNAP_MIN; }

function isOvernightSlot(slot) {
  return hhmmToMin(slot.endTime) <= hhmmToMin(slot.startTime);
}

function slotSpan(slot) {
  const sMin = hhmmToMin(slot.startTime);
  const eRaw = hhmmToMin(slot.endTime);
  const eMin = eRaw <= sMin ? eRaw + DAY_MIN : eRaw;
  return { sMin, eMin };
}

/**
 * Bucket today's tasks into their owning slot. A task belongs to a slot
 * when its scheduledSlotId matches, or when its start time falls inside
 * the slot window. Each task lands in at most one slot (first match wins)
 * so clicking a category gives an unambiguous list.
 */
function groupTasksBySlot(todayTasks = [], viewSlots = []) {
  const map = new Map();
  viewSlots.forEach(s => map.set(s.id, []));

  const spans = viewSlots.map(s => ({ slot: s, ...slotSpan(s) }));

  for (const entry of todayTasks) {
    const task = entry.task;
    if (!task) continue;

    const byId = task.scheduledSlotId && map.has(task.scheduledSlotId)
      ? task.scheduledSlotId
      : null;

    let targetId = byId;
    if (!targetId) {
      const startDate = new Date(entry.start);
      const startMin = startDate.getHours() * 60 + startDate.getMinutes();
      const match = spans.find(({ sMin, eMin }) => {
        const normStart = sMin;
        // Handle overnight slots by wrapping the candidate upward when
        // it falls before the slot's start on the same day.
        const normCandidate = startMin < sMin && eMin > DAY_MIN
          ? startMin + DAY_MIN
          : startMin;
        return normCandidate >= normStart && normCandidate < eMin;
      });
      targetId = match?.slot.id || null;
    }

    if (targetId) map.get(targetId).push(entry);
  }

  // Sort each bucket by start time
  for (const bucket of map.values()) {
    bucket.sort((a, b) => a.start - b.start);
  }
  return map;
}

/**
 * Minutes a task extends past its slot's end. Zero if it fits.
 */
function overflowsSlot(entry, slot) {
  const { eMin } = slotSpan(slot);
  const start = new Date(entry.start);
  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMinRaw = startMin + (entry.duration || 30);
  const over = endMinRaw - eMin;
  return over > 0 ? over : 0;
}

function fmtMinutes(mins) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function findFirstFreeGap(slots, lengthMin) {
  // Produces the first gap of at least lengthMin after 00:00. Ignores overnight slots' second half.
  const occupied = slots
    .map(s => slotSpan(s))
    .map(({ sMin, eMin }) => [sMin, Math.min(DAY_MIN, eMin)])
    .sort((a, b) => a[0] - b[0]);

  let cursor = 0;
  for (const [os, oe] of occupied) {
    if (os - cursor >= lengthMin) {
      return { startMin: cursor, endMin: cursor + lengthMin };
    }
    cursor = Math.max(cursor, oe);
  }
  if (DAY_MIN - cursor >= lengthMin) {
    return { startMin: cursor, endMin: cursor + lengthMin };
  }
  return null;
}

// -------------------------------------------------------------------------
// Interactive wheel SVG
// -------------------------------------------------------------------------

function WheelSvg({
  wedges,
  slots,
  taskTypes,
  nowHour,
  stats,
  tasksBySlotId,
  onWedgeCommit,
  onWedgeClick,
  onEmptyHourClick,
  onNudgeEdge,
  editingSlotId,
}) {
  const cx = 320, cy = 320, rOuter = 295, rInner = 110;
  const labelR = (rOuter + rInner) / 2;
  const svgRef = useRef(null);

  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  useEffect(() => { dragRef.current = drag; }, [drag]);

  const [hoverHandle, setHoverHandle] = useState(null); // {slotId, which}

  const wedgeById = (id) => wedges.find(w => w.id === id);

  const ang = (h) => (h / 24) * 360 - 90;
  const polar = (h, r) => {
    const a = ang(h) * Math.PI / 180;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };

  const wedgePath = (startH, endH) => {
    // arc from startH to endH; clip into [0,24]; caller handles splitting overnight
    const sH = Math.max(0, startH);
    const eH = Math.min(24, endH);
    if (eH <= sH) return '';
    const [x0, y0] = polar(sH, rOuter);
    const [x1, y1] = polar(eH, rOuter);
    const [x2, y2] = polar(eH, rInner);
    const [x3, y3] = polar(sH, rInner);
    const large = (eH - sH) > 12 ? 1 : 0;
    return `M${x0} ${y0} A${rOuter} ${rOuter} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${rInner} ${rInner} 0 ${large} 0 ${x3} ${y3} Z`;
  };

  const hourTicks = [];
  for (let h = 0; h < 24; h++) {
    const [x1, y1] = polar(h, rOuter);
    const [x2, y2] = polar(h, rOuter + (h % 6 === 0 ? 10 : 5));
    hourTicks.push(<line key={h} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink)" strokeWidth={h % 6 === 0 ? 1.6 : 1} />);
  }

  const fillFor = (slot, wedge) => {
    const typeColor = slot.color || resolveTypeColor(taskTypes, slot.slotType);
    if (typeColor) return hexWithAlpha(typeColor, 0.28);
    if (wedge?.current) return 'var(--orange-pale)';
    if (wedge?.kind === 'hot') return 'var(--orange-pale)';
    if (wedge?.kind === 'light') return 'var(--sage-pale)';
    if (wedge?.kind === 'rest') return '#EAE4DA';
    if (wedge?.kind === 'soft') return '#F3EFE5';
    return 'var(--paper)';
  };

  const strokeFor = (slot, wedge, isCurrent, isEditing) => {
    if (isEditing) return 'var(--orange)';
    const typeColor = slot.color || resolveTypeColor(taskTypes, slot.slotType);
    if (typeColor && !isCurrent) return typeColor;
    return isCurrent ? 'var(--ink)' : 'var(--rule)';
  };

  const pointerToHour = (ev) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const scale = rect.width / 440;
    const sx = rect.left + (cx / 440) * rect.width;
    const sy = rect.top + (cy / 440) * rect.height;
    const dx = ev.clientX - sx;
    const dy = ev.clientY - sy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const rInnerPx = rInner * scale;
    const rOuterPx = rOuter * scale;
    const angleFromTop = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    const normalized = ((angleFromTop % 360) + 360) % 360;
    const hour = (normalized / 360) * 24;
    return { hour, dist, rInnerPx, rOuterPx };
  };

  // Snap a raw pointer "min" value to the interpretation closest to `near`.
  // Allows handles to wrap across midnight without jumping half a day.
  const nearestMin = (rawMin, near) => {
    const candidates = [rawMin, rawMin + DAY_MIN, rawMin - DAY_MIN, rawMin + 2 * DAY_MIN];
    let best = rawMin, bestDist = Infinity;
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
          const maxStart = prev.endMin - MIN_LEN_MIN;
          const minStart = prev.endMin - DAY_MIN + MIN_LEN_MIN;
          const s = clamp(snapped, minStart, maxStart);
          return { ...prev, startMin: s };
        }
        if (prev.mode === 'end') {
          const snapped = nearestMin(rawMin, prev.origEndMin);
          const minEnd = prev.startMin + MIN_LEN_MIN;
          const maxEnd = prev.startMin + DAY_MIN;
          const e = clamp(snapped, minEnd, maxEnd);
          return { ...prev, endMin: e };
        }
        // move: shift by delta; wrap origin too so wedge can cross midnight
        const snapped = nearestMin(rawMin, prev.originMin);
        const delta = snapped - prev.originMin;
        const length = prev.origEndMin - prev.origStartMin;
        const s = prev.origStartMin + delta;
        const e = s + length;
        return { ...prev, startMin: s, endMin: e };
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.id, drag?.mode]);

  const onWedgePointerDown = (ev, slot) => {
    if (ev.button !== 0) return;
    ev.stopPropagation();
    ev.preventDefault();
    try { ev.currentTarget.setPointerCapture?.(ev.pointerId); } catch (_) {}
    const info = pointerToHour(ev);
    if (!info) return;
    const { sMin, eMin } = slotSpan(slot);
    const origin = snapMin(Math.round(info.hour * 60));
    // If origin is outside the current span, shift to nearest representation
    const originInSpan = nearestMin(origin, (sMin + eMin) / 2);
    setDrag({
      id: slot.id,
      mode: 'move',
      originMin: originInSpan,
      startMin: sMin,
      endMin: eMin,
      origStartMin: sMin,
      origEndMin: eMin,
    });
  };

  const onHandlePointerDown = (ev, slot, which) => {
    ev.stopPropagation();
    ev.preventDefault();
    try { ev.currentTarget.setPointerCapture?.(ev.pointerId); } catch (_) {}
    const info = pointerToHour(ev);
    if (!info) return;
    const { sMin, eMin } = slotSpan(slot);
    const raw = snapMin(Math.round(info.hour * 60));
    const near = which === 'start' ? sMin : eMin;
    const origin = nearestMin(raw, near);
    setDrag({
      id: slot.id,
      mode: which,
      originMin: origin,
      startMin: sMin,
      endMin: eMin,
      origStartMin: sMin,
      origEndMin: eMin,
    });
  };

  const onRingPointerDown = (ev) => {
    const info = pointerToHour(ev);
    if (!info) return;
    if (info.dist < info.rInnerPx || info.dist > info.rOuterPx) return;
    onEmptyHourClick(info.hour);
  };

  // Compute render geometry (use live drag values when active)
  const renderGeom = slots.map(slot => {
    const isDraggingThis = drag && drag.id === slot.id;
    const { sMin: baseS, eMin: baseE } = slotSpan(slot);
    const startMin = isDraggingThis ? drag.startMin : baseS;
    const endMin = isDraggingThis ? drag.endMin : baseE;
    const startH = startMin / 60;
    const endH = endMin / 60;
    const wedge = wedgeById(slot.id);
    const isCurrent = wedge?.current && !isDraggingThis;
    const isEditing = editingSlotId === slot.id;
    return { slot, wedge, startMin, endMin, startH, endH, isCurrent, isEditing, isDragging: isDraggingThis };
  });

  const [nxEnd, nyEnd] = polar(nowHour, rOuter - 4);

  // Render wedge paths allowing overnight split (start<0 or end>24)
  const renderWedgeShape = (startH, endH, fill, stroke, strokeW, slotId, onDown, onClick) => {
    // Normalize so startH falls in [0, 24). Compute up to two visible segments.
    const raw = [];
    let s = startH, e = endH;
    // Shift into a frame where start is in [0, 24)
    const shift = Math.floor(s / 24);
    s -= shift * 24;
    e -= shift * 24;
    // Now s in [0,24). Segment 1: [s, min(24, e)].
    raw.push([s, Math.min(24, e)]);
    if (e > 24) raw.push([0, e - 24]);
    if (e < 0) raw.push([e + 24, 24]);

    return raw.map((seg, i) => {
      const path = wedgePath(seg[0], seg[1]);
      if (!path) return null;
      return (
        <path
          key={`${slotId}-seg${i}`}
          d={path}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeW}
          onPointerDown={onDown}
          onClick={onClick}
          style={{ cursor: drag ? 'grabbing' : 'grab' }}
        />
      );
    });
  };

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="640"
      viewBox="0 0 640 640"
      style={{ maxWidth: 720, touchAction: 'none', userSelect: 'none' }}
    >
      <circle
        cx={cx}
        cy={cy}
        r={rOuter}
        fill="var(--paper)"
        stroke="none"
        onPointerDown={onRingPointerDown}
        style={{ cursor: 'crosshair' }}
      />
      <circle
        cx={cx}
        cy={cy}
        r={rInner}
        fill="var(--paper)"
        stroke="none"
      />

      {renderGeom.map(({ slot, wedge, startH, endH, startMin, endMin, isCurrent, isEditing, isDragging }) => {
        const label = slot.label || slot.slotType || 'block';
        const stroke = strokeFor(slot, wedge, isCurrent, isEditing);
        const strokeW = isEditing || isDragging ? 2.6 : isCurrent ? 2.2 : 1;
        const fill = fillFor(slot, wedge);
        const midH = (startH + endH) / 2;
        const [lx, ly] = polar(((midH % 24) + 24) % 24, labelR);

        // Handles: always place on [0, 24) frame
        const sNorm = ((startMin % DAY_MIN) + DAY_MIN) % DAY_MIN / 60;
        const eNorm = ((endMin % DAY_MIN) + DAY_MIN) % DAY_MIN / 60;
        const [sxH, syH] = polar(sNorm, (rOuter + rInner) / 2);
        const [exH, eyH] = polar(eNorm === 0 && endMin !== 0 ? 24 : eNorm, (rOuter + rInner) / 2);
        const isOvernight = endMin > DAY_MIN;

        return (
          <g key={slot.id}>
            {renderWedgeShape(
              startH,
              endH,
              fill,
              stroke,
              strokeW,
              slot.id,
              (ev) => onWedgePointerDown(ev, slot),
              (ev) => { ev.stopPropagation(); if (!isDragging) onWedgeClick(slot.id); }
            )}
            {isOvernight && (
              // faint connector text
              <text
                x={cx}
                y={cy + 48}
                fontFamily="JetBrains Mono"
                fontSize="9"
                fill="var(--ink-mute)"
                textAnchor="middle"
                style={{ pointerEvents: 'none' }}
              >
                {label} crosses midnight
              </text>
            )}
            <text
              x={lx}
              y={ly - 2}
              fontFamily="Caveat"
              fontSize={isCurrent || isEditing ? 22 : 18}
              fill="var(--ink)"
              textAnchor="middle"
              fontStyle={isCurrent || isEditing ? 'italic' : 'normal'}
              fontWeight={isCurrent || isEditing ? 600 : 400}
              style={{ pointerEvents: 'none' }}
            >
              {label}
            </text>
            <WedgeTaskChips
              slotId={slot.id}
              tasksBySlotId={tasksBySlotId}
              fallbackCount={wedge?.count}
              cx={lx}
              startY={ly + 14}
              maxChips={(endH - startH) >= 1.5 ? 3 : (endH - startH) >= 0.75 ? 2 : 1}
            />
            {!tasksBySlotId?.get?.(slot.id)?.length && wedge?.count ? (
              <text
                x={lx}
                y={ly + 14}
                fontFamily="JetBrains Mono"
                fontSize="10"
                fill="var(--ink-mute)"
                textAnchor="middle"
                style={{ pointerEvents: 'none' }}
              >
                {wedge.count} task{wedge.count > 1 ? 's' : ''}
              </text>
            ) : null}

            {/* resize handles with hover ±15m nudge buttons */}
            <HandleWithNudge
              cx={sxH}
              cy={syH}
              slotId={slot.id}
              which="start"
              hover={hoverHandle}
              setHover={setHoverHandle}
              onDown={(ev) => onHandlePointerDown(ev, slot, 'start')}
              onNudge={onNudgeEdge}
            />
            <HandleWithNudge
              cx={exH}
              cy={eyH}
              slotId={slot.id}
              which="end"
              hover={hoverHandle}
              setHover={setHoverHandle}
              onDown={(ev) => onHandlePointerDown(ev, slot, 'end')}
              onNudge={onNudgeEdge}
            />
          </g>
        );
      })}

      <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="var(--ink)" strokeWidth="2" pointerEvents="none" />
      <circle cx={cx} cy={cy} r={rInner} fill="none" stroke="var(--ink)" strokeWidth="2" pointerEvents="none" />
      {hourTicks}

      <text x={cx} y={18} fontFamily="Caveat" fontSize="18" fill="var(--ink-mute)" textAnchor="middle" fontStyle="italic" pointerEvents="none">12a</text>
      <text x={cx} y={438} fontFamily="Caveat" fontSize="18" fill="var(--ink-mute)" textAnchor="middle" fontStyle="italic" pointerEvents="none">12p</text>
      <text x={10} y={cy + 4} fontFamily="Caveat" fontSize="22" fill="var(--ink-mute)" fontStyle="italic" pointerEvents="none">6p</text>
      <text x={630} y={cy + 4} fontFamily="Caveat" fontSize="22" fill="var(--ink-mute)" fontStyle="italic" pointerEvents="none">6a</text>

      <line x1={cx} y1={cy} x2={nxEnd} y2={nyEnd} stroke="var(--orange)" strokeWidth="2" opacity="0.5" pointerEvents="none" />
      <circle cx={nxEnd} cy={nyEnd} r="5" fill="var(--orange)" pointerEvents="none" />

      <text x={cx} y={cy - 14} fontFamily="JetBrains Mono" fontSize="10" fill="var(--ink-mute)" textAnchor="middle" letterSpacing="2" pointerEvents="none">TODAY</text>
      <text x={cx} y={cy + 10} fontFamily="Caveat" fontSize="26" fill="var(--ink)" textAnchor="middle" fontStyle="italic" pointerEvents="none">
        {stats.done} of {stats.total}
      </text>
      <text x={cx} y={cy + 28} fontFamily="JetBrains Mono" fontSize="9" fill="var(--ink-mute)" textAnchor="middle" letterSpacing="1" pointerEvents="none">
        {stats.pushed} pushed
      </text>

      {drag && (() => {
        const s = ((drag.startMin % DAY_MIN) + DAY_MIN) % DAY_MIN;
        const e = ((drag.endMin % DAY_MIN) + DAY_MIN) % DAY_MIN;
        const crosses = drag.endMin > DAY_MIN;
        return (
          <g pointerEvents="none">
            <rect x={cx - 72} y={cy + 38} width={144} height={20} rx={6} fill="var(--paper)" stroke="var(--orange)" strokeWidth="1" />
            <text x={cx} y={cy + 52} fontFamily="JetBrains Mono" fontSize="11" fill="var(--orange)" textAnchor="middle">
              {minToHHMM(s)}–{minToHHMM(e)}{crosses ? ' +1d' : ''}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}

function HandleWithNudge({ cx, cy, slotId, which, hover, setHover, onDown, onNudge }) {
  const isHover = hover && hover.slotId === slotId && hover.which === which;
  const HIT_R = 36; // generous hover radius that encloses both chips
  const enter = () => setHover({ slotId, which });
  const leave = () => setHover(null);
  return (
    <g onPointerEnter={enter} onPointerLeave={leave}>
      {/* Outer hit-area — invisible, large enough to cover the chips so the
          hover doesn't drop when the user moves to click one. */}
      <circle
        cx={cx}
        cy={cy - (isHover ? 10 : 0)}
        r={HIT_R}
        fill="transparent"
        onPointerEnter={enter}
        style={{ cursor: 'ew-resize' }}
      />
      <circle
        cx={cx}
        cy={cy}
        r={isHover ? 8 : 6}
        fill={isHover ? 'var(--orange-pale)' : 'var(--paper)'}
        stroke="var(--ink)"
        strokeWidth="1.4"
        style={{ cursor: 'ew-resize' }}
        onPointerDown={onDown}
        onPointerEnter={enter}
      />
      {isHover && (
        <g onPointerEnter={enter}>
          <NudgeChip
            cx={cx - 20}
            cy={cy - 20}
            label="−15"
            onClick={(ev) => { ev.stopPropagation(); onNudge(slotId, which, -15); }}
          />
          <NudgeChip
            cx={cx + 20}
            cy={cy - 20}
            label="+15"
            onClick={(ev) => { ev.stopPropagation(); onNudge(slotId, which, +15); }}
          />
        </g>
      )}
    </g>
  );
}

function NudgeChip({ cx, cy, label, onClick }) {
  return (
    <g style={{ cursor: 'pointer' }} onClick={onClick} onPointerDown={(ev) => ev.stopPropagation()}>
      <rect
        x={cx - 14}
        y={cy - 9}
        width={28}
        height={18}
        rx={9}
        fill="var(--paper)"
        stroke="var(--orange)"
        strokeWidth="1.2"
      />
      <text
        x={cx}
        y={cy + 4}
        fontFamily="JetBrains Mono"
        fontSize="10"
        fill="var(--orange)"
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  );
}

/**
 * HelixStrip — makes the "wheel is actually a helix" idea visible.
 *
 * The 24h wheel loops on itself visually but not conceptually: the sleep
 * block that starts at 22:00 ends at 06:00 *tomorrow*, not at 06:00 today.
 * This strip renders the handoff: today's overnight tail, then tomorrow's
 * first few blocks, with a small "→ tomorrow" arrow between them.
 *
 * Tomorrow's shape is resolved through `resolveDay` so rules are
 * respected — a ruled tomorrow shows up even before the user paints it.
 */
function HelixStrip({
  viewKey,
  viewSlots,
  allSlots,
  wheels,
  dayAssignments,
  dayOverrides,
  resolveDay,
  taskTypes,
}) {
  const tomorrowKey = addDaysKey(viewKey, 1);
  const tomorrowEffective = resolveDay
    ? resolveDay(tomorrowKey)
    : {
        wheelId: dayAssignments[tomorrowKey] || null,
        override: dayOverrides[tomorrowKey] || null,
        source: dayAssignments[tomorrowKey] || dayOverrides[tomorrowKey] ? 'pin' : 'none',
      };
  const tomorrowWheel = wheels.find(w => w.id === tomorrowEffective.wheelId) || null;
  const tomorrowOverride = tomorrowEffective.override;
  const fromRule = tomorrowEffective.source === 'rule';

  // Real slots already scheduled for tomorrow
  const existingTomorrow = (allSlots || [])
    .filter(s => s.date === tomorrowKey)
    .slice()
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

  // If tomorrow's slots haven't been materialised but a wheel is resolved
  // (pinned or ruled), preview the wheel's own blocks so the strip still
  // shows something useful.
  const previewBlocks = existingTomorrow.length > 0
    ? existingTomorrow.map(s => ({
        startTime: s.startTime,
        endTime: s.endTime,
        label: s.label || s.slotType || 'block',
        color: s.color || null,
        slotType: s.slotType || null,
      }))
    : (tomorrowWheel?.blocks || []).slice().sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

  const overnight = viewSlots.find(s => isOvernightSlot(s));

  const noTomorrow = !tomorrowWheel && !tomorrowOverride && previewBlocks.length === 0;

  return (
    <div
      className="tm-card tm-flush"
      style={{
        marginTop: 10,
        padding: '10px 12px',
        borderTop: '1px dashed var(--rule)',
      }}
      title="today's wheel hands off to tomorrow — the day is a helix, not a loop"
    >
      <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 4 }}>
        → tomorrow ({tomorrowKey})
      </div>
      {overnight && (
        <div className="tm-mono tm-sm" style={{ marginBottom: 4 }}>
          <span style={{ color: overnight.color || 'var(--ink)' }}>
            {overnight.label || overnight.slotType || 'block'}
          </span>{' '}
          crosses midnight — ends <strong>{overnight.endTime}</strong> tomorrow
        </div>
      )}
      {tomorrowOverride && (
        <div className="tm-mono tm-sm" style={{ color: tomorrowOverride.color }}>
          tomorrow is set to <strong>{tomorrowOverride.label || tomorrowOverride.type}</strong>
          {fromRule ? ' (from rule)' : ''}
        </div>
      )}
      {tomorrowWheel && (
        <div className="tm-mono tm-sm" style={{ color: tomorrowWheel.color }}>
          wheel: <strong>{tomorrowWheel.name}</strong>{fromRule ? ' (from rule)' : ''}
        </div>
      )}
      {previewBlocks.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
          {previewBlocks.slice(0, 6).map((b, i) => {
            const color = b.color || resolveTypeColor(taskTypes, b.slotType) || '#94A3B8';
            return (
              <span
                key={i}
                className="tm-mono tm-sm"
                style={{
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: hexWithAlpha(color, 0.18),
                  border: `1px ${fromRule && existingTomorrow.length === 0 ? 'dashed' : 'solid'} ${color}`,
                  color: 'var(--ink)',
                }}
              >
                {b.startTime}–{b.endTime} {b.label || ''}
              </span>
            );
          })}
          {previewBlocks.length > 6 && (
            <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
              +{previewBlocks.length - 6} more
            </span>
          )}
        </div>
      ) : noTomorrow ? (
        <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
          nothing planned yet — pin a wheel to tomorrow or add a rule so it flows through automatically.
        </div>
      ) : null}
    </div>
  );
}

function addDaysKey(dateKey, delta) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  const mm = date.getMonth() + 1;
  const dd = date.getDate();
  return `${date.getFullYear()}-${mm < 10 ? '0' + mm : mm}-${dd < 10 ? '0' + dd : dd}`;
}

function hexWithAlpha(hex, alpha) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hexAlpha(hex, alpha) {
  return hexWithAlpha(hex, alpha);
}
