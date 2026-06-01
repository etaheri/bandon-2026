import { env, SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { authCookie } from "./helpers";

describe("round + score", () => {
  it("GET /api/round/:id returns holes + scores", async () => {
    const res = await SELF.fetch("https://x/api/round/r2", {
      headers: { Cookie: await authCookie() },
    });
    expect(res.status).toBe(200);
    const body = await res.json<any>();
    expect(body.holes.length).toBe(18);
    expect(body.round.id).toBe("r2");
  });
  it("POST /api/score writes and is last-write-wins", async () => {
    const cookie = await authCookie();
    const post = (gross: number, updatedAt: number) =>
      SELF.fetch("https://x/api/score", {
        method: "POST",
        headers: { Cookie: cookie, "content-type": "application/json" },
        body: JSON.stringify({
          roundId: "r2",
          playerId: "taheri",
          hole: 1,
          gross,
          updatedAt,
        }),
      });
    expect((await post(5, 1000)).status).toBe(200);
    await post(9, 500); // older -> ignored
    const row = await env.DB.prepare(
      "SELECT gross FROM scores WHERE round_id='r2' AND player_id='taheri' AND hole=1",
    ).first<any>();
    expect(row.gross).toBe(5);
  });
});
