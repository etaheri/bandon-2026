# Leaderboard polish + round progression + rules page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the scoring math, add a freshness/trust signal and broadcast-feel animations to the leaderboard, add round-complete ("FINAL") detection plus a manual round picker for score entry, and add a comprehensive public rules page.

**Architecture:** The scoring engine is a pure, unit-tested TypeScript module under `src/scoring/` shared by the worker and the client; we extend its test coverage and fix any bug surfaced. The React client is a tiny path-based router (`src/App.tsx`, `go()` helper). The leaderboard polls `/api/leaderboard` via the `useLeaderboard` hook; we extend that hook to report polling health and add small presentational components/hooks (`useFlashOnChange`, a freshness pill). Round metadata for the client lives in `src/data/broadcast.ts` (`SESSIONS`, `phaseAt`). Round completeness comes from the existing `roundCups[].decided` flag returned by `computeLeaderboard`.

**Tech Stack:** React 19 + Vite 8, framer-motion 12, Vitest 4, TypeScript 6, Hono + Cloudflare D1 (worker, untouched here).

**Important constraints:**
- Build **on top of the current uncommitted working tree** (an in-flight redesign of Home/theme/ScoreEntry/Login). Do **not** revert, stage, or commit those pre-existing changes. Each task below commits only the files it creates/edits, by explicit path.
- No round locking. Every round stays editable.
- All new motion must respect `prefers-reduced-motion`.

**Test command:** `npx vitest run <path>` for a single file; `npm test` for the whole suite.

---

### Task 1: Verify scoring math with regression tests (Part 1a)

Encode hand-worked expected values for the bug-prone edge cases as a new test file. If any assertion fails, that is a real bug in the module — fix the module, not the test. If all pass, the math is verified.

**Files:**
- Create: `test/scoring/edge-cases.test.ts`
- Possibly modify (only if a test fails): `src/scoring/strokes.ts`, `src/scoring/stableford.ts`, `src/scoring/cup.ts`, `src/scoring/crowns.ts`, `src/scoring/index.ts`

- [ ] **Step 1: Write the edge-case test file**

