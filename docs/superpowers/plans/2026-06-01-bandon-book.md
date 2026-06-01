# The Bandon Book Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build "The Bandon Book" — a play-money-free prediction game where players post comedy props, each makes one locked pick per prop, the commish locks-then-resolves, and standings rank players by correct calls with fun titles.

**Architecture:** A fresh D1 migration (`0005`) drops and recreates the three pre-existing (empty) book tables to fit a no-money "pick a side" model, with a `UNIQUE(prop_id, player_id)` constraint enforcing one immutable pick. A pure, unit-tested standings module (`src/book.ts`) computes correct/wrong/hit-rate + titles. A thin Hono route group (`worker/routes/book.ts`) exposes public read + player/admin write endpoints, mirroring the existing route/auth conventions. A new public `/book` React screen renders props, picks, standings, a post-a-prop form, and inline admin Lock/Resolve controls gated on a newly-persisted client session role.

**Tech Stack:** Cloudflare Worker + Hono + D1, React 19 + Vite, Vitest 4 with `@cloudflare/vitest-pool-workers` for worker tests. Spec: `docs/superpowers/specs/2026-06-01-bandon-book-design.md`.

---

## File Structure

**Create:**
- `migrations/0005_bandon_book.sql` — drop + recreate `props`/`prop_options`, drop `wagers`, create `picks`.
- `src/scoring/book.ts` — pure `computeStandings()` + types. No DB, no React. (Lives under `src/scoring/` with the other pure-logic modules.)
- `worker/routes/book.ts` — Hono routes: `GET /book`, `POST /book/prop|pick|lock|resolve`.
- `src/state/useBook.ts` — polling hook (analogous to `useLeaderboard`).
- `src/screens/Book.tsx` — the `/book` screen.
- `test/scoring/book.test.ts` — pure standings unit tests (runs in the "scoring" Node project; glob is `test/scoring/**`).
- `test/worker/book.test.ts` — worker integration tests (schema + routes).

**Modify:**
- `worker/db.ts` — add book row types + DB helpers (`getProps`, `getPropOptions`, `getPicks`, `createProp`, `insertPick`, `lockProp`, `resolveProp`).
- `worker/index.ts` — mount `bookRoutes`.
- `src/api/client.ts` — add `book`, `bookProp`, `bookPick`, `bookLock`, `bookResolve` methods.
- `src/state/session.ts` — add `getRole`/`setRole`/`isAdmin`.
- `src/screens/Login.tsx` — persist role from `api.auth(...)` response.
- `src/App.tsx` — route `/book` → `<Book />` (public).
- `src/screens/Home.tsx` — add a "The Book" nav button.

**Note on test DB:** `vitest.config.ts` calls `readD1Migrations("migrations")`, which parses **all** `.sql` files in `migrations/`, so `0005` is picked up automatically — no config change needed. `applyD1Migrations` runs them in order, so `0005`'s `DROP TABLE` runs against the empty tables `0001` created. Worker tests share one D1 across a file (seed persists), so **every test must use unique row ids** to avoid PRIMARY KEY collisions.

---

## Task 1: Migration — recreate book tables for the pick-a-side model

**Files:**
- Create: `migrations/0005_bandon_book.sql`
- Test: `test/worker/book.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/worker/book.test.ts`:

```ts
import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("book schema", () => {
  it("picks table enforces one pick per player per prop", async () => {
    await env.DB.prepare(
      "INSERT INTO props (id,creator,subject,status,created_at) VALUES ('schp','taheri','Schema test','open',1)",
    ).run();
    await env.DB.prepare(
      "INSERT INTO prop_options (id,prop_id,label,position) VALUES ('scho1','schp','A',0),('scho2','schp','B',1)",
    ).run();
    await env.DB.prepare(
      "INSERT INTO picks (id,prop_id,option_id,player_id,created_at) VALUES ('schk1','schp','scho1','taheri',1)",
    ).run();
    // Second pick by the same player on the same prop must violate UNIQUE(prop_id,player_id).
    await expect(
      env.DB.prepare(
        "INSERT INTO picks (id,prop_id,option_id,player_id,created_at) VALUES ('schk2','schp','scho2','taheri',2)",
      ).run(),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/worker/book.test.ts`
Expected: FAIL — before the migration there is no `picks` table and `prop_options` requires an `odds` column, so the inserts throw (e.g. "no such table: picks" or "NOT NULL constraint failed: prop_options.odds").

- [ ] **Step 3: Write the migration**

Create `migrations/0005_bandon_book.sql`:

```sql
-- The Bandon Book: replace the unused odds/money tables with a pick-a-side model.
-- These tables have never held data, so dropping is safe.
DROP TABLE wagers;
DROP TABLE prop_options;
DROP TABLE props;

CREATE TABLE props (
  id TEXT PRIMARY KEY,
  creator TEXT NOT NULL REFERENCES players(id),
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',   -- 'open' | 'locked' | 'resolved'
  winning_option_id TEXT,
  created_at INTEGER NOT NULL,
  locked_at INTEGER,
  resolved_at INTEGER
);

CREATE TABLE prop_options (
  id TEXT PRIMARY KEY,
  prop_id TEXT NOT NULL REFERENCES props(id),
  label TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE picks (
  id TEXT PRIMARY KEY,
  prop_id TEXT NOT NULL REFERENCES props(id),
  option_id TEXT NOT NULL REFERENCES prop_options(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  created_at INTEGER NOT NULL,
  UNIQUE (prop_id, player_id)
);

CREATE INDEX idx_prop_options_prop ON prop_options(prop_id);
CREATE INDEX idx_picks_prop ON picks(prop_id);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/worker/book.test.ts`
Expected: PASS — `picks` exists and the duplicate insert rejects.

