import type { Player, Round, Course, ScoreMap, Team } from "./types";
import { roundResult } from "./round";
import { cupPointsForRound, tallyCup, clinchState, type RoundCup } from "./cup";
import { playerOfTheTrip, dailyLowRounds } from "./crowns";

export * from "./types";
export { roundResult } from "./round";
export { strokesReceived, playingHandicap } from "./strokes";
export { holePoints } from "./stableford";

export interface LeaderboardInput {
  players: Player[];
  rounds: Round[];
  courses: Record<string, Course>;
  scoresByRound: Record<string, Record<string, ScoreMap>>; // roundId -> playerId -> ScoreMap
  allowance: number;
}

export function computeLeaderboard(input: LeaderboardInput) {
  const { players, rounds, courses, scoresByRound, allowance } = input;

  // per round, per player results
  const perRound: RoundCup[] = [];
  const dayResults: { playerId: string; day: string; result: number }[] = [];
  const liveByPlayer = new Map<string, { result: number; thru: number | "F"; played: number }>();

  for (const round of rounds.filter(r => r.counts)) {
    const course = courses[round.courseId];
    if (!course) continue;
    const holes = course.holes;
    const scores = scoresByRound[round.id] ?? {};
    let gorse = 0, driftwood = 0, anyPlayed = false, allDone = true;
    for (const p of players) {
      const rr = roundResult(p, holes, scores[p.id] ?? {}, { allowance });
      if (rr.holesPlayed > 0) anyPlayed = true;
      if (rr.thru !== "F") allDone = false;
      if (p.team === "GORSE") gorse += rr.result; else driftwood += rr.result;
      dayResults.push({ playerId: p.id, day: round.day, result: rr.result });
      const agg = liveByPlayer.get(p.id) ?? { result: 0, thru: "F" as number | "F", played: 0 };
      agg.result += rr.result;
      agg.played += rr.holesPlayed;
      // expose the most relevant "thru": the in-progress round if any, else F
      if (rr.thru !== "F" && rr.holesPlayed > 0) agg.thru = rr.thru;
      liveByPlayer.set(p.id, agg);
    }
    const split = cupPointsForRound(gorse, driftwood, round.doublePoints);
    perRound.push({ gorse: split.gorse, driftwood: split.driftwood, double: round.doublePoints, decided: anyPlayed && allDone });
  }

  const cup = tallyCup(perRound);
  const clinch = clinchState(cup.gorse, cup.driftwood, cup.available);
  const pot = playerOfTheTrip(dayResults);
  const lows = dailyLowRounds(dayResults);

  const teamAgg: Record<Team, number> = { GORSE: 0, DRIFTWOOD: 0 };
  const playerRows = players.map(p => {
    const agg = liveByPlayer.get(p.id) ?? { result: 0, thru: "F" as number | "F", played: 0 };
    teamAgg[p.team] += agg.result;
    return { playerId: p.id, name: p.name, team: p.team, result: round1(agg.result), thru: agg.thru };
  }).sort((a, b) => b.result - a.result);

  const leader: Team = teamAgg.GORSE >= teamAgg.DRIFTWOOD ? "GORSE" : "DRIFTWOOD";
  const topIndividual = playerRows[0]?.playerId ?? null;

  return {
    cup: { gorse: cup.gorse, driftwood: cup.driftwood, available: cup.available },
    clinch,
    teamAggregate: { GORSE: round1(teamAgg.GORSE), DRIFTWOOD: round1(teamAgg.DRIFTWOOD) },
    leader,
    players: playerRows,
    crowns: { playerOfTheTrip: pot, dailyLow: lows, topIndividual },
  };
}

function round1(n: number) { return Math.round(n * 10) / 10; }
