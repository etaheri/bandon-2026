import { describe, it, expect } from "vitest";
import { holePoints } from "../../src/scoring/stableford";

describe("holePoints (net stableford)", () => {
  // par 4, no strokes
  it("scores par=2, bogey=1, double=0, birdie=3, eagle=4", () => {
    expect(holePoints({ gross: 4, par: 4, strokes: 0 })).toBe(2);
    expect(holePoints({ gross: 5, par: 4, strokes: 0 })).toBe(1);
    expect(holePoints({ gross: 6, par: 4, strokes: 0 })).toBe(0);
    expect(holePoints({ gross: 7, par: 4, strokes: 0 })).toBe(0); // floored
    expect(holePoints({ gross: 3, par: 4, strokes: 0 })).toBe(3);
    expect(holePoints({ gross: 2, par: 4, strokes: 0 })).toBe(4);
  });
  it("applies received strokes to the net score", () => {
    // gross 5 on par 4 with 1 stroke = net 4 = par = 2 pts
    expect(holePoints({ gross: 5, par: 4, strokes: 1 })).toBe(2);
    // gross 5 on par 4 with 2 strokes = net 3 = birdie = 3 pts
    expect(holePoints({ gross: 5, par: 4, strokes: 2 })).toBe(3);
  });
});
