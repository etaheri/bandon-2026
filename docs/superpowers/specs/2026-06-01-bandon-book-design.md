# The Bandon Book — design spec

**Date:** 2026-06-01
**Status:** approved for planning
**Companion to:** `docs/superpowers/specs/2026-05-31-bandon-cup-design.md` (this supersedes that doc's odds/money sportsbook section)

## Summary

A play-money-free **prediction game** for the Bandon Cup trip (6/4–6/6). Anyone posts a
comedy prop with 2+ outcomes ("Bruce's first tee shot: Fairway / Rough / Gone"; "Hats Pete
buys: 0 / 1 / 2+"). Every player gets **one locked pick per prop**. The commish **locks**
picks right before the event, then **resolves** the winner. You score **+1 for every correct
call**. Standings rank players by correct picks, with fun titles. It's its own phone screen,
reachable from Home. No money, no odds, no TV/kiosk integration in this MVP — "more for laughs."

### Why this differs from the original spec

The 2026-05-31 design specified a casino-style book (10,000 Gorse Gold bankroll, American odds
per outcome, variable stakes, auto-computed payouts, bankroll titles). With the trip three days
out, the owner re-scoped to a simpler, funnier mechanic: **just pick a side**. No money to
manage, one pick per prop, admin resolves. This doc replaces that section. The old `props` /
`prop_options` / `wagers` tables (shaped for odds + stakes) have never held data, so we drop and
recreate them to fit the new model.

## Decisions (locked)

- **Bet model:** pick one outcome per prop. No money, no odds. Correct pick = +1 point.
- **Pick limit:** one pick per player per prop, across all props (you can play every prop, one pick each).
- **Picks are immutable:** once placed, a pick cannot be changed (enforced at the DB by a UNIQUE constraint — picks are insert-only).
- **Who posts props:** any logged-in player.
- **Lifecycle:** `open` → `locked` → `resolved`, all transitions **commish (admin) only**.
- **Resolution:** admin sets the winning option; scoring is then derived (no stored balances).
- **Standings:** rank by correct picks, with titles (see below). Hit-rate shown as a secondary stat.
- **Surface:** its own public `/book` screen linked from Home. Admin Lock/Resolve controls render **inline** on each prop card, visible only to admin-role devices. No TV/kiosk integration in this MVP.
- **Writes are online-only** (not queued offline like scores) — the Book is a clubhouse/wifi activity, not a mid-fairway one.

## Data model (migration `0005_bandon_book.sql`)

The three existing book tables were defined in `0001_init.sql` for the old odds/money model and
have never held data. Drop and recreate them:

```sql
DROP TABLE wagers;
DROP TABLE prop_options;
DROP TABLE props;

CREATE TABLE props (
  id TEXT PRIMARY KEY,
  creator TEXT NOT NULL REFERENCES players(id),
  subject TEXT NOT NULL,                 -- "Bruce's first tee shot"
  description TEXT,                       -- optional flavor text, nullable
  status TEXT NOT NULL DEFAULT 'open',   -- 'open' | 'locked' | 'resolved'
  winning_option_id TEXT,                -- set on resolve, nullable until then
  created_at INTEGER NOT NULL,
  locked_at INTEGER,
  resolved_at INTEGER
);

CREATE TABLE prop_options (
  id TEXT PRIMARY KEY,
  prop_id TEXT NOT NULL REFERENCES props(id),
  label TEXT NOT NULL,                    -- "Fairway" / "Rough" / "Gone"
  position INTEGER NOT NULL               -- display order, 0-based
);

CREATE TABLE picks (
  id TEXT PRIMARY KEY,
  prop_id TEXT NOT NULL REFERENCES props(id),
  option_id TEXT NOT NULL REFERENCES prop_options(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  created_at INTEGER NOT NULL,
  UNIQUE (prop_id, player_id)             -- ONE locked pick per player per prop
);

CREATE INDEX idx_prop_options_prop ON prop_options(prop_id);
CREATE INDEX idx_picks_prop ON picks(prop_id);
```

Notes:
- `UNIQUE(prop_id, player_id)` is the enforcement mechanism for "one immutable pick" — the API
  only ever inserts picks (never updates), so the database guarantees nobody hedges or changes their mind.
- No `odds`, `stake`, `payout` columns — scoring is derived, never stored.
- `winning_option_id` has no FK (kept simple; the resolve route validates it belongs to the prop).

### Seed props (migration or admin-created)

Seed a few day-one comedy props so the screen isn't empty on arrival (final wording TBD with owner;
these are examples consistent with Appendix C of the original spec):
- "Bruce's first tee shot (R1, 1st tee): Fairway / Rough / Gone"
- "Hats Pete buys on the trip: 0 / 1 / 2+"
- "First 3-putt of the trip: <one option per player>"
- "Who's last to the first tee Thursday: <one option per player>"

Seeding is optional for the MVP; any player can post props in-app. If seeded, do it in `0005` or a
follow-on seed migration using existing player ids.

## API (Hono, mounted under `/api`, new `worker/routes/book.ts`)

```
GET  /api/book
     -> public read. Returns:
        { props: [ { id, creator, subject, description, status,
                     winningOptionId, lockedAt, resolvedAt, createdAt,
                     options: [{ id, label, position, pickCount }],
                     picks:   [{ playerId, optionId }],   // who picked what (friends; transparency is the fun)
                     myPick:  optionId | null } ],         // resolved against caller's getPlayerId (via query or cookie)
          standings: [ { playerId, name, correct, resolvedPicked, hitRate, titles: [..] } ] }

POST /api/book/prop      { subject, description?, options: [label, ...] }   (requireSession / player)
     -> validates: subject non-empty, 2..8 options, labels non-empty/trimmed.
     -> creates prop (status 'open') + options (position by array order). Creator = session-derived player id.

POST /api/book/pick      { propId, optionId }                              (requireSession / player)
     -> 409 if prop not 'open' (locked/resolved) OR player already has a pick on this prop.
     -> 400 if optionId not part of propId. Otherwise inserts pick. Player id = session/getPlayerId.

POST /api/book/lock      { propId }                                        (requireAdmin)
     -> open -> locked. Sets locked_at. 409 if not 'open'.

POST /api/book/resolve   { propId, winningOptionId }                       (requireAdmin)
     -> locked|open -> resolved. Validates winningOptionId belongs to prop.
        Sets winning_option_id + resolved_at. (Resolving an 'open' prop is allowed and implicitly closes it.)
```

- **Identity / trust model:** creator and bettor player ids come from the device's selected player
  (`getPlayerId()`), the same trust model already used across the app for 8 friends. Read is public
  (consistent with board/home/tee); posting a prop or pick requires the player passcode session;
  lock/resolve require the admin session. Server enforces via existing `requireSession` / `requireAdmin`.
- **Standings are computed on read**, never stored: for each player, `correct` = count of their picks
  whose `option_id == winning_option_id` among resolved props; `resolvedPicked` = their picks on resolved
  props; `hitRate = correct / resolvedPicked` (0 when none). Sort by `correct` desc, then `hitRate` desc.

### Titles (assigned in standings computation)

- 🔮 **The Oracle** — most correct picks (min 1 correct; ties = co-Oracles).
- 🎯 **Sharpshooter** — best hit rate among players with ≥ some threshold of resolved picks (e.g. ≥3), excluding the Oracle if same person.
- 🚽 **Tank Job** — most *wrong* picks (most picks on losing options among resolved props).
- (Final emoji/wording is cosmetic and may be tuned during implementation; on-brand with the existing crowns.)

## Scoring/standings module (pure, unit-tested)

Extract the standings + titles logic into a pure module (e.g. `src/book.ts`), mirroring how the
net-Stableford engine is a pure tested module. Signature roughly:

```ts
type PropLite = { id: string; status: string; winningOptionId: string | null };
type PickLite = { propId: string; optionId: string; playerId: string };
computeStandings(props: PropLite[], picks: PickLite[], players: {id,name}[]) -> Standing[]
```

This keeps the worker route thin (fetch rows, call the module, return JSON) and makes the
scoring rules testable without a DB.

## Frontend — `/book` screen

New public screen wired into `src/App.tsx` routing (`path.startsWith("/book")`) and the `go()`
navigator, following the existing screen + EA-retro theme conventions. Linked from Home.

Layout (mobile-first, big tap targets, existing theme tokens):
- **Standings strip** (top) — ranked players with correct-pick count + titles + hit-rate.
- **Open props** — cards with subject, optional flavor text, and tappable outcome buttons.
  After you tap, your pick is highlighted and the buttons disable (locked). Show per-option pick
  tally / who picked what.
- **Locked props** — "🔒 PICKS CLOSED", outcomes shown, awaiting result.
- **Resolved props** — winning option highlighted in team-gold; ✓ / ✗ marker on the caller's pick.
- **"+ Post a prop"** — lightweight form: subject, optional description, and an add/remove list of
  outcome labels (2+). Fast to fill in ("easy to add bets").
- **Inline admin controls** — on each prop card, **only when the device is in admin role**
  (`isAdmin()`): a **Lock** button (open props) and a **Resolve** flow (pick the winning option).

Data fetching uses the existing client/polling conventions (a `useBook`-style hook analogous to
`useLeaderboard`); writes are plain online POSTs via the existing `api` client.

### Client session role (required supporting change)

Today `src/state/session.ts` stores only `isAuthed` (boolean) and the selected player id — **not the
role**. `POST /api/auth` already returns `{ ok, role }`. Add:
- `setRole(role)` / `getRole()` and `isAdmin()` helpers in `session.ts` (persist role in localStorage).
- `Login.tsx` calls `setRole(resp.role)` after `api.auth(...)`.
- Book screen gates inline admin controls on `isAdmin()`.

This is UI-only convenience; the worker still enforces admin via the session cookie, so a tampered
client cannot lock/resolve.

**Admin login (for reference):** same Login screen — type the commish passcode (`ADMIN_PASSCODE`,
default `commish26`) instead of the player passcode (`bandon26`), then pick your name. The session
cookie carries the admin role and the inline Lock/Resolve controls appear.

## Testing

Pure module (`src/book.ts`):
- correct-pick counting across resolved props; unresolved props ignored.
- hit-rate math (including 0 resolved picks).
- title assignment incl. ties.

Worker routes (`test/worker/book.test.ts`, using existing `@cloudflare/vitest-pool-workers` setup):
- create prop validates option count + non-empty labels.
- pick: success path; **409 on duplicate pick** (UNIQUE); **409 when prop locked/resolved**; 400 when option not in prop.
- lock: open→locked; 409 otherwise; **403 for player role**.
- resolve: sets winner + scores; rejects winningOptionId not in prop; **403 for player role**.
- `GET /api/book` shape incl. `myPick` and standings.

## Out of scope (MVP)

- Money / Gorse Gold / odds / payouts.
- TV / kiosk ticker.
- Offline-queued pick writes.
- Editing or deleting props after creation (a wrong prop can simply be resolved/ignored; add later if needed).
- Per-prop "closes at" auto-lock time (admin locks manually).

## Build order

1. Migration `0005_bandon_book.sql` (drop + recreate book tables) + optional seed props.
2. Pure standings module `src/book.ts` + unit tests.
3. Worker `worker/routes/book.ts` (+ db helpers in `worker/db.ts`) + mount in `worker/index.ts` + route tests.
4. Session role helpers in `src/state/session.ts` + `Login.tsx` wiring.
5. `/book` screen + `useBook` hook + Home link + App routing.
6. Polish: empty/loading states, pick tallies, resolved styling, admin inline controls.
