import { Hono } from "hono";
import type { Env } from "../types";
import { requireAdmin } from "../auth";
import { setHandicaps, setSetting, setQuotaOverride, setTeams } from "../db";

export const adminRoutes = new Hono<{
  Bindings: Env;
  Variables: { role: string };
}>();

adminRoutes.post("/admin/handicaps", requireAdmin, async (c) => {
  const { players } = await c.req.json<{
    players: { id: string; handicap: number }[];
  }>();
  await setHandicaps(c.env.DB, players);
  return c.json({ ok: true });
});

adminRoutes.post("/admin/teams", requireAdmin, async (c) => {
  const { players } = await c.req.json<{
    players: { id: string; team: "GORSE" | "DRIFTWOOD" }[];
  }>();
  await setTeams(c.env.DB, players);
  return c.json({ ok: true });
});

adminRoutes.post("/admin/settings", requireAdmin, async (c) => {
  const b = await c.req.json<{
    allowance?: number;
    handicapsLocked?: boolean;
    quotaOverrides?: { id: string; quota: number | null }[];
  }>();
  if (b.allowance != null)
    await setSetting(c.env.DB, "allowance", String(b.allowance));
  if (b.handicapsLocked != null)
    await setSetting(c.env.DB, "handicaps_locked", b.handicapsLocked ? "1" : "0");
  for (const q of b.quotaOverrides ?? [])
    await setQuotaOverride(c.env.DB, q.id, q.quota);
  return c.json({ ok: true });
});
