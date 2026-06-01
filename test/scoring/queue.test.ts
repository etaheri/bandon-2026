import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { enqueue, pending, markSynced } from "../../src/offline/queue";

describe("offline score queue", () => {
  it("enqueues and lists pending, keyed by round/player/hole (latest wins)", async () => {
    await enqueue({ roundId: "r2", playerId: "taheri", hole: 1, gross: 5, updatedAt: 1 });
    await enqueue({ roundId: "r2", playerId: "taheri", hole: 1, gross: 4, updatedAt: 2 });
    const p = await pending();
    expect(p.length).toBe(1);
    expect(p[0]!.gross).toBe(4);
  });
  it("removes from pending after sync", async () => {
    const p = await pending();
    await markSynced(p[0]!.key);
    expect((await pending()).length).toBe(0);
  });
});
