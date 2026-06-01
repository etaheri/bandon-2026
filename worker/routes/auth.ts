import { Hono } from "hono";
import type { Env } from "../types";
import { createSession } from "../auth";

export const authRoutes = new Hono<{
  Bindings: Env;
  Variables: { role: string };
}>();

authRoutes.post("/auth", async (c) => {
  const { passcode } = await c.req.json<{ passcode: string }>();
  if (passcode === c.env.ADMIN_PASSCODE) {
    await createSession(c, "admin");
    return c.json({ ok: true, role: "admin" });
  }
  if (passcode === c.env.PASSCODE) {
    await createSession(c, "player");
    return c.json({ ok: true, role: "player" });
  }
  return c.json({ error: "bad passcode" }, 401);
});
