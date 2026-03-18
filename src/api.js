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
    TEAM_NAMES,
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
    return new Date().toISOString().split("T")[0]; // "2026-03-19"
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
// BallDontLie returns standings per season.
// We reshape to match the shape our components expect:
// { team, w, l, pct, last10, home, road, streak }

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
        staleTime: 1000 * 60 * 10,  // re-fetch after 10 minutes
        placeholderData: {
            east: EAST_FALLBACK,
            west: WEST_FALLBACK,
        },
    });
}

// ─── TODAY'S GAMES ────────────────────────────────────────────
// BallDontLie /games returns game status, scores, and teams.
// We reshape to what our GameTile expects.
// Win probability is not available in the free tier — we keep
// a rough home-court-advantage prior (home 58%, away 42%) as
// a placeholder until you add The Odds API.

function reshapeGames(raw) {
    return raw.map(g => {
        const status = g.status;       // "Final", "2nd Qtr", tipoff time string
        const isFinal = status === "Final";
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
            spread: "—",              // placeholder — replace with Odds API
            total: "—",              // placeholder — replace with Odds API
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
        staleTime: 1000 * 60 * 2,   // re-fetch every 2 minutes (games are live)
        refetchInterval: 1000 * 60 * 2,
        placeholderData: GAMES_FALLBACK,
    });
}

// ─── PLAYERS ─────────────────────────────────────────────────
// BallDontLie /season_averages returns per-game stats.
// We fetch the top players by points from a known list of star IDs.
// Advanced stats (PER, BPM, VORP) are NOT available in BallDontLie —
// those stay as static data from data.js until you add a paid source.

// BallDontLie player IDs for our current roster
// Find more at: https://api.balldontlie.io/v1/players?search=name
const PLAYER_IDS = {
    "Shai Gilgeous-Alexander": 3547974,
    "Victor Wembanyama": 1631093,
    "Nikola Jokic": 3547195,
    "Jayson Tatum": 3549397,
    "LeBron James": 3202960,
    "Luka Doncic": 3547607,
    "Giannis Antetokounmpo": 3547399,
    "Jalen Brunson": 3134804,
    "Cade Cunningham": 1630595,
    "Anthony Edwards": 1630162,
    "Trae Young": 3548657,
    "Tyrese Haliburton": 1630169,
    "Scottie Barnes": 1630567,
    "Alperen Sengun": 1630578,
    "Paolo Banchero": 1631094,
};

function reshapePlayers(averages, staticPlayers) {
    // Merge live per-game stats with static advanced metrics
    return staticPlayers.map(sp => {
        const live = averages.find(a => {
            const fullName = `${a.player.first_name} ${a.player.last_name}`;
            return fullName === sp.name || sp.name.startsWith(a.player.first_name);
        });
        if (!live) return sp; // fall back to static if not found
        return {
            ...sp,
            pts: parseFloat(live.pts) || sp.pts,
            ast: parseFloat(live.ast) || sp.ast,
            reb: parseFloat(live.reb) || sp.reb,
            ts: live.fg_pct ? parseFloat((live.fg_pct * 100).toFixed(1)) : sp.ts,
            // per, bpm, vorp, ortg, drtg stay from static data
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
        staleTime: 1000 * 60 * 60,  // re-fetch once per hour (stats don't change mid-game)
        placeholderData: PLAYERS_FALLBACK,
    });
}

// ─── QUERY CLIENT CONFIG ──────────────────────────────────────
// Import this in main.jsx
export { QueryClient } from "@tanstack/react-query";

export const queryClientConfig = {
    defaultOptions: {
        queries: {
            // Show stale data immediately, refetch in background
            staleTime: 1000 * 60 * 5,
            // Don't retry on 401 (bad API key) — fail fast
            retry: (count, error) => {
                if (error?.message?.includes("401")) return false;
                return count < 2;
            },
        },
    },
};