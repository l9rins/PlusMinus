import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
    plugins: [react()],

    // "/" for Netlify, Vercel, or any root domain deploy.
    // Change to "/plusminus/" only if deploying to GitHub Pages subdirectory.
    base: "/",

    resolve: {
        alias: { "@": path.resolve(__dirname, "./src") },
    },
});