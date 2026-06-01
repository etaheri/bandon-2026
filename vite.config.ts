import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    cloudflare(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Bandon Cup '26",
        short_name: "Bandon Cup",
        theme_color: "#0b3d2e",
        background_color: "#0b3d2e",
        display: "standalone",
        icons: [],
      },
    }),
  ],
  test: {
    projects: [
      {
        // Pure scoring/logic unit tests run in Node with no Cloudflare plugins.
        test: {
          name: "scoring",
          include: ["test/scoring/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        // Worker integration tests run inside the workerd runtime via the
        // Cloudflare vitest pool. In vitest-pool-workers v0.16 (Vitest 4), the
        // pool is wired up via the `cloudflareTest()` plugin rather than the old
        // `test.poolOptions.workers` shape.
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
