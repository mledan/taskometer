import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TASK_PRIORITIES } from '../models/Task';
import { log as telemetryLog } from '../services/telemetry.js';

const FALLBACK_TYPES = [
  { id: 'deep', name: 'deep', color: '#D4663A', icon: '🔥' },
  { id: 'mtgs', name: 'mtgs', color: '#A8BF8C', icon: '🗓' },
  { id: 'admin', name: 'admin', color: '#D9C98C', icon: '📋' },
  { id: 'calls', name: 'calls', color: '#C7BEDD', icon: '📞' },
  { id: 'play', name: 'play', color: '#F2C4A6', icon: '🎉' },
  { id: 'routine', name: 'routine', color: '#CFDCBC', icon: '🌀' },
  { id: 'break', name: 'break', color: '#E8DFD2', icon: '☕' },
  { id: 'sleep', name: 'sleep', color: '#6B46C1', icon: '🌙' },
];

const PALETTE = [
  '#D4663A', '#A8BF8C', '#D9C98C', '#C7BEDD', '#F2C4A6',
  '#6B46C1', '#3B82F6', '#10B981', '#EC4899', '#F59E0B',
  '#14B8A6', '#EF4444', '#78716C', '#06B6D4', '#8B5CF6',
];

const DAY_MIN = 24 * 60;

