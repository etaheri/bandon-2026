# Bandon Cup '26 — Design Doc

**Date:** 2026-05-31
**Status:** Approved for planning

A mobile-first golf trip scoring app with a broadcast-style Ryder Cup leaderboard. Eight players, two teams, six counting rounds (Thu–Sat), pooled **net-Stableford** scoring presented as a TV Ryder Cup board. Early-2000s EA "Tiger Woods PGA Tour" aesthetic. Includes a parody play-money sportsbook ("The Bandon Book").

---

## Decisions locked during brainstorming

These resolve open questions in the original spec. Where they differ from the original spec, **this doc wins.**

1. **v1 scope:** Build the **full spec, in milestone order** (scaffold → scoring engine → API → score entry → tee sheet/home → leaderboard/TV → PWA → sportsbook → polish). Nothing deferred to a "v2."
2. **Scorecard data:** Claude **fetches + verifies** par and stroke index for all five courses from official Bandon scorecards / GHIN, and seeds real data. Anything not verifiable with high confidence is flagged for the admin to spot-check.
3. **Handicaps:** **Admin (Erik) enters once** via an admin screen. No per-player self-entry flow. Each player's quota stays **overrideable** after the Wednesday calibration round.
4. **Handicap allowance:** Global admin setting, **default 75%**. `playingHandicap = round(fullHandicap × allowance)`. Strokes received are computed from `playingHandicap`.
5. **Scoring model — Net Stableford (corrected):** The original spec double-counted handicap (strokes received *and* `quota = 36 − handicap`). **Fixed:** handicap lives in **one** place — the strokes received. **Quota is flat at 36** for everyone. Round result = `netStablefordPoints − proratedQuota`. See "Scoring engine" below.
6. **Ryder Cup feel** comes from the **cup-points layer**, not the Stableford math — team vs team, 1 point per round to the better combined result, 0.5/0.5 on ties, **double-point Saturday finale (R7)**, clinch tracker. Unchanged from original spec and independent of the scoring variant.
7. **Visuals:** Brainstormed text-only. Aesthetic polish (animations, broadcast feel) handled in a later pass with `/overdrive` and `/delight`. Build now should be clean, themed, and functional; not final-polished.

---

## Stack

- **Frontend:** React (Vite) on Cloudflare Pages. PWA, installable, offline-capable.
- **API:** Cloudflare Pages Functions / Worker. Only layer that touches the DB.
- **DB:** Cloudflare D1 (SQLite).
- **Cache/session:** Workers KV for the trip-passcode session + optional leaderboard cache.
- **Hard rule:** No client-side DB credentials, ever. Browser talks only to `/api/*`.

## Auth (deliberately dumb-simple)

- One shared trip passcode. `POST /api/auth` → sets an HttpOnly cookie / KV-backed token.
- Each device also picks "who am I" (player id), stored locally, so score entry defaults to their own group. UX only, not security.
- **Admin gate:** a second passcode (or a flag on a known player id) unlocks admin actions: entering handicaps, setting the allowance %, overriding quotas, locking handicaps after Wednesday, and sportsbook commish actions (lock/settle props).

---

## Data model (D1)

Core scoring tables are as in the original spec, with two additions for the corrected scoring model and admin settings.

