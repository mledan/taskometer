import { useCallback, useEffect, useRef, useState } from 'react';

const reduceMotion = () => typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Eases a value toward `target`; `set` jumps it (for a slider drag). */
export function useMorph(target, duration = 400) {
  const [value, setValue] = useState(target);
  const ref = useRef(target);
  const raf = useRef(null);

  useEffect(() => {
    cancelAnimationFrame(raf.current);
    const from = ref.current;
    if (from === target) return undefined;
    if (reduceMotion()) { ref.current = target; setValue(target); return undefined; }
    const started = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - started) / duration);
      const eased = 1 - (1 - p) ** 3;
      const v = from + (target - from) * eased;
      ref.current = v;
      setValue(v);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  const set = useCallback((v) => {
    cancelAnimationFrame(raf.current);
    ref.current = v;
    setValue(v);
  }, []);

  return [value, set];
}
