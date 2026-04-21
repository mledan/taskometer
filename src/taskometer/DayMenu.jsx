import React, { useEffect, useState } from 'react';
import { OVERRIDE_TYPES } from '../services/api/TaskometerAPI';

/**
 * Shared "what do you want to do with this day?" popover. Used by the month
 * calendar, the week view, and anywhere else the user wants to assign a
 * wheel, add an override, or clear one. Keeping one component avoids the
 * two views drifting out of sync.
 */
export default function DayMenu({
  menu,
  wheels = [],
  onClose,
  onAssign,
  onClearAssignment,
  onOverride,
  onClearOverride,
  onOverrideRange,
  assignedWheelId,
  override,
}) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const [rangeType, setRangeType] = useState(null); // override type pending a range
  const [rangeEnd, setRangeEnd] = useState(menu.date);
  const [rangeHalf, setRangeHalf] = useState('full'); // 'full' | 'morning' | 'afternoon' | 'custom'
  const [customFrom, setCustomFrom] = useState('09:00');
  const [customTo, setCustomTo] = useState('12:00');

  const maxLeft = (typeof window !== 'undefined' ? window.innerWidth : 1024) - 320;
  const left = Math.min(menu.x, Math.max(8, maxLeft));
  const top = menu.y;

  const startRange = (type) => {
    setRangeType(type);
    setRangeEnd(menu.date);
    setRangeHalf('full');
  };

  const applyRange = async () => {
    if (!rangeType) return;
    const coverage = rangeHalf === 'full' ? 'full' : 'partial';
    const bounds = rangeHalf === 'morning' ? { from: '00:00', to: '12:00' }
      : rangeHalf === 'afternoon' ? { from: '12:00', to: '23:59' }
      : rangeHalf === 'custom' ? { from: customFrom, to: customTo }
      : {};
    await onOverrideRange?.(rangeType, menu.date, rangeEnd, { coverage, ...bounds });
    setRangeType(null);
  };

  return (
    <div
      className="tm-popover-backdrop"
      onMouseDown={onClose}
      role="dialog"
      aria-label="day actions"
    >
      <div
        className="tm-popover"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ left, top, minWidth: 300 }}
      >
        <div className="tm-mono tm-md" style={{ fontWeight: 600, marginBottom: 6 }}>{menu.date}</div>

        <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', marginBottom: 4 }}>assign wheel</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {wheels.length === 0 && (
            <span className="tm-mono tm-sm">no wheels yet — create one from the wheel tab</span>
          )}
          {wheels.map(w => (
            <button
              key={w.id}
              className={`tm-btn tm-sm${assignedWheelId === w.id ? ' tm-primary' : ''}`}
              onClick={() => onAssign(w.id)}
              style={assignedWheelId !== w.id ? { borderColor: w.color, color: w.color } : undefined}
            >
              {w.name}
            </button>
          ))}
          {assignedWheelId && (
            <button className="tm-btn tm-sm tm-ghost" onClick={onClearAssignment}>clear</button>
          )}
        </div>

        <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', marginBottom: 4 }}>override</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {OVERRIDE_TYPES.map(o => (
            <button
              key={o.id}
              className={`tm-btn tm-sm${override?.type === o.id ? ' tm-primary' : ''}`}
              onClick={() => onOverride(o.id)}
              style={override?.type !== o.id ? { borderColor: o.color, color: o.color } : undefined}
              title={o.clearsSlots ? 'clears this day\'s slots (restores on clear override)' : ''}
            >
              {o.label.toLowerCase()}
            </button>
          ))}
          {override && (
            <button className="tm-btn tm-sm tm-ghost" onClick={onClearOverride}>clear</button>
          )}
        </div>

        {onOverrideRange && (
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--rule)' }}>
            <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', marginBottom: 4 }}>
              or apply a multi-day override (vacation, event...)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {OVERRIDE_TYPES.map(o => (
                <button
                  key={o.id}
                  className={`tm-btn tm-sm${rangeType === o.id ? ' tm-primary' : ''}`}
                  onClick={() => startRange(o.id)}
                  style={rangeType !== o.id ? { borderColor: o.color, color: o.color } : undefined}
                >
                  {o.label.toLowerCase()}
                </button>
              ))}
            </div>
            {rangeType && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span className="tm-mono tm-sm">from {menu.date} to</span>
                  <input
                    type="date"
                    className="tm-composer-num"
                    value={rangeEnd}
                    min={menu.date}
                    onChange={(e) => setRangeEnd(e.target.value)}
                    style={{ width: 150 }}
                  />
                </div>
                <div className="tm-seg">
                  {['full', 'morning', 'afternoon', 'custom'].map(m => (
                    <button
                      key={m}
                      className={rangeHalf === m ? 'tm-on' : ''}
                      onClick={() => setRangeHalf(m)}
                    >{m}</button>
                  ))}
                </div>
                {rangeHalf === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="time" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="tm-composer-num" style={{ width: 96 }} />
                    <span className="tm-mono">–</span>
                    <input type="time" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="tm-composer-num" style={{ width: 96 }} />
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="tm-btn tm-primary tm-sm" onClick={applyRange}>apply</button>
                  <button className="tm-btn tm-sm" onClick={() => setRangeType(null)}>cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Builds the handlers for a DayMenu. Keeps the CalendarView/FitView copies
 * identical — any future change lives in one place.
 */
export function buildDayMenuHandlers({ api, menu, close }) {
  return {
    onAssign: async (wheelId) => {
      if (!menu) return;
      await api.wheels.applyToDate(wheelId, menu.date, { mode: 'replace' });
      close();
    },
    onClearAssignment: async () => {
      if (!menu) return;
      await api.days.unassign(menu.date);
      close();
    },
    onOverride: async (type) => {
      if (!menu) return;
      const preset = OVERRIDE_TYPES.find(o => o.id === type);
      const shouldClear = preset?.clearsSlots;
      let note = null;
      if (type === 'event' || type === 'custom') {
        note = (typeof window !== 'undefined'
          ? window.prompt(`label for ${preset?.label || type}:`, preset?.label || '')
          : null) || null;
      }
      await api.days.setOverride(menu.date, {
        type,
        label: note || preset?.label || type,
        color: preset?.color,
        clearSlots: shouldClear,
      });
      close();
    },
    onClearOverride: async () => {
      if (!menu) return;
      await api.days.clearOverride(menu.date);
      close();
    },
    onOverrideRange: async (type, startDate, endDate, opts = {}) => {
      if (!menu || !startDate || !endDate) return;
      const preset = OVERRIDE_TYPES.find(o => o.id === type);
      const shouldClear = preset?.clearsSlots;
      let note = null;
      if (type === 'event' || type === 'custom') {
        note = (typeof window !== 'undefined'
          ? window.prompt(`label for this ${preset?.label || type}:`, preset?.label || '')
          : null) || null;
      }
      await api.days.setOverrideRange(startDate, endDate, {
        type,
        label: note || preset?.label || type,
        color: preset?.color,
        clearSlots: shouldClear,
        coverage: opts.coverage || 'full',
        from: opts.from,
        to: opts.to,
      });
      close();
    },
  };
}
