import { useState } from 'react';
import { useAppState } from '../AppContext.jsx';
import { startOfWeek } from 'date-fns';
import { WeekView } from './calendar';
import CalendarSync from './CalendarSync.jsx';
import CalendarTemplateOverlay from './CalendarTemplateOverlay.jsx';
import styles from './CalendarView.module.css';

/**
 * CalendarView Component
 *
 * Main calendar view that integrates WeekView with slot editing,
 * template overlay, and calendar sync.
 *
 * Features:
 * - Week view with tasks and slots
 * - Slot editing mode toggle
 * - Template application overlay
 * - Calendar sync integration
 */
function CalendarView() {
  const { items = [] } = useAppState();
  const [selectedWeek, setSelectedWeek] = useState(startOfWeek(new Date()));
  const [isSlotEditMode, setIsSlotEditMode] = useState(false);

  // Filter items that have tasks (not just activity types)
  const tasks = items.filter(item => item && item.text);

  function handleTaskClick(e, task) {
    // WeekView handles the context menu internally
    console.log('Task clicked:', task);
  }

  function handleSlotEditModeChange(isEditing) {
    setIsSlotEditMode(isEditing);
  }

  return (
    <div className={styles.container}>
      <WeekView
        tasks={tasks}
        onTaskClick={handleTaskClick}
        showSlots={true}
        isSlotEditMode={isSlotEditMode}
        onSlotEditModeChange={handleSlotEditModeChange}
      />
      <CalendarSync />
      <CalendarTemplateOverlay currentWeekStart={selectedWeek} />
    </div>
  );
}

export default CalendarView;