```sql
CREATE TABLE players (
  id TEXT PRIMARY KEY,            -- 'taheri'
  name TEXT NOT NULL,
  handicap REAL NOT NULL,         -- FULL course handicap (allowance applied at compute time)
  quota_override REAL,            -- null = use flat 36; set after Wed calibration if desired
  team TEXT NOT NULL              -- 'GORSE' | 'DRIFTWOOD'
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,           -- 'allowance' -> '0.75', 'handicaps_locked' -> '0'|'1'
  value TEXT NOT NULL
);

CREATE TABLE courses (
  id TEXT PRIMARY KEY,            -- 'pacific'
  name TEXT NOT NULL,
  par INTEGER NOT NULL
);

CREATE TABLE holes (
  course_id TEXT NOT NULL REFERENCES courses(id),
  number INTEGER NOT NULL,        -- 1..18
  par INTEGER NOT NULL,
  stroke_index INTEGER NOT NULL,  -- 1..18 (REQUIRED for net allocation)
  PRIMARY KEY (course_id, number)
);

CREATE TABLE rounds (
  id TEXT PRIMARY KEY,            -- 'r2'
  course_id TEXT NOT NULL REFERENCES courses(id),
  label TEXT NOT NULL,            -- 'Round 2'
  day TEXT NOT NULL,              -- 'THU'
  tee_time TEXT NOT NULL,         -- '7:30 AM'
  counts INTEGER NOT NULL DEFAULT 1,  -- 0 for Wed warm-up
  double_points INTEGER NOT NULL DEFAULT 0  -- 1 for R7 finale
);

CREATE TABLE tee_assignments (
  round_id TEXT NOT NULL REFERENCES rounds(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  group_no INTEGER NOT NULL,      -- 1 or 2
  PRIMARY KEY (round_id, player_id)
);

CREATE TABLE scores (
  round_id TEXT NOT NULL REFERENCES rounds(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  hole INTEGER NOT NULL,          -- 1..18
  gross INTEGER,                  -- null = not yet played
  updated_at INTEGER NOT NULL,    -- epoch ms, last-write-wins + offline sync
  PRIMARY KEY (round_id, player_id, hole)
);

-- The Bandon Book (sportsbook)
CREATE TABLE props (
  id TEXT PRIMARY KEY, creator TEXT NOT NULL, subject TEXT NOT NULL,
  description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', -- open|locked|settled
  locks_at INTEGER, created_at INTEGER NOT NULL
);
CREATE TABLE prop_options (
  id TEXT PRIMARY KEY, prop_id TEXT NOT NULL REFERENCES props(id),
  label TEXT NOT NULL, odds INTEGER NOT NULL,   -- american, e.g. +150 / -10000
  is_winner INTEGER                              -- null until settled
);
CREATE TABLE wagers (
  id TEXT PRIMARY KEY, option_id TEXT NOT NULL REFERENCES prop_options(id),
  bettor TEXT NOT NULL REFERENCES players(id),
  stake INTEGER NOT NULL, payout INTEGER, placed_at INTEGER NOT NULL
);
-- bankroll derived: 10000 - sum(stakes) + sum(payouts)
```

Seed `players, settings, courses, holes, rounds, tee_assignments` from known data (tee sheet is fixed — see appendix). Seed the sportsbook with the day-one props (see appendix). `scores`, `props` (user-created), and `wagers` fill in live.

---

## Scoring engine (server-side, single source of truth — pure, unit-tested module)

Never trust the client to do math. The client only sends gross scores.

**Strokes received on a hole** (handles any handicap, incl. >18), using the **playing** handicap:
```
playingHcp      = round(fullHandicap × allowance)     // allowance default 0.75
base            = floor(playingHcp / 18)
extra           = (stroke_index <= (playingHcp mod 18)) ? 1 : 0
strokesReceived = base + extra
```

**Net Stableford points for a hole:**
```
net    = gross - strokesReceived
points = max(0, (par - net) + 2)
// par→2, bogey→1, double→0, birdie→3, eagle→4
```

**Quota (corrected — flat):**
```
quota = playerQuotaOverride ?? 36
```
Handicap is NOT subtracted again here; it already lives in `strokesReceived`. The optional per-player override exists only for manual tuning after the Wednesday calibration round.

**Round result (prorated so the live board is fair mid-round):**
```
holesPlayed   = count of holes with a non-null gross this round
pointsSoFar   = sum(points over played holes)
proratedQuota = quota × (holesPlayed / 18)
roundResult   = pointsSoFar - proratedQuota
```

**Team total:** sum of each member's `roundResult` across all counting rounds (`counts = 1`).

### Cup points (the headline — LOCKED)
- Each counting round = **1 cup point** to the team with the better **combined round result** (sum of that team's members' round results for that round). Ties split **0.5 / 0.5**.
- **R7 (Sat PM Pacific Dunes) is worth DOUBLE (2 points)** — the "Sunday singles" finale.
- Total available = **7** (5 rounds × 1 + finale × 2). First to **4 wins**; **3.5 retains**.
- Headline reads broadcast-style: `GORSE 3.5 — 2.5 DRIFTWOOD`.
- **Clinch tracker:** compute points still available and team state — `CLINCHED` / `ALIVE` / `MUST WIN FINALE` — exactly like a TV broadcast. The double finale means a 3–2 lead going into Saturday afternoon is still live.

