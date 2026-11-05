import { describe, it, expect } from 'vitest';
import { parseCapture } from './quickAdd';

// Wednesday 4 Nov 2026
const NOW = new Date(2026, 10, 4, 14, 0, 0);
const p = (s) => parseCapture(s, NOW);

describe('parseCapture', () => {
  it('leaves plain text alone', () => {
    const r = p('Plain text');
    expect(r).toMatchObject({ text: 'Plain text', durationMin: null, startMin: null, dateKey: null, tags: [], scheduled: false });
    expect(r.parts).toEqual([]);
  });

  it('reads a trailing duration', () => {
    expect(p('Write investor update 45m')).toMatchObject({ text: 'Write investor update', durationMin: 45 });
    expect(p('Standup 1h30')).toMatchObject({ text: 'Standup', durationMin: 90 });
    expect(p('Deep work 2 hours')).toMatchObject({ text: 'Deep work', durationMin: 120 });
    expect(p('Nap for 20 min')).toMatchObject({ text: 'Nap', durationMin: 20 });
  });

  it('reads a time and defaults the day to "no day"', () => {
    expect(p('Gym 6pm')).toMatchObject({ text: 'Gym', startMin: 18 * 60, dateKey: null, scheduled: true });
    expect(p('Lunch with Sam at 12:30')).toMatchObject({ text: 'Lunch with Sam', startMin: 750 });
    expect(p('Ship it at 15')).toMatchObject({ text: 'Ship it', startMin: 900 });
    expect(p('Call at noon')).toMatchObject({ text: 'Call', startMin: 720 });
  });

  it('reads relative days', () => {
    expect(p('Call mom tomorrow')).toMatchObject({ text: 'Call mom', dateKey: '2026-11-05' });
    expect(p('Taxes in 3 days')).toMatchObject({ text: 'Taxes', dateKey: '2026-11-07' });
    expect(p('Wrap up today')).toMatchObject({ text: 'Wrap up', dateKey: '2026-11-04' });
    expect(p('Read tonight')).toMatchObject({ text: 'Read', dateKey: '2026-11-04', startMin: 20 * 60 });
  });

  it('reads weekdays as the next occurrence', () => {
    expect(p('Dentist fri')).toMatchObject({ dateKey: '2026-11-06' });
    expect(p('Review PR mon')).toMatchObject({ dateKey: '2026-11-09' });
    expect(p('Review PR next mon')).toMatchObject({ dateKey: '2026-11-16' });
    expect(p('Sync wed')).toMatchObject({ dateKey: '2026-11-11' });
    expect(p('Plan next week')).toMatchObject({ text: 'Plan', dateKey: '2026-11-09' });
  });

  it('reads explicit dates', () => {
    expect(p('Pay rent 12/01')).toMatchObject({ text: 'Pay rent', dateKey: '2026-12-01' });
    expect(p('Renew 2027-01-15')).toMatchObject({ dateKey: '2027-01-15' });
    expect(p('Birthday 1/02')).toMatchObject({ dateKey: '2027-01-02' });
  });

  it('reads tags', () => {
    expect(p('#deep Draft pricing page')).toMatchObject({ text: 'Draft pricing page', tags: ['deep'] });
    expect(p('Fix bug #work #urgent')).toMatchObject({ text: 'Fix bug', tags: ['work', 'urgent'] });
  });

  it('combines everything and builds preview chips', () => {
    const r = p('Dentist fri 9am 1h #health');
    expect(r).toMatchObject({ text: 'Dentist', dateKey: '2026-11-06', startMin: 540, durationMin: 60, tags: ['health'], scheduled: true });
    expect(r.parts.map(x => x.kind)).toEqual(['duration', 'time', 'date', 'tag']);
    expect(r.parts.map(x => x.label)).toEqual(['1 h', '9:00 am', 'Fri 6', '#health']);
  });

  it('labels tomorrow in the chips', () => {
    expect(p('Call mom tomorrow').parts[0].label).toBe('tomorrow · Thu 5');
  });

  it('does not eat numbers that are part of the title', () => {
    expect(p('Buy 3 lemons')).toMatchObject({ text: 'Buy 3 lemons', durationMin: null, startMin: null });
    expect(p('Room 12 cleanup')).toMatchObject({ text: 'Room 12 cleanup' });
  });
});
