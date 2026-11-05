import { useCallback, useEffect, useRef, useState } from 'react';

const reduceMotion = () => typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const easeOut = (p) => 1 - (1 - p) ** 3;
const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);

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
      const v = from + (target - from) * easeOut(p);
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

/** Where each lens sits on the (t, u) plane: t unrolls the wheel, u drops it into a column. */
export const LENS_POSE = {
  wheel: { t: 0, u: 0 },
  spiral: { t: 1, u: 0 },
  blocks: { t: 1, u: 1 },
};

/**
 * Routes between lenses through the helix: wheel → blocks first unrolls
 * the ring (t: 0→1) and then lets the blocks drop (u: 0→1); the way
 * back lifts them onto the helix before it rolls up again. Returns the
 * live {t, u} and `setT` for the flat↔helix slider.
 */
export function useLensRoute(lens, { unroll = 380, drop = 560 } = {}) {
  const target = LENS_POSE[lens] || LENS_POSE.wheel;
  const [pose, setPose] = useState(target);
  const live = useRef(target);
  const raf = useRef(null);

  useEffect(() => {
    cancelAnimationFrame(raf.current);
    const from = live.current;
    if (from.t === target.t && from.u === target.u) return undefined;
    if (reduceMotion()) { live.current = target; setPose(target); return undefined; }

    // Legs: each is a straight move on one axis so the picture always
    // reads as "the ring unrolls" or "the blocks drop", never both at once.
    const legs = [];
    if (target.u > from.u) {
      if (from.t < 1) legs.push({ t: 1, u: from.u, dur: unroll * (1 - from.t), ease: easeOut });
      legs.push({ t: 1, u: 1, dur: drop * (1 - from.u), ease: easeInOut });
    } else if (target.u < from.u) {
      legs.push({ t: from.t, u: 0, dur: drop * from.u, ease: easeInOut });
      if (target.t !== from.t) legs.push({ t: target.t, u: 0, dur: unroll * Math.abs(target.t - from.t), ease: easeOut });
    } else {
      legs.push({ t: target.t, u: target.u, dur: unroll * Math.abs(target.t - from.t), ease: easeOut });
    }

    let i = 0;
    let legFrom = { ...from };
    let started = performance.now();
    const step = (now) => {
      const leg = legs[i];
      const p = leg.dur <= 0 ? 1 : Math.min(1, (now - started) / leg.dur);
      const k = leg.ease(p);
      const next = { t: legFrom.t + (leg.t - legFrom.t) * k, u: legFrom.u + (leg.u - legFrom.u) * k };
      live.current = next;
      setPose(next);
      if (p >= 1) {
        i += 1;
        if (i >= legs.length) return;
        legFrom = { t: leg.t, u: leg.u };
        started = now;
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target.t, target.u, unroll, drop]);

  const setT = useCallback((v) => {
    cancelAnimationFrame(raf.current);
    const next = { t: v, u: 0 };
    live.current = next;
    setPose(next);
  }, []);

  return { t: pose.t, u: pose.u, setT };
}
