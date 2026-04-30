import { describe, test, expect, beforeEach } from 'vitest';
import {
  occurrencesInRange,
  buildYearMap,
  dateIsExcepted,
  addRhythm,
  listRhythms,
  removeRhythm,
} from './rhythms.js';

/**
 * Cadence math has a nasty surface area: nth-weekday-of-month, biweekly
 * anchors, quarterly weeks, daylight-savings shifts, last-day-of-month
 * boundary cases. These tests are the contract between the engine and
 * the year canvas.
 */

describe('weekly cadence', () => {
  test('every Tuesday in April 2026', () => {
    const r = { id: 't1', cadence: { kind: 'weekly', dayOfWeek: 2 } };
    const out = occurrencesInRange(r, '2026-04-01', '2026-04-30');
    // Tuesdays in April 2026: 7, 14, 21, 28
    expect(out).toEqual(['2026-04-07', '2026-04-14', '2026-04-21', '2026-04-28']);
  });

  test('weekly Friday across a month boundary', () => {
    const r = { id: 't2', cadence: { kind: 'weekly', dayOfWeek: 5 } };
    const out = occurrencesInRange(r, '2026-03-25', '2026-04-15');
    // Fridays: Mar 27, Apr 3, Apr 10
    expect(out).toEqual(['2026-03-27', '2026-04-03', '2026-04-10']);
  });
});

describe('biweekly cadence with anchor', () => {
  test('biweekly Friday anchored on April 3 2026', () => {
    // Anchor 2026-04-03 (Fri). Should fire on Apr 3, Apr 17, May 1, May 15.
    const r = {
      id: 't3',
      cadence: { kind: 'biweekly', dayOfWeek: 5, anchor: '2026-04-03' },
    };
    const out = occurrencesInRange(r, '2026-04-01', '2026-05-15');
    expect(out).toEqual(['2026-04-03', '2026-04-17', '2026-05-01', '2026-05-15']);
  });

  test('biweekly anchor before range still resolves correctly', () => {
    // Anchor in January, query April — phase should still hold.
    const r = {
      id: 't4',
      cadence: { kind: 'biweekly', dayOfWeek: 2, anchor: '2026-01-06' },
    };
    const out = occurrencesInRange(r, '2026-04-01', '2026-04-30');
    // From Jan 6 (Tue), every other Tuesday: Jan 6, 20; Feb 3, 17; Mar 3, 17, 31;
    // Apr 14, Apr 28 are the in-range hits.
    expect(out).toEqual(['2026-04-14', '2026-04-28']);
  });
});

describe('monthly_nth cadence', () => {
  test('first Friday of each month, Q2 2026', () => {
    const r = { id: 't5', cadence: { kind: 'monthly_nth', dayOfWeek: 5, nth: 1 } };
    const out = occurrencesInRange(r, '2026-04-01', '2026-06-30');
    expect(out).toEqual(['2026-04-03', '2026-05-01', '2026-06-05']);
  });

  test('last Friday of each month uses nth: -1', () => {
    const r = { id: 't6', cadence: { kind: 'monthly_nth', dayOfWeek: 5, nth: -1 } };
    const out = occurrencesInRange(r, '2026-04-01', '2026-06-30');
    // April 24, May 29, June 26 are the last Fridays
    expect(out).toEqual(['2026-04-24', '2026-05-29', '2026-06-26']);
  });

  test('5th Tuesday omitted from months without one', () => {
    const r = { id: 't7', cadence: { kind: 'monthly_nth', dayOfWeek: 2, nth: 5 } };
    // June 2026 has 5 Tuesdays (last on the 30th). July 2026 has only 4 (last on
    // the 28th), so no 5th-Tuesday entry. The engine must skip July gracefully.
    const out = occurrencesInRange(r, '2026-06-01', '2026-07-31');
    expect(out).toEqual(['2026-06-30']);
  });
});

