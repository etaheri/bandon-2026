import { env, SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { authCookie, adminCookie } from "./helpers";

describe("admin", () => {
  it("rejects non-admin", async () => {
    const res = await SELF.fetch("https://x/api/admin/settings", {
      method: "POST",
      headers: { Cookie: await authCookie(), "content-type": "application/json" },
      body: JSON.stringify({ allowance: 0.8 }),
    });
    expect(res.status).toBe(403);
  });

  it("admin updates allowance + handicaps", async () => {
    const cookie = await adminCookie();
    await SELF.fetch("https://x/api/admin/settings", {
      method: "POST",
      headers: { Cookie: cookie, "content-type": "application/json" },
      body: JSON.stringify({ allowance: 0.8 }),
    });
    await SELF.fetch("https://x/api/admin/handicaps", {
      method: "POST",
      headers: { Cookie: cookie, "content-type": "application/json" },
      body: JSON.stringify({ players: [{ id: "taheri", handicap: 11 }] }),
    });
    const s = await env.DB.prepare(
      "SELECT value FROM settings WHERE key='allowance'",
    ).first<any>();
    const p = await env.DB.prepare(
      "SELECT handicap FROM players WHERE id='taheri'",
    ).first<any>();
    expect(s.value).toBe("0.8");
    expect(p.handicap).toBe(11);
  });
});
