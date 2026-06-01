import { useEffect, useState } from "react";
import { api } from "../api/client";
import { getPlayerId } from "../state/session";
import { ScorePad } from "../ui/ScorePad";
import { enqueue } from "../offline/queue";
import { flushQueue, startAutoSync } from "../offline/sync";
import { useTrip } from "../state/useTrip";
import { allScored, groupMembers } from "../groups";
import { go } from "../App";

function currentRoundId() {
  return new URLSearchParams(location.search).get("round") ?? "r2";
}

type Scores = Record<string, Record<number, number | null>>;

export function ScoreEntry() {
  const me = getPlayerId()!;
  const roundId = currentRoundId();
  const { state } = useTrip();
  const [data, setData] = useState<any>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [hole, setHole] = useState(1);
  const [scores, setScores] = useState<Scores>({});
  const [openPlayer, setOpenPlayer] = useState<string | null>(null);

  useEffect(() => { startAutoSync(); }, []);
  useEffect(() => {
    api.round(roundId).then(r => {
      setData(r); setLoadFailed(false);
      const next: Scores = {};
      for (const s of r.scores) (next[s.player_id] ??= {})[s.hole] = s.gross;
      setScores(next);
    }).catch(() => setLoadFailed(true));
  }, [roundId]);

  if (!data && loadFailed) return <div style={{ padding: 24 }}>Offline — scores will save and sync when you're back online.</div>;
  if (!data || !state) return <div style={{ padding: 24 }}>Loading…</div>;

  const members = groupMembers(roundId, me, state.teeAssignments, state.players);
  const h = data.holes.find((x: any) => x.number === hole);

  function goHole(n: number) {
    setOpenPlayer(null);
    setHole(n);
  }

  async function save(playerId: string, gross: number) {
    const next: Scores = { ...scores, [playerId]: { ...(scores[playerId] ?? {}), [hole]: gross } };
    setScores(next);
    setOpenPlayer(null);
    await enqueue({ roundId, playerId, hole, gross, updatedAt: Date.now() });
    flushQueue();
    // Auto-advance once the whole group has a score for this hole.
    if (hole < 18 && allScored(members, next, hole)) setHole(hole + 1);
  }

  const chip = (v: number | null | undefined) => (v == null ? "–" : v === 0 ? "PU" : v);
  const filledOnHole = (n: number) => members.filter(m => scores[m.id]?.[n] != null).length;
  const cellBg = (n: number) => {
    if (n === hole) return "var(--gold)";
    const f = filledOnHole(n);
    if (f === 0) return "#13231f";
    return f === members.length ? "#1f3b34" : "#3a2f12";
  };

  return (
    <div style={{ padding: 20, display: "grid", gap: 18 }}>
      <div className="head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button className="btn" onClick={() => go("/")}>‹</button>
        <span>{data.round.label} · Hole {hole}</span>
        <span>Par {h.par}</span>
      </div>

      <div className="panel" style={{ padding: 12, display: "grid", gap: 10 }}>
        {members.map(m => {
          const open = openPlayer === m.id;
          const v = scores[m.id]?.[hole];
          return (
            <div key={m.id} style={{ display: "grid", gap: 10 }}>
              <button className="btn"
                onClick={() => setOpenPlayer(open ? null : m.id)}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: open ? "linear-gradient(180deg,#3a3a3a,#222)" : undefined, color: "#fff",
                }}>
                <span style={{ fontWeight: 700 }}>{m.name}</span>
                <span style={{
                  minWidth: 34, textAlign: "center", fontWeight: 900,
                  color: v == null ? "#888" : "var(--gold)",
                }}>{chip(v)}</span>
              </button>
              {open && (
                <>
                  <ScorePad key={`${m.id}:${hole}`} par={h.par} value={v ?? null} onSelect={(g) => save(m.id, g)} />
                  <button className="btn"
                    style={{ background: "linear-gradient(180deg,#3a3a3a,#222)", color: "#fff" }}
                    onClick={() => save(m.id, 0)}>Pick Up</button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <button className="btn" disabled={hole <= 1} onClick={() => goHole(hole - 1)}>Prev</button>
        <button className="btn" disabled={hole >= 18} onClick={() => goHole(hole + 1)}>Next</button>
      </div>

      <div className="panel" style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(9,1fr)", gap: 6 }}>
        {data.holes.map((x: any) => (
          <button key={x.number} onClick={() => goHole(x.number)}
            style={{ padding: 8, borderRadius: 6, border: "none", fontWeight: 900,
              background: cellBg(x.number),
              color: x.number === hole ? "#1a1205" : "#fff" }}>
            {x.number}
          </button>
        ))}
      </div>
    </div>
  );
}
