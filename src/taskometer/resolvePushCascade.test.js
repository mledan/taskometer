import { describe, it, expect } from 'vitest';
import { resolvePushCascade } from './WheelView.jsx';

const DAY = 24 * 60;

function asOthers(...slots) {
  return slots.map(([id, sMin, eMin]) => ({ id, sMin, eMin }));
}

describe('resolvePushCascade', () => {
  it('pushes a right neighbor right when the drag encroaches', () => {
    // A at 9-10 dragged right to 10:30-11:30, neighbor B at 11-12 should shift.
    const { dragS, dragE, overrides } = resolvePushCascade({
      dragS: 630, dragE: 690,
      origDragS: 540, origDragE: 600,
      others: asOthers(['B', 660, 720]),
    });
    expect(dragS).toBe(630);
    expect(dragE).toBe(690);
    const ov = overrides.get('B');
    expect(ov).toEqual({ startMin: 690, endMin: 750 });
  });

  it('does not push when drag does not overlap neighbor', () => {
    const { overrides } = resolvePushCascade({
      dragS: 600, dragE: 660,
      origDragS: 540, origDragE: 600,
      others: asOthers(['B', 720, 780]),
    });
    expect(overrides.size).toBe(0);
  });

  it('cascades pushes when right neighbor would overlap further neighbor', () => {
    // A 9-10 dragged to 10-11; B 11-12, C 12-13. Pushing B to 12-13 would hit C.
    const { overrides } = resolvePushCascade({
      dragS: 600, dragE: 660,
      origDragS: 540, origDragE: 600,
      others: asOthers(['B', 660, 720], ['C', 720, 780]),
    });
    // B starts where A ends (600 was end; but we dragged to 660, so B must move)
    // Actually B is at 660-720, dragE=660 so they're adjacent — no overlap.
    // Re-test cascade: drag A to 10:15-11:15 so dragE=675
    const r2 = resolvePushCascade({
      dragS: 615, dragE: 675,
      origDragS: 540, origDragE: 600,
      others: asOthers(['B', 660, 720], ['C', 720, 780]),
    });
    expect(r2.overrides.get('B')).toEqual({ startMin: 675, endMin: 735 });
    expect(r2.overrides.get('C')).toEqual({ startMin: 735, endMin: 795 });
  });

  it('pushes a left neighbor left when the drag start handle moves into it', () => {
    // A at 9-11 dragged start to 8:00; B at 7:00-8:30 must shift left.
    const { overrides } = resolvePushCascade({
      dragS: 480, dragE: 660,
      origDragS: 540, origDragE: 660,
      others: asOthers(['B', 420, 510]),
    });
    expect(overrides.get('B')).toEqual({ startMin: 390, endMin: 480 });
  });

  it('clamps the drag end when no room on the right', () => {
    // A origin at 23:00-23:30 (center=23:15). Drag far right; wheel should clamp.
    const { dragE, overrides } = resolvePushCascade({
      dragS: 540 + 720, dragE: 600 + 720, // ridiculous
      origDragS: 1380, origDragE: 1410,
      others: asOthers(['B', 0, 60]), // next day slot 00:00-01:00 projected
    });
    // windowRight = origCenter + DAY/2 = 1395 + 720 = 2115
    // After projection, B midpoint nearest 1395 is B shifted to 1440-1500 (mid=1470)
    // So B is in rights; totalRightLen = 60; maxDragE = 2115 - 60 = 2055
    expect(dragE).toBeLessThanOrEqual(2055);
  });
});