### Side crowns (shown on the board)
- **Player of the Trip** — best cumulative round result across counting rounds.
- **Daily low round** — best single `roundResult` per day.

All of the above is computed entirely server-side from `scores + holes + players + settings`.

---

## API routes

```
POST /api/auth            { passcode }            -> session cookie
GET  /api/state                                   -> players, teams, rounds, tee sheet, settings
GET  /api/round/:id                               -> holes + current scores for a round
POST /api/score           { roundId, playerId, hole, gross, updatedAt }
GET  /api/leaderboard                             -> cup points, team aggregates, per-player live +/-, thru, clinch state, crowns
GET  /api/export.csv                              -> optional, for the spreadsheet crowd

-- Admin (admin-gated) --
POST /api/admin/handicaps { players:[{id,handicap}] }   -> set handicaps
POST /api/admin/settings  { allowance?, handicapsLocked?, quotaOverrides? }

-- The Bandon Book --
GET  /api/book                                    -> open + settled props, options, lines, current action
POST /api/book/prop       { creator, subject, description, options:[{label,odds}], locksAt? }
POST /api/book/wager      { propOptionId, bettor, stake }
POST /api/book/lock       { propId }              -> no more wagers (creator/commish)
POST /api/book/settle     { propId, winningOptionId } -> computes payouts, updates bankrolls
GET  /api/book/bankrolls                          -> standings: balance, biggest win, titles
```

---

## Frontend screens

- **Login** — passcode + "who am I" picker.
- **Home** — trip overview, today's tee times, quick links (Enter Score, Leaderboard, The Book).
- **Score entry** — hole-by-hole gross via the big +/- stepper. Defaults to the device's player + current round/group. Optimistic UI; writes to a local IndexedDB queue immediately and syncs to `/api/score` when online. One-handed, big tap targets.
- **Tee sheet** — the fixed group assignments per round (appendix).
- **Leaderboard** — broadcast board (see below).
- **Board / TV mode** — `/board?tv=1`, no nav, huge type, designed to cast to the loft TV. Polls every ~20s; animates reorders + number changes.
- **The Bandon Book** — props list, post-a-prop CTA, bet-slip drawer, bankroll standings + titles, odds ticker (also belongs on the TV).
- **Admin** — handicap entry, allowance %, quota overrides, lock handicaps, sportsbook commish (lock/settle).

### Board layout (full-bleed, dark, broadcast)
- **Top third:** giant center scoreboard, team colors hard split left/right. **Gorse = blaze amber `#F4A300`**, **Driftwood = electric blue `#2E8BFF`**. Big cup-points number per side; below it the live aggregate (`GORSE +6 / DRIFTWOOD +2`).
- **Body:** one row per player, grouped/colored by team — team color bar, name, live +/- to quota with up/down arrow, `THRU n` badge (or `F`). Sort by +/- within team.
- **Leader glow** on the team ahead; **star** on the top individual.
- **Auto-refresh** ~20s so it animates like a broadcast.

---

## Mobile + offline (required, not optional)

- Mobile-first, one-handed reach, big tap targets (the +/- stepper for gross entry).
- **PWA:** installable, app icon, splash, service worker caches the shell.
- **Offline-first writes:** score entry writes to a local IndexedDB queue immediately with optimistic UI; sync to `/api/score` when back online. Coastal Bandon signal is unreliable on-course — this is what makes the app get used instead of abandoned.
- **Conflict rule:** last-write-wins by `updated_at`. Each guy enters his own group, so real conflicts are rare.

---

## The Bandon Book (parody sportsbook)

Play-money props for side action. No real money — fake bankroll, bragging rights only. Likely the most-used feature.

- Everyone starts with **10,000 Gorse Gold**.
- Anyone posts a prop: subject + description + 2+ outcomes, each with American odds they set. Comedy lines encouraged (`Gone -10000`).
- Anyone wagers Gorse Gold on any open prop's outcome.
- Creator/commish **locks** before the event, then **settles** by picking the winner. Payouts auto-compute, bankrolls update.
- **Bankroll leaderboard + titles:** 🦈 The Shark (top balance), 💸 The Degenerate (most wagers placed), 🔥 Biggest Single Win, 🚽 Tilted (bottom balance).

**Payout math (American odds):**
```
profit = odds > 0 ? stake * (odds/100) : stake * (100/abs(odds))
win    -> balance += stake + profit
lose   -> balance -= stake
```
Deduct stake at placement so live balances reflect open exposure.

