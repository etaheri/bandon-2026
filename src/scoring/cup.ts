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

export type ClinchLabel = "CLINCHED" | "PUTT-OFF" | "ALIVE" | "MUST WIN FINALE" | "ELIMINATED";

/**
 * TOTAL_POINTS = 7, WIN = 4. This is the first Cup, so there is no defending
 * holder — a team wins outright only by reaching 4. The lone tie (3.5–3.5) is
 * broken by a sudden-death putting contest, surfaced as the PUTT-OFF label.
 */
export function clinchState(gorse: number, driftwood: number, available: number): { gorse: ClinchLabel; driftwood: ClinchLabel } {
  const WIN = 4, TIE = 3.5;
  const label = (me: number, them: number): ClinchLabel => {
    const themMax = them + available;
    const myMax = me + available;
    if (me >= WIN || me > themMax) return "CLINCHED";        // outright win secured
    if (them >= WIN || them > myMax) return "ELIMINATED";    // opponent secured the win
    if (myMax < TIE) return "ELIMINATED";                    // can't even force a tie
    if (me >= TIE && themMax <= me) return "PUTT-OFF";       // worst case is a 3.5–3.5 putt-off
    // still mathematically alive; if a single finale (available===2) decides it, surface MUST WIN
    if (available === 2 && me < them) return "MUST WIN FINALE";
    return "ALIVE";
  };
  return { gorse: label(gorse, driftwood), driftwood: label(driftwood, gorse) };
}
