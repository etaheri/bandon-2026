/// <reference types="@cloudflare/vitest-pool-workers" />
import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";

// NOTE: Tests use their own config (this file), separate from `vite.config.ts`.
// The `cloudflare()` Vite plugin used for the app build is intentionally NOT
// included here — it injects a worker `resolve.external` list that is
// incompatible with the way vitest spins up its Vite server, and the
// vitest-pool-workers runtime provides the Cloudflare bindings itself.
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
        // bindings (D1, KV, vars) from wrangler.jsonc.
        plugins: [
          cloudflareTest({
            wrangler: { configPath: "./wrangler.jsonc" },
          }),
        ],
        test: {
          name: "worker",
          include: ["test/worker/**/*.test.ts"],
        },
      },
    ],
  },
});
