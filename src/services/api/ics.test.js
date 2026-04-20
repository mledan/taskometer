import { test, expect, describe } from 'vitest';
import { buildICS } from './ics';

describe('buildICS', () => {
  test('emits a valid VCALENDAR envelope', () => {
    const ics = buildICS({ tasks: [], slots: [] });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.includes('VERSION:2.0')).toBe(true);
    expect(ics.includes('PRODID:-//Taskometer//EN')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
  });

  test('converts slots to VEVENT with SUMMARY from label', () => {
    const slots = [
      { id: 's1', date: '2026-04-20', startTime: '09:00', endTime: '12:00', label: 'deep work', slotType: 'deep' },
    ];
    const ics = buildICS({ slots });
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:deep work');
    expect(ics).toContain('DTSTART:20260420T090000');
    expect(ics).toContain('DTEND:20260420T120000');
    expect(ics).toContain('CATEGORIES:deep');
  });

  test('scheduled tasks become VEVENT with duration-based DTEND', () => {
    const tasks = [
      {
        id: 't1',
        text: 'finish doc',
        primaryType: 'deep',
        duration: 60,
        status: 'pending',
        scheduledTime: '2026-04-20T09:00:00',
      },
    ];
    const ics = buildICS({ tasks });
    expect(ics).toContain('SUMMARY:finish doc');
    expect(ics).toContain('STATUS:CONFIRMED');
    expect(ics).toContain('DTSTART:20260420T090000');
    expect(ics).toContain('DTEND:20260420T100000');
  });

  test('unscheduled tasks become VTODO with NEEDS-ACTION', () => {
    const tasks = [{ id: 't1', text: 'call mom', status: 'pending', duration: 20 }];
    const ics = buildICS({ tasks });
    expect(ics).toContain('BEGIN:VTODO');
    expect(ics).toContain('STATUS:NEEDS-ACTION');
    expect(ics).not.toContain('DTSTART:');
  });

  test('completed tasks emit STATUS:COMPLETED', () => {
    const tasks = [{ id: 't1', text: 'done thing', status: 'completed' }];
    const ics = buildICS({ tasks });
    expect(ics).toContain('STATUS:COMPLETED');
  });

  test('escapes special characters in SUMMARY', () => {
    const tasks = [{
      id: 't1',
      text: 'review PRs; merge, ship',
      scheduledTime: '2026-04-20T09:00:00',
      duration: 30,
      status: 'pending',
    }];
    const ics = buildICS({ tasks });
    expect(ics).toContain('SUMMARY:review PRs\\; merge\\, ship');
  });
});
