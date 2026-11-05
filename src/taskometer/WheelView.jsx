import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WheelPickerModal from './WheelPickerModal.jsx';
import { TaskRow } from './shared.jsx';
import SleepCycleHint from './SleepCycleHint.jsx';
import { isSleepSlot } from '../services/sleepCycles.js';
import {
  SlotComposer,
  SlotTypeManager,
  TaskRowEditor,
  resolveTypeColor,
} from './Composers.jsx';
import HelixView, { HelixControls } from './helix/HelixView.jsx';
import { useLensRoute } from './helix/useMorph.js';
import { buildDayLayers } from './helix/layers.js';
import {
  DAY_MIN, DEFAULT_LEN_MIN, MIN_LEN_MIN,
  hhmmToMin, minToHHMM, clamp, snapMin, slotSpan, isOvernightSlot, fmtMinutes, fmtHr, fmtClock, ymd,
} from './helix/slotMath.js';

const DEFAULT_HELIX_DAYS = 5;

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
  selectedSlotId,
  onSelectWedge,
  lens = 'wheel',
  allTasks = [],
  onPickDate,
}) {
  const {
    onToggle, onDelete, onEdit, onSaveEdit, editingTaskId,
    onSeriesComplete, onSeriesDelete, onSeriesBump,
  } = rowHandlers;
  // (t, u): t unrolls the wheel into the helix, u drops the helix into a
  // column. The lens picks the target; the route always passes through
  // the helix so the schedule never jumps. The slider overrides t.
  const { t, u, setT } = useLensRoute(lens);
  const [days, setDays] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia?.('(max-width: 760px)').matches ? 3 : DEFAULT_HELIX_DAYS
  ));
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState(null);
  const [typeMgrOpen, setTypeMgrOpen] = useState(false);
  const [draftSlot, setDraftSlot] = useState(null);
  const [expandedSlotIds, setExpandedSlotIds] = useState(() => new Set());
  const [pickerOpen, setPickerOpen] = useState(false);

  // Keep the expansion panel in sync with the parent's selectedSlotId.
  // Picking a type from the composer dropdown auto-highlights a wedge
  // upstream; we want that same wedge to be the only one expanded here.
  useEffect(() => {
    if (selectedSlotId) {
      setExpandedSlotIds(new Set([selectedSlotId]));
    } else {
      setExpandedSlotIds(new Set());
    }
  }, [selectedSlotId]);

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

  const layers = useMemo(
    () => (t > 0 || u > 0 ? buildDayLayers({ slots, tasks: allTasks, baseDate: viewDate, days, todayKey: realTodayKey }) : []),
    [t > 0 || u > 0, slots, allTasks, viewKey, days, realTodayKey],
  );

  // Single-selection: expansion holds at most one slot id at a time so
  // clicking a new wedge collapses any previously-opened one. Toggling
  // the same id closes it.
  const toggleExpanded = useCallback((slotId) => {
    setExpandedSlotIds(prev => {
      if (prev.has(slotId)) return new Set();
      return new Set([slotId]);
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
    const slot = viewSlots.find(s => s.id === id);
    if (slot) onSelectWedge?.(slot);
    let expanding = false;
    setExpandedSlotIds(prev => {
      if (prev.has(id)) {
        // Toggling off the currently-expanded slot.
        return new Set();
      }
      expanding = true;
      // Single-selection: drop any previously-expanded slot.
      return new Set([id]);
    });
    if (expanding) {
      requestAnimationFrame(() => {
        const node = slotRowRefs.current.get(id);
        if (node?.scrollIntoView) {
          node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
  }, [viewSlots, onSelectWedge]);

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

  const center = (() => {
    if (!isToday) {
      return {
        kicker: viewDate.toLocaleDateString('en', { weekday: 'long' }),
        title: viewDate.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        sub: `${viewSlots.length} block${viewSlots.length === 1 ? '' : 's'}`,
      };
    }
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const cur = viewSlots.find(s => {
      const { sMin, eMin } = slotSpan(s);
      const m = nowMin < sMin ? nowMin + DAY_MIN : nowMin;
      return m >= sMin && m < eMin;
    });
    const nextSlot = viewSlots
      .map(s => ({ s, start: hhmmToMin(s.startTime) }))
      .filter(x => x.start > nowMin)
      .sort((a, b) => a.start - b.start)[0]?.s;
    const nextLabel = nextSlot ? `next · ${(nextSlot.label || nextSlot.slotType || 'block').slice(0, 14)} ${fmtHr(hhmmToMin(nextSlot.startTime) / 60)}` : null;
    if (!cur) {
      return { kicker: 'right now', title: 'Free', sub: nextSlot ? `until ${fmtHr(hhmmToMin(nextSlot.startTime) / 60)}` : 'no more blocks today', next: nextLabel };
    }
    const { sMin, eMin } = slotSpan(cur);
    const m = nowMin < sMin ? nowMin + DAY_MIN : nowMin;
    return {
      kicker: 'right now',
      title: cur.label || cur.slotType || 'block',
      sub: `${fmtMinutes(eMin - m)} left · until ${fmtHr((eMin % DAY_MIN) / 60)}`,
      task: nowTask ? (nowTask.text || nowTask.title || null) : null,
      next: nextLabel,
      color: cur.color || null,
    };
  })();

  return (
    <div className="tm-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {viewOverride && (
        <div
          className="tm-wheel-override"
          style={{
            borderColor: viewOverride.color || 'var(--ink-mute)',
            background: `color-mix(in oklab, ${viewOverride.color || 'var(--ink-mute)'} 18%, var(--paper))`,
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

      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div data-onboard="wheel" className="tm-helix-stage">
        <HelixView
          wedges={effectiveWedges}
          slots={viewSlots}
          taskTypes={taskTypes}
          nowHour={isToday ? nowHour : -1}
          tasksBySlotId={tasksBySlotId}
          onWedgeCommit={handleWedgeCommit}
          onWedgeClick={handleWedgeClick}
          onEmptyHourClick={handleEmptyHourClick}
          onNudgeEdge={handleNudgeEdge}
          selectedSlotId={selectedSlotId}
          editingSlotId={editingSlotId}
          onTaskMoveTo={rowHandlers?.onTaskMoveTo}
          center={center}
          t={t}
          u={u}
          days={days}
          layers={layers}
          onPickDate={onPickDate}
        />
        </div>
        {viewSlots.length === 0 && (
          <div className="tm-wheel-empty">
            <div className="tm-caveat" style={{ fontSize: 24, marginBottom: 4 }}>tap the ring to drop a block</div>
            <div className="tm-mono tm-md" style={{ color: 'var(--ink-mute)' }}>
              or use <span className="tm-mono" style={{ color: 'var(--orange)' }}>+ time block</span> below
            </div>
          </div>
        )}
      </div>

      <div className="tm-wheel-toolbar">
        {lens !== 'blocks' && <HelixControls t={t} onT={setT} days={days} onDays={setDays} />}
        <span className="tm-mono tm-sm tm-wheel-count">
          {viewSlots.length} block{viewSlots.length === 1 ? '' : 's'}
          {isToday ? '' : ` · ${viewDate.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }).toLowerCase()}`}
        </span>
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
            title="save this day as a schedule, or pick from the library"
          >
            save day
          </button>
        )}
        <span className="tm-mono tm-sm tm-wheel-hint">
          {u > 0.5
            ? 'the day as a list · click a block for its tasks · drag a block or its handles to move it'
            : t > 0
              ? 'each turn is a day · click a turn to open it · drop a task on any day’s block'
              : 'click a block for its tasks and handles · drag to move · click the empty ring to add'}
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

      {(() => {
        // Always surface task details: every slot that has tasks is shown,
        // plus any empty slot the user manually expanded (so they can still
        // drill into a block to add the first task).
        const shownIds = new Set();
        const panelSlots = [];
        for (const s of viewSlots) {
          const hasTasks = (tasksBySlotId.get?.(s.id) || []).length > 0;
          if (hasTasks || expandedSlotIds.has(s.id)) {
            if (!shownIds.has(s.id)) {
              shownIds.add(s.id);
              panelSlots.push(s);
            }
          }
        }
        if (panelSlots.length === 0) return null;
        return (
          <ExpandedWedgePanel
            slots={panelSlots}
            tasksBySlotId={tasksBySlotId}
            taskTypes={taskTypes}
            renderTaskEntry={renderTaskEntry}
            onCollapse={(id) => toggleExpanded(id)}
            onEditSlot={(id) => {
              setEditingSlotId(id);
              setComposerOpen(false);
              setDraftSlot(null);
            }}
            onTaskMoveTo={rowHandlers?.onTaskMoveTo}
          />
        );
      })()}

      {typeMgrOpen && (
        <SlotTypeManager
          taskTypes={taskTypes}
          api={api}
          onClose={() => setTypeMgrOpen(false)}
        />
      )}

      {pickerOpen && (
        <WheelPickerModal
          wheels={wheels}
          currentWheelId={dayAssignments[viewKey] || null}
          onApply={async (wheelId) => {
            await api.wheels.applyToDate(wheelId, viewKey, { mode: 'replace' });
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
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
      {wedges.map((w, i) => {
        const d = arc(w.startH, w.endH);
        if (!d) return null;
        return (
          <path
            key={w.id ?? `${w.startH}-${i}`}
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
  onTaskMoveTo,
}) {
  // Track which slot card is currently being hovered with a task drag,
  // so we can highlight it as the active drop target. Mirrors the
  // wedge-level visual we already have on the SVG.
  const [dropOverId, setDropOverId] = useState(null);
  if (!slots || slots.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {slots.map(s => {
        const color = s.color || resolveTypeColor(taskTypes, s.slotType) || 'var(--ink)';
        const overnight = isOvernightSlot(s);
        const slotTasks = tasksBySlotId?.get?.(s.id) || [];
        const isDropTarget = dropOverId === s.id;
        return (
          <div
            key={s.id}
            className="tm-card"
            style={{
              padding: '12px 14px',
              borderLeft: `4px solid ${color}`,
              outline: isDropTarget ? '2px dashed var(--orange)' : 'none',
              outlineOffset: isDropTarget ? '2px' : '0',
              transition: 'outline 0.06s',
            }}
            onDragOver={(ev) => {
              if (!ev.dataTransfer.types.includes('text/task-id')) return;
              ev.preventDefault();
              ev.dataTransfer.dropEffect = 'move';
              if (dropOverId !== s.id) setDropOverId(s.id);
            }}
            onDragLeave={(ev) => {
              // Only clear when leaving the card itself, not internal
              // children — relatedTarget tells us where the cursor went.
              if (!ev.currentTarget.contains(ev.relatedTarget)) {
                if (dropOverId === s.id) setDropOverId(null);
              }
            }}
            onDrop={(ev) => {
              const taskId = ev.dataTransfer.getData('text/task-id');
              setDropOverId(null);
              if (taskId && onTaskMoveTo) {
                ev.preventDefault();
                onTaskMoveTo(taskId, s.id);
              }
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
                <button
                  className="tm-btn tm-sm"
                  onClick={() => onEditSlot(s.id)}
                  title="edit block"
                  aria-label="edit block"
                  style={{ fontSize: 16, lineHeight: 1, padding: '2px 8px' }}
                >
                  ⚙
                </button>
                <button className="tm-btn tm-sm" onClick={() => onCollapse(s.id)}>close</button>
              </div>
            </div>
            {isSleepSlot(s) && (
              <SleepCycleHint slot={s} />
            )}
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
