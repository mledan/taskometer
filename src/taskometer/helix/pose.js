// The third pose: the same day laid out top-to-bottom as an agenda.
// Reached from the helix — the turn straightens and its blocks drop
// into a list. `u` blends toward it: 0 = ring/helix, 1 = column.

import { HELIX, project, unproject, ringPath, splitSegments, hubCenter, helixExtent } from './geometry.js';

export const COLUMN = {
  vbW: 420,       // viewBox width once fully in column pose
  left: 64,       // column's left edge (hour rail sits to its left)
  right: 404,     // column's right edge
  top: 24,
  minBlock: 56,   // the shortest a block may draw, in viewBox units
  maxBlock: 150,  // the tallest a single block may draw
  perHour: 34,    // proportional height per hour inside those bounds
  minGap: 10,     // free time between blocks is squeezed to this
  dayGap: 44,     // space between stacked days
};

/**
 * Piecewise-linear hour → y map for one day. Each stretch between block
 * boundaries gets a height clamped so every block is readable and sleep
 * does not eat the page. Returns { yOf(hour), height, edges }.
 */
export function buildHourMap(spans = [], opts = COLUMN) {
  const cuts = new Set([0, 24]);
  const covered = [];
  for (const { startH, endH } of spans) {
    for (const [s, e] of splitSegments(startH, endH)) {
      if (e <= s) continue;
      cuts.add(s); cuts.add(e);
      covered.push([s, e]);
    }
  }
  const edges = [...cuts].sort((a, b) => a - b);
  const ys = [0];
  for (let i = 1; i < edges.length; i++) {
    const a = edges[i - 1];
    const b = edges[i];
    const mid = (a + b) / 2;
    const inBlock = covered.some(([s, e]) => mid >= s && mid < e);
    const raw = (b - a) * opts.perHour;
    const h = inBlock
      ? Math.max(opts.minBlock * Math.min(1, (b - a) / 0.5), Math.min(opts.maxBlock, raw))
      : Math.max(opts.minGap, Math.min(opts.maxBlock * 0.6, raw));
    ys.push(ys[i - 1] + h);
  }
  const height = ys[ys.length - 1];
  const yOf = (hour) => {
    const h = Math.max(0, Math.min(24, hour));
    let i = 1;
    while (i < edges.length - 1 && edges[i] <= h) i++;
    const a = edges[i - 1];
    const b = edges[i];
    const f = b === a ? 0 : (h - a) / (b - a);
    return ys[i - 1] + (ys[i] - ys[i - 1]) * f;
  };
  return { yOf, height, edges };
}

const lerp = (a, b, k) => a + (b - a) * k;

/**
 * A pose is where every (hour, radius, day) lands right now. It blends
 * the ring/helix (`t`) with the column (`u`) and knows its own viewBox
 * so the SVG can shrink from the wheel's width to the column's.
 */
