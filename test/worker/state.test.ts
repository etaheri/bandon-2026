import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("GET /api/state", () => {
  it("is public (no auth needed) and returns players", async () => {
    const res = await SELF.fetch("https://x/api/state");
    expect(res.status).toBe(200);
    const body = await res.json<any>();
    expect(body.players.length).toBe(8);
  });
  it("returns rounds, tee sheet, settings", async () => {
    const res = await SELF.fetch("https://x/api/state");
    expect(res.status).toBe(200);
    const body = await res.json<any>();
    expect(body.rounds.find((r: any) => r.id === "r7").doublePoints).toBe(true);
    expect(body.settings.allowance).toBe("0.75");
  });
});
