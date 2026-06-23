import { useEffect, useState } from "react";
import { getPlayerId } from "../state/session";
import { go } from "../App";
import { homeCss } from "../ui/homeCss";
import { TeeRow, SessionCard } from "../ui/TeeCard";
import { usePlayers, type TeamId } from "../state/players";
import {
  TEAMS, SESSIONS,
  type Session,
  sessionStart, sessionCourses, phaseAt, countdown,
} from "../data/broadcast";
import { api } from "../api/client";

// Inject the broadcast stylesheet exactly once.
function useBroadcastCss() {
  useEffect(() => {
    if (document.getElementById("bc-home-css")) return;
    const el = document.createElement("style");
    el.id = "bc-home-css";
    el.textContent = homeCss;
    document.head.appendChild(el);
  }, []);
}

export function Home() {
  useBroadcastCss();
  const me = getPlayerId();
  const players = usePlayers(); // names + handicaps from the API (DB is source of truth)

  // Team rosters come from the DB too (not the static broadcast roster), so an
  // admin re-balance is reflected here, not just on the leaderboard.
  const teamRoster = (team: TeamId) =>
    Object.entries(players)
      .filter(([, p]) => p.team === team)
      .sort((a, b) => a[1].handicap - b[1].handicap)
      .map(([id]) => id);

  const [decided, setDecided] = useState<Set<string>>(new Set());
  useEffect(() => {
    api.leaderboard()
      .then((lb: any) => setDecided(new Set((lb.roundCups ?? []).filter((rc: any) => rc.decided).map((rc: any) => rc.roundId))))
      .catch(() => {});
  }, []);

  // Re-render every 30s so the countdown ticks and live/next flips on its own.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const phase = phaseAt(now);
  const featured: Session =
    phase.kind === "LIVE" ? phase.live
    : phase.kind === "PRE" ? phase.next
    : SESSIONS[SESSIONS.length - 1]!;
  const liveId = phase.kind === "LIVE" ? phase.live.id : null;

  // Where "Enter Score" should land: the live counting round, else the next
  // counting round, else the final counting round.
  const counting = SESSIONS.filter((s) => s.roundId);
  const scoreRound =
    (phase.kind === "LIVE" && phase.live.roundId) ||
    counting.find((s) => sessionStart(s).getTime() > now.getTime())?.roundId ||
    counting[counting.length - 1]!.roundId!;

  // If the live/next round is already FINAL (all scores in), point at the next
  // counting round that still needs scores instead of nudging a finished one.
  const scoreTarget = decided.has(scoreRound)
    ? (counting.find((s) => s.roundId && !decided.has(s.roundId))?.roundId ?? scoreRound)
    : scoreRound;

  // Status pill.
  let statusDot = "up";
  let statusText: any = "";
  if (phase.kind === "PRE") {
    statusText = <>{phase.next.tag} TEES OFF IN <b>{countdown(sessionStart(phase.next).getTime(), now)}</b></>;
  } else if (phase.kind === "LIVE") {
    statusDot = "live";
    statusText = <>LIVE NOW · <b>{phase.live.tag}</b></>;
  } else {
    statusText = <>FINAL · <b>IT'S IN THE BOOKS</b></>;
  }

  const featLabel = phase.kind === "LIVE" ? "On The Tee" : phase.kind === "PRE" ? "Up Next" : "Final Round";

  // Ticker: every tee time of the week, rendered twice for a seamless loop.
  const ticks = SESSIONS.flatMap((s) =>
    s.groups.map((g) => ({
      course: g.course, day: s.dayLabel, time: g.label,
      mine: me ? g.seats.includes(me) : false,
      live: s.id === liveId,
    }))
  );
  const Tick = ({ t }: { t: typeof ticks[number] }) => (
    <span className="bc-tick">
      <span className="dot" />
      <b>{t.course}</b> {t.day} · {t.time}
      {t.live && <span className="live">● LIVE</span>}
      {t.mine && <span style={{ color: "var(--gold)" }}>· YOU</span>}
    </span>
  );

  return (
    <div className="bc-stage">
      {/* HERO */}
      <header className="bc-hero bc-fade" style={{ animationDelay: "0ms" }}>
        <div className="bc-hero-bg" />
        <div className="bc-bug"><img src="/logo-puffin.png" alt="Bandon Dunes" /></div>
        <div className="bc-hero-in">
          <p className="bc-kicker">Bandon Dunes Resort · Oregon</p>
          <h1 className="bc-title">Bandon Cup<small>— 2026 —</small></h1>
          <div className="bc-sub">
            <span className="g">{TEAMS.GORSE.name}</span><span className="x">vs</span><span className="d">{TEAMS.DRIFTWOOD.name}</span>
            <span className="x">·</span><span>Jun 3–7</span>
          </div>
          <span className="bc-status">
            <span className={"bc-dot " + statusDot} />
            {statusText}
          </span>
        </div>
      </header>

      {/* VERSUS */}
      <div className="bc-h">The Matchup</div>
      <div className="bc-vs bc-fade" style={{ animationDelay: "80ms" }}>
        <div className="bc-team gorse">
          <h3>{TEAMS.GORSE.name}</h3>
          <ul>
            {teamRoster("GORSE").map((id) => (
              <li key={id} className={id === me ? "me" : ""}>
                {players[id]?.name ?? id}<span className="hc">{players[id]?.handicap}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bc-vsbadge">VS</div>
        <div className="bc-team drift">
          <h3>{TEAMS.DRIFTWOOD.name}</h3>
          <ul>
            {teamRoster("DRIFTWOOD").map((id) => (
              <li key={id} className={id === me ? "me" : ""}>
                {players[id]?.name ?? id}<span className="hc">{players[id]?.handicap}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* FEATURED — live or up next */}
      <div className="bc-h">{featLabel}</div>
      <section className="bc-feat bc-fade" style={{ animationDelay: "150ms" }}>
        <div className="bc-feat-top">
          <span className="c">{sessionCourses(featured)}</span>
          <span className="day">{featured.dayLabel}</span>
        </div>
        <div className="bc-feat-grid">
          {featured.groups.map((g, i) => <TeeRow key={i} g={g} me={me} players={players} />)}
        </div>
        <div className="head" style={{ textAlign: "center", marginTop: 8, opacity: .55,
          fontSize: 11, letterSpacing: ".5px", textTransform: "uppercase" }}>
          All tee times Pacific (PT)
        </div>
      </section>

      {/* FULL SCHEDULE RAIL — every tee time, scored or not */}
      <div className="bc-h">Full Tee Sheet · Pacific (PT) · Swipe →</div>
      <div className="bc-rail bc-fade" style={{ animationDelay: "210ms" }}>
        {SESSIONS.map((s) => <SessionCard key={s.id} s={s} me={me} liveId={liveId} players={players} />)}
      </div>

      {/* CTAs */}
      <div className="bc-cta bc-fade" style={{ animationDelay: "270ms" }}>
        <button className="bc-start" onClick={() => go("/score?round=" + scoreTarget)}>
          <span className="arw">▸</span> Press Start — Enter Score
        </button>
        <div className="bc-row">
          <button className="bc-ghost" onClick={() => go("/board")}>Leaderboard</button>
          <button className="bc-ghost" onClick={() => go("/tee")}>Tee Sheet</button>
        </div>
        <div className="bc-row">
          <button className="bc-ghost" onClick={() => go("/score?round=" + scoreTarget)}>Enter / Fix Another Round</button>
          <button className="bc-ghost" onClick={() => go("/rules")}>How It Works</button>
        </div>
        <div className="bc-row">
          <button className="bc-ghost" onClick={() => go("/book")}>The Book 🎲</button>
        </div>
        {me ? (
          <div className="bc-sub" style={{ justifyContent: "center", opacity: .85 }}>
            Playing as <span className="g" style={{ marginLeft: 4 }}>{players[me]?.name ?? me}</span>
          </div>
        ) : (
          <div className="bc-sub" style={{ justifyContent: "center", opacity: .7, fontSize: 13 }}>
            Spectating · tap Press Start to log in &amp; score
          </div>
        )}
      </div>

      {/* TICKER */}
      <div className="bc-ticker">
        <div className="bc-ticker-lbl">Tee Times</div>
        <div className="bc-ticker-win">
          <div className="bc-ticker-track">
            {ticks.map((t, i) => <Tick key={"a" + i} t={t} />)}
            {ticks.map((t, i) => <Tick key={"b" + i} t={t} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
