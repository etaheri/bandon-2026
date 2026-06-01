# Spectator & Schedule Update — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public spectator access, real trip dates/names, schedule awareness, a Ryder-Cup-styled board with live/today/per-round detail and a player drill-down, and a tap-the-score entry flow with a pick-up button — to the already-built Bandon Cup core app.

**Architecture:** Extend the existing pure scoring engine (pick-ups + per-round breakdown), add a pure device-local schedule helper, open all GET API routes to the public while keeping writes gated, and rebuild the score-entry and board UIs. All scoring stays server-authoritative; the client only renders and (for the drill-down scorecard) reuses the pure scoring functions already in the bundle.

**Tech Stack:** Existing — Vite 8 + React 19 + TypeScript (strict, `noUncheckedIndexedAccess`), Hono on a Cloudflare Worker, D1, Vitest (projects: `scoring`=node, `worker`=workers pool), framer-motion.

**Spec:** `docs/superpowers/specs/2026-05-31-spectator-schedule-update-design.md` — read it first.

**Conventions in this codebase (follow them):**
- Strict TS: array indexing and `.find()` results are possibly-undefined; guard with `?.`/non-null where provably safe.
- Scoring tests: `npx vitest run --project scoring`. Worker tests: `npx vitest run --project worker`. Both: `npx vitest run`.
- The pure `src/scoring/` modules must NOT use `Date.now()`/`new Date()` (resume-safety + purity). The new `src/schedule.ts` takes `now` as a parameter for the same reason.
- **Local only** — never run cloud wrangler commands (`d1 create`, `kv ... create`, `deploy`, `--remote`). Migrations: `npm run db:migrate:local`.

---

## File Structure

```
migrations/0003_schedule_and_names.sql   # NEW: date column, full names, delete r1
src/scoring/types.ts                      # MODIFY: Round gains `date`
src/scoring/round.ts                      # MODIFY: gross===0 = picked up (played, 0 pts)
src/scoring/index.ts                      # MODIFY: perRound per player, roundCups, rounds/courses/allowance passthrough
src/schedule.ts                           # NEW: pure device-local schedule classification
worker/db.ts                              # MODIFY: getRounds selects `date`
worker/routes/state.ts                    # MODIFY: public (drop requireSession)
worker/routes/round.ts                    # MODIFY: GET public, POST stays gated, accept gross 0
worker/routes/leaderboard.ts              # MODIFY: public; pass allowance into computeLeaderboard already done
src/App.tsx                               # MODIFY: board/home/tee public; score/admin gated
src/ui/ScorePad.tsx                       # NEW: tap-the-score pad
src/screens/ScoreEntry.tsx                # MODIFY: ScorePad + pick-up + auto-advance + PU display
src/screens/Board.tsx                     # MODIFY: Ryder-Cup restyle + course header + today/trip + per-round strip + tap rows
src/screens/PlayerDetail.tsx              # NEW: drill-down panel
src/screens/Home.tsx                      # MODIFY: "Up Next" via schedule
src/ui/Stepper.tsx                        # DELETE after ScorePad replaces it
test/scoring/round.test.ts                # MODIFY: pick-up cases
test/scoring/leaderboard.test.ts          # MODIFY: perRound + roundCups
test/scoring/schedule.test.ts             # NEW
test/worker/*.test.ts                     # MODIFY/ADD: public reads, gross 0, payload fields
```

---

## Phase A — Data & types foundation

### Task A1: Migration 0003 + Round.date

**Files:**
- Create: `migrations/0003_schedule_and_names.sql`
- Modify: `src/scoring/types.ts`, `worker/db.ts`

- [ ] **Step 1: Write `migrations/0003_schedule_and_names.sql`**

```sql
ALTER TABLE rounds ADD COLUMN date TEXT;

UPDATE players SET name = 'Erik Taheri'     WHERE id = 'taheri';
UPDATE players SET name = 'Pete DeSabio'    WHERE id = 'desabio';
UPDATE players SET name = 'Matt LaFlair'    WHERE id = 'laflair';
UPDATE players SET name = 'Bruce Stenzel'   WHERE id = 'stenzel';
UPDATE players SET name = 'Ryan Meissner'   WHERE id = 'meissner';
UPDATE players SET name = 'Jeff Grattan'    WHERE id = 'grattan';
UPDATE players SET name = 'Gavin Sloan'     WHERE id = 'sloan';
UPDATE players SET name = 'Anthony Johnson' WHERE id = 'johnson';

UPDATE rounds SET date = '2026-06-04' WHERE id IN ('r2','r3');
UPDATE rounds SET date = '2026-06-05' WHERE id IN ('r4','r5');
UPDATE rounds SET date = '2026-06-06' WHERE id IN ('r6','r7');

DELETE FROM scores WHERE round_id = 'r1';
DELETE FROM tee_assignments WHERE round_id = 'r1';
DELETE FROM rounds WHERE id = 'r1';
```

- [ ] **Step 2: Apply locally and verify**

Run:
```bash
npm run db:migrate:local
npx wrangler d1 execute bandon-cup --local --command "SELECT id,day,date,double_points FROM rounds ORDER BY id;"
npx wrangler d1 execute bandon-cup --local --command "SELECT id,name FROM players ORDER BY id;"
```
Expected: 6 rounds r2–r7 (no r1), r2/r3 date 2026-06-04, r4/r5 2026-06-05, r6/r7 2026-06-06, r7 double_points=1; players show full names.

- [ ] **Step 3: Add `date` to the `Round` type** in `src/scoring/types.ts`

Replace the `Round` interface with:
```ts
export interface Round { id: string; courseId: string; label: string; day: string; date: string; teeTime: string; counts: boolean; doublePoints: boolean; }
```

- [ ] **Step 4: Select `date` in `getRounds`** in `worker/db.ts`

