import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Don't cache API routes — service worker should be network-only for /api
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        runtimeCaching: [
          {
            // ESPN API — cache with network-first, 5min TTL
            urlPattern: /^https:\/\/site\.api\.espn\.com/,
            handler: "NetworkFirst",
            options: {
              cacheName: "espn-api",
              expiration: { maxAgeSeconds: 300 },
            },
          },
        ],
      },
      includeAssets: ["favicon.svg", "og-image.png"],
      manifest: {
        name: "PlusMinus — NBA Analytics",
        short_name: "PlusMinus",
        description: "Real-time NBA analytics, odds, and bet tracking",
        theme_color: "#00d4aa",
        background_color: "#0a0b0d",
        display: "standalone",
        orientation: "portrait-primary",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],

  // ── Build & Bundle Splitting ───────────────────────────────────
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom", "lucide-react"],
          charts: ["recharts"],
          animation: ["framer-motion"],
        },
      },
    },
  },

  // ── Vitest config ──────────────────────────────────────────────
  test: {
    environment: "jsdom",   // localStorage, DOM APIs
    globals: true,          // describe/it/expect without imports
    setupFiles: [],
  },

  // ── Dev server ─────────────────────────────────────────────────
  // When running `vercel dev`, the serverless functions in /api are
  // served alongside Vite. For plain `vite`, proxy /api to a local
  // dev server if you want to test without Vercel CLI.
  server: {
    port: 3055,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY || "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
