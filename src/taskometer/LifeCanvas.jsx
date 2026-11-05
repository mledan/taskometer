import { useEffect, useMemo, useState } from 'react';
import TimeBreakdown from './TimeBreakdown.jsx';
import { storage } from '../services/storage.js';
import './screens.css';

const LIFE_HORIZON_KEY = 'taskometer.lifeHorizonYears';
const DEFAULT_HORIZON = 50;

function readHorizon() {
  const n = parseInt(storage.getRaw(LIFE_HORIZON_KEY), 10);
  return Number.isFinite(n) && n > 0 && n <= 200 ? n : DEFAULT_HORIZON;
}

/**
 * LifeCanvas — one row per year up to a horizon the user picks. Drag
 * across years to paint the active material over whole years.
 */
export default function LifeCanvas({
  slots = [],
  tasks = [],
  taskTypes = [],
  onPickDate,
  onPaintRange,
}) {
  const [horizon, setHorizon] = useState(readHorizon);
  useEffect(() => { storage.setRaw(LIFE_HORIZON_KEY, String(horizon)); }, [horizon]);

  const [lassoAnchor, setLassoAnchor] = useState(null);
  const [lassoEnd, setLassoEnd] = useState(null);
  const lassoActive = lassoAnchor != null && lassoEnd != null;
  const lassoSet = useMemo(() => {
    if (!lassoActive) return new Set();
    const set = new Set();
    for (let y = Math.min(lassoAnchor, lassoEnd); y <= Math.max(lassoAnchor, lassoEnd); y++) set.add(y);
    return set;
  }, [lassoAnchor, lassoEnd, lassoActive]);

  useEffect(() => {
    if (lassoAnchor == null) return undefined;
    const onUp = () => {
      if (lassoAnchor != null && lassoEnd != null) {
        onPaintRange?.(`${Math.min(lassoAnchor, lassoEnd)}-01-01`, `${Math.max(lassoAnchor, lassoEnd)}-12-31`);
      }
      setLassoAnchor(null);
      setLassoEnd(null);
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [lassoAnchor, lassoEnd, onPaintRange]);

  const today = useMemo(() => new Date(), []);
  const startYear = today.getFullYear();
  const years = useMemo(() => Array.from({ length: horizon }, (_, i) => startYear + i), [startYear, horizon]);

  const slotsByYear = useMemo(() => {
    const map = new Map();
    for (const s of slots) {
      const y = parseInt((s?.date || '').slice(0, 4), 10);
      if (!Number.isFinite(y)) continue;
      if (!map.has(y)) map.set(y, []);
      map.get(y).push(s);
    }
    return map;
  }, [slots]);

  const fullRange = useMemo(() => ({ startKey: `${startYear}-01-01`, endKey: `${startYear + horizon - 1}-12-31` }), [startYear, horizon]);
  const peak = useMemo(() => Math.max(0, ...[...slotsByYear.values()].map(l => l.length)), [slotsByYear]);

  return (
    <div className="tm-screen">
      <div className="tm-card tm-life-horizon">
        <span className="tm-picker-eyebrow">plan ahead</span>
        <input
          type="number"
          className="tm-composer-num"
          min="1"
          max="200"
          step="1"
          value={horizon}
          aria-label="years to plan"
          onChange={(e) => setHorizon(Math.max(1, Math.min(200, parseInt(e.target.value, 10) || DEFAULT_HORIZON)))}
        />
        <span className="tm-mono tm-sm">year{horizon === 1 ? '' : 's'}</span>
        <span className="tm-mono tm-sm tm-life-span">{startYear} → {startYear + horizon - 1} · drag across years to paint</span>
      </div>

      <div className="tm-card">
        <div className="tm-life-years" role="list" aria-label="years">
          {years.map(y => {
            const yearSlots = slotsByYear.get(y) || [];
            const fillPct = peak > 0 ? Math.round((yearSlots.length / peak) * 100) : 0;
            const cls = [
              'tm-life-year',
              y === startYear ? 'tm-current' : '',
              lassoSet.has(y) ? 'tm-lasso' : '',
              lassoAnchor != null ? 'tm-lassoing' : '',
            ].filter(Boolean).join(' ');
            return (
              <div
                key={y}
                role="listitem"
                tabIndex={0}
                className={cls}
                onClick={() => { if (!lassoActive) onPickDate?.(new Date(y, today.getMonth(), 1)); }}
                onKeyDown={(e) => { if (e.key === 'Enter') onPickDate?.(new Date(y, today.getMonth(), 1)); }}
                onMouseDown={(e) => {
                  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || !onPaintRange) return;
                  setLassoAnchor(y);
                  setLassoEnd(y);
                }}
                onMouseEnter={() => { if (lassoAnchor != null) setLassoEnd(y); }}
                title={`${y} · ${yearSlots.length} block${yearSlots.length === 1 ? '' : 's'} painted · click to open`}
              >
                <span className="tm-life-year-label">{y}</span>
                <div className="tm-life-bar" aria-hidden>
                  <div style={{ width: `${Math.max(yearSlots.length > 0 ? 4 : 0, fillPct)}%` }} />
                </div>
                <span className="tm-life-count">{yearSlots.length > 0 ? `${yearSlots.length} block${yearSlots.length === 1 ? '' : 's'}` : '—'}</span>
              </div>
            );
          })}
        </div>
      </div>

      <TimeBreakdown
        slots={slots}
        range={fullRange}
        taskTypes={taskTypes}
        tasks={tasks}
        title="Where life goes"
        subtitle={`${startYear} – ${startYear + horizon - 1} · what you've painted so far`}
        emptyHint="paint a year (or a few) to see where life goes."
      />
    </div>
  );
}
