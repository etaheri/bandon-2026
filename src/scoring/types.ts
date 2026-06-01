export type Team = "GORSE" | "DRIFTWOOD";

export interface Player { id: string; name: string; handicap: number; quotaOverride: number | null; team: Team; }
export interface Hole { number: number; par: number; strokeIndex: number; }
export interface Course { id: string; name: string; par: number; holes: Hole[]; }
export interface Round { id: string; courseId: string; label: string; day: string; teeTime: string; counts: boolean; doublePoints: boolean; }

/** gross by hole number; missing/null = not played */
export type ScoreMap = Record<number, number | null>;

export interface PlayerRoundResult {
  playerId: string;
  holesPlayed: number;
  points: number;          // net stableford points so far
  proratedQuota: number;
  result: number;          // points - proratedQuota
  thru: number | "F";
}
