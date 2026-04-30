import React, { useEffect, useMemo, useState } from 'react';
import { MiniWheel } from './WheelView.jsx';

/**
 * Painter modal — apply one wheel to a date range with day-of-week
 * filtering. The fast path for "make every weekday in May my Workday."
 *
 * Range presets cover the common cases (this week / this month / next 30
 * days). Day filter picks which weekdays count. Live "paint N days"
 * counter on the apply button so the user knows the blast radius
 * before pulling the trigger.
 */

function ymd(d) {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}
function startOfWeek(d) {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function addDays(d, n)   { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function WheelPainter({ wheel, anchorDate, onClose, onApply }) {
  const today = useMemo(() => new Date(), []);
  const anchor = anchorDate instanceof Date ? anchorDate : today;

  const [range, setRange] = useState('this-month'); // preset key
  const [customStart, setCustomStart] = useState(ymd(anchor));
  const [customEnd, setCustomEnd] = useState(ymd(addDays(anchor, 30)));
  const [dowFilter, setDowFilter] = useState('weekdays'); // all | weekdays | weekends | custom
  const [activeDow, setActiveDow] = useState(new Set([0, 1, 2, 3, 4])); // Mon-Fri default
  const [mode, setMode] = useState('replace');
  const [busy, setBusy] = useState(false);

  // Resolve the range bounds from the chosen preset.
  const { start, end } = useMemo(() => {
    if (range === 'today') {
      return { start: anchor, end: anchor };
    }
    if (range === 'this-week') {
      const s = startOfWeek(anchor);
      return { start: s, end: addDays(s, 6) };
    }
    if (range === 'this-month') {
      return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
    }
    if (range === 'next-30') {
      return { start: anchor, end: addDays(anchor, 29) };
    }
    if (range === 'next-90') {
      return { start: anchor, end: addDays(anchor, 89) };
    }
    // custom
    const [sy, sm, sd] = customStart.split('-').map(Number);
    const [ey, em, ed] = customEnd.split('-').map(Number);
    return {
      start: new Date(sy, sm - 1, sd),
      end: new Date(ey, em - 1, ed),
    };
  }, [range, customStart, customEnd, anchor]);

  // Days that will actually be painted, after the day-of-week filter.
  const plannedDates = useMemo(() => {
    const out = [];
    const cur = new Date(start); cur.setHours(0, 0, 0, 0);
    const last = new Date(end); last.setHours(0, 0, 0, 0);
    while (cur.getTime() <= last.getTime()) {
      const dow = (cur.getDay() + 6) % 7; // 0=Mon..6=Sun
      const isWeekend = dow >= 5;
      const passes = (
        dowFilter === 'all' ||
        (dowFilter === 'weekdays' && !isWeekend) ||
        (dowFilter === 'weekends' && isWeekend) ||
        (dowFilter === 'custom' && activeDow.has(dow))
      );
      if (passes) out.push(ymd(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }, [start, end, dowFilter, activeDow]);

  const slotsForMini = (wheel?.blocks || []).map(b => ({
    startTime: b.startTime, endTime: b.endTime, color: b.color,
  }));

  const handleApply = async () => {
    if (busy || plannedDates.length === 0) return;
    setBusy(true);
    try {
      await onApply({
        startDate: ymd(start),
        endDate: ymd(end),
        weekdaysOnly: dowFilter === 'weekdays',
        weekendsOnly: dowFilter === 'weekends',
        customDow: dowFilter === 'custom' ? Array.from(activeDow) : null,
        mode,
        plannedDates,
      });
    } finally {
      setBusy(false);
    }
  };

  // Esc to close.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggleDow = (i) => {
    setActiveDow(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  return (
    <div className="tm-modal-backdrop" onMouseDown={onClose} role="dialog" aria-label={`paint ${wheel?.name || 'wheel'} across a range`}>
      <div
        className="tm-modal"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: 560, width: 'min(560px, 94vw)' }}
      >
        <div className="tm-modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <MiniWheel slots={slotsForMini} size={48} thickness={6} />
            <div>
              <div className="tm-modal-title" style={{ marginBottom: 2 }}>
                Paint "{wheel?.name || 'wheel'}"
              </div>
              <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
                {(wheel?.blocks || []).length} blocks
              </div>
            </div>
          </div>
          <button type="button" className="tm-btn tm-sm" onClick={onClose}>close</button>
        </div>

        {/* Range preset ─────────────────────────────────────────────── */}
        <PainterSection title="Time range">
          <div className="tm-seg" style={{ flexWrap: 'wrap' }}>
            {[
              ['today', 'Today'],
              ['this-week', 'This week'],
              ['this-month', 'This month'],
              ['next-30', 'Next 30 days'],
              ['next-90', 'Next 90 days'],
              ['custom', 'Custom'],
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={range === k ? 'tm-on' : ''}
                onClick={() => setRange(k)}
              >{label}</button>
            ))}
          </div>
          {range === 'custom' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
              <input
                type="date"
                className="tm-composer-num"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                style={{ width: 160 }}
              />
              <span className="tm-mono tm-md">–</span>
              <input
                type="date"
                className="tm-composer-num"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                style={{ width: 160 }}
              />
            </div>
          )}
          <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', marginTop: 8 }}>
            {start.toLocaleDateString('en', { month: 'short', day: 'numeric' })}
            {' → '}
            {end.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </PainterSection>

        {/* Day-of-week filter ───────────────────────────────────────── */}
        <PainterSection title="Which days">
          <div className="tm-seg">
            {[
              ['all', 'Every day'],
              ['weekdays', 'Weekdays'],
              ['weekends', 'Weekends'],
              ['custom', 'Pick days'],
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={dowFilter === k ? 'tm-on' : ''}
                onClick={() => setDowFilter(k)}
              >{label}</button>
            ))}
          </div>
          {dowFilter === 'custom' && (
            <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
              {DOW_LABELS.map((label, i) => {
                const on = activeDow.has(i);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleDow(i)}
                    className={`tm-btn tm-sm${on ? ' tm-primary' : ''}`}
                    style={{ minWidth: 48 }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </PainterSection>

        {/* Replace vs. merge ─────────────────────────────────────────── */}
        <PainterSection title="Existing blocks">
          <div className="tm-seg">
            <button
              type="button"
              className={mode === 'replace' ? 'tm-on' : ''}
              onClick={() => setMode('replace')}
              title="clear existing blocks on each painted day before applying"
            >Replace</button>
            <button
              type="button"
              className={mode === 'merge' ? 'tm-on' : ''}
              onClick={() => setMode('merge')}
              title="layer new blocks on top of any existing ones"
            >Merge</button>
          </div>
          <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', marginTop: 6 }}>
            {mode === 'replace'
              ? 'Days you paint will be cleared first, then filled with this wheel\'s blocks.'
              : 'New blocks layer on top — existing blocks are preserved.'}
          </div>
          <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', marginTop: 4 }}>
            Days marked sick / holiday / vacation are skipped automatically.
          </div>
        </PainterSection>

        {/* Apply ──────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginTop: 8,
          paddingTop: 14,
          borderTop: '1px dashed var(--rule)',
        }}>
          <div className="tm-mono tm-md" style={{ color: 'var(--ink)' }}>
            <strong>{plannedDates.length}</strong> day{plannedDates.length === 1 ? '' : 's'} will be painted
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="tm-btn" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="tm-btn tm-primary"
              onClick={handleApply}
              disabled={busy || plannedDates.length === 0}
            >
              {busy ? 'painting…' : `Paint ${plannedDates.length} day${plannedDates.length === 1 ? '' : 's'} →`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PainterSection({ title, children }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div className="tm-mono tm-sm" style={{
        color: 'var(--ink-mute)',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        marginBottom: 8,
        fontWeight: 600,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}
