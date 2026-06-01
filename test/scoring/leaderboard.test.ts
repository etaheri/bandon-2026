import { describe, it, expect } from "vitest";
import { computeLeaderboard } from "../../src/scoring";
import type { Player, Round, Hole } from "../../src/scoring/types";

const par4 = (n: number): Hole => ({ number: n, par: 4, strokeIndex: n });
const holes = Array.from({ length: 18 }, (_, i) => par4(i + 1));
const courses = { c: { id: "c", name: "C", par: 72, holes } };

const players: Player[] = [
  { id: "g1", name: "G1", handicap: 0, quotaOverride: null, team: "GORSE" },
  { id: "d1", name: "D1", handicap: 0, quotaOverride: null, team: "DRIFTWOOD" },
];
const rounds: Round[] = [
  { id: "r2", courseId: "c", label: "R2", day: "THU", date: "2026-06-04", teeTime: "7:30", counts: true, doublePoints: false },
];

describe("computeLeaderboard", () => {
  it("produces team aggregates, cup tally, per-player rows, thru", () => {
    // g1 plays 18 net pars (gross 4 each) -> result 0 vs quota 36 -> -36? no: points 36 - quota 36 = 0
    const scoresByRound = { r2: { g1: Object.fromEntries(holes.map(h => [h.number, 4])), d1: { 1: 5 } } };
    const lb = computeLeaderboard({ players, rounds, courses, scoresByRound, allowance: 1 });
    // The single counting round is still in progress (d1 only thru 1), so it is not yet
    // decided: its 1 point sits in `available` rather than being awarded. Cup math must
    // still account for the round.
    expect(lb.cup.gorse + lb.cup.driftwood + lb.cup.available).toBe(1);
    expect(lb.players.find(p => p.playerId === "g1")!.thru).toBe("F");
    expect(lb.players.find(p => p.playerId === "d1")!.thru).toBe(1);
    expect(["GORSE","DRIFTWOOD"]).toContain(lb.leader);
  });
});
