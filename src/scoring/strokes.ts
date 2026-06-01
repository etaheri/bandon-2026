/** Apply handicap allowance and round half-up to a whole playing handicap. */
export function playingHandicap(fullHandicap: number, allowance: number): number {
  return Math.round(fullHandicap * allowance);
}

/** Strokes received on a hole given a (whole) playing handicap and the hole's stroke index. */
export function strokesReceived(playingHcp: number, strokeIndex: number): number {
  if (playingHcp <= 0) return 0;
  const base = Math.floor(playingHcp / 18);
  const extra = strokeIndex <= (playingHcp % 18) ? 1 : 0;
  return base + extra;
}
