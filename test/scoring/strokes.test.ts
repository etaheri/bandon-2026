import { describe, it, expect } from "vitest";
import { playingHandicap, strokesReceived } from "../../src/scoring/strokes";

describe("playingHandicap", () => {
  it("applies allowance and rounds", () => {
    expect(playingHandicap(12, 0.75)).toBe(9);   // 9.0
    expect(playingHandicap(15, 0.75)).toBe(11);  // 11.25 -> 11
    expect(playingHandicap(18, 0.75)).toBe(14);  // 13.5 -> 14 (round half up)
    expect(playingHandicap(10, 1)).toBe(10);
  });
});

describe("strokesReceived", () => {
  it("gives one stroke on holes with SI <= playingHcp", () => {
    expect(strokesReceived(9, 1)).toBe(1);   // SI 1 within 9
    expect(strokesReceived(9, 9)).toBe(1);   // SI 9 within 9
    expect(strokesReceived(9, 10)).toBe(0);  // SI 10 outside 9
  });
  it("handles plus-18 handicaps (two strokes on hardest holes)", () => {
    expect(strokesReceived(20, 1)).toBe(2);  // base 1 + extra (SI1 <= 2)
    expect(strokesReceived(20, 2)).toBe(2);
    expect(strokesReceived(20, 3)).toBe(1);  // base 1 only
    expect(strokesReceived(20, 18)).toBe(1);
  });
  it("zero handicap gets nothing", () => {
    expect(strokesReceived(0, 1)).toBe(0);
  });
});
