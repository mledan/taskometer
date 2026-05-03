import React, { useMemo } from 'react';

const DAY = 24 * 60;
function hhmmToMin(s) {
  const [h, m] = (s || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
function spanMin(startTime, endTime) {
  const s = hhmmToMin(startTime);
  const e = hhmmToMin(endTime);
  return e <= s ? e + DAY - s : e - s;
}

/**
 * Compute total sleep minutes from today's slots. Counts slots whose
 * slotType is 'sleep' (or label that contains "sleep"). Cross-midnight
 * spans are handled by spanMin.
 */
function totalSleepMin(slots) {
  let m = 0;
  for (const s of slots) {
    const isSleep = s?.slotType === 'sleep'
      || /sleep/i.test(s?.label || '');
    if (!isSleep) continue;
    m += spanMin(s.startTime, s.endTime);
  }
  return m;
}

/**
 * SleepPSA — a small card that surfaces the day's sleep block, since
 * the user explicitly said "always keep a sleep time and put a psa for
 * sleep time." Shows total sleep, flags if it dips under 7 hours, and
 * links to sleepyti.me so the user can pick a wake time that respects
 * 90-minute cycles.
 *
 * Quiet when sleep is healthy; louder when it's short or missing.
 */
export default function SleepPSA({ slots = [], dateKey }) {
  const todaySlots = useMemo(
    () => (slots || []).filter(s => s?.date === dateKey),
    [slots, dateKey],
  );
  const sleepMin = useMemo(() => totalSleepMin(todaySlots), [todaySlots]);
  const sleepHours = sleepMin / 60;
  const missing = sleepMin === 0;
  const short = sleepMin > 0 && sleepHours < 7;

  const tone = missing
    ? { ring: 'var(--orange)', accent: 'var(--orange)' }
    : short
      ? { ring: '#F59E0B', accent: '#F59E0B' }
      : { ring: 'var(--rule)', accent: '#6B46C1' };

  const headline = missing
    ? 'No sleep block today'
    : short
      ? `Only ${sleepHours.toFixed(1)}h of sleep`
      : `${sleepHours.toFixed(1)}h of sleep`;

  const body = missing
    ? 'Add a sleep block before you fill the rest of the day. The skeleton paints 11pm–6am by default.'
    : short
      ? 'Use sleepyti.me to pick a wake time that lands at the end of a 90-minute cycle — feels less groggy than waking mid-cycle.'
      : 'Plan around it. sleepyti.me will tell you when to fall asleep so you wake at the end of a cycle.';

  return (
    <div
      role="note"
      aria-label="sleep psa"
      style={{
        padding: '10px 14px',
        border: `1.5px solid ${tone.ring}`,
        borderRadius: 10,
        background: 'var(--paper)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div
        className="tm-mono tm-sm"
        style={{
          color: tone.accent,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}
      >
        💤 {headline}
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.4 }}>
        {body}
      </div>
      <a
        href="https://sleepyti.me"
        target="_blank"
        rel="noopener noreferrer"
        className="tm-mono tm-sm"
        style={{ color: tone.accent, alignSelf: 'flex-start', textDecoration: 'underline' }}
      >
        sleepyti.me →
      </a>
    </div>
  );
}
