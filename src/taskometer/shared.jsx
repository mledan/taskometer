import React from 'react';
import { TASK_PRIORITIES } from '../models/Task';

export function PriorityDot({ priority, size = 10 }) {
  if (!priority || priority === 'medium') return null;
  const info = TASK_PRIORITIES[priority];
  if (!info) return null;
  return (
    <span
      title={`${info.name} priority`}
      aria-label={`${info.name} priority`}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: info.color,
        border: `1.5px solid ${info.color}`,
        flexShrink: 0,
      }}
    />
  );
}

export function TagChip({ tag }) {
  if (!tag) return null;
  return (
    <span
      className="tm-mono tm-sm"
      style={{
        border: '1px solid var(--rule)',
        color: 'var(--ink-soft)',
        padding: '0 6px',
        borderRadius: 4,
        background: 'var(--paper-warm)',
      }}
    >
      #{tag}
    </span>
  );
}

export function RepeatBadge({ recurrence }) {
  const freq = recurrence?.frequency;
  if (!freq || freq === 'none') return null;
  const n = recurrence?.interval || 1;
  const label = freq === 'daily' ? (n === 1 ? 'daily' : `every ${n}d`)
    : freq === 'weekly' ? (n === 1 ? 'weekly' : `every ${n}w`)
    : freq === 'monthly' ? (n === 1 ? 'monthly' : `every ${n}mo`)
    : freq;
  return (
    <span
      className="tm-mono tm-sm"
      title="repeats"
      style={{
        color: 'var(--sage)',
        border: '1px solid var(--sage)',
        padding: '0 6px',
        borderRadius: 4,
      }}
    >
      ↻ {label}
    </span>
  );
}

export function Check({ checked, onToggle, size = 18 }) {
  return (
    <div
      className={`tm-ck${checked ? ' tm-checked' : ''}`}
      style={{ width: size, height: size }}
      onClick={(e) => { e.stopPropagation(); onToggle && onToggle(); }}
      role="checkbox"
      aria-checked={!!checked}
      tabIndex={0}
    />
  );
}

export function Pill({ children, kind = 'now' }) {
  return (
    <span className={kind === 'now' ? 'tm-now-pill' : 'tm-tmw-pill'}>{children}</span>
  );
}

