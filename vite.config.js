import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

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
    port: 3000,
  },
});
