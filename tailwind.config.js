/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
    theme: {
        extend: {
            fontFamily: {
                sans: ["DM Sans", "sans-serif"],
                mono: ["DM Mono", "monospace"],
                display: ["Bebas Neue", "sans-serif"],
            },
            colors: {
                // FM26-inspired dark charcoal palette
                pitch: {
                    950: "#0a0b0d",   // deepest background
                    900: "#0f1114",   // main background
                    850: "#141720",   // sidebar / nav bg
                    800: "#1a1e2a",   // card background
                    750: "#1f2535",   // card hover
                    700: "#252d3d",   // elevated surface
                    600: "#2e3a50",   // border strong
                    500: "#3d4f6a",   // border default
                    400: "#546480",   // muted text
                    300: "#7d91ab",   // secondary text
                    200: "#adbdd0",   // body text
                    100: "#d4e0ec",   // primary text
                    50: "#eef4fb",   // brightest text
                },
                // Brand accent — electric teal-green (FM26's signature action color)
                accent: {
                    DEFAULT: "#00d4aa",
                    dim: "#00a882",
                    muted: "rgba(0,212,170,0.12)",
                    glow: "rgba(0,212,170,0.25)",
                },
                // Status colors
                win: { DEFAULT: "#22c55e", muted: "rgba(34,197,94,0.12)" },
                loss: { DEFAULT: "#ef4444", muted: "rgba(239,68,68,0.10)" },
                draw: { DEFAULT: "#f59e0b", muted: "rgba(245,158,11,0.12)" },
                // Rating tiers (like FM attribute colors)
                tier: {
                    elite: "#00d4aa",
                    good: "#4ade80",
                    avg: "#facc15",
                    poor: "#f97316",
                    bad: "#ef4444",
                },
            },
            borderRadius: {
                sm: "4px",
                md: "6px",
                lg: "8px",
                xl: "12px",
                "2xl": "16px",
            },
            boxShadow: {
                tile: "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
                card: "0 4px 16px rgba(0,0,0,0.5)",
                accent: "0 0 20px rgba(0,212,170,0.2)",
                glow: "0 0 40px rgba(0,212,170,0.15)",
            },
            animation: {
                "slide-up": "slideUp 0.3s ease-out",
                "fade-in": "fadeIn 0.2s ease-out",
                "stat-fill": "statFill 0.8s ease-out",
                "pulse-glow": "pulseGlow 2s ease-in-out infinite",
            },
            keyframes: {
                slideUp: { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "translateY(0)" } },
                fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
                statFill: { from: { width: "0%" }, to: {} },
                pulseGlow: { "0%,100%": { opacity: 0.6 }, "50%": { opacity: 1 } },
            },
        },
    },
    plugins: [],
};