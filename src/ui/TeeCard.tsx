// Shared broadcast tee-card pieces, used by both the landing page (Home) and the
// Tee Sheet so a foursome looks identical everywhere. Seats are colored by team;
// the logged-in player's seat and group are highlighted in gold.
//
// Player names + team come from the API `players` directory (threaded in from the
// screen) so they always match the database — the schedule (times, courses, seat
// order) still comes from the static broadcast SESSIONS.
import { TEAMS, sessionCourses, type Session, type TeeGroup } from "../data/broadcast";
import type { PlayerInfo, TeamId } from "../state/players";

type Dir = Record<string, PlayerInfo>;
const teamColor = (team: TeamId) => TEAMS[team].color;

export function Seat({ id, me, players }: { id: string; me: string | null; players: Dir }) {
  const mine = id === me;
  const p = players[id];
  return (
    <span className={"bc-seat" + (mine ? " me" : "")}>
      <span className="pip" style={{ background: teamColor(p?.team ?? "GORSE") }} />
      <span className="nm">{p?.name ?? id}</span>
    </span>
  );
}

export function TeeRow({ g, me, players, showCourse = true }: { g: TeeGroup; me: string | null; players: Dir; showCourse?: boolean }) {
  const mine = me ? g.seats.includes(me) : false;
  return (
    <div className={"bc-tee" + (mine ? " mine" : "")}>
      <div className="bc-tee-time">
        {g.label}
        {mine && <span style={{ color: "var(--gold)" }}>· YOUR GROUP</span>}
        {showCourse && <span className="crs">{g.course}</span>}
      </div>
      <div className="bc-seats">
        {g.seats.map((s) => <Seat key={s} id={s} me={me} players={players} />)}
      </div>
    </div>
  );
}

export function tagClass(s: Session) {
  if (s.kind === "WARMUP") return "warm";
  if (s.kind === "SENDOFF") return "send";
  return "counts";
}

/** Full session card: tag row, course + day header, and both tee groups. */
export function SessionCard({ s, me, liveId, players }: { s: Session; me: string | null; liveId: string | null; players: Dir }) {
  return (
    <article className={"bc-card" + (s.id === liveId ? " live" : "")}>
      <div className="bc-card-top">
        <div className="bc-tags">
          <span className={"bc-tag " + tagClass(s)}>{s.tag}</span>
          {s.double && <span className="bc-tag x2">2× PTS</span>}
          {s.kind === "COUNTS" && <span className="bc-tag warm">COUNTS</span>}
          {s.kind !== "COUNTS" && <span className="bc-tag warm">NO SCORE</span>}
          {s.id === liveId && <span className="bc-tag now">● LIVE</span>}
        </div>
        <div className="bc-card-course">{sessionCourses(s)}</div>
        <div className="bc-card-day">{s.dayLabel}</div>
      </div>
      <div className="bc-card-body">
        {s.groups.map((g, i) => <TeeRow key={i} g={g} me={me} players={players} />)}
      </div>
    </article>
  );
}
