import type { Player, Round, Course, ScoreMap, Team, PlayerRoundResult } from "./types";
import { roundResult } from "./round";
import { cupPointsForRound, tallyCup, clinchState } from "./cup";
import { playerOfTheTrip, dailyLowRounds } from "./crowns";

export * from "./types";
export { roundResult } from "./round";
export { strokesReceived, playingHandicap } from "./strokes";
export { holePoints } from "./stableford";

export interface LeaderboardInput {
  players: Player[];
  rounds: Round[];
  courses: Record<string, Course>;
  scoresByRound: Record<string, Record<string, ScoreMap>>;
  allowance: number;
}

export interface PerRoundCell { result: number; points: number; thru: number | "F"; holesPlayed: number; }
export interface RoundCupResult { roundId: string; gorse: number; driftwood: number; double: boolean; decided: boolean; }

export function computeLeaderboard(input: LeaderboardInput) {
  const { players, rounds, courses, scoresByRound, allowance } = input;
  const countingRounds = rounds.filter(r => r.counts);

  const roundCups: RoundCupResult[] = [];
  const dayResults: { playerId: string; day: string; result: number }[] = [];
  const liveByPlayer = new Map<string, { result: number; thru: number | "F" }>();
  const perRoundByPlayer = new Map<string, Record<string, PerRoundCell>>();

  for (const round of countingRounds) {
    const course = courses[round.courseId];
    if (!course) continue;
    const holes = course.holes;
    const scores = scoresByRound[round.id] ?? {};
    let gorse = 0, driftwood = 0, anyPlayed = false, allDone = true;
    for (const p of players) {
      const rr: PlayerRoundResult = roundResult(p, holes, scores[p.id] ?? {}, { allowance });
      if (rr.holesPlayed > 0) anyPlayed = true;
      if (rr.thru !== "F") allDone = false;
      if (p.team === "GORSE") gorse += rr.result; else driftwood += rr.result;
      if (rr.holesPlayed > 0) dayResults.push({ playerId: p.id, day: round.day, result: rr.result });

      const agg = liveByPlayer.get(p.id) ?? { result: 0, thru: "F" as number | "F" };
      agg.result += rr.result;
      if (rr.thru !== "F" && rr.holesPlayed > 0) agg.thru = rr.thru;
      liveByPlayer.set(p.id, agg);

      const pr = perRoundByPlayer.get(p.id) ?? {};
      pr[round.id] = { result: round1(rr.result), points: rr.points, thru: rr.thru, holesPlayed: rr.holesPlayed };
      perRoundByPlayer.set(p.id, pr);
    }
    const split = cupPointsForRound(gorse, driftwood, round.doublePoints);
    roundCups.push({ roundId: round.id, gorse: split.gorse, driftwood: split.driftwood, double: round.doublePoints, decided: anyPlayed && allDone });
  }

  const cup = tallyCup(roundCups);
  const clinch = clinchState(cup.gorse, cup.driftwood, cup.available);
  const pot = playerOfTheTrip(dayResults);
  const lows = dailyLowRounds(dayResults);

  const teamAgg: Record<Team, number> = { GORSE: 0, DRIFTWOOD: 0 };
  const playerRows = players.map(p => {
    const agg = liveByPlayer.get(p.id) ?? { result: 0, thru: "F" as number | "F" };
    teamAgg[p.team] += agg.result;
    return {
      playerId: p.id, name: p.name, team: p.team,
      handicap: p.handicap, quotaOverride: p.quotaOverride,
      result: round1(agg.result), thru: agg.thru,
      perRound: perRoundByPlayer.get(p.id) ?? {},
    };
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
    roundCups,
    allowance,
    rounds: countingRounds.map(r => ({
      id: r.id, label: r.label, day: r.day, date: r.date, teeTime: r.teeTime,
      courseId: r.courseId, counts: r.counts, doublePoints: r.doublePoints,
    })),
    courses: Object.values(courses).map(c => ({ id: c.id, name: c.name, par: c.par })),
  };
}

function round1(n: number) { return Math.round(n * 10) / 10; }
