import { getPlayerId } from "../state/session";
import { BackButton } from "../ui/BackButton";
import { SessionCard } from "../ui/TeeCard";
import { usePlayers } from "../state/players";
import { SESSIONS, phaseAt } from "../data/broadcast";

export function TeeSheet() {
  const me = getPlayerId();
  const players = usePlayers(); // names from the API, schedule from SESSIONS
  const phase = phaseAt(new Date());
  const liveId = phase.kind === "LIVE" ? phase.live.id : null;

  return (
    <div className="bc-page">
      <div className="bc-topbar">
        <BackButton />
        <h1 className="bc-screen-title">Tee Sheet</h1>
        <span className="sp" />
      </div>

      <div className="bc-h">Full Week · Every Tee Time</div>
      <div style={{ display: "grid", gap: 14 }}>
        {SESSIONS.map((s, i) => (
          <div key={s.id} className="bc-fade" style={{ animationDelay: `${i * 45}ms` }}>
            <SessionCard s={s} me={me} liveId={liveId} players={players} />
          </div>
        ))}
      </div>

      <p style={{ marginTop: 16, textAlign: "center", opacity: .55, fontSize: 12,
        fontFamily: '"Arial Narrow",Impact', letterSpacing: ".5px", textTransform: "uppercase" }}>
        Six counting rounds · warm-up &amp; send-off for fun
      </p>
    </div>
  );
}
