import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        // ── Navigation fallback ──────────────────────────────────
        navigateFallback: "/index.html",
        navigateFallbackAllowlist: [/^(?!\/api\/).*/],

        // ── Precache all build assets ────────────────────────────
        // Includes JS, CSS, HTML, fonts, icons — everything in dist/
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2}"],

        // ── Skip waiting + claim clients immediately on update ───
        skipWaiting: true,
        clientsClaim: true,

        // ── Runtime caching rules ────────────────────────────────
        runtimeCaching: [
          // ESPN scoreboard + standings — NetworkFirst, 5min TTL
          // Falls back to cache when offline so last-known data shows
          {
            urlPattern: /^https:\/\/site\.api\.espn\.com/,
            handler: "NetworkFirst",
            options: {
              cacheName: "espn-api",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 300,   // 5 min — matches useTodayGames staleTime
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // NBA Stats API — NetworkFirst, 10min TTL
          // Player/team stats change at most a few times per day
          {
            urlPattern: /^https:\/\/stats\.nba\.com/,
            handler: "NetworkFirst",
            options: {
              cacheName: "nba-stats-api",
              networkTimeoutSeconds: 8,
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 600,   // 10 min — matches useLeaguePlayerStats staleTime
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // Elo endpoint — CacheFirst, 1hr TTL
          // Server already caches for 1hr; SW mirrors that
          {
            urlPattern: /\/api\/elo/,
            handler: "CacheFirst",
            options: {
              cacheName: "pm-elo",
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 3600,  // 1hr — matches useEloData staleTime
              },
              cacheableResponse: { statuses: [200] },
            },
          },

          // Standings via /api/espn — NetworkFirst, 10min TTL
          {
            urlPattern: /\/api\/espn/,
            handler: "NetworkFirst",
            options: {
              cacheName: "pm-espn-proxy",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 600,
              },
              cacheableResponse: { statuses: [200] },
            },
          },

          // Odds + Props — NetworkFirst, SHORT 15min TTL
          // Props lines move; don't serve stale odds for too long
          {
            urlPattern: /\/api\/(odds|props)/,
            handler: "NetworkFirst",
            options: {
              cacheName: "pm-odds",
              networkTimeoutSeconds: 6,
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 900,   // 15 min — matches server s-maxage
              },
              cacheableResponse: { statuses: [200] },
            },
          },

          // Config endpoint — CacheFirst, 5min TTL
          {
            urlPattern: /\/api\/config/,
            handler: "NetworkFirst",
            options: {
              cacheName: "pm-config",
              networkTimeoutSeconds: 4,
              expiration: {
                maxEntries: 2,
                maxAgeSeconds: 300,
              },
              cacheableResponse: { statuses: [200] },
            },
          },

          // Google Fonts — CacheFirst, 1yr TTL (standard pattern)
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: { maxAgeSeconds: 31536000 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com/,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 31536000 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // Auth endpoints — NEVER cache (Clerk JWT flows must be live)
          // No rule needed — anything not matched above uses default
          // Workbox behaviour which is network-only for unmatched requests.
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

  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
  },

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