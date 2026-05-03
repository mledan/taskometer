import React, { forwardRef, useState } from 'react';
import { TaskRow } from './shared.jsx';
import { log as telemetryLog } from '../services/telemetry.js';

/**
 * QuickCapture — a one-line input for "I just thought of something."
 *
 * Always visible. No type, no duration, no block. Submits create a
 * pending task with no scheduledTime; it lands in the inbox until the
 * user drags it into a block. The whole point is to keep the cost of
 * capture as low as the cost of forgetting.
 *
 * `onCapture(text)` fires on Enter or click. Hotkey `n` (wired by
 * Taskometer.jsx) focuses the input from anywhere.
 */
export const QuickCapture = forwardRef(function QuickCapture(
  { onCapture, inboxCount = 0, placeholder },
  ref,
) {
  const [text, setText] = useState('');

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    telemetryLog('inbox:capture', { length: t.length });
    onCapture?.(t);
    setText('');
  };

  return (
    <div
      data-onboard="quick-capture"
      style={{
        marginBottom: 14,
        padding: '10px 14px',
        border: '1.5px solid var(--rule)',
        borderRadius: 12,
        background: 'var(--paper)',
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>📥</span>
      <input
        ref={ref}
        className="tm-composer-input"
        placeholder={placeholder || 'capture anything — press n to focus'}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        style={{ flex: 1, minWidth: 200, fontSize: 16 }}
        aria-label="quick capture"
      />
      <button
        type="button"
        className="tm-btn tm-primary tm-sm"
        onClick={submit}
        disabled={!text.trim()}
        title="add to inbox · drag into a block to schedule"
      >
        add to inbox
      </button>
      {inboxCount > 0 && (
        <span
          className="tm-mono tm-sm"
          style={{ color: 'var(--ink-mute)' }}
          title={`${inboxCount} unscheduled · drag into a block when you're ready to plan`}
        >
          {inboxCount} in inbox
        </span>
      )}
    </div>
  );
});

/**
 * InboxPanel — the parking lot of unscheduled tasks.
 *
 * Each row is draggable; drop targets in WheelView snap the task into
 * the chosen slot via the existing `text/task-id` dataTransfer
 * channel. We don't auto-place — the whole point is the user picks
 * where it goes when they sit down to plan.
 */
export function InboxPanel({ tasks = [], rowHandlers = {}, onScheduleAll }) {
  const empty = tasks.length === 0;

  return (
    <div
      className="tm-rail"
      role="list"
      aria-label="inbox"
      data-onboard="inbox"
      style={{ borderTop: '3px solid var(--orange)' }}
    >
      <div className="tm-rail-head">
        <span className="tm-rail-title">Inbox</span>
        {!empty && (
          <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
            {tasks.length}
          </span>
        )}
      </div>

      {empty ? (
        <div
          className="tm-mono tm-sm"
          style={{ color: 'var(--ink-mute)', lineHeight: 1.5, marginTop: -4 }}
        >
          nothing parked. type above to capture — sort it later.
        </div>
      ) : (
        <>
          <div
            className="tm-mono tm-sm"
            style={{ color: 'var(--ink-mute)', marginTop: -8 }}
          >
            drag a task onto a block to schedule it.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {tasks.map(t => {
              const id = t.id || t.key;
              const row = {
                id,
                title: t.text || t.title || 'untitled',
                ctx: t.primaryType || t.taskType || 'inbox',
                when: 'unscheduled',
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
