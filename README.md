# Bandon Cup

A mobile-first golf-trip scoring app with a broadcast-style Ryder Cup leaderboard.
Built for an eight-player buddy trip to Bandon Dunes: two teams, six counting rounds,
pooled **net-Stableford** scoring presented as a TV leaderboard — plus **The Bandon
Book**, a parody play-money sportsbook for picking sides on trip props.

The aesthetic is early-2000s EA *Tiger Woods PGA Tour* / Ryder Cup broadcast.

It's a single Cloudflare Worker serving a React PWA, with all data in Cloudflare D1.
Fork it and re-skin it for your own trip.

## Features

- **Net-Stableford scoring engine** — handicaps, configurable allowance (default 75%),
  flat quota, per-round and cumulative results. Fully unit-tested (`src/scoring`, `test/scoring`).
- **Ryder Cup cup-points layer** — 1 point/round to the better combined team result,
  0.5/0.5 on ties, double-point Saturday finale, and a clinch tracker.
- **Live leaderboard** with a TV mode (`/board?tv=1`) for projecting at the bar.
- **Tee sheet & group score entry** — phone-friendly, with offline queue + sync (IndexedDB).
- **The Bandon Book** — pick-a-side prop game with a commish (admin) settle flow.
- **Installable PWA** — offline-capable, generated icons and Open Graph share card.
- **Dead-simple auth** — one shared trip passcode + a second admin passcode. No accounts.

## Stack

- **Frontend:** React 19 + Vite, served as static assets by the Worker (SPA fallback).
- **API:** Cloudflare Worker (Hono router) — the only layer that touches the DB. Browser
  talks only to `/api/*`; no DB credentials ever reach the client.
- **Database:** Cloudflare D1 (SQLite), with migrations in `migrations/`.
- **Sessions:** Workers KV (the trip-passcode token).
- **Tests:** Vitest, including `@cloudflare/vitest-pool-workers` for the worker routes.

## Prerequisites

- Node.js 20+
- A Cloudflare account and the Wrangler CLI (`npx wrangler login`)

## Setup

```bash
git clone <your-fork-url> && cd bandon
npm install
```

### 1. Local secrets

```bash
cp .dev.vars.example .dev.vars
# edit .dev.vars and set PASSCODE and ADMIN_PASSCODE
```

### 2. Create your Cloudflare resources

The D1 database id and KV namespace id in `wrangler.jsonc` are placeholders. Create your
own and paste the returned ids in:

```bash
npx wrangler d1 create bandon-cup          # → paste id into "database_id"
npx wrangler kv namespace create SESSIONS  # → paste id into "id" under kv_namespaces
```

### 3. Apply migrations (locally)

```bash
npm run db:migrate:local
```

`migrations/0002_seed.sql` seeds example players, teams, and the five real Bandon courses
(par + stroke index, sourced from `docs/scorecards.md`). Replace the player rows there —
or edit them later from the admin screen — to make it your own.

### 4. Run it

```bash
npm run dev        # vite dev with the worker, http://localhost:5173
```

Visit `/` for the home screen. `/board`, `/tee`, `/rules`, and `/book` are public;
`/score` and `/admin` require the passcode (admin actions require `ADMIN_PASSCODE`).

## Tests

```bash
npm test           # vitest run
npm run test:watch
```

## Deploy to Cloudflare

```bash
# Set production secrets (encrypted; not in source):
echo "<trip-passcode>"  | npx wrangler secret put PASSCODE
echo "<admin-passcode>" | npx wrangler secret put ADMIN_PASSCODE

# Apply migrations to the remote D1 database:
npm run db:migrate:remote

# Build the client and deploy the worker:
npm run deploy
```

## Project layout

```
src/            React PWA
  scoring/      pure scoring engine (Stableford, cup points, the Book) — unit-tested
  screens/      Home, Board, TeeSheet, ScoreEntry, Admin, Rules, Book, Login
  state/        client data hooks + session
  offline/      IndexedDB write queue + sync
worker/         Cloudflare Worker (Hono) — routes/ is one file per API surface
migrations/     D1 schema + seed
scripts/        icon + Open Graph card generators (sharp)
docs/           scorecard reference data (par + stroke index per course)
test/           Vitest suites (scoring, worker routes, state)
```

## Customizing for your trip

- **Players & teams:** edit `migrations/0002_seed.sql` (or use the admin screen).
- **Courses & scorecards:** `migrations/0002_seed.sql` + `docs/scorecards.md`.
- **Branding:** swap `public/` assets and re-run `node scripts/gen-icons.mjs` and
  `node scripts/make-og.mjs`. Theme tokens live in `src/ui/theme.ts`.
- **Schedule & rounds:** `src/schedule.ts` and the schedule migration.

## License

MIT — see `LICENSE`.
