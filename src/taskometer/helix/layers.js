import { slotSpan, ymd, DAY_MIN } from './slotMath.js';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * The turns after the day in view: one layer per day with that day's
 * blocks and how many tasks each holds. Day 0 is rendered by the wheel's
 * own (editable) path, so layers start at 1.
 */
export function buildDayLayers({ slots = [], tasks = [], baseDate, days = 1, todayKey }) {
  const layers = [];
  for (let d = 1; d < days; d++) {
    const date = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + d);
    const dateKey = ymd(date);
    const daySlots = slots
      .filter(s => s?.date === dateKey)
      .slice()
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
    const spans = daySlots.map(s => ({ slot: s, ...slotSpan(s) }));
    const counts = new Map(daySlots.map(s => [s.id, { count: 0, done: 0 }]));
    for (const t of tasks) {
      if (!t?.scheduledTime || t.status === 'cancelled') continue;
      const when = new Date(t.scheduledTime);
      if (Number.isNaN(when.getTime()) || ymd(when) !== dateKey) continue;
      let id = t.scheduledSlotId && counts.has(t.scheduledSlotId) ? t.scheduledSlotId : null;
      if (!id) {
        const m = when.getHours() * 60 + when.getMinutes();
        const hit = spans.find(({ sMin, eMin }) => {
          const mm = m < sMin && eMin > DAY_MIN ? m + DAY_MIN : m;
          return mm >= sMin && mm < eMin;
        });
        id = hit?.slot.id || null;
      }
      if (!id) continue;
      const c = counts.get(id);
      c.count += 1;
      if (t.status === 'completed') c.done += 1;
    }
    const isToday = todayKey === dateKey;
    const label = isToday ? 'today' : d === 1 && ymd(new Date(baseDate.getTime())) === todayKey ? 'tomorrow' : `${DAY_SHORT[date.getDay()]} ${date.getDate()}`;
    layers.push({
      dayIndex: d,
      date,
      dateKey,
      label,
      slots: spans.map(({ slot, sMin, eMin }) => ({ slot, startH: sMin / 60, endH: eMin / 60, ...counts.get(slot.id) })),
    });
  }
  return layers;
}
