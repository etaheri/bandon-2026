import { describe, it, expect } from "vitest";
import { cupPointsForRound, tallyCup, clinchState } from "../../src/scoring/cup";

describe("cupPointsForRound", () => {
  it("awards 1 to the better combined team result", () => {
    expect(cupPointsForRound(10, 6, false)).toEqual({ gorse: 1, driftwood: 0 });
    expect(cupPointsForRound(4, 9, false)).toEqual({ gorse: 0, driftwood: 1 });
  });
  it("splits ties 0.5/0.5", () => {
    expect(cupPointsForRound(7, 7, false)).toEqual({ gorse: 0.5, driftwood: 0.5 });
  });
  it("doubles the finale", () => {
    expect(cupPointsForRound(10, 6, true)).toEqual({ gorse: 2, driftwood: 0 });
    expect(cupPointsForRound(7, 7, true)).toEqual({ gorse: 1, driftwood: 1 });
  });
});

describe("tallyCup", () => {
  it("sums only completed counting rounds and reports points available", () => {
    // r2 gorse wins(1), r3 tie(.5/.5), r7 finale not yet decided
    const t = tallyCup([
      { gorse: 1, driftwood: 0, double: false, decided: true },
      { gorse: 0.5, driftwood: 0.5, double: false, decided: true },
      { gorse: 0, driftwood: 0, double: true, decided: false },
    ]);
    expect(t.gorse).toBe(1.5);
    expect(t.driftwood).toBe(0.5);
    expect(t.available).toBe(2); // undecided finale worth 2
  });
});

describe("clinchState", () => {
  it("CLINCHED when lead exceeds remaining", () => {
    expect(clinchState(4, 1, 2).gorse).toBe("CLINCHED");
  });
  it("retains at 3.5 of 7 (cannot be caught past tie)", () => {
    // 3.5 vs 2.5, 1 available: leader (holder) stays >= tie -> RETAINS
    expect(clinchState(3.5, 2.5, 1).gorse).toBe("RETAINS");
  });
  it("surfaces MUST WIN FINALE when a single finale (available=2) decides it", () => {
    // label(2,3,false): trailing non-holder, available===2, me<them -> MUST WIN FINALE
    expect(clinchState(3, 2, 2).driftwood).toBe("MUST WIN FINALE");
    // label(2,3,true): trailing holder, available===2, me<them -> MUST WIN FINALE
    expect(clinchState(2, 3, 2).gorse).toBe("MUST WIN FINALE");
  });
});
