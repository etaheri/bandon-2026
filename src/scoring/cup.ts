export interface CupSplit { gorse: number; driftwood: number; }

export function cupPointsForRound(gorseResult: number, driftwoodResult: number, double: boolean): CupSplit {
  const pts = double ? 2 : 1;
  if (gorseResult > driftwoodResult) return { gorse: pts, driftwood: 0 };
  if (driftwoodResult > gorseResult) return { gorse: 0, driftwood: pts };
  return { gorse: pts / 2, driftwood: pts / 2 };
}

export interface RoundCup { gorse: number; driftwood: number; double: boolean; decided: boolean; }

export function tallyCup(rounds: RoundCup[]): { gorse: number; driftwood: number; available: number } {
  let gorse = 0, driftwood = 0, available = 0;
  for (const r of rounds) {
    if (r.decided) { gorse += r.gorse; driftwood += r.driftwood; }
    else available += r.double ? 2 : 1;
  }
  return { gorse, driftwood, available };
}

export type ClinchLabel = "CLINCHED" | "RETAINS" | "ALIVE" | "MUST WIN FINALE" | "ELIMINATED";

/** TOTAL_POINTS = 7, WIN = 4, RETAIN = 3.5. */
export function clinchState(gorse: number, driftwood: number, available: number): { gorse: ClinchLabel; driftwood: ClinchLabel } {
  const WIN = 4, RETAIN = 3.5;
  const label = (me: number, them: number, isHolder: boolean): ClinchLabel => {
    const themMax = them + available;
    const myMax = me + available;
    if (me >= WIN) return "CLINCHED";
    if (me > themMax) return "CLINCHED";            // opponent can't reach me
    if (isHolder && me >= RETAIN && me >= themMax) return "RETAINS"; // best opp can do is tie
    if (myMax < RETAIN && !isHolder) return "ELIMINATED";
    if (myMax < WIN && isHolder && themMax > RETAIN) return "ELIMINATED";
    // still mathematically alive; if a single finale (available===2) decides it, surface MUST WIN
    if (available === 2 && me < them) return "MUST WIN FINALE";
    return "ALIVE";
  };
  // Gorse is the defending holder in '26 (defaults; flip if needed via seed later).
  return { gorse: label(gorse, driftwood, true), driftwood: label(driftwood, gorse, false) };
}
