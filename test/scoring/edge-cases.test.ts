import { describe, it, expect } from "vitest";
import { strokesReceived } from "../../src/scoring/strokes";
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

describe("holePoints — scale and floor", () => {
  it("net is gross minus strokes received (6 with 2 strokes = net par = 2)", () => {
    expect(holePoints({ gross: 6, par: 4, strokes: 2 })).toBe(2);
  });
  it("does not cap the upside (par5 net albatross = 5)", () => {
    expect(holePoints({ gross: 2, par: 5, strokes: 0 })).toBe(5);
  });
});

describe("clinchState — elimination branches", () => {
  it("ELIMINATED when the opponent has already clinched (5 vs 0, 2 left)", () => {
    expect(clinchState(5, 0, 2).driftwood).toBe("ELIMINATED");
  });
  it("ELIMINATED when its own max can't even force a 3.5 tie", () => {
    // gorse maxes at 1+2=3 < 3.5, so it can neither win nor reach a putt-off
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