Create `test/scoring/edge-cases.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { playingHandicap, strokesReceived } from "../../src/scoring/strokes";
import { holePoints } from "../../src/scoring/stableford";
import { clinchState } from "../../src/scoring/cup";
import { playerOfTheTrip, dailyLowRounds } from "../../src/scoring/crowns";
import { computeLeaderboard } from "../../src/scoring";
import type { Player, Round, Hole } from "../../src/scoring/types";

describe("strokesReceived — wrap boundaries", () => {
  it("18 gives exactly one stroke on every hole (mod 18 == 0)", () => {
    expect(strokesReceived(18, 1)).toBe(1);
    expect(strokesReceived(18, 18)).toBe(1);
  });
  it("19 gives two strokes only on SI 1", () => {
    expect(strokesReceived(19, 1)).toBe(2);
    expect(strokesReceived(19, 2)).toBe(1);
  });
  it("36 gives two strokes on every hole", () => {
    expect(strokesReceived(36, 1)).toBe(2);
    expect(strokesReceived(36, 18)).toBe(2);
  });
});

describe("playingHandicap — rounds half up", () => {
  it("13.5 rounds to 14", () => {
    expect(playingHandicap(18, 0.75)).toBe(14);
  });
});

describe("holePoints — scale and floor", () => {
  it("par4: eagle 4, birdie 3, par 2, bogey 1, double 0, triple floors at 0", () => {
    expect(holePoints({ gross: 2, par: 4, strokes: 0 })).toBe(4);
    expect(holePoints({ gross: 3, par: 4, strokes: 0 })).toBe(3);
    expect(holePoints({ gross: 4, par: 4, strokes: 0 })).toBe(2);
    expect(holePoints({ gross: 5, par: 4, strokes: 0 })).toBe(1);
    expect(holePoints({ gross: 6, par: 4, strokes: 0 })).toBe(0);
    expect(holePoints({ gross: 7, par: 4, strokes: 0 })).toBe(0);
  });
  it("net is gross minus strokes received (6 with 2 strokes = net par = 2)", () => {
    expect(holePoints({ gross: 6, par: 4, strokes: 2 })).toBe(2);
  });
  it("does not cap the upside (par5 net albatross = 5)", () => {
    expect(holePoints({ gross: 2, par: 5, strokes: 0 })).toBe(5);
  });
});

describe("clinchState — elimination branches", () => {
  it("non-holder is ELIMINATED when its max can't reach RETAIN", () => {
    expect(clinchState(5, 0, 2).driftwood).toBe("ELIMINATED");
  });
  it("holder is ELIMINATED when it can't reach WIN and opponent passes RETAIN", () => {
    expect(clinchState(1, 5, 2).gorse).toBe("ELIMINATED");
  });
});

describe("crowns", () => {
  it("playerOfTheTrip sums per player and keeps the first on a tie", () => {
    const r = playerOfTheTrip([
      { playerId: "a", day: "THU", result: 3 },
      { playerId: "b", day: "THU", result: 1 },
      { playerId: "b", day: "FRI", result: 2 },
    ]);
    expect(r).toEqual({ playerId: "a", total: 3 }); // a=3, b=3, a seen first
  });
  it("dailyLowRounds keeps the best single result per day", () => {
    const out = dailyLowRounds([
      { playerId: "a", day: "THU", result: 1 },
      { playerId: "b", day: "THU", result: 4 },
      { playerId: "c", day: "FRI", result: 2 },
    ]);
    expect(out.THU).toEqual({ playerId: "b", result: 4 });
    expect(out.FRI).toEqual({ playerId: "c", result: 2 });
  });
});

describe("computeLeaderboard — a fully played round is decided and awards the cup point", () => {
  const holes: Hole[] = Array.from({ length: 18 }, (_, i) => ({ number: i + 1, par: 4, strokeIndex: i + 1 }));
  const courses = { c: { id: "c", name: "C", par: 72, holes } };
  const players: Player[] = [
    { id: "g1", name: "G1", handicap: 0, quotaOverride: null, team: "GORSE" },
    { id: "d1", name: "D1", handicap: 0, quotaOverride: null, team: "DRIFTWOOD" },
  ];
  const rounds: Round[] = [
    { id: "r2", courseId: "c", label: "R2", day: "THU", date: "2026-06-04", teeTime: "7:30", counts: true, doublePoints: false },
  ];
  it("both players through 18 -> decided, gorse wins the point, none left available", () => {
    const all4 = Object.fromEntries(holes.map(h => [h.number, 4]));   // g1: net par x18 -> 36 pts -> result 0
    const all5 = Object.fromEntries(holes.map(h => [h.number, 5]));   // d1: bogey x18 -> 18 pts -> result -18
    const lb = computeLeaderboard({ players, rounds, courses, scoresByRound: { r2: { g1: all4, d1: all5 } }, allowance: 1 });
    expect(lb.roundCups[0]!.decided).toBe(true);
    expect(lb.cup.gorse).toBe(1);
    expect(lb.cup.driftwood).toBe(0);
    expect(lb.cup.available).toBe(0);
  });
});
```

- [ ] **Step 2: Run the edge-case tests**

Run: `npx vitest run test/scoring/edge-cases.test.ts`
Expected: PASS. If anything FAILS, the module has a real bug — go to Step 3. If all PASS, skip to Step 4.

- [ ] **Step 3: Fix the module bug (only if a test failed)**

Open the module named by the failing assertion (e.g. `src/scoring/strokes.ts` for a strokes failure) and correct the logic so it matches the hand-worked expectation in the test. Do not weaken the test. Re-run Step 2 until green.

- [ ] **Step 4: Run the full scoring suite to confirm no regressions**

Run: `npx vitest run test/scoring`
Expected: PASS (all files).

- [ ] **Step 5: Commit**

```bash
git add test/scoring/edge-cases.test.ts
# include any scoring/*.ts you had to fix in Step 3:
# git add src/scoring/<fixed-file>.ts
git commit -m "test(scoring): verify edge cases (stroke wrap, points scale, clinch, decided round)"
```

---

### Task 2: Extract a testable poll-status function (Part 1b)

The freshness signal is derived from consecutive poll failures. Put that mapping in a pure, unit-tested function so the hook stays trivial.

