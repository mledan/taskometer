import { useEffect, useState } from 'react';

/**
 * Multi-select hook for date pickers / calendar grids. Tracks a Set of
 * YMD keys plus the most recently selected key (used for shift-extend
 * range selection). Wires Esc to clear from anywhere.
 *
 *   const ms = useMultiSelect();
 *   ms.selected     // Set<string>  – currently selected YMD keys
 *   ms.toggle(key)  // toggle one
 *   ms.extend(key)  // extend range from last toggled to key
 *   ms.clear()      // empty the selection
 */
function ymd(d) {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

export function useMultiSelect() {
  const [selected, setSelected] = useState(() => new Set());
  const [lastKey, setLastKey] = useState(null);

  const toggle = (key) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setLastKey(key);
  };

  const extend = (key) => {
    if (!lastKey) { toggle(key); return; }
    const a = new Date(`${lastKey}T00:00:00`);
    const b = new Date(`${key}T00:00:00`);
    const start = a.getTime() <= b.getTime() ? a : b;
    const end   = a.getTime() <= b.getTime() ? b : a;
    setSelected(prev => {
      const next = new Set(prev);
      const cur = new Date(start);
      while (cur.getTime() <= end.getTime()) {
        next.add(ymd(cur));
        cur.setDate(cur.getDate() + 1);
      }
      return next;
    });
    setLastKey(key);
  };

  const clear = () => { setSelected(new Set()); setLastKey(null); };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && selected.size > 0) clear();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected.size]);

  return { selected, toggle, extend, clear };
}