export function Doodle({ kind = 'star', size = 22, color = 'var(--ink-mute)' }) {
  const paths = {
    star: <path d="M11 2 L13 9 L20 11 L13 13 L11 20 L9 13 L2 11 L9 9 Z" fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />,
    spark: (
      <g stroke={color} strokeWidth="1.3" fill="none" strokeLinecap="round">
        <path d="M11 2 L11 20" />
        <path d="M2 11 L20 11" />
        <path d="M4 4 L18 18" />
        <path d="M4 18 L18 4" />
      </g>
    ),
    swirl: <path d="M4 12 C4 6, 18 6, 18 12 C18 18, 8 18, 8 12 C8 8, 14 8, 14 12" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" />,
    arrow: (
      <g stroke={color} strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11 L18 11" />
        <path d="M13 6 L18 11 L13 16" />
      </g>
    ),
    warn: (
      <g stroke={color} strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 3 L20 19 L2 19 Z" />
        <path d="M11 9 L11 13" />
        <circle cx="11" cy="16" r=".6" fill={color} />
      </g>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      {paths[kind]}
    </svg>
  );
}

export function TaskRow({
  task,
  onToggle,
  rightSlot,
  compact = false,
  onClick,
  titleOverride,
  metaOverride,
  onEdit,
  onDelete,
  onSeriesComplete,
  onSeriesDelete,
  onSeriesBump,
}) {
  const isNow = !!task.now;
  const isPushed = task.status === 'pushed';
  const cls = [
    'tm-task-row',
    isNow ? 'tm-now-row' : '',
    isPushed ? 'tm-pushed-row' : '',
    compact ? 'tm-compact' : '',
  ].filter(Boolean).join(' ');

  const inSeries = task.seriesId && (task.segmentsTotal || 0) > 1;

  const actions = (onEdit || onDelete || inSeries) ? (
    <div className="tm-row-actions" onClick={(e) => e.stopPropagation()}>
      {onEdit && (
        <button onClick={() => onEdit(task.id)} title="edit">edit</button>
      )}
      {inSeries && onSeriesComplete && (
        <button
          onClick={() => onSeriesComplete(task.id)}
          title={`complete all ${task.segmentsTotal} parts of this task`}
        >✓ all</button>
      )}
      {inSeries && onSeriesBump && (
        <button
          onClick={() => onSeriesBump(task.id, 1)}
          title={`push the whole series 1 day later`}
        >+1d</button>
      )}
      {inSeries && onSeriesDelete && (
        <button
          className="tm-del"
          onClick={() => onSeriesDelete(task.id)}
          title={`delete all ${task.segmentsTotal} parts of this task`}
        >× all</button>
      )}
      {onDelete && (
        <button className="tm-del" onClick={() => onDelete(task.id)} title="delete this segment">×</button>
      )}
    </div>
  ) : null;

  return (
    <div
      className={cls}
      onClick={onClick}
      draggable
      onDragStart={(e) => {
        // Stash the task id on the dataTransfer payload so drop targets
        // (wedges in the wheel, slot headers in the expansion panel)
        // can identify what was dropped without prop drilling.
        e.dataTransfer.setData('text/task-id', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      style={{ cursor: onClick ? 'pointer' : 'grab' }}
    >
      <Check checked={!!task.done} onToggle={() => onToggle && onToggle(task.id)} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className={`tm-task-title${task.done ? ' tm-done' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <PriorityDot priority={task.priority} />
          <span>{titleOverride || task.title}</span>
        </div>
        <div className="tm-mono tm-task-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          <span>{task.ctx}</span>
          <span>·</span>
          <span>{task.when}</span>
          {task.warn ? (
            <>
              <span>·</span>
              <Doodle kind="warn" size={12} color="var(--orange)" />
            </>
          ) : null}
          {task.recurrence && task.recurrence.frequency && task.recurrence.frequency !== 'none' ? (
            <RepeatBadge recurrence={task.recurrence} />
          ) : null}
          {Array.isArray(task.tags) && task.tags.length > 0
            ? task.tags.slice(0, 3).map(t => <TagChip key={t} tag={t} />)
            : null}
          {metaOverride ? <span>· {metaOverride}</span> : null}
        </div>
      </div>
      {rightSlot !== undefined ? rightSlot : (
        <>
          {isNow && <Pill kind="now">now</Pill>}
          {isPushed && <Pill kind="tmw">→ tmw</Pill>}
          {actions}
        </>
      )}
    </div>
  );
}

export function SectionLabel({ children, right }) {
  return (
    <div className="tm-section-label">
      <span className="tm-lbl">{children}</span>
      {right != null && <span className="tm-rt">{right}</span>}
    </div>
  );
}

/**
 * Adapt an AppContext task (rich domain model) into the lightweight
 * shape the Taskometer views expect. Falls back to sensible defaults.
 */
export function adaptTask(t, idx = 0) {
  if (!t) return null;

  const statusMap = {
    pending: 'open',
    paused: 'pushed',
    completed: 'done',
    cancelled: 'dropped',
  };
  const ctx = t.ctx || t.primaryType || t.taskType || 'work';
  const when = t.when || (t.scheduledTime ? formatWhen(t.scheduledTime) : 'unscheduled');
  const est = t.est || t.duration || 30;

  return {
    id: t.id || t.key || `t-${idx}`,
    title: t.title || t.text || 'untitled',
    ctx,
    when,
    slot: t.slot || ctx,
    status: t.status === 'completed' ? 'done' : (statusMap[t.status] || t.status || 'open'),
    done: t.status === 'completed' || !!t.done,
    now: !!t.now,
    est,
    note: t.note || t.description || null,
    warn: !!t.warn,
    priority: t.priority,
    tags: t.tags,
    recurrence: t.recurrence,
    seriesId: t.metadata?.seriesId || null,
    segmentIndex: t.metadata?.segmentIndex,
    segmentsTotal: t.metadata?.segmentsTotal,
  };
}

function formatWhen(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'unscheduled';
    const h = d.getHours();
    const hr = ((h % 12) || 12);
    const ampm = h < 12 ? 'a' : 'p';
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    const tmw = new Date(today); tmw.setDate(tmw.getDate() + 1);
    const isTmw = d.toDateString() === tmw.toDateString();
    const prefix = sameDay ? 'today' : isTmw ? 'tmw' : d.toLocaleDateString('en', { weekday: 'short' }).toLowerCase();
    return `${prefix} ${hr}${ampm}`;
  } catch (_) {
    return 'unscheduled';
  }
}
