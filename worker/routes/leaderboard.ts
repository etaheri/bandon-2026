import { Hono } from "hono";
import type { Env } from "../types";
import { requireSession } from "../auth";
import { computeLeaderboard } from "../../src/scoring";
import {
  getPlayers,
  getRounds,
  getCourses,
  getScoresByRound,
  getSettings,
} from "../db";

export const leaderboardRoutes = new Hono<{
  Bindings: Env;
  Variables: { role: string };
}>();

leaderboardRoutes.get("/leaderboard", requireSession, async (c) => {
  const [players, rounds, courses, scoresByRound, settings] = await Promise.all(
    [
      getPlayers(c.env.DB),
      getRounds(c.env.DB),
      getCourses(c.env.DB),
      getScoresByRound(c.env.DB),
      getSettings(c.env.DB),
    ],
  );
  const allowance = parseFloat(settings.allowance ?? "0.75");
  const lb = computeLeaderboard({
    players,
    rounds,
    courses,
    scoresByRound,
    allowance,
  });
  return c.json(lb);
});
