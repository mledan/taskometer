import React, { useMemo } from 'react';
import { MiniWheel } from './WheelView.jsx';
import { PATHS } from '../defaults/paths';
import { TASK_PACKS } from '../defaults/taskPacks';
import { FAMOUS_WHEELS } from '../defaults/famousWheels';
import { ARCHETYPE_WHEELS } from '../defaults/scheduleArchetypes';
import { DEFAULT_WHEELS } from '../defaults/defaultSchedule';

/**
 * PathPicker — modal for adopting a curated Path.
 *
 * A Path is "schedule + pack + duration" applied as a single
 * gesture. The user said: "we can even have a 'path' where we
 * set up not only a schedule for you, but help you fill it with
 * the various packs."
 *
 * Each card shows the schedule (mini-wheel + name), the pack
 * (icon + name), the duration, and a one-line blurb. Adopt →
 * paints the schedule across `duration` days starting today and
 * adds the pack's tasks to the inbox.
 */
function findWheel(id) {
  if (!id) return null;
  return (
    FAMOUS_WHEELS.find(w => w.id === id) ||
    ARCHETYPE_WHEELS.find(w => w.id === id) ||
    DEFAULT_WHEELS.find(w => w.id === id) ||
    null
  );
}
function findPack(id) {
  return TASK_PACKS.find(p => p.id === id) || null;
}

export default function PathPicker({ onClose, onAdopt }) {
  const items = useMemo(() => PATHS.map(p => ({
    path: p,
    wheel: findWheel(p.schedule) || findWheel(p.fallbackSchedule),
    pack: findPack(p.pack),
  })).filter(x => x.wheel && x.pack), []);

  return (
    <div className="tm-modal-backdrop" onMouseDown={onClose}>
      <div
        className="tm-modal"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="paths"
        style={{ maxWidth: 760 }}
      >
        <div className="tm-modal-head">
          <div className="tm-modal-title">Paths</div>
          <button type="button" onClick={onClose} className="tm-btn tm-sm">close</button>
        </div>
        <div className="tm-mono tm-md" style={{ marginBottom: 14, color: 'var(--ink-mute)' }}>
          a path = a schedule + a starter pack of tasks + a duration · pick one to adopt for the next stretch.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {items.map(({ path, wheel, pack }) => (
            <div
              key={path.id}
              style={{
                padding: '14px 16px',
                border: '1px solid var(--rule)',
                borderRadius: 12,
                background: 'var(--paper)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                transition: 'border-color 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--orange)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--rule)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>{path.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>
                    {path.name}
                  </div>
                  <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
                    {path.duration} day{path.duration === 1 ? '' : 's'}
                    {path.weekdaysOnly ? ' · weekdays' : ''}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.45 }}>
                {path.blurb}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr',
                  gap: 10,
                  alignItems: 'center',
                  padding: '8px 10px',
                  background: 'var(--paper-warm, #FAF5EC)',
                  borderRadius: 8,
                  border: '1px dashed var(--rule)',
                }}
              >
                <MiniWheel
                  slots={(wheel.blocks || []).map(b => ({ startTime: b.startTime, endTime: b.endTime, color: b.color }))}
                  size={36}
                  thickness={5}
                />
                <div style={{ minWidth: 0 }}>
                  <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                    Schedule
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink)' }}>{wheel.name}</div>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr',
                  gap: 10,
                  alignItems: 'center',
                  padding: '8px 10px',
                  background: 'var(--paper-warm, #FAF5EC)',
                  borderRadius: 8,
                  border: '1px dashed var(--rule)',
                }}
              >
                <span style={{ fontSize: 28, textAlign: 'center' }}>{pack.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                    Pack · {pack.tasks.length} tasks
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink)' }}>{pack.name}</div>
                </div>
              </div>

              <button
                type="button"
                className="tm-btn tm-primary tm-sm"
                onClick={() => {
                  onAdopt?.(path, wheel, pack);
                  onClose?.();
                }}
              >
                Adopt this path →
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
