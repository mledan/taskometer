import React, { useMemo } from 'react';
import styles from './CircularSchedule.module.css';
import { ACTIVITY_TYPES } from '../utils/scheduleTemplates.js';

const MINUTES_PER_DAY = 24 * 60;
const CLOCK_OFFSET_DEG = -90; // Rotate so midnight starts at the top.
const FALLBACK_COLORS = ['#2563EB', '#0EA5E9', '#7C3AED', '#10B981', '#F59E0B', '#EC4899', '#06B6D4'];
const HOUR_MARKERS = [0, 6, 12, 18];

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

// Props:
// - timeBlocks: [{ start: 'HH:mm', end: 'HH:mm', type: 'work' | ... , label?: string }]
// - showLegend?: boolean
// - title?: string
// - showNow?: boolean // draw current local time hand
function CircularSchedule({ timeBlocks = [], showLegend = true, title = 'Daily', showNow = true }) {
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

  return (
    <div>
      <div className={styles.circularContainer} aria-label="Circular daily schedule">
        <div className={styles.ring} />
        {segments}
        {shouldShowHourMarkers ? hourMarkers : null}
        {nowHand}
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


