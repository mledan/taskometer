import React, { useMemo, useState, useCallback } from 'react';
import styles from './ScheduleLibrary.module.css';
import CircularSchedule from './CircularSchedule.jsx';
import { ACTIVITY_TYPES, createScheduleTemplate, saveScheduleToLocalStorage } from '../utils/scheduleTemplates.js';

// Helper to convert time string to minutes for comparison
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Check if two time ranges overlap (handles overnight blocks)
function timeRangesOverlap(block1, block2) {
  const start1 = timeToMinutes(block1.start);
  const end1 = timeToMinutes(block1.end);
  const start2 = timeToMinutes(block2.start);
  const end2 = timeToMinutes(block2.end);
  
  // Handle overnight blocks (end < start)
  const isOvernight1 = end1 < start1;
  const isOvernight2 = end2 < start2;
  
  // Convert to continuous ranges for comparison
  const range1 = isOvernight1 
    ? [[start1, 24 * 60], [0, end1]] 
    : [[start1, end1]];
  const range2 = isOvernight2 
    ? [[start2, 24 * 60], [0, end2]] 
    : [[start2, end2]];
  
  // Check if any ranges overlap
  for (const r1 of range1) {
    for (const r2 of range2) {
      if (r1[0] < r2[1] && r1[1] > r2[0]) {
        return true;
      }
    }
  }
  return false;
}

