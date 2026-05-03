import { beforeEach, describe, test, expect } from 'vitest';
import handler from '../../api/routines.js';
import blocksHandler from '../../api/blocks.js';
import dayAssignmentsHandler from '../../api/day-assignments.js';
import { _resetAll } from '../../api/_lib/repo/index.js';
import { callHandler } from './helpers.js';

beforeEach(() => { _resetAll(); });

const workday = {
  name: 'Workday',
  color: '#D4663A',
  lifestyle: 'Office 9-to-5',
  blocks: [
    { startTime: '09:00', endTime: '12:00', label: 'Morning work', category: 'work', color: '#D4663A' },
    { startTime: '12:00', endTime: '13:00', label: 'Lunch',        category: 'food', color: '#A8BF8C' },
    { startTime: '13:00', endTime: '17:00', label: 'Afternoon',    category: 'work', color: '#D4663A' },
  ],
};

describe('CRUD', () => {
  test('create → list → get → patch → delete', async () => {
    const c = await callHandler(handler, { method: 'POST', body: workday });
    expect(c.status).toBe(201);
    expect(c.body.routine.id).toMatch(/^rtn_/);
    expect(c.body.routine.lifestyle).toBe('Office 9-to-5');
    expect(c.body.routine.blocks).toHaveLength(3);

    const list = await callHandler(handler, { method: 'GET' });
    expect(list.body.routines).toHaveLength(1);

    const patched = await callHandler(handler, {
      method: 'PATCH',
      query: { id: c.body.routine.id },
      body: { name: 'Renamed' },
    });
    expect(patched.body.routine.name).toBe('Renamed');

    const del = await callHandler(handler, { method: 'DELETE', query: { id: c.body.routine.id } });
    expect(del.status).toBe(204);
  });

  test('rejects unknown lifestyle (silently nulls it)', async () => {
    const c = await callHandler(handler, {
      method: 'POST',
      body: { ...workday, lifestyle: 'Made-up Lifestyle' },
    });
    expect(c.body.routine.lifestyle).toBeNull();
  });

  test('rejects missing name', async () => {
    const r = await callHandler(handler, { method: 'POST', body: { blocks: [] } });
    expect(r.status).toBe(400);
  });

  test('rejects bad block time format', async () => {
    const r = await callHandler(handler, {
      method: 'POST',
      body: { name: 'X', blocks: [{ startTime: '9am', endTime: '5pm' }] },
    });
    expect(r.status).toBe(400);
  });
});

describe('paint op', () => {
  test('paints to an explicit date list — snapshots blocks with provenance', async () => {
    const c = await callHandler(handler, { method: 'POST', body: workday });
    const id = c.body.routine.id;

    const paint = await callHandler(handler, {
      method: 'POST',
      query: { id, op: 'paint' },
      body: { dates: ['2026-05-03', '2026-05-04'] },
    });
    expect(paint.status).toBe(200);
    expect(paint.body.painted).toEqual(['2026-05-03', '2026-05-04']);
    expect(paint.body.blocksCreated).toBe(6);   // 3 blocks × 2 dates
    expect(paint.body.assignments).toBe(2);

    // Verify blocks landed with provenance.
    const onMay3 = await callHandler(blocksHandler, { method: 'GET', query: { date: '2026-05-03' } });
    expect(onMay3.body.blocks).toHaveLength(3);
    for (const b of onMay3.body.blocks) {
      expect(b.sourceRoutineId).toBe(id);
    }

    // Verify a day assignment was created.
    const asn = await callHandler(dayAssignmentsHandler, { method: 'GET', query: { date: '2026-05-03' } });
    expect(asn.body.assignment.routineId).toBe(id);
  });

  test('paints to a range with weekdaysOnly', async () => {
    const c = await callHandler(handler, { method: 'POST', body: workday });
    const r = await callHandler(handler, {
      method: 'POST',
      query: { id: c.body.routine.id, op: 'paint' },
      // 2026-05-04 is Mon; 2026-05-10 is Sun. Weekdays = Mon-Fri.
      body: { range: { start: '2026-05-04', end: '2026-05-10', weekdaysOnly: true } },
    });
    expect(r.body.painted).toEqual(['2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07', '2026-05-08']);
  });

  test('re-painting wipes prior snapshot blocks before new ones', async () => {
    const c = await callHandler(handler, { method: 'POST', body: workday });
    const id = c.body.routine.id;
    await callHandler(handler, {
      method: 'POST', query: { id, op: 'paint' }, body: { dates: ['2026-05-03'] },
    });
    // Paint again — should delete first set then create fresh.
    const second = await callHandler(handler, {
      method: 'POST', query: { id, op: 'paint' }, body: { dates: ['2026-05-03'] },
    });
    expect(second.body.blocksDeleted).toBe(3);
    expect(second.body.blocksCreated).toBe(3);

    const onMay3 = await callHandler(blocksHandler, { method: 'GET', query: { date: '2026-05-03' } });
    expect(onMay3.body.blocks).toHaveLength(3); // still 3, not 6
  });

  test('rejects when neither dates nor range provided', async () => {
    const c = await callHandler(handler, { method: 'POST', body: workday });
    const r = await callHandler(handler, {
      method: 'POST', query: { id: c.body.routine.id, op: 'paint' }, body: {},
    });
    expect(r.status).toBe(400);
  });

  test('404 when routine does not exist', async () => {
    const r = await callHandler(handler, {
      method: 'POST',
      query: { id: 'rtn_nope', op: 'paint' },
      body: { dates: ['2026-05-03'] },
    });
    expect(r.status).toBe(404);
  });
});

