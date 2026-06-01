import { Hono } from "hono";
import type { Env } from "../types";

export const stateRoutes = new Hono<{
  Bindings: Env;
  Variables: { role: string };
}>();
