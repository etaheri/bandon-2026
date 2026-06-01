import { useEffect, useState } from "react";
import { api } from "../api/client";
import { getPlayerId } from "../state/session";
import { ScorePad } from "../ui/ScorePad";
import { enqueue } from "../offline/queue";
import { flushQueue, startAutoSync } from "../offline/sync";
import { go } from "../App";

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
      setData(r); setLoadFailed(false);
      const mine: Record<number, number | null> = {};
      for (const s of r.scores) if (s.player_id === me) mine[s.hole] = s.gross;
      setScores(mine);
    }).catch(() => setLoadFailed(true));
  }, [roundId]);

  if (!data && loadFailed) return <div style={{ padding: 24 }}>Offline — scores will save and sync when you're back online.</div>;
  if (!data) return <div style={{ padding: 24 }}>Loading…</div>;
  const h = data.holes.find((x: any) => x.number === hole);

  async function save(gross: number, advance = true) {
    setScores(s => ({ ...s, [hole]: gross }));
    await enqueue({ roundId, playerId: me, hole, gross, updatedAt: Date.now() });
    flushQueue();
    if (advance && hole < 18) setHole(hole + 1);
  }

  const cellLabel = (n: number) => {
    const v = scores[n];
    return v == null ? n : v === 0 ? "PU" : v;
  };

  return (
    <div style={{ padding: 20, display: "grid", gap: 18 }}>
      <div className="head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button className="btn" onClick={() => go("/")}>‹</button>
        <span>{data.round.label} · Hole {hole}</span>
        <span>Par {h.par}</span>
      </div>

      <ScorePad key={hole} par={h.par} value={scores[hole] ?? null} onSelect={(g) => save(g)} />

      <div style={{ display: "flex", gap: 12 }}>
        <button className="btn" style={{ flex: 1, background: "linear-gradient(180deg,#3a3a3a,#222)", color: "#fff" }}
          onClick={() => save(0)}>Pick Up</button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <button className="btn" disabled={hole <= 1} onClick={() => setHole(hole - 1)}>Prev</button>
        <button className="btn" disabled={hole >= 18} onClick={() => setHole(hole + 1)}>Next</button>
      </div>

      <div className="panel" style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(9,1fr)", gap: 6 }}>
        {data.holes.map((x: any) => (
          <button key={x.number} onClick={() => setHole(x.number)}
            style={{ padding: 8, borderRadius: 6, border: "none", fontWeight: 900,
              background: x.number === hole ? "var(--gold)" : scores[x.number] != null ? "#1f3b34" : "#13231f",
              color: x.number === hole ? "#1a1205" : "#fff" }}>
            {cellLabel(x.number)}
          </button>
        ))}
      </div>
    </div>
  );
}
