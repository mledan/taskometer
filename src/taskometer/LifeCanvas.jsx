import React, { useEffect, useMemo, useState } from 'react';
import TimeBreakdown from './TimeBreakdown.jsx';

const LIFE_HORIZON_KEY = 'taskometer.lifeHorizonYears';
const DEFAULT_HORIZON = 50;

function ymd(d) {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

function readHorizon() {
  try {
    const raw = localStorage.getItem(LIFE_HORIZON_KEY);
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0 && n <= 200) return n;
  } catch (_) {}
  return DEFAULT_HORIZON;
}

function writeHorizon(n) {
  try { localStorage.setItem(LIFE_HORIZON_KEY, String(n)); } catch (_) {}
}

/**
 * LifeCanvas — the rest-of-life view.
 *
 * The user said: "let the user decide how long they want to live and
 * let them fill that schedule." So horizon is a preference (default
 * 50 years from now) and we render a row per year. Each row is a
 * mini bar showing how heavily painted that year is.
 *
 * No math, no guesses about life expectancy on our end. The user
 * picks the number and we paint to it. Long horizons stay readable
 * because each row is just one bar.
 */
export default function LifeCanvas({
  slots = [],
  tasks = [],
  taskTypes = [],
  onPickDate,
}) {
  const [horizon, setHorizon] = useState(readHorizon);
  useEffect(() => { writeHorizon(horizon); }, [horizon]);

  const today = useMemo(() => new Date(), []);
  const startYear = today.getFullYear();
  const years = useMemo(() => {
    const out = [];
    for (let i = 0; i < horizon; i++) {
      out.push(startYear + i);
    }
    return out;
  }, [startYear, horizon]);

  const slotsByYear = useMemo(() => {
    const map = new Map();
    for (const s of slots || []) {
      if (!s?.date) continue;
      const y = parseInt(s.date.slice(0, 4), 10);
      if (!Number.isFinite(y)) continue;
      if (!map.has(y)) map.set(y, []);
      map.get(y).push(s);
    }
    return map;
  }, [slots]);

  // Range covering the entire horizon (for the aggregate breakdown).
  const fullRange = useMemo(() => ({
    startKey: `${startYear}-01-01`,
    endKey: `${startYear + horizon - 1}-12-31`,
  }), [startYear, horizon]);

  // The most-painted year tells us the "max" so smaller bars stay legible.
  const peak = useMemo(() => {
    let max = 0;
    for (const list of slotsByYear.values()) {
      if (list.length > max) max = list.length;
    }
    return max;
  }, [slotsByYear]);

  const jumpToYear = (year) => {
    const d = new Date(year, today.getMonth(), 1);
    onPickDate?.(d);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Horizon control */}
      <div
        className="tm-card"
        style={{
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          plan ahead
        </div>
        <input
          type="number"
          className="tm-composer-num"
          min="1"
          max="200"
          step="1"
          value={horizon}
          onChange={(e) => {
            const n = Math.max(1, Math.min(200, parseInt(e.target.value, 10) || DEFAULT_HORIZON));
            setHorizon(n);
          }}
          style={{ width: 80, fontSize: 14 }}
        />
        <span className="tm-mono tm-sm">year{horizon === 1 ? '' : 's'}</span>
        <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', marginLeft: 'auto' }}>
          {startYear} → {startYear + horizon - 1}
        </span>
      </div>

      {/* Aggregate breakdown across the entire horizon */}
      <TimeBreakdown
        slots={slots}
        range={fullRange}
        taskTypes={taskTypes}
        tasks={tasks}
        title="Where life goes"
        subtitle={`${startYear} – ${startYear + horizon - 1} · what you've painted so far`}
        emptyHint="paint a year (or a few) to see where life goes."
      />

      {/* Year strip */}
      <div className="tm-card" style={{ padding: '14px 18px' }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
          Years
        </div>
        <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', marginBottom: 10 }}>
          one row per year. click to jump in.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {years.map(y => {
            const yearSlots = slotsByYear.get(y) || [];
            const fillPct = peak > 0 ? Math.round((yearSlots.length / peak) * 100) : 0;
            const isCurrent = y === startYear;
            return (
              <button
                key={y}
                type="button"
                onClick={() => jumpToYear(y)}
                title={`${y} · ${yearSlots.length} block${yearSlots.length === 1 ? '' : 's'} painted`}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  display: 'grid',
                  gridTemplateColumns: '60px 1fr 80px',
                  alignItems: 'center',
                  gap: 10,
                  padding: '4px 0',
                }}
              >
                <span
                  className="tm-mono tm-sm"
                  style={{
                    color: isCurrent ? 'var(--orange)' : 'var(--ink)',
                    fontWeight: isCurrent ? 700 : 500,
                    fontSize: 13,
                  }}
                >
                  {y}{isCurrent ? ' ·' : ''}
                </span>
                <div
                  style={{
                    height: 8,
                    borderRadius: 4,
                    background: 'var(--rule-soft)',
                    overflow: 'hidden',
                  }}
                  aria-hidden
                >
                  <div
                    style={{
                      width: `${Math.max(yearSlots.length > 0 ? 4 : 0, fillPct)}%`,
                      height: '100%',
                      background: isCurrent ? 'var(--orange)' : 'var(--ink)',
                      opacity: isCurrent ? 1 : 0.6,
                      transition: 'width 0.18s',
                    }}
                  />
                </div>
                <span
                  className="tm-mono tm-sm"
                  style={{ color: 'var(--ink-mute)', textAlign: 'right', fontSize: 12 }}
                >
                  {yearSlots.length > 0 ? `${yearSlots.length} block${yearSlots.length === 1 ? '' : 's'}` : '—'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
