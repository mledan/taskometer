import { describe, test, expect } from 'vitest';
import {
  packWheel,
  unpackWheel,
  buildShareURL,
  readSharedWheelFromHash,
} from './wheelShare.js';

describe('packWheel / unpackWheel', () => {
  const sample = {
    id: 'famous_buffett',
    name: 'Warren Buffett',
    color: '#D4663A',
    blocks: [
      { startTime: '00:00', endTime: '06:30', slotType: 'sleep', label: 'Sleep', color: '#6B46C1' },
      { startTime: '06:30', endTime: '11:00', slotType: 'mind',  label: 'Read',  color: '#A8BF8C' },
    ],
  };

  test('round-trips a wheel without drift on user-facing fields', () => {
    const packed = packWheel(sample);
    const back = unpackWheel(packed);
    expect(back.name).toBe(sample.name);
    expect(back.color).toBe(sample.color);
    expect(back.blocks).toHaveLength(2);
    expect(back.blocks[0].startTime).toBe('00:00');
    expect(back.blocks[0].label).toBe('Sleep');
    expect(back.blocks[0].color).toBe('#6B46C1');
    expect(back.blocks[0].slotType).toBe('sleep');
  });

  test('drops the id (we don\'t want sharers leaking ours)', () => {
    const packed = packWheel(sample);
    expect(packed.id).toBeUndefined();
  });

  test('truncates excessively long names so URLs stay short', () => {
    const big = { name: 'x'.repeat(200), color: '#000', blocks: [] };
    const packed = packWheel(big);
    expect(packed.n.length).toBe(80);
  });

  test('returns null on garbage input', () => {
    expect(unpackWheel(null)).toBeNull();
    expect(unpackWheel({ b: 'not an array' })).toBeNull();
  });
});

describe('buildShareURL / readSharedWheelFromHash', () => {
  const sample = {
    name: 'Workday',
    color: '#A8BF8C',
    blocks: [
      { startTime: '09:00', endTime: '17:00', label: 'Work', color: '#A8BF8C' },
    ],
  };

  test('round-trip via URL hash', () => {
    const url = buildShareURL(sample, 'https://taskometer.app');
    expect(url).toMatch(/^https:\/\/taskometer\.app\/share#w=/);
    const hash = url.split('#')[1];
    const decoded = readSharedWheelFromHash('#' + hash);
    expect(decoded.name).toBe('Workday');
    expect(decoded.blocks).toHaveLength(1);
    expect(decoded.blocks[0].label).toBe('Work');
  });

  test('returns null on missing or malformed hash', () => {
    expect(readSharedWheelFromHash('')).toBeNull();
    expect(readSharedWheelFromHash('#notwheel')).toBeNull();
    expect(readSharedWheelFromHash('#w=$$$$')).toBeNull();
  });

  test('encoded URL stays well within URL limits even for a packed day', () => {
    const fullDay = {
      name: 'Pomodoro',
      color: '#D4663A',
      blocks: Array.from({ length: 24 }, (_, h) => ({
        startTime: `${String(h).padStart(2, '0')}:00`,
        endTime:   `${String((h + 1) % 24).padStart(2, '0')}:00`,
        label: `Block ${h}`,
        color: '#A8BF8C',
        slotType: 'work',
      })),
    };
    const url = buildShareURL(fullDay, 'https://taskometer.app');
    // 4KB is the practical safe budget — every modern browser handles
    // up to 8KB but some email clients truncate around 2KB. A typical
    // shared wheel has 5–12 blocks and weighs <1KB.
    expect(url.length).toBeLessThan(4096);
  });

  test('typical wheels are tiny — well under 1kB', () => {
    const typical = {
      name: 'Workday',
      color: '#A8BF8C',
      blocks: Array.from({ length: 8 }, (_, i) => ({
        startTime: `${String(i + 7).padStart(2, '0')}:00`,
        endTime:   `${String(i + 8).padStart(2, '0')}:00`,
        label: 'block',
        color: '#A8BF8C',
      })),
    };
    const url = buildShareURL(typical, 'https://taskometer.app');
    expect(url.length).toBeLessThan(1024);
  });
});