function todayYMD() {
  const d = new Date();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

function hhmmToMin(s) {
  if (!s) return 0;
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
function minToHHMM(min) {
  const m = ((Math.round(min) % DAY_MIN) + DAY_MIN) % DAY_MIN;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h < 10 ? '0' + h : h}:${mm < 10 ? '0' + mm : mm}`;
}

function slotSpanMin(startTime, endTime) {
  const s = hhmmToMin(startTime);
  const e = hhmmToMin(endTime);
  return e <= s ? e + DAY_MIN - s : e - s;
}

function slugify(name) {
  return (name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'type';
}

export function getEffectiveTypes(taskTypes) {
  if (Array.isArray(taskTypes) && taskTypes.length > 0) return taskTypes;
  return FALLBACK_TYPES;
}

export function resolveTypeColor(taskTypes, id) {
  const list = getEffectiveTypes(taskTypes);
  const t = list.find(x => x.id === id);
  return t?.color || null;
}

export function TaskComposer({ onAdd, autoFocus = false, taskTypes = [] }) {
  const types = getEffectiveTypes(taskTypes);
  const [text, setText] = useState('');
  const [duration, setDuration] = useState(30);
  const [type, setType] = useState(types[0]?.id || 'deep');
  const [priority, setPriority] = useState('medium');
  const [showDetails, setShowDetails] = useState(false);
  const [recurrence, setRecurrence] = useState({ frequency: 'none', interval: 1 });
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) inputRef.current.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (!types.find(t => t.id === type)) setType(types[0]?.id || 'deep');
  }, [types, type]);

  const detailsDirty =
    duration !== 30 ||
    priority !== 'medium' ||
    type !== (types[0]?.id || 'deep') ||
    recurrence.frequency !== 'none';

  const submit = () => {
    const t = text.trim();
    if (!t) {
      telemetryLog('composer:task:rejected', { reason: 'empty' });
      return;
    }
    onAdd({
      text: t,
      primaryType: type,
      duration: Number(duration) || 30,
      priority,
      recurrence: recurrence.frequency === 'none'
        ? { frequency: 'none', interval: 1, daysOfWeek: [], dayOfMonth: null, endDate: null, occurrences: null }
        : recurrence,
      status: 'pending',
    });
    setText('');
    setShowDetails(false);
    setRecurrence({ frequency: 'none', interval: 1 });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="tm-composer">
        <input
          ref={inputRef}
          className="tm-composer-input"
          placeholder="what do you need to do?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        />
        <button
          type="button"
          className={`tm-btn tm-sm tm-ghost${showDetails ? ' tm-primary' : ''}`}
          onClick={() => {
            const next = !showDetails;
            setShowDetails(next);
            telemetryLog('composer:task:details', { open: next });
          }}
          title="type · duration · priority · repeat"
        >
          {showDetails ? 'hide details' : detailsDirty ? 'details ●' : 'details'}
        </button>
        <button
          className="tm-btn tm-primary tm-sm"
          onClick={submit}
          disabled={!text.trim()}
        >
          add
        </button>
      </div>
      {showDetails && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', paddingLeft: 2 }}>
          <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>type</span>
          <select
            className="tm-composer-select"
            value={type}
            onChange={(e) => setType(e.target.value)}
            title="task type"
          >
            {types.map(t => (
              <option key={t.id} value={t.id}>{t.name || t.id}</option>
            ))}
          </select>
          <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', marginLeft: 8 }}>duration</span>
          <input
            className="tm-composer-num"
            type="number"
            min="5"
            max="480"
            step="5"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            title="minutes"
          />
          <span className="tm-mono tm-md">m</span>
          <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', marginLeft: 8 }}>priority</span>
          <PrioritySegment value={priority} onChange={setPriority} />
          <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', marginLeft: 8 }}>repeat</span>
          <RecurrencePicker value={recurrence} onChange={setRecurrence} />
        </div>
      )}
    </div>
  );
}

function PrioritySegment({ value, onChange }) {
  return (
    <div className="tm-seg">
      {Object.keys(TASK_PRIORITIES).map(p => (
        <button
          key={p}
          type="button"
          className={value === p ? 'tm-on' : ''}
          onClick={() => onChange(p)}
          title={TASK_PRIORITIES[p].name}
          style={value === p ? { color: TASK_PRIORITIES[p].color } : undefined}
        >
          {p === 'medium' ? 'med' : p}
        </button>
      ))}
    </div>
  );
}

const WEEKDAY_SHORT = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const WEEKDAY_FULL = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function RecurrencePicker({ value, onChange }) {
  const freq = value?.frequency || 'none';
  const interval = value?.interval || 1;
  const daysOfWeek = value?.daysOfWeek || [];
  const patch = (p) => onChange({ ...value, ...p });
  const toggleDay = (idx) => {
    const name = WEEKDAY_FULL[idx];
    const next = daysOfWeek.includes(name)
      ? daysOfWeek.filter(d => d !== name)
      : [...daysOfWeek, name];
    patch({ daysOfWeek: next });
  };
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <select
        className="tm-composer-select"
        value={freq}
        onChange={(e) => patch({ frequency: e.target.value })}
      >
        <option value="none">none</option>
        <option value="daily">daily</option>
        <option value="weekly">weekly</option>
        <option value="monthly">monthly</option>
      </select>
      {freq !== 'none' && (
        <>
          <span className="tm-mono tm-sm">every</span>
          <input
            type="number"
            min="1"
            max="30"
            step="1"
            className="tm-composer-num"
            value={interval}
            onChange={(e) => patch({ interval: Math.max(1, Number(e.target.value) || 1) })}
            style={{ width: 56 }}
          />
          <span className="tm-mono tm-sm">
            {freq === 'daily' ? 'day(s)' : freq === 'weekly' ? 'week(s)' : 'month(s)'}
          </span>
        </>
      )}
      {freq === 'weekly' && (
        <div className="tm-seg" style={{ flexWrap: 'wrap' }}>
          {WEEKDAY_SHORT.map((d, i) => (
            <button
              key={d}
              type="button"
              className={daysOfWeek.includes(WEEKDAY_FULL[i]) ? 'tm-on' : ''}
              onClick={() => toggleDay(i)}
            >{d}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SlotComposer({
  onSave,
  onCancel,
  onDelete,
  initial,
  taskTypes = [],
  onOpenTypeManager,
  extraActions,
}) {
  const types = getEffectiveTypes(taskTypes);
  const [date, setDate] = useState(initial?.date || todayYMD());
  const [startTime, setStartTime] = useState(initial?.startTime || '09:00');
  const [endTime, setEndTime] = useState(initial?.endTime || '10:00');
  const [label, setLabel] = useState(initial?.label || '');
  const [slotType, setSlotType] = useState(initial?.slotType || types[0]?.id || 'deep');
  const [mode, setMode] = useState('end'); // 'end' | 'duration'
  const [durationMin, setDurationMin] = useState(
    slotSpanMin(initial?.startTime || '09:00', initial?.endTime || '10:00')
  );

  const lastInitialId = useRef(null);
  useEffect(() => {
    if (!initial) return;
    // Resync when the target slot changes (e.g. clicking a different wedge, or a new draft)
    if (initial.id !== lastInitialId.current ||
        initial.startTime !== startTime ||
        initial.endTime !== endTime ||
        initial.date !== date) {
      lastInitialId.current = initial.id || null;
      if (initial.date) setDate(initial.date);
      if (initial.startTime) setStartTime(initial.startTime);
      if (initial.endTime) setEndTime(initial.endTime);
      if (initial.label !== undefined) setLabel(initial.label || '');
      if (initial.slotType) setSlotType(initial.slotType);
      if (initial.startTime && initial.endTime) {
        setDurationMin(slotSpanMin(initial.startTime, initial.endTime));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id, initial?.startTime, initial?.endTime, initial?.date]);

  // When the user edits times in 'end' mode, keep duration in sync for preview
  useEffect(() => {
    if (mode !== 'end') return;
    setDurationMin(slotSpanMin(startTime, endTime));
  }, [mode, startTime, endTime]);

  const computedEnd = useMemo(() => {
    if (mode === 'duration') {
      const startMin = hhmmToMin(startTime);
      const endMin = (startMin + Math.max(15, Number(durationMin) || 0)) % DAY_MIN;
      return minToHHMM(endMin);
    }
    return endTime;
  }, [mode, startTime, endTime, durationMin]);

  const spanMin = mode === 'duration' ? Math.max(15, Number(durationMin) || 0) : slotSpanMin(startTime, endTime);
  const overnight = hhmmToMin(computedEnd) <= hhmmToMin(startTime);

  const save = () => {
    const trimmed = label.trim();
    if (!trimmed) {
      telemetryLog('composer:slot:rejected', { reason: 'empty-label' });
      return;
    }
    if (spanMin < 15) {
      telemetryLog('composer:slot:rejected', { reason: 'too-short', spanMin });
      return;
    }
    const finalEnd = mode === 'duration' ? computedEnd : endTime;
    if (startTime === finalEnd) {
      telemetryLog('composer:slot:rejected', { reason: 'zero-span' });
      return;
    }
    const matched = types.find(t => t.id === slotType);
    telemetryLog('composer:slot:save', {
      date,
      startTime,
      endTime: finalEnd,
      slotType,
      editing: !!initial?.id,
    });
    onSave({
      date,
      startTime,
      endTime: finalEnd,
      label: trimmed,
      slotType,
      color: matched?.color || initial?.color || undefined,
    });
  };

  return (
    <div className="tm-card tm-dashed" style={{ padding: '12px 14px', marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
        <div className="tm-mono tm-md">{initial?.id ? 'edit time block' : 'new time block'}</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="tm-seg" style={{ marginTop: 0 }}>
            <button
              type="button"
              className={mode === 'end' ? 'tm-on' : ''}
              onClick={() => setMode('end')}
              title="enter an explicit end time"
            >end time</button>
            <button
              type="button"
              className={mode === 'duration' ? 'tm-on' : ''}
              onClick={() => setMode('duration')}
              title="enter a duration (minutes); end time derives from start"
            >duration</button>
          </div>
          {onOpenTypeManager && (
            <button
              type="button"
              className="tm-btn tm-sm tm-ghost"
              onClick={onOpenTypeManager}
              title="add, rename, or recolor slot types"
            >
              manage types
            </button>
          )}
        </div>
      </div>
      <div className="tm-composer tm-composer-wrap">
        <input
          className="tm-composer-input"
          placeholder="label (morning, deep work, sleep…)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <select
          className="tm-composer-select"
          value={slotType}
          onChange={(e) => setSlotType(e.target.value)}
          title="block type"
        >
          {types.map(t => (
            <option key={t.id} value={t.id}>{t.name || t.id}</option>
          ))}
        </select>
        <input
          className="tm-composer-num"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ width: 140 }}
        />
        <input
          className="tm-composer-num"
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          style={{ width: 96 }}
          title="start"
        />
        {mode === 'end' ? (
          <>
            <span className="tm-mono tm-md">–</span>
            <input
              className="tm-composer-num"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              style={{ width: 96 }}
              title="end time"
            />
          </>
        ) : (
          <>
            <span className="tm-mono tm-md">for</span>
            <input
              className="tm-composer-num"
              type="number"
              min="15"
              max="1440"
              step="15"
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
              style={{ width: 84 }}
              title="duration in minutes"
            />
            <span className="tm-mono tm-md">m</span>
            <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>→ {computedEnd}</span>
          </>
        )}
        <button
          className="tm-btn tm-primary tm-sm"
          onClick={save}
          disabled={!label.trim() || spanMin < 15}
        >
          {initial?.id ? 'save' : 'add block'}
        </button>
        {onCancel && (
          <button className="tm-btn tm-sm" onClick={onCancel}>cancel</button>
        )}
        {initial?.id && onDelete && (
          <button className="tm-btn tm-sm tm-danger" onClick={onDelete}>delete</button>
        )}
        {extraActions}
      </div>
      <div className="tm-mono tm-sm" style={{ marginTop: 8, color: 'var(--ink-mute)' }}>
        {overnight
          ? 'spans past midnight — great for sleep. '
          : 'tip: drag the wedge to move · drag edges to resize · hover a handle for ±15m nudge. '}
        overlaps are allowed.
      </div>
    </div>
  );
}

export function TaskRowEditor({ task, onSave, onCancel, onDelete, taskTypes = [] }) {
  const types = getEffectiveTypes(taskTypes);
  const [text, setText] = useState(task.text || task.title || '');
  const [duration, setDuration] = useState(
    typeof task.duration === 'number' ? task.duration : 30
  );
  const [type, setType] = useState(task.primaryType || task.taskType || types[0]?.id || 'deep');
  const [priority, setPriority] = useState(task.priority || 'medium');
  const [recurrence, setRecurrence] = useState(
    task.recurrence && typeof task.recurrence === 'object'
      ? { frequency: task.recurrence.frequency || 'none', interval: task.recurrence.interval || 1, daysOfWeek: task.recurrence.daysOfWeek || [] }
      : { frequency: 'none', interval: 1 }
  );
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSave({
      text: t,
      primaryType: type,
      duration: Number(duration) || 30,
      priority,
      recurrence: recurrence.frequency === 'none'
        ? { frequency: 'none', interval: 1, daysOfWeek: [], dayOfMonth: null, endDate: null, occurrences: null }
        : recurrence,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="tm-composer tm-composer-row">
        <input
          ref={inputRef}
          className="tm-composer-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') onCancel();
          }}
        />
        <select
          className="tm-composer-select"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {types.map(t => (
            <option key={t.id} value={t.id}>{t.name || t.id}</option>
          ))}
        </select>
        <input
          className="tm-composer-num"
          type="number"
          min="5"
          max="480"
          step="5"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />
        <span className="tm-mono tm-md">m</span>
        <button className="tm-btn tm-primary tm-sm" onClick={submit}>save</button>
        <button className="tm-btn tm-sm" onClick={onCancel}>cancel</button>
        {onDelete && (
          <button className="tm-btn tm-sm tm-danger" onClick={onDelete}>delete</button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', paddingLeft: 2 }}>
        <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>priority</span>
        <PrioritySegment value={priority} onChange={setPriority} />
        <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)', marginLeft: 8 }}>repeat</span>
        <RecurrencePicker value={recurrence} onChange={setRecurrence} />
      </div>
    </div>
  );
}

export function SlotTypeManager({ taskTypes = [], api, onClose }) {
  const effectiveTypes = getEffectiveTypes(taskTypes);
  const hasCustom = Array.isArray(taskTypes) && taskTypes.length > 0;
  const [draft, setDraft] = useState({ name: '', color: PALETTE[0] });
  const [editing, setEditing] = useState(null);

  const addType = async () => {
    const name = draft.name.trim();
    if (!name) return;
    const id = await nextUniqueId(taskTypes, slugify(name));
    await api.taskTypes.add({
      id,
      name,
      color: draft.color,
      icon: '✳️',
    });
    setDraft({ name: '', color: PALETTE[0] });
  };

  const seedFallback = async () => {
    for (const f of FALLBACK_TYPES) {
      if (effectiveTypes.some(t => t.id === f.id)) continue;
      // eslint-disable-next-line no-await-in-loop
      await api.taskTypes.add({
        id: f.id,
        name: f.name,
        color: f.color,
        icon: f.icon,
      });
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const name = (editing.name || '').trim();
    if (!name) return;
    await api.taskTypes.update(editing.id, {
      name,
      color: editing.color,
    });
    setEditing(null);
  };

  const removeType = async (id) => {
    if (!window.confirm('remove this type? slots using it stay but lose the link.')) return;
    await api.taskTypes.remove(id);
  };

  return (
    <div className="tm-modal-backdrop" onMouseDown={onClose}>
      <div
        className="tm-modal"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="manage slot types"
      >
        <div className="tm-modal-head">
          <div className="tm-modal-title">slot types</div>
          <button
            type="button"
            onClick={onClose}
            className="tm-btn tm-sm"
            aria-label="close"
          >close</button>
        </div>

        <div className="tm-mono tm-md" style={{ marginBottom: 10 }}>
          name a type, pick a color. these show up everywhere you can pick a category.
        </div>

        {!hasCustom && (
          <div
            className="tm-mono tm-md"
            style={{
              marginBottom: 10,
              padding: '8px 10px',
              background: 'var(--paper-warm)',
              border: '1px dashed var(--ink-mute)',
              borderRadius: 6,
            }}
          >
            no custom types yet — you're seeing the defaults.&nbsp;
            <button
              type="button"
              onClick={seedFallback}
              style={{ background: 'none', border: 'none', color: 'var(--orange)', cursor: 'pointer', padding: 0, textDecoration: 'underline', font: 'inherit' }}
            >
              copy defaults so i can edit them
            </button>
          </div>
        )}

        {hasCustom && (
          <div className="tm-mono tm-sm" style={{ marginBottom: 8 }}>
            <button
              type="button"
              onClick={seedFallback}
              style={{ background: 'none', border: 'none', color: 'var(--orange)', cursor: 'pointer', padding: 0, textDecoration: 'underline', font: 'inherit' }}
            >
              + add missing defaults
            </button>
          </div>
        )}

        <div className="tm-type-list">
          {effectiveTypes.map(t => {
            const isEditing = editing && editing.id === t.id;
            if (isEditing) {
              return (
                <div key={t.id} className="tm-type-row tm-type-row-edit">
                  <input
                    className="tm-composer-input"
                    style={{ flex: '1 1 160px', fontSize: 18 }}
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(null); }}
                  />
                  <div className="tm-palette">
                    {PALETTE.map(c => (
                      <button
                        key={c}
                        type="button"
                        className={`tm-swatch${editing.color === c ? ' tm-swatch-on' : ''}`}
                        style={{ background: c }}
                        onClick={() => setEditing({ ...editing, color: c })}
                        aria-label={`color ${c}`}
                      />
                    ))}
                  </div>
                  <button className="tm-btn tm-primary tm-sm" onClick={saveEdit}>save</button>
                  <button className="tm-btn tm-sm" onClick={() => setEditing(null)}>cancel</button>
                </div>
              );
            }
            return (
              <div key={t.id} className="tm-type-row">
                <span className="tm-type-swatch" style={{ background: t.color || '#94A3B8' }} />
                <span className="tm-type-name">{t.name || t.id}</span>
                <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}>{t.id}</span>
                {hasCustom && (
                  <>
                    <button
                      className="tm-btn tm-sm"
                      onClick={() => setEditing({
                        id: t.id,
                        name: t.name || t.id,
                        color: t.color || PALETTE[0],
                      })}
                    >
                      edit
                    </button>
                    <button
                      className="tm-btn tm-sm tm-danger"
                      onClick={() => removeType(t.id)}
                    >
                      remove
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="tm-type-add">
          <div className="tm-mono tm-md" style={{ marginBottom: 6 }}>add type</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <input
              className="tm-composer-input"
              placeholder="name (focus, workout, sleep…)"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') addType(); }}
              style={{ minWidth: 200 }}
            />
            <div className="tm-palette">
              {PALETTE.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`tm-swatch${draft.color === c ? ' tm-swatch-on' : ''}`}
                  style={{ background: c }}
                  onClick={() => setDraft({ ...draft, color: c })}
                  aria-label={`color ${c}`}
                />
              ))}
            </div>
            <button
              className="tm-btn tm-primary tm-sm"
              onClick={addType}
              disabled={!draft.name.trim()}
            >
              add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

async function nextUniqueId(existing, base) {
  const ids = new Set((existing || []).map(t => t.id));
  if (!ids.has(base)) return base;
  for (let i = 2; i < 100; i++) {
    const cand = `${base}_${i}`;
    if (!ids.has(cand)) return cand;
  }
  return `${base}_${Date.now()}`;
}