**Files:**
- Create: `src/state/pollStatus.ts`
- Test: `test/state/pollStatus.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/state/pollStatus.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pollStatus } from "../../src/state/pollStatus";

describe("pollStatus", () => {
  it("is offline before any data has loaded", () => {
    expect(pollStatus(0, false)).toBe("offline");
  });
  it("is live when the last poll succeeded and data exists", () => {
    expect(pollStatus(0, true)).toBe("live");
  });
  it("is reconnecting after 1-2 consecutive failures with data", () => {
    expect(pollStatus(1, true)).toBe("reconnecting");
    expect(pollStatus(2, true)).toBe("reconnecting");
  });
  it("is offline after 3+ consecutive failures", () => {
    expect(pollStatus(3, true)).toBe("offline");
    expect(pollStatus(9, true)).toBe("offline");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/state/pollStatus.test.ts`
Expected: FAIL — cannot find module `src/state/pollStatus`.

- [ ] **Step 3: Write the implementation**

Create `src/state/pollStatus.ts`:

```ts
export type PollStatus = "live" | "reconnecting" | "offline";

/**
 * Map polling health to a user-facing freshness status.
 * - no data yet -> offline (nothing to trust)
 * - last poll ok -> live
 * - 1-2 recent failures (but we still have data) -> reconnecting
 * - 3+ failures -> offline (data is stale)
 */
export function pollStatus(consecutiveFailures: number, hasData: boolean): PollStatus {
  if (!hasData) return "offline";
  if (consecutiveFailures === 0) return "live";
  if (consecutiveFailures >= 3) return "offline";
  return "reconnecting";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/state/pollStatus.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state/pollStatus.ts test/state/pollStatus.test.ts
git commit -m "feat(leaderboard): pure poll-status mapping for freshness signal"
```

---

### Task 3: Make useLeaderboard report polling health (Part 1b)

**Files:**
- Modify: `src/state/useLeaderboard.ts` (whole file)

- [ ] **Step 1: Rewrite the hook**

Replace the entire contents of `src/state/useLeaderboard.ts` with:

```ts
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { pollStatus, type PollStatus } from "./pollStatus";

export interface LeaderboardState {
  lb: any;
  status: PollStatus;
  lastUpdatedAt: number | null; // epoch ms of last successful poll
}

export function useLeaderboard(intervalMs = 20000): LeaderboardState {
  const [lb, setLb] = useState<any>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [fails, setFails] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const tick = () =>
      api.leaderboard()
        .then(data => { setLb(data); setLastUpdatedAt(Date.now()); setFails(0); })
        .catch(() => setFails(f => f + 1));
    tick();
    timer.current = window.setInterval(tick, intervalMs);
    return () => clearInterval(timer.current);
  }, [intervalMs]);

  return { lb, status: pollStatus(fails, lb != null), lastUpdatedAt };
}
```

- [ ] **Step 2: Typecheck (the hook has no unit test; verify it compiles)**

Run: `npx tsc --noEmit`
Expected: no errors from `src/state/useLeaderboard.ts`. (Board still destructures the old shape — it will be fixed in Task 5; if tsc flags `Board.tsx` here, that is expected and resolved by Task 5. Prefer running Tasks 3 and 5 back-to-back.)

- [ ] **Step 3: Commit**

```bash
git add src/state/useLeaderboard.ts
git commit -m "feat(leaderboard): useLeaderboard returns status + lastUpdatedAt"
```

---

### Task 4: Add the flash-on-change hook + pop keyframes (Part 1c)

**Files:**
- Create: `src/ui/useFlashOnChange.ts`
- Modify: `src/ui/theme.ts` (add keyframes to the `themeCss` template string)

- [ ] **Step 1: Create the hook**

Create `src/ui/useFlashOnChange.ts`:

```ts
import { useEffect, useRef, useState } from "react";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Returns true for `ms` after `value` changes (never on first render).
 * No-op when the user prefers reduced motion.
 */
export function useFlashOnChange(value: unknown, ms = 700): boolean {
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    if (prefersReducedMotion()) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return flash;
}
```

- [ ] **Step 2: Add the keyframes to themeCss**

In `src/ui/theme.ts`, find the `@media (prefers-reduced-motion: reduce){` block near the end of the `themeCss` template (around line 145). Immediately **before** that `@media` block, insert:

```css
/* ---- score-change pop/flash (leaderboard broadcast feel) ---- */
@keyframes bc-pop{0%{transform:scale(1)}30%{transform:scale(1.18)}100%{transform:scale(1)}}
.bc-flash{animation:bc-pop .6s ease-out;text-shadow:0 0 10px currentColor}
@keyframes bc-pulse{0%,100%{filter:none}40%{filter:brightness(1.5) saturate(1.4)}}
.bc-pulse{animation:bc-pulse .9s ease-out}
```

