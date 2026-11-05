import { useMemo } from 'react';
import { TaskRow } from './shared.jsx';
import PlaceMenu from './PlaceMenu.jsx';
import { formatYMD } from '../utils/time.js';
import './screens.css';

function clock(d) {
  const h = d.getHours();
  const m = d.getMinutes();
  return `${(h % 12) || 12}${m ? ':' + (m < 10 ? '0' + m : m) : ''}${h < 12 ? 'a' : 'p'}`;
}

function relativePast(dayKey, todayKey) {
  const a = new Date(`${dayKey}T00:00:00`);
  const b = new Date(`${todayKey}T00:00:00`);
  const diff = Math.round((a.getTime() - b.getTime()) / 86400000);
  if (diff === 0) return 'earlier today';
  if (diff === -1) return 'yesterday';
  if (diff >= -7 && diff < 0) return `${-diff}d ago`;
  return a.toLocaleDateString('en', { month: 'short', day: 'numeric' }).toLowerCase();
}

/**
 * Snoozed — scheduled, not done, and the time has passed. Finish it,
 * push it to tomorrow, place it somewhere specific, or drop it.
 */
export default function Snoozed({
  tasks = [],
  onToggle,
  onDelete,
  onPushTomorrow,
  daySlots = [],
  dayKey,
  onPlaceInSlot,
  onPlaceOnDate,
  limit = 8,
}) {
  const { items, todayKey } = useMemo(() => {
    const now = new Date();
    const todayKey = formatYMD(now);
    const items = (tasks || [])
      .filter(t => t?.status !== 'completed' && t?.status !== 'cancelled' && !!t.scheduledTime)
      .map(t => {
        const when = new Date(t.scheduledTime);
        if (Number.isNaN(when.getTime())) return null;
        const dur = typeof t.duration === 'number' ? t.duration : 30;
        const key = formatYMD(when);
        const past = key < todayKey || (key === todayKey && when.getTime() + dur * 60000 < now.getTime());
        if (!past) return null;
        return { id: t.id || t.key, text: t.text || t.title || 'untitled', when, dayKey: key, priority: t.priority, tags: t.tags };
      })
      .filter(Boolean)
      .sort((a, b) => a.when.getTime() - b.when.getTime())
      .slice(0, limit);
    return { items, todayKey };
  }, [tasks, limit]);

  if (items.length === 0) return null;

  return (
    <div className="tm-rail tm-rail-alert" role="region" aria-label="snoozed" data-onboard="snoozed">
      <div className="tm-rail-head">
        <span className="tm-rail-title">Snoozed</span>
        <span className="tm-mono tm-sm tm-accent">{items.length}</span>
      </div>
      <div className="tm-mono tm-sm tm-rail-hint">time passed, not done — finish, push, or place.</div>

      <div className="tm-rail-list tm-rail-list-tight">
        {items.map(it => (
          <TaskRow
            key={it.id}
            compact
            task={{ id: it.id, title: it.text, ctx: relativePast(it.dayKey, todayKey), when: clock(it.when), priority: it.priority, tags: it.tags, warn: true }}
            onToggle={onToggle}
            onDelete={onDelete}
            extraActions={(
              <>
                <button type="button" onClick={() => onPushTomorrow?.(it.id, it.when)} title="push to tomorrow, same time">tmrw →</button>
                {(onPlaceOnDate || onPlaceInSlot) && (
                  <PlaceMenu taskId={it.id} daySlots={daySlots} dayKey={dayKey} onPlaceInSlot={onPlaceInSlot} onPlaceOnDate={onPlaceOnDate} />
                )}
              </>
            )}
          />
        ))}
      </div>
    </div>
  );
}
