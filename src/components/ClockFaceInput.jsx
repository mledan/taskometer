import { useCallback, useMemo, useState } from 'react';
import styles from './ClockFaceInput.module.css';

const HOURS_PER_RING = 12;
const MINUTE_OPTIONS = [0, 15, 30, 45];

function pad(n) {
  return String(n).padStart(2, '0');
}

function minutesToTimeStr(totalMin) {
  const h = Math.floor(((totalMin % 1440) + 1440) % 1440 / 60);
  const m = ((totalMin % 1440) + 1440) % 1440 % 60;
  return `${pad(h)}:${pad(m)}`;
}

function timeStrToMinutes(str) {
  if (!str || typeof str !== 'string') return 0;
  const [h, m] = str.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatDisplay(totalMin) {
  const clamped = ((totalMin % 1440) + 1440) % 1440;
  const h24 = Math.floor(clamped / 60);
  const m = clamped % 60;
  const h12 = h24 % 12 || 12;
  const suffix = h24 < 12 ? 'AM' : 'PM';
  return `${h12}:${pad(m)} ${suffix}`;
}

function formatDuration(minutes) {
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getHourPosition(hourIndex, ringRadius, containerSize) {
  const angle = ((hourIndex / HOURS_PER_RING) * 360 - 90) * (Math.PI / 180);
  const cx = containerSize / 2;
  const cy = containerSize / 2;
  return {
    left: cx + ringRadius * Math.cos(angle) - 16,
    top: cy + ringRadius * Math.sin(angle) - 16,
  };
}

function isHourInRange(hour, startHour, endHour) {
  if (startHour === null || endHour === null) return false;
  if (startHour === endHour) return hour === startHour;
  if (startHour < endHour) return hour >= startHour && hour <= endHour;
  return hour >= startHour || hour <= endHour;
}

function computeRangeDuration(startMin, endMin) {
  if (endMin > startMin) return endMin - startMin;
  return 1440 - startMin + endMin;
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const startRad = ((startAngle - 90) * Math.PI) / 180;
  const endRad = ((endAngle - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const sweep = endAngle - startAngle;
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

/**
 * ClockFaceInput - A dual-ring 24-hour clock for selecting time ranges.
 *
 * Inner ring: 12AM-11AM (midnight-noon). Outer ring: 12PM-11PM (noon-midnight).
 * Click an hour to set start, click again to set end. A minute picker appears
 * after each click for fine-grained control.
 */
function ClockFaceInput({
  startTime = '09:00',
  endTime = '17:00',
  onChange,
  timeBlocks = [],
  showNow = true,
  size = 280,
}) {
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [minutePickHour, setMinutePickHour] = useState(null);
  const [minutePickFor, setMinutePickFor] = useState(null);

  const startMin = timeStrToMinutes(startTime);
  const endMin = timeStrToMinutes(endTime);
  const startHour = Math.floor(startMin / 60);
  const endHour = Math.floor(endMin / 60);

  const innerRadius = size * 0.23;
  const outerRadius = size * 0.40;

  const nowMinutes = useMemo(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }, []);

  const nowHour = Math.floor(nowMinutes / 60);

  const handleHourClick = useCallback((h24) => {
    if (!selectingEnd) {
      setSelectingEnd(true);
      setMinutePickHour(h24);
      setMinutePickFor('start');
      if (onChange) {
        onChange({ start: minutesToTimeStr(h24 * 60), end: endTime });
      }
    } else {
      setSelectingEnd(false);
      setMinutePickHour(h24);
      setMinutePickFor('end');
      if (onChange) {
        onChange({ start: startTime, end: minutesToTimeStr(h24 * 60) });
      }
    }
  }, [selectingEnd, startTime, endTime, onChange]);

  const handleMinuteSelect = useCallback((minute) => {
    if (minutePickHour === null) return;
    const totalMin = minutePickHour * 60 + minute;
    const timeStr = minutesToTimeStr(totalMin);

    if (minutePickFor === 'start') {
      if (onChange) onChange({ start: timeStr, end: endTime });
    } else {
      if (onChange) onChange({ start: startTime, end: timeStr });
    }
    setMinutePickHour(null);
    setMinutePickFor(null);
  }, [minutePickHour, minutePickFor, startTime, endTime, onChange]);

  const dismissMinutePicker = useCallback(() => {
    setMinutePickHour(null);
    setMinutePickFor(null);
  }, []);

  const duration = computeRangeDuration(startMin, endMin);

  const blockArcs = useMemo(() => {
    const cx = size / 2;
    const cy = size / 2;
    const arcs = [];

    timeBlocks.forEach((block, i) => {
      const bStart = timeStrToMinutes(block.start);
      const bEnd = timeStrToMinutes(block.end);

      const renderArc = (rangeStart, rangeEnd, ring) => {
        const radius = ring === 'inner' ? innerRadius : outerRadius;
        const ringOffset = ring === 'inner' ? 0 : 12;
        const startFrac = ((rangeStart / 60) - ringOffset) / 12;
        const endFrac = ((rangeEnd / 60) - ringOffset) / 12;
        if (startFrac < 0 || startFrac >= 1 || endFrac <= 0 || endFrac > 1) return null;
        const startDeg = startFrac * 360;
        const endDeg = endFrac * 360;
        if (Math.abs(endDeg - startDeg) < 0.5) return null;
        return (
          <path
            key={`block-${i}-${ring}-${rangeStart}`}
            d={describeArc(cx, cy, radius, startDeg, endDeg)}
            fill="none"
            stroke={block.color || 'rgba(59,130,246,0.3)'}
            strokeWidth={18}
            strokeLinecap="round"
            opacity={0.3}
          />
        );
      };

      const splitAndRender = (s, e) => {
        if (s < 720 && e <= 720) {
          arcs.push(renderArc(s, e, 'inner'));
        } else if (s >= 720 && e > 720) {
          arcs.push(renderArc(s, e, 'outer'));
        } else if (s < 720 && e > 720) {
          arcs.push(renderArc(s, 720, 'inner'));
          arcs.push(renderArc(720, e, 'outer'));
        }
      };

      if (bEnd > bStart) {
        splitAndRender(bStart, bEnd);
      } else if (bEnd < bStart) {
        splitAndRender(bStart, 1440);
        splitAndRender(0, bEnd);
      }
    });

    return arcs.filter(Boolean);
  }, [timeBlocks, size, innerRadius, outerRadius]);

  const selectionArcs = useMemo(() => {
    const cx = size / 2;
    const cy = size / 2;
    const arcs = [];
    const selColor = 'rgba(59,130,246,0.55)';

    const renderSelArc = (rangeStart, rangeEnd, ring) => {
      const radius = ring === 'inner' ? innerRadius : outerRadius;
      const ringOffset = ring === 'inner' ? 0 : 12;
      const startFrac = Math.max(0, ((rangeStart / 60) - ringOffset) / 12);
      const endFrac = Math.min(1, ((rangeEnd / 60) - ringOffset) / 12);
      if (startFrac >= endFrac) return null;
      const startDeg = startFrac * 360;
      const endDeg = endFrac * 360;
      if (Math.abs(endDeg - startDeg) < 0.5) return null;
      return (
        <path
          key={`sel-${ring}-${rangeStart}`}
          d={describeArc(cx, cy, radius, startDeg, endDeg)}
          fill="none"
          stroke={selColor}
          strokeWidth={14}
          strokeLinecap="round"
          opacity={0.45}
        />
      );
    };

    const splitAndRender = (s, e) => {
      if (s < 720 && e <= 720) {
        arcs.push(renderSelArc(s, e, 'inner'));
      } else if (s >= 720 && e > 720) {
        arcs.push(renderSelArc(s, e, 'outer'));
      } else if (s < 720 && e > 720) {
        arcs.push(renderSelArc(s, 720, 'inner'));
        arcs.push(renderSelArc(720, e, 'outer'));
      }
    };

    if (endMin > startMin) {
      splitAndRender(startMin, endMin);
    } else if (endMin < startMin) {
      splitAndRender(startMin, 1440);
      splitAndRender(0, endMin);
    }

    return arcs.filter(Boolean);
  }, [startMin, endMin, size, innerRadius, outerRadius]);

  const nowHandDeg = useMemo(() => {
    const hourInRing = (nowMinutes / 60) % 12;
    return (hourInRing / 12) * 360 - 90;
  }, [nowMinutes]);

  const renderHourCells = (isOuter) => {
    const cells = [];
    const radius = isOuter ? outerRadius : innerRadius;

    for (let i = 0; i < HOURS_PER_RING; i++) {
      const h24 = isOuter ? i + 12 : i;
      const displayH = h24 % 12 || 12;
      const pos = getHourPosition(i, radius, size);

      const inRange = isHourInRange(h24, startHour, endHour);
      const isStart = h24 === startHour;
      const isEnd = h24 === endHour;
      const isNow = h24 === nowHour;

      let className = styles.hourCell;
      if (inRange && !isStart && !isEnd) className += ` ${styles.hourCellInRange}`;
      if (isStart) className += ` ${styles.hourCellStart}`;
      if (isEnd) className += ` ${styles.hourCellEnd}`;
      if (isNow && !isStart && !isEnd) className += ` ${styles.hourCellNow}`;

      cells.push(
        <button
          key={h24}
          type="button"
          className={className}
          style={{ left: pos.left, top: pos.top }}
          onClick={() => handleHourClick(h24)}
          title={`${displayH}:00 ${isOuter ? 'PM' : 'AM'}`}
        >
          {displayH}
        </button>
      );
    }
    return cells;
  };

  return (
    <div className={styles.wrapper}>
      <div
        className={styles.clockContainer}
        style={{ width: size, height: size }}
        onClick={minutePickHour !== null ? dismissMinutePicker : undefined}
      >
        <div className={`${styles.clockRing} ${styles.outerRing}`} />
        <div className={`${styles.clockRing} ${styles.innerRing}`} />

        <svg className={styles.arcLayer} width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {blockArcs}
          {selectionArcs}
        </svg>

        {renderHourCells(false)}
        {renderHourCells(true)}

        <span className={styles.amLabel}>AM</span>
        <span className={styles.pmLabel}>PM</span>

        {showNow && (
          <div
            className={styles.nowHand}
            style={{
              transform: `translateX(-50%) rotate(${nowHandDeg}deg)`,
              height: nowMinutes < 720 ? '22%' : '40%',
            }}
          />
        )}

        {minutePickHour !== null && (
          <div className={styles.minuteOverlay} onClick={(e) => e.stopPropagation()}>
            <div className={styles.minuteRing}>
              <div className={styles.minuteHeader}>
                {minutePickHour % 12 || 12}:{' '}
                <span>{minutePickFor === 'start' ? 'Start' : 'End'}</span>
              </div>
              {MINUTE_OPTIONS.map((m) => {
                const total = minutePickHour * 60 + m;
                const isActive = minutePickFor === 'start' ? total === startMin : total === endMin;
                return (
                  <button
                    key={m}
                    type="button"
                    className={`${styles.minuteBtn} ${isActive ? styles.minuteBtnActive : ''}`}
                    onClick={() => handleMinuteSelect(m)}
                  >
                    :{pad(m)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className={styles.timeDisplay}>
        <span className={`${styles.timeChip} ${styles.startChip}`}>{formatDisplay(startMin)}</span>
        <span style={{ color: 'var(--font-color-secondary)', fontSize: 12 }}>to</span>
        <span className={`${styles.timeChip} ${styles.endChip}`}>{formatDisplay(endMin)}</span>
        <span className={styles.durationChip}>{formatDuration(duration)}</span>
      </div>

      <p className={styles.instructions}>
        {selectingEnd ? 'Now click an hour to set end time' : 'Click an hour to set start time'}
      </p>
    </div>
  );
}

export default ClockFaceInput;