Then, inside the existing `@media (prefers-reduced-motion: reduce){ ... }` block, add these two lines before its closing `}`:

```css
  .bc-flash{animation:none;text-shadow:none}
  .bc-pulse{animation:none;filter:none}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/ui/useFlashOnChange.ts src/ui/theme.ts
git commit -m "feat(leaderboard): flash-on-change hook + pop/pulse keyframes"
```

---

### Task 5: Wire freshness pill, FINAL header, and flash animations into the Board (Parts 1b, 1c, 2a)

**Files:**
- Modify: `src/screens/Board.tsx`

- [ ] **Step 1: Update the hook destructuring and imports**

In `src/screens/Board.tsx`, change the imports at the top to add the flash hook and the poll-status type:

```tsx
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLeaderboard } from "../state/useLeaderboard";
import type { PollStatus } from "../state/pollStatus";
import { useFlashOnChange } from "../ui/useFlashOnChange";
import { liveRound } from "../schedule";
import { BackButton } from "../ui/BackButton";
import { PlayerDetail } from "./PlayerDetail";
```

Change the first line inside `export function Board(...)` from:

```tsx
  const lb = useLeaderboard(tv ? 15000 : 20000);
```

to:

```tsx
  const { lb, status, lastUpdatedAt } = useLeaderboard(tv ? 15000 : 20000);
  const leaderFlip = useFlashOnChange(lb?.leader);
```

> The `leaderFlip` hook is placed **before** the `if (!lb) return …` early return so it is called on every render (Rules of Hooks). It uses optional chaining because `lb` is null on the first render.

- [ ] **Step 2: Compute FINAL state for the live round**

Just after the existing line `const liveCourse = live ? courses.find(c => c.id === live.courseId) : null;`, add:

```tsx
  const liveCup = (lb.roundCups ?? []).find((rc: any) => rc.roundId === liveId);
  const liveFinal = !!liveCup?.decided;
```

- [ ] **Step 3: Render the freshness pill and FINAL header**

Replace the existing live-header block:

```tsx
      <div className="head" style={{ textAlign: "center", margin: "10px 0", fontSize: 14 * scale,
        padding: "8px 10px", borderRadius: 8, background: live ? "linear-gradient(180deg,#1b3a31,#0c1c17)" : "transparent",
        boxShadow: live ? "var(--bevel)" : "none", opacity: live ? 1 : .7 }}>
        {live
          ? `● LIVE · ROUND ${countIndex} OF ${roundsMeta.length} · ${(liveCourse?.name ?? "").toUpperCase()} · PAR ${liveCourse?.par ?? ""} · ${live.day} ${live.teeTime}`
          : `${lb.cup.available > 0 ? "UP NEXT — see tee sheet" : "ALL DECIDED"} · first to 4 wins, 3.5 retains`}
      </div>
```

with:

```tsx
      <FreshnessPill status={status} lastUpdatedAt={lastUpdatedAt} scale={scale} />
      <div className="head" style={{ textAlign: "center", margin: "6px 0 10px", fontSize: 14 * scale,
        padding: "8px 10px", borderRadius: 8, background: live ? "linear-gradient(180deg,#1b3a31,#0c1c17)" : "transparent",
        boxShadow: live ? "var(--bevel)" : "none", opacity: live ? 1 : .7 }}>
        {live
          ? `${liveFinal ? "■ FINAL" : "● LIVE"} · ROUND ${countIndex} OF ${roundsMeta.length} · ${(liveCourse?.name ?? "").toUpperCase()} · PAR ${liveCourse?.par ?? ""} · ${live.day} ${live.teeTime}`
          : `${lb.cup.available > 0 ? "UP NEXT — see tee sheet" : "ALL DECIDED"} · first to 4 wins, 3.5 retains`}
      </div>
```

- [ ] **Step 4: Pulse the leading team bar on a lead flip**

Change the leading `TeamBar` usage to pass the flip flag. Replace:

```tsx
        <TeamBar team="GORSE" cup={lb.cup.gorse} agg={lb.teamAggregate.GORSE} clinch={lb.clinch.gorse} lead={leadGorse} scale={scale} />
```

with:

