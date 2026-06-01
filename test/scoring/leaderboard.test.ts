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

  it("awards the cup point once every player finishes the round", () => {
    // Both finish 18 holes: g1 at net par (gross 4) -> result 0; d1 one over
    // (gross 5) -> 18 bogeys -> 18 pts -> result -18. Gorse wins the round.
    const fin = (g: number) => Object.fromEntries(holes.map(h => [h.number, g]));
    const scoresByRound = { r2: { g1: fin(4), d1: fin(5) } };
    const lb = computeLeaderboard({ players, rounds, courses, scoresByRound, allowance: 1 });

    const r2 = lb.roundCups.find(rc => rc.roundId === "r2")!;
    expect(r2.decided).toBe(true);
    expect(r2.gorse).toBe(1);
    expect(r2.driftwood).toBe(0);
    expect(lb.cup).toEqual({ gorse: 1, driftwood: 0, available: 0 });
    expect(lb.leader).toBe("GORSE");
  });

  it("exposes per-player per-round results, roundCups, and metadata", () => {
    const scoresByRound = { r2: { g1: Object.fromEntries(holes.map(h => [h.number, 4])), d1: { 1: 5 } } };
    const lb = computeLeaderboard({ players, rounds, courses, scoresByRound, allowance: 1 });

    const g1 = lb.players.find(p => p.playerId === "g1")!;
    expect(g1.perRound.r2).toBeDefined();
    expect(g1.perRound.r2!.thru).toBe("F");
    const d1 = lb.players.find(p => p.playerId === "d1")!;
    expect(d1.perRound.r2!.thru).toBe(1);

    expect(lb.roundCups.length).toBe(1);
    expect(lb.roundCups[0]!.roundId).toBe("r2");

    expect(lb.rounds.find(r => r.id === "r2")).toBeDefined();
    expect(lb.courses.find(c => c.id === "c")).toBeDefined();
    expect(typeof lb.allowance).toBe("number");
  });
});
