import React, { useState } from 'react';
import { STARTER_WHEELS } from '../services/api/TaskometerAPI';
import { resolveTypeColor } from './Composers.jsx';
import { MiniWheel } from './WheelView.jsx';

const PALETTE = [
  '#D4663A', '#A8BF8C', '#D9C98C', '#C7BEDD', '#F2C4A6',
  '#6B46C1', '#3B82F6', '#10B981', '#EC4899', '#F59E0B',
  '#14B8A6', '#EF4444', '#78716C', '#06B6D4', '#8B5CF6',
];

function todayYMD() {
  const d = new Date();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

function addDays(dateKey, delta) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  const mm = date.getMonth() + 1;
  const dd = date.getDate();
  return `${date.getFullYear()}-${mm < 10 ? '0' + mm : mm}-${dd < 10 ? '0' + dd : dd}`;
}

export default function WheelsPanel({ api, wheels = [], taskTypes = [], onClose }) {
  const [creating, setCreating] = useState(false);
  const [newDraft, setNewDraft] = useState({ name: '', color: PALETTE[0] });
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: '', color: PALETTE[0] });
  const [applyTarget, setApplyTarget] = useState(null); // {wheelId}
  const [expandedId, setExpandedId] = useState(null); // which row shows blocks
  const [menuOpenId, setMenuOpenId] = useState(null); // which row's overflow menu is open
  const [applyMode, setApplyMode] = useState('single'); // 'single' | 'range'
  const [singleDate, setSingleDate] = useState(todayYMD());
  const [rangeStart, setRangeStart] = useState(todayYMD());
  const [rangeEnd, setRangeEnd] = useState(addDays(todayYMD(), 6));
  const [rangeFilter, setRangeFilter] = useState('all'); // 'all' | 'weekdays' | 'weekends'
  const [mergeMode, setMergeMode] = useState('replace'); // 'replace' | 'merge'

  const saveFromToday = async () => {
    const name = window.prompt('name this schedule (e.g. "weekday", "weekend", "vacation"):');
    if (!name) return;
    await api.wheels.saveFromDate(todayYMD(), { name: name.trim(), color: PALETTE[(wheels.length) % PALETTE.length] });
  };

  const seedStarters = async () => {
    for (const w of STARTER_WHEELS) {
      if (wheels.some(x => x.name === w.name)) continue;
      // eslint-disable-next-line no-await-in-loop
      await api.wheels.add(w);
    }
  };

  const createEmpty = async () => {
    const name = newDraft.name.trim();
    if (!name) return;
    await api.wheels.add({ name, color: newDraft.color, blocks: [] });
    setCreating(false);
    setNewDraft({ name: '', color: PALETTE[0] });
  };

  const removeWheel = async (id) => {
    if (!window.confirm('delete this schedule? day assignments to it are cleared.')) return;
    await api.wheels.remove(id);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const name = editDraft.name.trim();
    if (!name) return;
    await api.wheels.update(editingId, { name, color: editDraft.color });
    setEditingId(null);
  };

  const apply = async () => {
    if (!applyTarget) return;
    if (applyMode === 'single') {
      await api.wheels.applyToDate(applyTarget.wheelId, singleDate, { mode: mergeMode });
    } else {
      await api.wheels.applyToRange(applyTarget.wheelId, rangeStart, rangeEnd, {
        weekdaysOnly: rangeFilter === 'weekdays',
        weekendsOnly: rangeFilter === 'weekends',
        mode: mergeMode,
      });
    }
    setApplyTarget(null);
  };

  return (
    <div className="tm-modal-backdrop" onMouseDown={onClose}>
      <div
        className="tm-modal"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="manage schedules"
        style={{ maxWidth: 640 }}
      >
        <div className="tm-modal-head">
          <div className="tm-modal-title">Schedules</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              className="tm-btn tm-primary tm-sm"
              onClick={saveFromToday}
              title="save today's blocks as a reusable schedule"
            >
              + from today
            </button>
            <button
              className="tm-btn tm-sm"
              onClick={() => { setCreating(true); setEditingId(null); setApplyTarget(null); }}
              title="create an empty schedule and edit blocks later"
            >
              blank
            </button>
            <button type="button" onClick={onClose} className="tm-btn tm-sm">close</button>
          </div>
        </div>

        {creating && (
          <div style={{ padding: '10px 12px', marginBottom: 10, background: 'var(--paper-warm, #FAF5EC)', borderRadius: 8, border: '1px dashed var(--rule)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                className="tm-composer-input"
                placeholder="name"
                value={newDraft.name}
                onChange={(e) => setNewDraft({ ...newDraft, name: e.target.value })}
                autoFocus
                style={{ flex: '1 1 200px' }}
              />
              <input
                type="color"
                value={newDraft.color}
                onChange={(e) => setNewDraft({ ...newDraft, color: e.target.value })}
                style={{ width: 32, height: 28, padding: 0, border: '1px solid var(--rule)', borderRadius: 4, cursor: 'pointer' }}
                title="pick a color"
              />
              <button className="tm-btn tm-primary tm-sm" onClick={createEmpty} disabled={!newDraft.name.trim()}>create</button>
              <button className="tm-btn tm-sm" onClick={() => setCreating(false)}>cancel</button>
            </div>
          </div>
        )}

        {wheels.length === 0 && !creating && (
          <div style={{ padding: '24px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>No schedules yet</div>
            <div className="tm-mono tm-sm" style={{ marginTop: 6, color: 'var(--ink-mute)' }}>
              shape today, then "+ from today" — or grab a starter set below.
            </div>
            <button
              className="tm-btn tm-sm tm-ghost"
              onClick={seedStarters}
              style={{ marginTop: 12 }}
            >
              + add starter schedules
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {wheels.map(w => {
            const isEditing = editingId === w.id;
            const isApplying = applyTarget && applyTarget.wheelId === w.id;
            const isExpanded = expandedId === w.id;
            const isMenuOpen = menuOpenId === w.id;
            const slotsForMini = (w.blocks || []).map(b => ({
              startTime: b.startTime,
              endTime: b.endTime,
              color: b.color,
            }));
            if (isEditing) {
              return (
                <div
                  key={w.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 12px',
                    border: '1.5px solid var(--orange)',
                    borderRadius: 8,
                    background: 'var(--paper-warm, #FAF5EC)',
                    flexWrap: 'wrap',
                  }}
                >
                  <input
                    className="tm-composer-input"
                    style={{ flex: '1 1 160px' }}
                    value={editDraft.name}
                    onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                    autoFocus
                  />
                  <input
                    type="color"
                    value={editDraft.color}
                    onChange={(e) => setEditDraft({ ...editDraft, color: e.target.value })}
                    style={{ width: 32, height: 28, padding: 0, border: '1px solid var(--rule)', borderRadius: 4, cursor: 'pointer' }}
                  />
                  <button className="tm-btn tm-primary tm-sm" onClick={saveEdit}>save</button>
                  <button className="tm-btn tm-sm" onClick={() => setEditingId(null)}>cancel</button>
                </div>
              );
            }
            return (
              <div
                key={w.id}
                style={{
                  border: '1px solid var(--rule)',
                  borderLeft: `4px solid ${w.color}`,
                  borderRadius: 8,
                  background: 'var(--paper)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setExpandedId(isExpanded ? null : w.id);
                    setMenuOpenId(null);
                  }}
                  title="click to view blocks"
                >
                  <MiniWheel slots={slotsForMini} size={28} thickness={4} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                      {w.name}
                    </div>
                    <div className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', fontSize: 11 }}>
                      {w.blocks.length} block{w.blocks.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <button
                    className="tm-btn tm-primary tm-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setApplyTarget({ wheelId: w.id });
                      setEditingId(null);
                      setMenuOpenId(null);
                    }}
                  >
                    apply
                  </button>
                  <button
                    className="tm-btn tm-sm tm-ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(isMenuOpen ? null : w.id);
                    }}
                    aria-label="more actions"
                    style={{ padding: '2px 8px', fontSize: 16, lineHeight: 1 }}
                  >
                    ⋯
                  </button>
                </div>

                {isMenuOpen && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 4,
                      padding: '6px 12px 8px',
                      borderTop: '1px solid var(--rule-soft)',
                      background: 'var(--paper-warm, #FAF5EC)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="tm-btn tm-sm"
                      onClick={() => {
                        setEditingId(w.id);
                        setEditDraft({ name: w.name, color: w.color });
                        setApplyTarget(null);
                        setMenuOpenId(null);
                      }}
                    >
                      rename
                    </button>
                    <button
                      className="tm-btn tm-sm tm-danger"
                      onClick={() => { removeWheel(w.id); setMenuOpenId(null); }}
                    >
                      delete
                    </button>
                  </div>
                )}

                {isExpanded && w.blocks.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      padding: '8px 12px',
                      borderTop: '1px solid var(--rule-soft)',
                      background: 'var(--paper-warm, #FAF5EC)',
                    }}
                  >
                    {w.blocks.slice().sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')).map((b, i) => {
                      const c = b.color || resolveTypeColor(taskTypes, b.slotType) || '#94A3B8';
                      return (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 12,
                          }}
                        >
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: c, flexShrink: 0 }} />
                          <span className="tm-mono" style={{ fontSize: 11, color: 'var(--ink-mute)', minWidth: 90 }}>
                            {b.startTime}–{b.endTime}
                          </span>
                          <span style={{ color: 'var(--ink)' }}>{b.label || b.slotType || 'block'}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {isApplying && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderTop: '1px solid var(--rule-soft)',
                      background: 'var(--paper-warm, #FAF5EC)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div className="tm-seg">
                        <button
                          className={applyMode === 'single' ? 'tm-on' : ''}
                          onClick={() => setApplyMode('single')}
                        >day</button>
                        <button
                          className={applyMode === 'range' ? 'tm-on' : ''}
                          onClick={() => setApplyMode('range')}
                        >range</button>
                      </div>
                      {applyMode === 'single' ? (
                        <input
                          type="date"
                          className="tm-composer-num"
                          value={singleDate}
                          onChange={(e) => setSingleDate(e.target.value)}
                          style={{ width: 140 }}
                        />
                      ) : (
                        <>
                          <input
                            type="date"
                            className="tm-composer-num"
                            value={rangeStart}
                            onChange={(e) => setRangeStart(e.target.value)}
                            style={{ width: 140 }}
                          />
                          <span className="tm-mono">–</span>
                          <input
                            type="date"
                            className="tm-composer-num"
                            value={rangeEnd}
                            onChange={(e) => setRangeEnd(e.target.value)}
                            style={{ width: 140 }}
                          />
                          <div className="tm-seg">
                            {['all', 'wkdy', 'wknd'].map((f, i) => (
                              <button
                                key={f}
                                className={rangeFilter === ['all', 'weekdays', 'weekends'][i] ? 'tm-on' : ''}
                                onClick={() => setRangeFilter(['all', 'weekdays', 'weekends'][i])}
                                style={{ fontSize: 11 }}
                              >{f}</button>
                            ))}
                          </div>
                        </>
                      )}
                      <div className="tm-seg" style={{ marginLeft: 'auto' }}>
                        <button
                          className={mergeMode === 'replace' ? 'tm-on' : ''}
                          onClick={() => setMergeMode('replace')}
                          title="clear existing blocks first"
                          style={{ fontSize: 11 }}
                        >replace</button>
                        <button
                          className={mergeMode === 'merge' ? 'tm-on' : ''}
                          onClick={() => setMergeMode('merge')}
                          title="layer on top"
                          style={{ fontSize: 11 }}
                        >merge</button>
                      </div>
                      <button className="tm-btn tm-primary tm-sm" onClick={apply}>apply</button>
                      <button className="tm-btn tm-sm" onClick={() => setApplyTarget(null)}>cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function hexA(hex, a) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
