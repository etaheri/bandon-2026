import { Hono } from "hono";
import type { Env } from "../types";
import { requireSession } from "../auth";
import {
  getPlayers,
  getRounds,
  getTeeAssignments,
  getSettings,
  getCourses,
} from "../db";

export const stateRoutes = new Hono<{
  Bindings: Env;
  Variables: { role: string };
}>();

stateRoutes.get("/state", requireSession, async (c) => {
  const [players, rounds, tee, settings, courses] = await Promise.all([
    getPlayers(c.env.DB),
    getRounds(c.env.DB),
    getTeeAssignments(c.env.DB),
    getSettings(c.env.DB),
    getCourses(c.env.DB),
  ]);
  const courseMeta = Object.values(courses).map(({ id, name, par }) => ({
    id,
    name,
    par,
  }));
  return c.json({
    players,
    rounds,
    teeAssignments: tee,
    settings,
    courses: courseMeta,
  });
});
