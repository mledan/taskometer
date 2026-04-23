import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { WheelSvg } from './WheelView.jsx';

// jsdom v20 lacks PointerEvent, so fireEvent.pointerDown drops button/pointerId
// from the init dict. Dispatch a MouseEvent manually with the pointer type to
// keep button/clientX/clientY intact.
function fireMouseAsPointer(el, type, init = {}) {
  const ev = new MouseEvent(type, {
    bubbles: true, cancelable: true, button: 0,
    clientX: init.clientX ?? 0, clientY: init.clientY ?? 0,
  });
  ev.pointerId = init.pointerId ?? 1;
  el.dispatchEvent(ev);
}

function stubSvgRect(svgEl, { left = 10, top = 20, width = 640, height = 640 } = {}) {
  svgEl.getBoundingClientRect = () => ({
    left, top, width, height, right: left + width, bottom: top + height,
    x: left, y: top, toJSON: () => ({}),
  });
}

function pointAtHour(h, { cx = 320, cy = 320, r = 202.5, rectLeft = 10, rectTop = 20 } = {}) {
  const rad = (h * 15 - 90) * Math.PI / 180;
  return {
    x: rectLeft + cx + Math.cos(rad) * r,
    y: rectTop + cy + Math.sin(rad) * r,
  };
}

const baseProps = {
  wedges: [],
  taskTypes: [],
  nowHour: 12,
  stats: { done: 0, total: 0, pushed: 0 },
  tasksBySlotId: new Map(),
  onWedgeClick: () => {},
  onEmptyHourClick: () => {},
  onNudgeEdge: () => {},
  editingSlotId: null,
};

async function doDrag({ container, wedgeIndex = 0, fromHour, toHour }) {
  const svg = container.querySelector('svg');
  stubSvgRect(svg);
  const paths = container.querySelectorAll('path');
  const downAt = pointAtHour(fromHour);
  const moveAt = pointAtHour(toHour);
  await act(async () => {
    fireMouseAsPointer(paths[wedgeIndex], 'pointerdown', { clientX: downAt.x, clientY: downAt.y });
  });
  await act(async () => {
    fireMouseAsPointer(window, 'pointermove', { clientX: moveAt.x, clientY: moveAt.y });
  });
  await act(async () => {
    fireMouseAsPointer(window, 'pointerup');
  });
}

describe('WheelSvg drag', () => {
  it('commits a simple slot drag', async () => {
    const slots = [
      { id: 'A', date: '2026-04-23', startTime: '09:00', endTime: '10:00', label: 'A' },
    ];
    const onWedgeCommit = vi.fn(async () => {});
    const { container } = render(
      <WheelSvg {...baseProps} slots={slots} onWedgeCommit={onWedgeCommit} />
    );
    await doDrag({ container, fromHour: 9.5, toHour: 10.5 });

    expect(onWedgeCommit).toHaveBeenCalled();
    const [id, patch] = onWedgeCommit.mock.calls[0];
    expect(id).toBe('A');
    expect(patch.startMin).toBe(10 * 60);
  });

  it('pushes a right neighbor when a move-drag crosses into it', async () => {
    const slots = [
      { id: 'A', date: '2026-04-23', startTime: '09:00', endTime: '10:00', label: 'A' },
      { id: 'B', date: '2026-04-23', startTime: '10:00', endTime: '11:00', label: 'B' },
    ];
    const onWedgeCommit = vi.fn(async () => {});
    const { container } = render(
      <WheelSvg {...baseProps} slots={slots} onWedgeCommit={onWedgeCommit} />
    );
    await doDrag({ container, fromHour: 9.5, toHour: 10.5 });
    const ids = onWedgeCommit.mock.calls.map(c => c[0]).sort();
    expect(ids).toEqual(['A', 'B']);
    const a = onWedgeCommit.mock.calls.find(c => c[0] === 'A')[1];
    const b = onWedgeCommit.mock.calls.find(c => c[0] === 'B')[1];
    expect(a.startMin).toBe(10 * 60);
    expect(b.startMin).toBe(11 * 60);
  });

  it('does not push a neighbor when the drag stays clear', async () => {
    const slots = [
      { id: 'A', date: '2026-04-23', startTime: '09:00', endTime: '10:00', label: 'A' },
      { id: 'B', date: '2026-04-23', startTime: '13:00', endTime: '14:00', label: 'B' },
    ];
    const onWedgeCommit = vi.fn(async () => {});
    const { container } = render(
      <WheelSvg {...baseProps} slots={slots} onWedgeCommit={onWedgeCommit} />
    );
    await doDrag({ container, fromHour: 9.5, toHour: 10.5 });
    const ids = onWedgeCommit.mock.calls.map(c => c[0]);
    expect(ids).toEqual(['A']);
  });

  it('pointerToHour maps correctly under a letterboxed rect (wider than tall)', async () => {
    const slots = [
      { id: 'A', date: '2026-04-23', startTime: '09:00', endTime: '10:00', label: 'A' },
    ];
    const onWedgeCommit = vi.fn(async () => {});
    const { container } = render(
      <WheelSvg {...baseProps} slots={slots} onWedgeCommit={onWedgeCommit} />
    );
    const svg = container.querySelector('svg');
    // 720 wide, 640 tall, origin at (0,0). scale = min(720,640)/640 = 1.
    // Horizontal letterbox = (720-640)/2 = 40. Vertical = 0.
    svg.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 720, height: 640, right: 720, bottom: 640,
      x: 0, y: 0, toJSON: () => ({}),
    });
    const paths = container.querySelectorAll('path');
    // 9:30 viewBox (443.27, 480.65) + letterbox 40 = screen (483.27, 480.65).
    await act(async () => {
      fireMouseAsPointer(paths[0], 'pointerdown', { clientX: 483.27, clientY: 480.65 });
    });
    // 10:30 viewBox (396.80, 507.13) + letterbox 40 = screen (436.80, 507.13).
    await act(async () => {
      fireMouseAsPointer(window, 'pointermove', { clientX: 436.80, clientY: 507.13 });
    });
    await act(async () => {
      fireMouseAsPointer(window, 'pointerup');
    });
    const [, patch] = onWedgeCommit.mock.calls[0];
    expect(patch.startMin).toBe(10 * 60);
  });
});
