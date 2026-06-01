import type { Course, Player, Round, ScoreMap } from "../src/scoring/types";

export async function getPlayers(db: D1Database): Promise<Player[]> {
  const { results } = await db
    .prepare("SELECT id,name,handicap,quota_override,team FROM players")
    .all<any>();
  return results.map((r) => ({
    id: r.id,
    name: r.name,
    handicap: r.handicap,
    quotaOverride: r.quota_override,
    team: r.team,
  }));
}

export async function getCourses(
  db: D1Database,
): Promise<Record<string, Course>> {
  const courses = (await db.prepare("SELECT id,name,par FROM courses").all<any>())
    .results;
  const holes = (
    await db
      .prepare("SELECT course_id,number,par,stroke_index FROM holes")
      .all<any>()
  ).results;
  const map: Record<string, Course> = {};
  for (const c of courses)
    map[c.id] = { id: c.id, name: c.name, par: c.par, holes: [] };
  for (const h of holes as any[])
    map[h.course_id]?.holes.push({
      number: h.number,
      par: h.par,
      strokeIndex: h.stroke_index,
    });
  for (const c of Object.values(map)) c.holes.sort((a, b) => a.number - b.number);
  return map;
}

export async function getRounds(db: D1Database): Promise<Round[]> {
  const { results } = await db
    .prepare(
      "SELECT id,course_id,label,day,date,tee_time,counts,double_points FROM rounds ORDER BY id",
    )
    .all<any>();
  return results.map((r) => ({
    id: r.id,
    courseId: r.course_id,
    label: r.label,
    day: r.day,
    date: r.date ?? "",
    teeTime: r.tee_time,
    counts: !!r.counts,
    doublePoints: !!r.double_points,
  }));
}

export async function getTeeAssignments(db: D1Database) {
  const { results } = await db
    .prepare("SELECT round_id,player_id,group_no FROM tee_assignments")
    .all<any>();
  return results as { round_id: string; player_id: string; group_no: number }[];
}

export async function getSettings(
  db: D1Database,
): Promise<Record<string, string>> {
  const { results } = await db.prepare("SELECT key,value FROM settings").all<any>();
  return Object.fromEntries(results.map((r) => [r.key, r.value]));
}

export async function getScoresByRound(
  db: D1Database,
): Promise<Record<string, Record<string, ScoreMap>>> {
  const { results } = await db
    .prepare("SELECT round_id,player_id,hole,gross FROM scores")
    .all<any>();
  const out: Record<string, Record<string, ScoreMap>> = {};
  for (const s of results as any[]) {
    ((out[s.round_id] ??= {})[s.player_id] ??= {})[s.hole] = s.gross;
  }
  return out;
}

export async function getRoundScores(db: D1Database, roundId: string) {
  const { results } = await db
    .prepare(
      "SELECT player_id,hole,gross,updated_at FROM scores WHERE round_id=?",
    )
    .bind(roundId)
    .all<any>();
  return results as {
    player_id: string;
    hole: number;
    gross: number | null;
    updated_at: number;
  }[];
}

/** Upsert a score with last-write-wins by updated_at. Returns true if applied. */
export async function upsertScore(
  db: D1Database,
  s: {
    roundId: string;
    playerId: string;
    hole: number;
    gross: number | null;
    updatedAt: number;
  },
): Promise<boolean> {
  const res = await db
    .prepare(
      `INSERT INTO scores (round_id,player_id,hole,gross,updated_at) VALUES (?,?,?,?,?)
     ON CONFLICT(round_id,player_id,hole) DO UPDATE SET gross=excluded.gross, updated_at=excluded.updated_at
     WHERE excluded.updated_at > scores.updated_at`,
    )
    .bind(s.roundId, s.playerId, s.hole, s.gross, s.updatedAt)
    .run();
  return (res.meta.changes ?? 0) > 0;
}

export async function setHandicaps(
  db: D1Database,
  items: { id: string; handicap: number }[],
) {
  if (items.length === 0) return; // db.batch([]) throws
  const stmt = db.prepare("UPDATE players SET handicap=? WHERE id=?");
  await db.batch(items.map((i) => stmt.bind(i.handicap, i.id)));
}

export async function setSetting(db: D1Database, key: string, value: string) {
  await db
    .prepare(
      "INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    )
    .bind(key, value)
    .run();
}

export async function setQuotaOverride(
  db: D1Database,
  playerId: string,
  quota: number | null,
) {
  await db
    .prepare("UPDATE players SET quota_override=? WHERE id=?")
    .bind(quota, playerId)
    .run();
}
