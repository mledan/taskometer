# taskometer HTTP API — v2

The locked v2 surface. Memory-backed in Phase 1; Cosmos-backed in
Phase 2 with the same contracts.

## Vocabulary

User-facing language (what URLs and JSON say):

| Concept                    | Word        |
|----------------------------|-------------|
| One time chunk             | block       |
| Block that recurs          | recurring block |
| Named day-shape bundle     | routine     |
| Date range that suppresses | exception   |
| Community tag              | lifestyle   |

The URL `/api/v2/blocks` and the JSON key `block` use these words.
The visual ring (the wheel) is a UI concern, never a data noun.

## Conventions

- Base URL: `https://taskometer.vercel.app/api/v2` or
  `http://localhost:3000/api/v2`. Every v2 route is dispatched
  through a single Vercel function (`api/v2/[[...path]].js`) to
  stay under the Hobby tier's 12-function cap. Handlers live in
  `api/_handlers/` (the underscore prefix keeps them out of the
  public route table).
- All bodies + responses are JSON.
- IDs: server-assigned, prefixed (`blk_`, `rcb_`, `rtn_`, `tsk_`, `exc_`).
- Single-resource and compound ops use query parameters
  (`?id=` and `?op=`) so every handler stays a flat file. No
  dynamic `[id].js` paths in Phase 1.
- Auth: handlers call `requireOwner(req, res)` for writes,
  `resolveOwner(req)` for reads. When Clerk is not configured the
  ownerId is `'anon'`. When configured, it's the Clerk userId.
- Errors: `{ error: string, hint?: string }` with appropriate HTTP
  status (400 / 401 / 403 / 404 / 500).
- Timestamps: ISO 8601 strings. `ts` is created-at, `updated` is
  last-modified.

## The data model (locked)

```
Block            — date, startTime, endTime, label, category, color,
                   sourceRoutineId?, sourceBlockId?,
                   sourceRecurringBlockId?
RecurringBlock   — name, startTime, endTime, label, category, color,
                   cadence
Routine          — name, color, lifestyle?, blocks: [{startTime, endTime,
                   label, category, color}], isPublic
Task             — text, duration, priority, status, scheduledTime,
                   scheduledBlockId?, scheduledRecurringBlockId?
DayAssignment    — date, routineId
Exception        — type, label, startDate, endDate, color
```

## Routes

### Health
| Method | Path | Notes |
|---|---|---|
| GET | `/api/v2/health` | Liveness + introspection |

### Lifestyles (read-only whitelist, no auth)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/v2/lifestyles` | `{ lifestyles: ['Night Owl', ...] }` |

### Blocks
| Method | Path | Notes |
|---|---|---|
| GET | `/api/v2/blocks?date=YYYY-MM-DD` | List on a date |
| GET | `/api/v2/blocks?from=&to=` | List in a range |
| POST | `/api/v2/blocks` | Create ad-hoc (no provenance) |
| GET | `/api/v2/blocks?id=` | One |
| PATCH | `/api/v2/blocks?id=` | Edit (this date only) |
| DELETE | `/api/v2/blocks?id=` | Hard delete |

### Recurring Blocks
| Method | Path | Notes |
|---|---|---|
| GET | `/api/v2/recurring-blocks` | List |
| POST | `/api/v2/recurring-blocks` | Create |
| GET | `/api/v2/recurring-blocks?id=` | One |
| PATCH | `/api/v2/recurring-blocks?id=` | Edit (ripples forward) |
| DELETE | `/api/v2/recurring-blocks?id=` | Hard delete |
| GET | `/api/v2/recurring-blocks?id=&op=occurrences&from=&to=` | Resolve cadence |
| POST | `/api/v2/recurring-blocks?id=&op=break-out&date=` | Materialize one-off Block |

### Routines
| Method | Path | Notes |
|---|---|---|
| GET | `/api/v2/routines` | List |
| POST | `/api/v2/routines` | Create |
| GET | `/api/v2/routines?id=` | One |
| PATCH | `/api/v2/routines?id=` | Edit (past paints unaffected) |
| DELETE | `/api/v2/routines?id=` | Hard delete |
| POST | `/api/v2/routines?id=&op=paint` | Snapshot onto dates |
| POST | `/api/v2/routines?id=&op=re-paint` | Re-snapshot existing painted dates |
| POST | `/api/v2/routines?id=&op=update-from-date` | Promote a day's edits up |

### Tasks
| Method | Path | Notes |
|---|---|---|
| GET | `/api/v2/tasks` | Filters: `?date= &blockId= &recurringBlockId= &status=` |
| POST | `/api/v2/tasks` | Create |
| GET | `/api/v2/tasks?id=` | One |
| PATCH | `/api/v2/tasks?id=` | Update |
| DELETE | `/api/v2/tasks?id=[&hard=1]` | Soft default |

### Exceptions
| Method | Path | Notes |
|---|---|---|
| GET | `/api/v2/exceptions?from=&to=` | Range |
| POST | `/api/v2/exceptions` | Create |
| GET | `/api/v2/exceptions?id=` | One |
| PATCH | `/api/v2/exceptions?id=` | Update |
| DELETE | `/api/v2/exceptions?id=` | Hard delete |

### Day Assignments
| Method | Path | Notes |
|---|---|---|
| GET | `/api/v2/day-assignments?date=` | What routine was painted |
| GET | `/api/v2/day-assignments?from=&to=` | Range (year view) |
| DELETE | `/api/v2/day-assignments?date=` | Clear the link without nuking blocks |

### Composite (one round trip for the hot screens)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/v2/days?date=` | `{ date, assignment, blocks, recurringBlockOccurrences, exception }` |
| GET | `/api/v2/year?year=` | `{ year, daysByKey, exceptions }` for the year canvas |

## Compound payloads

### Paint
```json
POST /api/v2/routines?id=rtn_workday&op=paint
{ "dates": ["2026-05-03","2026-05-04"] }
// or
{ "range": { "start": "2026-05-01", "end": "2026-05-07", "weekdaysOnly": true } }
```

### Update routine from a date
```json
POST /api/v2/routines?id=rtn_workday&op=update-from-date
{ "date": "2026-05-03" }
→ { "routine": {...}, "staleDates": ["2026-04-13","2026-04-14"] }
```

### Break out a recurring-block occurrence
```
POST /api/v2/recurring-blocks?id=rcb_standup&op=break-out&date=2026-05-05
```

## Comments (already shipped, not part of this build)
Threaded by share-fragment hash; lives at `/api/comments` (v1 path,
its own function — predates the v2 dispatcher).