Replace the `getRounds` body's SQL + mapping:
```ts
export async function getRounds(db: D1Database): Promise<Round[]> {
  const { results } = await db
    .prepare(
      "SELECT id,course_id,label,day,date,tee_time,counts,double_points FROM rounds ORDER BY id",
    )
    .all<any>();
  return results.map((r) => ({
    id: r.id,
    courseId: r.course_id,
    label: r.label,
    day: r.day,
    date: r.date ?? "",
    teeTime: r.tee_time,
    counts: !!r.counts,
    doublePoints: !!r.double_points,
  }));
}
```

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` → clean.
```bash
git add migrations/0003_schedule_and_names.sql src/scoring/types.ts worker/db.ts
git commit -m "feat(data): real dates + full names, delete r1 warm-up, Round.date"
```

---

## Phase B — Scoring engine: pick-ups + per-round breakdown (TDD)

### Task B1: Pick-up scoring in `roundResult`

**Files:**
- Modify: `src/scoring/round.ts`
- Test: `test/scoring/round.test.ts`

- [ ] **Step 1: Add failing tests** — append to `test/scoring/round.test.ts` inside the `describe("roundResult", ...)` block:

```ts
  it("treats gross 0 as a pick-up: played, zero points, counts toward proration", () => {
    // 1 hole, gross 0 -> played, 0 points. prorated quota = 36 * 1/18 = 2.
    const r = roundResult(player, holes, { 1: 0 }, { allowance: 0.75 });
    expect(r.holesPlayed).toBe(1);
    expect(r.points).toBe(0);
    expect(r.proratedQuota).toBeCloseTo(2);
    expect(r.result).toBeCloseTo(-2);
  });

  it("distinguishes pick-up (0) from not-played (null)", () => {
    const r = roundResult(player, holes, { 1: 0, 2: null }, { allowance: 0.75 });
    expect(r.holesPlayed).toBe(1); // only the picked-up hole counts as played
  });
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run --project scoring test/scoring/round.test.ts`
Expected: FAIL (gross 0 currently flows into `holePoints`, producing nonzero points).

- [ ] **Step 3: Implement the pick-up branch** in `src/scoring/round.ts`

Replace the loop body:
```ts
  for (const hole of holes) {
    const gross = scores[hole.number];
    if (gross == null) continue;      // not played yet
    holesPlayed++;
    if (gross === 0) continue;        // picked up: played, 0 points
    points += holePoints({ gross, par: hole.par, strokes: strokesReceived(phc, hole.strokeIndex) });
  }
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run --project scoring test/scoring/round.test.ts` → PASS (including the existing cases).

- [ ] **Step 5: Commit**

```bash
git add src/scoring/round.ts test/scoring/round.test.ts
git commit -m "feat(scoring): pick-up (gross 0) scores 0 but counts as played"
```

### Task B2: `computeLeaderboard` — perRound, roundCups, metadata passthrough

**Files:**
- Modify: `src/scoring/index.ts`
- Test: `test/scoring/leaderboard.test.ts`

- [ ] **Step 1: Add failing tests** — append to `test/scoring/leaderboard.test.ts` inside the `describe("computeLeaderboard", ...)` block. (The existing test sets up `players`, `rounds`, `courses`, `scoresByRound` with g1 thru F and d1 thru 1.)

```ts
  it("exposes per-player per-round results, roundCups, and metadata", () => {
    const scoresByRound = { r2: { g1: Object.fromEntries(holes.map(h => [h.number, 4])), d1: { 1: 5 } } };
    const lb = computeLeaderboard({ players, rounds, courses, scoresByRound, allowance: 1 });

    // per-round map present for each player, keyed by round id
    const g1 = lb.players.find(p => p.playerId === "g1")!;
    expect(g1.perRound.r2).toBeDefined();
    expect(g1.perRound.r2.thru).toBe("F");
    const d1 = lb.players.find(p => p.playerId === "d1")!;
    expect(d1.perRound.r2.thru).toBe(1);

    // roundCups: one entry per counting round, with the round id
    expect(lb.roundCups.length).toBe(1);
    expect(lb.roundCups[0].roundId).toBe("r2");

    // metadata passthrough for the public board
    expect(lb.rounds.find(r => r.id === "r2")).toBeDefined();
    expect(lb.courses.find(c => c.id === "c")).toBeDefined();
    expect(typeof lb.allowance).toBe("number");
  });
```
> Note: the existing test's `rounds` entries now need a `date` field to satisfy the `Round` type — add `date: "2026-06-04"` to each `Round` literal in this test file's setup (and any other scoring test that constructs a `Round`). Do this in Step 3 if tsc complains.

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run --project scoring test/scoring/leaderboard.test.ts`
Expected: FAIL (`perRound`, `roundCups`, `rounds`, `courses`, `allowance` undefined).

- [ ] **Step 3: Rewrite `src/scoring/index.ts`**

```ts
import type { Player, Round, Course, ScoreMap, Team, PlayerRoundResult } from "./types";
import { roundResult } from "./round";
import { cupPointsForRound, tallyCup, clinchState } from "./cup";
import { playerOfTheTrip, dailyLowRounds } from "./crowns";

export * from "./types";
export { roundResult } from "./round";
export { strokesReceived, playingHandicap } from "./strokes";
export { holePoints } from "./stableford";

export interface LeaderboardInput {
  players: Player[];
  rounds: Round[];
  courses: Record<string, Course>;
  scoresByRound: Record<string, Record<string, ScoreMap>>; // roundId -> playerId -> ScoreMap
  allowance: number;
}

export interface PerRoundCell { result: number; points: number; thru: number | "F"; holesPlayed: number; }
export interface RoundCupResult { roundId: string; gorse: number; driftwood: number; double: boolean; decided: boolean; }

export function computeLeaderboard(input: LeaderboardInput) {
  const { players, rounds, courses, scoresByRound, allowance } = input;
  const countingRounds = rounds.filter(r => r.counts);

  const roundCups: RoundCupResult[] = [];
  const dayResults: { playerId: string; day: string; result: number }[] = [];
  const liveByPlayer = new Map<string, { result: number; thru: number | "F" }>();
  const perRoundByPlayer = new Map<string, Record<string, PerRoundCell>>();

  for (const round of countingRounds) {
    const course = courses[round.courseId];
    if (!course) continue;
    const holes = course.holes;
    const scores = scoresByRound[round.id] ?? {};
    let gorse = 0, driftwood = 0, anyPlayed = false, allDone = true;
    for (const p of players) {
      const rr: PlayerRoundResult = roundResult(p, holes, scores[p.id] ?? {}, { allowance });
      if (rr.holesPlayed > 0) anyPlayed = true;
      if (rr.thru !== "F") allDone = false;
      if (p.team === "GORSE") gorse += rr.result; else driftwood += rr.result;
      if (rr.holesPlayed > 0) dayResults.push({ playerId: p.id, day: round.day, result: rr.result });

      const agg = liveByPlayer.get(p.id) ?? { result: 0, thru: "F" as number | "F" };
      agg.result += rr.result;
      if (rr.thru !== "F" && rr.holesPlayed > 0) agg.thru = rr.thru;
      liveByPlayer.set(p.id, agg);

      const pr = perRoundByPlayer.get(p.id) ?? {};
      pr[round.id] = { result: round1(rr.result), points: rr.points, thru: rr.thru, holesPlayed: rr.holesPlayed };
      perRoundByPlayer.set(p.id, pr);
    }
    const split = cupPointsForRound(gorse, driftwood, round.doublePoints);
    roundCups.push({ roundId: round.id, gorse: split.gorse, driftwood: split.driftwood, double: round.doublePoints, decided: anyPlayed && allDone });
  }

  const cup = tallyCup(roundCups);
  const clinch = clinchState(cup.gorse, cup.driftwood, cup.available);
  const pot = playerOfTheTrip(dayResults);
  const lows = dailyLowRounds(dayResults);

  const teamAgg: Record<Team, number> = { GORSE: 0, DRIFTWOOD: 0 };
  const playerRows = players.map(p => {
    const agg = liveByPlayer.get(p.id) ?? { result: 0, thru: "F" as number | "F" };
    teamAgg[p.team] += agg.result;
    return {
      playerId: p.id, name: p.name, team: p.team,
      handicap: p.handicap, quotaOverride: p.quotaOverride,
      result: round1(agg.result), thru: agg.thru,
      perRound: perRoundByPlayer.get(p.id) ?? {},
    };
  }).sort((a, b) => b.result - a.result);

  const leader: Team = teamAgg.GORSE >= teamAgg.DRIFTWOOD ? "GORSE" : "DRIFTWOOD";
  const topIndividual = playerRows[0]?.playerId ?? null;

  return {
    cup: { gorse: cup.gorse, driftwood: cup.driftwood, available: cup.available },
    clinch,
    teamAggregate: { GORSE: round1(teamAgg.GORSE), DRIFTWOOD: round1(teamAgg.DRIFTWOOD) },
    leader,
    players: playerRows,
    crowns: { playerOfTheTrip: pot, dailyLow: lows, topIndividual },
    roundCups,
    allowance,
    rounds: countingRounds.map(r => ({
      id: r.id, label: r.label, day: r.day, date: r.date, teeTime: r.teeTime,
      courseId: r.courseId, counts: r.counts, doublePoints: r.doublePoints,
    })),
    courses: Object.values(courses).map(c => ({ id: c.id, name: c.name, par: c.par })),
  };
}

function round1(n: number) { return Math.round(n * 10) / 10; }
```
> `tallyCup`/`clinchState` accept the round-cup objects positionally — `tallyCup` reads `.gorse/.driftwood/.double/.decided`, which `RoundCupResult` still has (plus an extra `roundId`, ignored). No change needed to `cup.ts`.

