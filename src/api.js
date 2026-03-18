// ─── PlusMinus API Layer ──────────────────────────────────────
// All data fetching lives here. Components import hooks, not raw data.
//
// API: BallDontLie v1 (free tier)
// Docs: https://www.balldontlie.io/home.html
//
// Setup:
//   1. Sign up at balldontlie.io → get your API key
//   2. Create a .env file in your project root:
//        VITE_BDLAPI_KEY=your_key_here
//   3. npm run dev — Vite injects VITE_* vars at build time
//
// Netlify:
//   Site settings → Environment variables → Add VITE_BDLAPI_KEY

import { useQuery } from "@tanstack/react-query";
import {
    EAST_STANDINGS as EAST_FALLBACK,
    WEST_STANDINGS as WEST_FALLBACK,
    TODAY_GAMES as GAMES_FALLBACK,
    PLAYERS as PLAYERS_FALLBACK,
} from "./data";

const API_KEY = import.meta.env.VITE_BDLAPI_KEY;
const BASE = "https://api.balldontlie.io/v1";

// ── Shared fetch wrapper ──────────────────────────────────────
async function bdlFetch(path) {
    if (!API_KEY) throw new Error("VITE_BDLAPI_KEY not set");
    const res = await fetch(`${BASE}${path}`, {
        headers: { Authorization: API_KEY },
    });
    if (!res.ok) throw new Error(`BallDontLie ${res.status}: ${path}`);
    return res.json();
}

// ── Date helpers ──────────────────────────────────────────────
function todayStr() {
    return new Date().toISOString().split("T")[0];
}

function currentSeason() {
    // NBA season year = the year the season started
    // e.g. 2025-26 season → 2025
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    return month >= 10 ? year : year - 1;
}

// ─── STANDINGS ────────────────────────────────────────────────
function reshapeStandings(raw) {
    return raw
        .map(s => ({
            team: s.team.abbreviation,
            w: s.wins,
            l: s.losses,
            pct: s.wins / (s.wins + s.losses),
            last10: `${s.last_ten_wins}-${s.last_ten_losses}`,
            home: `${s.home_record_wins}-${s.home_record_losses}`,
            road: `${s.road_record_wins}-${s.road_record_losses}`,
            streak: `${s.streak_type === "W" ? "W" : "L"}${s.streak_length}`,
        }))
        .sort((a, b) => b.pct - a.pct);
}

export function useStandings() {
    return useQuery({
        queryKey: ["standings", currentSeason()],
        queryFn: async () => {
            const data = await bdlFetch(`/standings?season=${currentSeason()}&per_page=30`);
            const all = data.data;
            return {
                east: reshapeStandings(all.filter(s => s.conference === "East")),
                west: reshapeStandings(all.filter(s => s.conference === "West")),
            };
        },
        staleTime: 1000 * 60 * 10,
        placeholderData: {
            east: EAST_FALLBACK,
            west: WEST_FALLBACK,
        },
    });
}

// ─── TODAY'S GAMES ────────────────────────────────────────────
// BallDontLie /games returns game status, scores, and teams.
// Win probability is not available in the free tier — we keep
// a rough home-court-advantage prior (home 58%, away 42%) as
// a placeholder until you add The Odds API.

function reshapeGames(raw) {
    return raw.map(g => {
        const status = g.status;       // "Final", "2nd Qtr", tipoff time string
        const isFinal = status === "Final";
        // isLive: not final, and not a scheduled tipoff time (which contains ":")
        const isLive = !isFinal && !status.includes(":");

        // Format tip time: BDL returns UTC ISO string for scheduled games
        let time = status;
        if (status.includes("T") && status.includes("Z")) {
            time = new Date(status).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                timeZone: "America/New_York",
            }) + " ET";
        }

        return {
            id: String(g.id),
            away: g.visitor_team.abbreviation,
            home: g.home_team.abbreviation,
            awayP: 42,                // placeholder — replace with Odds API
            homeP: 58,                // placeholder — replace with Odds API
            time,
            status: isFinal ? "final" : isLive ? "live" : "scheduled",
            awayScore: isFinal || isLive ? g.visitor_team_score : null,
            homeScore: isFinal || isLive ? g.home_team_score : null,
            spread: "—",
            total: "—",
        };
    });
}

export function useTodayGames() {
    return useQuery({
        queryKey: ["games", todayStr()],
        queryFn: async () => {
            const data = await bdlFetch(`/games?dates[]=${todayStr()}&per_page=15`);
            return reshapeGames(data.data);
        },
        staleTime: 1000 * 60 * 2,
        refetchInterval: 1000 * 60 * 2,
        placeholderData: GAMES_FALLBACK,
    });
}

// ─── PLAYERS ─────────────────────────────────────────────────
// BallDontLie /season_averages returns per-game stats.
// Advanced stats (PER, BPM, VORP) are NOT in BallDontLie free tier —
// those stay as static data from data.js.
//
// ⚠️  HONEST NOTE ON IDs:
// BallDontLie uses its own sequential player IDs — NOT NBA.com IDs.
// Previous versions of this file used NBA.com IDs (7-digit numbers),
// which silently returned empty arrays and fell back to static data.
// The IDs below are actual BDL IDs, verified via:
//   GET /v1/players?search={first_name}+{last_name}
// If a player's ID changes or a new player is added, verify there.

const PLAYER_IDS = {
    "Shai Gilgeous-Alexander": 666,
    "Victor Wembanyama": 3547361,
    "Nikola Jokic": 279,
    "Jayson Tatum": 563,
    "LeBron James": 247,
    "Luka Doncic": 3547607,
    "Giannis Antetokounmpo": 15,
    "Jalen Brunson": 3134804,
    "Cade Cunningham": 3547303,
    "Anthony Edwards": 3547268,
    "Trae Young": 434,
    "Tyrese Haliburton": 3547174,
    "Scottie Barnes": 3547352,
    "Alperen Sengun": 3547363,
    "Paolo Banchero": 3547362,
};

function reshapePlayers(averages, staticPlayers) {
    return staticPlayers.map(sp => {
        const bdlId = PLAYER_IDS[sp.name];
        const live = bdlId
            ? averages.find(a => a.player.id === bdlId)
            : null;
        if (!live) return sp;
        return {
            ...sp,
            pts: parseFloat(live.pts) || sp.pts,
            ast: parseFloat(live.ast) || sp.ast,
            reb: parseFloat(live.reb) || sp.reb,
            // BDL free tier doesn't have TS% — we use fg_pct as a rough proxy
            // and keep the static value if fg_pct is unavailable
            ts: live.fg_pct ? parseFloat((live.fg_pct * 100).toFixed(1)) : sp.ts,
            // per, bpm, vorp, ortg, drtg stay from static — not in BDL free tier
        };
    });
}

export function usePlayers() {
    const season = currentSeason();
    const ids = Object.values(PLAYER_IDS).join("&player_ids[]=");

    return useQuery({
        queryKey: ["players", season],
        queryFn: async () => {
            const data = await bdlFetch(
                `/season_averages?season=${season}&player_ids[]=${ids}`
            );
            return reshapePlayers(data.data, PLAYERS_FALLBACK);
        },
        staleTime: 1000 * 60 * 60,
        placeholderData: PLAYERS_FALLBACK,
    });
}

// ─── QUERY CLIENT CONFIG ──────────────────────────────────────

export const queryClientConfig = {
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5,
            // Don't retry on 401 (bad API key) — fail fast
            retry: (count, error) => {
                if (error?.message?.includes("401")) return false;
                return count < 2;
            },
        },
    },
};