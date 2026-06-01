import { Hono } from "hono";
import type { Env } from "./types";
import { authRoutes } from "./routes/auth";
import { stateRoutes } from "./routes/state";
import { roundRoutes } from "./routes/round";
import { leaderboardRoutes } from "./routes/leaderboard";
import { adminRoutes } from "./routes/admin";
import { exportRoutes } from "./routes/export";
import { bookRoutes } from "./routes/book";

const app = new Hono<{ Bindings: Env }>();

app.route("/api", authRoutes);
app.route("/api", stateRoutes);
app.route("/api", roundRoutes);
app.route("/api", leaderboardRoutes);
app.route("/api", adminRoutes);
app.route("/api", exportRoutes);
app.route("/api", bookRoutes);

app.all("/api/*", (c) => c.json({ error: "not found" }, 404));

export default app;
