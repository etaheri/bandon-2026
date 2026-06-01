import { describe, it, expect } from "vitest";
import { roundResult } from "../../src/scoring/round";
import type { Hole, Player, ScoreMap } from "../../src/scoring/types";

const holes: Hole[] = Array.from({ length: 18 }, (_, i) => ({ number: i + 1, par: 4, strokeIndex: i + 1 }));
const player: Player = { id: "p", name: "P", handicap: 12, quotaOverride: null, team: "GORSE" };

describe("roundResult", () => {
  it("flat quota of 36; full round of net pars yields result 0 vs allowance-adjusted strokes", () => {
    // playingHcp = round(12*0.75)=9 -> 9 strokes on SI1..9.
    // Make every hole net par: on stroked holes shoot 5 (net 4), else shoot 4.
    const scores: ScoreMap = {};
    for (const h of holes) scores[h.number] = h.strokeIndex <= 9 ? 5 : 4;
    const r = roundResult(player, holes, scores, { allowance: 0.75 });
    expect(r.holesPlayed).toBe(18);
    expect(r.points).toBe(36);        // all net pars
    expect(r.proratedQuota).toBe(36); // 36 * 18/18
    expect(r.result).toBe(0);
    expect(r.thru).toBe("F");
  });

  it("prorates quota by holes played mid-round", () => {
    const scores: ScoreMap = {};
    for (let n = 1; n <= 9; n++) scores[n] = (holes[n - 1]?.strokeIndex ?? n) <= 9 ? 5 : 4; // net par each
    const r = roundResult(player, holes, scores, { allowance: 0.75 });
    expect(r.holesPlayed).toBe(9);
    expect(r.points).toBe(18);
    expect(r.proratedQuota).toBe(18); // 36 * 9/18
    expect(r.result).toBe(0);
    expect(r.thru).toBe(9);
  });

  it("honors a quota override", () => {
    const p2: Player = { ...player, quotaOverride: 30 };
    const scores: ScoreMap = { 1: 4 }; // 1 hole, SI1 stroked -> net 3 -> birdie 3 pts
    const r = roundResult(p2, holes, scores, { allowance: 0.75 });
    expect(r.points).toBe(3);
    expect(r.proratedQuota).toBeCloseTo(30 * (1 / 18));
    expect(r.result).toBeCloseTo(3 - 30 / 18);
  });

  it("ignores null/unplayed holes", () => {
    const scores: ScoreMap = { 1: null, 2: 4 };
    const r = roundResult(player, holes, scores, { allowance: 0.75 });
    expect(r.holesPlayed).toBe(1);
  });

  it("treats gross 0 as a pick-up: played, zero points, counts toward proration", () => {
    const r = roundResult(player, holes, { 1: 0 }, { allowance: 0.75 });
    expect(r.holesPlayed).toBe(1);
    expect(r.points).toBe(0);
    expect(r.proratedQuota).toBeCloseTo(2);
    expect(r.result).toBeCloseTo(-2);
  });

  it("distinguishes pick-up (0) from not-played (null)", () => {
    const r = roundResult(player, holes, { 1: 0, 2: null }, { allowance: 0.75 });
    expect(r.holesPlayed).toBe(1);
  });
});
