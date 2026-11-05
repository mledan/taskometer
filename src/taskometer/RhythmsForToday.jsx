import React, { useEffect, useMemo, useState } from 'react';
import { listRhythms, listExceptions, dateIsExcepted } from '../services/rhythms.js';
import { pendingRhythmSlotsForDate } from '../services/rhythmsToSlots.js';
import { log as telemetryLog } from '../services/telemetry.js';

/**
 * Rhythms that fire on the selected day but haven't been materialized
 * as slots yet. One click applies them all. Rhythms live outside
 * AppContext, so this component syncs that boundary on date change
 * and window focus.
 */
export default function RhythmsForToday({ dateKey, existingSlots, api }) {
  const [rhythms, setRhythms] = useState(() => listRhythms());
  const [exceptions, setExceptions] = useState(() => listExceptions());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRhythms(listRhythms());
    setExceptions(listExceptions());
  }, [dateKey]);

  useEffect(() => {
    const onFocus = () => { setRhythms(listRhythms()); setExceptions(listExceptions()); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const exception = useMemo(() => dateIsExcepted(dateKey, exceptions), [dateKey, exceptions]);
  const pending = useMemo(
    () => (exception ? [] : pendingRhythmSlotsForDate(rhythms, existingSlots, dateKey)),
    [rhythms, existingSlots, dateKey, exception],
  );

  if (exception) {
    return (
      <div role="status" className="tm-rhythm-exception" style={{ borderColor: exception.color || 'var(--ink-mute)' }}>
        <strong style={{ color: exception.color || 'var(--ink)' }}>
          {(exception.label || exception.type || 'exception').toUpperCase()}
        </strong>
        {' · '}rhythms suppressed on this day. You can still add tasks.
      </div>
    );
  }

  if (pending.length === 0) return null;

  const applyAll = async () => {
    if (busy) return;
    setBusy(true);
    try {
      for (const proj of pending) {
        // eslint-disable-next-line no-await-in-loop
        await api.slots.add({
          date: proj.date, startTime: proj.startTime, endTime: proj.endTime,
          slotType: proj.slotType, label: proj.label, color: proj.color,
        });
      }
      telemetryLog('rhythms:applied-day', { count: pending.length, date: dateKey });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tm-rhythm-today">
      <div className="tm-rhythm-today-body">
        <div className="tm-picker-eyebrow tm-accent">
          {pending.length} rhythm{pending.length === 1 ? '' : 's'} fire today
        </div>
        <div className="tm-rhythm-chips">
          {pending.map(p => (
            <span key={p._rhythmId} className="tm-rhythm-chip" style={{ borderColor: p.color }}>
              {p.startTime} {p._rhythmName}
            </span>
          ))}
        </div>
      </div>
      <button type="button" className="tm-btn tm-primary" onClick={applyAll} disabled={busy}>
        {busy ? 'applying…' : `Apply ${pending.length} →`}
      </button>
    </div>
  );
}
