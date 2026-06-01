// Pure standings/titles for The Bandon Book. No DB, no React — unit-tested in
// test/scoring/book.test.ts. Given props + picks, derive each player's correct
// / wrong / hit-rate over RESOLVED props and assign fun titles.

export interface PropLite {
  id: string;
  status: string; // 'open' | 'locked' | 'resolved'
  winningOptionId: string | null;
}
export interface PickLite {
  propId: string;
  optionId: string;
  playerId: string;
}
export interface PlayerLite {
  id: string;
  name: string;
}
export interface Standing {
  playerId: string;
  name: string;
  correct: number;
  wrong: number;
  resolvedPicked: number; // picks on resolved props
  hitRate: number; // correct / resolvedPicked, 0 when none
  titles: string[];
}

const SHARP_MIN_PICKS = 3;
const ORACLE = "🔮 The Oracle";
const SHARP = "🎯 Sharpshooter";
const TANK = "🚽 Tank Job";

export function computeStandings(
  props: PropLite[],
  picks: PickLite[],
  players: PlayerLite[],
): Standing[] {
  const winners = new Map<string, string>(); // propId -> winning option id
  for (const p of props) {
    if (p.status === "resolved" && p.winningOptionId) winners.set(p.id, p.winningOptionId);
  }

  const byId = new Map<string, Standing>();
  for (const pl of players) {
    byId.set(pl.id, {
      playerId: pl.id,
      name: pl.name,
      correct: 0,
      wrong: 0,
      resolvedPicked: 0,
      hitRate: 0,
      titles: [],
    });
  }

  for (const pick of picks) {
    const winner = winners.get(pick.propId);
    if (winner == null) continue; // prop not resolved
    const s = byId.get(pick.playerId);
    if (!s) continue; // pick by an unknown player — ignore
    s.resolvedPicked++;
    if (pick.optionId === winner) s.correct++;
    else s.wrong++;
  }

  const standings = [...byId.values()];
  for (const s of standings) {
    s.hitRate = s.resolvedPicked > 0 ? s.correct / s.resolvedPicked : 0;
  }

  // Oracle: most correct (≥1), ties share it.
  const maxCorrect = Math.max(0, ...standings.map((s) => s.correct));
  if (maxCorrect > 0) {
    for (const s of standings) if (s.correct === maxCorrect) s.titles.push(ORACLE);
  }

  // Tank Job: most wrong (≥1), ties share it. Computed AFTER Oracle and over
  // non-Oracle players only — nobody should hold both the best and worst title.
  const tankPool = standings.filter((s) => !s.titles.includes(ORACLE));
  const maxWrong = Math.max(0, ...tankPool.map((s) => s.wrong));
  if (maxWrong > 0) {
    for (const s of tankPool) if (s.wrong === maxWrong) s.titles.push(TANK);
  }

  // Sharpshooter: best hit rate among players with enough resolved picks who
  // aren't already the Oracle (so selective sharp pickers get their own shine).
  // Compare ratios via integer cross-multiplication to avoid float equality
  // hazards: a/b vs c/d compared as a*d vs c*b (all non-negative).
  const eligible = standings.filter(
    (s) => s.resolvedPicked >= SHARP_MIN_PICKS && !s.titles.includes(ORACLE),
  );
  if (eligible.length) {
    const bestRatioPlayer = eligible.reduce((best, s) =>
      s.correct * best.resolvedPicked > best.correct * s.resolvedPicked ? s : best,
    );
    if (bestRatioPlayer.correct > 0) {
      for (const s of eligible) {
        if (s.correct * bestRatioPlayer.resolvedPicked === bestRatioPlayer.correct * s.resolvedPicked) {
          s.titles.push(SHARP);
        }
      }
    }
  }

  standings.sort(
    (a, b) => b.correct - a.correct || b.hitRate - a.hitRate || a.name.localeCompare(b.name),
  );
  return standings;
}
