import { useEffect, useState } from "react";
import { api } from "../api/client";
import { playingHandicap, strokesReceived, holePoints } from "../scoring";

/** Tap-a-player drill-down: handicap/quota, round-by-round results, current round scorecard. */
export function PlayerDetail({ playerId, lb, liveId, onClose }: { playerId: string; lb: any; liveId: string | null; onClose: () => void }) {
  const player = lb.players.find((p: any) => p.playerId === playerId);
  const allowance: number = lb.allowance ?? 0.75;
  const roundsMeta: any[] = lb.rounds ?? [];
  const [card, setCard] = useState<any>(null);
  const scoreRoundId = liveId ?? (roundsMeta[0]?.id ?? null);

  useEffect(() => {
    if (!scoreRoundId) return;
    api.round(scoreRoundId).then(setCard).catch(() => setCard(null));
  }, [scoreRoundId]);

  if (!player) return null;
  const phc = playingHandicap(player.handicap, allowance);
  const quota = player.quotaOverride ?? 36;

  const myScores: Record<number, number | null> = {};
  if (card) for (const s of card.scores) if (s.player_id === playerId) myScores[s.hole] = s.gross;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "grid", placeItems: "center", padding: 16, zIndex: 50 }}>
      <div onClick={e => e.stopPropagation()} className="panel" style={{ padding: 16, width: "min(560px,100%)", maxHeight: "90vh", overflow: "auto", display: "grid", gap: 12 }}>
        <div className="head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{player.name}</span>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
        <div className="panel" style={{ padding: 10, display: "flex", justifyContent: "space-around", textAlign: "center" }}>
          <div><div style={{ opacity: .6, fontSize: 11 }}>HCP</div><div className="head">{player.handicap}</div></div>
          <div><div style={{ opacity: .6, fontSize: 11 }}>PLAYING</div><div className="head">{phc}</div></div>
          <div><div style={{ opacity: .6, fontSize: 11 }}>QUOTA</div><div className="head">{quota}</div></div>
          <div><div style={{ opacity: .6, fontSize: 11 }}>TRIP</div><div className="head" style={{ color: player.result >= 0 ? "#7CFFB2" : "#ff9a9a" }}>{player.result >= 0 ? "+" : ""}{player.result}</div></div>
        </div>

        <div className="head" style={{ fontSize: 13 }}>By round</div>
        <div style={{ display: "grid", gap: 4 }}>
          {roundsMeta.map((r: any, i: number) => {
            const pr = player.perRound?.[r.id];
            const res = pr ? pr.result : null;
            return (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", background: "#0f1a17", borderRadius: 6 }}>
                <span>R{i + 1} · {r.day}{r.doublePoints ? " · 2×" : ""}</span>
                <span style={{ fontVariantNumeric: "tabular-nums", color: res == null ? "#888" : res >= 0 ? "#7CFFB2" : "#ff9a9a" }}>
                  {pr ? `${res! >= 0 ? "+" : ""}${res} · ${pr.thru === "F" ? "F" : "thru " + pr.thru}` : "—"}
                </span>
              </div>
            );
          })}
        </div>

        {card && (
          <>
            <div className="head" style={{ fontSize: 13 }}>{card.round.label} scorecard</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4, fontSize: 12 }}>
              {card.holes.map((h: any) => {
                const g = myScores[h.number];
                const recv = strokesReceived(phc, h.strokeIndex);
                let label = "·", color = "#13231f";
                if (g === 0) { label = "PU"; color = "#2a2a2a"; }
                else if (g != null) {
                  const pts = holePoints({ gross: g, par: h.par, strokes: recv });
                  label = `${g}`;
                  color = pts >= 3 ? "#1f5e3a" : pts === 2 ? "#1f3b34" : pts === 1 ? "#3b3520" : "#3b2020";
                }
                return (
                  <div key={h.number} style={{ background: color, borderRadius: 6, padding: 6, textAlign: "center" }}>
                    <div style={{ opacity: .5, fontSize: 9 }}>{h.number}{recv > 0 ? "•".repeat(recv) : ""}</div>
                    <div className="head">{label}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ opacity: .5, fontSize: 10 }}>• = a stroke received on that hole · cell color = Stableford points</div>
          </>
        )}
      </div>
    </div>
  );
}
