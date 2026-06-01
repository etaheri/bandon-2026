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

// --- The Bandon Book ---

export interface PropRow {
  id: string;
  creator: string;
  subject: string;
  description: string | null;
  status: string;
  winning_option_id: string | null;
  created_at: number;
  locked_at: number | null;
  resolved_at: number | null;
}
export interface OptionRow {
  id: string;
  prop_id: string;
  label: string;
  position: number;
}
export interface PickRow {
  id: string;
  prop_id: string;
  option_id: string;
  player_id: string;
  created_at: number;
}

export async function getProps(db: D1Database): Promise<PropRow[]> {
  const { results } = await db
    .prepare(
      "SELECT id,creator,subject,description,status,winning_option_id,created_at,locked_at,resolved_at FROM props ORDER BY created_at DESC",
    )
    .all<PropRow>();
  return results;
}

export async function getPropOptions(db: D1Database): Promise<OptionRow[]> {
  const { results } = await db
    .prepare("SELECT id,prop_id,label,position FROM prop_options ORDER BY prop_id,position")
    .all<OptionRow>();
  return results;
}

export async function getPicks(db: D1Database): Promise<PickRow[]> {
  const { results } = await db
    .prepare("SELECT id,prop_id,option_id,player_id,created_at FROM picks")
    .all<PickRow>();
  return results;
}

export async function createProp(
  db: D1Database,
  p: {
    id: string;
    creator: string;
    subject: string;
    description: string | null;
    createdAt: number;
    options: { id: string; label: string; position: number }[];
  },
) {
  await db.batch([
    db
      .prepare(
        "INSERT INTO props (id,creator,subject,description,status,created_at) VALUES (?,?,?,?, 'open', ?)",
      )
      .bind(p.id, p.creator, p.subject, p.description, p.createdAt),
    ...p.options.map((o) =>
      db
        .prepare("INSERT INTO prop_options (id,prop_id,label,position) VALUES (?,?,?,?)")
        .bind(o.id, p.id, o.label, o.position),
    ),
  ]);
}

/** Insert a pick. Result tells the route which HTTP status to return. */
export async function insertPick(
  db: D1Database,
  pick: { id: string; propId: string; optionId: string; playerId: string; createdAt: number },
): Promise<"ok" | "closed" | "dup" | "badoption"> {
  const prop = await db
    .prepare("SELECT status FROM props WHERE id=?")
    .bind(pick.propId)
    .first<{ status: string }>();
  if (!prop) return "badoption";
  if (prop.status !== "open") return "closed";
  const opt = await db
    .prepare("SELECT id FROM prop_options WHERE id=? AND prop_id=?")
    .bind(pick.optionId, pick.propId)
    .first();
  if (!opt) return "badoption";
  try {
    await db
      .prepare("INSERT INTO picks (id,prop_id,option_id,player_id,created_at) VALUES (?,?,?,?,?)")
      .bind(pick.id, pick.propId, pick.optionId, pick.playerId, pick.createdAt)
      .run();
    return "ok";
  } catch {
    return "dup"; // UNIQUE(prop_id,player_id) violation
  }
}

/** open -> locked. Returns false if the prop wasn't open. */
export async function lockProp(db: D1Database, propId: string, lockedAt: number): Promise<boolean> {
  const res = await db
    .prepare("UPDATE props SET status='locked', locked_at=? WHERE id=? AND status='open'")
    .bind(lockedAt, propId)
    .run();
  return (res.meta.changes ?? 0) > 0;
}

/** Set the winning option and mark resolved (allowed from open or locked). */
export async function resolveProp(
  db: D1Database,
  propId: string,
  winningOptionId: string,
  resolvedAt: number,
): Promise<"ok" | "notfound" | "badoption"> {
  const opt = await db
    .prepare("SELECT id FROM prop_options WHERE id=? AND prop_id=?")
    .bind(winningOptionId, propId)
    .first();
  if (!opt) {
    const prop = await db.prepare("SELECT id FROM props WHERE id=?").bind(propId).first();
    return prop ? "badoption" : "notfound";
  }
  await db
    .prepare(
      "UPDATE props SET status='resolved', winning_option_id=?, resolved_at=? WHERE id=?",
    )
    .bind(winningOptionId, resolvedAt, propId)
    .run();
  return "ok";
}