export function makePose({
  t = 0, u = 0, cx, cy, rOuter, rInner, days = 1, hourMap,
  vbX = -20, vbW = 680, pad = 45, pitch = HELIX.pitch, tilt = HELIX.tilt, column = COLUMN,
}) {
  const map = hourMap || buildHourMap([]);
  const colStride = map.height + column.dayGap;
  const colX = (r) => lerp(column.left, column.right, (rOuter - r) / (rOuter - rInner));
  const colY = (hour, dayIndex = 0) => column.top + map.yOf(hour) + dayIndex * colStride;

  const ringPt = (hour, r, dayIndex = 0) => project({ hour, dayIndex, t, r, cx, cy, pitch, tilt });
  const colPt = (hour, r, dayIndex = 0) => [colX(r), colY(hour, dayIndex)];

  const point = (hour, r, dayIndex = 0, uu = u) => {
    if (uu <= 0) return ringPt(hour, r, dayIndex);
    if (uu >= 1) return colPt(hour, r, dayIndex);
    const a = ringPt(hour, r, dayIndex);
    const b = colPt(hour, r, dayIndex);
    return [lerp(a[0], b[0], uu), lerp(a[1], b[1], uu)];
  };

  /** Blend any ring-space point with its column-space counterpart. */
  const blend = (ringXY, colXY, uu = u) => [lerp(ringXY[0], colXY[0], uu), lerp(ringXY[1], colXY[1], uu)];

  /** The hub rides with today's turn; in the column it becomes the now-line's anchor. */
  const hub = (dayIndex = 0, nowHour = 12) => {
    const a = hubCenter({ cx, cy, t, dayIndex, pitch });
    const b = [column.right + 8, colY(Math.max(0, Math.min(24, nowHour)), dayIndex)];
    return blend(a, b);
  };

  const ringExt = helixExtent({ cy, rOuter, days: t > 0 ? days : 1, t, pitch, tilt, pad });
  // The column shows one day: the other turns fade out as the helix drops.
  const colExt = { minY: 0, maxY: column.top + map.height + column.top };
  const minY = lerp(ringExt.minY, colExt.minY, u);
  const maxY = lerp(ringExt.maxY, colExt.maxY, u);
  const viewBox = { x: lerp(vbX, 0, u), y: minY, w: lerp(vbW, column.vbW, u), h: maxY - minY };

  /** Pointer in viewBox units → { hour, dist, dayIndex }; `dist` is a radius. */
  const unprojectAt = (x, y, rMid) => {
    if (u < 0.5) {
      const hit = unproject({ x, y, t, cx, cy, days: 1, rMid, pitch, tilt });
      return { hour: hit.hour, dist: hit.dist, dayIndex: 0 };
    }
    const dayIndex = 0;
    const localY = y - column.top;
    const { edges, yOf } = map;
    let hour = 24;
    for (let i = 1; i < edges.length; i++) {
      const ya = yOf(edges[i - 1]);
      const yb = yOf(edges[i]);
      if (localY <= yb || i === edges.length - 1) {
        const f = yb === ya ? 0 : Math.max(0, Math.min(1, (localY - ya) / (yb - ya)));
        hour = edges[i - 1] + (edges[i] - edges[i - 1]) * f;
        break;
      }
    }
    const dist = rOuter - ((x - column.left) / (column.right - column.left)) * (rOuter - rInner);
    return { hour, dist, dayIndex };
  };

  /** Closed outline of the band over [startH, endH] on one turn/day. */
  const band = (startH, endH, rO, rI, dayIndex = 0, uu = u) => {
    const sH = Math.max(0, startH);
    const eH = Math.min(24, endH);
    if (eH <= sH) return '';
    if (t === 0 && uu <= 0) return ringPath({ startH, endH, rOuter: rO, rInner: rI, dayIndex, t: 0, cx, cy, pitch, tilt });
    if (uu >= 1) {
      const [x0, y0] = colPt(sH, rO, dayIndex);
      const [x1, y1] = colPt(eH, rI, dayIndex);
      return `M${x0.toFixed(2)} ${y0.toFixed(2)} L${x0.toFixed(2)} ${y1.toFixed(2)} L${x1.toFixed(2)} ${y1.toFixed(2)} L${x1.toFixed(2)} ${y0.toFixed(2)} Z`;
    }
    const n = Math.max(2, Math.ceil((eH - sH) * 4));
    let d = '';
    for (let i = 0; i <= n; i++) {
      const [x, y] = point(sH + ((eH - sH) * i) / n, rO, dayIndex, uu);
      d += `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)} `;
    }
    for (let i = n; i >= 0; i--) {
      const [x, y] = point(sH + ((eH - sH) * i) / n, rI, dayIndex, uu);
      d += `L${x.toFixed(2)} ${y.toFixed(2)} `;
    }
    return `${d}Z`;
  };

  /** Open polyline along one radius across a whole day. */
  const rail = (r, dayIndex = 0, from = 0, to = 24) => {
    const n = Math.max(2, Math.ceil((to - from) * 4));
    let d = '';
    for (let i = 0; i <= n; i++) {
      const [x, y] = point(from + ((to - from) * i) / n, r, dayIndex);
      d += `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)} `;
    }
    return d.trim();
  };

  return { t, u, point, blend, hub, band, rail, viewBox, unproject: unprojectAt, colX, colY, map, column, colStride };
}

/**
 * Per-block blend for the "break apart and drop" feel: blocks leave the
 * helix one after another (earliest first) as `u` runs 0→1.
 */
export function staggered(u, index, count, spread = 0.45) {
  if (count <= 1 || u <= 0 || u >= 1) return u;
  const offset = (index / (count - 1)) * spread;
  return Math.max(0, Math.min(1, u * (1 + spread) - offset));
}
