import { useTrip } from "../state/useTrip";
import { getPlayerId } from "../state/session";
import { liveRound, nextUpcoming } from "../schedule";
import { go } from "../App";

export function Home() {
  const { state } = useTrip();
  const me = getPlayerId();
  if (!state) return <div style={{ padding: 24 }}>Loading…</div>;
  const myName = me ? state.players.find((p: any) => p.id === me)?.name ?? me : null;

  const rounds: any[] = state.rounds ?? [];
  const courseName = (cid: string) => state.courses?.find((c: any) => c.id === cid)?.name ?? cid;
  const myGroup = (roundId: string) => {
    if (!me) return null;
    const a = state.teeAssignments?.find((t: any) => t.round_id === roundId && t.player_id === me);
    return a ? a.group_no : null;
  };

  const now = new Date();
  const live = liveRound(rounds as any, now);
  const next = nextUpcoming(rounds as any, now);

  const Card = ({ tag, r }: { tag: string; r: any }) => {
    const grp = myGroup(r.id);
    return (
      <div className="panel" style={{ padding: 14 }}>
        <div className="head" style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{tag}</span><span>{r.day} {r.teeTime}</span>
        </div>
        <div className="head" style={{ fontSize: 20, marginTop: 4 }}>{courseName(r.courseId)}</div>
        {grp != null && <div style={{ opacity: .8, marginTop: 4 }}>You're in Group {grp}</div>}
      </div>
    );
  };

  return (
    <div style={{ padding: 20, display: "grid", gap: 16 }}>
      <h1 className="head" style={{ textAlign: "center" }}>Bandon Cup '26</h1>
      {myName ? (
        <div className="panel" style={{ padding: 14, textAlign: "center" }}>Playing as <b>{myName}</b></div>
      ) : (
        <div className="panel" style={{ padding: 14, textAlign: "center", opacity: .85 }}>Spectating · tap Enter Score to log in</div>
      )}

      {live && <Card tag="● LIVE NOW" r={live} />}
      {next && <Card tag="UP NEXT" r={next} />}
      {!live && !next && <div className="panel" style={{ padding: 14, textAlign: "center" }}>Trip complete — see the final board.</div>}

      <button className="btn" onClick={() => go("/board")}>Leaderboard</button>
      <button className="btn" onClick={() => go("/score?round=" + (live?.id ?? next?.id ?? "r2"))}>Enter Score</button>
      <button className="btn" onClick={() => go("/tee")}>Tee Sheet</button>

      <div style={{ textAlign: "center", opacity: .6, fontSize: 12 }}>BANDON SPORTS — IT'S IN THE GAME</div>
    </div>
  );
}
