import { useTrip } from "../state/useTrip";
import { getPlayerId } from "../state/session";
import { go } from "../App";

export function Home() {
  const { state } = useTrip();
  const me = getPlayerId();
  if (!state) return <div style={{ padding: 24 }}>Loading…</div>;
  const myName = state.players.find((p: any) => p.id === me)?.name ?? me;

  return (
    <div style={{ padding: 20, display: "grid", gap: 16 }}>
      <h1 className="head" style={{ textAlign: "center" }}>Bandon Cup '26</h1>
      <div className="panel" style={{ padding: 14, textAlign: "center" }}>Playing as <b>{myName}</b></div>
      <button className="btn" onClick={() => go("/score?round=r2")}>Enter Score</button>
      <button className="btn" onClick={() => go("/board")}>Leaderboard</button>
      <button className="btn" onClick={() => go("/tee")}>Tee Sheet</button>
      <div className="panel" style={{ padding: 14 }}>
        <div className="head">Today's Tee Times</div>
        {state.rounds.filter((r: any) => r.counts).map((r: any) => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
            <span>{r.label} · {r.day}</span><span>{r.teeTime}</span>
          </div>
        ))}
      </div>
      <div style={{ textAlign: "center", opacity: .6, fontSize: 12 }}>BANDON SPORTS — IT'S IN THE GAME</div>
    </div>
  );
}
