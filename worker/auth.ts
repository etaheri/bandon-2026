import type { Context, Next } from "hono";
import type { Env } from "./types";

const COOKIE = "bandon_session";

type AppEnv = { Bindings: Env; Variables: { role: string } };

export async function createSession(
  c: Context<AppEnv>,
  role: "player" | "admin",
) {
  const token = crypto.randomUUID();
  await c.env.SESSIONS.put(`sess:${token}`, role, {
    expirationTtl: 60 * 60 * 24 * 14,
  });
  c.header(
    "Set-Cookie",
    `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${
      60 * 60 * 24 * 14
    }`,
  );
}

export async function requireSession(c: Context<AppEnv>, next: Next) {
  const role = await roleFromCookie(c);
  if (!role) return c.json({ error: "unauthorized" }, 401);
  c.set("role", role);
  return next();
}

export async function requireAdmin(c: Context<AppEnv>, next: Next) {
  const role = await roleFromCookie(c);
  if (role !== "admin") return c.json({ error: "forbidden" }, 403);
  return next();
}

async function roleFromCookie(c: Context<AppEnv>): Promise<string | null> {
  const cookie = c.req.header("Cookie") ?? "";
  const m = cookie.match(new RegExp(`${COOKIE}=([^;]+)`));
  if (!m) return null;
  return c.env.SESSIONS.get(`sess:${m[1]}`);
}
