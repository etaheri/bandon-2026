import { useState } from "react";
import { motion } from "framer-motion";
import { useLeaderboard } from "../state/useLeaderboard";
import { liveRound } from "../schedule";
import { go } from "../App";
import { PlayerDetail } from "./PlayerDetail";

export function Board({ tv }: { tv: boolean }) {
  const lb = useLeaderboard(tv ? 15000 : 20000);
  const [selected, setSelected] = useState<string | null>(null);
  if (!lb) return <div style={{ padding: 24 }}>Loading board…</div>;

  const scale = tv ? 1.6 : 1;
  const roundsMeta: any[] = Array.isArray(lb.rounds) ? lb.rounds : [];
  const courses: any[] = Array.isArray(lb.courses) ? lb.courses : [];
  const now = new Date();
  const live = roundsMeta.length ? liveRound(roundsMeta as any, now) : null;
  const liveId: string | null = live?.id ?? null;
  const countIndex = liveId ? roundsMeta.findIndex(r => r.id === liveId) + 1 : 0;
  const liveCourse = live ? courses.find(c => c.id === live.courseId) : null;

  const players: any[] = Array.isArray(lb.players) ? lb.players : [];
  const gorse = players.filter(p => p.team === "GORSE");
  const drift = players.filter(p => p.team === "DRIFTWOOD");
  const leadGorse = lb.leader === "GORSE";

  return (
    <div style={{ minHeight: "100%", padding: tv ? 8 : 16 }}>
      {!tv && <button className="btn" onClick={() => go("/")} style={{ marginBottom: 12 }}>‹ Home</button>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "stretch", borderRadius: 14, overflow: "hidden", boxShadow: "var(--bevel)" }}>
        <TeamBar team="GORSE" cup={lb.cup.gorse} agg={lb.teamAggregate.GORSE} clinch={lb.clinch.gorse} lead={leadGorse} scale={scale} />
        <div className="head" style={{ padding: "0 12px", display: "grid", placeItems: "center", fontSize: 16 * scale, background: "#06120e" }}>CUP</div>
        <TeamBar team="DRIFTWOOD" cup={lb.cup.driftwood} agg={lb.teamAggregate.DRIFTWOOD} clinch={lb.clinch.driftwood} lead={!leadGorse} scale={scale} right />
      </div>

      <div className="head" style={{ textAlign: "center", margin: "10px 0", fontSize: 14 * scale,
        padding: "8px 10px", borderRadius: 8, background: live ? "linear-gradient(180deg,#1b3a31,#0c1c17)" : "transparent",
        boxShadow: live ? "var(--bevel)" : "none", opacity: live ? 1 : .7 }}>
        {live
          ? `● LIVE · ROUND ${countIndex} OF ${roundsMeta.length} · ${(liveCourse?.name ?? "").toUpperCase()} · PAR ${liveCourse?.par ?? ""} · ${live.day} ${live.teeTime}`
          : `${lb.cup.available > 0 ? "UP NEXT — see tee sheet" : "ALL DECIDED"} · first to 4 wins, 3.5 retains`}
      </div>

      <RoundStrip roundCups={lb.roundCups ?? []} roundsMeta={roundsMeta} scale={scale} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: tv ? 12 : 8, marginTop: 10 }}>
        <TeamColumn players={gorse} team="GORSE" liveId={liveId} topId={lb.crowns?.topIndividual} scale={scale} tv={tv} onTap={setSelected} />
        <TeamColumn players={drift} team="DRIFTWOOD" liveId={liveId} topId={lb.crowns?.topIndividual} scale={scale} tv={tv} onTap={setSelected} align="right" />
      </div>

      {selected && !tv && (
        <PlayerDetail playerId={selected} lb={lb} liveId={liveId} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function TeamBar({ team, cup, agg, clinch, lead, scale, right }: any) {
  const color = team === "GORSE" ? "var(--gorse)" : "var(--driftwood)";
  return (
    <div style={{ padding: 16, textAlign: right ? "right" : "left",
      background: lead ? color : `linear-gradient(${right ? "270deg" : "90deg"}, ${color}33, #0a1714)`,
      color: lead ? "#10231c" : "#fff" }}>
      <div className="head" style={{ fontSize: 20 * scale, color: lead ? "#10231c" : color }}>{team}</div>
      <div className="head" style={{ fontSize: 56 * scale, lineHeight: 1 }}>{cup}</div>
      <div style={{ opacity: .9, fontSize: 13 * scale }}>{agg >= 0 ? "+" : ""}{agg} to quota</div>
      <div className="head" style={{ marginTop: 4, fontSize: 11 * scale }}>{clinch}</div>
    </div>
  );
}

function RoundStrip({ roundCups, roundsMeta, scale }: any) {
  if (!Array.isArray(roundCups) || !roundCups.length) return null;
  const label = (rid: string) => {
    const idx = roundsMeta.findIndex((r: any) => r.id === rid);
    return idx >= 0 ? `R${idx + 1}` : rid.toUpperCase();
  };
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
      {roundCups.map((rc: any) => {
        const decided = rc.decided;
        const gWin = rc.gorse > rc.driftwood, dWin = rc.driftwood > rc.gorse;
        const bg = !decided ? "#13231f" : gWin ? "var(--gorse)" : dWin ? "var(--driftwood)"
          : "linear-gradient(90deg,var(--gorse) 50%, var(--driftwood) 50%)";
        return (
          <div key={rc.roundId} className="head" title={decided ? "" : "in progress"}
            style={{ minWidth: 44 * scale, textAlign: "center", padding: "4px 8px", borderRadius: 999, fontSize: 11 * scale,
              background: bg, color: decided ? "#10231c" : "#9fb3ab", boxShadow: "var(--bevel)", opacity: decided ? 1 : .8 }}>
            {label(rc.roundId)}{rc.double ? " 2×" : ""}
          </div>
        );
      })}
    </div>
  );
}

function TeamColumn({ players, team, liveId, topId, scale, tv, onTap, align }: any) {
  const color = team === "GORSE" ? "var(--gorse)" : "var(--driftwood)";
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {players.map((p: any) => {
        const today = liveId ? p.perRound?.[liveId] : null;
        const thru = today ? (today.thru === "F" ? "F" : `THRU ${today.thru}`) : "—";
        return (
          <motion.div layout key={p.playerId} onClick={() => onTap(p.playerId)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: "spring", stiffness: 500, damping: 40 }}
            style={{ display: "grid", gridTemplateColumns: align === "right" ? "auto 1fr 6px" : "6px 1fr auto",
              alignItems: "center", gap: 8, padding: tv ? 14 : 10, borderRadius: 8, background: "#0f1a17",
              boxShadow: "var(--bevel)", cursor: "pointer", textAlign: align === "right" ? "right" : "left" }}>
            {align !== "right" && <div style={{ width: 6, height: "100%", background: color, borderRadius: 3 }} />}
            {align === "right" && <Stat today={today} scale={scale} trip={p.result} thru={thru} right />}
            <div className="head" style={{ fontSize: 14 * scale }}>
              {p.playerId === topId ? "★ " : ""}{p.name}
            </div>
            {align !== "right" && <Stat today={today} scale={scale} trip={p.result} thru={thru} />}
            {align === "right" && <div style={{ width: 6, height: "100%", background: color, borderRadius: 3 }} />}
          </motion.div>
        );
      })}
    </div>
  );
}

function Stat({ today, trip, thru, scale, right }: any) {
  const todayVal = today ? today.result : null;
  return (
    <div style={{ textAlign: right ? "left" : "right", fontVariantNumeric: "tabular-nums" }}>
      <div className="head" style={{ fontSize: 16 * scale, color: trip >= 0 ? "#7CFFB2" : "#ff9a9a" }}>
        {trip >= 0 ? "+" : ""}{trip}
      </div>
      <div style={{ fontSize: 10 * scale, opacity: .8 }}>
        {todayVal == null ? thru : `${todayVal >= 0 ? "+" : ""}${todayVal} · ${thru}`}
      </div>
    </div>
  );
}
