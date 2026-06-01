import { describe, it, expect } from "vitest";
import { balanceTeams } from "../../src/scoring/teams";
import type { Player } from "../../src/scoring/types";

const P = (id: string, handicap: number): Player => ({
  id, name: id, handicap, quotaOverride: null, team: "GORSE",
});

// The real Bandon Cup '26 roster (handicap indexes).
const ROSTER: Player[] = [
  P("taheri", 4.6),
  P("desabio", 8.6),
  P("laflair", 8.6),
  P("stenzel", 14),
  P("meissner", 14),
  P("grattan", 15),
  P("sloan", 14.6),
  P("johnson", 10),
];

describe("balanceTeams", () => {
  it("produces even teams using every player exactly once", () => {
    const b = balanceTeams(ROSTER, 0.75);
    expect(b.teams.GORSE).toHaveLength(4);
    expect(b.teams.DRIFTWOOD).toHaveLength(4);
    const all = [...b.teams.GORSE, ...b.teams.DRIFTWOOD].sort();
    expect(all).toEqual(ROSTER.map((p) => p.id).sort());
  });

  it("balances total playing handicap to within one stroke", () => {
    const b = balanceTeams(ROSTER, 0.75);
    expect(Math.abs(b.playingTotals.GORSE - b.playingTotals.DRIFTWOOD)).toBeLessThanOrEqual(1);
  });

  it("splits the two lowest indexes across teams (comparable anchors)", () => {
    const b = balanceTeams(ROSTER, 0.75);
    // taheri (4.6) is the standout low man; he must not share a team with the
    // next-lowest pair, or one side hoards the consistency edge.
    const withTaheri = b.teams.GORSE.includes("taheri") ? b.teams.GORSE : b.teams.DRIFTWOOD;
    expect(withTaheri).not.toContain("desabio");
    expect(withTaheri).not.toContain("laflair");
  });

  it("reproduces the hand-picked split (33 vs 34)", () => {
    const b = balanceTeams(ROSTER, 0.75);
    expect([...b.teams.GORSE].sort()).toEqual(["desabio", "laflair", "meissner", "stenzel"]);
    expect([...b.teams.DRIFTWOOD].sort()).toEqual(["grattan", "johnson", "sloan", "taheri"]);
    expect(b.playingTotals.GORSE).toBe(34);
    expect(b.playingTotals.DRIFTWOOD).toBe(33);
  });

  it("is deterministic across input ordering", () => {
    const shuffled = [...ROSTER].reverse();
    const a = balanceTeams(ROSTER, 0.75);
    const b = balanceTeams(shuffled, 0.75);
    expect([...a.teams.GORSE].sort()).toEqual([...b.teams.GORSE].sort());
  });
});
