import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll } from "vitest";

// Apply schema + seed migrations into the test D1 before any worker test runs.
// `TEST_MIGRATIONS` is injected as a miniflare binding in `vitest.config.ts`,
// where `readD1Migrations("migrations")` parses 0001_init.sql + 0002_seed.sql.
// `applyD1Migrations` is idempotent (records applied migrations in the
// `d1_migrations` table), so running it per test file is safe.
beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});