- [ ] **Step 4: Fix any `Round` literals in scoring tests** to include `date` (Step 1 note). Run: `npx vitest run --project scoring` and `npx tsc --noEmit`.
Expected: all scoring tests PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/scoring/index.ts test/scoring/leaderboard.test.ts
git commit -m "feat(scoring): per-round breakdown, roundCups, board metadata in leaderboard"
```

---

## Phase C — Schedule module (TDD)

### Task C1: `src/schedule.ts`

**Files:**
- Create: `src/schedule.ts`
- Test: `test/scoring/schedule.test.ts`

- [ ] **Step 1: Write the failing test** `test/scoring/schedule.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { roundStart, classifyRounds, liveRound, nextUpcoming } from "../../src/schedule";
import type { Round } from "../../src/scoring/types";

const R = (id: string, date: string, teeTime: string): Round =>
  ({ id, courseId: "c", label: id.toUpperCase(), day: "THU", date, teeTime, counts: true, doublePoints: false });

const rounds: Round[] = [
  R("r2", "2026-06-04", "7:30 AM"),
  R("r3", "2026-06-04", "2:00 PM"),
  R("r4", "2026-06-05", "9:30 AM"),
];

describe("roundStart", () => {
  it("parses date + tee time into a local Date", () => {
    const d = roundStart(R("x", "2026-06-04", "2:00 PM"));
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // June = 5
    expect(d.getDate()).toBe(4);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(0);
  });
  it("parses AM and noon-area times", () => {
    expect(roundStart(R("x", "2026-06-04", "7:30 AM")).getHours()).toBe(7);
    expect(roundStart(R("x", "2026-06-04", "12:10 PM")).getHours()).toBe(12);
  });
});

