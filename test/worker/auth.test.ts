import { env, SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("POST /api/auth", () => {
  it("rejects a bad passcode", async () => {
    const res = await SELF.fetch("https://x/api/auth", {
      method: "POST",
      body: JSON.stringify({ passcode: "nope" }),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(401);
  });
  it("accepts the trip passcode and sets a cookie", async () => {
    const res = await SELF.fetch("https://x/api/auth", {
      method: "POST",
      body: JSON.stringify({ passcode: env.PASSCODE }),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("bandon_session=");
  });
});
