import { Hono } from "hono";
import type { Env } from "../types";

export const authRoutes = new Hono<{
  Bindings: Env;
  Variables: { role: string };
}>();
