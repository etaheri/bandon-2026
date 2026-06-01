export type PollStatus = "live" | "reconnecting" | "offline";

/**
 * Map polling health to a user-facing freshness status.
 * - no data yet -> offline (nothing to trust)
 * - last poll ok -> live
 * - 1-2 recent failures (but we still have data) -> reconnecting
 * - 3+ failures -> offline (data is stale)
 */
export function pollStatus(consecutiveFailures: number, hasData: boolean): PollStatus {
  if (!hasData) return "offline";
  if (consecutiveFailures === 0) return "live";
  if (consecutiveFailures >= 3) return "offline";
  return "reconnecting";
}
