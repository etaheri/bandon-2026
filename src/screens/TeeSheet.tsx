import { useTrip } from "../state/useTrip";
import { go } from "../App";

export function TeeSheet() {
  const { state } = useTrip();
  if (!state) return <div style={{ padding: 24 }}>Loading…</div>;
  const nameOf = (id: string) => state.players.find((p: any) => p.id === id)?.name ?? id;
  const byRound = (rid: string, g: number) =>
    state.teeAssignments.filter((t: any) => t.round_id === rid && t.group_no === g).map((t: any) => nameOf(t.player_id));

  return (
    <div style={{ padding: 20, display: "grid", gap: 14 }}>
      <div className="head" style={{ display: "flex", justifyContent: "space-between" }}>
        <button className="btn" onClick={() => go("/")}>‹</button><span>Tee Sheet</span><span />
      </div>
      {state.rounds.filter((r: any) => r.counts).map((r: any) => (
        <div key={r.id} className="panel" style={{ padding: 14 }}>
          <div className="head" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{r.label}</span><span>{r.day} {r.teeTime}{r.doublePoints ? " · 2×" : ""}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
            <div><div style={{ opacity: .7 }}>Group 1</div>{byRound(r.id, 1).map((n: string) => <div key={n}>{n}</div>)}</div>
            <div><div style={{ opacity: .7 }}>Group 2</div>{byRound(r.id, 2).map((n: string) => <div key={n}>{n}</div>)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
