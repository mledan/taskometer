/**
 * SlotEditor Component
 *
 * Interactive slot creation and editing overlay for the calendar.
 * Allows users to:
 * - Click and drag to create new slots
 * - Click existing slots to edit them
 * - Drag slot edges to resize
 * - Delete slots
 *
 * Integrates with SlotConfigPanel for detailed slot configuration.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAppReducer, useSlots, useTaskTypes, useTags } from '../../context/AppContext';
import { ACTION_TYPES } from '../../context/AppContext';
import { createCalendarSlot } from '../../models/CalendarSlot';
import SlotConfigPanel from './SlotConfigPanel';
import styles from './SlotEditor.module.css';

const TIME_SLOT_HEIGHT = 30; // pixels per 30-minute slot (match CalendarView)
const MIN_SLOT_DURATION = 15; // minimum 15 minutes

function SlotEditor({
  date,
  dayOffset = 0,
  isActive = false,
  onSlotCreated,
  onSlotUpdated,
  onSlotDeleted,
  existingSlots = []
}) {
  const dispatch = useAppReducer();
  const allSlots = useSlots();
  const taskTypes = useTaskTypes();
  const tags = useTags();

  // Dragging state for creating new slots
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragEnd, setDragEnd] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);

  // Editing state
  const [editingSlot, setEditingSlot] = useState(null);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Resize state
  const [resizingSlot, setResizingSlot] = useState(null);
  const [resizeEdge, setResizeEdge] = useState(null); // 'top' or 'bottom'

  const containerRef = useRef(null);

  // Get slots for the current date
  const slotsForDate = existingSlots.filter(slot =>
    slot.date === date || slot.date === formatDate(date)
  );

  /**
   * Convert Y position to time string (HH:MM)
   */
  function yToTime(y) {
    const totalMinutes = Math.floor(y / TIME_SLOT_HEIGHT) * 30;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  /**
   * Convert time string to Y position
   */
  function timeToY(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours * 60 + minutes) * (TIME_SLOT_HEIGHT / 30);
  }

  /**
   * Snap Y position to nearest 15-minute increment
   */
  function snapToGrid(y) {
    const gridSize = TIME_SLOT_HEIGHT / 2; // 15-minute increments
    return Math.round(y / gridSize) * gridSize;
  }

  /**
   * Format date to YYYY-MM-DD
   */
  function formatDate(d) {
    if (typeof d === 'string') return d;
    return d.toISOString().split('T')[0];
  }

  /**
   * Handle mouse down - start creating slot
   */
  function handleMouseDown(e) {
    if (!isActive || resizingSlot) return;

    // Only respond to left click on empty area
    if (e.button !== 0) return;
    if (e.target !== containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const y = snapToGrid(e.clientY - rect.top);

    setIsDragging(true);
    setDragStart(y);
    setDragEnd(y + TIME_SLOT_HEIGHT);
    setDragPreview({
      top: y,
      height: TIME_SLOT_HEIGHT,
      startTime: yToTime(y),
      endTime: yToTime(y + TIME_SLOT_HEIGHT)
    });
  }

  /**
   * Handle mouse move - update drag preview
   */
  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    if (isDragging && dragStart !== null) {
      const y = snapToGrid(Math.max(0, e.clientY - rect.top));
      const startY = Math.min(dragStart, y);
      const endY = Math.max(dragStart, y + TIME_SLOT_HEIGHT);
      const height = Math.max(MIN_SLOT_DURATION * (TIME_SLOT_HEIGHT / 30), endY - startY);

      setDragEnd(endY);
      setDragPreview({
        top: startY,
        height,
        startTime: yToTime(startY),
        endTime: yToTime(startY + height)
      });
    }

    if (resizingSlot && resizeEdge) {
      const y = snapToGrid(Math.max(0, e.clientY - rect.top));
      const currentStart = timeToY(resizingSlot.startTime);
      const currentEnd = timeToY(resizingSlot.endTime);

      let newStart = currentStart;
      let newEnd = currentEnd;

      if (resizeEdge === 'top') {
        newStart = Math.min(y, currentEnd - MIN_SLOT_DURATION * (TIME_SLOT_HEIGHT / 30));
      } else {
        newEnd = Math.max(y, currentStart + MIN_SLOT_DURATION * (TIME_SLOT_HEIGHT / 30));
      }

      setDragPreview({
        top: newStart,
        height: newEnd - newStart,
        startTime: yToTime(newStart),
        endTime: yToTime(newEnd),
        isResize: true,
        slotId: resizingSlot.id
      });
    }
  }, [isDragging, dragStart, resizingSlot, resizeEdge]);

  /**
   * Handle mouse up - finish creating/resizing slot
   */
  const handleMouseUp = useCallback(() => {
    if (isDragging && dragPreview) {
      // Create new slot
      const newSlot = createCalendarSlot({
        date: formatDate(date),
        startTime: dragPreview.startTime,
        endTime: dragPreview.endTime,
        slotType: null, // Will be set in config panel
        flexibility: 'preferred'
      });

      setEditingSlot(newSlot);
      setIsCreatingNew(true);
      setShowConfigPanel(true);
    }

    if (resizingSlot && dragPreview?.isResize) {
      // Update slot with new times
      const updatedSlot = {
        ...resizingSlot,
        startTime: dragPreview.startTime,
        endTime: dragPreview.endTime
      };

      dispatch({
        type: ACTION_TYPES.UPDATE_SLOT,
        payload: {
          slotId: resizingSlot.id,
          updates: {
            startTime: dragPreview.startTime,
            endTime: dragPreview.endTime
          }
        }
      });

      if (onSlotUpdated) {
        onSlotUpdated(updatedSlot);
      }
    }

    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
    setDragPreview(null);
    setResizingSlot(null);
    setResizeEdge(null);
  }, [isDragging, dragPreview, date, resizingSlot, dispatch, onSlotUpdated]);

  // Global mouse event listeners
  useEffect(() => {
    if (isDragging || resizingSlot) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, resizingSlot, handleMouseMove, handleMouseUp]);

  /**
   * Handle slot click - open editor
   */
  function handleSlotClick(e, slot) {
    e.stopPropagation();
    setEditingSlot(slot);
    setIsCreatingNew(false);
    setShowConfigPanel(true);
  }

  /**
   * Handle resize start
   */
  function handleResizeStart(e, slot, edge) {
    e.stopPropagation();
    setResizingSlot(slot);
    setResizeEdge(edge);
  }

  /**
   * Handle save from config panel
   */
  function handleSaveSlot(slotData) {
    if (isCreatingNew) {
      dispatch({
        type: ACTION_TYPES.ADD_SLOT,
        payload: slotData
      });
      if (onSlotCreated) {
        onSlotCreated(slotData);
      }
    } else {
      const updates = { ...slotData };
      delete updates.id;
      dispatch({
        type: ACTION_TYPES.UPDATE_SLOT,
        payload: {
          slotId: slotData.id,
          updates
        }
      });
      if (onSlotUpdated) {
        onSlotUpdated(slotData);
      }
    }

    setShowConfigPanel(false);
    setEditingSlot(null);
    setIsCreatingNew(false);
  }

  /**
   * Handle delete from config panel
   */
  function handleDeleteSlot() {
    if (editingSlot?.id) {
      dispatch({
        type: ACTION_TYPES.DELETE_SLOT,
        payload: { slotId: editingSlot.id }
      });
      if (onSlotDeleted) {
        onSlotDeleted(editingSlot);
      }
    }

    setShowConfigPanel(false);
    setEditingSlot(null);
    setIsCreatingNew(false);
  }

  /**
   * Handle cancel from config panel
   */
  function handleCancel() {
    setShowConfigPanel(false);
    setEditingSlot(null);
    setIsCreatingNew(false);
  }

  /**
   * Get type color for slot
   */
  function getSlotColor(slot) {
    if (slot.color) return slot.color;
    if (slot.slotType) {
      const type = taskTypes.find(t => t.id === slot.slotType);
      if (type?.color) return type.color;
    }
    return '#3B82F6'; // Default blue
  }

  /**
   * Get slot display info
   */
  function getSlotDisplayInfo(slot) {
    const type = taskTypes.find(t => t.id === slot.slotType);
    return {
      label: slot.label || type?.name || 'Time Slot',
      icon: type?.icon || '',
      isAssigned: !!slot.assignedTaskId
    };
  }

  return (
    <>
      <div
        ref={containerRef}
        className={`${styles.container} ${isActive ? styles.active : ''}`}
        onMouseDown={handleMouseDown}
      >
        {/* Existing slots */}
        {slotsForDate.map(slot => {
          const top = timeToY(slot.startTime);
          const height = timeToY(slot.endTime) - top;
          const color = getSlotColor(slot);
          const { label, icon, isAssigned } = getSlotDisplayInfo(slot);

          return (
            <div
              key={slot.id}
              className={`${styles.slot} ${isAssigned ? styles.assigned : ''}`}
              style={{
                top: `${top}px`,
                height: `${height}px`,
                backgroundColor: `${color}20`,
                borderColor: color
              }}
              onClick={(e) => handleSlotClick(e, slot)}
            >
              {/* Resize handles */}
              {isActive && (
                <>
                  <div
                    className={styles.resizeHandle}
                    style={{ top: 0 }}
                    onMouseDown={(e) => handleResizeStart(e, slot, 'top')}
                  />
                  <div
                    className={styles.resizeHandle}
                    style={{ bottom: 0 }}
                    onMouseDown={(e) => handleResizeStart(e, slot, 'bottom')}
                  />
                </>
              )}

              {/* Slot content */}
              <div className={styles.slotContent}>
                <span className={styles.slotLabel}>
                  {icon && <span className={styles.slotIcon}>{icon}</span>}
                  {label}
                </span>
                <span className={styles.slotTime}>
                  {slot.startTime} - {slot.endTime}
                </span>
              </div>

              {/* Flexibility indicator */}
              <div className={styles.flexibilityBadge} title={`Flexibility: ${slot.flexibility}`}>
                {slot.flexibility === 'fixed' && '🔒'}
                {slot.flexibility === 'preferred' && '⭐'}
                {slot.flexibility === 'flexible' && '🌊'}
              </div>
            </div>
          );
        })}

        {/* Drag preview */}
        {dragPreview && (
          <div
            className={`${styles.dragPreview} ${dragPreview.isResize ? styles.resizePreview : ''}`}
            style={{
              top: `${dragPreview.top}px`,
              height: `${dragPreview.height}px`
            }}
          >
            <span className={styles.previewTime}>
              {dragPreview.startTime} - {dragPreview.endTime}
            </span>
          </div>
        )}
      </div>

      {/* Config Panel Modal */}
      {showConfigPanel && editingSlot && (
        <div className={styles.modalOverlay} onClick={handleCancel}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <SlotConfigPanel
              slot={editingSlot}
              onSave={handleSaveSlot}
              onCancel={handleCancel}
              onDelete={isCreatingNew ? null : handleDeleteSlot}
              isNew={isCreatingNew}
            />
          </div>
        </div>
      )}
    </>
  );
}

export default SlotEditor;