function ScheduleBuilder({ onClose, onCreated, initialSchedule }) {
  const [name, setName] = useState(initialSchedule ? `${initialSchedule.name} (Copy)` : 'My Schedule');
  const [description, setDescription] = useState(initialSchedule?.description || 'Describe your schedule');
  const [tags, setTags] = useState(initialSchedule?.tags?.join(', ') || 'community');
  const [blocks, setBlocks] = useState(
    initialSchedule?.timeBlocks || [
      { start: '09:00', end: '12:00', type: 'work', label: 'Work' },
      { start: '13:00', end: '17:00', type: 'work', label: 'Work' },
      { start: '22:30', end: '06:30', type: 'sleep', label: 'Sleep' },
    ]
  );

  const [newBlock, setNewBlock] = useState({ start: '07:00', end: '08:00', type: 'meals', label: 'Breakfast' });
  const [errors, setErrors] = useState([]);

  // Validation function
  const validateBlock = useCallback((block, existingBlocks, excludeIndex = -1) => {
    const blockErrors = [];
    
    // Check for empty label
    if (!block.label || block.label.trim() === '') {
      blockErrors.push('Block label is required');
    }
    
    // Check for valid times
    if (!block.start || !block.end) {
      blockErrors.push('Start and end times are required');
    }
    
    // Check for same start/end time
    if (block.start === block.end) {
      blockErrors.push('Start and end time cannot be the same');
    }
    
    // Check for overlaps with existing blocks
    existingBlocks.forEach((existingBlock, index) => {
      if (index === excludeIndex) return; // Skip self when editing
      if (timeRangesOverlap(block, existingBlock)) {
        blockErrors.push(`Overlaps with "${existingBlock.label}" (${existingBlock.start}-${existingBlock.end})`);
      }
    });
    
    return blockErrors;
  }, []);

  function addBlock() {
    if (!newBlock.start || !newBlock.end || !newBlock.type) {
      setErrors(['Please fill in all fields']);
      return;
    }
    
    const blockErrors = validateBlock(newBlock, blocks);
    if (blockErrors.length > 0) {
      setErrors(blockErrors);
      return;
    }
    
    setErrors([]);
    setBlocks(prev => [...prev, { ...newBlock }]);
    // Reset to defaults
    setNewBlock({ start: '', end: '', type: 'buffer', label: '' });
  }

  function removeBlock(index) {
    setBlocks(prev => prev.filter((_, i) => i !== index));
    setErrors([]);
  }

  function handleCreate() {
    // Validate schedule name
    if (!name || name.trim() === '') {
      setErrors(['Schedule name is required']);
      return;
    }
    
    // Validate that we have at least one block
    if (blocks.length === 0) {
      setErrors(['Add at least one time block']);
      return;
    }
    
    setErrors([]);
    const schedule = createScheduleTemplate(name, description, 'daily', blocks, tags.split(',').map(t => t.trim()));
    const saved = saveScheduleToLocalStorage(schedule);
    onCreated?.(saved);
  }
  
  // Calculate total scheduled time
  const totalScheduledMinutes = useMemo(() => {
    return blocks.reduce((total, block) => {
      const start = timeToMinutes(block.start);
      const end = timeToMinutes(block.end);
      const duration = end >= start ? end - start : (24 * 60 - start) + end;
      return total + duration;
    }, 0);
  }, [blocks]);
  
  const scheduledHours = Math.floor(totalScheduledMinutes / 60);
  const scheduledMins = totalScheduledMinutes % 60;

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

              {/* Validation Errors */}
              {errors.length > 0 && (
                <div style={{ 
                  padding: '10px 14px', 
                  background: '#FEE2E2', 
                  borderRadius: 6, 
                  color: '#DC2626',
                  fontSize: 13
                }}>
                  {errors.map((err, i) => (
                    <div key={i}>⚠ {err}</div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>Time Blocks</span>
                <span style={{ fontSize: 13, color: 'var(--font-color-secondary)' }}>
                  {scheduledHours}h {scheduledMins}m scheduled
                  {totalScheduledMinutes > 24 * 60 && (
                    <span style={{ color: '#F59E0B', marginLeft: 8 }}>⚠ Over 24h</span>
                  )}
                </span>
              </div>
              
              {blocks.length === 0 && (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--font-color-secondary)', fontSize: 14 }}>
                  No time blocks yet. Add one below.
                </div>
              )}
              
              {blocks.map((b, i) => {
                const activityType = ACTIVITY_TYPES[b.type.toUpperCase()] || ACTIVITY_TYPES.BUFFER;
                return (
                  <div 
                    key={`${b.start}-${b.end}-${i}`} 
                    style={{ 
                      display: 'flex', 
                      gap: 8, 
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: activityType.color + '15',
                      borderRadius: 6,
                      borderLeft: `3px solid ${activityType.color}`
                    }}
                  >
                    <span style={{ width: 50, fontSize: 13, fontWeight: 500 }}>{b.start}</span>
                    <span style={{ color: 'var(--font-color-secondary)', fontSize: 12 }}>→</span>
                    <span style={{ width: 50, fontSize: 13, fontWeight: 500 }}>{b.end}</span>
                    <span style={{ marginLeft: 8 }}>{activityType.icon}</span>
                    <span style={{ flex: 1, fontWeight: 500 }}>{b.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--font-color-secondary)' }}>({b.type})</span>
                    <button 
                      onClick={() => removeBlock(i)}
                      style={{ 
                        background: 'transparent', 
                        border: 'none', 
                        cursor: 'pointer',
                        fontSize: 16,
                        color: '#EF4444',
                        padding: '2px 6px'
                      }}
                      title="Remove block"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}

              <div style={{ 
                display: 'flex', 
                gap: 8, 
                alignItems: 'flex-end', 
                marginTop: 12, 
                padding: 12, 
                background: 'var(--bg-color)', 
                borderRadius: 8,
                border: '1px dashed var(--border-color)'
              }}>
                <label title="Start time in your local time" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                  Start
                  <input style={{ width: 100, padding: 8 }} type="time" value={newBlock.start} onChange={(e) => setNewBlock({ ...newBlock, start: e.target.value })} />
                </label>
                <label title="End time in your local time" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                  End
                  <input style={{ width: 100, padding: 8 }} type="time" value={newBlock.end} onChange={(e) => setNewBlock({ ...newBlock, end: e.target.value })} />
                </label>
                <label title="Category used for intelligent task routing" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                  Type
                  <select 
                    value={newBlock.type} 
                    onChange={(e) => setNewBlock({ ...newBlock, type: e.target.value })}
                    style={{ padding: 8 }}
                  >
                  {activityOptions.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                  </select>
                </label>
                <label title="Short label that appears in the list view" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, flex: 1 }}>
                  Label
                  <input 
                    placeholder="e.g., Deep work, Lunch" 
                    value={newBlock.label} 
                    onChange={(e) => setNewBlock({ ...newBlock, label: e.target.value })} 
                    style={{ padding: 8 }}
                  />
                </label>
                <button 
                  onClick={addBlock}
                  style={{
                    padding: '8px 16px',
                    background: 'var(--accent-color)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  + Add
                </button>
              </div>

              <div className={styles.modalActions} style={{ marginTop: 16 }}>
                <button className={styles.customizeButton} onClick={onClose}>Cancel</button>
                <button 
                  className={styles.modalActivateButton} 
                  onClick={handleCreate}
                  disabled={blocks.length === 0 || !name.trim()}
                >
                  Save to My Schedules
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScheduleBuilder;