**Aesthetic:** neon-on-dark "book," odds in classic yellow monospace, flashing "LIVE" tags, scrolling odds ticker. Each prop is a card; outcomes are tappable odds buttons; bet-slip drawer to confirm stake. Show action (Gorse Gold on each outcome, who's exposed). Kiosk mode: ticker + biggest movers on the loft TV next to the leaderboard.

---

## Aesthetic (carry from the prototype)

Chrome-beveled panels, gold-on-deep-green, Impact/Arial-Black italic uppercase headers with embossed text-shadows, glossy gradient buttons, "BANDON SPORTS — IT'S IN THE GAME" parody tag. Inline styles / CSS vars for gradients and text effects. A motion library for reorder/score-pop animations. Early-2000s EA "Tiger Woods PGA Tour" feel throughout.

---

## Build order (milestones)

1. Scaffold Vite + React + Pages Functions + D1 binding. Migrations + seed.
2. Scoring engine as a pure, unit-tested module (strokes received, points, flat quota, round result, cup points, clinch state, crowns). Test against hand-worked examples.
3. `/api/*` routes against D1.
4. Score entry screen (hole-by-hole stepper, optimistic + offline queue).
5. Tee sheet + home screens (port the prototype).
6. Leaderboard + TV/kiosk mode with polling + animations.
7. PWA / service worker, install prompt.
8. The Bandon Book (props, wagers, settlement, bankroll standings, kiosk ticker).
9. Admin screen (handicaps, allowance, quota overrides, lock) + polish pass (animations, empty/loading states, calibration-round quota override).

---

## Appendix A — fixed tee sheet (counting rounds)

- **R2** Pacific Dunes, Thu 7:30/7:40 — G1: DeSabio, Meissner, LaFlair, Taheri · G2: Grattan, Sloan, Stenzel, Johnson
- **R3** Old Macdonald, Thu 2:00/2:10 — G1: Meissner, Stenzel, DeSabio, Sloan · G2: LaFlair, Grattan, Johnson, Taheri
- **R4** Bandon Dunes, Fri 9:30/9:40 — G1: Taheri, LaFlair, Sloan, Stenzel · G2: DeSabio, Johnson, Meissner, Grattan
- **R5** Sheep Ranch, Fri 3:40/3:50 — G1: Stenzel, LaFlair, Grattan, DeSabio · G2: Meissner, Johnson, Taheri, Sloan
- **R6** Bandon Trails, Sat 7:20/7:30 — G1: Stenzel, Meissner, Johnson, LaFlair · G2: Grattan, DeSabio, Taheri, Sloan
- **R7** Pacific Dunes, Sat 2:40/2:50 — G1: Taheri, Meissner, Grattan, Stenzel · G2: Johnson, LaFlair, DeSabio, Sloan

> R7 is the double-point finale. Round ids r2–r7 map to the above; r1 is the optional Wed warm-up (`counts = 0`) used for handicap calibration.

## Appendix B — team rosters

Eight players across **GORSE** and **DRIFTWOOD**. Exact team split + full names to be confirmed by admin at seed time. Players referenced: DeSabio, Meissner, LaFlair, Taheri, Grattan, Sloan, Stenzel, Johnson.

> **Open input:** Claude needs the GORSE/DRIFTWOOD split for the 8 players, full display names, and handicaps. These are seed inputs, not design decisions — the schema and admin screen support entering/editing them.

## Appendix C — day-one seed props

- "Bruce's first drive (R1 1st tee): Fairway +10000 / Rough +150 / Gone -10000"
- "First 3-putt of the trip" (one option per player)
- "Total balls lost on Sheep Ranch cliffs: Over 4.5 -130 / Under 4.5 +110"
- "Who's last to the first tee?" (one option per player)
- "Anyone breaks 80 on Pacific Dunes: Yes +400 / No -600"
- "Erik mentions 'quota' more than 20 times: Yes -250 / No +200"

## Appendix D — scorecard data (to be fetched + verified by Claude)

Par + stroke index per hole for: **Pacific Dunes, Old Macdonald, Bandon Dunes, Sheep Ranch, Bandon Trails.** Claude sources from official scorecards / GHIN, seeds `courses` + `holes`, and flags any hole it can't verify with high confidence for admin spot-check.
