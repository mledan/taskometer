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
| **capture** | Typing a task into the always-visible input. The parser reads duration, time, day and `#tags`; a known *when* schedules, otherwise the task parks in the **inbox**. | `Inbox.jsx`, `quickAdd.js` |
| **place** | Putting an inbox task into a block — by drag, or by the Place menu (next open block, a block on the day in view, any date). | `PlaceMenu.jsx`, `useTaskActions` |
| **zoom** | How much time the app shows: day › week › month › quarter › year › life. `[` / `]` step it. | `nav/ZoomNav`, `nav/viewState.js` |
| **lens** | How a single day is drawn at day zoom: wheel, spiral (the same ring unrolled into a helix of days), or blocks (that helix dropped into a column). One SVG stage morphs between all three; it never unmounts on a lens change. | `nav/LensToggle`, `screens/DayScreen`, `helix/` |
| **library** | The one drawer for everything that comes from outside the user's own day: schedules, routines, paths, packs. | `library/LibraryDrawer.jsx` |

If you find user-visible copy using "wheel", "shape", "rhythm", or
"circle" for a schedule, fix it on the way through. Code-level uses
(`wheelId`, `WheelView`, etc.) stay — only UI text changes.

Every surface is one of four verbs on one loop — **Capture** (input,
inbox), **Place** (wheel, blocks, week, calendar zooms, library), **Do**
(the wheel hub, Right now), **Reflect** (daily wrap, time breakdown,
coming up, snoozed). When adding a surface, say which verb it serves;
if it's none of them, it probably doesn't belong.

## Storage keys

All persistence goes under `taskometer.*` or `taskometer-*`:

- `taskometer.auth` — local profile (no password — see Privacy)
- `taskometer.onboarding.done` — one-shot tour flag
- `taskometer-theme` — light / dark / system
- `taskometer-shortcuts` — custom key bindings
- `taskometer.multiselect.*` — per-tab calendar selections (sessionStorage)
- `taskometer-*` — adapter keys for tasks, slots, settings (see services/api)
- `tm.ui` — UI prefs incl. `zoom` and `lens` (acceptable legacy prefix; do
  not add new ones). `tm.scale` was migrated into it and removed.

Legacy `smartcircle.*` keys are migrated to `taskometer.*` on first
load via [main.jsx](src/main.jsx). Do not introduce new
`smartcircle.*` keys.

**Never call `localStorage` / `sessionStorage` directly.** Go through
[services/storage.js](src/services/storage.js) (`storage.get/set/remove`,
`getRaw/setRaw`, `storage.session.*`). ESLint enforces this as an error
everywhere except the adapter and migrations.

## Routes

- `/` → marketing landing
- `/teams` → teams concept demo (clearly labelled as concept)
- `/pricing` → plans page (Stripe checkout when configured)
- `/share` → landing for a shared schedule link (`#w=…` fragment)
- `/privacy`, `/terms` → legal pages
- `/app` → the actual app
- `/app/year` → year canvas
- `/api/*` → Vercel serverless functions (`waitlist`, `telemetry`,
  `checkout-session`, `stripe-webhook`, `comments`, `v2/*`)

Routing is pathname-based in [App.jsx](src/App.jsx). No router
library — keep it that way unless we add five+ routes.

## Workflow

- `npm run dev` for local development
- `npm run build` to verify a production build (Vercel runs the same)
- `npm test` for vitest
- `npm run lint` — the storage rule above is the one that must stay at zero
- CI runs build + tests on push and PRs to main
- Pushing to `main` deploys to production via Vercel
- Don't push to main without a passing CI run

## Architecture notes

- Single React app. Every route in [App.jsx](src/App.jsx) is
  `React.lazy`, and Clerk (`auth/ClerkShell.jsx`) only wraps `/app/*`,
  so marketing visitors never download the app or `@clerk/*`.
- Data layer is `services/api/TaskometerAPI.js` — a localStorage
  adapter pretending to be an API. When backend ships, swap the
  adapter; keep the surface stable.
- `services/api/derive.js` is pure — derivations from state. Tests
  here. `services/scheduler.js` is the one scheduler (don't add another).
- `context/AppContext.jsx` is the reducer; `AppContext.test.jsx` covers
  it — extend those tests when you touch an action.
- `taskometer/` is the product UI:
  - `Taskometer.jsx` is the shell (header, event wiring, screen switch)
    and should stay small; `shell/*` hooks hold paint/task/auth actions.
  - `screens/` — one component per zoom (`DayScreen`, `WeekScreen`,
    `CalendarScreen` for month/quarter/year, `LifeScreen`).
  - `nav/` — zoom ladder, lens toggle, breadcrumb, view-state migration.
  - `library/` — the Library drawer and its tabs.
  - `helix/` — the one stage for all three day lenses. `geometry.js` is
    the ring ⟷ helix projection (`t`), `pose.js` adds the column (`u`)
    and blends the three; `useMorph.js` routes lens changes through the
    helix (unroll, then drop) so the schedule morphs instead of swapping.
  - Styles: `taskometer.css` (wheel + core), `screens.css` (week /
    calendar / life / rails), `capture.css` (capture + Place menu),
    `shell.css` (header at phone widths). Tokens live in
    `styles/variables.css`; no hex in components.
- `marketing/` is the marketing site (landing, teams, legal)
- `components/` is shared chrome (errors, notifications, shortcuts)
- Chrome and palette talk to the shell through `tm:*` window events
  (`tm:capture-focus`, `tm:set-scale`, `tm:open-library`, …).

## What we don't do (yet)

- No sync. Planning data is localStorage-only. Clerk auth is optional
  (off without `VITE_CLERK_PUBLISHABLE_KEY`) and only mirrors a profile.
- No third-party analytics. Telemetry
  ([services/telemetry.js](src/services/telemetry.js)) keeps an
  in-browser ring buffer and, on deployed hosts only, posts anonymous
  feature events to our own `/api/telemetry` (Vercel function logs). No
  personal data, no IP/UA stored. Privacy page discloses this.
- No paid plans live; Stripe checkout exists but is gated behind env
  config. The Teams page is a concept preview.

These are conscious gaps. When closing one, update Privacy and
Terms in the same PR.
