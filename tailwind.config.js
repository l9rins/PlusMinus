/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
    theme: {
        extend: {
            fontFamily: {
                sans: ["DM Sans", "system-ui", "sans-serif"],
                mono: ["DM Mono", "ui-monospace", "monospace"],
                display: ["Bebas Neue", "sans-serif"],
            },
            fontSize: {
                "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
            },
            colors: {
                // FM26-inspired deep navy-charcoal palette
                pitch: {
                    950: "#06070a",   // deepest void
                    900: "#0a0b0d",   // main background
                    880: "#0e1018",   // secondary background
                    850: "#111520",   // nav / sidebar
                    800: "#161b28",   // card background
                    780: "#1a1f2e",   // card mid
                    750: "#1f2535",   // card hover
                    700: "#252d3d",   // elevated surface
                    650: "#2a3347",   // elevated hover
                    600: "#2e3a50",   // border strong
                    550: "#364560",   // border accent
                    500: "#3d4f6a",   // border default
                    450: "#475c7a",   // icon default
                    400: "#546480",   // muted text
                    350: "#6a7f9a",   // secondary muted
                    300: "#7d91ab",   // secondary text
                    250: "#99aec5",   // mid text
                    200: "#adbdd0",   // body text
                    150: "#c0d0e0",   // light text
                    100: "#d4e0ec",   // primary text
                    50: "#eef4fb",   // brightest text
                },
                // Brand accent — electric teal-green
                accent: {
                    DEFAULT: "#00d4aa",
                    hover: "#00e8bb",
                    dim: "#00a882",
                    faint: "#007d61",
                    muted: "rgba(0,212,170,0.12)",
                    glow: "rgba(0,212,170,0.25)",
                    "10": "rgba(0,212,170,0.10)",
                    "15": "rgba(0,212,170,0.15)",
                    "20": "rgba(0,212,170,0.20)",
                    "30": "rgba(0,212,170,0.30)",
                },
                // Status colors — expanded with muted variants
                win: {
                    DEFAULT: "#22c55e",
                    bright: "#4ade80",
                    dim: "#16a34a",
                    muted: "rgba(34,197,94,0.12)",
                    "10": "rgba(34,197,94,0.10)",
                    "20": "rgba(34,197,94,0.20)",
                    "30": "rgba(34,197,94,0.30)",
                },
                loss: {
                    DEFAULT: "#ef4444",
                    bright: "#f87171",
                    dim: "#dc2626",
                    muted: "rgba(239,68,68,0.10)",
                    "10": "rgba(239,68,68,0.10)",
                    "20": "rgba(239,68,68,0.20)",
                    "30": "rgba(239,68,68,0.30)",
                },
                draw: {
                    DEFAULT: "#f59e0b",
                    bright: "#fbbf24",
                    dim: "#d97706",
                    muted: "rgba(245,158,11,0.12)",
                    "10": "rgba(245,158,11,0.10)",
                    "20": "rgba(245,158,11,0.20)",
                    "30": "rgba(245,158,11,0.30)",
                },
                // Performance tier colors (FM attribute style)
                tier: {
                    elite: "#00d4aa",
                    good: "#4ade80",
                    avg: "#facc15",
                    poor: "#f97316",
                    bad: "#ef4444",
                },
                // Chart/team palette extras
                chart: {
                    1: "#00d4aa",
                    2: "#818cf8",
                    3: "#f59e0b",
                    4: "#f87171",
                    5: "#34d399",
                    6: "#a78bfa",
                },
            },
            spacing: {
                "0.5": "2px",
                "1.5": "6px",
                "2.5": "10px",
                "3.5": "14px",
                "13": "52px",
                "15": "60px",
                "18": "72px",
                "22": "88px",
                "26": "104px",
                "30": "120px",
            },
            borderRadius: {
                "sm": "4px",
                "md": "6px",
                "lg": "8px",
                "xl": "12px",
                "2xl": "16px",
                "3xl": "20px",
            },
            boxShadow: {
                "tile": "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
                "tile-lg": "0 4px 12px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3)",
                "card": "0 4px 16px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.3)",
                "card-lg": "0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)",
                "accent": "0 0 20px rgba(0,212,170,0.2)",
                "accent-lg": "0 0 40px rgba(0,212,170,0.15)",
                "win": "0 0 16px rgba(34,197,94,0.2)",
                "loss": "0 0 16px rgba(239,68,68,0.2)",
                "inset": "inset 0 1px 3px rgba(0,0,0,0.4)",
                "inner": "inset 0 2px 4px rgba(0,0,0,0.3)",
            },
            animation: {
                "slide-up": "slideUp 0.28s cubic-bezier(0.25,0.46,0.45,0.94)",
                "slide-down": "slideDown 0.28s cubic-bezier(0.25,0.46,0.45,0.94)",
                "fade-in": "fadeIn 0.2s ease-out",
                "fade-out": "fadeOut 0.15s ease-in",
                "stat-fill": "statFill 0.8s cubic-bezier(0.25,0.46,0.45,0.94)",
                "shimmer": "shimmer 1.6s ease-in-out infinite",
                "pulse-glow": "pulseGlow 2.4s ease-in-out infinite",
                "live-pulse": "livePulse 1.8s ease-in-out infinite",
                "score-pop": "scorePop 0.35s cubic-bezier(0.34,1.56,0.64,1)",
                "float-up": "floatUp 0.3s ease-out",
                "border-glow": "borderGlow 2.5s ease-in-out infinite",
                "spin-slow": "spin 2s linear infinite",
                "bounce-sm": "bounceSm 1s ease infinite",
            },
            keyframes: {
                slideUp: { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "translateY(0)" } },
                slideDown: { from: { opacity: 0, transform: "translateY(-8px)" }, to: { opacity: 1, transform: "translateY(0)" } },
                fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
                fadeOut: { from: { opacity: 1 }, to: { opacity: 0 } },
                statFill: { from: { width: "0%" } },
                shimmer: { "0%": { backgroundPosition: "200% 0" }, "100%": { backgroundPosition: "-200% 0" } },
                pulseGlow: { "0%,100%": { opacity: "0.5", transform: "scale(1)" }, "50%": { opacity: "1", transform: "scale(1.15)" } },
                livePulse: { "0%,100%": { opacity: "0.6" }, "50%": { opacity: "1" } },
                scorePop: { "0%": { transform: "scale(1)" }, "40%": { transform: "scale(1.1)" }, "100%": { transform: "scale(1)" } },
                floatUp: { from: { opacity: 0, transform: "translateY(6px)" }, to: { opacity: 1, transform: "translateY(0)" } },
                borderGlow: {
                    "0%,100%": { borderColor: "rgba(0,212,170,0.3)", boxShadow: "0 0 10px rgba(0,212,170,0.1)" },
                    "50%": { borderColor: "rgba(0,212,170,0.6)", boxShadow: "0 0 20px rgba(0,212,170,0.2)" },
                },
                bounceSm: {
                    "0%,100%": { transform: "translateY(0)" },
                    "50%": { transform: "translateY(-2px)" },
                },
            },
            transitionTimingFunction: {
                "spring": "cubic-bezier(0.34, 1.56, 0.64, 1)",
                "ease-out-expo": "cubic-bezier(0.19, 1, 0.22, 1)",
            },
            transitionDuration: {
                "50": "50ms",
                "250": "250ms",
                "350": "350ms",
                "400": "400ms",
            },
            backdropBlur: {
                xs: "2px",
            },
            zIndex: {
                "60": "60",
                "70": "70",
                "80": "80",
                "90": "90",
                "100": "100",
            },
            maxWidth: {
                "content": "1400px",
            },
            gridTemplateColumns: {
                "13": "repeat(13, minmax(0, 1fr))",
                "sidebar": "240px 1fr",
                "dashboard": "1fr 340px",
            },
            screens: {
                "xs": "480px",
                "3xl": "1800px",
            },
        },
    },
    plugins: [],
};