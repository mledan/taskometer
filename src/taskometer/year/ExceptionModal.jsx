import React, { useEffect, useState } from 'react';
import { addException } from '../../services/rhythms.js';

/**
 * Block out a date range. Vacation, holidays, conferences, sick days.
 * Anything inside an exception range suppresses rhythms underneath
 * (the year canvas shows them as dashed/grey instead of colored).
 */
const TYPES = [
  { v: 'vacation',   l: 'Vacation',   color: '#8B5CF6' },
  { v: 'holiday',    l: 'Holiday',    color: '#10B981' },
  { v: 'conference', l: 'Conference', color: '#F59E0B' },
  { v: 'sick',       l: 'Sick',       color: '#94A3B8' },
  { v: 'other',      l: 'Other',      color: '#78716C' },
];

function todayYMD() {
  const d = new Date();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

export default function ExceptionModal({ onClose, onSaved }) {
  const [type, setType] = useState('vacation');
  const [label, setLabel] = useState('');
  const [startDate, setStartDate] = useState(todayYMD());
  const [endDate, setEndDate] = useState(todayYMD());

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = () => {
    if (!startDate || !endDate || endDate < startDate) return;
    const t = TYPES.find(x => x.v === type);
    addException({
      type,
      label: label.trim() || t?.l || type,
      startDate,
      endDate,
      color: t?.color || '#94A3B8',
    });
    onSaved?.();
  };

  return (
    <div className="tm-modal-backdrop" onMouseDown={onClose} role="dialog" aria-label="add exception">
      <div
        className="tm-modal"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: 480, width: 'min(480px, 94vw)' }}
      >
        <div className="tm-modal-head">
          <div className="tm-modal-title">Block out a range</div>
          <button type="button" className="tm-btn tm-sm" onClick={onClose}>close</button>
        </div>

        <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', marginBottom: 14 }}>
          Rhythms inside this range will be suppressed on the year canvas.
          You can still add tasks on those days.
        </div>

        <div style={{ marginBottom: 14 }}>
          <div className="tm-mono tm-sm" style={{
            color: 'var(--ink-mute)',
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            marginBottom: 6,
          }}>Type</div>
          <div className="tm-seg" style={{ flexWrap: 'wrap' }}>
            {TYPES.map(t => (
              <button
                key={t.v}
                type="button"
                className={type === t.v ? 'tm-on' : ''}
                onClick={() => setType(t.v)}
              >{t.l}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div className="tm-mono tm-sm" style={{
            color: 'var(--ink-mute)',
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            marginBottom: 6,
          }}>Label (optional)</div>
          <input
            className="tm-composer-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder='e.g. "Spring break", "Q3 offsite"'
            style={{ width: '100%', padding: '8px 10px', fontSize: 15 }}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <div className="tm-mono tm-sm" style={{
            color: 'var(--ink-mute)',
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            marginBottom: 6,
          }}>Range</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="date"
              className="tm-composer-num"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ width: 160 }}
            />
            <span className="tm-mono">–</span>
            <input
              type="date"
              className="tm-composer-num"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ width: 160 }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 14, borderTop: '1px dashed var(--rule)' }}>
          <button type="button" className="tm-btn" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="tm-btn tm-primary"
            onClick={save}
            disabled={!startDate || !endDate || endDate < startDate}
          >
            Add exception
          </button>
        </div>
      </div>
    </div>
  );
}
