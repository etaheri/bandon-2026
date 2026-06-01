# Tee Sheet Round Details & Group Score Entry — Design

**Date:** 2026-05-31
**Status:** Approved (pending spec review)

## Summary

Two frontend-only enhancements to the Bandon Cup '26 app:

1. **Tee sheet** shows each round's course, par, and date (in addition to the
   existing label, day, and tee time).
2. **Score entry** becomes group-based and hole-by-hole: any logged-in player
   can enter scores for everyone in their foursome, one hole at a time
   (Golf Genius style), instead of each player entering only their own card.

No backend, schema, or API changes are required. `POST /api/score` already
accepts an arbitrary `playerId`, and the offline queue is already keyed by
`roundId:playerId:hole`, so a single device can write the whole group's scores
today. Last-write-wins on `updated_at` already resolves concurrent edits.

## Out of scope / non-goals

- **Yardage on the tee sheet.** The `courses` table has only `id, name, par`
  (see `migrations/0001_init.sql`). Yardage would require a schema column plus
  real numbers for all 5 courses; deferred. Par is shown; yardage is not.
- No "designated scorer" role — any group member may enter/edit any group
  member's scores (explicitly chosen).
- No changes to the scoring engine, leaderboard, auth, or admin screens.

## 1. Tee Sheet — course, par, date

**File:** `src/screens/TeeSheet.tsx`

Data is already present in the `/api/state` payload consumed by `useTrip()`:
- `state.courses` — `{ id, name, par }[]`
- `state.rounds` — includes `courseId` and `date` (YYYY-MM-DD)

Add a course lookup `courseOf(courseId) -> course` and enrich each round
panel header.

- **Before:** `Round 1` · `THU 7:30 AM`
- **After:** title `Round 1 — Pacific Dunes`; meta line
  `Thu 6/4 · 7:30 AM · Par 72` with ` · 2×` appended when `r.doublePoints`.

Date formatting reuses whatever the rest of the app uses for `r.date` →
`Thu 6/4` (e.g. day-of-week abbreviation + `M/D`). If the existing day field
(`r.day`, e.g. `THU`) already conveys the weekday, the formatted date adds the
calendar `M/D`. Missing course (bad `courseId`) degrades gracefully to the
current label-only header.

## 2. Group Score Entry — hole-by-hole, all players

**File:** `src/screens/ScoreEntry.tsx` (rework). `src/ui/ScorePad.tsx` reused
unchanged. Saving plumbing (`enqueue`, `flushQueue`, `startAutoSync`) unchanged.

### Group resolution

The round endpoint (`/api/round/:id`) returns `round`, `holes`, `scores` but
**not** tee assignments. Pull `players` and `teeAssignments` from the existing
`useTrip()` cache (already loaded app-wide) and:

1. Find the logged-in player's `group_no` for `roundId` in `teeAssignments`.
2. Collect all `player_id`s with that `(round_id, group_no)` → the group
   (ordered by name or assignment order) — the players shown for entry.
3. **Fallback:** if the logged-in player has no assignment for this round,
   show only themselves (preserves today's single-player behavior).

### State

`scores` becomes `Record<playerId, Record<hole, number | null>>`, seeded from
`r.scores` for every group member (not just `me`).

### Per-hole UI

- Header: `‹ back` · `{round.label} · Hole {hole}` · `Par {h.par}`.
- One row per group member: player name + current score chip
  (`null` → blank/hole number, `0` → `PU`, else the gross).
- Tapping a player's row opens an inline `ScorePad` for that player (with the
  **Pick Up** action). Selecting a value saves and collapses the row.
- `save(playerId, gross)`:
  `setScores` (nested update) → `enqueue({ roundId, playerId, hole, gross, updatedAt: Date.now() })`
  → `flushQueue()`.

### Navigation

- `Prev` / `Next` buttons (disabled at hole 1 / 18) plus the existing bottom
  hole-grid navigator.
- **Auto-advance:** after a save, if **all** group members now have a non-`null`
  score for the current hole and `hole < 18`, advance to the next hole.
- Hole-grid cell color: **green** when all group members have a score for that
  hole, **amber** when partial, default when none.

## Risks / edge cases

- **Two devices editing the same player's hole:** resolved by existing
  last-write-wins (`updated_at`). Acceptable.
- **Group of fewer/more than 4** (e.g. odd assignment): UI renders one row per
  assigned member; no hard-coded count of 4.
- **Offline:** unchanged — each group member's score queues independently and
  syncs on reconnect.

## Testing

- Tee sheet: render with seeded state, assert course name, par, and formatted
  date appear per counting round; assert `2×` marker on double-points round;
  assert graceful render when a `courseId` has no matching course.
- Group entry: given a logged-in player in group 1, assert all group members'
  rows render; saving a member enqueues with that member's `playerId`;
  auto-advance fires only when every member has a score; fallback to self when
  the player has no assignment for the round.
