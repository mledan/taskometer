import React, { useMemo } from 'react';
import styles from './CircularSchedule.module.css';
import { ACTIVITY_TYPES } from '../utils/scheduleTemplates.js';

// Props:
// - timeBlocks: [{ start: 'HH:mm', end: 'HH:mm', type: 'work' | ... , label?: string }]
// - showLegend?: boolean
// - title?: string
// - showNow?: boolean // draw current local time hand
function CircularSchedule({ timeBlocks = [], showLegend = true, title = 'Daily', showNow = true }) {
  // Convert HH:mm to minutes since midnight
  function parseToMinutes(str) {
    const [h, m] = str.split(':').map(Number);
    return h * 60 + m;
  }

  // Normalize blocks to handle wrap across midnight
  const normalizedBlocks = useMemo(() => {
    const blocks = [];
    timeBlocks.forEach(block => {
      const start = parseToMinutes(block.start);
      const end = parseToMinutes(block.end);
      if (end > start) {
        blocks.push({ ...block, startMin: start, endMin: end });
      } else {
        // wraps past midnight; split into two segments
        blocks.push({ ...block, startMin: start, endMin: 24 * 60 });
        blocks.push({ ...block, startMin: 0, endMin: end });
      }
    });
    return blocks;
  }, [timeBlocks]);

  function minutesToDeg(min) {
    return (min / (24 * 60)) * 360;
  }

  const segments = normalizedBlocks.map((b, idx) => {
    const startDeg = minutesToDeg(b.startMin);
    const endDeg = minutesToDeg(b.endMin);
    const sweep = Math.max(0, endDeg - startDeg);
    const color = (ACTIVITY_TYPES[b.type?.toUpperCase()]?.color) || '#94A3B8';
    const background = `conic-gradient(${color} ${startDeg}deg ${endDeg}deg, transparent ${endDeg}deg 360deg)`;
    return (
      <div key={idx} className={styles.segment} style={{ background }} />
    );
  });

  const legendItems = showLegend ? (
    <div className={styles.legend}>
      {[...new Set(timeBlocks.map(b => b.type))].map((type) => {
        const color = (ACTIVITY_TYPES[type?.toUpperCase()]?.color) || '#94A3B8';
        const label = ACTIVITY_TYPES[type?.toUpperCase()]?.label || type;
        return (
          <div key={String(type)} className={styles.legendItem}>
            <span className={styles.legendSwatch} style={{ background: color }} />
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  ) : null;

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
        {nowHand}
        <div className={styles.centerLabel}>{title}</div>
      </div>
      {legendItems}
    </div>
  );
}

export default CircularSchedule;


