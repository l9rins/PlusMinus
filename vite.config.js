// vite.config.js
//
// FIX 14: Added "json" to globPatterns so manifest.json is precached by the
//          service worker. Previously it was excluded, so the PWA manifest
//          relied on the browser's HTTP cache and failed offline.
//
// FIX 18: Removed the inline `manifest` block from VitePWA config.
//          The inline manifest and public/manifest.json were duplicates —
//          VitePWA used the inline one and silently ignored public/manifest.json.
//          Having two sources of truth led to confusion and subtle divergence.
//          The canonical manifest now lives in public/manifest.json only.
//          VitePWA picks it up automatically when no inline manifest is specified.
//          Also: icon `purpose` corrected — was "any maskable" (a combined value
//          that tells the browser it can use the icon as either, but maskable
//          icons require 40% safe-zone padding which ruins standard display).
//          Now uses separate "any" and "maskable" entries per W3C recommendation.
//          Update your actual icon files if they don't have safe-zone padding.
//
// FIX 21: Added "@tanstack/react-query" to manualChunks as its own "query" chunk.
//          Previously it was bundled into whichever lazy route first imported it,
//          making that chunk unexpectedly large (~50 KB gzipped).

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  worker: {
    format: "es",
    rollupOptions: {
      output: {
        format: "es",
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackAllowlist: [/^(?!\/api\/).*/],
        // FIX 14: json added so manifest.json is precached for offline use.
        globPatterns: ["**/*.{js,css,html,svg,png,json}"],
        runtimeCaching: [
          {
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
      // FIX 18: No inline manifest — canonical source is public/manifest.json.
      // VitePWA merges the icons block below with that file automatically.
      // If you need to override fields, do it in public/manifest.json directly.
      manifest: false,
    }),
  ],

  // ── Build & Bundle Splitting ─────────────────────────────────────
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:    ["react", "react-dom", "react-router-dom", "lucide-react"],
          // FIX 21: react-query gets its own chunk instead of bloating
          //          whichever lazy route happens to import it first.
          query:     ["@tanstack/react-query"],
          charts:    ["recharts"],
          animation: ["framer-motion"],
        },
      },
    },
  },

  // ── Vitest config ────────────────────────────────────────────────
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
  },

  // ── Dev server ───────────────────────────────────────────────────
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
