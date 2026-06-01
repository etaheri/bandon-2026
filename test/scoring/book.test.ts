import { describe, it, expect } from "vitest";
import {
  computeStandings,
  type PropLite,
  type PickLite,
  type PlayerLite,
} from "../../src/scoring/book";

const players: PlayerLite[] = [
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

  it("awards no titles when nothing is resolved", () => {
    const props: PropLite[] = [
      { id: "p1", status: "open", winningOptionId: null },
      { id: "p2", status: "open", winningOptionId: null },
    ];
    const picks: PickLite[] = [
      { propId: "p1", optionId: "p1o1", playerId: "a" },
      { propId: "p2", optionId: "p2o1", playerId: "b" },
    ];
    const s = computeStandings(props, picks, players);
    for (const x of s) {
      expect(x.titles).toEqual([]);
      expect(x.correct).toBe(0);
      expect(x.hitRate).toBe(0);
    }
  });

  it("breaks sort ties by name when correct and hitRate are equal", () => {
    const props: PropLite[] = [{ id: "p1", status: "resolved", winningOptionId: "w1" }];
    const picks: PickLite[] = [
      { propId: "p1", optionId: "w1", playerId: "b" }, // Beth: 1 correct
      { propId: "p1", optionId: "w1", playerId: "a" }, // Aaron: 1 correct
    ];
    const s = computeStandings(props, picks, players);
    // Aaron and Beth both 1 correct / 100% hit rate; Aaron sorts first by name.
    expect(s[0].name).toBe("Aaron");
    expect(s[1].name).toBe("Beth");
  });

  it("does not award Sharpshooter when the best eligible hit rate is 0%", () => {
    const props: PropLite[] = [1, 2, 3].map((n) => ({
      id: `p${n}`, status: "resolved" as const, winningOptionId: `w${n}`,
    }));
    const picks: PickLite[] = [
      // a: 3 resolved picks, all wrong
      ...["p1", "p2", "p3"].map((id) => ({ propId: id, optionId: "x", playerId: "a" })),
      // b: 3 resolved picks, all wrong
      ...["p1", "p2", "p3"].map((id) => ({ propId: id, optionId: "x", playerId: "b" })),
    ];
    const s = computeStandings(props, picks, players);
    for (const x of s) expect(x.titles).not.toContain("🎯 Sharpshooter");
  });

  it("does not award Tank Job to the Oracle holder", () => {
    const props: PropLite[] = [1, 2, 3, 4, 5].map((n) => ({
      id: `p${n}`, status: "resolved" as const, winningOptionId: `w${n}`,
    }));
    const picks: PickLite[] = [
      // a is the only player with resolved picks: 3 correct + 2 wrong ->
      // both the most correct (Oracle) and the most wrong, but Oracle wins.
      { propId: "p1", optionId: "w1", playerId: "a" },
      { propId: "p2", optionId: "w2", playerId: "a" },
      { propId: "p3", optionId: "w3", playerId: "a" },
      { propId: "p4", optionId: "x", playerId: "a" },
      { propId: "p5", optionId: "x", playerId: "a" },
    ];
    const s = computeStandings(props, picks, players);
    const a = s.find((x) => x.playerId === "a")!;
    expect(a.titles).toContain("🔮 The Oracle");
    expect(a.titles).not.toContain("🚽 Tank Job");
  });
});
