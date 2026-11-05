import { describe, it, expect } from 'vitest';
import { project, unproject, ringPath, splitSegments, hubCenter, helixExtent, HELIX } from './geometry';

const G = { r: 295, cx: 320, cy: 320, pitch: 150, tilt: 0.72 };
const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

describe('helix geometry', () => {
  it('t=0: every day collapses onto the same circle, hour 0 at the top', () => {
    const p0 = project({ ...G, hour: 0, dayIndex: 0, t: 0 });
    const p3 = project({ ...G, hour: 0, dayIndex: 3, t: 0 });
    expect(p0).toEqual(p3);
    expect(close(p0[0], 320)).toBe(true);
    expect(close(p0[1], 320 - 295)).toBe(true);
    const six = project({ ...G, hour: 6, t: 0 });
    expect(close(six[0], 320 + 295)).toBe(true);
    expect(close(six[1], 320)).toBe(true);
  });

  it('t=0 matches the classic polar formula used by the wheel', () => {
    for (const h of [0, 1.5, 7, 12, 18.25, 23.75]) {
      const a = (h / 24) * 360 - 90;
      const rad = (a * Math.PI) / 180;
      const [x, y] = project({ ...G, hour: h, t: 0 });
      expect(close(x, 320 + Math.cos(rad) * 295)).toBe(true);
      expect(close(y, 320 + Math.sin(rad) * 295)).toBe(true);
    }
  });

  it('t=1: consecutive days are one pitch apart and the ring end meets the next start', () => {
    const endOfDay0 = project({ ...G, hour: 24, dayIndex: 0, t: 1 });
    const startOfDay1 = project({ ...G, hour: 0, dayIndex: 1, t: 1 });
    expect(close(endOfDay0[0], startOfDay1[0])).toBe(true);
    expect(close(endOfDay0[1], startOfDay1[1])).toBe(true);
    const a = project({ ...G, hour: 9, dayIndex: 0, t: 1 });
    const b = project({ ...G, hour: 9, dayIndex: 1, t: 1 });
    expect(close(b[1] - a[1], 150)).toBe(true);
    expect(close(a[0], b[0])).toBe(true);
  });

  it('tilt squashes the vertical radius while keeping the horizontal one', () => {
    const six = project({ ...G, hour: 6, t: 1 });
    const twelve = project({ ...G, hour: 12, t: 1 });
    expect(close(six[0], 320 + 295)).toBe(true);
    const hub = hubCenter({ ...G, t: 1 });
    expect(close(twelve[1] - hub[1], 295 * (1 - 0.72) + 150 * (0.5 - 0.5))).toBe(true);
  });

  it('unproject inverts project across t and days', () => {
    for (const t of [0, 0.3, 0.7, 1]) {
      for (const d of [0, 1, 3]) {
        for (const h of [0.5, 5, 11, 16.25, 22]) {
          const [x, y] = project({ ...G, hour: h, dayIndex: d, t, r: 200 });
          const u = unproject({ ...G, x, y, t, days: 5, rMid: 200 });
          expect(u.dayIndex).toBe(t === 0 ? 0 : d);
          expect(close(u.hour, h, 1e-3)).toBe(true);
          expect(close(u.dist, 200, 1e-3)).toBe(true);
        }
      }
    }
  });

  it('ringPath at t=0 is the exact arc; unrolled it is a sampled closed outline', () => {
    const flat = ringPath({ ...G, startH: 9, endH: 12, rOuter: 295, rInner: 110, t: 0 });
    expect(flat.startsWith('M')).toBe(true);
    expect(flat).toContain('A295 295 0 0 1');
    expect(flat).toContain('A110 110 0 0 0');
    const bent = ringPath({ ...G, startH: 9, endH: 12, rOuter: 295, rInner: 110, t: 1 });
    expect(bent).not.toContain('A');
    expect(bent.endsWith('Z')).toBe(true);
    expect(bent.split('L').length).toBeGreaterThan(20);
    expect(ringPath({ ...G, startH: 12, endH: 12, rOuter: 295, rInner: 110 })).toBe('');
  });

  it('splits overnight spans the same way the wheel always did', () => {
    expect(splitSegments(9, 12)).toEqual([[9, 12]]);
    expect(splitSegments(23, 30)).toEqual([[23, 24], [0, 6]]);
    expect(splitSegments(25, 27)).toEqual([[1, 3]]);
  });

  it('extent grows with days only when unrolled', () => {
    const flat = helixExtent({ cy: 320, rOuter: 295, days: 7, t: 0 });
    const bent = helixExtent({ cy: 320, rOuter: 295, days: 7, t: 1 });
    expect(flat.maxY - flat.minY).toBe(680);
    expect(bent.maxY).toBeGreaterThan(flat.maxY + 5 * HELIX.pitch);
    // The top edge follows the squashed ring: no dead band above the first turn.
    expect(bent.minY).toBeCloseTo(320 - 295 * (1 - HELIX.tilt) - 45, 6);
    const mid = helixExtent({ cy: 320, rOuter: 295, days: 7, t: 0.5 });
    expect(mid.minY).toBeGreaterThan(flat.minY);
    expect(mid.minY).toBeLessThan(bent.minY);
  });
});