describe("classifyRounds", () => {
  const at = (s: string) => new Date(s);
  it("before the trip: none live, all upcoming", () => {
    const c = classifyRounds(rounds, at("2026-06-04T06:00:00"));
    expect(c.map(x => x.status)).toEqual(["UPCOMING", "UPCOMING", "UPCOMING"]);
    expect(liveRound(rounds, at("2026-06-04T06:00:00"))).toBeNull();
    expect(nextUpcoming(rounds, at("2026-06-04T06:00:00"))?.id).toBe("r2");
  });
  it("mid-morning: that round is live", () => {
    const c = classifyRounds(rounds, at("2026-06-04T09:00:00"));
    expect(c.find(x => x.roundId === "r2")!.status).toBe("LIVE");
    expect(c.find(x => x.roundId === "r3")!.status).toBe("UPCOMING");
    expect(liveRound(rounds, at("2026-06-04T09:00:00"))?.id).toBe("r2");
  });
  it("gap between rounds: the morning round stays live until the afternoon starts", () => {
    expect(liveRound(rounds, at("2026-06-04T13:00:00"))?.id).toBe("r2");
    expect(liveRound(rounds, at("2026-06-04T14:30:00"))?.id).toBe("r3");
  });
  it("after the last round: it is live until... it's the last, so stays live; next day before tee, last is COMPLETED only once a later round starts", () => {
    // r4 is last; once now >= r4 start, r4 LIVE (no later round). r2,r3 COMPLETED.
    const c = classifyRounds(rounds, at("2026-06-05T10:00:00"));
    expect(c.find(x => x.roundId === "r2")!.status).toBe("COMPLETED");
    expect(c.find(x => x.roundId === "r3")!.status).toBe("COMPLETED");
    expect(c.find(x => x.roundId === "r4")!.status).toBe("LIVE");
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run --project scoring test/scoring/schedule.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `src/schedule.ts`**

```ts
import type { Round } from "./scoring/types";

export type RoundStatus = "COMPLETED" | "LIVE" | "UPCOMING";

/** Parse a round's `date` (YYYY-MM-DD) + `teeTime` ("7:30 AM") into a device-local Date. */
export function roundStart(round: Round): Date {
  const [y, m, d] = round.date.split("-").map(Number);
  const match = round.teeTime.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  let h = 12, min = 0;
  if (match) {
    h = Number(match[1]) % 12;
    min = Number(match[2]);
    if (/pm/i.test(match[3]!)) h += 12;
  }
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, h, min);
}

/** Counting rounds, sorted by start, each classified vs `now`. */
export function classifyRounds(rounds: Round[], now: Date): { roundId: string; status: RoundStatus }[] {
  const sorted = rounds.filter(r => r.counts && r.date).sort((a, b) => roundStart(a).getTime() - roundStart(b).getTime());
  const nowMs = now.getTime();
  return sorted.map((r, i) => {
    const start = roundStart(r).getTime();
    const nextStart = i + 1 < sorted.length ? roundStart(sorted[i + 1]!).getTime() : Infinity;
    let status: RoundStatus;
    if (start > nowMs) status = "UPCOMING";
    else if (nowMs < nextStart) status = "LIVE"; // started, and the next one hasn't
    else status = "COMPLETED";
    return { roundId: r.id, status };
  });
}

export function liveRound(rounds: Round[], now: Date): Round | null {
  const live = classifyRounds(rounds, now).find(x => x.status === "LIVE");
  return live ? rounds.find(r => r.id === live.roundId) ?? null : null;
}

export function nextUpcoming(rounds: Round[], now: Date): Round | null {
  const up = classifyRounds(rounds, now).find(x => x.status === "UPCOMING");
  return up ? rounds.find(r => r.id === up.roundId) ?? null : null;
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run --project scoring test/scoring/schedule.test.ts` → PASS. Then `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/schedule.ts test/scoring/schedule.test.ts
git commit -m "feat(schedule): device-local round classification (live/upcoming/completed)"
```

---

## Phase D — API: public reads + gross 0 (TDD)

### Task D1: Open GET routes, keep writes gated, accept pick-ups

**Files:**
- Modify: `worker/routes/state.ts`, `worker/routes/round.ts`, `worker/routes/leaderboard.ts`
- Test: `test/worker/round.test.ts`, `test/worker/state.test.ts`, `test/worker/leaderboard.test.ts`

- [ ] **Step 1: Add failing tests**

In `test/worker/state.test.ts`, change the "requires auth" expectation — state is now public:
```ts
  it("is public (no auth needed) and returns players", async () => {
    const res = await SELF.fetch("https://x/api/state");
    expect(res.status).toBe(200);
    const body = await res.json<any>();
    expect(body.players.length).toBe(8);
  });
```
In `test/worker/round.test.ts`, add:
```ts
  it("GET /api/round/:id is public", async () => {
    const res = await SELF.fetch("https://x/api/round/r2");
    expect(res.status).toBe(200);
  });
  it("POST /api/score still requires a session", async () => {
    const res = await SELF.fetch("https://x/api/score", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ roundId: "r2", playerId: "taheri", hole: 1, gross: 4, updatedAt: 1 }) });
    expect(res.status).toBe(401);
  });
  it("accepts a pick-up (gross 0) with a session", async () => {
    const cookie = await authCookie();
    const res = await SELF.fetch("https://x/api/score", { method: "POST", headers: { Cookie: cookie, "content-type": "application/json" },
      body: JSON.stringify({ roundId: "r2", playerId: "taheri", hole: 5, gross: 0, updatedAt: 9999 }) });
    expect(res.status).toBe(200);
    const row = await env.DB.prepare("SELECT gross FROM scores WHERE round_id='r2' AND player_id='taheri' AND hole=5").first<any>();
    expect(row.gross).toBe(0);
  });
```
In `test/worker/leaderboard.test.ts`, change to assert public + new fields:
```ts
  it("is public and includes perRound, roundCups, rounds, courses", async () => {
    const res = await SELF.fetch("https://x/api/leaderboard");
    expect(res.status).toBe(200);
    const b = await res.json<any>();
    expect(b.players[0]).toHaveProperty("perRound");
    expect(b).toHaveProperty("roundCups");
    expect(b).toHaveProperty("rounds");
    expect(b).toHaveProperty("courses");
    expect(typeof b.allowance).toBe("number");
  });
```
> Keep imports these files already have (`env`, `SELF`, `authCookie`). If `authCookie` isn't imported in `round.test.ts`/`leaderboard.test.ts`, add `import { authCookie } from "./helpers";` and `import { env } from "cloudflare:test";` as needed.

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run --project worker` → FAIL (state/round/leaderboard still 401 without cookie; gross 0 rejected; missing fields).

- [ ] **Step 3: Make GET routes public**

`worker/routes/state.ts` — remove `requireSession`:
```ts
import { Hono } from "hono";
import type { Env } from "../types";
import { getPlayers, getRounds, getTeeAssignments, getSettings, getCourses } from "../db";

export const stateRoutes = new Hono<{ Bindings: Env; Variables: { role: string } }>();

stateRoutes.get("/state", async (c) => {
  const [players, rounds, tee, settings, courses] = await Promise.all([
    getPlayers(c.env.DB), getRounds(c.env.DB), getTeeAssignments(c.env.DB), getSettings(c.env.DB), getCourses(c.env.DB),
  ]);
  const courseMeta = Object.values(courses).map(({ id, name, par }) => ({ id, name, par }));
  return c.json({ players, rounds, teeAssignments: tee, settings, courses: courseMeta });
});
```

`worker/routes/leaderboard.ts` — remove `requireSession` from the GET (drop the middleware arg and the import):
```ts
import { Hono } from "hono";
import type { Env } from "../types";
import { computeLeaderboard } from "../../src/scoring";
import { getPlayers, getRounds, getCourses, getScoresByRound, getSettings } from "../db";

export const leaderboardRoutes = new Hono<{ Bindings: Env; Variables: { role: string } }>();

leaderboardRoutes.get("/leaderboard", async (c) => {
  const [players, rounds, courses, scoresByRound, settings] = await Promise.all([
    getPlayers(c.env.DB), getRounds(c.env.DB), getCourses(c.env.DB), getScoresByRound(c.env.DB), getSettings(c.env.DB),
  ]);
  const allowance = parseFloat(settings.allowance ?? "0.75");
  return c.json(computeLeaderboard({ players, rounds, courses, scoresByRound, allowance }));
});
```

`worker/routes/round.ts` — make GET public (remove `requireSession` from the GET only), keep it on POST, and accept gross 0:
```ts
import { Hono } from "hono";
import type { Env } from "../types";
import { requireSession } from "../auth";
import { getCourses, getRounds, getRoundScores, upsertScore } from "../db";

export const roundRoutes = new Hono<{ Bindings: Env; Variables: { role: string } }>();

roundRoutes.get("/round/:id", async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "no such round" }, 404);
  const [rounds, courses, scores] = await Promise.all([getRounds(c.env.DB), getCourses(c.env.DB), getRoundScores(c.env.DB, id)]);
  const round = rounds.find((r) => r.id === id);
  if (!round) return c.json({ error: "no such round" }, 404);
  const course = courses[round.courseId];
  if (!course) return c.json({ error: "course not found" }, 500);
  return c.json({ round, holes: course.holes, scores });
});

roundRoutes.post("/score", requireSession, async (c) => {
  const b = await c.req.json<{ roundId: string; playerId: string; hole: number; gross: number | null; updatedAt: number }>();
  if (!b.roundId || !b.playerId || typeof b.hole !== "number" || b.hole < 1 || b.hole > 18)
    return c.json({ error: "bad score" }, 400);
  if (b.gross != null && (b.gross < 0 || b.gross > 20))
    return c.json({ error: "gross out of range" }, 400);
  const applied = await upsertScore(c.env.DB, b);
  return c.json({ ok: true, applied });
});
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run --project worker` → all PASS. Then `npx vitest run` (both) and `npx tsc --noEmit`.
Expected: green; tsc clean. (The admin test still expects 403 for players — unchanged.)

- [ ] **Step 5: Commit**

```bash
git add worker/routes/state.ts worker/routes/leaderboard.ts worker/routes/round.ts test/worker
git commit -m "feat(api): public read endpoints; accept pick-up (gross 0)"
```

---

## Phase E — Frontend: public routing

### Task E1: Open board/home/tee; gate score/admin

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Rewrite the routing/gate in `src/App.tsx`**

```tsx
import { useState, useEffect } from "react";
import { themeCss } from "./ui/theme";
import { isAuthed, getPlayerId } from "./state/session";
import { Login } from "./screens/Login";
import { Home } from "./screens/Home";
import { ScoreEntry } from "./screens/ScoreEntry";
import { TeeSheet } from "./screens/TeeSheet";
import { Board } from "./screens/Board";
import { Admin } from "./screens/Admin";

export function App() {
  const [, force] = useState(0);
  const path = window.location.pathname;
  const tv = new URLSearchParams(window.location.search).get("tv") === "1";

  useEffect(() => {
    const s = document.createElement("style"); s.textContent = themeCss; document.head.appendChild(s);
  }, []);

  // Public, no login: board (incl. TV), tee sheet, home.
  if (path.startsWith("/board")) return <Board tv={tv} />;
  if (path.startsWith("/tee")) return <TeeSheet />;

  // Login required only to enter scores or admin.
  if (path.startsWith("/score") || path.startsWith("/admin")) {
    if (!isAuthed() || !getPlayerId()) return <Login onDone={() => force(n => n + 1)} />;
    return path.startsWith("/score") ? <ScoreEntry /> : <Admin />;
  }

  return <Home />; // public
}

export const go = (p: string) => { window.history.pushState({}, "", p); window.dispatchEvent(new PopStateEvent("popstate")); };
```

- [ ] **Step 2: Verify build + existing tests**

Run: `npx tsc --noEmit` → clean. `npx vitest run` → unchanged passing. `npm run build` → succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(ui): public board/home/tee; gate score + admin behind login"
```

---

## Phase F — Score entry: tap-the-score + pick-up

### Task F1: `ScorePad` + ScoreEntry rework

**Files:**
- Create: `src/ui/ScorePad.tsx`
- Modify: `src/screens/ScoreEntry.tsx`
- Delete: `src/ui/Stepper.tsx`

- [ ] **Step 1: Write `src/ui/ScorePad.tsx`**

```tsx
import { useState } from "react";

/** Par-relative tap pad. Tapping a number commits it (parent auto-advances). "+" reveals higher numbers. */
export function ScorePad({ par, value, onSelect }: { par: number; value: number | null; onSelect: (gross: number) => void }) {
  const [extra, setExtra] = useState(0);
  const lo = Math.max(1, par - 2);
  const hi = Math.min(20, par + 4 + extra);
  const nums: number[] = [];
  for (let n = lo; n <= hi; n++) nums.push(n);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {nums.map(n => {
          const isPar = n === par;
          const selected = value === n;
          return (
            <button key={n} onClick={() => onSelect(n)} aria-label={`score ${n}`}
              style={{
                fontFamily: "inherit", fontWeight: 900, fontSize: 28, padding: "18px 0", borderRadius: 12, border: "none",
                color: selected ? "#1a1205" : "#fff",
                background: selected ? "var(--gold)" : isPar ? "#1f3b34" : "#13231f",
                boxShadow: "var(--bevel)", outline: isPar && !selected ? "2px solid var(--gold)" : "none",
              }}>
              {n}{isPar ? <div style={{ fontSize: 10, opacity: .7 }}>PAR</div> : null}
            </button>
          );
        })}
        {hi < 20 && (
          <button onClick={() => setExtra(e => e + 4)} aria-label="higher scores"
            style={{ fontFamily: "inherit", fontWeight: 900, fontSize: 28, padding: "18px 0", borderRadius: 12, border: "none",
              color: "#fff", background: "#0f1a17", boxShadow: "var(--bevel)" }}>+</button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `src/screens/ScoreEntry.tsx`** to use ScorePad + pick-up + auto-advance

```tsx
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { getPlayerId } from "../state/session";
import { ScorePad } from "../ui/ScorePad";
import { enqueue } from "../offline/queue";
import { flushQueue, startAutoSync } from "../offline/sync";
import { go } from "../App";

function currentRoundId() {
  return new URLSearchParams(location.search).get("round") ?? "r2";
}

export function ScoreEntry() {
  const me = getPlayerId()!;
  const roundId = currentRoundId();
  const [data, setData] = useState<any>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [hole, setHole] = useState(1);
  const [scores, setScores] = useState<Record<number, number | null>>({});

  useEffect(() => { startAutoSync(); }, []);
  useEffect(() => {
    api.round(roundId).then(r => {
      setData(r); setLoadFailed(false);
      const mine: Record<number, number | null> = {};
      for (const s of r.scores) if (s.player_id === me) mine[s.hole] = s.gross;
      setScores(mine);
    }).catch(() => setLoadFailed(true));
  }, [roundId]);

  if (!data && loadFailed) return <div style={{ padding: 24 }}>Offline — scores will save and sync when you're back online.</div>;
  if (!data) return <div style={{ padding: 24 }}>Loading…</div>;
  const h = data.holes.find((x: any) => x.number === hole);

  async function save(gross: number, advance = true) {
    setScores(s => ({ ...s, [hole]: gross }));                 // optimistic
    await enqueue({ roundId, playerId: me, hole, gross, updatedAt: Date.now() });
    flushQueue();
    if (advance && hole < 18) setHole(hole + 1);
  }

  const cellLabel = (n: number) => {
    const v = scores[n];
    return v == null ? n : v === 0 ? "PU" : v;
  };

  return (
    <div style={{ padding: 20, display: "grid", gap: 18 }}>
      <div className="head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button className="btn" onClick={() => go("/")}>‹</button>
        <span>{data.round.label} · Hole {hole}</span>
        <span>Par {h.par}</span>
      </div>

      <ScorePad key={hole} par={h.par} value={scores[hole] ?? null} onSelect={(g) => save(g)} />

      <div style={{ display: "flex", gap: 12 }}>
        <button className="btn" style={{ flex: 1, background: "linear-gradient(180deg,#3a3a3a,#222)", color: "#fff" }}
          onClick={() => save(0)}>Pick Up</button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <button className="btn" disabled={hole <= 1} onClick={() => setHole(hole - 1)}>Prev</button>
        <button className="btn" disabled={hole >= 18} onClick={() => setHole(hole + 1)}>Next</button>
      </div>

      <div className="panel" style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(9,1fr)", gap: 6 }}>
        {data.holes.map((x: any) => (
          <button key={x.number} onClick={() => setHole(x.number)}
            style={{ padding: 8, borderRadius: 6, border: "none", fontWeight: 900,
              background: x.number === hole ? "var(--gold)" : scores[x.number] != null ? "#1f3b34" : "#13231f",
              color: x.number === hole ? "#1a1205" : "#fff" }}>
            {cellLabel(x.number)}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Delete `src/ui/Stepper.tsx`**

Run: `git rm src/ui/Stepper.tsx`. Confirm nothing else imports it: `grep -rn "Stepper" src` returns nothing.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` → clean. `npm run build` → succeeds. `npx vitest run` → unchanged passing.

- [ ] **Step 5: Commit**

```bash
git add src/ui/ScorePad.tsx src/screens/ScoreEntry.tsx
git commit -m "feat(score): tap-the-score pad + pick-up + auto-advance"
```

---

## Phase G — Board restyle + drill-down

### Task G1: Ryder-Cup board with course header, today/trip, per-round strip

**Files:**
- Modify: `src/screens/Board.tsx`

- [ ] **Step 1: Rewrite `src/screens/Board.tsx`**

```tsx
import { useState } from "react";
import { motion } from "framer-motion";
import { useLeaderboard } from "../state/useLeaderboard";
import { liveRound, classifyRounds } from "../schedule";
import { go } from "../App";
import { PlayerDetail } from "./PlayerDetail";

export function Board({ tv }: { tv: boolean }) {
  const lb = useLeaderboard(tv ? 15000 : 20000);
  const [selected, setSelected] = useState<string | null>(null);
  if (!lb) return <div style={{ padding: 24 }}>Loading board…</div>;

  const scale = tv ? 1.6 : 1;
  const roundsMeta: any[] = Array.isArray(lb.rounds) ? lb.rounds : [];
  const courses: any[] = Array.isArray(lb.courses) ? lb.courses : [];
  const now = new Date();
  const live = roundsMeta.length ? liveRound(roundsMeta as any, now) : null;
  const liveId: string | null = live?.id ?? null;
  const countIndex = liveId ? roundsMeta.findIndex(r => r.id === liveId) + 1 : 0;
  const liveCourse = live ? courses.find(c => c.id === live.courseId) : null;

  const players: any[] = Array.isArray(lb.players) ? lb.players : [];
  const gorse = players.filter(p => p.team === "GORSE");
  const drift = players.filter(p => p.team === "DRIFTWOOD");
  const leadGorse = lb.leader === "GORSE";

  return (
    <div style={{ minHeight: "100%", padding: tv ? 8 : 16 }}>
      {!tv && <button className="btn" onClick={() => go("/")} style={{ marginBottom: 12 }}>‹ Home</button>}

      {/* team totals */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "stretch", borderRadius: 14, overflow: "hidden", boxShadow: "var(--bevel)" }}>
        <TeamBar team="GORSE" cup={lb.cup.gorse} agg={lb.teamAggregate.GORSE} clinch={lb.clinch.gorse} lead={leadGorse} scale={scale} />
        <div className="head" style={{ padding: "0 12px", display: "grid", placeItems: "center", fontSize: 16 * scale, background: "#06120e" }}>CUP</div>
        <TeamBar team="DRIFTWOOD" cup={lb.cup.driftwood} agg={lb.teamAggregate.DRIFTWOOD} clinch={lb.clinch.driftwood} lead={!leadGorse} scale={scale} right />
      </div>

      {/* course context header */}
      <div className="head" style={{ textAlign: "center", margin: "10px 0", fontSize: 14 * scale,
        padding: "8px 10px", borderRadius: 8, background: live ? "linear-gradient(180deg,#1b3a31,#0c1c17)" : "transparent",
        boxShadow: live ? "var(--bevel)" : "none", opacity: live ? 1 : .7 }}>
        {live
          ? `● LIVE · ROUND ${countIndex} OF ${roundsMeta.length} · ${(liveCourse?.name ?? "").toUpperCase()} · PAR ${liveCourse?.par ?? ""} · ${live.day} ${live.teeTime}`
          : `${lb.cup.available > 0 ? "UP NEXT — see tee sheet" : "ALL DECIDED"} · first to 4 wins, 3.5 retains`}
      </div>

      {/* per-round cup strip */}
      <RoundStrip roundCups={lb.roundCups ?? []} roundsMeta={roundsMeta} scale={scale} />

      {/* two-team columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: tv ? 12 : 8, marginTop: 10 }}>
        <TeamColumn players={gorse} team="GORSE" liveId={liveId} topId={lb.crowns?.topIndividual} scale={scale} onTap={setSelected} />
        <TeamColumn players={drift} team="DRIFTWOOD" liveId={liveId} topId={lb.crowns?.topIndividual} scale={scale} onTap={setSelected} align="right" />
      </div>

      {selected && !tv && (
        <PlayerDetail playerId={selected} lb={lb} liveId={liveId} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function TeamBar({ team, cup, agg, clinch, lead, scale, right }: any) {
  const color = team === "GORSE" ? "var(--gorse)" : "var(--driftwood)";
  return (
    <div style={{ padding: 16, textAlign: right ? "right" : "left",
      background: lead ? color : `linear-gradient(${right ? "270deg" : "90deg"}, ${color}33, #0a1714)`,
      color: lead ? "#10231c" : "#fff" }}>
      <div className="head" style={{ fontSize: 20 * scale, color: lead ? "#10231c" : color }}>{team}</div>
      <div className="head" style={{ fontSize: 56 * scale, lineHeight: 1 }}>{cup}</div>
      <div style={{ opacity: .9, fontSize: 13 * scale }}>{agg >= 0 ? "+" : ""}{agg} to quota</div>
      <div className="head" style={{ marginTop: 4, fontSize: 11 * scale }}>{clinch}</div>
    </div>
  );
}

function RoundStrip({ roundCups, roundsMeta, scale }: any) {
  if (!Array.isArray(roundCups) || !roundCups.length) return null;
  const label = (rid: string) => {
    const idx = roundsMeta.findIndex((r: any) => r.id === rid);
    return idx >= 0 ? `R${idx + 1}` : rid.toUpperCase();
  };
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
      {roundCups.map((rc: any) => {
        const decided = rc.decided;
        const gWin = rc.gorse > rc.driftwood, dWin = rc.driftwood > rc.gorse;
        const bg = !decided ? "#13231f" : gWin ? "var(--gorse)" : dWin ? "var(--driftwood)"
          : "linear-gradient(90deg,var(--gorse) 50%, var(--driftwood) 50%)";
        return (
          <div key={rc.roundId} className="head" title={decided ? "" : "in progress"}
            style={{ minWidth: 44 * scale, textAlign: "center", padding: "4px 8px", borderRadius: 999, fontSize: 11 * scale,
              background: bg, color: decided ? "#10231c" : "#9fb3ab", boxShadow: "var(--bevel)", opacity: decided ? 1 : .8 }}>
            {label(rc.roundId)}{rc.double ? " 2×" : ""}
          </div>
        );
      })}
    </div>
  );
}

function TeamColumn({ players, team, liveId, topId, scale, onTap, align }: any) {
  const color = team === "GORSE" ? "var(--gorse)" : "var(--driftwood)";
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {players.map((p: any) => {
        const today = liveId ? p.perRound?.[liveId] : null;
        const thru = today ? (today.thru === "F" ? "F" : `THRU ${today.thru}`) : "—";
        return (
          <motion.div layout key={p.playerId} onClick={() => onTap(p.playerId)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: "spring", stiffness: 500, damping: 40 }}
            style={{ display: "grid", gridTemplateColumns: align === "right" ? "auto 1fr 6px" : "6px 1fr auto",
              alignItems: "center", gap: 8, padding: tv2(scale), borderRadius: 8, background: "#0f1a17",
              boxShadow: "var(--bevel)", cursor: "pointer", textAlign: align === "right" ? "right" : "left" }}>
            {align !== "right" && <div style={{ width: 6, height: "100%", background: color, borderRadius: 3 }} />}
            {align === "right" && <Stat today={today} scale={scale} trip={p.result} thru={thru} right />}
            <div className="head" style={{ fontSize: 14 * scale, order: align === "right" ? 2 : 0 }}>
              {p.playerId === topId ? "★ " : ""}{p.name}
            </div>
            {align !== "right" && <Stat today={today} scale={scale} trip={p.result} thru={thru} />}
            {align === "right" && <div style={{ width: 6, height: "100%", background: color, borderRadius: 3 }} />}
          </motion.div>
        );
      })}
    </div>
  );
}

function Stat({ today, trip, thru, scale, right }: any) {
  const todayVal = today ? today.result : null;
  return (
    <div style={{ textAlign: right ? "left" : "right", fontVariantNumeric: "tabular-nums" }}>
      <div className="head" style={{ fontSize: 16 * scale, color: trip >= 0 ? "#7CFFB2" : "#ff9a9a" }}>
        {trip >= 0 ? "+" : ""}{trip}
      </div>
      <div style={{ fontSize: 10 * scale, opacity: .8 }}>
        {todayVal == null ? thru : `${todayVal >= 0 ? "+" : ""}${todayVal} · ${thru}`}
      </div>
    </div>
  );
}

function tv2(scale: number) { return scale > 1 ? 14 : 10; }
```
> The dual numbers: big = **trip** total (cumulative), small line = **today** (`result · THRU n`) when a round is live, else just the dash. Picked-up holes already fold into the points/result via the engine.

- [ ] **Step 2: Build (PlayerDetail created next task; temporarily stub if needed)**

`PlayerDetail` is created in Task G2. To keep this task's build green in isolation, create a minimal placeholder `src/screens/PlayerDetail.tsx` now:
```tsx
export function PlayerDetail(_: any) { return null; }
```
(Task G2 replaces it.)

Run: `npx tsc --noEmit` → clean. `npm run build` → succeeds. `npx vitest run` → unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/screens/Board.tsx src/screens/PlayerDetail.tsx
git commit -m "feat(board): ryder-cup two-team layout, live course header, today+trip, per-round strip"
```

### Task G2: Player drill-down

**Files:**
- Modify: `src/screens/PlayerDetail.tsx`

- [ ] **Step 1: Implement `src/screens/PlayerDetail.tsx`**

```tsx
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { playingHandicap, strokesReceived, holePoints } from "../scoring";

/** Tap-a-player drill-down: handicap/quota, round-by-round results, current round scorecard. */
export function PlayerDetail({ playerId, lb, liveId, onClose }: { playerId: string; lb: any; liveId: string | null; onClose: () => void }) {
  const player = lb.players.find((p: any) => p.playerId === playerId);
  const allowance: number = lb.allowance ?? 0.75;
  const roundsMeta: any[] = lb.rounds ?? [];
  const [card, setCard] = useState<any>(null);
  const scoreRoundId = liveId ?? (roundsMeta[0]?.id ?? null);

  useEffect(() => {
    if (!scoreRoundId) return;
    api.round(scoreRoundId).then(setCard).catch(() => setCard(null));
  }, [scoreRoundId]);

  if (!player) return null;
  const phc = playingHandicap(player.handicap, allowance);
  const quota = player.quotaOverride ?? 36;

  const myScores: Record<number, number | null> = {};
  if (card) for (const s of card.scores) if (s.player_id === playerId) myScores[s.hole] = s.gross;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "grid", placeItems: "center", padding: 16, zIndex: 50 }}>
      <div onClick={e => e.stopPropagation()} className="panel" style={{ padding: 16, width: "min(560px,100%)", maxHeight: "90vh", overflow: "auto", display: "grid", gap: 12 }}>
        <div className="head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{player.name}</span>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
        <div className="panel" style={{ padding: 10, display: "flex", justifyContent: "space-around", textAlign: "center" }}>
          <div><div style={{ opacity: .6, fontSize: 11 }}>HCP</div><div className="head">{player.handicap}</div></div>
          <div><div style={{ opacity: .6, fontSize: 11 }}>PLAYING</div><div className="head">{phc}</div></div>
          <div><div style={{ opacity: .6, fontSize: 11 }}>QUOTA</div><div className="head">{quota}</div></div>
          <div><div style={{ opacity: .6, fontSize: 11 }}>TRIP</div><div className="head" style={{ color: player.result >= 0 ? "#7CFFB2" : "#ff9a9a" }}>{player.result >= 0 ? "+" : ""}{player.result}</div></div>
        </div>

        <div className="head" style={{ fontSize: 13 }}>By round</div>
        <div style={{ display: "grid", gap: 4 }}>
          {roundsMeta.map((r: any, i: number) => {
            const pr = player.perRound?.[r.id];
            const res = pr ? pr.result : null;
            return (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", background: "#0f1a17", borderRadius: 6 }}>
                <span>R{i + 1} · {r.day}{r.doublePoints ? " · 2×" : ""}</span>
                <span style={{ fontVariantNumeric: "tabular-nums", color: res == null ? "#888" : res >= 0 ? "#7CFFB2" : "#ff9a9a" }}>
                  {pr ? `${res! >= 0 ? "+" : ""}${res} · ${pr.thru === "F" ? "F" : "thru " + pr.thru}` : "—"}
                </span>
              </div>
            );
          })}
        </div>

        {card && (
          <>
            <div className="head" style={{ fontSize: 13 }}>{card.round.label} scorecard</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4, fontSize: 12 }}>
              {card.holes.map((h: any) => {
                const g = myScores[h.number];
                const recv = strokesReceived(phc, h.strokeIndex);
                let label = "·", color = "#13231f";
                if (g === 0) { label = "PU"; color = "#2a2a2a"; }
                else if (g != null) {
                  const pts = holePoints({ gross: g, par: h.par, strokes: recv });
                  label = `${g}`;
                  color = pts >= 3 ? "#1f5e3a" : pts === 2 ? "#1f3b34" : pts === 1 ? "#3b3520" : "#3b2020";
                }
                return (
                  <div key={h.number} style={{ background: color, borderRadius: 6, padding: 6, textAlign: "center" }}>
                    <div style={{ opacity: .5, fontSize: 9 }}>{h.number}{recv > 0 ? "•".repeat(recv) : ""}</div>
                    <div className="head">{label}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ opacity: .5, fontSize: 10 }}>• = a stroke received on that hole · cell color = Stableford points</div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → clean. `npm run build` → succeeds. `npx vitest run` → unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/screens/PlayerDetail.tsx
git commit -m "feat(board): tap-a-player drill-down (handicap, by-round, scorecard)"
```

---

## Phase H — Home "Up Next"

### Task H1: Schedule-aware home panel

**Files:**
- Modify: `src/screens/Home.tsx`

- [ ] **Step 1: Rewrite `src/screens/Home.tsx`**

```tsx
import { useTrip } from "../state/useTrip";
import { getPlayerId } from "../state/session";
import { liveRound, nextUpcoming } from "../schedule";
import { go } from "../App";

export function Home() {
  const { state } = useTrip();
  const me = getPlayerId();
  if (!state) return <div style={{ padding: 24 }}>Loading…</div>;
  const myName = me ? state.players.find((p: any) => p.id === me)?.name ?? me : null;

  const rounds: any[] = state.rounds ?? [];
  const courseName = (cid: string) => state.courses?.find((c: any) => c.id === cid)?.name ?? cid;
  const myGroup = (roundId: string) => {
    if (!me) return null;
    const a = state.teeAssignments?.find((t: any) => t.round_id === roundId && t.player_id === me);
    return a ? a.group_no : null;
  };

  const now = new Date();
  const live = liveRound(rounds as any, now);
  const next = nextUpcoming(rounds as any, now);

  const Card = ({ tag, r }: { tag: string; r: any }) => {
    const grp = myGroup(r.id);
    return (
      <div className="panel" style={{ padding: 14 }}>
        <div className="head" style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{tag}</span><span>{r.day} {r.teeTime}</span>
        </div>
        <div className="head" style={{ fontSize: 20, marginTop: 4 }}>{courseName(r.courseId)}</div>
        {grp != null && <div style={{ opacity: .8, marginTop: 4 }}>You're in Group {grp}</div>}
      </div>
    );
  };

  return (
    <div style={{ padding: 20, display: "grid", gap: 16 }}>
      <h1 className="head" style={{ textAlign: "center" }}>Bandon Cup '26</h1>
      {myName ? (
        <div className="panel" style={{ padding: 14, textAlign: "center" }}>Playing as <b>{myName}</b></div>
      ) : (
        <div className="panel" style={{ padding: 14, textAlign: "center", opacity: .85 }}>Spectating · tap Enter Score to log in</div>
      )}

      {live && <Card tag="● LIVE NOW" r={live} />}
      {next && <Card tag="UP NEXT" r={next} />}
      {!live && !next && <div className="panel" style={{ padding: 14, textAlign: "center" }}>Trip complete — see the final board.</div>}

      <button className="btn" onClick={() => go("/board")}>Leaderboard</button>
      <button className="btn" onClick={() => go("/score?round=" + (live?.id ?? next?.id ?? "r2"))}>Enter Score</button>
      <button className="btn" onClick={() => go("/tee")}>Tee Sheet</button>

      <div style={{ textAlign: "center", opacity: .6, fontSize: 12 }}>BANDON SPORTS — IT'S IN THE GAME</div>
    </div>
  );
}
```
> Enter Score deep-links to the live (or next) round, so a player lands on the right round automatically. The button still routes through login when not authed (App gate).

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → clean. `npm run build` → succeeds. `npx vitest run` → unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/screens/Home.tsx
git commit -m "feat(home): schedule-aware Up Next + live round, deep-link score entry"
```

---

## Phase I — Full verification

### Task I1: Suite, build, browser smoke

- [ ] **Step 1: Full automated gate**

Run: `npx vitest run` → all green (scoring incl. pick-up + perRound + schedule; worker incl. public reads + gross 0). `npx tsc --noEmit` → clean. `npm run build` → succeeds.

- [ ] **Step 2: Browser smoke (manual)**

Start `npm run dev` in the background. Apply migrations first if needed (`npm run db:migrate:local`). Verify:
- Visiting `/board` with NO login shows the board (public).
- Board shows the course-context header, two-team columns with today+trip numbers, and the per-round strip. Post a few scores via the API (logged-in) and confirm the live round lights up and numbers move.
- Tap a player row → drill-down shows handicap/playing/quota, by-round, and the scorecard (with a picked-up hole showing "PU").
- `/` shows "Up Next"; `/score` prompts login, then the tap-pad enters scores, "Pick Up" records a PU and auto-advances, and the hole grid shows PU.
- Stop the dev server. Remove any screenshot artifacts.

- [ ] **Step 3: Final commit (if any polish)**

```bash
git add -A && git commit -m "polish: spectator & schedule update"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Real data (names, dates, delete r1) → Task A1 ✓
- Public reads / gated writes → Task D1 (API) + E1 (routing) ✓
- Schedule awareness (pure, device-local) → Task C1 ✓; drives Home (H1) + Board live header (G1) ✓
- Board Ryder-Cup look: team bars, course header, two-team columns, today+trip dual numbers, per-round strip, ★ leader → Task G1 ✓
- Tap-a-player drill-down → Task G2 ✓
- Tap-the-score + pick-up + auto-advance → Task F1 ✓
- Pick-up data model (gross 0 = played/0 pts) → Task B1 (scoring) + D1 (validation) + F1 (UI/PU display) + G2 (PU in scorecard) ✓
- Richer leaderboard payload (perRound, roundCups, rounds, courses, allowance) → Task B2 ✓
- Sportsbook explicitly out of scope ✓

**Placeholder scan:** The `PlayerDetail` stub in G1 Step 2 is explicitly replaced in G2 — not a left-behind placeholder. No TBDs.

**Type consistency:** `Round` gains `date` (A1) and every `Round` literal in scoring tests is updated (B2 Step 4). `computeLeaderboard` return adds `perRound` (per player), `roundCups`, `rounds`, `courses`, `allowance`, and players gain `handicap`/`quotaOverride` — all consumed by Board (G1) and PlayerDetail (G2). `classifyRounds`/`liveRound`/`nextUpcoming` signatures match their use in Board and Home. `gross === 0` semantics are identical in `roundResult` (B1), API validation `0..20` (D1), ScoreEntry pick-up (F1), and PU rendering (F1, G2).
