import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Renoom",
        short_name: "Renoom",
        description: "Centraliser les inspirations, choix, budget et validations client, pièce par pièce.",
        lang: "fr",
        start_url: "/",
        display: "standalone",
        background_color: "#FAF6F0",
        theme_color: "#A8B5A2",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Only cache the built app shell; never intercept API/Supabase calls
        // so business data (budgets, validations) is always fetched fresh.
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:5175",
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        palette: resolve(__dirname, "palette/index.html"),
        appartementPalette: resolve(__dirname, "appartement-palette/index.html"),
      },
    },
  },
});
