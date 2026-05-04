import React, { useMemo, useState } from 'react';
import {
  wakeTimesFromBedtime,
  bedtimesFromWake,
  hhmmToMin,
  fmtClock,
} from '../services/sleepCycles.js';

/**
 * SleepCycleHint — a compact sleep-cycle calculator that hangs off
 * any slot tagged sleep/rest/nap/knock-out (per services/sleepCycles
 * isSleepSlot).
 *
 * Renders inside the slot's expanded panel on the wheel. Two modes:
 *   "from bedtime" — given the slot's start time, show optimal wake
 *     times (4/5/6 cycles after fall-asleep).
 *   "from wake" — given the slot's end time, show optimal bedtimes
 *     (so user picks duration).
 *
 * Both are presented as a tight row of options the user can read at
 * a glance without leaving the day view.
 *
 *   slot      — { startTime, endTime, label }
 *   compact   — drop the heading and use smaller type for tight UIs
 */
export default function SleepCycleHint({ slot, compact = false, sourceUrl = 'https://sleepyti.me' }) {
  const [mode, setMode] = useState('bedtime'); // 'bedtime' | 'wake'

  const bedMin = useMemo(() => hhmmToMin(slot?.startTime || '23:00'), [slot?.startTime]);
  const wakeMin = useMemo(() => hhmmToMin(slot?.endTime || '06:00'), [slot?.endTime]);

  const wakes = useMemo(() => wakeTimesFromBedtime(bedMin), [bedMin]);
  const beds = useMemo(() => bedtimesFromWake(wakeMin), [wakeMin]);

  const bedLabel = fmtClock(bedMin);
  const wakeLabel = fmtClock(wakeMin);

  const headingFontSize = compact ? 11 : 12;
  const bodyFontSize = compact ? 12 : 13;

  return (
    <div
      role="region"
      aria-label="sleep cycle hint"
      style={{
        marginTop: 8,
        padding: compact ? '8px 10px' : '10px 12px',
        border: '1px solid var(--rule)',
        borderRadius: 8,
        background: 'var(--paper-warm, #FAF5EC)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span
          className="tm-mono"
          style={{
            color: '#6B46C1',
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            fontSize: headingFontSize,
            fontWeight: 600,
          }}
        >
          💤 sleep cycle
        </span>
        <div className="tm-seg" style={{ marginLeft: 'auto' }}>
          <button
            type="button"
            className={mode === 'bedtime' ? 'tm-on' : ''}
            onClick={() => setMode('bedtime')}
            title={`if you fall asleep at ${bedLabel}, when to wake`}
            style={{ fontSize: 10 }}
          >
            from {bedLabel}
          </button>
          <button
            type="button"
            className={mode === 'wake' ? 'tm-on' : ''}
            onClick={() => setMode('wake')}
            title={`to wake at ${wakeLabel}, when to fall asleep`}
            style={{ fontSize: 10 }}
          >
            wake {wakeLabel}
          </button>
        </div>
      </div>

      {mode === 'bedtime' ? (
        <div style={{ fontSize: bodyFontSize, color: 'var(--ink)', lineHeight: 1.5 }}>
          fall asleep at <strong>{bedLabel}</strong> → wake at end of cycle:{' '}
          {wakes.map((w, i) => (
            <span key={i}>
              <strong style={{ color: '#6B46C1' }}>{fmtClock(w.wakeMin)}</strong>
              <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}> ({w.hours}h)</span>
              {i < wakes.length - 1 ? ' · ' : ''}
            </span>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: bodyFontSize, color: 'var(--ink)', lineHeight: 1.5 }}>
          to wake at <strong>{wakeLabel}</strong> → fall asleep by:{' '}
          {beds.map((b, i) => (
            <span key={i}>
              <strong style={{ color: '#6B46C1' }}>{fmtClock(b.bedtimeMin)}</strong>
              <span className="tm-mono tm-sm" style={{ color: 'var(--ink-mute)' }}> ({b.hours}h)</span>
              {i < beds.length - 1 ? ' · ' : ''}
            </span>
          ))}
        </div>
      )}

      <div className="tm-mono" style={{ fontSize: 10, color: 'var(--ink-mute)', lineHeight: 1.4 }}>
        based on a 90-min sleep cycle + 14-min fall-asleep · cross-ref{' '}
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--ink-mute)', textDecoration: 'underline' }}
        >
          sleepyti.me
        </a>
      </div>
    </div>
  );
}
