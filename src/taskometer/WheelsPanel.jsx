import React, { useState } from 'react';
import { STARTER_WHEELS } from '../services/api/TaskometerAPI';
import { resolveTypeColor } from './Composers.jsx';

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
  const [applyMode, setApplyMode] = useState('single'); // 'single' | 'range'
  const [singleDate, setSingleDate] = useState(todayYMD());
  const [rangeStart, setRangeStart] = useState(todayYMD());
  const [rangeEnd, setRangeEnd] = useState(addDays(todayYMD(), 6));
  const [rangeFilter, setRangeFilter] = useState('all'); // 'all' | 'weekdays' | 'weekends'
  const [mergeMode, setMergeMode] = useState('replace'); // 'replace' | 'merge'

  const saveFromToday = async () => {
    const name = window.prompt('name this wheel (e.g. "weekday", "weekend", "vacation"):');
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
    if (!window.confirm('delete this wheel? day assignments to it are cleared.')) return;
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
        aria-label="manage wheels"
        style={{ maxWidth: 720 }}
      >
        <div className="tm-modal-head">
          <div className="tm-modal-title">wheels — day templates</div>
          <button type="button" onClick={onClose} className="tm-btn tm-sm">close</button>
        </div>

        <div className="tm-mono tm-md" style={{ marginBottom: 10 }}>
          wheels save the shape of a day. apply one to any date or range to paint its blocks in.
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          <button className="tm-btn tm-primary tm-sm" onClick={saveFromToday}>
            + save today as wheel
          </button>
          <button className="tm-btn tm-sm" onClick={() => { setCreating(true); setEditingId(null); setApplyTarget(null); }}>
            + blank wheel
          </button>
          <button className="tm-btn tm-sm tm-ghost" onClick={seedStarters}>
            + add starter wheels
          </button>
        </div>

        {creating && (
          <div className="tm-card tm-dashed" style={{ padding: '10px 12px', marginBottom: 12 }}>
            <div className="tm-mono tm-md" style={{ marginBottom: 6 }}>new wheel</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                className="tm-composer-input"
                placeholder="name"
                value={newDraft.name}
                onChange={(e) => setNewDraft({ ...newDraft, name: e.target.value })}
                autoFocus
                style={{ minWidth: 200 }}
              />
              <div className="tm-palette">
                {PALETTE.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`tm-swatch${newDraft.color === c ? ' tm-swatch-on' : ''}`}
                    style={{ background: c }}
                    onClick={() => setNewDraft({ ...newDraft, color: c })}
                  />
                ))}
              </div>
              <button className="tm-btn tm-primary tm-sm" onClick={createEmpty} disabled={!newDraft.name.trim()}>create</button>
              <button className="tm-btn tm-sm" onClick={() => setCreating(false)}>cancel</button>
            </div>
          </div>
        )}

        {wheels.length === 0 && !creating && (
          <div className="tm-card tm-dashed" style={{ padding: '16px 18px', marginBottom: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 22 }}>no wheels yet</div>
            <div className="tm-mono tm-md" style={{ marginTop: 4 }}>
              shape today how you want it, then use "save today as wheel". or grab starter wheels above.
            </div>
          </div>
        )}

        <div className="tm-type-list">
          {wheels.map(w => {
            const isEditing = editingId === w.id;
            const isApplying = applyTarget && applyTarget.wheelId === w.id;
            if (isEditing) {
              return (
                <div key={w.id} className="tm-type-row tm-type-row-edit">
                  <input
                    className="tm-composer-input"
                    style={{ flex: '1 1 160px', fontSize: 18 }}
                    value={editDraft.name}
                    onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                  />
                  <div className="tm-palette">
                    {PALETTE.map(c => (
                      <button
                        key={c}
                        type="button"
                        className={`tm-swatch${editDraft.color === c ? ' tm-swatch-on' : ''}`}
                        style={{ background: c }}
                        onClick={() => setEditDraft({ ...editDraft, color: c })}
                      />
                    ))}
                  </div>
                  <button className="tm-btn tm-primary tm-sm" onClick={saveEdit}>save</button>
                  <button className="tm-btn tm-sm" onClick={() => setEditingId(null)}>cancel</button>
                </div>
              );
            }
            return (
              <div key={w.id} className="tm-type-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span className="tm-type-swatch" style={{ background: w.color }} />
                  <span className="tm-type-name">{w.name}</span>
                  <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>
                    {w.blocks.length} block{w.blocks.length === 1 ? '' : 's'}
                  </span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    <button
                      className="tm-btn tm-primary tm-sm"
                      onClick={() => {
                        setApplyTarget({ wheelId: w.id });
                        setEditingId(null);
                      }}
                    >
                      apply
                    </button>
                    <button
                      className="tm-btn tm-sm"
                      onClick={() => {
                        setEditingId(w.id);
                        setEditDraft({ name: w.name, color: w.color });
                        setApplyTarget(null);
                      }}
                    >
                      rename
                    </button>
                    <button className="tm-btn tm-sm tm-danger" onClick={() => removeWheel(w.id)}>delete</button>
                  </div>
                </div>
                {w.blocks.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                    {w.blocks.map((b, i) => {
                      const c = b.color || resolveTypeColor(taskTypes, b.slotType) || '#94A3B8';
                      return (
                        <span
                          key={i}
                          className="tm-mono tm-sm"
                          style={{
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: hexA(c, 0.18),
                            border: `1px solid ${c}`,
                            color: 'var(--ink)',
                          }}
                          title={`${b.label || b.slotType} · ${b.startTime}–${b.endTime}`}
                        >
                          {b.startTime}–{b.endTime} {b.label || b.slotType || ''}
                        </span>
                      );
                    })}
                  </div>
                )}

                {isApplying && (
                  <div className="tm-card tm-dashed" style={{ padding: '10px 12px', marginTop: 8 }}>
                    <div className="tm-mono tm-md" style={{ marginBottom: 6 }}>apply "{w.name}"</div>
                    <div className="tm-seg" style={{ marginBottom: 8 }}>
                      <button
                        className={applyMode === 'single' ? 'tm-on' : ''}
                        onClick={() => setApplyMode('single')}
                      >single day</button>
                      <button
                        className={applyMode === 'range' ? 'tm-on' : ''}
                        onClick={() => setApplyMode('range')}
                      >date range</button>
                    </div>

                    {applyMode === 'single' ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          type="date"
                          className="tm-composer-num"
                          value={singleDate}
                          onChange={(e) => setSingleDate(e.target.value)}
                          style={{ width: 160 }}
                        />
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          type="date"
                          className="tm-composer-num"
                          value={rangeStart}
                          onChange={(e) => setRangeStart(e.target.value)}
                          style={{ width: 160 }}
                        />
                        <span className="tm-mono tm-md">–</span>
                        <input
                          type="date"
                          className="tm-composer-num"
                          value={rangeEnd}
                          onChange={(e) => setRangeEnd(e.target.value)}
                          style={{ width: 160 }}
                        />
                        <div className="tm-seg">
                          {['all', 'weekdays', 'weekends'].map(f => (
                            <button
                              key={f}
                              className={rangeFilter === f ? 'tm-on' : ''}
                              onClick={() => setRangeFilter(f)}
                            >{f}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                      <div className="tm-seg">
                        <button
                          className={mergeMode === 'replace' ? 'tm-on' : ''}
                          onClick={() => setMergeMode('replace')}
                          title="clear the day's existing slots, then apply"
                        >replace</button>
                        <button
                          className={mergeMode === 'merge' ? 'tm-on' : ''}
                          onClick={() => setMergeMode('merge')}
                          title="layer on top of existing slots (overlap allowed)"
                        >merge</button>
                      </div>
                      <button className="tm-btn tm-primary tm-sm" onClick={apply}>apply</button>
                      <button className="tm-btn tm-sm" onClick={() => setApplyTarget(null)}>cancel</button>
                    </div>
                    <div className="tm-mono tm-sm" style={{ marginTop: 6, color: 'var(--ink-mute)' }}>
                      days marked sick/holiday/vacation are skipped.
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
