import type { Round } from "./scoring/types";
import { pacificDate } from "./time";

export type RoundStatus = "COMPLETED" | "LIVE" | "UPCOMING";

/** Parse a round's `date` (YYYY-MM-DD) + `teeTime` ("7:30 AM") into an absolute Date pinned to Pacific (see src/time.ts). */
export function roundStart(round: Round): Date {
  const [y, m, d] = round.date.split("-").map(Number);
  const match = round.teeTime.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  let h = 12, min = 0;
  if (match) {
    h = Number(match[1]) % 12;
    min = Number(match[2]);
    if (/pm/i.test(match[3]!)) h += 12;
  }
  return pacificDate(y ?? 1970, m ?? 1, d ?? 1, h, min);
}

/** Counting rounds, sorted by start, each classified vs `now`. */
export function classifyRounds(rounds: Round[], now: Date): { roundId: string; status: RoundStatus }[] {
  const sorted = rounds.filter(r => r.counts && r.date).sort((a, b) => roundStart(a).getTime() - roundStart(b).getTime());
  const nowMs = now.getTime();
  return sorted.map((r, i) => {
    const start = roundStart(r).getTime();
    const nextStart = i + 1 < sorted.length ? roundStart(sorted[i + 1]!).getTime() : Infinity;
    let status: RoundStatus;
    if (start > nowMs) status = "UPCOMING";
    else if (nowMs < nextStart) status = "LIVE";
    else status = "COMPLETED";
    return { roundId: r.id, status };
  });
}

export function liveRound(rounds: Round[], now: Date): Round | null {
  const live = classifyRounds(rounds, now).find(x => x.status === "LIVE");
  return live ? rounds.find(r => r.id === live.roundId) ?? null : null;
}

export function nextUpcoming(rounds: Round[], now: Date): Round | null {
  const up = classifyRounds(rounds, now).find(x => x.status === "UPCOMING");
  return up ? rounds.find(r => r.id === up.roundId) ?? null : null;
}
