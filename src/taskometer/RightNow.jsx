import React from 'react';

/**
 * RightNow — the top of the day-view sidebar. Answers two questions:
 *   "what block am I in?" and "what's left of today?"
 *
 * - Current slot label, color stripe, time window.
 * - Tasks already parked in the current slot (so "right now" actually
 *   means the things to do right now).
 * - Time-remaining counter to the next sleep block (or end of day if
 *   there's no sleep slot, which the skeleton ensures there always is).
 *
 * Drop target — drag a task here and it lands in the current slot,
 * same dataTransfer channel the wedges use.
 */
export default function RightNow({
  currentSlot,
  currentTasks = [],
  nextSlot,
  hoursLeft,
  onMoveTaskHere,
  onToggle,
}) {
  const slot = currentSlot || null;
  const sortedTasks = [...currentTasks].sort((a, b) => {
    const ta = a.scheduledTime ? new Date(a.scheduledTime).getTime() : Infinity;
    const tb = b.scheduledTime ? new Date(b.scheduledTime).getTime() : Infinity;
    return ta - tb;
  });

  return (
    <div
      className="tm-rail"
      role="region"
      aria-label="right now"
      data-onboard="right-now"
      style={{ borderTop: `3px solid ${slot?.color || 'var(--ink-mute)'}` }}
      onDragOver={(ev) => {
        if (!slot?.id) return;
        if (!ev.dataTransfer.types.includes('text/task-id')) return;
        ev.preventDefault();
        ev.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(ev) => {
        if (!slot?.id) return;
        const taskId = ev.dataTransfer.getData('text/task-id');
        if (!taskId) return;
        ev.preventDefault();
        onMoveTaskHere?.(taskId, slot.id);
      }}
    >
      <div className="tm-rail-head">
        <span className="tm-rail-title">Right now</span>
        {Number.isFinite(hoursLeft) && (
          <span
            className="tm-mono tm-sm"
            style={{ color: 'var(--ink-mute)' }}
            title={`${hoursLeft.toFixed(1)} hours until your next sleep block`}
          >
            {hoursLeft >= 1
              ? `${Math.round(hoursLeft)}h left today`
              : `${Math.max(0, Math.round(hoursLeft * 60))}m left`}
          </span>
        )}
      </div>

      {slot ? (
        <>
          <div style={{ fontSize: 22, lineHeight: 1.1, color: 'var(--ink)' }}>
            {slot.label || slot.slotType || 'block'}
          </div>
          <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', marginTop: -8 }}>
            {slot.startTime}–{slot.endTime}
          </div>

          {sortedTasks.length === 0 ? (
            <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', lineHeight: 1.5 }}>
              nothing parked here yet — drop a task from the inbox.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {sortedTasks.map((t) => {
                const id = t.id || t.key;
                const done = t.status === 'completed';
                return (
                  <div
                    key={id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 0',
                      borderBottom: '1px solid var(--rule-soft)',
                      opacity: done ? 0.55 : 1,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onToggle?.(id)}
                      title={done ? 'undo' : 'mark done'}
                      style={{
                        all: 'unset',
                        cursor: 'pointer',
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        border: `1.5px solid ${done ? 'var(--sage)' : 'var(--ink-mute)'}`,
                        background: done ? 'var(--sage)' : 'transparent',
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: 14,
                        textDecoration: done ? 'line-through' : 'none',
                      }}
                    >
                      {t.text || t.title || 'untitled'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', lineHeight: 1.5 }}>
          {nextSlot
            ? `nothing scheduled right now — next: ${nextSlot.label || 'block'} at ${nextSlot.startTime}`
            : 'free time. drop something from the inbox.'}
        </div>
      )}
    </div>
  );
}
