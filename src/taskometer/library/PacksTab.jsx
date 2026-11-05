import React, { useMemo, useState } from 'react';
import { TASK_PACKS, groupPacks } from '../../defaults/taskPacks';

/**
 * Curated starter task packs. Expand a pack to review its tasks,
 * untick anything unwanted, then send the rest to the inbox or let
 * auto-schedule place them today.
 */
export default function PacksTab({ onAddToInbox, onScheduleToday }) {
  const groups = useMemo(() => groupPacks(TASK_PACKS), []);
  const [openId, setOpenId] = useState(null);
  const [excluded, setExcluded] = useState({});

  const toggleExclude = (packId, idx) => {
    setExcluded(prev => {
      const set = new Set(prev[packId] || []);
      if (set.has(idx)) set.delete(idx); else set.add(idx);
      return { ...prev, [packId]: set };
    });
  };
  const remainingTasks = (pack) => {
    const ex = excluded[pack.id] || new Set();
    return pack.tasks.filter((_, i) => !ex.has(i));
  };

  return (
    <div className="tm-library-tab">
      <p className="tm-library-lede tm-mono tm-md">
        curated starter sets for common situations · expand to review · untick anything you don't want.
      </p>
      {groups.map(({ category, items }) => (
        <section key={category} className="tm-picker-section">
          <div className="tm-picker-eyebrow tm-accent">{category}</div>
          <div className="tm-pack-list">
            {items.map(pack => {
              const isOpen = openId === pack.id;
              const remaining = remainingTasks(pack);
              return (
                <div key={pack.id} className="tm-pack">
                  <button type="button" className="tm-pack-head" onClick={() => setOpenId(isOpen ? null : pack.id)} aria-expanded={isOpen}>
                    <span aria-hidden className="tm-pack-icon">{pack.icon}</span>
                    <div className="tm-picker-card-body">
                      <div className="tm-routine-name">{pack.name}</div>
                      <div className="tm-routine-blurb">{pack.description}</div>
                    </div>
                    <span className="tm-mono tm-sm">{remaining.length}/{pack.tasks.length}</span>
                    <span aria-hidden className="tm-pack-chevron">{isOpen ? '▾' : '▸'}</span>
                  </button>
                  {isOpen && (
                    <div className="tm-pack-body">
                      {pack.tasks.map((t, i) => {
                        const isExcluded = (excluded[pack.id] || new Set()).has(i);
                        return (
                          <label key={i} className={`tm-pack-task${isExcluded ? ' tm-excluded' : ''}`}>
                            <input type="checkbox" checked={!isExcluded} onChange={() => toggleExclude(pack.id, i)} />
                            <span className="tm-pack-task-text">{t.text}</span>
                            <span className="tm-mono tm-sm">{t.duration}m · {t.primaryType}</span>
                          </label>
                        );
                      })}
                      <div className="tm-pack-actions">
                        <button type="button" className="tm-btn tm-primary tm-sm" onClick={() => onAddToInbox?.(remaining)} disabled={remaining.length === 0}>
                          Add {remaining.length} to inbox
                        </button>
                        {onScheduleToday && (
                          <button
                            type="button"
                            className="tm-btn tm-sm"
                            onClick={() => onScheduleToday(remaining)}
                            disabled={remaining.length === 0}
                            title="schedules each task into matching blocks today via auto-schedule"
                          >
                            Schedule today
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
