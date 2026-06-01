import { Hono } from "hono";
import type { Env } from "../types";
import { requireSession, requireAdmin } from "../auth";
import { computeStandings } from "../../src/scoring/book";
import {
  getPlayers, getProps, getPropOptions, getPicks,
  createProp, insertPick, lockProp, resolveProp,
  type OptionRow, type PickRow,
} from "../db";

export const bookRoutes = new Hono<{ Bindings: Env; Variables: { role: string } }>();

// Public read. `?me=<playerId>` annotates each prop with the caller's pick.
bookRoutes.get("/book", async (c) => {
  const me = c.req.query("me") ?? null;
  const [players, props, options, picks] = await Promise.all([
    getPlayers(c.env.DB), getProps(c.env.DB), getPropOptions(c.env.DB), getPicks(c.env.DB),
  ]);

  const optionsByProp = new Map<string, OptionRow[]>();
  for (const o of options) {
    const arr = optionsByProp.get(o.prop_id) ?? [];
    arr.push(o);
    optionsByProp.set(o.prop_id, arr);
  }
  const picksByProp = new Map<string, PickRow[]>();
  for (const p of picks) {
    const arr = picksByProp.get(p.prop_id) ?? [];
    arr.push(p);
    picksByProp.set(p.prop_id, arr);
  }

  const propsOut = props.map((pr) => {
    const propPicks = picksByProp.get(pr.id) ?? [];
    const opts = (optionsByProp.get(pr.id) ?? []).map((o) => ({
      id: o.id,
      label: o.label,
      position: o.position,
      pickCount: propPicks.filter((pk) => pk.option_id === o.id).length,
    }));
    return {
      id: pr.id, creator: pr.creator, subject: pr.subject, description: pr.description,
      status: pr.status, winningOptionId: pr.winning_option_id,
      createdAt: pr.created_at, lockedAt: pr.locked_at, resolvedAt: pr.resolved_at,
      options: opts,
      picks: propPicks.map((pk) => ({ playerId: pk.player_id, optionId: pk.option_id })),
      myPick: me ? (propPicks.find((pk) => pk.player_id === me)?.option_id ?? null) : null,
    };
  });

  const standings = computeStandings(
    props.map((p) => ({ id: p.id, status: p.status, winningOptionId: p.winning_option_id })),
    picks.map((p) => ({ propId: p.prop_id, optionId: p.option_id, playerId: p.player_id })),
    players.map((p) => ({ id: p.id, name: p.name })),
  );

  return c.json({ props: propsOut, standings });
});

bookRoutes.post("/book/prop", requireSession, async (c) => {
  const b = await c.req.json<{ creator?: string; subject?: string; description?: string; options?: string[] }>();
  const subject = b.subject?.trim();
  const creator = b.creator?.trim();
  const labels = (b.options ?? []).map((o) => o?.trim()).filter((o): o is string => !!o);
  if (!creator) return c.json({ error: "creator required" }, 400);
  if (!subject) return c.json({ error: "subject required" }, 400);
  if (labels.length < 2 || labels.length > 8) return c.json({ error: "need 2-8 options" }, 400);
  const id = crypto.randomUUID();
  await createProp(c.env.DB, {
    id, creator, subject,
    description: b.description?.trim() || null,
    createdAt: Date.now(),
    options: labels.map((label, i) => ({ id: crypto.randomUUID(), label, position: i })),
  });
  return c.json({ ok: true, id });
});

bookRoutes.post("/book/pick", requireSession, async (c) => {
  const b = await c.req.json<{ propId?: string; optionId?: string; playerId?: string }>();
  if (!b.propId || !b.optionId || !b.playerId) return c.json({ error: "bad pick" }, 400);
  const r = await insertPick(c.env.DB, {
    id: crypto.randomUUID(), propId: b.propId, optionId: b.optionId, playerId: b.playerId, createdAt: Date.now(),
  });
  if (r === "ok") return c.json({ ok: true });
  if (r === "dup") return c.json({ error: "already picked" }, 409);
  if (r === "closed") return c.json({ error: "picks closed" }, 409);
  return c.json({ error: "bad option" }, 400);
});

bookRoutes.post("/book/lock", requireAdmin, async (c) => {
  const { propId } = await c.req.json<{ propId?: string }>();
  if (!propId) return c.json({ error: "no prop" }, 400);
  const ok = await lockProp(c.env.DB, propId, Date.now());
  return ok ? c.json({ ok: true }) : c.json({ error: "not open" }, 409);
});

bookRoutes.post("/book/resolve", requireAdmin, async (c) => {
  const { propId, winningOptionId } = await c.req.json<{ propId?: string; winningOptionId?: string }>();
  if (!propId || !winningOptionId) return c.json({ error: "bad resolve" }, 400);
  const r = await resolveProp(c.env.DB, propId, winningOptionId, Date.now());
  if (r === "notfound") return c.json({ error: "no such prop" }, 404);
  if (r === "badoption") return c.json({ error: "option not in prop" }, 400);
  return c.json({ ok: true });
});
