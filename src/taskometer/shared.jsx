import React from 'react';

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

export function TaskRow({ task, onToggle, rightSlot, compact = false, onClick, titleOverride, metaOverride }) {
  const isNow = !!task.now;
  const isPushed = task.status === 'pushed';
  const cls = [
    'tm-task-row',
    isNow ? 'tm-now-row' : '',
    isPushed ? 'tm-pushed-row' : '',
    compact ? 'tm-compact' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cls}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <Check checked={!!task.done} onToggle={() => onToggle && onToggle(task.id)} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className={`tm-task-title${task.done ? ' tm-done' : ''}`}>
          {titleOverride || task.title}
        </div>
        <div className="tm-mono tm-task-meta">
          <span>{task.ctx}</span>
          <span>·</span>
          <span>{task.when}</span>
          {task.warn ? (
            <>
              <span>·</span>
              <Doodle kind="warn" size={12} color="var(--orange)" />
            </>
          ) : null}
          {metaOverride ? <span>· {metaOverride}</span> : null}
        </div>
      </div>
      {rightSlot !== undefined
        ? rightSlot
        : (isNow
          ? <Pill kind="now">now</Pill>
          : (isPushed ? <Pill kind="tmw">→ tmw</Pill> : null))}
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

/* Sample / fallback task list for demos when the store is empty */
export const SAMPLE_TASKS = [
  { id: 't1', title: 'finish Q2 planning doc', ctx: 'deep work', when: 'today 11a', slot: 'deep', status: 'in-progress', note: 'left off at § "risks" · est 45m remaining', now: true, est: 45 },
  { id: 't2', title: 'reply to Sam re: contract', ctx: 'deep work', when: 'today 11a', slot: 'deep', status: 'open', est: 10 },
  { id: 't3', title: 'review PRs', ctx: 'admin', when: 'tmw 4p', slot: 'admin', status: 'open', est: 30 },
  { id: 't4', title: 'groceries for week', ctx: 'errands', when: 'today 6p', slot: 'errands', status: 'open', est: 25 },
  { id: 't5', title: 'draft blog post outline', ctx: 'deep work', when: 'tmw 9a', slot: 'deep', status: 'pushed', est: 60 },
  { id: 't6', title: 'call mom', ctx: 'calls', when: 'tmw 7p', slot: 'calls', status: 'pushed', est: 20 },
  { id: 't7', title: "plan Josie's birthday", ctx: 'play', when: 'sat 10a', slot: 'play', status: 'open', est: 45 },
  { id: 't8', title: 'fix leaky faucet', ctx: 'admin', when: 'wed 4p', slot: 'admin', status: 'open', est: 30 },
  { id: 't9', title: 'research new laptop', ctx: 'admin', when: 'no matching slot', slot: null, status: 'unfit', est: 30, warn: true },
];

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
