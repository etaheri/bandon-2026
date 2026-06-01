import { Hono } from "hono";
import type { Env } from "../types";
import { requireSession } from "../auth";
import { getCourses, getRounds, getRoundScores, upsertScore } from "../db";

export const roundRoutes = new Hono<{
  Bindings: Env;
  Variables: { role: string };
}>();

roundRoutes.get("/round/:id", async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "no such round" }, 404);
  const [rounds, courses, scores] = await Promise.all([
    getRounds(c.env.DB),
    getCourses(c.env.DB),
    getRoundScores(c.env.DB, id),
  ]);
  const round = rounds.find((r) => r.id === id);
  if (!round) return c.json({ error: "no such round" }, 404);
  const course = courses[round.courseId];
  if (!course) return c.json({ error: "course not found" }, 500);
  return c.json({ round, holes: course.holes, scores });
});

roundRoutes.post("/score", requireSession, async (c) => {
  const b = await c.req.json<{
    roundId: string;
    playerId: string;
    hole: number;
    gross: number | null;
    updatedAt: number;
  }>();
  if (!b.roundId || !b.playerId || typeof b.hole !== "number" || b.hole < 1 || b.hole > 18)
    return c.json({ error: "bad score" }, 400);
  if (b.gross != null && (b.gross < 0 || b.gross > 20))
    return c.json({ error: "gross out of range" }, 400);
  const applied = await upsertScore(c.env.DB, b);
  return c.json({ ok: true, applied });
});
