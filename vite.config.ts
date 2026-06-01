import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
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
      { test: { name: "scoring", include: ["test/scoring/**/*.test.ts"], environment: "node" } },
      {
        test: {
          name: "worker",
          include: ["test/worker/**/*.test.ts"],
          poolOptions: { workers: { wrangler: { configPath: "./wrangler.jsonc" } } },
        },
      },
    ],
  },
});
