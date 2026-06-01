import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";

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
