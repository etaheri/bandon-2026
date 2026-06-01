import type { Hole, Player, PlayerRoundResult, ScoreMap } from "./types";
import { holePoints } from "./stableford";
import { playingHandicap, strokesReceived } from "./strokes";

export function roundResult(
  player: Player,
  holes: Hole[],
  scores: ScoreMap,
  opts: { allowance: number },
): PlayerRoundResult {
  const phc = playingHandicap(player.handicap, opts.allowance);
  let points = 0;
  let holesPlayed = 0;
  for (const hole of holes) {
    const gross = scores[hole.number];
    if (gross == null) continue;      // not played yet
    holesPlayed++;
    if (gross === 0) continue;        // picked up: played, 0 points
    points += holePoints({ gross, par: hole.par, strokes: strokesReceived(phc, hole.strokeIndex) });
  }
  const quota = player.quotaOverride ?? 36;
  const proratedQuota = quota * (holesPlayed / 18);
  return {
    playerId: player.id,
    holesPlayed,
    points,
    proratedQuota,
    result: points - proratedQuota,
    thru: holesPlayed >= 18 ? "F" : holesPlayed,
  };
}
