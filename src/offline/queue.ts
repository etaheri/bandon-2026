import { openDB, type DBSchema } from "idb";

export interface QueuedScore { roundId: string; playerId: string; hole: number; gross: number | null; updatedAt: number; }
export interface StoredScore extends QueuedScore { key: string; }

interface BandonDB extends DBSchema {
  queue: { key: string; value: StoredScore };
}

const dbp = openDB<BandonDB>("bandon", 1, {
  upgrade(db) { db.createObjectStore("queue", { keyPath: "key" }); },
});

const keyOf = (s: QueuedScore) => `${s.roundId}:${s.playerId}:${s.hole}`;

export async function enqueue(s: QueuedScore) {
  const db = await dbp;
  const key = keyOf(s);
  const existing = await db.get("queue", key);
  if (existing && existing.updatedAt >= s.updatedAt) return; // keep newer
  await db.put("queue", { ...s, key });
}

export async function pending(): Promise<StoredScore[]> {
  return (await dbp).getAll("queue");
}

export async function markSynced(key: string) {
  await (await dbp).delete("queue", key);
}
