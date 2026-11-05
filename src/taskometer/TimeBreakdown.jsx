import { useMemo, useState } from 'react';
import { formatYMD } from '../utils/time.js';
import './screens.css';

const DAY_MIN = 24 * 60;
function hhmmToMin(s) {
  if (!s) return 0;
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
function spanMin(startTime, endTime) {
  const s = hhmmToMin(startTime);
  const e = hhmmToMin(endTime);
  return e <= s ? e + DAY_MIN - s : e - s;
}

/**
 * TimeBreakdown — where planned time goes across a date range. The
 * header and stacked bar are always visible; the per-category rows
 * open on click so the card reads as a one-line summary by default.
 */
export default function TimeBreakdown({
  slots = [],
  range,
  taskTypes = [],
  tasks = [],
  title = 'Where the time goes',
  subtitle,
  topN = 6,
  defaultOpen = false,
  emptyHint = 'no schedule painted in this range yet — paint one to see the breakdown.',
}) {
  const [open, setOpen] = useState(defaultOpen);

  const { rows, totalMin, daysCount, taskStats } = useMemo(() => {
    if (!range) return { rows: [], totalMin: 0, daysCount: 0, taskStats: { total: 0, done: 0 } };
    const filtered = (slots || []).filter(s => s?.date >= range.startKey && s?.date <= range.endKey);

    const byType = new Map();
    for (const s of filtered) {
      const key = s.slotType || s.label || '_unknown';
      if (!byType.has(key)) byType.set(key, { id: key, label: '', color: null, min: 0 });
      const entry = byType.get(key);
      entry.min += spanMin(s.startTime, s.endTime);
      if (!entry.color) entry.color = s.color;
      if (!entry.label) entry.label = s.label || s.slotType || 'block';
    }
    for (const [k, v] of byType) {
      const t = taskTypes.find(tt => tt.id === k);
      if (t) { v.label = t.name || v.label; v.color = v.color || t.color; }
    }

    const total = [...byType.values()].reduce((sum, e) => sum + e.min, 0);
    const sorted = [...byType.values()].sort((a, b) => b.min - a.min);
    const rows = sorted.slice(0, topN).map(e => ({ ...e, pct: total > 0 ? Math.round((e.min / total) * 100) : 0 }));
    if (sorted.length > topN) {
      const restMin = sorted.slice(topN).reduce((sum, e) => sum + e.min, 0);
      if (restMin > 0) {
        rows.push({ id: '_other', label: `${sorted.length - topN} other`, color: 'var(--ink-mute)', min: restMin, pct: total > 0 ? Math.round((restMin / total) * 100) : 0 });
      }
    }

    const inRange = (tasks || []).filter(t => {
      if (!t?.scheduledTime || t.status === 'cancelled') return false;
      const k = formatYMD(new Date(t.scheduledTime));
      return k >= range.startKey && k <= range.endKey;
    });

    return {
      rows,
      totalMin: total,
      daysCount: new Set(filtered.map(s => s.date)).size,
      taskStats: { total: inRange.length, done: inRange.filter(t => t.status === 'completed').length },
    };
  }, [slots, range, taskTypes, tasks, topN]);

  const empty = totalMin === 0;

  return (
    <div className={`tm-card tm-breakdown${open ? ' tm-open' : ''}`}>
      <button
        type="button"
        className="tm-breakdown-head"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        disabled={empty}
      >
        <div>
          <div className="tm-breakdown-title">
            {!empty && <span className="tm-breakdown-caret" aria-hidden>▶</span>}
            {title}
          </div>
          {subtitle && <div className="tm-mono tm-sm tm-breakdown-sub">{subtitle}</div>}
        </div>
        {!empty && (
          <div className="tm-mono tm-sm tm-breakdown-stats">
            <div><strong>{Math.round(totalMin / 60)}h</strong> scheduled · {daysCount} day{daysCount === 1 ? '' : 's'} · {rows.length} categor{rows.length === 1 ? 'y' : 'ies'}</div>
            {taskStats.total > 0 && (
              <div><span className="tm-accent">{taskStats.done}</span>/{taskStats.total} task{taskStats.total === 1 ? '' : 's'} done</div>
            )}
          </div>
        )}
      </button>

      {empty ? (
        <div className="tm-mono tm-sm tm-breakdown-empty">{emptyHint}</div>
      ) : (
        <>
          <div className="tm-breakdown-bar" aria-hidden>
            {rows.map(r => (
              <div key={r.id} title={`${r.label} · ${r.pct}%`} style={{ width: `${r.pct}%`, background: r.color || 'var(--ink-mute)' }} />
            ))}
          </div>
          {open && (
            <div className="tm-breakdown-rows">
              {rows.map(r => (
                <div key={r.id} className="tm-breakdown-row">
                  <span aria-hidden className="tm-breakdown-swatch" style={{ background: r.color || 'var(--ink-mute)' }} />
                  <span className="tm-breakdown-label">{r.label}</span>
                  <span className="tm-mono tm-sm tm-breakdown-hours">{Math.round(r.min / 60 * 10) / 10}h</span>
                  <span className="tm-breakdown-pct">{r.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
