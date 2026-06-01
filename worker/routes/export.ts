import { Hono } from "hono";
import type { Env } from "../types";
import { requireSession } from "../auth";
import { getRoundScores, getRounds } from "../db";

export const exportRoutes = new Hono<{
  Bindings: Env;
  Variables: { role: string };
}>();

exportRoutes.get("/export.csv", requireSession, async (c) => {
  const rounds = await getRounds(c.env.DB);
  const lines = ["round_id,player_id,hole,gross,updated_at"];
  for (const r of rounds) {
    for (const s of await getRoundScores(c.env.DB, r.id)) {
      lines.push(
        `${r.id},${s.player_id},${s.hole},${s.gross ?? ""},${s.updated_at}`,
      );
    }
  }
  return c.body(lines.join("\n"), 200, {
    "content-type": "text/csv",
    "content-disposition": "attachment; filename=bandon-cup.csv",
  });
});
