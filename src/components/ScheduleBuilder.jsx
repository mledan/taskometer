import React, { useMemo, useState } from 'react';
import styles from './ScheduleLibrary.module.css';
import CircularSchedule from './CircularSchedule.jsx';
import { ACTIVITY_TYPES, createScheduleTemplate, saveScheduleToLocalStorage } from '../utils/scheduleTemplates.js';

function ScheduleBuilder({ onClose, onCreated }) {
  const [name, setName] = useState('My Schedule');
  const [description, setDescription] = useState('Describe your schedule');
  const [tags, setTags] = useState('community');
  const [blocks, setBlocks] = useState([
    { start: '09:00', end: '12:00', type: 'work', label: 'Work' },
    { start: '13:00', end: '17:00', type: 'work', label: 'Work' },
    { start: '22:30', end: '06:30', type: 'sleep', label: 'Sleep' },
  ]);

  const [newBlock, setNewBlock] = useState({ start: '07:00', end: '08:00', type: 'meals', label: 'Breakfast' });

  function addBlock() {
    if (!newBlock.start || !newBlock.end || !newBlock.type) return;
    setBlocks(prev => [...prev, { ...newBlock }]);
  }

  function removeBlock(index) {
    setBlocks(prev => prev.filter((_, i) => i !== index));
  }

  function handleCreate() {
    const schedule = createScheduleTemplate(name, description, 'daily', blocks, tags.split(',').map(t => t.trim()));
    const saved = saveScheduleToLocalStorage(schedule);
    onCreated?.(saved);
  }

  const activityOptions = useMemo(() => Object.values(ACTIVITY_TYPES).map(a => ({ id: a.id, name: a.name })), []);

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Create Schedule</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <CircularSchedule timeBlocks={blocks} showLegend={true} title={name} />
          </div>
          <div style={{ flex: '1 1 320px', minWidth: 320 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <label title="Give your schedule a recognizable name.">
                Name
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Ideal Day" />
              </label>
              <label title="Describe the intent or constraints of this schedule.">
                Description
                <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Balanced work, exercise, and family" />
              </label>
              <label title="Comma-separated tags help others find your schedule.">
                Tags
                <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="work, balanced, remote" />
              </label>

              <div style={{ marginTop: 8, fontWeight: 600 }}>Time Blocks</div>
              {blocks.map((b, i) => (
                <div key={`${b.start}-${b.end}-${i}`} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ width: 64 }}>{b.start}</span>
                  <span style={{ width: 64 }}>{b.end}</span>
                  <span style={{ flex: 1 }}>{b.label} ({b.type})</span>
                  <button onClick={() => removeBlock(i)}>Remove</button>
                </div>
              ))}

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                <label title="Start time in your local time" style={{ display: 'flex', flexDirection: 'column' }}>
                  Start
                  <input style={{ width: 110 }} type="time" value={newBlock.start} onChange={(e) => setNewBlock({ ...newBlock, start: e.target.value })} />
                </label>
                <label title="End time in your local time" style={{ display: 'flex', flexDirection: 'column' }}>
                  End
                  <input style={{ width: 110 }} type="time" value={newBlock.end} onChange={(e) => setNewBlock({ ...newBlock, end: e.target.value })} />
                </label>
                <label title="Category used for intelligent task routing" style={{ display: 'flex', flexDirection: 'column' }}>
                  Type
                  <select value={newBlock.type} onChange={(e) => setNewBlock({ ...newBlock, type: e.target.value })}>
                  {activityOptions.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                  </select>
                </label>
                <label title="Short label that appears in the list view" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  Label
                  <input placeholder="e.g., Deep work, Lunch" value={newBlock.label} onChange={(e) => setNewBlock({ ...newBlock, label: e.target.value })} />
                </label>
                <button onClick={addBlock}>Add</button>
              </div>

              <div className={styles.modalActions}>
                <button className={styles.modalActivateButton} onClick={handleCreate}>Save to My Schedules</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScheduleBuilder;


