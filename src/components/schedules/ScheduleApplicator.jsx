/**
 * ScheduleApplicator Component
 *
 * Allows users to apply schedule templates with granular control:
 * - Select specific categories/blocks to apply
 * - Choose date range (one day, week, or recurring)
 * - Set application mode (replace, merge, or overlay)
 * - Preview before applying
 */

import { useState, useMemo } from 'react';
import { useAppReducer, useSlots, useSchedules } from '../../context/AppContext';
import { ACTION_TYPES } from '../../context/AppContext';
import {
  ENHANCED_FAMOUS_SCHEDULES,
  BLOCK_CATEGORIES,
  applyTemplateToDateRange
} from '../../utils/enhancedTemplates';
import { generateSlotsFromSchedule } from '../../utils/slotMatcher';
import styles from './ScheduleApplicator.module.css';

const APPLICATION_MODES = {
  replace: {
    id: 'replace',
    name: 'Replace',
    description: 'Remove existing slots and apply new schedule',
    icon: '🔄'
  },
  merge: {
    id: 'merge',
    name: 'Merge',
    description: 'Add schedule blocks without removing existing slots',
    icon: '➕'
  },
  overlay: {
    id: 'overlay',
    name: 'Overlay',
    description: 'Apply only to empty time periods',
    icon: '📋'
  }
};

const DATE_RANGES = {
  today: { id: 'today', name: 'Today Only', days: 1 },
  week: { id: 'week', name: 'This Week', days: 7 },
  twoWeeks: { id: 'twoWeeks', name: 'Two Weeks', days: 14 },
  month: { id: 'month', name: 'One Month', days: 30 },
  custom: { id: 'custom', name: 'Custom Range', days: null }
};

