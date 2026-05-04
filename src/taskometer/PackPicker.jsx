import React, { useMemo, useState } from 'react';
import { TASK_PACKS, groupPacks } from '../defaults/taskPacks';

/**
 * PackPicker — modal for adopting a curated task pack.
 *
 * Two flows:
 *   1. "Add to inbox" — drops the pack's tasks unscheduled into the
 *      inbox so the user can plan them when ready.
 *   2. "Schedule today" — drops them with scheduledTime = now-ish so
 *      auto-schedule places them in matching blocks today.
 *
 * Each pack card is expandable so the user sees the actual tasks
 * before committing, and can deselect individual tasks they don't
 * want. No surprise content.
 */
export default function PackPicker({ onClose, onAddToInbox, onScheduleToday }) {
  const groups = useMemo(() => groupPacks(TASK_PACKS), []);
  const [openId, setOpenId] = useState(null);
  const [excluded, setExcluded] = useState({}); // packId -> Set<taskIndex>

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
    <div className="tm-modal-backdrop" onMouseDown={onClose}>
      <div
        className="tm-modal"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="task packs"
        style={{ maxWidth: 720 }}
      >
        <div className="tm-modal-head">
          <div className="tm-modal-title">Task packs</div>
          <button type="button" onClick={onClose} className="tm-btn tm-sm">close</button>
        </div>
        <div className="tm-mono tm-md" style={{ marginBottom: 14, color: 'var(--ink-mute)' }}>
          curated starter sets for common situations · expand to review · uncheck anything you don't want.
        </div>

        {groups.map(({ category, items }) => (
          <div key={category} style={{ marginBottom: 18 }}>
            <div
              className="tm-mono tm-sm"
              style={{
                color: 'var(--orange)',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              {category}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(pack => {
                const isOpen = openId === pack.id;
                const remaining = remainingTasks(pack);
                return (
                  <div
                    key={pack.id}
                    style={{
                      border: '1px solid var(--rule)',
                      borderRadius: 10,
                      background: 'var(--paper)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : pack.id)}
                      style={{
                        all: 'unset',
                        cursor: 'pointer',
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <span style={{ fontSize: 20 }}>{pack.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
                          {pack.name}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.4 }}>
                          {pack.description}
                        </div>
                      </div>
                      <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
                        {remaining.length}/{pack.tasks.length}
                      </span>
                      <span aria-hidden style={{ color: 'var(--ink-mute)', fontSize: 14 }}>
                        {isOpen ? '▾' : '▸'}
                      </span>
                    </button>

                    {isOpen && (
                      <div style={{ borderTop: '1px solid var(--rule-soft)', padding: '10px 14px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {pack.tasks.map((t, i) => {
                            const isExcluded = (excluded[pack.id] || new Set()).has(i);
                            return (
                              <label
                                key={i}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10,
                                  fontSize: 13,
                                  cursor: 'pointer',
                                  color: isExcluded ? 'var(--ink-mute)' : 'var(--ink)',
                                  textDecoration: isExcluded ? 'line-through' : 'none',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={!isExcluded}
                                  onChange={() => toggleExclude(pack.id, i)}
                                />
                                <span style={{ flex: 1, minWidth: 0 }}>{t.text}</span>
                                <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
                                  {t.duration}m · {t.primaryType}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="tm-btn tm-primary tm-sm"
                            onClick={() => {
                              onAddToInbox?.(remaining);
                              onClose?.();
                            }}
                            disabled={remaining.length === 0}
                          >
                            Add {remaining.length} to inbox
                          </button>
                          {onScheduleToday && (
                            <button
                              type="button"
                              className="tm-btn tm-sm"
                              onClick={() => {
                                onScheduleToday(remaining);
                                onClose?.();
                              }}
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
          </div>
        ))}
      </div>
    </div>
  );
}
