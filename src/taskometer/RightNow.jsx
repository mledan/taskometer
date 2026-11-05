import SleepCycleHint from './SleepCycleHint.jsx';
import { isSleepSlot } from '../services/sleepCycles.js';
import { fmtDuration } from './quickAdd';

function hhmmToMin(s) {
  const [h, m] = (s || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function fmtLeft(min) {
  if (min < 60) return `${min}m left`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m left` : `${h}h left`;
}

function minutesLeftIn(slot, now) {
  const sMin = hhmmToMin(slot.startTime);
  let eMin = hhmmToMin(slot.endTime);
  if (eMin <= sMin) eMin += 24 * 60;
  let m = now.getHours() * 60 + now.getMinutes();
  if (m < sMin) m += 24 * 60;
  return Math.max(0, eMin - m);
}

/**
 * RightNow — the Do surface. The wheel hub already says which block you
 * are in; this is the list you act on: the tasks parked in that block,
 * and — when it's empty — the inbox items you could pull in right now.
 */
export default function RightNow({
  currentSlot,
  currentTasks = [],
  nextSlot,
  hoursLeft,
  inboxTasks = [],
  onMoveTaskHere,
  onToggle,
}) {
  const slot = currentSlot || null;
  const now = new Date();
  const sortedTasks = [...currentTasks].sort((a, b) => {
    const ta = a.scheduledTime ? new Date(a.scheduledTime).getTime() : Infinity;
    const tb = b.scheduledTime ? new Date(b.scheduledTime).getTime() : Infinity;
    return ta - tb;
  });
  const open = sortedTasks.filter(t => t.status !== 'completed');
  const pullable = inboxTasks.slice(0, 3);
  const nextLabel = nextSlot ? `${nextSlot.label || nextSlot.slotType || 'block'} at ${nextSlot.startTime}` : null;

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
        {slot ? (
          <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }} title={`${slot.startTime}–${slot.endTime}`}>
            {fmtLeft(minutesLeftIn(slot, now))}
          </span>
        ) : Number.isFinite(hoursLeft) ? (
          <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
            {hoursLeft >= 1 ? `${Math.round(hoursLeft)}h left today` : `${Math.max(0, Math.round(hoursLeft * 60))}m left`}
          </span>
        ) : null}
      </div>

      {slot ? (
        <>
          <div className="tm-rightnow-block">{slot.label || slot.slotType || 'block'}</div>
          <div className="tm-mono tm-sm tm-rightnow-window">{slot.startTime}–{slot.endTime}</div>

          {isSleepSlot(slot) && <SleepCycleHint slot={slot} compact />}

          {sortedTasks.length > 0 && (
            <div className="tm-rightnow-list">
              {sortedTasks.map((t) => {
                const id = t.id || t.key;
                const done = t.status === 'completed';
                return (
                  <div
                    key={id}
                    className={`tm-rightnow-row${done ? ' tm-done' : ''}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/task-id', id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                  >
                    <button
                      type="button"
                      className={`tm-rightnow-check${done ? ' tm-on' : ''}`}
                      onClick={() => onToggle?.(id)}
                      title={done ? 'undo' : 'mark done'}
                      aria-label={done ? 'mark not done' : 'mark done'}
                    />
                    <span className="tm-rightnow-text">{t.text || t.title || 'untitled'}</span>
                    {typeof t.duration === 'number' && t.duration > 0 && (
                      <span className="tm-mono tm-sm tm-rightnow-dur">{fmtDuration(t.duration)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {open.length === 0 && pullable.length > 0 && onMoveTaskHere && (
            <div className="tm-rightnow-pull">
              <div className="tm-mono tm-sm tm-rightnow-empty">
                {sortedTasks.length > 0 ? 'all done here. pull something in:' : 'nothing in this block yet. pull something in:'}
              </div>
              {pullable.map((t) => {
                const id = t.id || t.key;
                return (
                  <div key={id} className="tm-rightnow-pull-row">
                    <span className="tm-rightnow-text">{t.text || t.title || 'untitled'}</span>
                    <button
                      type="button"
                      className="tm-rightnow-do"
                      onClick={() => onMoveTaskHere(id, slot.id)}
                      title={`put this into ${slot.label || 'this block'} now`}
                    >
                      do now →
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {open.length === 0 && pullable.length === 0 && (
            <div className="tm-mono tm-sm tm-rightnow-empty">
              {sortedTasks.length > 0 ? 'all done here.' : 'nothing in this block. drop a task here, or just be in it.'}
            </div>
          )}

          {nextLabel && (
            <div className="tm-mono tm-sm tm-rightnow-next">next · {nextLabel}</div>
          )}
        </>
      ) : (
        <>
          <div className="tm-rightnow-block">Free</div>
          <div className="tm-mono tm-sm tm-rightnow-empty">
            {nextLabel ? `until ${nextLabel}.` : 'no more blocks today.'}
          </div>
          {pullable.length > 0 && (
            <div className="tm-mono tm-sm tm-rightnow-empty">
              {pullable.length} in the inbox — tap <em>place</em> on one to give it a block.
            </div>
          )}
        </>
      )}
    </div>
  );
}
