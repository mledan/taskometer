import React, { useEffect, useRef, useState } from 'react';

const DEFAULT_TYPES = ['deep', 'mtgs', 'admin', 'calls', 'play'];
const DEFAULT_SLOT_TYPES = ['deep', 'mtgs', 'admin', 'calls', 'play', 'routine', 'break'];

function todayYMD() {
  const d = new Date();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

export function TaskComposer({ onAdd, autoFocus = false }) {
  const [text, setText] = useState('');
  const [duration, setDuration] = useState(30);
  const [type, setType] = useState('deep');
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) inputRef.current.focus();
  }, [autoFocus]);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onAdd({
      text: t,
      primaryType: type,
      duration: Number(duration) || 30,
      status: 'pending',
    });
    setText('');
  };

  return (
    <div className="tm-composer">
      <input
        ref={inputRef}
        className="tm-composer-input"
        placeholder="what do you need to do?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
      />
      <select
        className="tm-composer-select"
        value={type}
        onChange={(e) => setType(e.target.value)}
        title="task type"
      >
        {DEFAULT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
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
      <button
        className="tm-btn tm-primary tm-sm"
        onClick={submit}
        disabled={!text.trim()}
      >
        add
      </button>
    </div>
  );
}

export function SlotComposer({ onSave, onCancel, onDelete, initial }) {
  const [date, setDate] = useState(initial?.date || todayYMD());
  const [startTime, setStartTime] = useState(initial?.startTime || '09:00');
  const [endTime, setEndTime] = useState(initial?.endTime || '10:00');
  const [label, setLabel] = useState(initial?.label || '');
  const [slotType, setSlotType] = useState(initial?.slotType || 'deep');

  const save = () => {
    if (!label.trim()) return;
    if (startTime >= endTime) return;
    onSave({ date, startTime, endTime, label: label.trim(), slotType });
  };

  return (
    <div className="tm-card tm-dashed" style={{ padding: '12px 14px', marginBottom: 14 }}>
      <div className="tm-mono tm-md" style={{ marginBottom: 8 }}>
        {initial ? 'edit time block' : 'new time block'}
      </div>
      <div className="tm-composer tm-composer-wrap">
        <input
          className="tm-composer-input"
          placeholder="label (morning, deep work, lunch…)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <select
          className="tm-composer-select"
          value={slotType}
          onChange={(e) => setSlotType(e.target.value)}
          title="block type"
        >
          {DEFAULT_SLOT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
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
        />
        <span className="tm-mono tm-md">–</span>
        <input
          className="tm-composer-num"
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          style={{ width: 96 }}
        />
        <button
          className="tm-btn tm-primary tm-sm"
          onClick={save}
          disabled={!label.trim() || startTime >= endTime}
        >
          {initial ? 'save' : 'add block'}
        </button>
        {onCancel && (
          <button className="tm-btn tm-sm" onClick={onCancel}>cancel</button>
        )}
        {initial && onDelete && (
          <button className="tm-btn tm-sm tm-danger" onClick={onDelete}>delete</button>
        )}
      </div>
    </div>
  );
}

export function TaskRowEditor({ task, onSave, onCancel, onDelete }) {
  const [text, setText] = useState(task.text || task.title || '');
  const [duration, setDuration] = useState(
    typeof task.duration === 'number' ? task.duration : 30
  );
  const [type, setType] = useState(task.primaryType || task.taskType || 'deep');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSave({
      text: t,
      primaryType: type,
      duration: Number(duration) || 30,
    });
  };

  return (
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
        {DEFAULT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
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
  );
}
