/// <reference types="@cloudflare/vitest-pool-workers" />
import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import path from "node:path";

// NOTE: Tests use their own config (this file), separate from `vite.config.ts`.
// The `cloudflare()` Vite plugin used for the app build is intentionally NOT
// included here — it injects a worker `resolve.external` list that is
// incompatible with the way vitest spins up its Vite server, and the
// vitest-pool-workers runtime provides the Cloudflare bindings itself.

// Read the D1 migrations (migrations/0001_init.sql + 0002_seed.sql) at config
// time, in Node. They are injected into the worker test runtime as a
// `TEST_MIGRATIONS` binding and applied to the test D1 by the
// `test/worker/apply-migrations.ts` setup file before any test runs. This is
// how the test D1 ends up with the full schema + seed (8 players, rounds r1–r7,
// etc.) that the integration tests assert on.
const migrations = await readD1Migrations(
  path.join(import.meta.dirname, "migrations"),
);

export default defineConfig({
  test: {
    projects: [
      {
        // Pure scoring/logic unit tests run in plain Node.
        test: {
          name: "scoring",
          include: ["test/scoring/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        // Worker integration tests run inside the workerd runtime via the
        // Cloudflare vitest pool. In vitest-pool-workers v0.16 (Vitest 4) the
        // pool is wired up via the `cloudflareTest()` plugin, which reads
        // bindings (D1, KV, vars) from wrangler.jsonc. We additionally inject
        // the parsed migrations as a `TEST_MIGRATIONS` binding so the setup
        // file can apply them to the test D1.
        plugins: [
          cloudflareTest({
            miniflare: {
              bindings: { TEST_MIGRATIONS: migrations },
            },
            wrangler: { configPath: "./wrangler.jsonc" },
          }),
        ],
        test: {
          name: "worker",
          include: ["test/worker/**/*.test.ts"],
          setupFiles: ["./test/worker/apply-migrations.ts"],
        },
      },
    ],
  },
});
