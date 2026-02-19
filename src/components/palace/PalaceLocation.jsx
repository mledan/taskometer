import { useState, useRef, useCallback, useEffect } from 'react';
import styles from './PalaceLocation.module.css';

/**
 * PalaceLocation Component
 * 
 * A draggable location marker within a memory palace.
 * Shows the location icon, name, and linked task indicators.
 */
function PalaceLocation({ location, isSelected, onSelect, onDrag, tasks = [] }) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const locationRef = useRef(null);

  // Handle drag start
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return; // Only left click
    
    e.stopPropagation();
    onSelect();
    
    const rect = locationRef.current.parentElement.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - (location.position.x / 100 * rect.width),
      y: e.clientY - (location.position.y / 100 * rect.height)
    });
    setIsDragging(true);
  }, [location.position, onSelect]);

  // Handle drag move
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const rect = locationRef.current?.parentElement?.getBoundingClientRect();
      if (!rect) return;

      // Calculate new position as percentage
      const newX = Math.max(0, Math.min(100, ((e.clientX - dragOffset.x) / rect.width) * 100));
      const newY = Math.max(0, Math.min(100, ((e.clientY - dragOffset.y) / rect.height) * 100));

      onDrag(location.id, { x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, location.id, onDrag]);

  // Touch events for mobile
  const handleTouchStart = useCallback((e) => {
    e.stopPropagation();
    onSelect();
    
    const touch = e.touches[0];
    const rect = locationRef.current.parentElement.getBoundingClientRect();
    setDragOffset({
      x: touch.clientX - (location.position.x / 100 * rect.width),
      y: touch.clientY - (location.position.y / 100 * rect.height)
    });
    setIsDragging(true);
  }, [location.position, onSelect]);

  useEffect(() => {
    if (!isDragging) return;

    const handleTouchMove = (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = locationRef.current?.parentElement?.getBoundingClientRect();
      if (!rect) return;

      const newX = Math.max(0, Math.min(100, ((touch.clientX - dragOffset.x) / rect.width) * 100));
      const newY = Math.max(0, Math.min(100, ((touch.clientY - dragOffset.y) / rect.height) * 100));

      onDrag(location.id, { x: newX, y: newY });
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, dragOffset, location.id, onDrag]);

  const hasLinkedTasks = tasks.length > 0;
  const hasReminders = location.staticReminders.length > 0;

  return (
    <div
      ref={locationRef}
      className={`${styles.location} ${isSelected ? styles.selected : ''} ${isDragging ? styles.dragging : ''}`}
      style={{
        left: `${location.position.x}%`,
        top: `${location.position.y}%`,
        '--location-color': location.color,
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Main icon */}
      <div className={styles.iconWrapper} style={{ backgroundColor: location.color }}>
        <span className={styles.icon}>{location.icon}</span>
      </div>
      
      {/* Location name */}
      <div className={styles.name}>{location.name}</div>
      
      {/* Indicators */}
      <div className={styles.indicators}>
        {hasLinkedTasks && (
          <span className={styles.taskIndicator} title={`${tasks.length} linked task(s)`}>
            {tasks.length}
          </span>
        )}
        {hasReminders && (
          <span className={styles.reminderIndicator} title={`${location.staticReminders.length} reminder(s)`}>
            📌
          </span>
        )}
      </div>

      {/* Tooltip on hover (non-selected) */}
      {!isSelected && (hasLinkedTasks || hasReminders) && (
        <div className={styles.tooltip}>
          {hasLinkedTasks && (
            <div className={styles.tooltipSection}>
              <strong>Tasks:</strong>
              <ul>
                {tasks.slice(0, 3).map(task => (
                  <li key={task.key || task.id}>{task.text}</li>
                ))}
                {tasks.length > 3 && <li>+{tasks.length - 3} more</li>}
              </ul>
            </div>
          )}
          {hasReminders && (
            <div className={styles.tooltipSection}>
              <strong>Reminders:</strong>
              <ul>
                {location.staticReminders.slice(0, 3).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PalaceLocation;
