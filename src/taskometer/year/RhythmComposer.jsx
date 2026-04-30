import React, { useEffect, useState } from 'react';
import { addRhythm, updateRhythm } from '../../services/rhythms.js';

/**
 * Modal for creating or editing a Rhythm. The cadence form swaps based
 * on `kind` so each cadence shows only its relevant fields.
 *
 * Saves to localStorage via rhythms.js — no API roundtrip.
 */
const PALETTE = [
  '#D4663A', '#A8BF8C', '#D9C98C', '#C7BEDD', '#F2C4A6',
  '#6B46C1', '#3B82F6', '#10B981', '#EC4899', '#F59E0B',
];

const DAYS = [
  { v: 1, l: 'Mon' },
  { v: 2, l: 'Tue' },
  { v: 3, l: 'Wed' },
  { v: 4, l: 'Thu' },
  { v: 5, l: 'Fri' },
  { v: 6, l: 'Sat' },
  { v: 0, l: 'Sun' },
];

const NTH = [
  { v: 1, l: '1st' },
  { v: 2, l: '2nd' },
  { v: 3, l: '3rd' },
  { v: 4, l: '4th' },
  { v: -1, l: 'last' },
];

function todayYMD() {
  const d = new Date();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

export default function RhythmComposer({ rhythm, onClose, onSaved }) {
  const editing = !!rhythm;
  const [name, setName] = useState(rhythm?.name || '');
  const [color, setColor] = useState(rhythm?.color || PALETTE[0]);
  const [kind, setKind] = useState(rhythm?.cadence?.kind || 'weekly');
  const [dayOfWeek, setDayOfWeek] = useState(rhythm?.cadence?.dayOfWeek ?? 2);
  const [nth, setNth] = useState(rhythm?.cadence?.nth ?? 1);
  const [monthDate, setMonthDate] = useState(rhythm?.cadence?.monthDate ?? 15);
  const [weekOfQuarter, setWeekOfQuarter] = useState(rhythm?.cadence?.weekOfQuarter ?? 1);
  const [anchor, setAnchor] = useState(rhythm?.cadence?.anchor || todayYMD());
  const [end, setEnd] = useState(rhythm?.cadence?.end || todayYMD());
  const [startTime, setStartTime] = useState(rhythm?.startTime || '09:00');
  const [endTime, setEndTime] = useState(rhythm?.endTime || '10:00');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = () => {
    if (!name.trim()) return;
    const cadence = { kind };
    if (kind === 'weekly' || kind === 'biweekly' || kind === 'monthly_nth') cadence.dayOfWeek = dayOfWeek;
    if (kind === 'biweekly') cadence.anchor = anchor;
    if (kind === 'monthly_nth') cadence.nth = nth;
    if (kind === 'monthly_date') cadence.monthDate = monthDate;
    if (kind === 'quarterly_week') cadence.weekOfQuarter = weekOfQuarter;
    if (kind === 'project') { cadence.anchor = anchor; cadence.end = end; }
    if (kind === 'oneoff') cadence.anchor = anchor;

    const payload = {
      name: name.trim(),
      color,
      cadence,
      startTime,
      endTime,
    };

    if (editing) updateRhythm(rhythm.id, payload);
    else addRhythm(payload);
    onSaved?.();
  };

  return (
    <div className="tm-modal-backdrop" onMouseDown={onClose} role="dialog" aria-label="rhythm composer">
      <div
        className="tm-modal"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: 580, width: 'min(580px, 94vw)' }}
      >
        <div className="tm-modal-head">
          <div className="tm-modal-title">{editing ? 'Edit rhythm' : 'New rhythm'}</div>
          <button type="button" className="tm-btn tm-sm" onClick={onClose}>close</button>
        </div>

        <Section title="Name & color">
          <input
            className="tm-composer-input"
            placeholder="e.g. All-hands, Sprint retro, Monthly review"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            style={{ width: '100%', fontSize: 16, padding: '8px 10px', marginBottom: 8 }}
          />
          <div className="tm-palette">
            {PALETTE.map(c => (
              <button
                key={c}
                type="button"
                className={`tm-swatch${color === c ? ' tm-swatch-on' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={`color ${c}`}
              />
            ))}
          </div>
        </Section>

        <Section title="Cadence">
          <div className="tm-seg" style={{ flexWrap: 'wrap' }}>
            {[
              ['weekly', 'Weekly'],
              ['biweekly', 'Biweekly'],
              ['monthly_nth', 'Monthly (Nth)'],
              ['monthly_date', 'Monthly (date)'],
              ['quarterly_week', 'Quarterly'],
              ['project', 'Project'],
              ['oneoff', 'One-off'],
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={kind === k ? 'tm-on' : ''}
                onClick={() => setKind(k)}
              >{label}</button>
            ))}
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {(kind === 'weekly' || kind === 'biweekly' || kind === 'monthly_nth') && (
              <div className="tm-seg">
                {DAYS.map(d => (
                  <button
                    key={d.v}
                    type="button"
                    className={dayOfWeek === d.v ? 'tm-on' : ''}
                    onClick={() => setDayOfWeek(d.v)}
                  >{d.l}</button>
                ))}
              </div>
            )}

            {kind === 'biweekly' && (
              <label className="tm-mono tm-md" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                anchor:
                <input
                  type="date"
                  className="tm-composer-num"
                  value={anchor}
                  onChange={(e) => setAnchor(e.target.value)}
                  style={{ width: 160 }}
                />
              </label>
            )}

            {kind === 'monthly_nth' && (
              <div className="tm-seg">
                {NTH.map(n => (
                  <button
                    key={n.v}
                    type="button"
                    className={nth === n.v ? 'tm-on' : ''}
                    onClick={() => setNth(n.v)}
                  >{n.l}</button>
                ))}
              </div>
            )}

            {kind === 'monthly_date' && (
              <label className="tm-mono tm-md" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                day:
                <input
                  type="number"
                  min={1}
                  max={31}
                  className="tm-composer-num"
                  value={monthDate}
                  onChange={(e) => setMonthDate(Number(e.target.value) || 1)}
                  style={{ width: 80 }}
                />
              </label>
            )}

            {kind === 'quarterly_week' && (
              <label className="tm-mono tm-md" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                week of quarter:
                <input
                  type="number"
                  min={1}
                  max={13}
                  className="tm-composer-num"
                  value={weekOfQuarter}
                  onChange={(e) => setWeekOfQuarter(Number(e.target.value) || 1)}
                  style={{ width: 80 }}
                />
              </label>
            )}

            {(kind === 'project' || kind === 'oneoff') && (
              <label className="tm-mono tm-md" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                start:
                <input
                  type="date"
                  className="tm-composer-num"
                  value={anchor}
                  onChange={(e) => setAnchor(e.target.value)}
                  style={{ width: 160 }}
                />
              </label>
            )}

            {kind === 'project' && (
              <label className="tm-mono tm-md" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                end:
                <input
                  type="date"
                  className="tm-composer-num"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  style={{ width: 160 }}
                />
              </label>
            )}
          </div>
        </Section>

        <Section title="Time of day">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="time"
              className="tm-composer-num"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              style={{ width: 120 }}
            />
            <span className="tm-mono">–</span>
            <input
              type="time"
              className="tm-composer-num"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              style={{ width: 120 }}
            />
          </div>
        </Section>

        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          marginTop: 8,
          paddingTop: 14,
          borderTop: '1px dashed var(--rule)',
        }}>
          <button type="button" className="tm-btn" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="tm-btn tm-primary"
            onClick={save}
            disabled={!name.trim()}
          >
            {editing ? 'Save' : 'Add rhythm'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 14 }}>
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
