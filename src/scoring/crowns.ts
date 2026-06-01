interface DayResult { playerId: string; day: string; result: number; }

export function playerOfTheTrip(results: DayResult[]): { playerId: string; total: number } | null {
  const totals = new Map<string, number>();
  for (const r of results) totals.set(r.playerId, (totals.get(r.playerId) ?? 0) + r.result);
  let best: { playerId: string; total: number } | null = null;
  for (const [playerId, total] of totals) if (!best || total > best.total) best = { playerId, total };
  return best;
}

export function dailyLowRounds(results: DayResult[]): Record<string, { playerId: string; result: number }> {
  const out: Record<string, { playerId: string; result: number }> = {};
  for (const r of results) {
    const cur = out[r.day];
    if (!cur || r.result > cur.result) out[r.day] = { playerId: r.playerId, result: r.result };
  }
  return out;
}
