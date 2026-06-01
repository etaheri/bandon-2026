import { setAuthed } from "../state/session";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, { credentials: "include", ...init });
  if (res.status === 401 && typeof window !== "undefined") {
    // Server session expired while the client still believed it was authed
    // (only writes require a session — reads are public, so a 401 is
    // unambiguous). Drop the local flag and re-render so Login reappears;
    // queued scores stay in IndexedDB and sync once the user signs back in.
    setAuthed(false);
    sessionStorage.setItem("bandon_expired", "1");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
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
  adminTeams: (players: { id: string; team: "GORSE" | "DRIFTWOOD" }[]) => req("/admin/teams", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ players }) }),
  adminSettings: (b: any) => req("/admin/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }),
  book: (me: string | null) => req<any>(`/book${me ? `?me=${encodeURIComponent(me)}` : ""}`),
  bookProp: (b: { creator: string; subject: string; description?: string; options: string[] }) =>
    req<{ ok: boolean; id: string }>("/book/prop", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }),
  bookPick: (b: { propId: string; optionId: string; playerId: string }) =>
    req<{ ok: boolean }>("/book/pick", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }),
  bookLock: (propId: string) =>
    req<{ ok: boolean }>("/book/lock", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ propId }) }),
  bookResolve: (b: { propId: string; winningOptionId: string }) =>
    req<{ ok: boolean }>("/book/resolve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }),
};
