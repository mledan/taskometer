import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import styles from './CircularSchedule.module.css';
import { ACTIVITY_TYPES } from '../utils/scheduleTemplates.js';

const MINUTES_PER_DAY = 24 * 60;
const CLOCK_OFFSET_DEG = -90; // Rotate so midnight starts at the top.
const FALLBACK_COLORS = ['#2563EB', '#0EA5E9', '#7C3AED', '#10B981', '#F59E0B', '#EC4899', '#06B6D4'];
const HOUR_MARKERS = [0, 6, 12, 18];
const DEFAULT_SLIDER_STEP_MINUTES = 15;
const HANDLE_DISTANCE_FROM_CENTER_PX = 82;

function parseToMinutes(value) {
  if (!value || typeof value !== 'string') return 0;
  const [hoursPart = '0', minutesPart = '0'] = value.split(':');
  const hours = Number.parseInt(hoursPart, 10);
  const minutes = Number.parseInt(minutesPart, 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  const clampedHours = ((hours % 24) + 24) % 24;
  const clampedMinutes = Math.min(59, Math.max(0, minutes));
  return clampedHours * 60 + clampedMinutes;
}

function normalizeMinutes(minutes) {
  const numericMinutes = Number.isFinite(minutes) ? minutes : 0;
  const normalized = ((numericMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return normalized;
}

function minutesToTimeString(minutes) {
  const normalizedMinutes = normalizeMinutes(Math.round(minutes));
  const hours = Math.floor(normalizedMinutes / 60);
  const mins = normalizedMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function formatTypeLabel(type) {
  return String(type || 'buffer')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getFallbackColor(type) {
  const key = String(type || 'buffer');
  const hash = [...key].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

function formatMinutes(minutes) {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getBlockVisual(block) {
  const type = String(block?.type || 'buffer');
  const canonical = ACTIVITY_TYPES[type.toUpperCase()];
  if (canonical) {
    return {
      color: canonical.color,
      label: canonical.name || formatTypeLabel(canonical.id || type),
    };
  }
  return {
    color: block?.color || getFallbackColor(type),
    label: formatTypeLabel(type),
  };
}

function minutesToDeg(minutes) {
  return (minutes / MINUTES_PER_DAY) * 360 + CLOCK_OFFSET_DEG;
}

function pointerToMinutes(clientX, clientY, rect, stepMinutes) {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = clientX - centerX;
  const dy = clientY - centerY;
  const angleFromTop = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  const normalizedAngle = ((angleFromTop % 360) + 360) % 360;
  const exactMinutes = (normalizedAngle / 360) * MINUTES_PER_DAY;
  const safeStep = Math.max(1, Math.round(stepMinutes || DEFAULT_SLIDER_STEP_MINUTES));
  const snapped = Math.round(exactMinutes / safeStep) * safeStep;
  return normalizeMinutes(snapped);
}

// Props:
// - timeBlocks: [{ start: 'HH:mm', end: 'HH:mm', type: 'work' | ... , label?: string }]
// - showLegend?: boolean
// - title?: string
// - showNow?: boolean // draw current local time hand
// - editableSlot?: { start: 'HH:mm', end: 'HH:mm', type?: string, label?: string }
// - onEditableSlotChange?: (slot) => void
// - editableColor?: string
// - sliderStepMinutes?: number
function CircularSchedule({
  timeBlocks = [],
  showLegend = true,
  title = 'Daily',
  showNow = true,
  editableSlot = null,
  onEditableSlotChange = null,
  editableColor = null,
  sliderStepMinutes = DEFAULT_SLIDER_STEP_MINUTES,
}) {
  const containerRef = useRef(null);
  const [draggingHandle, setDraggingHandle] = useState(null); // 'start' | 'end' | null
  const isEditable = Boolean(editableSlot && typeof onEditableSlotChange === 'function');

  const editableStartMin = parseToMinutes(editableSlot?.start);
  const editableEndMin = parseToMinutes(editableSlot?.end);

  const resolvedEditableColor = useMemo(() => {
    if (!isEditable) return null;
    if (editableColor) return editableColor;
    return getBlockVisual(editableSlot || {}).color;
  }, [editableColor, editableSlot, isEditable]);

  const updateEditableSlot = useCallback(
    (handle, nextMinutes) => {
      if (!isEditable || !editableSlot) return;
      const next = normalizeMinutes(nextMinutes);
      const currentStart = parseToMinutes(editableSlot.start);
      const currentEnd = parseToMinutes(editableSlot.end);
      let updatedStart = currentStart;
      let updatedEnd = currentEnd;

      if (handle === 'start') {
        if (next === currentEnd) return;
        updatedStart = next;
      } else if (handle === 'end') {
        if (next === currentStart) return;
        updatedEnd = next;
      } else {
        return;
      }

      onEditableSlotChange({
        ...editableSlot,
        start: minutesToTimeString(updatedStart),
        end: minutesToTimeString(updatedEnd),
      });
    },
    [editableSlot, isEditable, onEditableSlotChange]
  );

  const nudgeEditableHandle = useCallback(
    (handle, direction) => {
      if (!isEditable || !editableSlot) return;
      const step = Math.max(1, Math.round(sliderStepMinutes || DEFAULT_SLIDER_STEP_MINUTES));
      const current = handle === 'start' ? parseToMinutes(editableSlot.start) : parseToMinutes(editableSlot.end);
      updateEditableSlot(handle, current + step * direction);
    },
    [editableSlot, isEditable, sliderStepMinutes, updateEditableSlot]
  );

  const handleSliderKeyDown = useCallback(
    (event, handle) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        nudgeEditableHandle(handle, 1);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        nudgeEditableHandle(handle, -1);
      }
    },
    [nudgeEditableHandle]
  );

  useEffect(() => {
    if (!draggingHandle || !isEditable || !containerRef.current) return undefined;

    function handlePointerMove(event) {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const nextMinutes = pointerToMinutes(event.clientX, event.clientY, rect, sliderStepMinutes);
      updateEditableSlot(draggingHandle, nextMinutes);
    }

    function handlePointerUp() {
      setDraggingHandle(null);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingHandle, isEditable, sliderStepMinutes, updateEditableSlot]);
  // Normalize blocks to handle wrap across midnight.
  const normalizedBlocks = useMemo(() => {
    const blocks = [];
    timeBlocks.forEach((block) => {
      const start = parseToMinutes(block.start);
      const end = parseToMinutes(block.end);
      if (end > start) {
        blocks.push({ ...block, startMin: start, endMin: end });
        return;
      }
      if (end < start) {
        blocks.push({ ...block, startMin: start, endMin: MINUTES_PER_DAY });
        blocks.push({ ...block, startMin: 0, endMin: end });
      }
    });
    return blocks.sort((a, b) => a.startMin - b.startMin);
  }, [timeBlocks]);

  const segments = useMemo(
    () =>
      normalizedBlocks.map((block, idx) => {
        const startDeg = minutesToDeg(block.startMin);
        const endDeg = minutesToDeg(block.endMin);
        const { color } = getBlockVisual(block);
        const background = `conic-gradient(${color} ${startDeg}deg ${endDeg}deg, transparent ${endDeg}deg 360deg)`;
        return <div key={`${block.type || 'block'}-${block.startMin}-${idx}`} className={styles.segment} style={{ background }} />;
      }),
    [normalizedBlocks]
  );

  const editableSegments = useMemo(() => {
    if (!isEditable || editableStartMin === editableEndMin) return [];

    const previewParts = editableEndMin > editableStartMin
      ? [{ startMin: editableStartMin, endMin: editableEndMin }]
      : [
          { startMin: editableStartMin, endMin: MINUTES_PER_DAY },
          { startMin: 0, endMin: editableEndMin },
        ];

    return previewParts.map((part, idx) => {
      const startDeg = minutesToDeg(part.startMin);
      const endDeg = minutesToDeg(part.endMin);
      const background = `conic-gradient(${resolvedEditableColor} ${startDeg}deg ${endDeg}deg, transparent ${endDeg}deg 360deg)`;
      return (
        <div
          key={`editable-${part.startMin}-${part.endMin}-${idx}`}
          className={`${styles.segment} ${styles.editableSegment}`}
          style={{ background }}
        />
      );
    });
  }, [editableEndMin, editableStartMin, isEditable, resolvedEditableColor]);

  const legendEntries = useMemo(() => {
    const entriesByType = new Map();
    normalizedBlocks.forEach((block) => {
      const key = String(block.type || 'buffer');
      const current = entriesByType.get(key) || { ...getBlockVisual(block), key, minutes: 0 };
      current.minutes += Math.max(0, block.endMin - block.startMin);
      entriesByType.set(key, current);
    });
    return [...entriesByType.values()].sort((a, b) => b.minutes - a.minutes);
  }, [normalizedBlocks]);

  const hourMarkers = useMemo(
    () =>
      HOUR_MARKERS.map((hour) => {
        const deg = minutesToDeg(hour * 60);
        const label = hour === 0 ? '12a' : hour === 12 ? '12p' : `${hour}`;
        return (
          <div
            key={hour}
            className={styles.tickLabel}
            style={{ transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-96px) rotate(${-deg}deg)` }}
          >
            {label}
          </div>
        );
      }),
    []
  );
  const shouldShowHourMarkers = showLegend || showNow || Boolean(title);

  const nowHand = showNow ? (() => {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const deg = minutesToDeg(minutes);
    return <div className={styles.nowHand} style={{ transform: `translateX(-50%) rotate(${deg}deg)` }} />;
  })() : null;

  const sliderHandleStartStyle = {
    transform: `translate(-50%, -50%) rotate(${minutesToDeg(editableStartMin)}deg) translateY(-${HANDLE_DISTANCE_FROM_CENTER_PX}px)`,
    '--slider-color': resolvedEditableColor || '#3B82F6',
  };

  const sliderHandleEndStyle = {
    transform: `translate(-50%, -50%) rotate(${minutesToDeg(editableEndMin)}deg) translateY(-${HANDLE_DISTANCE_FROM_CENTER_PX}px)`,
    '--slider-color': resolvedEditableColor || '#3B82F6',
  };

  return (
    <div>
      <div
        ref={containerRef}
        className={`${styles.circularContainer} ${isEditable ? styles.interactive : ''}`}
        aria-label={isEditable ? 'Circular daily schedule with editable slot sliders' : 'Circular daily schedule'}
      >
        <div className={styles.ring} />
        {segments}
        {editableSegments}
        {shouldShowHourMarkers ? hourMarkers : null}
        {nowHand}
        {isEditable && (
          <>
            <button
              type="button"
              className={styles.sliderHandle}
              style={sliderHandleStartStyle}
              aria-label={`Adjust slot start time (${editableSlot.start})`}
              title={`Slot start: ${editableSlot.start}`}
              onPointerDown={(event) => {
                event.preventDefault();
                setDraggingHandle('start');
              }}
              onKeyDown={(event) => handleSliderKeyDown(event, 'start')}
            />
            <button
              type="button"
              className={styles.sliderHandle}
              style={sliderHandleEndStyle}
              aria-label={`Adjust slot end time (${editableSlot.end})`}
              title={`Slot end: ${editableSlot.end}`}
              onPointerDown={(event) => {
                event.preventDefault();
                setDraggingHandle('end');
              }}
              onKeyDown={(event) => handleSliderKeyDown(event, 'end')}
            />
          </>
        )}
        {title ? <div className={styles.centerLabel}>{title}</div> : null}
      </div>
      {showLegend && legendEntries.length > 0 && (
        <div className={styles.legend}>
          {legendEntries.map((entry) => (
            <div key={entry.key} className={styles.legendItem}>
              <span className={styles.legendSwatch} style={{ background: entry.color }} />
              <span>{entry.label}</span>
              <span className={styles.legendDuration}>{formatMinutes(entry.minutes)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CircularSchedule;


