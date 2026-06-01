import { Hono } from "hono";
import type { Env } from "../types";

export const adminRoutes = new Hono<{
  Bindings: Env;
  Variables: { role: string };
}>();
