import type { Player } from "./scoring/types";

export type TeeAssignment = {
  round_id: string;
  player_id: string;
  group_no: number;
};

/** The group number a player is assigned to for a round, or null if unassigned. */
export function groupOf(
  roundId: string,
  playerId: string,
  tee: TeeAssignment[],
): number | null {
  const a = tee.find((t) => t.round_id === roundId && t.player_id === playerId);
  return a ? a.group_no : null;
}

/**
 * All players in the same group as `playerId` for `roundId`, returned in
 * `players[]` order. Falls back to just the player when they have no
 * assignment for the round (preserving single-player score entry).
 */
export function groupMembers(
  roundId: string,
  playerId: string,
  tee: TeeAssignment[],
  players: Player[],
): Player[] {
  const g = groupOf(roundId, playerId, tee);
  if (g == null) {
    const self = players.find((p) => p.id === playerId);
    return self ? [self] : [];
  }
  const ids = new Set(
    tee
      .filter((t) => t.round_id === roundId && t.group_no === g)
      .map((t) => t.player_id),
  );
  return players.filter((p) => ids.has(p.id));
}

/** True when every group member has a non-null score for the hole (0 = pick-up counts). */
export function allScored(
  members: Player[],
  scores: Record<string, Record<number, number | null>>,
  hole: number,
): boolean {
  return (
    members.length > 0 && members.every((m) => scores[m.id]?.[hole] != null)
  );
}