describe('monthly_date cadence', () => {
  test('the 15th each month', () => {
    const r = { id: 't8', cadence: { kind: 'monthly_date', monthDate: 15 } };
    const out = occurrencesInRange(r, '2026-01-01', '2026-03-31');
    expect(out).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']);
  });

  test('the 31st clamps to the last day in short months', () => {
    const r = { id: 't9', cadence: { kind: 'monthly_date', monthDate: 31 } };
    const out = occurrencesInRange(r, '2026-01-01', '2026-04-30');
    // January and March have 31; February clamps to 28; April to 30.
    expect(out).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });
});

describe('quarterly_week cadence', () => {
  test('week-1 of each quarter, year 2026', () => {
    const r = { id: 't10', cadence: { kind: 'quarterly_week', weekOfQuarter: 1 } };
    const out = occurrencesInRange(r, '2026-01-01', '2026-12-31');
    // First Monday on/after each Q start:
    //   Jan 1 2026 is Thursday → first Monday Jan 5
    //   Apr 1 is Wednesday    → first Monday Apr 6
    //   Jul 1 is Wednesday    → first Monday Jul 6
    //   Oct 1 is Thursday     → first Monday Oct 5
    expect(out).toEqual(['2026-01-05', '2026-04-06', '2026-07-06', '2026-10-05']);
  });
});

describe('project cadence', () => {
  test('project range fires on weekdays only', () => {
    const r = {
      id: 't11',
      cadence: { kind: 'project', anchor: '2026-04-06', end: '2026-04-12' },
    };
    const out = occurrencesInRange(r, '2026-04-01', '2026-04-30');
    // Apr 6 (Mon) – Apr 12 (Sun). Weekdays: 6,7,8,9,10. Sat 11 + Sun 12 skipped.
    expect(out).toEqual(['2026-04-06', '2026-04-07', '2026-04-08', '2026-04-09', '2026-04-10']);
  });
});

describe('exceptions', () => {
  test('dateIsExcepted matches inclusive ranges', () => {
    const exceptions = [
      { id: 'e1', type: 'vacation', label: 'Aug', startDate: '2026-08-12', endDate: '2026-08-25' },
    ];
    expect(dateIsExcepted('2026-08-11', exceptions)).toBeNull();
    expect(dateIsExcepted('2026-08-12', exceptions)).not.toBeNull();
    expect(dateIsExcepted('2026-08-20', exceptions)).not.toBeNull();
    expect(dateIsExcepted('2026-08-25', exceptions)).not.toBeNull();
    expect(dateIsExcepted('2026-08-26', exceptions)).toBeNull();
  });
});

describe('buildYearMap', () => {
  test('rhythm + exception produces suppressed flags', () => {
    const rhythms = [
      { id: 'r1', name: 'Standup', color: '#A8BF8C', cadence: { kind: 'weekly', dayOfWeek: 2 } },
    ];
    const exceptions = [
      { id: 'e1', type: 'vacation', label: 'spring break', startDate: '2026-04-13', endDate: '2026-04-17' },
    ];
    const map = buildYearMap(2026, rhythms, exceptions);
    // Apr 14 (Tuesday) should be in map AND flagged as suppressed.
    const apr14 = map.get('2026-04-14');
    expect(apr14).toBeDefined();
    expect(apr14[0].suppressed).not.toBeNull();
    // Apr 7 should be there and NOT suppressed.
    const apr7 = map.get('2026-04-07');
    expect(apr7).toBeDefined();
    expect(apr7[0].suppressed).toBeNull();
  });
});

describe('localStorage CRUD', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('addRhythm persists and listRhythms returns it', () => {
    const r = addRhythm({ name: 'Test', color: '#000', cadence: { kind: 'weekly', dayOfWeek: 1 } });
    expect(r.id).toMatch(/^rhy_/);
    const list = listRhythms();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Test');
  });

  test('removeRhythm deletes by id', () => {
    const a = addRhythm({ name: 'A', cadence: { kind: 'weekly', dayOfWeek: 1 } });
    const b = addRhythm({ name: 'B', cadence: { kind: 'weekly', dayOfWeek: 2 } });
    removeRhythm(a.id);
    const list = listRhythms();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(b.id);
  });
});