function ScheduleApplicator({
  isOpen,
  onClose,
  initialSchedule = null
}) {
  const dispatch = useAppReducer();
  const existingSlots = useSlots();
  const userSchedules = useSchedules();

  // Combine built-in and user schedules
  const allSchedules = useMemo(() => {
    return [...ENHANCED_FAMOUS_SCHEDULES, ...userSchedules.filter(s => s.isCustom)];
  }, [userSchedules]);

  // Selection state
  const [selectedSchedule, setSelectedSchedule] = useState(initialSchedule);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedBlocks, setSelectedBlocks] = useState([]);
  const [dateRange, setDateRange] = useState('week');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [applicationMode, setApplicationMode] = useState('merge');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringDays, setRecurringDays] = useState([]);

  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewSlots, setPreviewSlots] = useState([]);

  // Get all categories used in the selected schedule
  const scheduleCategories = useMemo(() => {
    if (!selectedSchedule?.timeBlocks) return [];
    const categories = new Set();
    selectedSchedule.timeBlocks.forEach(block => {
      if (block.category) categories.add(block.category);
    });
    return Array.from(categories).map(catId =>
      BLOCK_CATEGORIES[catId.toUpperCase()] || { id: catId, name: catId, color: '#888', icon: '📦' }
    );
  }, [selectedSchedule]);

  // Get filtered blocks based on selected categories
  const filteredBlocks = useMemo(() => {
    if (!selectedSchedule?.timeBlocks) return [];
    if (selectedCategories.length === 0) return selectedSchedule.timeBlocks;
    return selectedSchedule.timeBlocks.filter(block =>
      selectedCategories.includes(block.category)
    );
  }, [selectedSchedule, selectedCategories]);

  /**
   * Calculate date range
   */
  function getDateRange() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateRange === 'custom') {
      return {
        startDate: customStartDate || today.toISOString().split('T')[0],
        endDate: customEndDate || today.toISOString().split('T')[0]
      };
    }

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + (DATE_RANGES[dateRange]?.days || 7) - 1);

    return {
      startDate: today.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  }

  /**
   * Generate preview of slots to be created
   */
  function generatePreview() {
    if (!selectedSchedule) return;

    const { startDate, endDate } = getDateRange();

    // Filter blocks based on selections
    let blocksToApply = filteredBlocks;
    if (selectedBlocks.length > 0) {
      blocksToApply = filteredBlocks.filter((block, idx) =>
        selectedBlocks.includes(idx)
      );
    }

    // Create a temporary schedule with only selected blocks
    const filteredSchedule = {
      ...selectedSchedule,
      timeBlocks: blocksToApply
    };

    // Generate slots
    const options = {};
    if (isRecurring && recurringDays.length > 0) {
      options.daysOfWeek = recurringDays;
    }

    const slots = generateSlotsFromSchedule(filteredSchedule, startDate, endDate, options);
    setPreviewSlots(slots);
    setShowPreview(true);
  }

  /**
   * Apply the schedule
   */
  function handleApply() {
    if (!selectedSchedule || previewSlots.length === 0) return;

    const { startDate, endDate } = getDateRange();

    // If replacing, delete existing slots in range first
    if (applicationMode === 'replace') {
      const slotsToDelete = existingSlots.filter(slot =>
        slot.date >= startDate && slot.date <= endDate
      );
      slotsToDelete.forEach(slot => {
        dispatch({
          type: ACTION_TYPES.DELETE_SLOT,
          payload: { id: slot.id }
        });
      });
    }

    // Apply each new slot
    previewSlots.forEach(slotData => {
      // For overlay mode, check if time is already occupied
      if (applicationMode === 'overlay') {
        const hasOverlap = existingSlots.some(existing =>
          existing.date === slotData.date &&
          ((slotData.startTime >= existing.startTime && slotData.startTime < existing.endTime) ||
           (slotData.endTime > existing.startTime && slotData.endTime <= existing.endTime))
        );
        if (hasOverlap) return; // Skip this slot
      }

      dispatch({
        type: ACTION_TYPES.ADD_SLOT,
        payload: {
          ...slotData,
          sourceScheduleId: selectedSchedule.id
        }
      });
    });

    // Record the schedule application
    dispatch({
      type: ACTION_TYPES.APPLY_SCHEDULE,
      payload: {
        scheduleId: selectedSchedule.id,
        startDate,
        endDate,
        applicationMode,
        isRecurring,
        slotsCreated: previewSlots.length
      }
    });

    onClose();
  }

  /**
   * Toggle category selection
   */
  function toggleCategory(categoryId) {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(c => c !== categoryId)
        : [...prev, categoryId]
    );
    // Reset block selections when categories change
    setSelectedBlocks([]);
  }

  /**
   * Toggle block selection
   */
  function toggleBlock(blockIndex) {
    setSelectedBlocks(prev =>
      prev.includes(blockIndex)
        ? prev.filter(b => b !== blockIndex)
        : [...prev, blockIndex]
    );
  }

  /**
   * Toggle recurring day
   */
  function toggleRecurringDay(day) {
    setRecurringDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  }

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Apply Schedule</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.content}>
          {/* Step 1: Select Schedule */}
          <section className={styles.section}>
            <h3>1. Choose a Schedule</h3>
            <div className={styles.scheduleGrid}>
              {allSchedules.map(schedule => (
                <button
                  key={schedule.id}
                  className={`${styles.scheduleCard} ${selectedSchedule?.id === schedule.id ? styles.selected : ''}`}
                  onClick={() => {
                    setSelectedSchedule(schedule);
                    setSelectedCategories([]);
                    setSelectedBlocks([]);
                    setShowPreview(false);
                  }}
                >
                  <div className={styles.scheduleName}>{schedule.name}</div>
                  <div className={styles.scheduleAuthor}>{schedule.author}</div>
                  <div className={styles.scheduleTags}>
                    {schedule.tags?.slice(0, 3).map(tag => (
                      <span key={tag} className={styles.tag}>{tag}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Step 2: Select Categories/Blocks */}
          {selectedSchedule && (
            <section className={styles.section}>
              <h3>2. Select What to Apply</h3>

              {/* Categories */}
              <div className={styles.subsection}>
                <label className={styles.subsectionLabel}>
                  Categories (click to filter)
                </label>
                <div className={styles.categoryList}>
                  {scheduleCategories.map(cat => (
                    <button
                      key={cat.id}
                      className={`${styles.categoryButton} ${selectedCategories.includes(cat.id) ? styles.selected : ''}`}
                      style={{
                        '--cat-color': cat.color,
                        backgroundColor: selectedCategories.includes(cat.id) ? `${cat.color}30` : 'transparent',
                        borderColor: selectedCategories.includes(cat.id) ? cat.color : 'rgba(255,255,255,0.1)'
                      }}
                      onClick={() => toggleCategory(cat.id)}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </button>
                  ))}
                </div>
                {selectedCategories.length === 0 && (
                  <span className={styles.hint}>No filter = apply all categories</span>
                )}
              </div>

              {/* Individual Blocks */}
              <div className={styles.subsection}>
                <label className={styles.subsectionLabel}>
                  Time Blocks ({filteredBlocks.length})
                </label>
                <div className={styles.blockList}>
                  {filteredBlocks.map((block, idx) => (
                    <button
                      key={idx}
                      className={`${styles.blockButton} ${selectedBlocks.includes(idx) || selectedBlocks.length === 0 ? styles.included : styles.excluded}`}
                      style={{ borderColor: block.color }}
                      onClick={() => toggleBlock(idx)}
                    >
                      <span className={styles.blockTime}>{block.start} - {block.end}</span>
                      <span className={styles.blockLabel}>{block.icon} {block.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Step 3: Date Range */}
          {selectedSchedule && (
            <section className={styles.section}>
              <h3>3. Choose Date Range</h3>
              <div className={styles.dateRangeOptions}>
                {Object.values(DATE_RANGES).map(range => (
                  <button
                    key={range.id}
                    className={`${styles.rangeButton} ${dateRange === range.id ? styles.selected : ''}`}
                    onClick={() => setDateRange(range.id)}
                  >
                    {range.name}
                  </button>
                ))}
              </div>

              {dateRange === 'custom' && (
                <div className={styles.customDateInputs}>
                  <label>
                    <span>Start Date</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={e => setCustomStartDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </label>
                  <label>
                    <span>End Date</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={e => setCustomEndDate(e.target.value)}
                      min={customStartDate || new Date().toISOString().split('T')[0]}
                    />
                  </label>
                </div>
              )}

              {/* Recurring option */}
              <div className={styles.recurringOption}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={e => setIsRecurring(e.target.checked)}
                  />
                  <span>Apply only on specific days of the week</span>
                </label>

                {isRecurring && (
                  <div className={styles.dayButtons}>
                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                      <button
                        key={day}
                        className={`${styles.dayButton} ${recurringDays.includes(day) ? styles.selected : ''}`}
                        onClick={() => toggleRecurringDay(day)}
                      >
                        {day.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Step 4: Application Mode */}
          {selectedSchedule && (
            <section className={styles.section}>
              <h3>4. Application Mode</h3>
              <div className={styles.modeOptions}>
                {Object.values(APPLICATION_MODES).map(mode => (
                  <button
                    key={mode.id}
                    className={`${styles.modeButton} ${applicationMode === mode.id ? styles.selected : ''}`}
                    onClick={() => setApplicationMode(mode.id)}
                  >
                    <span className={styles.modeIcon}>{mode.icon}</span>
                    <span className={styles.modeName}>{mode.name}</span>
                    <span className={styles.modeDescription}>{mode.description}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Preview */}
          {showPreview && previewSlots.length > 0 && (
            <section className={styles.section}>
              <h3>Preview ({previewSlots.length} slots)</h3>
              <div className={styles.previewList}>
                {previewSlots.slice(0, 20).map((slot, idx) => (
                  <div key={idx} className={styles.previewSlot}>
                    <span className={styles.previewDate}>{slot.date}</span>
                    <span className={styles.previewTime}>{slot.startTime} - {slot.endTime}</span>
                    <span className={styles.previewLabel}>{slot.label}</span>
                  </div>
                ))}
                {previewSlots.length > 20 && (
                  <div className={styles.previewMore}>
                    +{previewSlots.length - 20} more slots
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button className={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <div className={styles.actionsRight}>
            <button
              className={styles.previewButton}
              onClick={generatePreview}
              disabled={!selectedSchedule}
            >
              Preview
            </button>
            <button
              className={styles.applyButton}
              onClick={handleApply}
              disabled={!selectedSchedule || previewSlots.length === 0}
            >
              Apply Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScheduleApplicator;
