# Leaderboard polish + round progression + rules page — Design Doc

**Date:** 2026-06-01
**Status:** Approved for planning

Three small, related improvements to the Bandon Cup '26 app, bundled into one spec→plan→implement cycle. The parody sportsbook ("The Bandon Book") remains a **separate** cycle to be done after this one.

These build **on top of the current working tree**, which contains a substantial in-flight redesign (Home, theme, ScoreEntry, Login — uncommitted). This work must not revert or disturb that in-flight work.

---

## Part 1 — Leaderboard

Three sub-goals (chosen by the user; bad-signal polling efficiency was explicitly deferred).

### 1a. Verify the math (correctness pass)

An adversarial correctness review of the pure scoring modules — `src/scoring/{strokes,stableford,round,cup,crowns,index}.ts` — against hand-worked examples. This is a **verification + targeted-fix** task, not a rewrite. Focus on the bug-prone spots:

- **Strokes received when `playingHcp > 18`** — the `base = floor(playingHcp/18)` + `extra = (stroke_index <= playingHcp mod 18)` wrap.
- **Prorated quota mid-round** — `proratedQuota = quota × holesPlayed/18` and `roundResult = pointsSoFar − proratedQuota`.
- **Pick-up sentinel** — gross `0` must count as a played hole worth 0 points, distinct from `null` (not played). Verify it flows correctly through `holesPlayed`, points, and `thru`.
- **Cup points** — 1 point to the better combined team result, ties split **0.5 / 0.5**, **double-point finale (R7) = 2 points**, total available 7.
- **Clinch state** — `CLINCHED / ALIVE / MUST WIN FINALE` correctness when the 2× finale keeps a 3–2 lead live.
- **Sort/tie ordering** of player rows on the board.

**Deliverable:** confidence that the math is right, any bugs fixed, and a regression test added for each edge case to the existing suite. No behavioral change unless a bug is found.

### 1b. Freshness/trust signal

`src/state/useLeaderboard.ts` currently swallows poll errors and returns only the data, so an offline phone silently shows stale numbers.

Change the hook to also return polling health:

```ts
useLeaderboard(intervalMs): {
  lb: Leaderboard | null;
  status: "live" | "reconnecting" | "offline";
  lastUpdatedAt: number | null;  // epoch ms of last successful poll
}
```

- A successful poll → `status: "live"`, updates `lastUpdatedAt`.
- 1 consecutive failure → `reconnecting`. N consecutive failures (e.g. ≥3) → `offline`.
- Backward-compatible: a successful first load still yields data.

Render a small freshness pill on the Board:
- Healthy: `● UPDATED {n}s AGO` (ticks every second so it stays honest).
- `reconnecting`: `RECONNECTING…`
- `offline`: `OFFLINE — SHOWING LAST KNOWN`

Shown on the phone board and, smaller/cornered, on TV mode.

### 1c. More broadcast feel

A small `useFlashOnChange(value)` hook (in `src/ui/`) that detects when a rendered number changes between polls and returns a transient flag to drive a brief pop + color-flash (framer-motion). Applied to:

- Each player's trip `+/-` and today number (`Stat` in `Board.tsx`).
- Each team's cup number and aggregate (`TeamBar`).
- **Leader flip** — when `lb.leader` changes, the newly-leading team bar pulses once.
- **Clinch moment** — when a team's clinch state becomes `CLINCHED`, gold flash on the clinch tag.

All motion respects `prefers-reduced-motion` (no flashing when the user opts out).

---

## Part 2 — Round progression

Current behavior (unchanged baseline): round status is purely time-based and device-local (`src/schedule.ts`) — a round is `LIVE` from its tee time until the next round's tee time. Home points "Enter Score" at the live round. Nothing locks; any round's scores are editable anytime. **No locking is added** — late corrections must always be possible.

### 2a. "FINAL" detection

The engine already computes per-round `decided` (every player through 18) in `computeLeaderboard` (`roundCups[].decided`). Surface it:

- The round-strip pill (`RoundStrip` in `Board.tsx`) and the board header show **FINAL** for a decided round instead of the "in progress" treatment.
- Home stops nudging people toward a round that is already `decided`/FINAL.

### 2b. Manual round picker

`ScoreEntry` already reads `?round=` and defaults to `r2`. Add explicit round-switching:

- A compact **round-selector chip strip** at the top of `ScoreEntry` — all 6 counting rounds as chips labeled with status (`LIVE` / `FINAL` / `UPCOMING` / date). Tapping a chip switches the round being entered (`go("/score?round=rX")`).
- A secondary **"Enter a different round"** affordance on Home, under the primary live-round CTA.

Every round stays editable; the picker just removes the dependence on the clock for *which* round you can touch.

---

## Part 3 — Rules page

New **public** screen `src/screens/Rules.tsx` at `/rules` (added to the path router in `App.tsx`, no login required), linked from Home. Themed to match the rest of the app (chrome panels, gold Impact/Arial-Black uppercase headers). Comprehensive — the single source of truth for how the competition works — with a worked example.

Sections:

1. **How scoring works** — net Stableford; 75% handicap allowance → playing handicap → strokes received per hole (incl. the >18 wrap); flat **36** quota for everyone; prorated mid-round so the live board is fair.
2. **Worked example** — one hole end to end for one player (e.g. a stroke-index-3 par-4, 16 playing handicap → receives 1 stroke → gross 5 → net 4 → par → **2 points**), then how the round result rolls up vs the prorated quota.
3. **How the Cup is won** — 1 cup point per round to the better combined team result; ties split **0.5 / 0.5**; **double-point Saturday finale**; total available **7**; **first to 4 wins, 3.5 retains**; clinch tracker.
4. **The crowns** — 🏆 Player of the Trip (best cumulative round result), Daily Low Round (best single round per day).
5. **The Bandon Book** — bankroll (10,000 Gorse Gold to start), how props and wagers work, American-odds payout math (`profit = odds>0 ? stake×odds/100 : stake×100/|odds|`; stake deducted at placement), and the titles (🦈 The Shark / 💸 The Degenerate / 🔥 Biggest Single Win / 🚽 Tilted). Documents the Book's rules now even though the Book feature is built in the next cycle — so this page is complete and the Book plugs into a described system.

---

## Out of scope

- Bad-signal polling efficiency (ETag/304, pause-when-hidden, backoff) — explicitly deferred.
- Round locking / finalization — explicitly not wanted.
- The Bandon Book feature itself (routes + UI) — its own separate spec→plan→implement cycle, next.
- Touching or reverting the uncommitted in-flight redesign.

## Files touched (anticipated)

- `src/scoring/*` — verification, possible fixes; `test/` — new regression tests.
- `src/state/useLeaderboard.ts` — return polling health.
- `src/screens/Board.tsx` — freshness pill, FINAL surfacing, flash-on-change wiring.
- `src/ui/useFlashOnChange.ts` (new) — change-detection animation hook.
- `src/screens/ScoreEntry.tsx` — round-selector chip strip.
- `src/screens/Home.tsx` — "enter a different round" affordance; suppress FINAL nudges; Rules link.
- `src/screens/Rules.tsx` (new) + `src/App.tsx` — new public route.
