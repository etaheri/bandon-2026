import type { Player, Team } from "./types";
import { playingHandicap } from "./strokes";

export interface TeamBalance {
  teams: Record<Team, string[]>; // player ids per team
  playingTotals: Record<Team, number>; // Σ playing handicap per team
  indexTotals: Record<Team, number>; // Σ raw handicap index per team
}

/** All k-sized subsets of [0..n). For equal halves we'd double-count mirror
 *  splits, so the caller fixes index 0 into one side to keep it to C(n-1,k-1). */
function combinations(n: number, k: number, mustInclude0: boolean): number[][] {
  const out: number[][] = [];
  const pick = (start: number, chosen: number[]) => {
    if (chosen.length === k) { out.push(chosen.slice()); return; }
    for (let i = start; i < n; i++) { chosen.push(i); pick(i + 1, chosen); chosen.pop(); }
  };
  if (mustInclude0) pick(1, [0]);
  else pick(0, []);
  return out;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/**
 * Split players into two even teams optimised for a fair net-Stableford match.
 *
 * Every possible even split is scored and the best is chosen lexicographically
 * over (in priority order):
 *   1. playingGap — |Σ playing hcp GORSE − Σ playing hcp DRIFTWOOD|. Playing
 *      handicap (index × allowance, rounded) is what actually sets net strokes
 *      received, so equal totals ≈ equal net advantage. This dominates.
 *   2. anchorGap  — |min index GORSE − min index DRIFTWOOD|. Splits the
 *      strongest players across teams; low handicaps quietly outperform their
 *      number at sub-100% allowance, so each side should have a comparable best.
 *   3. indexGap   — |Σ index GORSE − Σ index DRIFTWOOD|. Sub-stroke tiebreak,
 *      purely for a deterministic result.
 *
 * Team labels are assigned deterministically: GORSE is the side with the higher
 * total playing handicap (tie → the side holding the alphabetically-first id),
 * so the same roster always yields the same labelled split.
 */
export function balanceTeams(players: Player[], allowance: number): TeamBalance {
  if (players.length < 2) throw new Error("need at least 2 players to balance");
  const phc = players.map((p) => playingHandicap(p.handicap, allowance));
  const idx = players.map((p) => p.handicap);
  const n = players.length;
  const kGorse = Math.floor(n / 2);
  const equalHalves = n % 2 === 0;

  let best: { a: number[]; b: number[]; score: [number, number, number] } | null = null;
  for (const a of combinations(n, kGorse, equalHalves)) {
    const inA = new Set(a);
    const b = [...Array(n).keys()].filter((i) => !inA.has(i));
    const score: [number, number, number] = [
      Math.abs(sum(a.map((i) => phc[i]!)) - sum(b.map((i) => phc[i]!))),
      Math.abs(Math.min(...a.map((i) => idx[i]!)) - Math.min(...b.map((i) => idx[i]!))),
      Math.abs(sum(a.map((i) => idx[i]!)) - sum(b.map((i) => idx[i]!))),
    ];
    if (best == null || score < best.score) best = { a, b, score };
  }

  const grpA = best!.a, grpB = best!.b;
  const playA = sum(grpA.map((i) => phc[i]!)), playB = sum(grpB.map((i) => phc[i]!));
  // GORSE = higher playing total; tie-break on the alphabetically-first id.
  const aIsGorse =
    playA !== playB
      ? playA > playB
      : grpA.map((i) => players[i]!.id).sort()[0]! < grpB.map((i) => players[i]!.id).sort()[0]!;
  const gorse = aIsGorse ? grpA : grpB;
  const driftwood = aIsGorse ? grpB : grpA;

  return {
    teams: {
      GORSE: gorse.map((i) => players[i]!.id),
      DRIFTWOOD: driftwood.map((i) => players[i]!.id),
    },
    playingTotals: {
      GORSE: sum(gorse.map((i) => phc[i]!)),
      DRIFTWOOD: sum(driftwood.map((i) => phc[i]!)),
    },
    indexTotals: {
      GORSE: sum(gorse.map((i) => idx[i]!)),
      DRIFTWOOD: sum(driftwood.map((i) => idx[i]!)),
    },
  };
}
