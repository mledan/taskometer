/**
 * SlotConfigPanel Component
 *
 * Panel for configuring slot restrictions and settings.
 * Allows users to set type/tag restrictions for time slots.
 *
 * Features:
 * - Configure slot type restriction
 * - Set allowed tags
 * - Set flexibility level (fixed, preferred, flexible)
 * - Preview slot appearance
 */

import { useState, useMemo } from 'react';
import { useTaskTypes, useTags } from '../../context/AppContext';
import { SLOT_FLEXIBILITY } from '../../models/CalendarSlot';
import styles from './SlotConfigPanel.module.css';

function SlotConfigPanel({
  slot,
  onSave,
  onCancel,
  onDelete,
  isNew = false
}) {
  const taskTypes = useTaskTypes();
  const tags = useTags();

  // Form state
  const [label, setLabel] = useState(slot?.label || '');
  const [slotType, setSlotType] = useState(slot?.slotType || '');
  const [allowedTags, setAllowedTags] = useState(slot?.allowedTags || []);
  const [flexibility, setFlexibility] = useState(slot?.flexibility || 'preferred');
  const [description, setDescription] = useState(slot?.description || '');
  const [color, setColor] = useState(slot?.color || '#3B82F6');

  // Get color from selected type
  const selectedType = useMemo(() => {
    return taskTypes.find(t => t.id === slotType);
  }, [taskTypes, slotType]);

  // Auto-set color when type changes
  const displayColor = slotType && selectedType?.color ? selectedType.color : color;

  function handleTypeChange(e) {
    const newType = e.target.value;
    setSlotType(newType);

    // Auto-update color to match type
    const type = taskTypes.find(t => t.id === newType);
    if (type?.color) {
      setColor(type.color);
    }

    // Auto-update label if empty
    if (!label && type) {
      setLabel(type.name);
    }
  }

  function toggleTag(tagId) {
    if (allowedTags.includes(tagId)) {
      setAllowedTags(allowedTags.filter(t => t !== tagId));
    } else {
      setAllowedTags([...allowedTags, tagId]);
    }
  }

  function handleSave() {
    onSave({
      ...slot,
      label: label || (selectedType?.name) || 'Time Slot',
      slotType: slotType || null,
      allowedTags,
      flexibility,
      description,
      color: displayColor
    });
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3>{isNew ? 'Create Slot' : 'Configure Slot'}</h3>
        <button className={styles.closeButton} onClick={onCancel}>×</button>
      </div>

      <div className={styles.content}>
        {/* Preview */}
        <div
          className={styles.preview}
          style={{ backgroundColor: `${displayColor}20`, borderColor: displayColor }}
        >
          <span className={styles.previewLabel}>{label || 'Unnamed Slot'}</span>
          <span className={styles.previewMeta}>
            {slot?.startTime} - {slot?.endTime}
          </span>
        </div>

        {/* Label */}
        <div className={styles.field}>
          <label htmlFor="slotLabel">Label</label>
          <input
            id="slotLabel"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g., Morning Work, Exercise"
          />
        </div>

        {/* Type restriction */}
        <div className={styles.field}>
          <label htmlFor="slotType">Type Restriction</label>
          <div className={styles.typeSelectWrapper}>
            {slotType && selectedType && (
              <div
                className={styles.typeColorDot}
                style={{ backgroundColor: selectedType.color }}
              />
            )}
            <select
              id="slotType"
              value={slotType}
              onChange={handleTypeChange}
            >
              <option value="">Any type (flexible)</option>
              {taskTypes.map(type => (
                <option key={type.id} value={type.id}>
                  {type.icon} {type.name}
                </option>
              ))}
            </select>
          </div>
          <span className={styles.hint}>
            Only tasks of this type will be auto-scheduled here
          </span>
        </div>

        {/* Flexibility level */}
        <div className={styles.field}>
          <label>Flexibility</label>
          <div className={styles.flexibilityOptions}>
            {Object.values(SLOT_FLEXIBILITY).map(level => (
              <button
                key={level.id}
                type="button"
                className={`${styles.flexOption} ${flexibility === level.id ? styles.active : ''}`}
                onClick={() => setFlexibility(level.id)}
              >
                <span className={styles.flexIcon}>{level.icon}</span>
                <span className={styles.flexLabel}>{level.name}</span>
                <span className={styles.flexDescription}>{level.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tag restrictions */}
        <div className={styles.field}>
          <label>Allowed Tags</label>
          <div className={styles.tagsList}>
            {tags.map(tag => (
              <button
                key={tag.id}
                type="button"
                className={`${styles.tagButton} ${allowedTags.includes(tag.id) ? styles.tagSelected : ''}`}
                style={{
                  '--tag-color': tag.color,
                  backgroundColor: allowedTags.includes(tag.id) ? `${tag.color}30` : 'transparent',
                  borderColor: allowedTags.includes(tag.id) ? tag.color : 'rgba(255,255,255,0.1)'
                }}
                onClick={() => toggleTag(tag.id)}
              >
                <span>{tag.icon}</span>
                <span>{tag.name}</span>
              </button>
            ))}
          </div>
          <span className={styles.hint}>
            {allowedTags.length === 0
              ? 'No tag restriction (all tags allowed)'
              : `Only tasks with selected tags (${allowedTags.length}) will match`}
          </span>
        </div>

        {/* Color */}
        <div className={styles.field}>
          <label htmlFor="slotColor">Color</label>
          <div className={styles.colorInput}>
            <input
              id="slotColor"
              type="color"
              value={displayColor}
              onChange={(e) => setColor(e.target.value)}
            />
            <span>{displayColor}</span>
          </div>
        </div>

        {/* Description */}
        <div className={styles.field}>
          <label htmlFor="slotDescription">Description (optional)</label>
          <textarea
            id="slotDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add notes about this slot..."
            rows={2}
          />
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        {!isNew && onDelete && (
          <button
            type="button"
            className={styles.deleteButton}
            onClick={() => {
              if (window.confirm('Delete this slot?')) {
                onDelete();
              }
            }}
          >
            Delete Slot
          </button>
        )}
        <div className={styles.actionsRight}>
          <button type="button" className={styles.cancelButton} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={styles.saveButton} onClick={handleSave}>
            {isNew ? 'Create Slot' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SlotConfigPanel;
