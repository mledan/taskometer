import React, { useEffect, useMemo, useState } from 'react';
import { addRhythm, listRhythms, findRhythmConflicts } from '../../services/rhythms.js';

/**
 * Focused modal for "Save selection as rhythm". Replaces the
 * window.prompt() shortcut with a proper form: name, color, time-of-
 * day, optional slot type. Ships the selected dates as a custom
 * cadence so the rhythm is reusable / editable later.
 *
 * Props:
 *   dates    — string[] of YMD keys to capture
 *   onClose  — fires on Cancel / backdrop click / Esc
 *   onSaved  — fires after successful save with the new rhythm
 */
const PALETTE = [
  '#D4663A', '#A8BF8C', '#D9C98C', '#C7BEDD', '#F2C4A6',
  '#6B46C1', '#3B82F6', '#10B981', '#EC4899', '#F59E0B',
];

const SLOT_TYPE_SUGGESTIONS = [
  { v: '',          l: '— none —' },
  { v: 'deep',      l: 'Deep work' },
  { v: 'mtgs',      l: 'Meetings' },
  { v: 'admin',     l: 'Admin' },
  { v: 'play',      l: 'Play' },
  { v: 'health',    l: 'Health' },
  { v: 'family',    l: 'Family' },
];

function suggestName(dates) {
  if (!dates || dates.length === 0) return '';
  if (dates.length === 1) return `Block on ${dates[0]}`;
  if (dates.length <= 3) return dates.slice().sort().join(', ');
  return `${dates.length} custom days`;
}

export default function SaveAsRhythmModal({ dates = [], onClose, onSaved }) {
  const [name, setName] = useState(() => suggestName(dates));
  const [color, setColor] = useState(PALETTE[0]);
  const [slotType, setSlotType] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const canSave = name.trim().length > 0 && dates.length > 0 && startTime < endTime;

  const conflicts = useMemo(() => {
    const candidate = {
      cadence: { kind: 'custom', dates: dates.slice().sort() },
      startTime,
      endTime,
    };
    const peers = listRhythms();
    const today = new Date();
    const horizon = new Date(today); horizon.setDate(horizon.getDate() + 365);
    return findRhythmConflicts(candidate, peers, today, horizon);
  }, [dates, startTime, endTime]);

  const submit = (e) => {
    e?.preventDefault?.();
    if (!canSave) return;
    const rhythm = addRhythm({
      name: name.trim(),
      color,
      slotType: slotType || null,
      startTime,
      endTime,
      cadence: { kind: 'custom', dates: dates.slice().sort() },
    });
    onSaved?.(rhythm);
  };

  // Show up to 6 dates, plus "and N more" so the user sees what they're about
  // to save without the modal becoming a date list.
  const sortedDates = dates.slice().sort();
  const previewDates = sortedDates.slice(0, 6);
  const remaining = sortedDates.length - previewDates.length;

  return (
    <div className="tm-modal-backdrop" onMouseDown={onClose} role="dialog" aria-label="save selection as rhythm">
      <form
        className="tm-modal"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={submit}
        style={{ maxWidth: 480, width: 'min(480px, 94vw)' }}
      >
        <div className="tm-modal-head">
          <div className="tm-modal-title">Save as rhythm</div>
          <button type="button" className="tm-btn tm-sm" onClick={onClose}>close</button>
        </div>

        <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', marginBottom: 14 }}>
          Captures {dates.length} day{dates.length === 1 ? '' : 's'} as a custom-cadence rhythm.
          You can edit it later from the year canvas rail.
        </div>

        <Section title="Name">
          <input
            className="tm-composer-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='e.g. "Sprint Tuesdays", "Q4 board prep"'
            autoFocus
            style={{ width: '100%', padding: '8px 10px', fontSize: 15 }}
          />
        </Section>

        <Section title="Color">
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

        <Section title="Category (optional)">
          <select
            className="tm-composer-select"
            value={slotType}
            onChange={(e) => setSlotType(e.target.value)}
            style={{ padding: '6px 10px', fontSize: 14 }}
          >
            {SLOT_TYPE_SUGGESTIONS.map(o => (
              <option key={o.v} value={o.v}>{o.l}</option>
            ))}
          </select>
          <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', marginTop: 4 }}>
            Categorized rhythms get matched against same-typed tasks
            for the rollover scheduler.
          </div>
        </Section>

        <Section title="Captured days">
          <div className="tm-mono tm-sm" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {previewDates.map(d => (
              <span
                key={d}
                style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: 'var(--paper-warm, #FAF5EC)',
                  border: `1px solid ${color}`,
                  color: 'var(--ink)',
                }}
              >
                {d}
              </span>
            ))}
            {remaining > 0 && (
              <span style={{ color: 'var(--ink-mute)', alignSelf: 'center' }}>+ {remaining} more</span>
            )}
          </div>
        </Section>

        {conflicts.length > 0 && (
          <div
            role="alert"
            style={{
              marginTop: 14,
              padding: '10px 12px',
              border: '1.5px solid var(--orange)',
              borderRadius: 8,
              background: 'rgba(212, 102, 58, 0.08)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 12,
              color: 'var(--ink)',
            }}
          >
            <div style={{ marginBottom: 4, color: 'var(--orange)', fontWeight: 600 }}>
              ⚠ overlaps {conflicts.length} other rhythm{conflicts.length === 1 ? '' : 's'}
            </div>
            {conflicts.slice(0, 3).map(c => (
              <div key={c.rhythm.id} style={{ color: 'var(--ink-soft)' }}>
                "{c.rhythm.name}" · {c.rhythm.startTime}–{c.rhythm.endTime}
                {' · '}{c.dates.length} shared day{c.dates.length === 1 ? '' : 's'}
              </div>
            ))}
            {conflicts.length > 3 && (
              <div style={{ color: 'var(--ink-mute)', marginTop: 4 }}>
                + {conflicts.length - 3} more
              </div>
            )}
          </div>
        )}

        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          marginTop: 8,
          paddingTop: 14,
          borderTop: '1px dashed var(--rule)',
        }}>
          <button type="button" className="tm-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="tm-btn tm-primary" disabled={!canSave}>
            Save rhythm
          </button>
        </div>
      </form>
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