- [ ] **Step 5: Run the full suite to confirm nothing broke**

Run: `npm test`
Expected: all existing tests still PASS (the dropped tables were empty and unreferenced by other code).

- [ ] **Step 6: Commit**

```bash
git add migrations/0005_bandon_book.sql test/worker/book.test.ts
git commit -m "feat(book): migration 0005 — pick-a-side book schema with one-pick UNIQUE"
```

---

## Task 2: Pure standings module

**Files:**
- Create: `src/book.ts`
- Test: `test/scoring/book.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/scoring/book.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeStandings, type PropLite, type PickLite } from "../../src/book";

const players = [
  { id: "a", name: "Aaron" },
  { id: "b", name: "Beth" },
  { id: "c", name: "Cam" },
];

describe("computeStandings", () => {
  it("counts correct/wrong only on resolved props and ignores unresolved", () => {
    const props: PropLite[] = [
      { id: "p1", status: "resolved", winningOptionId: "p1o1" },
      { id: "p2", status: "open", winningOptionId: null },
    ];
    const picks: PickLite[] = [
      { propId: "p1", optionId: "p1o1", playerId: "a" }, // correct
      { propId: "p1", optionId: "p1o2", playerId: "b" }, // wrong
      { propId: "p2", optionId: "p2o1", playerId: "a" }, // unresolved -> ignored
    ];
    const s = computeStandings(props, picks, players);
    const a = s.find((x) => x.playerId === "a")!;
    const b = s.find((x) => x.playerId === "b")!;
    const c = s.find((x) => x.playerId === "c")!;
    expect(a.correct).toBe(1);
    expect(a.resolvedPicked).toBe(1);
    expect(a.hitRate).toBe(1);
    expect(b.wrong).toBe(1);
    expect(b.correct).toBe(0);
    expect(c.resolvedPicked).toBe(0);
    expect(c.hitRate).toBe(0); // no divide-by-zero
  });

  it("awards Oracle to the top correct (incl. ties) and Tank Job to most wrong", () => {
    const props: PropLite[] = [
      { id: "p1", status: "resolved", winningOptionId: "w1" },
      { id: "p2", status: "resolved", winningOptionId: "w2" },
    ];
    const picks: PickLite[] = [
      { propId: "p1", optionId: "w1", playerId: "a" },
      { propId: "p2", optionId: "w2", playerId: "a" }, // a: 2 correct
      { propId: "p1", optionId: "x", playerId: "b" },
      { propId: "p2", optionId: "x", playerId: "b" }, // b: 2 wrong
    ];
    const s = computeStandings(props, picks, players);
    const a = s.find((x) => x.playerId === "a")!;
    const b = s.find((x) => x.playerId === "b")!;
    expect(a.titles).toContain("🔮 The Oracle");
    expect(b.titles).toContain("🚽 Tank Job");
    expect(s[0].playerId).toBe("a"); // sorted: most correct first
  });

  it("awards Sharpshooter on hit rate among players with >=3 resolved picks, excluding the Oracle", () => {
    const props: PropLite[] = [1, 2, 3, 4].map((n) => ({
      id: `p${n}`, status: "resolved", winningOptionId: `w${n}`,
    }));
    const picks: PickLite[] = [
      // a: 4 picks, 4 correct -> Oracle (excluded from Sharpshooter)
      ...["p1", "p2", "p3", "p4"].map((id, i) => ({ propId: id, optionId: `w${i + 1}`, playerId: "a" })),
      // b: 3 picks, 3 correct -> 100% hit rate, eligible -> Sharpshooter
      ...["p1", "p2", "p3"].map((id, i) => ({ propId: id, optionId: `w${i + 1}`, playerId: "b" })),
      // c: 1 pick -> below the 3-pick threshold
      { propId: "p1", optionId: "w1", playerId: "c" },
    ];
    const s = computeStandings(props, picks, players);
    const a = s.find((x) => x.playerId === "a")!;
    const b = s.find((x) => x.playerId === "b")!;
    const c = s.find((x) => x.playerId === "c")!;
    expect(a.titles).toContain("🔮 The Oracle");
    expect(a.titles).not.toContain("🎯 Sharpshooter");
    expect(b.titles).toContain("🎯 Sharpshooter");
    expect(c.titles).not.toContain("🎯 Sharpshooter");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/scoring/book.test.ts`
Expected: FAIL with "Cannot find module '../../src/book'" (or `computeStandings` undefined).

- [ ] **Step 3: Write the implementation**

Create `src/book.ts`:

