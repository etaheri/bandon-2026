import { api } from "../api/client";
import { pending, markSynced } from "./queue";

let syncing = false;

export async function flushQueue() {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  try {
    for (const s of await pending()) {
      try { await api.score(s); await markSynced(s.key); } catch { /* leave for next flush */ }
    }
  } finally { syncing = false; }
}

let autoSyncStarted = false;

export function startAutoSync() {
  if (autoSyncStarted) { flushQueue(); return; } // register listeners/interval only once
  autoSyncStarted = true;
  window.addEventListener("online", flushQueue);
  setInterval(flushQueue, 15000);
  flushQueue();
}
