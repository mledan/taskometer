import React, { useState } from 'react';
import { STARTER_WHEELS } from '../../services/api/TaskometerAPI';
import { resolveTypeColor } from '../Composers.jsx';
import { MiniWheel } from '../WheelView.jsx';
import { formatYMD, parseYMD } from '../../utils/time.js';

const PALETTE = [
  '#D4663A', '#A8BF8C', '#D9C98C', '#C7BEDD', '#F2C4A6',
  '#6B46C1', '#3B82F6', '#10B981', '#EC4899', '#F59E0B',
  '#14B8A6', '#EF4444', '#78716C', '#06B6D4', '#8B5CF6',
];

const todayYMD = () => formatYMD(new Date());
function addDays(dateKey, delta) {
  const d = parseYMD(dateKey);
  d.setDate(d.getDate() + delta);
  return formatYMD(d);
}

/**
 * Manage the user's own schedules: create, rename, delete, inspect
 * blocks, apply to a date or range. Rendered as the "manage" mode of
 * the Library's Schedules tab.
 */
export default function ScheduleManager({ api, wheels = [], taskTypes = [] }) {
  const [creating, setCreating] = useState(false);
  const [newDraft, setNewDraft] = useState({ name: '', color: PALETTE[0] });
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: '', color: PALETTE[0] });
  const [applyTarget, setApplyTarget] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [applyMode, setApplyMode] = useState('single');
  const [singleDate, setSingleDate] = useState(todayYMD());
  const [rangeStart, setRangeStart] = useState(todayYMD());
  const [rangeEnd, setRangeEnd] = useState(addDays(todayYMD(), 6));
  const [rangeFilter, setRangeFilter] = useState('all');
  const [mergeMode, setMergeMode] = useState('replace');
  const [savingFromToday, setSavingFromToday] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const saveFromToday = async () => {
    const name = saveName.trim();
    if (!name) return;
    await api.wheels.saveFromDate(todayYMD(), { name, color: PALETTE[wheels.length % PALETTE.length] });
    setSavingFromToday(false);
    setSaveName('');
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
    await api.wheels.remove(id);
    setConfirmDeleteId(null);
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
    <div className="tm-manager">
      <div className="tm-manager-toolbar">
        <button
          className="tm-btn tm-primary tm-sm"
          onClick={() => { setSavingFromToday(v => !v); setCreating(false); }}
          title="save today's blocks as a reusable schedule"
        >
          + from today
        </button>
        <button
          className="tm-btn tm-sm"
          onClick={() => { setCreating(v => !v); setSavingFromToday(false); setEditingId(null); setApplyTarget(null); }}
          title="create an empty schedule and edit blocks later"
        >
          blank
        </button>
      </div>

      {savingFromToday && (
        <div className="tm-manager-draft">
          <input
            className="tm-composer-input"
            placeholder='name this schedule (e.g. "weekday", "vacation")'
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveFromToday(); if (e.key === 'Escape') setSavingFromToday(false); }}
            autoFocus
          />
          <button className="tm-btn tm-primary tm-sm" onClick={saveFromToday} disabled={!saveName.trim()}>Save</button>
          <button className="tm-btn tm-sm" onClick={() => setSavingFromToday(false)}>Cancel</button>
        </div>
      )}

      {creating && (
        <div className="tm-manager-draft">
          <input
            className="tm-composer-input"
            placeholder="name"
            value={newDraft.name}
            onChange={(e) => setNewDraft({ ...newDraft, name: e.target.value })}
            autoFocus
          />
          <input
            type="color"
            className="tm-color-swatch"
            value={newDraft.color}
            onChange={(e) => setNewDraft({ ...newDraft, color: e.target.value })}
            title="pick a color"
          />
          <button className="tm-btn tm-primary tm-sm" onClick={createEmpty} disabled={!newDraft.name.trim()}>Create</button>
          <button className="tm-btn tm-sm" onClick={() => setCreating(false)}>Cancel</button>
        </div>
      )}

      {wheels.length === 0 && !creating && (
        <div className="tm-manager-empty">
          <div className="tm-manager-empty-title">No schedules yet</div>
          <div className="tm-mono tm-sm">
            shape today, then "+ from today" — or grab a starter set below.
          </div>
          <button className="tm-btn tm-sm tm-ghost" onClick={seedStarters}>+ add starter schedules</button>
        </div>
      )}

      <div className="tm-manager-list">
        {wheels.map(w => {
          const isEditing = editingId === w.id;
          const isApplying = applyTarget && applyTarget.wheelId === w.id;
          const isExpanded = expandedId === w.id;
          const isMenuOpen = menuOpenId === w.id;
          const slotsForMini = (w.blocks || []).map(b => ({ startTime: b.startTime, endTime: b.endTime, color: b.color }));
          if (isEditing) {
            return (
              <div key={w.id} className="tm-manager-draft tm-manager-draft-edit">
                <input
                  className="tm-composer-input"
                  value={editDraft.name}
                  onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                  autoFocus
                />
                <input
                  type="color"
                  className="tm-color-swatch"
                  value={editDraft.color}
                  onChange={(e) => setEditDraft({ ...editDraft, color: e.target.value })}
                />
                <button className="tm-btn tm-primary tm-sm" onClick={saveEdit}>Save</button>
                <button className="tm-btn tm-sm" onClick={() => setEditingId(null)}>Cancel</button>
              </div>
            );
          }
          return (
            <div key={w.id} className="tm-manager-row" style={{ '--row-accent': w.color }}>
              <div
                className="tm-manager-row-head"
                onClick={() => { setExpandedId(isExpanded ? null : w.id); setMenuOpenId(null); }}
                title="click to view blocks"
              >
                <MiniWheel slots={slotsForMini} size={28} thickness={4} />
                <div className="tm-manager-row-body">
                  <div className="tm-manager-row-name">{w.name}</div>
                  <div className="tm-mono tm-sm">{w.blocks.length} block{w.blocks.length === 1 ? '' : 's'}</div>
                </div>
                <button
                  className="tm-btn tm-primary tm-sm"
                  onClick={(e) => { e.stopPropagation(); setApplyTarget({ wheelId: w.id }); setEditingId(null); setMenuOpenId(null); }}
                >
                  apply
                </button>
                <button
                  className="tm-btn tm-sm tm-ghost tm-manager-more"
                  onClick={(e) => { e.stopPropagation(); setMenuOpenId(isMenuOpen ? null : w.id); }}
                  aria-label="more actions"
                >
                  ⋯
                </button>
              </div>

              {isMenuOpen && (
                <div className="tm-manager-row-menu" onClick={(e) => e.stopPropagation()}>
                  {confirmDeleteId === w.id ? (
                    <>
                      <span className="tm-mono tm-sm">delete this schedule? days painted with it are unassigned.</span>
                      <button className="tm-btn tm-sm tm-danger" onClick={() => removeWheel(w.id)}>Yes, delete</button>
                      <button className="tm-btn tm-sm" onClick={() => setConfirmDeleteId(null)}>Keep</button>
                    </>
                  ) : (
                    <>
                      <button
                        className="tm-btn tm-sm"
                        onClick={() => { setEditingId(w.id); setEditDraft({ name: w.name, color: w.color }); setApplyTarget(null); setMenuOpenId(null); }}
                      >
                        rename
                      </button>
                      <button className="tm-btn tm-sm tm-danger" onClick={() => setConfirmDeleteId(w.id)}>delete</button>
                    </>
                  )}
                </div>
              )}

              {isExpanded && w.blocks.length > 0 && (
                <div className="tm-manager-row-blocks">
                  {w.blocks.slice().sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')).map((b, i) => {
                    const c = b.color || resolveTypeColor(taskTypes, b.slotType) || 'var(--ink-mute)';
                    return (
                      <div key={i} className="tm-manager-block">
                        <span className="tm-manager-block-dot" style={{ background: c }} />
                        <span className="tm-mono tm-sm tm-manager-block-time">{b.startTime}–{b.endTime}</span>
                        <span>{b.label || b.slotType || 'block'}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {isApplying && (
                <div className="tm-manager-row-apply">
                  <div className="tm-seg">
                    <button className={applyMode === 'single' ? 'tm-on' : ''} onClick={() => setApplyMode('single')}>day</button>
                    <button className={applyMode === 'range' ? 'tm-on' : ''} onClick={() => setApplyMode('range')}>range</button>
                  </div>
                  {applyMode === 'single' ? (
                    <input type="date" className="tm-composer-num" value={singleDate} onChange={(e) => setSingleDate(e.target.value)} />
                  ) : (
                    <>
                      <input type="date" className="tm-composer-num" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
                      <span className="tm-mono">–</span>
                      <input type="date" className="tm-composer-num" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
                      <div className="tm-seg">
                        {[['all', 'all'], ['weekdays', 'wkdy'], ['weekends', 'wknd']].map(([v, label]) => (
                          <button key={v} className={rangeFilter === v ? 'tm-on' : ''} onClick={() => setRangeFilter(v)}>{label}</button>
                        ))}
                      </div>
                    </>
                  )}
                  <div className="tm-seg tm-manager-mode">
                    <button className={mergeMode === 'replace' ? 'tm-on' : ''} onClick={() => setMergeMode('replace')} title="clear existing blocks first">replace</button>
                    <button className={mergeMode === 'merge' ? 'tm-on' : ''} onClick={() => setMergeMode('merge')} title="layer on top">merge</button>
                  </div>
                  <button className="tm-btn tm-primary tm-sm" onClick={apply}>apply</button>
                  <button className="tm-btn tm-sm" onClick={() => setApplyTarget(null)}>cancel</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
