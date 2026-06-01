# Bandon Cup '26 — Spectator & Schedule Update — Design Doc

**Date:** 2026-05-31
**Status:** Approved for planning
**Builds on:** the merged core app (`2026-05-31-bandon-cup-design.md`). This is the second enhancement cycle. The sportsbook ("The Bandon Book") remains a separate future plan and is out of scope here.

A round of spectator-facing and schedule-awareness enhancements: public read-only board access, real trip dates + names, a clock-aware home panel, a Ryder-Cup-styled broadcast board with live/today detail and a per-round breakdown, a tap-to-expand player drill-down, and a faster tap-the-score entry flow with a pick-up button.

---

## Decisions locked during brainstorming

1. **Real data (from the actual tee sheet):** full player names; a real `date` on each round (Thu 2026-06-04, Fri 2026-06-05, Sat 2026-06-06); **delete the Wednesday warm-up round `r1`**. Tee groups were cross-checked against the photographed sheet and all six counting rounds match the existing seed.
2. **Public spectator access:** **all GET (read) API endpoints become public**; **writes stay gated.** The trip passcode now gates only score entry (`POST /api/score`); admin stays admin-gated. Spectators view the board with no passcode and no player pick. (Scores aren't sensitive; the passcode was always low-security by design.)
3. **Schedule awareness uses the device-local clock** (everyone is on-site in Pacific time). A pure, unit-tested helper classifies each round COMPLETED / LIVE / UPCOMING relative to "now."
4. **Board adopts the Ryder Cup *look*, keeps our scoring.** Pooled net-Stableford + cup-points is unchanged. No match-play conversion.
5. **Score entry → tap-the-score**, par-relative, auto-advancing, with a **Pick up** button. Replaces the +/- stepper.
6. **Pick-up data model:** a hole's `gross` value of **`0` is a sentinel meaning "picked up"** — the hole counts as *played* (contributes to holes-completed / quota proration) but scores **0 points**. `null` still means "not played yet." `1..20` are real scores. This is the single, documented overload of `gross`; no schema change to the `scores` table.

---

## Scope

In: data migration, public read access, schedule helper, home "Up Next", board restyle + live/today/per-round detail, player drill-down, tap-the-score + pick-up, the API/scoring changes those require.

Out: the sportsbook; match-play scoring; real handicaps/team split (still admin-entered); any deploy/cloud work.

---

## Data model changes

- **`rounds.date TEXT`** — ISO `YYYY-MM-DD`, the round's calendar date. Combined with the existing `tee_time` string to form the round's start datetime.
- **`scores.gross` sentinel:** `0` = picked up (played, 0 points). Documented; no DDL change.
- **Delete round `r1`** (Wed warm-up) and any rows referencing it.

### Migration `migrations/0003_schedule_and_names.sql`
```sql
ALTER TABLE rounds ADD COLUMN date TEXT;

UPDATE players SET name = 'Erik Taheri'    WHERE id = 'taheri';
UPDATE players SET name = 'Pete DeSabio'   WHERE id = 'desabio';
UPDATE players SET name = 'Matt LaFlair'   WHERE id = 'laflair';
UPDATE players SET name = 'Bruce Stenzel'  WHERE id = 'stenzel';
UPDATE players SET name = 'Ryan Meissner'  WHERE id = 'meissner';
UPDATE players SET name = 'Jeff Grattan'   WHERE id = 'grattan';
UPDATE players SET name = 'Gavin Sloan'    WHERE id = 'sloan';
UPDATE players SET name = 'Anthony Johnson' WHERE id = 'johnson';

UPDATE rounds SET date = '2026-06-04' WHERE id IN ('r2','r3');
UPDATE rounds SET date = '2026-06-05' WHERE id IN ('r4','r5');
UPDATE rounds SET date = '2026-06-06' WHERE id IN ('r6','r7');

DELETE FROM scores WHERE round_id = 'r1';
DELETE FROM tee_assignments WHERE round_id = 'r1';
DELETE FROM rounds WHERE id = 'r1';
```
> The fresh-install seed (`0002`) is left as-is; `0003` migrates it forward. New databases run 0001→0002→0003 and arrive at the same state.

---

## Scoring engine changes (pure, server-authoritative)

1. **`roundResult` handles pick-ups.** A hole with `gross === 0` counts as played (increments `holesPlayed`, contributes to proration) but adds **0** points:
```
const gross = scores[hole.number];
if (gross == null) continue;        // not played yet
holesPlayed++;
if (gross === 0) continue;          // picked up: played, 0 points
points += holePoints({ gross, par: hole.par, strokes: strokesReceived(phc, hole.strokeIndex) });
```
2. **`computeLeaderboard` exposes more:**
   - Each player row gains **`perRound: { [roundId]: { result, points, thru, holesPlayed } }`** (the per-round breakdown; "today" is whichever round the client deems live, "trip" is the existing cumulative `result`).
   - A top-level **`roundCups: [{ roundId, gorse, driftwood, decided, double }]`** array (the per-round cup outcomes already computed internally — now surfaced for the breakdown strip).
   - Pass-through **`rounds`** (id, label, day, date, teeTime, courseId, counts, doublePoints) and **`courses`** (id, name, par) metadata, so the public board needs only the single `/api/leaderboard` call.
   - Existing fields (`cup`, `clinch`, `teamAggregate`, `leader`, `players[].{playerId,name,team,result,thru}`, `crowns`) are unchanged.
3. All new behavior is unit-tested (pick-up scoring; perRound correctness; roundCups matches per-round winners).

> "Live round" is **not** computed in the engine (it needs wall-clock + timezone). The client computes it from round dates using device-local time (see Schedule module). This keeps the pure engine free of `Date.now()`.

---

## Schedule module (new, pure, unit-tested) — `src/schedule.ts`

Device-local time; everyone is on-site in Pacific.

- `roundStart(round): Date` — parse `date` (`YYYY-MM-DD`) + `teeTime` (`"7:30 AM"`) into a local `Date`.
- `classifyRounds(rounds, now): Array<{ roundId: string; status: "COMPLETED" | "LIVE" | "UPCOMING" }>`
  - Consider only counting rounds, sorted by start.
  - **LIVE** = the latest round whose start `<= now` and (no later round exists OR `now <` the next round's start).
  - Earlier-started rounds = **COMPLETED**; future starts = **UPCOMING**.
- `liveRound(rounds, now): Round | null` and `nextUpcoming(rounds, now): Round | null` — convenience wrappers.

Tests inject `now` (no real clock) and cover: before the trip (first round UPCOMING, none live), mid-morning round (LIVE), the gap between morning and afternoon rounds (morning still "live" until afternoon starts — matches the accepted "shows next even if running long" trade-off), and after the finale (all COMPLETED, none live).

---

## API changes

### Auth surface
- **Public (no session):** `GET /api/state`, `GET /api/round/:id`, `GET /api/leaderboard`. Remove `requireSession` from these.
- **Gated (trip passcode session):** `POST /api/score`, `GET /api/export.csv` (bulk dump stays behind the passcode).
- **Admin-gated:** `/api/admin/*` (unchanged).

### `POST /api/score`
- Accept `gross === 0` (pick-up sentinel). Validation becomes: `gross` is `null`, or an integer in `0..20`. Everything else (last-write-wins by `updatedAt`) unchanged.

### `GET /api/leaderboard`
- Returns the richer payload described under Scoring (perRound, roundCups, rounds, courses), plus existing fields. One public call now powers the entire board.

---

## Frontend changes

### Routing & auth flow (`src/App.tsx`, `src/screens/Login.tsx`, `src/state/session.ts`)
- **Public routes (no login):** `/board`, `/board?tv=1`, `/` (home), `/tee`. A spectator landing on any of these sees content immediately.
- **Login required only for:** `/score` and `/admin`. Tapping **Enter Score** when not authed routes through the existing passcode → who-am-I flow, then continues to score entry.
- The who-am-I player pick is required only to enter scores (it sets the device's default player). Spectators never pick a player.

### Score entry — `src/ui/ScorePad.tsx` (replaces `Stepper` usage in `ScoreEntry.tsx`)
- A par-relative row of big tap targets: for hole par `P`, buttons `max(1, P-2) … P+4`, with **par visually highlighted**. (Par 3 → `1…7` so an ace is one tap; par 4 → `2…8`; par 5 → `3…9`.)
- A **"+"** button raises the pending number beyond `P+4` (up to the API max of 20) for blow-ups, without auto-advancing, so a big number can be dialed then confirmed.
- A **"Pick up"** button records the hole as picked up (sends `gross: 0`) — played, 0 points — and auto-advances.
- Tapping a concrete number **saves and auto-advances** to the next hole. Optimistic write + offline queue behavior is unchanged (the queue already carries an integer `gross`; `0` flows through).
- The hole grid still shows status per hole: blank = not played, a number = gross, **"PU"** = picked up.

### Board restyle — `src/screens/Board.tsx` (public, Ryder Cup look)
- **Top:** two solid team-colored bars — `GORSE  [cup]  —  [cup]  DRIFTWOOD` — echoing EUROPE 6–6 USA. Big cup numbers; leader bar emphasized.
- **Course-context header:** `ROUND n OF 6 · <COURSE> · PAR <p> · <DAY> <TEE TIME>` for the **live** round (from the schedule helper); shown muted/"UP NEXT" styling when no round is currently live.
- **Two-team column layout:** GORSE roster down the left, DRIFTWOOD down the right, a center **F / THRU** column — visually reading as team-vs-team like the reference board. Each player shows **today's result + THRU** and their **trip total**, team-colored, ★ on the trip leader, leaders highlighted. Sorted by trip result within each team.
- **Per-round cup strip:** six pills `R2…R7` colored by who won (or halved) each round (from `roundCups`); the finale pill marked `2×`.
- Reorder/score animations (framer-motion) preserved. TV mode (`?tv=1`) scales type and hides nav; **everything is visible without interaction** (the TV can't be tapped).
- Empty state (no scores yet) preserved, now showing the live/next round's course + tee time.

### Player drill-down — `src/screens/PlayerDetail.tsx` (phone; also works for public viewers)
- Tapping a board row opens a panel for that player: name, team, full + playing handicap, quota, **round-by-round results** (from `perRound`), and the **current round's hole-by-hole scorecard** with gross, strokes received, net, and Stableford points per hole (picked-up holes show "PU"/0). Hole/par/SI come from `GET /api/round/:id` (now public); net + points are computed client-side by reusing the pure `holePoints` / `strokesReceived` functions already in the bundle.

### Home — `src/screens/Home.tsx`
- Replace "Today's Tee Times" with **"Up Next"**: the live round (if one is in its window) and the next upcoming round, each showing course, date/time, and — when a player is logged in — **their group**. Before the trip, shows the first round; after the finale, shows "Trip complete" with the final cup result. Uses the schedule helper.

### Data/client plumbing
- `src/api/client.ts` / types: leaderboard return type extended; GET calls work without a session (keep `credentials: "include"`, harmless).
- `src/state/useLeaderboard.ts`: unchanged polling; consumes the richer payload.
- `worker/db.ts`: `getRounds` returns `date`; `getCourses` already returns par + holes.

---

## New / changed files

**New**
- `migrations/0003_schedule_and_names.sql`
- `src/schedule.ts` + `test/scoring/schedule.test.ts`
- `src/ui/ScorePad.tsx`
- `src/screens/PlayerDetail.tsx`

**Changed**
- `src/scoring/round.ts`, `src/scoring/index.ts` (+ tests in `test/scoring/`)
- `worker/routes/{state,round,leaderboard,export}.ts` (auth), `worker/routes/round.ts` (gross 0 validation), `worker/db.ts` (rounds.date), `worker/routes/leaderboard.ts` (payload)
- `src/App.tsx` (public routing), `src/screens/Board.tsx`, `src/screens/Home.tsx`, `src/screens/ScoreEntry.tsx`
- `src/api/client.ts` (types)
- `src/ui/Stepper.tsx` — removed once `ScorePad` replaces it (or left unused and deleted)

---

## Testing

- **Scoring:** pick-up scoring (gross 0 → played, 0 points, counts toward proration); `perRound` map correctness; `roundCups` matches per-round winners; existing cases still green.
- **Schedule:** `classifyRounds` across before/live/gap/after, with injected `now`.
- **API (worker pool):** GET endpoints reachable without a session (200); `POST /api/score` still requires a session (401 without); `POST /api/score` accepts `gross: 0`; admin still 403 for players; leaderboard payload includes `perRound`, `roundCups`, `rounds`, `courses`.
- **Manual/browser smoke (final):** public board loads with no login; score entry tap-pad + pick-up writes and auto-advances; live round header + today/trip numbers + per-round strip render; tap-a-player drill-down shows the scorecard; home "Up Next" reflects the schedule.

---

## Risks / notes

- **Timezone:** live-round detection trusts the device clock; everyone is on-site in Pacific. A remote spectator in another timezone may see the "live" highlight off by hours, but all scores/standings remain correct. Acceptable.
- **`gross = 0` overload:** documented sentinel; the only place semantics differ is `roundResult` (and the "PU" display). Keep it centralized.
- **Public reads** broaden the surface, but the data is non-sensitive and writes/admin remain gated; the threat model is unchanged.
- Real handicaps + GORSE/DRIFTWOOD team split are still admin inputs (placeholders until entered). Sheep Ranch par/SI still flagged for on-site spot-check (`docs/scorecards.md`).
