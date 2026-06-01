import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { authCookie } from "./helpers";

describe("GET /api/leaderboard", () => {
  it("returns cup, aggregates, player rows, clinch", async () => {
    const cookie = await authCookie();
    await SELF.fetch("https://x/api/score", {
      method: "POST",
      headers: { Cookie: cookie, "content-type": "application/json" },
      body: JSON.stringify({
        roundId: "r2",
        playerId: "taheri",
        hole: 1,
        gross: 4,
        updatedAt: 2000,
      }),
    });
    const res = await SELF.fetch("https://x/api/leaderboard");
    expect(res.status).toBe(200);
    const b = await res.json<any>();
    expect(b).toHaveProperty("cup");
    expect(b).toHaveProperty("clinch");
    expect(b.players.length).toBe(8);
    expect(b).toHaveProperty("teamAggregate");
  });
  it("is public and includes perRound, roundCups, rounds, courses", async () => {
    const res = await SELF.fetch("https://x/api/leaderboard");
    expect(res.status).toBe(200);
    const b = await res.json<any>();
    expect(b.players[0]).toHaveProperty("perRound");
    expect(b).toHaveProperty("roundCups");
    expect(b).toHaveProperty("rounds");
    expect(b).toHaveProperty("courses");
    expect(typeof b.allowance).toBe("number");
  });
});