describe('re-paint op', () => {
  test('only repaints dates already assigned to this routine', async () => {
    const c = await callHandler(handler, { method: 'POST', body: workday });
    const id = c.body.routine.id;

    // Paint on 3 dates.
    await callHandler(handler, {
      method: 'POST', query: { id, op: 'paint' },
      body: { dates: ['2026-05-03', '2026-05-04', '2026-05-05'] },
    });

    // Edit the routine's blocks (drop down to one block).
    await callHandler(handler, {
      method: 'PATCH',
      query: { id },
      body: {
        blocks: [{ startTime: '10:00', endTime: '11:00', label: 'Single block', category: 'work', color: '#D4663A' }],
      },
    });

    // Re-paint — picks up the new shape on every assigned date.
    const r = await callHandler(handler, {
      method: 'POST', query: { id, op: 're-paint' }, body: {},
    });
    expect(r.body.painted.sort()).toEqual(['2026-05-03', '2026-05-04', '2026-05-05']);
    expect(r.body.blocksCreated).toBe(3); // 1 block × 3 dates
    expect(r.body.blocksDeleted).toBe(9); // 3 prior blocks × 3 dates
  });

  test('subset re-paint — only the dates provided', async () => {
    const c = await callHandler(handler, { method: 'POST', body: workday });
    const id = c.body.routine.id;
    await callHandler(handler, {
      method: 'POST', query: { id, op: 'paint' },
      body: { dates: ['2026-05-03', '2026-05-04', '2026-05-05'] },
    });
    const r = await callHandler(handler, {
      method: 'POST', query: { id, op: 're-paint' },
      body: { dates: ['2026-05-04'] },
    });
    expect(r.body.painted).toEqual(['2026-05-04']);
  });
});

describe('update-from-date op', () => {
  test('promotes a day\'s blocks to the routine, returns staleDates', async () => {
    const c = await callHandler(handler, { method: 'POST', body: workday });
    const id = c.body.routine.id;
    await callHandler(handler, {
      method: 'POST', query: { id, op: 'paint' },
      body: { dates: ['2026-05-03', '2026-05-04', '2026-05-05'] },
    });

    // User edits the lunch block on May 5 to 12:30-13:30.
    const may5 = await callHandler(blocksHandler, { method: 'GET', query: { date: '2026-05-05' } });
    const lunch = may5.body.blocks.find(b => b.label === 'Lunch');
    await callHandler(blocksHandler, {
      method: 'PATCH',
      query: { id: lunch.id },
      body: { startTime: '12:30', endTime: '13:30' },
    });

    const r = await callHandler(handler, {
      method: 'POST',
      query: { id, op: 'update-from-date' },
      body: { date: '2026-05-05' },
    });
    expect(r.status).toBe(200);
    const updatedLunch = r.body.routine.blocks.find(b => b.label === 'Lunch');
    expect(updatedLunch.startTime).toBe('12:30');
    expect(updatedLunch.endTime).toBe('13:30');

    // Other dates with the old snapshot are flagged stale.
    expect(r.body.staleDates.sort()).toEqual(['2026-05-03', '2026-05-04']);
  });

  test('rejects when date has no source-tagged blocks', async () => {
    const c = await callHandler(handler, { method: 'POST', body: workday });
    const r = await callHandler(handler, {
      method: 'POST',
      query: { id: c.body.routine.id, op: 'update-from-date' },
      body: { date: '2026-05-03' },
    });
    expect(r.status).toBe(400);
  });
});
