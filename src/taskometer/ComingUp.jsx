import { useMemo } from 'react';
import { TaskRow } from './shared.jsx';
import PlaceMenu from './PlaceMenu.jsx';
import { formatYMD } from '../utils/time.js';
import './screens.css';

function relativeDay(dayKey) {
  const target = new Date(`${dayKey}T00:00:00`);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff > 1 && diff <= 6) return target.toLocaleDateString('en', { weekday: 'long' }).toLowerCase();
  if (diff < 0 && diff >= -6) return `${-diff}d ago`;
  return target.toLocaleDateString('en', { month: 'short', day: 'numeric' }).toLowerCase();
}

function clock(d) {
  const h = d.getHours();
  const m = d.getMinutes();
  return `${(h % 12) || 12}${m ? ':' + (m < 10 ? '0' + m : m) : ''}${h < 12 ? 'a' : 'p'}`;
}

/**
 * ComingUp — tasks scheduled on a day other than the one in view.
 * Click a row to jump there; "place" moves it somewhere else.
 */
export default function ComingUp({
  tasks = [],
  selectedDate,
  onJumpToDate,
  onToggle,
  daySlots = [],
  dayKey,
  onPlaceInSlot,
  onPlaceOnDate,
  recentRollover,
  limit = 8,
}) {
  const selectedKey = formatYMD(selectedDate);

  const upcoming = useMemo(() => (tasks || [])
    .filter(t => t?.status !== 'completed' && t?.status !== 'cancelled' && !!t.scheduledTime)
    .map(t => {
      const when = new Date(t.scheduledTime);
      return { id: t.id || t.key, text: t.text || t.title || 'untitled', when, dayKey: formatYMD(when), priority: t.priority, tags: t.tags };
    })
    .filter(x => x.dayKey !== selectedKey && x.dayKey > selectedKey)
    .sort((a, b) => a.when.getTime() - b.when.getTime())
    .slice(0, limit), [tasks, selectedKey, limit]);

  if (upcoming.length === 0 && !recentRollover) return null;

  return (
    <div className="tm-rail" role="region" aria-label="coming up" data-onboard="coming-up">
      <div className="tm-rail-head">
        <span className="tm-rail-title">Coming up</span>
        <span className="tm-mono tm-sm">{upcoming.length}</span>
      </div>
      <div className="tm-mono tm-sm tm-rail-hint">on later days — click to jump, or place it elsewhere.</div>

      {recentRollover && (
        <button
          type="button"
          className="tm-rollover"
          onClick={() => onJumpToDate?.(new Date(`${recentRollover.dayKey}T00:00:00`))}
          title={`jump to ${relativeDay(recentRollover.dayKey)}`}
        >
          <span className="tm-mono tm-sm tm-rollover-eyebrow">→ just rolled forward</span>
          <span className="tm-rollover-text">{recentRollover.text}</span>
          <span className="tm-mono tm-sm">{relativeDay(recentRollover.dayKey)} · {clock(new Date(recentRollover.scheduledTime))}</span>
        </button>
      )}

      {upcoming.length > 0 && (
        <div className="tm-rail-list tm-rail-list-tight">
          {upcoming.map(t => (
            <TaskRow
              key={t.id}
              compact
              task={{
                id: t.id,
                title: t.text,
                ctx: relativeDay(t.dayKey),
                when: `${t.when.toLocaleDateString('en', { month: 'short', day: 'numeric' }).toLowerCase()} · ${clock(t.when)}`,
                priority: t.priority,
                tags: t.tags,
              }}
              onToggle={onToggle}
              onClick={() => onJumpToDate?.(new Date(`${t.dayKey}T00:00:00`))}
              extraActions={(onPlaceOnDate || onPlaceInSlot) ? (
                <PlaceMenu taskId={t.id} daySlots={daySlots} dayKey={dayKey} onPlaceInSlot={onPlaceInSlot} onPlaceOnDate={onPlaceOnDate} label="move ▾" />
              ) : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
