import { describe, it, expect } from "vitest";
import { playerOfTheTrip, dailyLowRounds } from "../../src/scoring/crowns";

const rr = (playerId: string, day: string, result: number) => ({ playerId, day, result });

describe("crowns", () => {
  it("playerOfTheTrip = best cumulative result", () => {
    const all = [rr("a", "THU", 5), rr("a", "FRI", 4), rr("b", "THU", 8)];
    expect(playerOfTheTrip(all)).toEqual({ playerId: "a", total: 9 });
  });
  it("dailyLowRounds = best single result per day", () => {
    const all = [rr("a", "THU", 5), rr("b", "THU", 8), rr("a", "FRI", 2), rr("b", "FRI", 6)];
    expect(dailyLowRounds(all)).toEqual({ THU: { playerId: "b", result: 8 }, FRI: { playerId: "b", result: 6 } });
  });
});