```ts
// Pure standings/titles for The Bandon Book. No DB, no React — unit-tested in
// test/scoring/book.test.ts. Given props + picks, derive each player's correct
// / wrong / hit-rate over RESOLVED props and assign fun titles.

export interface PropLite {
  id: string;
  status: string; // 'open' | 'locked' | 'resolved'
  winningOptionId: string | null;
}
export interface PickLite {
  propId: string;
  optionId: string;
  playerId: string;
}
export interface PlayerLite {
  id: string;
  name: string;
}
export interface Standing {
  playerId: string;
  name: string;
  correct: number;
  wrong: number;
  resolvedPicked: number; // picks on resolved props
  hitRate: number; // correct / resolvedPicked, 0 when none
  titles: string[];
}

const SHARP_MIN_PICKS = 3;
const ORACLE = "🔮 The Oracle";
const SHARP = "🎯 Sharpshooter";
const TANK = "🚽 Tank Job";

export function computeStandings(
  props: PropLite[],
  picks: PickLite[],
  players: PlayerLite[],
): Standing[] {
  const winners = new Map<string, string>(); // propId -> winning option id
  for (const p of props) {
    if (p.status === "resolved" && p.winningOptionId) winners.set(p.id, p.winningOptionId);
  }

  const byId = new Map<string, Standing>();
  for (const pl of players) {
    byId.set(pl.id, {
      playerId: pl.id, name: pl.name,
      correct: 0, wrong: 0, resolvedPicked: 0, hitRate: 0, titles: [],
    });
  }

  for (const pick of picks) {
    const winner = winners.get(pick.propId);
    if (winner == null) continue; // prop not resolved
    const s = byId.get(pick.playerId);
    if (!s) continue; // pick by an unknown player — ignore
    s.resolvedPicked++;
    if (pick.optionId === winner) s.correct++;
    else s.wrong++;
  }

  const standings = [...byId.values()];
  for (const s of standings) {
    s.hitRate = s.resolvedPicked > 0 ? s.correct / s.resolvedPicked : 0;
  }

  // Oracle: most correct (≥1), ties share it.
  const maxCorrect = Math.max(0, ...standings.map((s) => s.correct));
  if (maxCorrect > 0) {
    for (const s of standings) if (s.correct === maxCorrect) s.titles.push(ORACLE);
  }

  // Tank Job: most wrong (≥1), ties share it.
  const maxWrong = Math.max(0, ...standings.map((s) => s.wrong));
  if (maxWrong > 0) {
    for (const s of standings) if (s.wrong === maxWrong) s.titles.push(TANK);
  }

  // Sharpshooter: best hit rate among players with enough resolved picks who
  // aren't already the Oracle (so selective sharp pickers get their own shine).
  const eligible = standings.filter(
    (s) => s.resolvedPicked >= SHARP_MIN_PICKS && !s.titles.includes(ORACLE),
  );
  if (eligible.length) {
    const bestRate = Math.max(...eligible.map((s) => s.hitRate));
    if (bestRate > 0) {
      for (const s of eligible) if (s.hitRate === bestRate) s.titles.push(SHARP);
    }
  }

  standings.sort(
    (a, b) => b.correct - a.correct || b.hitRate - a.hitRate || a.name.localeCompare(b.name),
  );
  return standings;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/scoring/book.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/book.ts test/scoring/book.test.ts
git commit -m "feat(book): pure standings + titles module"
```

---

## Task 3: DB helpers for the book

**Files:**
- Modify: `worker/db.ts` (append at end of file)

This task adds DB functions consumed by Task 4's routes. It is exercised by Task 4's route tests (no standalone test here — the helpers are thin SQL wrappers verified end-to-end through the routes, matching how `upsertScore`/`getRoundScores` are covered via `round`/`leaderboard` route tests).

- [ ] **Step 1: Append the helpers to `worker/db.ts`**

Add to the end of `worker/db.ts`:

```ts
// --- The Bandon Book ---

export interface PropRow {
  id: string;
  creator: string;
  subject: string;
  description: string | null;
  status: string;
  winning_option_id: string | null;
  created_at: number;
  locked_at: number | null;
  resolved_at: number | null;
}
export interface OptionRow {
  id: string;
  prop_id: string;
  label: string;
  position: number;
}
export interface PickRow {
  id: string;
  prop_id: string;
  option_id: string;
  player_id: string;
  created_at: number;
}

export async function getProps(db: D1Database): Promise<PropRow[]> {
  const { results } = await db
    .prepare(
      "SELECT id,creator,subject,description,status,winning_option_id,created_at,locked_at,resolved_at FROM props ORDER BY created_at DESC",
    )
    .all<PropRow>();
  return results;
}

export async function getPropOptions(db: D1Database): Promise<OptionRow[]> {
  const { results } = await db
    .prepare("SELECT id,prop_id,label,position FROM prop_options ORDER BY prop_id,position")
    .all<OptionRow>();
  return results;
}

export async function getPicks(db: D1Database): Promise<PickRow[]> {
  const { results } = await db
    .prepare("SELECT id,prop_id,option_id,player_id,created_at FROM picks")
    .all<PickRow>();
  return results;
}

export async function createProp(
  db: D1Database,
  p: {
    id: string;
    creator: string;
    subject: string;
    description: string | null;
    createdAt: number;
    options: { id: string; label: string; position: number }[];
  },
) {
  await db.batch([
    db
      .prepare(
        "INSERT INTO props (id,creator,subject,description,status,created_at) VALUES (?,?,?,?, 'open', ?)",
      )
      .bind(p.id, p.creator, p.subject, p.description, p.createdAt),
    ...p.options.map((o) =>
      db
        .prepare("INSERT INTO prop_options (id,prop_id,label,position) VALUES (?,?,?,?)")
        .bind(o.id, p.id, o.label, o.position),
    ),
  ]);
}

/** Insert a pick. Result tells the route which HTTP status to return. */
export async function insertPick(
  db: D1Database,
  pick: { id: string; propId: string; optionId: string; playerId: string; createdAt: number },
): Promise<"ok" | "closed" | "dup" | "badoption"> {
  const prop = await db
    .prepare("SELECT status FROM props WHERE id=?")
    .bind(pick.propId)
    .first<{ status: string }>();
  if (!prop) return "badoption";
  if (prop.status !== "open") return "closed";
  const opt = await db
    .prepare("SELECT id FROM prop_options WHERE id=? AND prop_id=?")
    .bind(pick.optionId, pick.propId)
    .first();
  if (!opt) return "badoption";
  try {
    await db
      .prepare("INSERT INTO picks (id,prop_id,option_id,player_id,created_at) VALUES (?,?,?,?,?)")
      .bind(pick.id, pick.propId, pick.optionId, pick.playerId, pick.createdAt)
      .run();
    return "ok";
  } catch {
    return "dup"; // UNIQUE(prop_id,player_id) violation
  }
}

/** open -> locked. Returns false if the prop wasn't open. */
export async function lockProp(db: D1Database, propId: string, lockedAt: number): Promise<boolean> {
  const res = await db
    .prepare("UPDATE props SET status='locked', locked_at=? WHERE id=? AND status='open'")
    .bind(lockedAt, propId)
    .run();
  return (res.meta.changes ?? 0) > 0;
}

/** Set the winning option and mark resolved (allowed from open or locked). */
export async function resolveProp(
  db: D1Database,
  propId: string,
  winningOptionId: string,
  resolvedAt: number,
): Promise<"ok" | "notfound" | "badoption"> {
  const opt = await db
    .prepare("SELECT id FROM prop_options WHERE id=? AND prop_id=?")
    .bind(winningOptionId, propId)
    .first();
  if (!opt) {
    const prop = await db.prepare("SELECT id FROM props WHERE id=?").bind(propId).first();
    return prop ? "badoption" : "notfound";
  }
  await db
    .prepare(
      "UPDATE props SET status='resolved', winning_option_id=?, resolved_at=? WHERE id=?",
    )
    .bind(winningOptionId, resolvedAt, propId)
    .run();
  return "ok";
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add worker/db.ts
git commit -m "feat(book): D1 helpers for props, options, picks"
```

