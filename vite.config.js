import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],

  // Set base to "/plusminus/" when deploying to GitHub Pages.
  // For local dev or Vercel/Netlify root deploys, change to "/".
  base: "/plusminus/",

  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
