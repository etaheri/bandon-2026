async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, { credentials: "include", ...init });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error ?? res.statusText);
  return res.json() as Promise<T>;
}

export const api = {
  auth: (passcode: string) => req<{ ok: boolean; role: string }>("/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ passcode }) }),
  state: () => req<any>("/state"),
  round: (id: string) => req<any>(`/round/${id}`),
  score: (s: { roundId: string; playerId: string; hole: number; gross: number | null; updatedAt: number }) =>
    req<{ ok: boolean; applied: boolean }>("/score", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(s) }),
  leaderboard: () => req<any>("/leaderboard"),
  adminHandicaps: (players: { id: string; handicap: number }[]) => req("/admin/handicaps", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ players }) }),
  adminSettings: (b: any) => req("/admin/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }),
};
