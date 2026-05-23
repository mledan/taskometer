/**
 * Shared quick-add helpers for inline capture.
 */

export function ymd(d) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

/** Build a local ISO datetime for a given YYYY-MM-DD + minutes-from-midnight. */
export function isoAt(dayKey, startMin) {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d, Math.floor(startMin / 60), Math.round(startMin) % 60, 0, 0);
  return dt.toISOString();
}

/**
 * Parse a quick-add string: trailing time token becomes the start time,
 * everything before it is the label. "gym 6pm", "lunch 12:30".
 */
export function parseQuickAdd(raw) {
  const text = (raw || '').trim();
  const m = text.match(/\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const ap = m[3] && m[3].toLowerCase();
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    if (h <= 23 && min <= 59) {
      const label = text.slice(0, m.index).trim();
      if (label) return { label, startMin: h * 60 + min };
    }
  }
  return { label: text, startMin: null };
}

/** Short clock label: 540 -> "9a", 780 -> "1p". */
export function fmtClock(min) {
  const h24 = Math.floor(min / 60) % 24;
  const m = Math.round(min) % 60;
  const hr = (h24 % 12) || 12;
  const ap = h24 < 12 ? 'a' : 'p';
  return `${hr}${m ? ':' + (m < 10 ? '0' + m : m) : ''}${ap}`;
}
