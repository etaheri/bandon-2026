import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { getPlayerId } from "../state/session";
import { enqueue } from "../offline/queue";
import { flushQueue, startAutoSync } from "../offline/sync";
import { useTrip } from "../state/useTrip";
import { groupMembers } from "../groups";
import { BackButton } from "../ui/BackButton";
import { go } from "../App";
import { SESSIONS, sessionStart, sessionCourses, phaseAt } from "../data/broadcast";
import { playingHandicap, strokesReceived } from "../scoring";

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
  const [decided, setDecided] = useState<Set<string>>(new Set());
  useEffect(() => {
    api.leaderboard()
      .then((lb: any) => setDecided(new Set((lb.roundCups ?? []).filter((rc: any) => rc.decided).map((rc: any) => rc.roundId))))
      .catch(() => {});
  }, []);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

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

  // Handicap strokes ("pops"): playing handicap per member, strokes received on a hole.
  const allowance = Number(state.settings?.allowance) || 0.75;
  const phcOf = (playerId: string) => {
    const p = state.players.find((x: any) => x.id === playerId);
    return p ? playingHandicap(Number(p.handicap), allowance) : 0;
  };
  const strokesOn = (playerId: string, strokeIndex: number) => strokesReceived(phcOf(playerId), strokeIndex);

  function goHole(n: number) {
    setHole(n);
  }

  // gross: 1..20 = strokes, 0 = pick-up, null = cleared.
  async function save(playerId: string, gross: number | null) {
    setScores(s => ({ ...s, [playerId]: { ...(s[playerId] ?? {}), [hole]: gross } }));
    await enqueue({ roundId, playerId, hole, gross, updatedAt: Date.now() });
    flushQueue();
  }

  function onInput(playerId: string, raw: string) {
    const digits = raw.replace(/[^0-9]/g, "").slice(0, 2);
    save(playerId, digits === "" ? null : Number(digits));
  }

  const filledOnHole = (n: number) => members.filter(m => scores[m.id]?.[n] != null).length;
  const cellBg = (n: number) => {
    if (n === hole) return "var(--gold)";
    const f = filledOnHole(n);
    if (f === 0) return "#13231f";
    return f === members.length ? "#1f3b34" : "#3a2f12";
  };

  return (
    <div className="bc-page" style={{ display: "grid", gap: 18 }}>
      <div className="bc-topbar" style={{ marginBottom: 0 }}>
        <BackButton />
        <h1 className="bc-screen-title" style={{ fontSize: "clamp(20px,6vw,30px)" }}>{data.round.label}</h1>
        <span className="sp" />
        <span className="head" style={{ fontSize: 15, color: "var(--gold)", whiteSpace: "nowrap" }}>
          Hole {hole} · Par {h.par}
        </span>
      </div>
      <RoundPicker current={roundId} decided={decided} />

      <div className="panel" style={{ padding: 8, display: "grid", gap: 8 }}>
        {members.map((m, i) => {
          const v = scores[m.id]?.[hole];
          const pickedUp = v === 0;
          const recv = strokesOn(m.id, h.strokeIndex);
          return (
            <div key={m.id} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "5px 6px 5px 12px",
              borderRadius: 12, background: "linear-gradient(180deg,#16342a,#0c2018)",
              border: "1px solid var(--line)",
            }}>
              <span style={{
                flex: 1, minWidth: 0, fontWeight: 700, fontSize: 16,
                color: m.id === me ? "var(--gold)" : "#eafff4",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{m.name}</span>
              {recv > 0 && (
                <span aria-label={`${recv} handicap stroke${recv > 1 ? "s" : ""} this hole`}
                  title="Handicap strokes on this hole"
                  style={{ flex: "0 0 auto", color: "var(--gold)", fontSize: 15, fontWeight: 900, letterSpacing: 1.5 }}>
                  {"•".repeat(recv)}
                </span>
              )}
              <input
                ref={el => { inputs.current[i] = el; }}
                inputMode="numeric"
                enterKeyHint={i < members.length - 1 ? "next" : "done"}
                aria-label={`${m.name} score, hole ${hole}`}
                placeholder={String(h.par)}
                readOnly={pickedUp}
                value={pickedUp ? "PU" : v == null ? "" : String(v)}
                onFocus={e => e.currentTarget.select()}
                onChange={e => onInput(m.id, e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); inputs.current[i + 1]?.focus(); } }}
                style={{
                  width: 58, textAlign: "center", fontWeight: 900, fontSize: 22, padding: "9px 0",
                  color: v == null ? "#6f9586" : "var(--gold)",
                  background: pickedUp ? "#2a2412" : "#0b1f18",
                }}
              />
              <button className="btn dark" aria-pressed={pickedUp}
                onClick={() => save(m.id, pickedUp ? null : 0)}
                style={{
                  padding: "9px 11px", fontSize: 12, fontWeight: 900, letterSpacing: ".5px",
                  border: pickedUp ? "1px solid var(--gold)" : "1px solid transparent",
                  color: pickedUp ? "var(--gold)" : "#9fd9bf",
                }}>PU</button>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <button className="btn ghost" disabled={hole <= 1} onClick={() => goHole(hole - 1)}>‹ Prev</button>
        <button className="btn ghost" disabled={hole >= 18} onClick={() => goHole(hole + 1)}>Next ›</button>
      </div>

      <div className="panel" style={{ padding: 12, display: "grid", gap: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(9,1fr)", gap: 6 }}>
          {data.holes.map((x: any) => {
            const myRecv = strokesOn(me, x.strokeIndex);
            return (
              <button key={x.number} onClick={() => goHole(x.number)}
                style={{ position: "relative", padding: 8, borderRadius: 6, border: "none", fontWeight: 900,
                  background: cellBg(x.number),
                  color: x.number === hole ? "#1a1205" : "#fff" }}>
                {x.number}
                {myRecv > 0 && (
                  <span aria-hidden="true" style={{ position: "absolute", top: 2, right: 3, fontSize: 9, lineHeight: 1,
                    color: x.number === hole ? "#1a1205" : "var(--gold)" }}>{"•".repeat(myRecv)}</span>
                )}
              </button>
            );
          })}
        </div>
        <div style={{ opacity: .5, fontSize: 10 }}>• = a handicap stroke you receive (playing {phcOf(me)})</div>
      </div>
    </div>
  );
}

function RoundPicker({ current, decided }: { current: string; decided: Set<string> }) {
  const counting = SESSIONS.filter(s => s.roundId);
  const now = new Date();
  const phase = phaseAt(now);
  const liveRoundId = phase.kind === "LIVE" ? phase.live.roundId : null;
  const statusColor: Record<string, string> = { LIVE: "#ff5a5a", FINAL: "#7CFFB2", UPCOMING: "#cfa14a", OPEN: "#8fd9bf" };
  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "2px 0 6px" }}>
      {counting.map(s => {
        const rid = s.roundId!;
        const isCurrent = rid === current;
        const status =
          decided.has(rid) ? "FINAL"
          : liveRoundId === rid ? "LIVE"
          : sessionStart(s).getTime() > now.getTime() ? "UPCOMING"
          : "OPEN";
        return (
          <button key={rid} onClick={() => go("/score?round=" + rid)}
            aria-current={isCurrent ? "true" : undefined}
            className="head"
            style={{
              flex: "0 0 auto", cursor: "pointer", borderRadius: 12, padding: "8px 12px",
              letterSpacing: .3, whiteSpace: "nowrap", textAlign: "left",
              display: "grid", gap: 2, lineHeight: 1.2,
              border: isCurrent ? "1px solid var(--gold)" : "1px solid var(--line)",
              background: isCurrent ? "linear-gradient(180deg,#1b3a31,#0c1c17)" : "#0f1a17",
              color: isCurrent ? "var(--gold)" : "#cfeede",
            }}>
            <span style={{ fontSize: 12, fontWeight: 900 }}>
              {s.tag}{s.double ? " · 2×" : ""} <span style={{ color: statusColor[status], opacity: .95 }}>{status}</span>
            </span>
            <span style={{ fontSize: 11, opacity: .9 }}>{sessionCourses(s)}</span>
            <span style={{ fontSize: 10, opacity: .6 }}>{s.dayLabel} · {s.groups[0]?.label}</span>
          </button>
        );
      })}
    </div>
  );
}
