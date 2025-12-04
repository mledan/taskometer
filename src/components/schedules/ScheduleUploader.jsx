/**
 * ScheduleUploader Component
 *
 * Allows users to create, upload, and share custom schedules.
 * Supports:
 * - Creating schedules from scratch
 * - Importing from JSON/CSV
 * - Exporting schedules for sharing
 * - Editing existing custom schedules
 */

import { useState, useRef } from 'react';
import { useAppReducer, useSchedules } from '../../context/AppContext';
import { ACTION_TYPES } from '../../context/AppContext';
import { BLOCK_CATEGORIES } from '../../utils/enhancedTemplates';
import { createSchedule } from '../../models/Schedule';
import styles from './ScheduleUploader.module.css';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function ScheduleUploader({
  isOpen,
  onClose,
  editingSchedule = null
}) {
  const dispatch = useAppReducer();
  const userSchedules = useSchedules();
  const fileInputRef = useRef(null);

  // Form state
  const [scheduleName, setScheduleName] = useState(editingSchedule?.name || '');
  const [scheduleDescription, setScheduleDescription] = useState(editingSchedule?.description || '');
  const [tags, setTags] = useState(editingSchedule?.tags?.join(', ') || '');
  const [timeBlocks, setTimeBlocks] = useState(editingSchedule?.timeBlocks || []);

  // Block being edited
  const [editingBlock, setEditingBlock] = useState(null);
  const [blockForm, setBlockForm] = useState({
    start: '09:00',
    end: '10:00',
    category: 'core_work',
    label: '',
    description: '',
    days: [...DAYS_OF_WEEK]
  });

  // Import/export state
  const [importError, setImportError] = useState('');

  /**
   * Add or update a time block
   */
  function handleSaveBlock() {
    const category = Object.values(BLOCK_CATEGORIES).find(c => c.id === blockForm.category) || BLOCK_CATEGORIES.CUSTOM;

    const block = {
      start: blockForm.start,
      end: blockForm.end,
      label: blockForm.label || category.name,
      type: category.id,
      category: category.id,
      description: blockForm.description,
      color: category.color,
      icon: category.icon,
      days: blockForm.days,
      allowedTaskTypes: category.matchTypes || []
    };

    if (editingBlock !== null) {
      // Update existing block
      setTimeBlocks(prev => prev.map((b, idx) => idx === editingBlock ? block : b));
    } else {
      // Add new block
      setTimeBlocks(prev => [...prev, block]);
    }

    // Reset form
    setEditingBlock(null);
    setBlockForm({
      start: '09:00',
      end: '10:00',
      category: 'core_work',
      label: '',
      description: '',
      days: [...DAYS_OF_WEEK]
    });
  }

  /**
   * Edit an existing block
   */
  function handleEditBlock(index) {
    const block = timeBlocks[index];
    setEditingBlock(index);
    setBlockForm({
      start: block.start,
      end: block.end,
      category: block.category || block.type,
      label: block.label,
      description: block.description || '',
      days: block.days || [...DAYS_OF_WEEK]
    });
  }

  /**
   * Delete a block
   */
  function handleDeleteBlock(index) {
    setTimeBlocks(prev => prev.filter((_, idx) => idx !== index));
  }

  /**
   * Toggle day for block
   */
  function toggleBlockDay(day) {
    setBlockForm(prev => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day]
    }));
  }

  /**
   * Save the schedule
   */
  function handleSaveSchedule() {
    if (!scheduleName.trim() || timeBlocks.length === 0) return;

    const scheduleData = createSchedule({
      id: editingSchedule?.id,
      name: scheduleName.trim(),
      description: scheduleDescription.trim(),
      author: 'Custom',
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      timeBlocks,
      isCustom: true
    });

    if (editingSchedule) {
      dispatch({
        type: ACTION_TYPES.UPDATE_SCHEDULE,
        payload: scheduleData
      });
    } else {
      dispatch({
        type: ACTION_TYPES.ADD_SCHEDULE,
        payload: scheduleData
      });
    }

    onClose();
  }

  /**
   * Import schedule from file
   */
  function handleFileImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError('');
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target?.result;

        if (file.name.endsWith('.json')) {
          const data = JSON.parse(content);
          importFromJSON(data);
        } else if (file.name.endsWith('.csv')) {
          importFromCSV(content);
        } else {
          setImportError('Unsupported file format. Use JSON or CSV.');
        }
      } catch (err) {
        setImportError(`Import failed: ${err.message}`);
      }
    };

    reader.readAsText(file);
  }

  /**
   * Import from JSON
   */
  function importFromJSON(data) {
    if (data.name) setScheduleName(data.name);
    if (data.description) setScheduleDescription(data.description);
    if (data.tags) setTags(Array.isArray(data.tags) ? data.tags.join(', ') : data.tags);

    if (data.timeBlocks && Array.isArray(data.timeBlocks)) {
      const blocks = data.timeBlocks.map(block => ({
        start: block.start || '09:00',
        end: block.end || '10:00',
        label: block.label || block.name || 'Block',
        type: block.type || block.category || 'custom',
        category: block.category || block.type || 'custom',
        description: block.description || '',
        color: block.color || '#888',
        icon: block.icon || '📦',
        days: block.days || [...DAYS_OF_WEEK],
        allowedTaskTypes: block.allowedTaskTypes || []
      }));
      setTimeBlocks(blocks);
    }
  }

  /**
   * Import from CSV
   */
  function importFromCSV(content) {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      setImportError('CSV must have a header row and at least one data row');
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const blocks = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const block = {};

      headers.forEach((header, idx) => {
        if (header === 'start' || header === 'starttime') block.start = values[idx];
        if (header === 'end' || header === 'endtime') block.end = values[idx];
        if (header === 'label' || header === 'name') block.label = values[idx];
        if (header === 'category' || header === 'type') {
          block.type = values[idx];
          block.category = values[idx];
        }
        if (header === 'description') block.description = values[idx];
      });

      if (block.start && block.end) {
        const category = Object.values(BLOCK_CATEGORIES).find(c =>
          c.id === block.category || c.name.toLowerCase() === block.category?.toLowerCase()
        ) || BLOCK_CATEGORIES.CUSTOM;

        blocks.push({
          start: block.start,
          end: block.end,
          label: block.label || category.name,
          type: category.id,
          category: category.id,
          description: block.description || '',
          color: category.color,
          icon: category.icon,
          days: [...DAYS_OF_WEEK],
          allowedTaskTypes: category.matchTypes || []
        });
      }
    }

    if (blocks.length === 0) {
      setImportError('No valid time blocks found in CSV');
      return;
    }

    setTimeBlocks(blocks);
  }

  /**
   * Export schedule to JSON
   */
  function handleExport() {
    const scheduleData = {
      name: scheduleName,
      description: scheduleDescription,
      author: 'Custom',
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      timeBlocks: timeBlocks.map(block => ({
        start: block.start,
        end: block.end,
        label: block.label,
        type: block.type,
        category: block.category,
        description: block.description,
        days: block.days
      })),
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(scheduleData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scheduleName.replace(/\s+/g, '-').toLowerCase() || 'schedule'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>{editingSchedule ? 'Edit Schedule' : 'Create Schedule'}</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.content}>
          {/* Basic Info */}
          <section className={styles.section}>
            <h3>Schedule Details</h3>
            <div className={styles.field}>
              <label htmlFor="scheduleName">Name</label>
              <input
                id="scheduleName"
                type="text"
                value={scheduleName}
                onChange={e => setScheduleName(e.target.value)}
                placeholder="e.g., My Morning Routine"
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="scheduleDescription">Description</label>
              <textarea
                id="scheduleDescription"
                value={scheduleDescription}
                onChange={e => setScheduleDescription(e.target.value)}
                placeholder="Describe this schedule..."
                rows={2}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="scheduleTags">Tags (comma-separated)</label>
              <input
                id="scheduleTags"
                type="text"
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="e.g., morning, productivity, focus"
              />
            </div>
          </section>

          {/* Import/Export */}
          <section className={styles.section}>
            <h3>Import / Export</h3>
            <div className={styles.importExport}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv"
                onChange={handleFileImport}
                style={{ display: 'none' }}
              />
              <button
                className={styles.importButton}
                onClick={() => fileInputRef.current?.click()}
              >
                📥 Import from File
              </button>
              <button
                className={styles.exportButton}
                onClick={handleExport}
                disabled={timeBlocks.length === 0}
              >
                📤 Export Schedule
              </button>
            </div>
            {importError && (
              <div className={styles.error}>{importError}</div>
            )}
          </section>

          {/* Time Blocks */}
          <section className={styles.section}>
            <h3>Time Blocks ({timeBlocks.length})</h3>

            {/* Block list */}
            <div className={styles.blockList}>
              {timeBlocks.map((block, idx) => (
                <div key={idx} className={styles.blockItem}>
                  <div
                    className={styles.blockColor}
                    style={{ backgroundColor: block.color }}
                  />
                  <div className={styles.blockInfo}>
                    <span className={styles.blockTime}>
                      {block.start} - {block.end}
                    </span>
                    <span className={styles.blockLabel}>
                      {block.icon} {block.label}
                    </span>
                    {block.days && block.days.length < 7 && (
                      <span className={styles.blockDays}>
                        {block.days.map(d => d.slice(0, 3)).join(', ')}
                      </span>
                    )}
                  </div>
                  <div className={styles.blockActions}>
                    <button onClick={() => handleEditBlock(idx)}>✏️</button>
                    <button onClick={() => handleDeleteBlock(idx)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add/Edit block form */}
            <div className={styles.blockForm}>
              <div className={styles.blockFormHeader}>
                <h4>{editingBlock !== null ? 'Edit Block' : 'Add Block'}</h4>
                {editingBlock !== null && (
                  <button
                    className={styles.cancelEdit}
                    onClick={() => {
                      setEditingBlock(null);
                      setBlockForm({
                        start: '09:00',
                        end: '10:00',
                        category: 'core_work',
                        label: '',
                        description: '',
                        days: [...DAYS_OF_WEEK]
                      });
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>

              <div className={styles.blockFormRow}>
                <div className={styles.field}>
                  <label>Start Time</label>
                  <input
                    type="time"
                    value={blockForm.start}
                    onChange={e => setBlockForm({ ...blockForm, start: e.target.value })}
                  />
                </div>
                <div className={styles.field}>
                  <label>End Time</label>
                  <input
                    type="time"
                    value={blockForm.end}
                    onChange={e => setBlockForm({ ...blockForm, end: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label>Category</label>
                <select
                  value={blockForm.category}
                  onChange={e => setBlockForm({ ...blockForm, category: e.target.value })}
                >
                  {Object.values(BLOCK_CATEGORIES).map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label>Label (optional)</label>
                <input
                  type="text"
                  value={blockForm.label}
                  onChange={e => setBlockForm({ ...blockForm, label: e.target.value })}
                  placeholder="Custom label for this block"
                />
              </div>

              <div className={styles.field}>
                <label>Days</label>
                <div className={styles.dayButtons}>
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day}
                      type="button"
                      className={`${styles.dayButton} ${blockForm.days.includes(day) ? styles.selected : ''}`}
                      onClick={() => toggleBlockDay(day)}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              <button
                className={styles.addBlockButton}
                onClick={handleSaveBlock}
                disabled={!blockForm.start || !blockForm.end}
              >
                {editingBlock !== null ? 'Update Block' : 'Add Block'}
              </button>
            </div>
          </section>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button className={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button
            className={styles.saveButton}
            onClick={handleSaveSchedule}
            disabled={!scheduleName.trim() || timeBlocks.length === 0}
          >
            {editingSchedule ? 'Save Changes' : 'Create Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ScheduleUploader;
