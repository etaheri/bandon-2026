import { useEffect, useState } from "react";
import { api } from "../api/client";
import { getPlayerId } from "../state/session";
import { Stepper } from "../ui/Stepper";
import { enqueue } from "../offline/queue";
import { flushQueue, startAutoSync } from "../offline/sync";
import { go } from "../App";

// pick the round to enter: ?round=r2, else first counting round
function currentRoundId() {
  return new URLSearchParams(location.search).get("round") ?? "r2";
}

export function ScoreEntry() {
  const me = getPlayerId()!;
  const roundId = currentRoundId();
  const [data, setData] = useState<any>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [hole, setHole] = useState(1);
  const [scores, setScores] = useState<Record<number, number | null>>({});

  useEffect(() => { startAutoSync(); }, []);
  useEffect(() => {
    api.round(roundId).then(r => {
      setData(r);
      setLoadFailed(false);
      const mine: Record<number, number | null> = {};
      for (const s of r.scores) if (s.player_id === me) mine[s.hole] = s.gross;
      setScores(mine);
    }).catch(() => setLoadFailed(true));
  }, [roundId]);

  if (!data && loadFailed) return <div style={{ padding: 24 }}>Offline — scores will save and sync when you're back online.</div>;
  if (!data) return <div style={{ padding: 24 }}>Loading…</div>;
  const h = data.holes.find((x: any) => x.number === hole);

  async function save(gross: number) {
    const updatedAt = Date.now();
    setScores(s => ({ ...s, [hole]: gross }));         // optimistic
    await enqueue({ roundId, playerId: me, hole, gross, updatedAt }); // durable
    flushQueue();                                       // try now
  }

  return (
    <div style={{ padding: 20, display: "grid", gap: 18 }}>
      <div className="head" style={{ display: "flex", justifyContent: "space-between" }}>
        <button className="btn" onClick={() => go("/")}>‹</button>
        <span>{data.round.label} · Hole {hole}</span>
        <span>Par {h.par}</span>
      </div>
      <Stepper value={scores[hole] ?? null} par={h.par} onChange={save} />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <button className="btn" disabled={hole <= 1} onClick={() => setHole(hole - 1)}>Prev</button>
        <button className="btn" disabled={hole >= 18} onClick={() => setHole(hole + 1)}>Next</button>
      </div>
      <div className="panel" style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(9,1fr)", gap: 6 }}>
        {data.holes.map((x: any) => (
          <button key={x.number} onClick={() => setHole(x.number)}
            style={{ padding: 8, borderRadius: 6, border: "none", fontWeight: 900,
              background: x.number === hole ? "var(--gold)" : scores[x.number] != null ? "#1f3b34" : "#13231f", color: "#fff" }}>
            {scores[x.number] ?? x.number}
          </button>
        ))}
      </div>
    </div>
  );
}
