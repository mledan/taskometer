import React, { useEffect } from 'react';
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
  assignedWheelId,
  override,
}) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const maxLeft = (typeof window !== 'undefined' ? window.innerWidth : 1024) - 280;
  const left = Math.min(menu.x, Math.max(8, maxLeft));
  const top = menu.y;

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
        style={{ left, top }}
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
              title={o.clearsSlots ? 'clears that day\'s slots' : ''}
            >
              {o.label.toLowerCase()}
            </button>
          ))}
          {override && (
            <button className="tm-btn tm-sm tm-ghost" onClick={onClearOverride}>clear</button>
          )}
        </div>
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
  };
}
