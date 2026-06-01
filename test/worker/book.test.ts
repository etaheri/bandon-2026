import { env, SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { authCookie, adminCookie } from "./helpers";

describe("book schema", () => {
  it("picks table enforces one pick per player per prop", async () => {
    // 'taheri' is a player seeded by 0002_seed.sql, so the creator/player_id FK inserts are valid.
    await env.DB.prepare(
      "INSERT INTO props (id,creator,subject,status,created_at) VALUES ('schp','taheri','Schema test','open',1)",
    ).run();
    await env.DB.prepare(
      "INSERT INTO prop_options (id,prop_id,label,position) VALUES ('scho1','schp','A',0),('scho2','schp','B',1)",
    ).run();
    await env.DB.prepare(
      "INSERT INTO picks (id,prop_id,option_id,player_id,created_at) VALUES ('schk1','schp','scho1','taheri',1)",
    ).run();
    // Second pick by the same player on the same prop must violate UNIQUE(prop_id,player_id).
    await expect(
      env.DB.prepare(
        "INSERT INTO picks (id,prop_id,option_id,player_id,created_at) VALUES ('schk2','schp','scho2','taheri',2)",
      ).run(),
    ).rejects.toThrow(/UNIQUE constraint failed/);
  });
});

const json = (cookie: string, body: unknown) => ({
  method: "POST",
  headers: { Cookie: cookie, "content-type": "application/json" },
  body: JSON.stringify(body),
});

async function createOpenProp(cookie: string, subject: string) {
  const res = await SELF.fetch(
    "https://x/api/book/prop",
    json(cookie, { creator: "taheri", subject, options: ["Yes", "No"] }),
  );
  expect(res.status).toBe(200);
  const { id } = await res.json<{ id: string }>();
  const get = await (await SELF.fetch("https://x/api/book")).json<any>();
  const prop = get.props.find((p: any) => p.id === id);
  return { id, optionIds: prop.options.map((o: any) => o.id) as string[] };
}

describe("book routes", () => {
  it("creates a prop and lists it open with options (public read)", async () => {
    const cookie = await authCookie();
    const res = await SELF.fetch(
      "https://x/api/book/prop",
      json(cookie, { creator: "taheri", subject: "Bruce first tee", options: ["Fairway", "Rough", "Gone"] }),
    );
    expect(res.status).toBe(200);
    const { id } = await res.json<{ id: string }>();
    const data = await (await SELF.fetch("https://x/api/book")).json<any>();
    const prop = data.props.find((p: any) => p.id === id);
    expect(prop.status).toBe("open");
    expect(prop.options.map((o: any) => o.label)).toEqual(["Fairway", "Rough", "Gone"]);
  });

  it("rejects a prop with fewer than 2 options", async () => {
    const cookie = await authCookie();
    const res = await SELF.fetch(
      "https://x/api/book/prop",
      json(cookie, { creator: "taheri", subject: "bad", options: ["only one"] }),
    );
    expect(res.status).toBe(400);
  });

  it("records a pick and reflects it in myPick", async () => {
    const cookie = await authCookie();
    const { id, optionIds } = await createOpenProp(cookie, "pick me");
    const res = await SELF.fetch(
      "https://x/api/book/pick",
      json(cookie, { propId: id, optionId: optionIds[0], playerId: "desabio" }),
    );
    expect(res.status).toBe(200);
    const data = await (await SELF.fetch(`https://x/api/book?me=desabio`)).json<any>();
    const prop = data.props.find((p: any) => p.id === id);
    expect(prop.myPick).toBe(optionIds[0]);
    expect(prop.options.find((o: any) => o.id === optionIds[0]).pickCount).toBe(1);
    expect(prop.picks).toContainEqual({ playerId: "desabio", optionId: optionIds[0] });
  });

  it("409s on a duplicate pick by the same player", async () => {
    const cookie = await authCookie();
    const { id, optionIds } = await createOpenProp(cookie, "dup test");
    await SELF.fetch("https://x/api/book/pick", json(cookie, { propId: id, optionId: optionIds[0], playerId: "sloan" }));
    const dup = await SELF.fetch(
      "https://x/api/book/pick",
      json(cookie, { propId: id, optionId: optionIds[1], playerId: "sloan" }),
    );
    expect(dup.status).toBe(409);
  });

  it("forbids player lock (403) but allows admin lock, then 409s a pick on a locked prop", async () => {
    const player = await authCookie();
    const admin = await adminCookie();
    const { id, optionIds } = await createOpenProp(player, "lock test");
    const denied = await SELF.fetch("https://x/api/book/lock", json(player, { propId: id }));
    expect(denied.status).toBe(403);
    const locked = await SELF.fetch("https://x/api/book/lock", json(admin, { propId: id }));
    expect(locked.status).toBe(200);
    const late = await SELF.fetch(
      "https://x/api/book/pick",
      json(player, { propId: id, optionId: optionIds[0], playerId: "grattan" }),
    );
    expect(late.status).toBe(409);
  });

  it("resolves (admin) and updates standings; rejects an option not in the prop", async () => {
    const player = await authCookie();
    const admin = await adminCookie();
    const { id, optionIds } = await createOpenProp(player, "resolve test");
    await SELF.fetch("https://x/api/book/pick", json(player, { propId: id, optionId: optionIds[0], playerId: "johnson" }));
    const bad = await SELF.fetch("https://x/api/book/resolve", json(admin, { propId: id, winningOptionId: "nope" }));
    expect(bad.status).toBe(400);
    const ok = await SELF.fetch("https://x/api/book/resolve", json(admin, { propId: id, winningOptionId: optionIds[0] }));
    expect(ok.status).toBe(200);
    const data = await (await SELF.fetch("https://x/api/book")).json<any>();
    const johnson = data.standings.find((s: any) => s.playerId === "johnson");
    expect(johnson.correct).toBeGreaterThanOrEqual(1);
  });

  it("forbids resolve by a non-admin (403)", async () => {
    const player = await authCookie();
    const { id, optionIds } = await createOpenProp(player, "resolve auth");
    const res = await SELF.fetch("https://x/api/book/resolve", json(player, { propId: id, winningOptionId: optionIds[0] }));
    expect(res.status).toBe(403);
  });

  it("resolve is correctable (re-resolve changes the winner)", async () => {
    const player = await authCookie();
    const admin = await adminCookie();
    const { id, optionIds } = await createOpenProp(player, "re-resolve test");
    await SELF.fetch("https://x/api/book/pick", json(player, { propId: id, optionId: optionIds[0], playerId: "meissner" }));

    const first = await SELF.fetch("https://x/api/book/resolve", json(admin, { propId: id, winningOptionId: optionIds[0] }));
    expect(first.status).toBe(200);
    let data = await (await SELF.fetch("https://x/api/book")).json<any>();
    expect(data.standings.find((s: any) => s.playerId === "meissner").correct).toBeGreaterThanOrEqual(1);

    // The commish can re-resolve to fix a mis-settlement — intentional, no guard.
    const second = await SELF.fetch("https://x/api/book/resolve", json(admin, { propId: id, winningOptionId: optionIds[1] }));
    expect(second.status).toBe(200);
    data = await (await SELF.fetch("https://x/api/book")).json<any>();
    expect(data.props.find((p: any) => p.id === id).winningOptionId).toBe(optionIds[1]);
    // meissner picked option[0], which is no longer the winner, so 0 correct now.
    expect(data.standings.find((s: any) => s.playerId === "meissner").correct).toBe(0);
  });

  it("resolve on a nonexistent prop returns 404", async () => {
    const admin = await adminCookie();
    const res = await SELF.fetch("https://x/api/book/resolve", json(admin, { propId: "does-not-exist", winningOptionId: "x" }));
    expect(res.status).toBe(404);
  });
});
