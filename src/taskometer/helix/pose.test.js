import { describe, it, expect } from 'vitest';
import { project } from './geometry';
import { buildHourMap, makePose, staggered, COLUMN } from './pose';

const spans = [
  { startH: 23, endH: 31 },   // sleep, overnight
  { startH: 9, endH: 12 },
  { startH: 12, endH: 12.5 }, // short lunch
  { startH: 13, endH: 17 },
];
const base = { cx: 320, cy: 320, rOuter: 295, rInner: 110, hourMap: buildHourMap(spans) };

describe('column pose', () => {
  it('hour map is monotonic, bounded per block and squeezes free time', () => {
    const m = buildHourMap(spans);
    let prev = -1;
    for (let h = 0; h <= 24; h += 0.25) {
      const y = m.yOf(h);
      expect(y).toBeGreaterThanOrEqual(prev);
      prev = y;
    }
    expect(m.yOf(0)).toBe(0);
    expect(m.yOf(24)).toBeCloseTo(m.height, 6);
    expect(m.yOf(7) - m.yOf(0)).toBeLessThanOrEqual(COLUMN.maxBlock);
    expect(m.yOf(12.5) - m.yOf(12)).toBeGreaterThanOrEqual(COLUMN.minBlock);
    expect(m.yOf(9) - m.yOf(7)).toBeLessThan(2 * COLUMN.perHour + 1);
  });

  it('u=0 is the helix projection exactly; u=1 is the column', () => {
    const flat = makePose({ ...base, t: 0, u: 0 });
    expect(flat.point(6, 295)).toEqual(project({ hour: 6, r: 295, cx: 320, cy: 320, t: 0 }));
    expect(flat.viewBox).toEqual({ x: -20, y: 320 - 295 - 45, w: 680, h: 680 });
    const col = makePose({ ...base, t: 1, u: 1 });
    const [x, y] = col.point(9, 295);
    expect(x).toBeCloseTo(COLUMN.left, 6);
    expect(y).toBeCloseTo(COLUMN.top + base.hourMap.yOf(9), 6);
    expect(col.point(9, 110)[0]).toBeCloseTo(COLUMN.right, 6);
    expect(col.viewBox.w).toBe(COLUMN.vbW);
    expect(col.viewBox.x).toBe(0);
  });

  it('half-way points sit between the two poses', () => {
    const a = makePose({ ...base, t: 1, u: 0 }).point(9, 200);
    const b = makePose({ ...base, t: 1, u: 1 }).point(9, 200);
    const m = makePose({ ...base, t: 1, u: 0.5 }).point(9, 200);
    expect(m[0]).toBeCloseTo((a[0] + b[0]) / 2, 6);
    expect(m[1]).toBeCloseTo((a[1] + b[1]) / 2, 6);
  });

  it('unproject inverts the column pose; the column is one day tall whatever `days` says', () => {
    const pose = makePose({ ...base, t: 1, u: 1, days: 3 });
    for (const h of [0.5, 9.25, 12.1, 16, 23.5]) {
      const [x, y] = pose.point(h, 200, 0);
      const hit = pose.unproject(x, y, 200);
      expect(hit.dayIndex).toBe(0);
      expect(hit.hour).toBeCloseTo(h, 3);
      expect(hit.dist).toBeCloseTo(200, 3);
    }
    expect(pose.viewBox.h).toBe(makePose({ ...base, t: 1, u: 1, days: 1 }).viewBox.h);
  });

  it('band is a rectangle in the column, an exact arc on the wheel, sampled in between', () => {
    expect(makePose({ ...base, t: 1, u: 1 }).band(9, 12, 295, 110).split('L').length).toBe(4);
    expect(makePose({ ...base, t: 1, u: 0.5 }).band(9, 12, 295, 110).split('L').length).toBeGreaterThan(20);
    expect(makePose({ ...base }).band(9, 12, 295, 110)).toContain('A295');
  });

  it('staggered blocks leave in order and all arrive', () => {
    expect(staggered(0, 2, 5)).toBe(0);
    expect(staggered(1, 2, 5)).toBe(1);
    expect(staggered(0.3, 0, 5)).toBeGreaterThan(staggered(0.3, 4, 5));
    expect(staggered(0.99, 4, 5)).toBeGreaterThan(0.9);
  });
});