```tsx
        <TeamBar team="GORSE" cup={lb.cup.gorse} agg={lb.teamAggregate.GORSE} clinch={lb.clinch.gorse} lead={leadGorse} flip={leaderFlip && leadGorse} scale={scale} />
```

and replace:

```tsx
        <TeamBar team="DRIFTWOOD" cup={lb.cup.driftwood} agg={lb.teamAggregate.DRIFTWOOD} clinch={lb.clinch.driftwood} lead={!leadGorse} scale={scale} right />
```

with:

```tsx
        <TeamBar team="DRIFTWOOD" cup={lb.cup.driftwood} agg={lb.teamAggregate.DRIFTWOOD} clinch={lb.clinch.driftwood} lead={!leadGorse} flip={leaderFlip && !leadGorse} scale={scale} right />
```

- [ ] **Step 5: Flash the cup number in TeamBar**

Replace the whole `TeamBar` function with:

```tsx
function TeamBar({ team, cup, agg, clinch, lead, flip, scale, right }: any) {
  const color = team === "GORSE" ? "var(--gorse)" : "var(--driftwood)";
  const cupFlash = useFlashOnChange(cup);
  const clinchFlash = useFlashOnChange(clinch === "CLINCHED" ? "C" : clinch);
  return (
    <div className={flip ? "bc-pulse" : undefined} style={{ padding: 16, textAlign: right ? "right" : "left",
      background: lead ? color : `linear-gradient(${right ? "270deg" : "90deg"}, ${color}33, #0a1714)`,
      color: lead ? "#10231c" : "#fff" }}>
      <div className="head" style={{ fontSize: 20 * scale, color: lead ? "#10231c" : color }}>{team}</div>
      <div className={"head" + (cupFlash ? " bc-flash" : "")} style={{ fontSize: 56 * scale, lineHeight: 1, display: "inline-block" }}>{cup}</div>
      <div style={{ opacity: .9, fontSize: 13 * scale }}>{agg >= 0 ? "+" : ""}{agg} to quota</div>
      <div className={"head" + (clinchFlash && clinch === "CLINCHED" ? " bc-flash" : "")} style={{ marginTop: 4, fontSize: 11 * scale, display: "inline-block" }}>{clinch}</div>
    </div>
  );
}
```

- [ ] **Step 6: Flash the per-player numbers in Stat**

Replace the whole `Stat` function with:

```tsx
function Stat({ today, trip, thru, scale, right }: any) {
  const todayVal = today ? today.result : null;
  const tripFlash = useFlashOnChange(trip);
  const todayFlash = useFlashOnChange(todayVal);
  return (
    <div style={{ textAlign: right ? "left" : "right", fontVariantNumeric: "tabular-nums" }}>
      <div className={"head" + (tripFlash ? " bc-flash" : "")} style={{ fontSize: 16 * scale, color: trip >= 0 ? "#7CFFB2" : "#ff9a9a", display: "inline-block" }}>
        {trip >= 0 ? "+" : ""}{trip}
      </div>
      <div className={todayFlash ? "bc-flash" : undefined} style={{ fontSize: 10 * scale, opacity: .8 }}>
        {todayVal == null ? thru : `${todayVal >= 0 ? "+" : ""}${todayVal} · ${thru}`}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Mark decided rounds in the round strip**

In the `RoundStrip` function, replace the pill label line:

```tsx
            {label(rc.roundId)}{rc.double ? " 2×" : ""}
```

with:

```tsx
            {label(rc.roundId)}{rc.double ? " 2×" : ""}{decided ? " ✓" : ""}
```

- [ ] **Step 8: Add the FreshnessPill component**

At the end of `src/screens/Board.tsx`, add:

```tsx
function FreshnessPill({ status, lastUpdatedAt, scale }: { status: PollStatus; lastUpdatedAt: number | null; scale: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = lastUpdatedAt != null ? Math.max(0, Math.round((now - lastUpdatedAt) / 1000)) : null;
  let text: string, color: string;
  if (status === "offline") { text = "OFFLINE — SHOWING LAST KNOWN"; color = "var(--bad)"; }
  else if (status === "reconnecting") { text = "RECONNECTING…"; color = "var(--gold)"; }
  else { text = `● UPDATED ${secs ?? 0}s AGO`; color = "var(--good)"; }
  return (
    <div className="head" style={{ textAlign: "center", fontSize: 11 * scale, color, opacity: .85, letterSpacing: 1 }}>
      {text}
    </div>
  );
}
```

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 10: Build to confirm the client compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 11: Commit**

```bash
git add src/screens/Board.tsx
git commit -m "feat(board): freshness pill, FINAL header + strip mark, score/lead/clinch flash"
```

---

### Task 6: Manual round picker in ScoreEntry (Part 2b)

Add a chip strip at the top of the score-entry screen listing all six counting rounds with status, so anyone can jump to any round to enter or fix scores.

**Files:**
- Modify: `src/screens/ScoreEntry.tsx`

- [ ] **Step 1: Add imports for the schedule data, navigation, and leaderboard fetch**

In `src/screens/ScoreEntry.tsx`, add to the existing imports:

```tsx
import { go } from "../App";
import { SESSIONS, sessionStart, phaseAt } from "../data/broadcast";
```

- [ ] **Step 2: Fetch decided rounds once on mount**

Inside the `ScoreEntry` component, after the existing `const [scores, setScores] = useState<Scores>({});` line, add:

```tsx
  const [decided, setDecided] = useState<Set<string>>(new Set());
  useEffect(() => {
    api.leaderboard()
      .then((lb: any) => setDecided(new Set((lb.roundCups ?? []).filter((rc: any) => rc.decided).map((rc: any) => rc.roundId))))
      .catch(() => {});
  }, []);
```

- [ ] **Step 3: Render the round-picker chip strip**

In the returned JSX, immediately after the closing `</div>` of the `bc-topbar` block (the one containing the BackButton and `data.round.label`), insert:

```tsx
      <RoundPicker current={roundId} decided={decided} />
```

- [ ] **Step 4: Add the RoundPicker component**

At the end of `src/screens/ScoreEntry.tsx`, add:

```tsx
function RoundPicker({ current, decided }: { current: string; decided: Set<string> }) {
  const counting = SESSIONS.filter(s => s.roundId);
  const now = new Date();
  const phase = phaseAt(now);
  const liveRoundId = phase.kind === "LIVE" ? phase.live.roundId : null;
  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "2px 0 6px" }}>
      {counting.map(s => {
        const rid = s.roundId!;
        const isCurrent = rid === current;
        const status =
          decided.has(rid) ? "FINAL"
          : liveRoundId === rid ? "LIVE"
          : sessionStart(s).getTime() > now.getTime() ? "UPCOMING"
          : "OPEN";
        return (
          <button key={rid} onClick={() => go("/score?round=" + rid)}
            aria-current={isCurrent ? "true" : undefined}
            className="head"
            style={{
              flex: "0 0 auto", cursor: "pointer", borderRadius: 999, padding: "7px 12px",
              fontSize: 12, letterSpacing: .5, whiteSpace: "nowrap",
              border: isCurrent ? "1px solid var(--gold)" : "1px solid var(--line)",
              background: isCurrent ? "linear-gradient(180deg,#1b3a31,#0c1c17)" : "#0f1a17",
              color: isCurrent ? "var(--gold)" : "#cfeede",
            }}>
            {s.tag} · {status}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/screens/ScoreEntry.tsx
git commit -m "feat(score): round-picker chip strip with LIVE/FINAL/UPCOMING status"
```

---

### Task 7: Home — secondary "enter another round" CTA + don't nudge a finished round (Parts 2a, 2b)

**Files:**
- Modify: `src/screens/Home.tsx`

- [ ] **Step 1: Add imports and fetch decided rounds**

In `src/screens/Home.tsx`, add `useState` is already imported; add the API import near the other imports:

```tsx
import { api } from "../api/client";
```

Inside `Home`, after the existing `const players = usePlayers();` line, add:

```tsx
  const [decided, setDecided] = useState<Set<string>>(new Set());
  useEffect(() => {
    api.leaderboard()
      .then((lb: any) => setDecided(new Set((lb.roundCups ?? []).filter((rc: any) => rc.decided).map((rc: any) => rc.roundId))))
      .catch(() => {});
  }, []);
```

- [ ] **Step 2: Skip a finished round when choosing where "Enter Score" lands**

Find the existing `scoreRound` computation:

```tsx
  const scoreRound =
    (phase.kind === "LIVE" && phase.live.roundId) ||
    counting.find((s) => sessionStart(s).getTime() > now.getTime())?.roundId ||
    counting[counting.length - 1]!.roundId!;
```

Immediately after it, add:

```tsx
  // If the live/next round is already FINAL (all scores in), point at the next
  // counting round that still needs scores instead of nudging a finished one.
  const scoreTarget = decided.has(scoreRound)
    ? (counting.find((s) => s.roundId && !decided.has(s.roundId))?.roundId ?? scoreRound)
    : scoreRound;
```

- [ ] **Step 3: Use scoreTarget for the primary CTA and add a secondary round button**

In the CTA block, change the primary button's handler from `go("/score?round=" + scoreRound)` to `go("/score?round=" + scoreTarget)`:

```tsx
        <button className="bc-start" onClick={() => go("/score?round=" + scoreTarget)}>
          <span className="arw">▸</span> Press Start — Enter Score
        </button>
```

Then change the `bc-row` of ghost buttons from:

```tsx
        <div className="bc-row">
          <button className="bc-ghost" onClick={() => go("/board")}>Leaderboard</button>
          <button className="bc-ghost" onClick={() => go("/tee")}>Tee Sheet</button>
        </div>
```

to:

```tsx
        <div className="bc-row">
          <button className="bc-ghost" onClick={() => go("/board")}>Leaderboard</button>
          <button className="bc-ghost" onClick={() => go("/tee")}>Tee Sheet</button>
        </div>
        <div className="bc-row">
          <button className="bc-ghost" onClick={() => go("/score?round=" + scoreTarget)}>Enter / Fix Another Round</button>
          <button className="bc-ghost" onClick={() => go("/rules")}>How It Works</button>
        </div>
```

> Note: the `/rules` route is created in Task 8; this button is harmless until then (it navigates to a route that falls through to Home until Task 8 lands). Prefer running Task 8 next.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/screens/Home.tsx
git commit -m "feat(home): skip finished rounds for Enter Score; add round + rules links"
```

---

### Task 8: Comprehensive rules page (Part 3)

**Files:**
- Create: `src/screens/Rules.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the Rules screen**

Create `src/screens/Rules.tsx`:

```tsx
import { BackButton } from "../ui/BackButton";

function Section({ title, children }: { title: string; children: any }) {
  return (
    <section className="panel" style={{ padding: 16, marginBottom: 14 }}>
      <h2 className="head" style={{ margin: "0 0 8px", color: "var(--gold)", fontSize: 18 }}>{title}</h2>
      <div style={{ display: "grid", gap: 8, fontFamily: '"Arial Narrow", Impact, sans-serif', fontWeight: 700, lineHeight: 1.45 }}>
        {children}
      </div>
    </section>
  );
}

export function Rules() {
  return (
    <div className="bc-page">
      <div className="bc-topbar">
        <BackButton />
        <h1 className="bc-screen-title">How It Works</h1>
        <span className="sp" />
      </div>

      <Section title="The Format">
        <p style={{ margin: 0 }}>
          Eight players, two teams — <b style={{ color: "var(--gorse)" }}>Gorse</b> vs{" "}
          <b style={{ color: "var(--driftwood)" }}>Driftwood</b> — over six counting rounds (Thu–Sat) at Bandon Dunes.
          It's a Ryder-Cup-style team match: every round is worth cup points, and the team that wins the cup wins the trip.
        </p>
      </Section>

      <Section title="How Scoring Works — Net Stableford">
        <p style={{ margin: 0 }}>You earn <b>points per hole</b> based on your <b>net</b> score (gross minus handicap strokes):</p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Eagle (net) = 4 · Birdie = 3 · Par = 2 · Bogey = 1 · Double or worse = 0</li>
        </ul>
        <p style={{ margin: 0 }}>
          Handicap strokes use a <b>75% allowance</b>: your playing handicap = round(course handicap × 0.75).
          You receive strokes on the hardest holes first (by stroke index). Above 18, you get a second stroke on the hardest holes.
        </p>
        <p style={{ margin: 0 }}>
          Your round result is your points versus a <b>flat quota of 36</b>. The board prorates the quota by how many holes
          you've played, so mid-round numbers are fair: <b>result = points so far − 36 × (holes played ÷ 18)</b>.
          Plus is good. A pick-up counts as a played hole worth 0 points.
        </p>
      </Section>

      <Section title="Worked Example">
        <p style={{ margin: 0 }}>
          Matt plays off 16 (playing handicap 16). On a par-4 with stroke index 3, he receives <b>1 stroke</b> (16 ≥ 3).
          He shoots a gross <b>5</b> → net <b>4</b> → that's a net par → <b>2 points</b>.
        </p>
        <p style={{ margin: 0 }}>
          Do that for all 18 holes and add them up. If he finishes with <b>34 points</b>, his round result is
          <b> 34 − 36 = −2</b>. Through 9 holes with 18 points, the prorated quota is 18, so he'd be <b>even (0)</b>.
        </p>
      </Section>

      <Section title="How the Cup Is Won">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Each round, the team with the better <b>combined result</b> wins <b>1 cup point</b>. Ties split <b>0.5 / 0.5</b>.</li>
          <li>The <b>Saturday afternoon finale (Round 6) is worth double — 2 points</b>.</li>
          <li><b>7 points</b> are available in total. <b>First to 4 wins the cup; 3.5 retains it.</b></li>
          <li>The board tracks clinch state — <b>CLINCHED / RETAINS / ALIVE / MUST WIN FINALE / ELIMINATED</b> — like a real broadcast.</li>
        </ul>
      </Section>

      <Section title="The Crowns">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>🏆 <b>Player of the Trip</b> — best cumulative round result across all counting rounds.</li>
          <li><b>Daily Low Round</b> — best single round result each day.</li>
        </ul>
      </Section>

      <Section title="The Bandon Book (Play-Money Sportsbook)">
        <p style={{ margin: 0 }}>Side action for bragging rights — no real money. Everyone starts with <b>10,000 Gorse Gold</b>.</p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Anyone can post a <b>prop</b>: a subject and two or more outcomes, each with American odds.</li>
          <li>Bet Gorse Gold on any open prop. Your stake is deducted when you place the bet.</li>
          <li>Payout on a win: <b>profit = odds &gt; 0 ? stake × odds/100 : stake × 100/|odds|</b>. Lose and you forfeit the stake.</li>
          <li>The creator locks the prop before the event, then settles it by picking the winner.</li>
          <li>Titles: 🦈 The Shark (top balance) · 💸 The Degenerate (most bets) · 🔥 Biggest Single Win · 🚽 Tilted (bottom balance).</li>
        </ul>
        <p style={{ margin: 0, opacity: .7 }}>The Book launches as its own feature — these are the rules it runs on.</p>
      </Section>

      <div className="bc-foot" style={{ textAlign: "center", opacity: .6, marginTop: 8 }}>
        Bandon Sports — It's In The Game
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the public `/rules` route**

In `src/App.tsx`, add the import alongside the other screen imports:

```tsx
import { Rules } from "./screens/Rules";
```

Then add a route branch. Change:

```tsx
  if (path.startsWith("/board")) screen = <Board tv={tv} />;
  else if (path.startsWith("/tee")) screen = <TeeSheet />;
```

to:

```tsx
  if (path.startsWith("/board")) screen = <Board tv={tv} />;
  else if (path.startsWith("/rules")) screen = <Rules />;
  else if (path.startsWith("/tee")) screen = <TeeSheet />;
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Rules.tsx src/App.tsx
git commit -m "feat(rules): comprehensive public rules page at /rules"
```

---

### Task 9: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the entire test suite**

Run: `npm test`
Expected: all tests pass (the pre-existing suite plus the new `edge-cases` and `pollStatus` tests).

- [ ] **Step 2: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual smoke (optional but recommended)**

Run: `npm run dev`, then in a browser:
- `/board` — freshness pill shows "UPDATED Ns AGO"; numbers flash on change; a fully-scored round reads FINAL.
- `/score?round=r2` — round-picker chips switch rounds; FINAL shows on completed rounds.
- `/rules` — all sections render and read correctly.
- Home — "How It Works" opens the rules page; "Enter / Fix Another Round" opens score entry with the picker.

---

## Notes for the implementer

- **Do not commit the pre-existing uncommitted working-tree changes.** Stage only the files each task names. Run `git status` before each commit to confirm you aren't sweeping in unrelated in-flight work.
- Tasks 3 and 5 are coupled (the hook shape changes in 3, the Board consumes it in 5) — run them back-to-back so `tsc` is clean between commits.
- Task 7's "How It Works" button targets `/rules`, created in Task 8 — run Task 8 right after Task 7.
- If Task 1's tests reveal a scoring bug, fixing it may change board numbers; that's the point — the fix is correct, the prior behavior was the bug.
