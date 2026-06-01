import { motion, AnimatePresence } from "framer-motion";
import { useLeaderboard } from "../state/useLeaderboard";
import { go } from "../App";

export function Board({ tv }: { tv: boolean }) {
  const lb = useLeaderboard(tv ? 15000 : 20000);
  if (!lb) return <div style={{ padding: 24 }}>Loading board…</div>;

  const scale = tv ? 1.6 : 1;
  const leadGorse = lb.leader === "GORSE";

  return (
    <div style={{ minHeight: "100%", padding: tv ? 8 : 16 }}>
      {!tv && <button className="btn" onClick={() => go("/")} style={{ marginBottom: 12 }}>‹ Home</button>}

      {/* top scoreboard */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center",
        borderRadius: 14, overflow: "hidden", boxShadow: "var(--bevel)" }}>
        <Side team="GORSE" cup={lb.cup.gorse} agg={lb.teamAggregate.GORSE} clinch={lb.clinch.gorse} lead={leadGorse} scale={scale} />
        <div className="head" style={{ padding: 12, fontSize: 18 * scale, background: "#06120e" }}>CUP</div>
        <Side team="DRIFTWOOD" cup={lb.cup.driftwood} agg={lb.teamAggregate.DRIFTWOOD} clinch={lb.clinch.driftwood} lead={!leadGorse} scale={scale} right />
      </div>

      <div className="head" style={{ textAlign: "center", opacity: .8, margin: "8px 0", fontSize: 12 * scale }}>
        {lb.cup.available > 0 ? `${lb.cup.available} pts still available` : "ALL DECIDED"} · first to 4 wins, 3.5 retains
      </div>

      {/* player rows */}
      <div style={{ display: "grid", gap: 6 }}>
        <AnimatePresence>
          {lb.players.map((p: any) => (
            <motion.div layout key={p.playerId} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
              style={{ display: "grid", gridTemplateColumns: "8px 1fr auto auto", alignItems: "center", gap: 10,
                padding: tv ? 14 : 10, borderRadius: 8, background: "#0f1a17", boxShadow: "var(--bevel)" }}>
              <div style={{ width: 8, height: "100%", background: p.team === "GORSE" ? "var(--gorse)" : "var(--driftwood)", borderRadius: 4 }} />
              <div className="head" style={{ fontSize: 16 * scale }}>
                {p.playerId === lb.crowns.topIndividual ? "★ " : ""}{p.name}
              </div>
              <div style={{ fontVariantNumeric: "tabular-nums", fontWeight: 900, fontSize: 18 * scale,
                color: p.result >= 0 ? "#7CFFB2" : "#ff9a9a" }}>
                {p.result >= 0 ? "+" : ""}{p.result} {p.result >= 0 ? "▲" : "▼"}
              </div>
              <div className="head" style={{ opacity: .8, fontSize: 12 * scale }}>{p.thru === "F" ? "F" : `THRU ${p.thru}`}</div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Side({ team, cup, agg, clinch, lead, scale, right }: any) {
  const color = team === "GORSE" ? "var(--gorse)" : "var(--driftwood)";
  return (
    <div style={{ padding: 16, textAlign: right ? "right" : "left",
      background: `linear-gradient(${right ? "270deg" : "90deg"}, ${color}22, transparent)`,
      boxShadow: lead ? `inset 0 0 40px ${color}66` : "none" }}>
      <div className="head" style={{ color, fontSize: 22 * scale }}>{team}</div>
      <div className="head" style={{ fontSize: 64 * scale, lineHeight: 1 }}>{cup}</div>
      <div style={{ opacity: .85, fontSize: 14 * scale }}>{agg >= 0 ? "+" : ""}{agg} to quota</div>
      <div className="head" style={{ marginTop: 6, fontSize: 12 * scale, color }}>{clinch}</div>
    </div>
  );
}