---

## Task 4: Book API routes

**Files:**
- Create: `worker/routes/book.ts`
- Modify: `worker/index.ts`
- Test: `test/worker/book.test.ts` (append route tests)

- [ ] **Step 1: Write the failing route tests**

Append to `test/worker/book.test.ts` (keep the existing `book schema` describe block above it):

```ts
import { SELF } from "cloudflare:test";
import { authCookie, adminCookie } from "./helpers";

const json = (cookie: string, body: unknown) => ({
  method: "POST",
  headers: { Cookie: cookie, "content-type": "application/json" },
  body: JSON.stringify(body),
});

async function createOpenProp(cookie: string, subject: string) {
  const res = await SELF.fetch(
    "https://x/api/book/prop",
    json(cookie, { creator: "taheri", subject, options: ["Yes", "No"] }),
  );
  const { id } = await res.json<{ id: string }>();
  const get = await (await SELF.fetch("https://x/api/book")).json<any>();
  const prop = get.props.find((p: any) => p.id === id);
  return { id, optionIds: prop.options.map((o: any) => o.id) as string[] };
}

describe("book routes", () => {
  it("creates a prop and lists it open with options (public read)", async () => {
    const cookie = await authCookie();
    const res = await SELF.fetch(
      "https://x/api/book/prop",
      json(cookie, { creator: "taheri", subject: "Bruce first tee", options: ["Fairway", "Rough", "Gone"] }),
    );
    expect(res.status).toBe(200);
    const { id } = await res.json<{ id: string }>();
    const data = await (await SELF.fetch("https://x/api/book")).json<any>();
    const prop = data.props.find((p: any) => p.id === id);
    expect(prop.status).toBe("open");
    expect(prop.options.map((o: any) => o.label)).toEqual(["Fairway", "Rough", "Gone"]);
  });

  it("rejects a prop with fewer than 2 options", async () => {
    const cookie = await authCookie();
    const res = await SELF.fetch(
      "https://x/api/book/prop",
      json(cookie, { creator: "taheri", subject: "bad", options: ["only one"] }),
    );
    expect(res.status).toBe(400);
  });

  it("records a pick and reflects it in myPick", async () => {
    const cookie = await authCookie();
    const { id, optionIds } = await createOpenProp(cookie, "pick me");
    const res = await SELF.fetch(
      "https://x/api/book/pick",
      json(cookie, { propId: id, optionId: optionIds[0], playerId: "desabio" }),
    );
    expect(res.status).toBe(200);
    const data = await (await SELF.fetch(`https://x/api/book?me=desabio`)).json<any>();
    expect(data.props.find((p: any) => p.id === id).myPick).toBe(optionIds[0]);
  });

  it("409s on a duplicate pick by the same player", async () => {
    const cookie = await authCookie();
    const { id, optionIds } = await createOpenProp(cookie, "dup test");
    await SELF.fetch("https://x/api/book/pick", json(cookie, { propId: id, optionId: optionIds[0], playerId: "sloan" }));
    const dup = await SELF.fetch(
      "https://x/api/book/pick",
      json(cookie, { propId: id, optionId: optionIds[1], playerId: "sloan" }),
    );
    expect(dup.status).toBe(409);
  });

  it("forbids player lock (403) but allows admin lock, then 409s a pick on a locked prop", async () => {
    const player = await authCookie();
    const admin = await adminCookie();
    const { id, optionIds } = await createOpenProp(player, "lock test");
    const denied = await SELF.fetch("https://x/api/book/lock", json(player, { propId: id }));
    expect(denied.status).toBe(403);
    const locked = await SELF.fetch("https://x/api/book/lock", json(admin, { propId: id }));
    expect(locked.status).toBe(200);
    const late = await SELF.fetch(
      "https://x/api/book/pick",
      json(player, { propId: id, optionId: optionIds[0], playerId: "grattan" }),
    );
    expect(late.status).toBe(409);
  });

  it("resolves (admin) and updates standings; rejects an option not in the prop", async () => {
    const player = await authCookie();
    const admin = await adminCookie();
    const { id, optionIds } = await createOpenProp(player, "resolve test");
    await SELF.fetch("https://x/api/book/pick", json(player, { propId: id, optionId: optionIds[0], playerId: "johnson" }));
    const bad = await SELF.fetch("https://x/api/book/resolve", json(admin, { propId: id, winningOptionId: "nope" }));
    expect(bad.status).toBe(400);
    const ok = await SELF.fetch("https://x/api/book/resolve", json(admin, { propId: id, winningOptionId: optionIds[0] }));
    expect(ok.status).toBe(200);
    const data = await (await SELF.fetch("https://x/api/book")).json<any>();
    const johnson = data.standings.find((s: any) => s.playerId === "johnson");
    expect(johnson.correct).toBeGreaterThanOrEqual(1);
  });

  it("forbids resolve by a non-admin (403)", async () => {
    const player = await authCookie();
    const { id, optionIds } = await createOpenProp(player, "resolve auth");
    const res = await SELF.fetch("https://x/api/book/resolve", json(player, { propId: id, winningOptionId: optionIds[0] }));
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/worker/book.test.ts`
Expected: the `book schema` test still passes; all `book routes` tests FAIL with 404 (routes not mounted yet).

- [ ] **Step 3: Create the route file**

Create `worker/routes/book.ts`:

```ts
import { Hono } from "hono";
import type { Env } from "../types";
import { requireSession, requireAdmin } from "../auth";
import { computeStandings } from "../../src/scoring/book";
import {
  getPlayers, getProps, getPropOptions, getPicks,
  createProp, insertPick, lockProp, resolveProp,
  type OptionRow, type PickRow,
} from "../db";

export const bookRoutes = new Hono<{ Bindings: Env; Variables: { role: string } }>();

// Public read. `?me=<playerId>` annotates each prop with the caller's pick.
bookRoutes.get("/book", async (c) => {
  const me = c.req.query("me") ?? null;
  const [players, props, options, picks] = await Promise.all([
    getPlayers(c.env.DB), getProps(c.env.DB), getPropOptions(c.env.DB), getPicks(c.env.DB),
  ]);

  const optionsByProp = new Map<string, OptionRow[]>();
  for (const o of options) {
    const arr = optionsByProp.get(o.prop_id) ?? [];
    arr.push(o);
    optionsByProp.set(o.prop_id, arr);
  }
  const picksByProp = new Map<string, PickRow[]>();
  for (const p of picks) {
    const arr = picksByProp.get(p.prop_id) ?? [];
    arr.push(p);
    picksByProp.set(p.prop_id, arr);
  }

  const propsOut = props.map((pr) => {
    const propPicks = picksByProp.get(pr.id) ?? [];
    const opts = (optionsByProp.get(pr.id) ?? []).map((o) => ({
      id: o.id,
      label: o.label,
      position: o.position,
      pickCount: propPicks.filter((pk) => pk.option_id === o.id).length,
    }));
    return {
      id: pr.id, creator: pr.creator, subject: pr.subject, description: pr.description,
      status: pr.status, winningOptionId: pr.winning_option_id,
      createdAt: pr.created_at, lockedAt: pr.locked_at, resolvedAt: pr.resolved_at,
      options: opts,
      picks: propPicks.map((pk) => ({ playerId: pk.player_id, optionId: pk.option_id })),
      myPick: me ? (propPicks.find((pk) => pk.player_id === me)?.option_id ?? null) : null,
    };
  });

  const standings = computeStandings(
    props.map((p) => ({ id: p.id, status: p.status, winningOptionId: p.winning_option_id })),
    picks.map((p) => ({ propId: p.prop_id, optionId: p.option_id, playerId: p.player_id })),
    players.map((p) => ({ id: p.id, name: p.name })),
  );

  return c.json({ props: propsOut, standings });
});

bookRoutes.post("/book/prop", requireSession, async (c) => {
  const b = await c.req.json<{ creator?: string; subject?: string; description?: string; options?: string[] }>();
  const subject = b.subject?.trim();
  const creator = b.creator?.trim();
  const labels = (b.options ?? []).map((o) => o?.trim()).filter((o): o is string => !!o);
  if (!creator) return c.json({ error: "creator required" }, 400);
  if (!subject) return c.json({ error: "subject required" }, 400);
  if (labels.length < 2 || labels.length > 8) return c.json({ error: "need 2-8 options" }, 400);
  const id = crypto.randomUUID();
  await createProp(c.env.DB, {
    id, creator, subject,
    description: b.description?.trim() || null,
    createdAt: Date.now(),
    options: labels.map((label, i) => ({ id: crypto.randomUUID(), label, position: i })),
  });
  return c.json({ ok: true, id });
});

bookRoutes.post("/book/pick", requireSession, async (c) => {
  const b = await c.req.json<{ propId?: string; optionId?: string; playerId?: string }>();
  if (!b.propId || !b.optionId || !b.playerId) return c.json({ error: "bad pick" }, 400);
  const r = await insertPick(c.env.DB, {
    id: crypto.randomUUID(), propId: b.propId, optionId: b.optionId, playerId: b.playerId, createdAt: Date.now(),
  });
  if (r === "ok") return c.json({ ok: true });
  if (r === "dup") return c.json({ error: "already picked" }, 409);
  if (r === "closed") return c.json({ error: "picks closed" }, 409);
  return c.json({ error: "bad option" }, 400);
});

bookRoutes.post("/book/lock", requireAdmin, async (c) => {
  const { propId } = await c.req.json<{ propId?: string }>();
  if (!propId) return c.json({ error: "no prop" }, 400);
  const ok = await lockProp(c.env.DB, propId, Date.now());
  return ok ? c.json({ ok: true }) : c.json({ error: "not open" }, 409);
});

bookRoutes.post("/book/resolve", requireAdmin, async (c) => {
  const { propId, winningOptionId } = await c.req.json<{ propId?: string; winningOptionId?: string }>();
  if (!propId || !winningOptionId) return c.json({ error: "bad resolve" }, 400);
  const r = await resolveProp(c.env.DB, propId, winningOptionId, Date.now());
  if (r === "notfound") return c.json({ error: "no such prop" }, 404);
  if (r === "badoption") return c.json({ error: "option not in prop" }, 400);
  return c.json({ ok: true });
});
```

- [ ] **Step 4: Mount the routes in `worker/index.ts`**

Add the import alongside the others:

```ts
import { bookRoutes } from "./routes/book";
```

Add the mount line after `app.route("/api", exportRoutes);` and before the `app.all("/api/*", ...)` catch-all:

```ts
app.route("/api", bookRoutes);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/worker/book.test.ts`
Expected: PASS (schema test + all 7 route tests).

- [ ] **Step 6: Commit**

```bash
git add worker/routes/book.ts worker/index.ts test/worker/book.test.ts
git commit -m "feat(book): API routes — create/pick/lock/resolve + public read"
```

---

## Task 5: Client session role + API methods

**Files:**
- Modify: `src/state/session.ts`
- Modify: `src/screens/Login.tsx`
- Modify: `src/api/client.ts`

This is plumbing for the screen (Task 6). No new test file — covered by the screen working end-to-end; the server already enforces roles (tested in Task 4).

- [ ] **Step 1: Add role helpers to `src/state/session.ts`**

Replace the file contents of `src/state/session.ts` with:

```ts
const WHO = "bandon_player", AUTHED = "bandon_authed", ROLE = "bandon_role";
export const getPlayerId = () => localStorage.getItem(WHO);
export const setPlayerId = (id: string) => localStorage.setItem(WHO, id);
export const isAuthed = () => localStorage.getItem(AUTHED) === "1";
export const setAuthed = (v: boolean) => localStorage.setItem(AUTHED, v ? "1" : "0");
export const getRole = () => localStorage.getItem(ROLE);
export const setRole = (r: string) => localStorage.setItem(ROLE, r);
export const isAdmin = () => localStorage.getItem(ROLE) === "admin";
```

- [ ] **Step 2: Persist role at login in `src/screens/Login.tsx`**

In `src/screens/Login.tsx`, update the import to include `setRole`:

```ts
import { setAuthed, setPlayerId, setRole } from "../state/session";
```

And in `submit()`, capture the auth response and store the role. Replace:

```ts
      await api.auth(passcode);
      setAuthed(true);
```

with:

```ts
      const { role } = await api.auth(passcode);
      setAuthed(true);
      setRole(role);
```

- [ ] **Step 3: Add book methods to `src/api/client.ts`**

Add these entries to the `api` object (after the `adminSettings` line, inside the object):

```ts
  book: (me: string | null) => req<any>(`/book${me ? `?me=${encodeURIComponent(me)}` : ""}`),
  bookProp: (b: { creator: string; subject: string; description?: string; options: string[] }) =>
    req<{ ok: boolean; id: string }>("/book/prop", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }),
  bookPick: (b: { propId: string; optionId: string; playerId: string }) =>
    req<{ ok: boolean }>("/book/pick", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }),
  bookLock: (propId: string) =>
    req<{ ok: boolean }>("/book/lock", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ propId }) }),
  bookResolve: (b: { propId: string; winningOptionId: string }) =>
    req<{ ok: boolean }>("/book/resolve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }),
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/state/session.ts src/screens/Login.tsx src/api/client.ts
git commit -m "feat(book): persist session role + book API client methods"
```

---

## Task 6: The /book screen

**Files:**
- Create: `src/state/useBook.ts`
- Create: `src/screens/Book.tsx`
- Modify: `src/App.tsx`
- Modify: `src/screens/Home.tsx`

- [ ] **Step 1: Create the polling hook `src/state/useBook.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { getPlayerId } from "./session";

// Polls /api/book on an interval (the Book is a clubhouse/wifi activity, so a
// gentle poll is fine). `refresh` lets the screen re-pull immediately after a
// write (pick / lock / resolve) instead of waiting for the next tick.
export function useBook(intervalMs = 15000) {
  const [data, setData] = useState<any>(null);
  const timer = useRef<number | undefined>(undefined);
  const refresh = useCallback(
    () => api.book(getPlayerId()).then(setData).catch(() => {}),
    [],
  );
  useEffect(() => {
    refresh();
    timer.current = window.setInterval(refresh, intervalMs);
    return () => clearInterval(timer.current);
  }, [intervalMs, refresh]);
  return { data, refresh };
}
```

- [ ] **Step 2: Create the screen `src/screens/Book.tsx`**

```tsx
import { useState } from "react";
import { BackButton } from "../ui/BackButton";
import { useBook } from "../state/useBook";
import { usePlayers } from "../state/players";
import { getPlayerId, isAdmin } from "../state/session";
import { api } from "../api/client";

export function Book() {
  const { data, refresh } = useBook();
  const players = usePlayers();
  const me = getPlayerId();
  const admin = isAdmin();
  const [busy, setBusy] = useState(false);

  const name = (id: string) => players[id]?.name ?? id;

  async function pick(propId: string, optionId: string) {
    if (!me || busy) return;
    setBusy(true);
    try { await api.bookPick({ propId, optionId, playerId: me }); await refresh(); }
    catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }
  async function lock(propId: string) {
    setBusy(true);
    try { await api.bookLock(propId); await refresh(); }
    catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }
  async function resolve(propId: string, winningOptionId: string) {
    setBusy(true);
    try { await api.bookResolve({ propId, winningOptionId }); await refresh(); }
    catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  const props = data?.props ?? [];
  const standings = data?.standings ?? [];

  return (
    <div className="bc-page" style={{ display: "grid", gap: 14, paddingBottom: 40 }}>
      <BackButton />
      <h1 className="bc-screen-title" style={{ fontSize: "clamp(34px,11vw,56px)" }}>The Bandon Book</h1>
      <p className="bc-kicker" style={{ color: "var(--gold)", margin: 0, letterSpacing: 2, textTransform: "uppercase",
        fontFamily: '"Arial Narrow",Impact', fontStyle: "italic", fontWeight: 900 }}>
        Call it. Lock it in. Bragging rights only.
      </p>

      {/* Standings */}
      <div className="panel" style={{ padding: 14, display: "grid", gap: 8 }}>
        <div style={{ fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", opacity: .85 }}>Standings</div>
        {standings.length === 0 && <div style={{ opacity: .6 }}>No calls resolved yet.</div>}
        {standings.map((s: any, i: number) => (
          <div key={s.playerId} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 22, textAlign: "right", opacity: .6 }}>{i + 1}</span>
            <span style={{ flex: 1, fontWeight: 700 }}>
              {s.name} {s.titles.map((t: string) => <span key={t} title="title" style={{ marginLeft: 4 }}>{t}</span>)}
            </span>
            <span className="g" style={{ fontVariantNumeric: "tabular-nums" }}>
              {s.correct}<span style={{ opacity: .5 }}>/{s.resolvedPicked}</span>
            </span>
          </div>
        ))}
      </div>

      <PostProp me={me} onPosted={refresh} />

      {/* Props */}
      {props.length === 0 && <div style={{ opacity: .6, textAlign: "center" }}>No props yet — post the first one.</div>}
      {props.map((p: any) => (
        <PropCard key={p.id} p={p} me={me} admin={admin} busy={busy}
          name={name} onPick={pick} onLock={lock} onResolve={resolve} />
      ))}
    </div>
  );
}

function PropCard({ p, me, admin, busy, name, onPick, onLock, onResolve }: {
  p: any; me: string | null; admin: boolean; busy: boolean; name: (id: string) => string;
  onPick: (propId: string, optionId: string) => void;
  onLock: (propId: string) => void;
  onResolve: (propId: string, optionId: string) => void;
}) {
  const closed = p.status !== "open";
  const resolved = p.status === "resolved";
  const statusLabel = resolved ? "✓ RESOLVED" : p.status === "locked" ? "🔒 PICKS CLOSED" : "OPEN";
  return (
    <div className="panel" style={{ padding: 14, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>{p.subject}</div>
        <div style={{ fontSize: 12, opacity: .7, whiteSpace: "nowrap" }}>{statusLabel}</div>
      </div>
      {p.description && <div style={{ opacity: .8, fontSize: 14 }}>{p.description}</div>}

      <div style={{ display: "grid", gap: 8 }}>
        {p.options.map((o: any) => {
          const mine = p.myPick === o.id;
          const winner = resolved && p.winningOptionId === o.id;
          const canPick = !closed && !!me && !p.myPick && !busy;
          return (
            <button key={o.id} className="btn"
              disabled={!canPick}
              onClick={() => canPick && onPick(p.id, o.id)}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                opacity: canPick || mine || winner ? 1 : .6,
                borderColor: winner ? "var(--gold)" : mine ? "var(--gold)" : undefined,
                boxShadow: winner ? "0 0 0 2px var(--gold) inset" : undefined,
              }}>
              <span>{winner && "🏆 "}{o.label}{mine && " ✓"}</span>
              <span style={{ opacity: .6, fontVariantNumeric: "tabular-nums" }}>{o.pickCount}</span>
            </button>
          );
        })}
      </div>

      {/* Who picked what — friends; transparency is the fun. */}
      {p.picks.length > 0 && (
        <div style={{ fontSize: 12, opacity: .7 }}>
          {p.options.map((o: any) => {
            const who = p.picks.filter((pk: any) => pk.optionId === o.id).map((pk: any) => name(pk.playerId));
            return who.length ? <div key={o.id}><b>{o.label}:</b> {who.join(", ")}</div> : null;
          })}
        </div>
      )}

      {/* Inline admin controls (commish only). */}
      {admin && !resolved && (
        <div style={{ display: "grid", gap: 6, borderTop: "1px solid rgba(255,255,255,.12)", paddingTop: 10 }}>
          {p.status === "open" && (
            <button className="bc-ghost" disabled={busy} onClick={() => onLock(p.id)}>🔒 Lock picks</button>
          )}
          <div style={{ fontSize: 12, opacity: .7 }}>Resolve — pick the winner:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {p.options.map((o: any) => (
              <button key={o.id} className="bc-ghost" disabled={busy} onClick={() => onResolve(p.id, o.id)}>{o.label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PostProp({ me, onPosted }: { me: string | null; onPosted: () => void }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);

  if (!me) return <div style={{ opacity: .6, textAlign: "center", fontSize: 13 }}>Log in (Press Start) to post props or make picks.</div>;
  if (!open) return <button className="bc-ghost" onClick={() => setOpen(true)}>+ Post a prop</button>;

  const setOpt = (i: number, v: string) => setOptions((a) => a.map((x, j) => (j === i ? v : x)));

  async function submit() {
    const labels = options.map((o) => o.trim()).filter(Boolean);
    if (!subject.trim() || labels.length < 2) { alert("Need a subject and at least 2 options."); return; }
    setBusy(true);
    try {
      await api.bookProp({ creator: me!, subject: subject.trim(), description: description.trim() || undefined, options: labels });
      setSubject(""); setDescription(""); setOptions(["", ""]); setOpen(false);
      onPosted();
    } catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="panel" style={{ padding: 14, display: "grid", gap: 8 }}>
      <div style={{ fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>New prop</div>
      <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (e.g. Bruce's first tee shot)" style={{ padding: 12 }} />
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Flavor text (optional)" style={{ padding: 12 }} />
      {options.map((o, i) => (
        <div key={i} style={{ display: "flex", gap: 6 }}>
          <input value={o} onChange={(e) => setOpt(i, e.target.value)} placeholder={`Option ${i + 1}`} style={{ padding: 12, flex: 1 }} />
          {options.length > 2 && <button className="bc-ghost" onClick={() => setOptions((a) => a.filter((_, j) => j !== i))}>✕</button>}
        </div>
      ))}
      {options.length < 8 && <button className="bc-ghost" onClick={() => setOptions((a) => [...a, ""])}>+ Add option</button>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn" disabled={busy} onClick={submit} style={{ flex: 1 }}>Post</button>
        <button className="bc-ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Route `/book` in `src/App.tsx`**

Add the import after the other screen imports:

```ts
import { Book } from "./screens/Book";
```

Add a branch in the public routing section. Change:

```tsx
  else if (path.startsWith("/rules")) screen = <Rules />;
```

to:

```tsx
  else if (path.startsWith("/rules")) screen = <Rules />;
  else if (path.startsWith("/book")) screen = <Book />;
```

- [ ] **Step 4: Add a Home link in `src/screens/Home.tsx`**

In the CTA block, change the second `bc-row`:

```tsx
        <div className="bc-row">
          <button className="bc-ghost" onClick={() => go("/score?round=" + scoreTarget)}>Enter / Fix Another Round</button>
          <button className="bc-ghost" onClick={() => go("/rules")}>How It Works</button>
        </div>
```

to add a Book link row:

```tsx
        <div className="bc-row">
          <button className="bc-ghost" onClick={() => go("/score?round=" + scoreTarget)}>Enter / Fix Another Round</button>
          <button className="bc-ghost" onClick={() => go("/rules")}>How It Works</button>
        </div>
        <div className="bc-row">
          <button className="bc-ghost" onClick={() => go("/book")}>The Book 🎲</button>
        </div>
```

- [ ] **Step 5: Typecheck + build + full test suite**

Run: `npx tsc --noEmit && npm run build && npm test`
Expected: tsc clean, build succeeds, all tests PASS.

- [ ] **Step 6: Manual smoke test (optional but recommended)**

Run: `npm run dev`, open the app, log in with the admin passcode (`commish26`), pick your name, go to **The Book**. Verify: post a prop, make a pick (locks after one tap), Lock and Resolve buttons appear inline, resolving updates standings.

- [ ] **Step 7: Commit**

```bash
git add src/state/useBook.ts src/screens/Book.tsx src/App.tsx src/screens/Home.tsx
git commit -m "feat(book): /book screen — props, picks, standings, post form, inline admin"
```

---

## Self-review notes (for the implementer)

- **Identity/trust:** creator and bettor player ids are passed in the request body (`creator`, `playerId`), exactly like the existing `/score` route — the session only carries role, not which of the 8 players the device is. The server gates writes by role (`requireSession`/`requireAdmin`); player attribution is by selected player, consistent with the rest of the app.
- **One-pick enforcement** is the DB `UNIQUE(prop_id, player_id)` (Task 1, verified in Task 4's duplicate-pick test) — never an UPDATE.
- **Test isolation:** worker tests reuse one D1 per file, so every prop/option/pick id is unique (random UUIDs from the routes, or distinct literal ids in the schema test).
- **No TV/kiosk, no money/odds, no offline-queued writes, no prop editing/deleting** — all explicitly out of scope per the spec.
