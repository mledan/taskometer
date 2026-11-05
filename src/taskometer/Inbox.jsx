import { forwardRef, useState } from 'react';
import { TaskRow } from './shared.jsx';
import PlaceMenu from './PlaceMenu.jsx';
import { parseCapture, fmtDuration } from './quickAdd';
import { log as telemetryLog } from '../services/telemetry.js';
import './capture.css';

/**
 * QuickCapture — one line in, a task out. Reads duration, time, day and
 * tags as you type and shows what it understood; Enter schedules when
 * it knows when, parks in the inbox when it doesn't.
 */
export const QuickCapture = forwardRef(function QuickCapture(
  { onCapture, inboxCount = 0, placeholder },
  ref,
) {
  const [text, setText] = useState('');
  const parsed = parseCapture(text);
  const hasHints = parsed.parts.length > 0;

  const submit = () => {
    if (!parsed.text) return;
    telemetryLog('inbox:capture', { length: text.length, scheduled: parsed.scheduled, parts: parsed.parts.map(p => p.kind) });
    onCapture?.(text.trim());
    setText('');
  };

  return (
    <div className="tm-capture" data-onboard="quick-capture">
      <div className="tm-capture-row">
        <span aria-hidden className="tm-capture-icon">📥</span>
        <input
          ref={ref}
          className="tm-composer-input"
          placeholder={placeholder || 'capture anything — "gym 6pm", "call mom tomorrow 20m", "#deep draft pricing"'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') setText('');
          }}
          aria-label="quick capture"
        />
        <button
          type="button"
          className="tm-btn tm-primary tm-sm"
          onClick={submit}
          disabled={!parsed.text}
          title={parsed.scheduled ? 'schedule it' : 'add to inbox · place it when you plan'}
        >
          {parsed.scheduled ? 'Schedule' : 'Add to inbox'}
        </button>
        {inboxCount > 0 && (
          <span className="tm-mono tm-sm tm-capture-count" title={`${inboxCount} unscheduled`}>
            {inboxCount} in inbox
          </span>
        )}
      </div>
      {hasHints && (
        <div className="tm-capture-chips" aria-live="polite">
          <span className="tm-capture-title">{parsed.text || '…'}</span>
          {parsed.parts.map((p, i) => (
            <span key={`${p.kind}-${i}`} className={`tm-chip tm-chip-${p.kind}`}>{p.label}</span>
          ))}
          <span className="tm-mono tm-sm tm-capture-hint">
            {parsed.scheduled ? 'enter → schedule' : 'enter → inbox'}
          </span>
        </div>
      )}
    </div>
  );
});

/**
 * InboxPanel — the parking lot of unscheduled tasks. Each row drags
 * onto the wheel, or taps "place" for the same choices without a mouse.
 */
export function InboxPanel({
  tasks = [],
  rowHandlers = {},
  daySlots = [],
  dayKey,
  onPlaceInSlot,
  onPlaceOnDate,
  onScheduleAll,
}) {
  const empty = tasks.length === 0;

  return (
    <div className="tm-rail" role="list" aria-label="inbox" data-onboard="inbox" style={{ borderTop: '3px solid var(--orange)' }}>
      <div className="tm-rail-head">
        <span className="tm-rail-title">Inbox</span>
        {!empty && <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>{tasks.length}</span>}
      </div>

      {empty ? (
        <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', lineHeight: 1.5, marginTop: -4 }}>
          nothing parked. type above to capture — sort it later.
        </div>
      ) : (
        <>
          <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', marginTop: -8 }}>
            drag onto a block, or tap place.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {tasks.map(t => {
              const id = t.id || t.key;
              const type = t.primaryType || t.taskType;
              const row = {
                id,
                title: t.text || t.title || 'untitled',
                ctx: type && type !== 'work' ? type : null,
                when: typeof t.duration === 'number' && t.duration > 0 ? fmtDuration(t.duration) : null,
                done: t.status === 'completed',
                priority: t.priority,
                duration: typeof t.duration === 'number' ? t.duration : null,
                tags: t.tags,
              };
              return (
                <TaskRow
                  key={id}
                  task={row}
                  onToggle={rowHandlers.onToggle}
                  onDelete={rowHandlers.onDelete}
                  extraActions={(onPlaceInSlot || onPlaceOnDate) ? (
                    <PlaceMenu
                      taskId={id}
                      daySlots={daySlots}
                      dayKey={dayKey}
                      onPlaceInSlot={onPlaceInSlot}
                      onPlaceOnDate={onPlaceOnDate}
                    />
                  ) : null}
                />
              );
            })}
          </div>
          {onScheduleAll && tasks.length > 1 && (
            <button
              type="button"
              className="tm-btn tm-sm tm-ghost"
              onClick={onScheduleAll}
              title="auto-schedule everything in the inbox into open blocks"
              style={{ alignSelf: 'flex-start', marginTop: 4 }}
            >
              auto-schedule all →
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default InboxPanel;
