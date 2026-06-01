import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";

// Build/dev config for the app + Cloudflare Worker.
// Test config lives in `vitest.config.ts` (the `cloudflare()` plugin below is
// incompatible with the vitest Vite server, so tests use a separate config).
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
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "api",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 50 },
            },
          },
        ],
      },
    }),
  ],
});
