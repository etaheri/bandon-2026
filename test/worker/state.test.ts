import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { authCookie } from "./helpers";

describe("GET /api/state", () => {
  it("requires auth", async () => {
    const res = await SELF.fetch("https://x/api/state");
    expect(res.status).toBe(401);
  });
  it("returns players, rounds, tee sheet, settings", async () => {
    const res = await SELF.fetch("https://x/api/state", {
      headers: { Cookie: await authCookie() },
    });
    expect(res.status).toBe(200);
    const body = await res.json<any>();
    expect(body.players.length).toBe(8);
    expect(body.rounds.find((r: any) => r.id === "r7").doublePoints).toBe(true);
    expect(body.settings.allowance).toBe("0.75");
  });
});
