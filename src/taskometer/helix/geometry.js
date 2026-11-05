// A day is one turn of a helix. `t` unrolls it: 0 is the flat 24-hour
// ring, 1 is the helix seen at an angle, with one `pitch` per day.

export const TAU = Math.PI * 2;
// Pitch below the squashed ring height so consecutive turns overlap and read as a coil.
export const HELIX = { pitch: 110, tilt: 0.62 };

export function hourAngle(hour) {
  return (hour / 24) * TAU - Math.PI / 2;
}

export function project({ hour, dayIndex = 0, t = 0, r, cx, cy, pitch = HELIX.pitch, tilt = HELIX.tilt }) {
  const th = hourAngle(hour);
  return [
    cx + Math.cos(th) * r,
    cy + Math.sin(th) * r * (1 - tilt * t) + t * pitch * (dayIndex + hour / 24),
  ];
}

/** Where a turn's hub sits: the ring's centre, carried along by the helix. */
export function hubCenter({ cx, cy, t = 0, dayIndex = 0, pitch = HELIX.pitch }) {
  return [cx, cy + t * pitch * (dayIndex + 0.5)];
}

/**
 * Pointer → (hour, dayIndex, dist). The helix offset depends on the hour,
 * which depends on the offset, so iterate a few times; it converges fast
 * because pitch/24 per hour is small next to the radius. Among the turns
 * the one whose radius lands closest to `rMid` wins; ties go to day 0.
 */
export function unproject({ x, y, t = 0, cx, cy, days = 1, rMid, pitch = HELIX.pitch, tilt = HELIX.tilt }) {
  const squash = Math.max(0.05, 1 - tilt * t);
  const dx = x - cx;
  let best = null;
  for (let d = 0; d < days; d++) {
    let hour = 12;
    let dy = 0;
    for (let i = 0; i < 40; i++) {
      dy = (y - cy - t * pitch * (d + hour / 24)) / squash;
      const th = Math.atan2(dy, dx);
      const next = ((((th + Math.PI / 2) / TAU) % 1) + 1) % 1 * 24;
      const delta = Math.abs(next - hour);
      hour = next;
      if (delta < 1e-7) break;
    }
    const dist = Math.hypot(dx, dy);
    const score = Math.abs(dist - rMid);
    if (!best || score < best.score - 1e-9) best = { dayIndex: d, hour, dist, score };
  }
  return { dayIndex: best.dayIndex, hour: best.hour, dist: best.dist };
}

/** Split an [startH, endH) span that may cross midnight into visible [0,24] pieces. */
export function splitSegments(startH, endH) {
  const shift = Math.floor(startH / 24);
  const s = startH - shift * 24;
  const e = endH - shift * 24;
  const segs = [[s, Math.min(24, e)]];
  if (e > 24) segs.push([0, e - 24]);
  if (e < 0) segs.push([e + 24, 24]);
  return segs;
}

/**
 * The band between two radii over [startH, endH] on one turn. At t=0 it is
 * the exact SVG arc the wheel always drew; unrolled it is a sampled
 * outline (one point per 15 min) so the ramp bends with the helix.
 */
export function ringPath({ startH, endH, rOuter, rInner, dayIndex = 0, t = 0, cx, cy, pitch, tilt }) {
  const sH = Math.max(0, startH);
  const eH = Math.min(24, endH);
  if (eH <= sH) return '';
  const P = (h, r) => project({ hour: h, dayIndex, t, r, cx, cy, pitch, tilt });
  if (t === 0) {
    const [x0, y0] = P(sH, rOuter);
    const [x1, y1] = P(eH, rOuter);
    const [x2, y2] = P(eH, rInner);
    const [x3, y3] = P(sH, rInner);
    const large = (eH - sH) > 12 ? 1 : 0;
    return `M${x0} ${y0} A${rOuter} ${rOuter} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${rInner} ${rInner} 0 ${large} 0 ${x3} ${y3} Z`;
  }
  const n = Math.max(2, Math.ceil((eH - sH) * 4));
  let d = '';
  for (let i = 0; i <= n; i++) {
    const [x, y] = P(sH + ((eH - sH) * i) / n, rOuter);
    d += `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  for (let i = n; i >= 0; i--) {
    const [x, y] = P(sH + ((eH - sH) * i) / n, rInner);
    d += `L${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return `${d}Z`;
}

/** Open polyline along one radius for a whole turn (the ring's outline when unrolled). */
export function turnPath({ r, dayIndex = 0, t = 0, cx, cy, pitch, tilt, from = 0, to = 24 }) {
  const n = Math.max(2, Math.ceil((to - from) * 4));
  let d = '';
  for (let i = 0; i <= n; i++) {
    const [x, y] = project({ hour: from + ((to - from) * i) / n, dayIndex, t, r, cx, cy, pitch, tilt });
    d += `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return d.trim();
}

/**
 * Vertical extent of `days` turns at this `t`, for the viewBox. Both edges
 * follow the squashed ring so the top turn hugs the toolbar at every t
 * and the element's height tracks the content instead of the flat wheel.
 */
export function helixExtent({ cy, rOuter, days, t = 0, pitch = HELIX.pitch, tilt = HELIX.tilt, pad = 45 }) {
  const squash = 1 - tilt * t;
  return {
    minY: cy - rOuter * squash - pad,
    maxY: cy + rOuter * squash + t * pitch * days + pad,
  };
}
