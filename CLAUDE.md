# CLAUDE.md (project)

Guidance for Claude Code (and humans) working in this repo.

## What this is

Taskometer is a local-first scheduling app. Users paint a 24-hour
"wheel" of time blocks (sleep / work / play), apply that wheel to days
or ranges, and drop tasks into the resulting blocks. Free, runs in the
browser, no backend today.

## Glossary — please use these terms consistently

| Term | Meaning | Where it lives |
|---|---|---|
| **schedule** | A reusable 24-hour day template (Workday, Weekend, Travel). User-facing word — what we used to call "shape" / "wheel". | All UI strings, marketing copy |
| **wheel** | The visual 24-hour ring rendering of a schedule or a day. Code/component name only — never appears in user copy. | `WheelView`, `WheelSvg`, `MiniWheel` |
| **shape** | Legacy code term for "schedule". Internal use only; do NOT use in user-visible strings. | Some variable names, `wheel.shape`, FAMOUS_WHEELS internals |
| **block** | A user-facing time segment within a day or schedule (e.g. 9–11 deep work). | UI strings, marketing copy |
| **slot** | The persisted data record for a block. Internal data-layer term only. | `state.slots`, `slotType`, `tasksBySlotId` |
| **wedge** | The SVG path that draws a slot on the wheel. Render-layer term only. | `WheelSvg` rendering code |
| **task** | A todo item that lands inside a block. Has `text`, `duration`, optional `scheduledTime`. | `state.tasks` |
| **assignment** | A `dayAssignments[YMD] = wheelId` mapping — which schedule a calendar day uses. | `settings.dayAssignments` |
| **override** | A day flagged sick / holiday / vacation. Skips schedule painting. | `settings.dayOverrides` |
| **paint** | The user gesture of applying a schedule to one day or a range. Always say "paint", never "apply" or "assign" in user-facing copy. | All UI strings |

If you find user-visible copy using "wheel", "shape", "rhythm", or
"circle" for a schedule, fix it on the way through. Code-level uses
(`wheelId`, `WheelView`, etc.) stay — only UI text changes.

## Storage keys

All persistence goes under `taskometer.*` or `taskometer-*`:

- `taskometer.auth` — local profile (no password — see Privacy)
- `taskometer.onboarding.done` — one-shot tour flag
- `taskometer-*` — adapter keys for tasks, slots, settings (see services/api)
- `tm.scale`, `tm.ui` — UI prefs (acceptable legacy prefix; do not add new ones)

Legacy `smartcircle.*` keys are migrated to `taskometer.*` on first
load via [main.jsx](src/main.jsx). Do not introduce new
`smartcircle.*` keys.

## Routes

- `/` → marketing landing
- `/teams` → teams concept demo (clearly labelled as concept)
- `/privacy`, `/terms` → legal pages
- `/app/*` → the actual app
- `/api/*` → Vercel serverless functions (`/api/waitlist` exists)

Routing is pathname-based in [App.jsx](src/App.jsx). No router
library — keep it that way unless we add five+ routes.

## Workflow

- `npm run dev` for local development
- `npm run build` to verify a production build (Vercel runs the same)
- `npm test` for vitest
- CI runs build + tests on push and PRs to main
- Pushing to `main` deploys to production via Vercel
- Don't push to main without a passing CI run

## Architecture notes

- Single React app, code-split by route
- Data layer is `services/api/TaskometerAPI.js` — a localStorage
  adapter pretending to be an API. When backend ships, swap the
  adapter; keep the surface stable.
- `services/api/derive.js` is pure — derivations from state. Tests
  here.
- `taskometer/` is the product UI
- `marketing/` is the marketing site (landing, teams, legal)
- `components/` is shared chrome (errors, notifications, shortcuts)

## What we don't do (yet)

- No backend, no auth, no sync
- No analytics provider — telemetry is in-browser only
  ([services/telemetry.js](src/services/telemetry.js))
- No paid plans live; the Teams page is a concept preview

These are conscious gaps. When closing one, update Privacy and
Terms in the same PR.
