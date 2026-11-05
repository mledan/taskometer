# taskometer

A local-first day planner. Paint a 24-hour schedule of blocks (sleep,
work, play), paint it onto days or ranges, capture tasks in one line,
and place them into blocks. Runs in the browser, keeps your data in
your browser.

Started life as a web port of [todometer](https://github.com/cassidoo/todometer)
by [Cassidy Williams](https://github.com/cassidoo); it has grown into
its own thing since.

## How it works

- **Capture** — type `gym 6pm`, `call mom tomorrow 20m`, `#deep draft
  pricing`. Known *when* → scheduled; otherwise it waits in the inbox.
- **Place** — drag an inbox task onto a block, or tap *place* for the
  next open block, a block on the day in view, or any date.
- **Zoom** — day › week › month › quarter › year › life. Paint a
  schedule across any range from any zoom.
- **Lens** — see a day as a wheel, as that wheel unrolled into a helix
  of days, or as a plain list of blocks.
- **Library** — starter schedules, famous routines, paths and task
  packs, behind one door.

## Development

```bash
npm install
npm run dev
```

- `npm run build` — production build (Vercel runs the same)
- `npm test` — vitest
- `npm run lint` — eslint; direct `localStorage` use is an error, go
  through `src/services/storage.js`

See [CLAUDE.md](CLAUDE.md) for the glossary and architecture notes.

## License

MIT — see [LICENSE](LICENSE).
