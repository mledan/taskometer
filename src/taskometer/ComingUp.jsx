import React, { useMemo } from 'react';

function ymd(d) {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

function fmtRelative(targetKey) {
  const [y, m, d] = targetKey.split('-').map(Number);
  const target = new Date(y, (m || 1) - 1, d || 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cmp = new Date(target); cmp.setHours(0, 0, 0, 0);
  const diff = Math.round((cmp.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff > 1 && diff <= 6) return target.toLocaleDateString('en', { weekday: 'long' }).toLowerCase();
  if (diff < 0 && diff >= -6) return `${target.toLocaleDateString('en', { weekday: 'short' }).toLowerCase()} (${-diff}d ago)`;
  return target.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }).toLowerCase();
}

function fmtClock(iso) {
  const d = new Date(iso);
  const h = d.getHours();
  const hr = ((h % 12) || 12);
  const ampm = h < 12 ? 'a' : 'p';
  const m = d.getMinutes();
  return m ? `${hr}:${m < 10 ? '0' + m : m}${ampm}` : `${hr}${ampm}`;
}

/**
 * ComingUp — the breadcrumb panel for tasks that aren't on the day
 * the user is looking at. Lists future-scheduled tasks (auto-rolled
 * or manually pushed) grouped by day, with a click-to-jump on each.
 *
 * The user's complaint was "tasks don't just go disappearing once
 * they are added" — this is where they go. Always visible if anything
 * is scheduled outside today.
 */
export default function ComingUp({ tasks = [], selectedDate, onJumpToDate, onReschedule, recentRollover, limit = 8 }) {
  const todayKey = useMemo(() => ymd(new Date()), []);
  const selectedKey = ymd(selectedDate);

  const upcoming = useMemo(() => {
    return (tasks || [])
      .filter(t => t?.status !== 'completed' && t?.status !== 'cancelled')
      .filter(t => !!t.scheduledTime)
      .map(t => {
        const dt = new Date(t.scheduledTime);
        return {
          id: t.id || t.key,
          text: t.text || t.title || 'untitled',
          when: dt,
          dayKey: ymd(dt),
        };
      })
      // Anything not on the day currently in view, sorted by time.
      .filter(x => x.dayKey !== selectedKey)
      .sort((a, b) => a.when.getTime() - b.when.getTime())
      .slice(0, limit);
  }, [tasks, selectedKey, limit]);

  if (upcoming.length === 0 && !recentRollover) {
    return null; // quiet when nothing to surface
  }

  return (
    <div
      className="tm-rail"
      role="region"
      aria-label="coming up"
      data-onboard="coming-up"
    >
      <div className="tm-rail-head">
        <span className="tm-rail-title">Coming up</span>
        <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
          {upcoming.length}
        </span>
      </div>
      <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', marginTop: -8 }}>
        scheduled outside this day — click a row to jump.
      </div>

      {recentRollover && (
        <button
          type="button"
          onClick={() => onJumpToDate?.(new Date(`${recentRollover.dayKey}T00:00:00`))}
          title={`jump to ${fmtRelative(recentRollover.dayKey)}`}
          style={{
            all: 'unset',
            cursor: 'pointer',
            padding: '8px 10px',
            border: '1.5px solid var(--orange)',
            borderRadius: 8,
            background: 'var(--paper-warm, #FAF5EC)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            animation: 'tm-rollover-flash 1s ease-out 2',
          }}
        >
          <span className="tm-mono tm-sm" style={{ color: 'var(--orange)', letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: 10 }}>
            → just rolled forward
          </span>
          <span style={{ fontSize: 14, color: 'var(--ink)' }}>
            {recentRollover.text}
          </span>
          <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
            {fmtRelative(recentRollover.dayKey)} · {fmtClock(recentRollover.scheduledTime)}
          </span>
        </button>
      )}
      <style>{`
        @keyframes tm-rollover-flash {
          0% { box-shadow: 0 0 0 0 rgba(212, 102, 58, 0.6); }
          70% { box-shadow: 0 0 0 12px rgba(212, 102, 58, 0); }
          100% { box-shadow: 0 0 0 0 rgba(212, 102, 58, 0); }
        }
      `}</style>

      {upcoming.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {upcoming.map(t => {
            const absoluteDate = t.when.toLocaleDateString('en', { month: 'short', day: 'numeric' }).toLowerCase();
            return (
              <div
                key={t.id}
                draggable
                onDragStart={(ev) => {
                  ev.dataTransfer.setData('text/task-id', t.id);
                  ev.dataTransfer.effectAllowed = 'move';
                }}
                style={{
                  padding: '6px 0',
                  borderBottom: '1px solid var(--rule-soft)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  cursor: 'grab',
                }}
              >
                <button
                  type="button"
                  onClick={() => onJumpToDate?.(new Date(`${t.dayKey}T00:00:00`))}
                  title={`jump to ${absoluteDate}`}
                  style={{
                    all: 'unset',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <span style={{ fontSize: 14, color: 'var(--ink)' }}>{t.text}</span>
                  <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
                    {absoluteDate} · {fmtClock(t.when.toISOString())} · {fmtRelative(t.dayKey)}
                  </span>
                </button>
                {onReschedule && (
                  <input
                    type="date"
                    className="tm-composer-num"
                    value={t.dayKey}
                    onChange={(e) => {
                      const nextKey = e.target.value;
                      if (!nextKey) return;
                      // Preserve time-of-day
                      const [y, m, d] = nextKey.split('-').map(Number);
                      const next = new Date(y, (m || 1) - 1, d || 1, t.when.getHours(), t.when.getMinutes(), 0, 0);
                      onReschedule(t.id, next.toISOString());
                    }}
                    title="move to a different day (keeps time-of-day)"
                    style={{ fontSize: 11, width: 130, alignSelf: 'flex-start' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
