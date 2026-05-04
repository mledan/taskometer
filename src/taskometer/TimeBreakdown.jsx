import React, { useMemo } from 'react';

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
function ymd(d) {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

/**
 * TimeBreakdown — reusable stats card showing where planned time goes.
 *
 * Counts minutes per slotType across a date range, expresses as a
 * percentage of total scheduled time, and renders both a compact
 * stacked bar and a top-N list. Same primitive feeds week / quarter /
 * year / rest-of-life views — each with its own range, same lens.
 *
 * Designed to feel a little Wrapped-y without being kitsch: bold
 * numbers, terse labels, no chart libraries. The user's ask: "good
 * density of integration or controls or even viewing of the schedules
 * over time to see percentage of schedule for task types."
 *
 *   slots:    array of slot objects with date/startTime/endTime/slotType/color/label
 *   range:    { startKey, endKey } — inclusive YYYY-MM-DD strings
 *   taskTypes: array of {id, name, color} for label/color resolution
 *   tasks:    optional, used to count completion rate
 *   title:    section heading, e.g. "This week"
 *   subtitle: small line under title
 *   topN:     how many type rows to render (default 6, rest grouped as "other")
 */
export default function TimeBreakdown({
  slots = [],
  range,
  taskTypes = [],
  tasks = [],
  title = 'Where the time goes',
  subtitle,
  topN = 6,
  emptyHint = 'no schedule painted in this range yet — paint a schedule to see the breakdown.',
}) {
  const { rows, totalMin, daysCount, taskStats } = useMemo(() => {
    if (!range) return { rows: [], totalMin: 0, daysCount: 0, taskStats: { total: 0, done: 0 } };
    const inRange = (s) => s?.date >= range.startKey && s?.date <= range.endKey;
    const filtered = (slots || []).filter(inRange);

    const byType = new Map();
    for (const s of filtered) {
      const min = spanMin(s.startTime, s.endTime);
      const key = s.slotType || s.label || '_unknown';
      if (!byType.has(key)) {
        byType.set(key, { id: key, label: '', color: null, min: 0 });
      }
      const entry = byType.get(key);
      entry.min += min;
      // Prefer slot.color and slot.label over taskType lookups for visual fidelity
      if (!entry.color) entry.color = s.color;
      if (!entry.label) entry.label = s.label || s.slotType || 'block';
    }

    // Resolve type names/colors for ones we know
    for (const [k, v] of byType) {
      const t = taskTypes.find(tt => tt.id === k);
      if (t) {
        v.label = t.name || v.label;
        v.color = v.color || t.color;
      }
    }

    const total = [...byType.values()].reduce((sum, e) => sum + e.min, 0);
    const sorted = [...byType.values()].sort((a, b) => b.min - a.min);

    let rows = sorted.slice(0, topN).map(e => ({
      ...e,
      pct: total > 0 ? Math.round((e.min / total) * 100) : 0,
    }));
    if (sorted.length > topN) {
      const restMin = sorted.slice(topN).reduce((sum, e) => sum + e.min, 0);
      if (restMin > 0) {
        rows.push({
          id: '_other',
          label: `${sorted.length - topN} other`,
          color: 'var(--ink-mute)',
          min: restMin,
          pct: total > 0 ? Math.round((restMin / total) * 100) : 0,
        });
      }
    }

    // Days count: distinct dates in range that have at least one slot
    const dates = new Set(filtered.map(s => s.date));
    const daysCount = dates.size;

    // Task completion within range
    const taskTotal = (tasks || []).filter(t => {
      if (!t?.scheduledTime) return false;
      const k = ymd(new Date(t.scheduledTime));
      return k >= range.startKey && k <= range.endKey && t.status !== 'cancelled';
    });
    const taskStats = {
      total: taskTotal.length,
      done: taskTotal.filter(t => t.status === 'completed').length,
    };

    return { rows, totalMin: total, daysCount, taskStats };
  }, [slots, range, taskTypes, tasks, topN]);

  const hours = totalMin / 60;
  const empty = totalMin === 0;

  return (
    <div
      className="tm-card"
      style={{
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
          {subtitle && (
            <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', marginTop: 2 }}>
              {subtitle}
            </div>
          )}
        </div>
        {!empty && (
          <div
            className="tm-mono tm-sm"
            style={{
              color: 'var(--ink-mute)',
              textAlign: 'right',
              lineHeight: 1.4,
            }}
          >
            <div>
              <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{Math.round(hours)}h</span> scheduled
            </div>
            <div>{daysCount} day{daysCount === 1 ? '' : 's'} · {rows.length} categor{rows.length === 1 ? 'y' : 'ies'}</div>
            {taskStats.total > 0 && (
              <div>
                <span style={{ color: 'var(--orange)', fontWeight: 600 }}>{taskStats.done}</span>
                /{taskStats.total} task{taskStats.total === 1 ? '' : 's'} done
              </div>
            )}
          </div>
        )}
      </div>

      {empty ? (
        <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
          {emptyHint}
        </div>
      ) : (
        <>
          {/* Stacked horizontal bar */}
          <div
            style={{
              display: 'flex',
              height: 12,
              borderRadius: 6,
              overflow: 'hidden',
              background: 'var(--rule-soft)',
            }}
            aria-hidden
          >
            {rows.map(r => (
              <div
                key={r.id}
                title={`${r.label} · ${r.pct}%`}
                style={{
                  width: `${r.pct}%`,
                  background: r.color || 'var(--ink-mute)',
                  transition: 'width 0.18s',
                }}
              />
            ))}
          </div>

          {/* Per-row breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {rows.map(r => (
              <div
                key={r.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: r.color || 'var(--ink-mute)',
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1, minWidth: 0, color: 'var(--ink)' }}>
                  {r.label}
                </span>
                <span
                  className="tm-mono tm-sm"
                  style={{ color: 'var(--ink-mute)', minWidth: 60, textAlign: 'right' }}
                >
                  {Math.round(r.min / 60 * 10) / 10}h
                </span>
                <span
                  style={{
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 600,
                    color: 'var(--ink)',
                    minWidth: 36,
                    textAlign: 'right',
                  }}
                >
                  {r.pct}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
