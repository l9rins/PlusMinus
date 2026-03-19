// ─── PlusMinus API Layer ──────────────────────────────────────
// All data fetching lives here. Components import hooks, not raw data.
//
// APIs:
//   1. BallDontLie v1 (free tier) — scores, standings, player stats
//      Docs: https://www.balldontlie.io/home.html
//   2. The Odds API v4 (free tier, 500 req/month) — moneyline odds
//      Docs: https://the-odds-api.com/liveapi/guides/v4/
//
// Setup:
//   1. Create a .env file in your project root:
//        VITE_BDLAPI_KEY=your_balldontlie_key
//        VITE_ODDS_API_KEY=your_odds_api_key
//   2. npm run dev — Vite injects VITE_* vars at build time
//
// Netlify:
//   Site settings → Environment variables → Add both keys

import { useQuery } from "@tanstack/react-query";
import {
    EAST_STANDINGS as EAST_FALLBACK,
    WEST_STANDINGS as WEST_FALLBACK,
    TODAY_GAMES as GAMES_FALLBACK,
    PLAYERS as PLAYERS_FALLBACK,
} from "./data";
import { oddsToImplied } from "./utils";

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
// Win probabilities come from The Odds API (separate hook, separate cadence).
// Default 42/58 home-court prior until odds are merged via mergeOddsIntoGames().

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
            awayP: 42,                // default — overridden by mergeOddsIntoGames
            homeP: 58,                // default — overridden by mergeOddsIntoGames
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

// ─── ODDS API ─────────────────────────────────────────────────
// The Odds API (free tier: 500 requests/month)
// Returns moneyline odds for scheduled NBA games.
//
// ⚠️  RATE LIMIT DESIGN:
//   Lines move slowly pre-game and don't exist mid-game or post-game.
//   15-minute refresh is plenty — do NOT match the 2-minute game cadence.
//   At 15-min intervals: ~96 requests/day during heavy usage.
//   Comfortable margin within the 500/month free budget.
//
// Setup: Add VITE_ODDS_API_KEY=your_key to .env
// Get a free key at https://the-odds-api.com

const ODDS_API_KEY = import.meta.env.VITE_ODDS_API_KEY;
export const HAS_ODDS_KEY = !!ODDS_API_KEY;

// The Odds API returns full team names. Map to 3-letter abbreviations.
const ODDS_TEAM_MAP = {
    "Atlanta Hawks": "ATL",       "Boston Celtics": "BOS",
    "Brooklyn Nets": "BKN",       "Charlotte Hornets": "CHA",
    "Chicago Bulls": "CHI",       "Cleveland Cavaliers": "CLE",
    "Dallas Mavericks": "DAL",    "Denver Nuggets": "DEN",
    "Detroit Pistons": "DET",     "Golden State Warriors": "GSW",
    "Houston Rockets": "HOU",     "Indiana Pacers": "IND",
    "Los Angeles Clippers": "LAC", "Los Angeles Lakers": "LAL",
    "Memphis Grizzlies": "MEM",   "Miami Heat": "MIA",
    "Milwaukee Bucks": "MIL",     "Minnesota Timberwolves": "MIN",
    "New Orleans Pelicans": "NOP", "New York Knicks": "NYK",
    "Oklahoma City Thunder": "OKC", "Orlando Magic": "ORL",
    "Philadelphia 76ers": "PHI",  "Phoenix Suns": "PHX",
    "Portland Trail Blazers": "POR", "Sacramento Kings": "SAC",
    "San Antonio Spurs": "SAS",   "Toronto Raptors": "TOR",
    "Utah Jazz": "UTA",           "Washington Wizards": "WAS",
};

export function useOdds() {
    return useQuery({
        queryKey: ["odds", todayStr()],
        queryFn: async () => {
            if (!ODDS_API_KEY) throw new Error("VITE_ODDS_API_KEY not set");
            const url = `https://api.the-odds-api.com/v4/sports/basketball_nba/odds`
                + `?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h&oddsFormat=american`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Odds API ${res.status}`);
            const events = await res.json();

            // Build a lookup: { "ATL@DAL": { awayP, homeP } }
            // Uses first bookmaker's h2h odds for each event.
            const lookup = {};
            for (const ev of events) {
                const home = ODDS_TEAM_MAP[ev.home_team];
                const away = ODDS_TEAM_MAP[ev.away_team];
                if (!home || !away) continue;

                const market = ev.bookmakers?.[0]?.markets?.find(m => m.key === "h2h");
                if (!market) continue;

                const homeOutcome = market.outcomes.find(o => ODDS_TEAM_MAP[o.name] === home);
                const awayOutcome = market.outcomes.find(o => ODDS_TEAM_MAP[o.name] === away);
                if (!homeOutcome || !awayOutcome) continue;

                // Convert American odds → implied probability, then normalize to remove vig
                const rawHomeP = oddsToImplied(homeOutcome.price);
                const rawAwayP = oddsToImplied(awayOutcome.price);
                const total = rawHomeP + rawAwayP;

                lookup[`${away}@${home}`] = {
                    homeP: +(rawHomeP / total * 100).toFixed(1),
                    awayP: +(rawAwayP / total * 100).toFixed(1),
                };
            }
            return lookup;
        },
        staleTime: 1000 * 60 * 15,
        refetchInterval: 1000 * 60 * 15,
        enabled: !!ODDS_API_KEY,
    });
}

/**
 * Merge odds data into game tiles.
 * Odds only exist for scheduled games — live/final games keep defaults.
 *
 * @param {Array} games  - From useTodayGames().data
 * @param {Object} odds  - From useOdds().data (lookup map, may be undefined)
 * @returns {Array} Games with real awayP/homeP where available
 */
export function mergeOddsIntoGames(games, odds) {
    if (!games) return games;
    if (!odds) return games;
    return games.map(g => {
        if (g.status !== "scheduled") return g;
        const key = `${g.away}@${g.home}`;
        const match = odds[key];
        if (!match) return g;
        return { ...g, awayP: match.awayP, homeP: match.homeP };
    });
}

// ─── PLAYERS (static roster) ──────────────────────────────────
// Fetches season averages for the hardcoded 30-player roster.
// Used as the default Players tab view and as fallback when search
// returns no results or the API key is missing.
//
// ⚠️  HONEST NOTE ON IDs:
// BallDontLie uses its own sequential player IDs — NOT NBA.com IDs.
// The IDs below are actual BDL IDs, verified via:
//   GET /v1/players?search={first_name}+{last_name}

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
            // BDL free tier doesn't have TS% — use fg_pct as rough proxy
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

// ─── PLAYER SEARCH ────────────────────────────────────────────
// Dynamic search against the full BallDontLie player database (~450+ active players).
//
// Flow:
//   1. Search /players?search={query} → get matching players + their BDL IDs
//   2. Fetch /season_averages for those IDs → get live pts/ast/reb
//   3. Return merged shape — advanced metrics (per/bpm/vorp/ortg/drtg) are
//      NOT available in BDL free tier, so those fields are null for search results.
//      PlayerCard conditionally renders the advanced section only when data exists.
//
// Design decisions:
//   - Minimum 2 characters before firing to avoid noise
//   - Disabled when query is empty (falls back to static roster in Players.jsx)
//   - staleTime 5 minutes — search results don't change mid-session
//   - No refetchInterval — search is on-demand, not polling

export function usePlayerSearch(query) {
    const season = currentSeason();
    const trimmed = query.trim();
    const enabled = !!API_KEY && trimmed.length >= 2;

    return useQuery({
        queryKey: ["playerSearch", trimmed, season],
        queryFn: async () => {
            // Step 1: search for players by name
            const searchData = await bdlFetch(
                `/players?search=${encodeURIComponent(trimmed)}&per_page=25`
            );
            const players = searchData.data;
            if (!players || players.length === 0) return [];

            // Step 2: fetch season averages for found player IDs
            const ids = players.map(p => p.id).join("&player_ids[]=");
            const avgData = await bdlFetch(
                `/season_averages?season=${season}&player_ids[]=${ids}`
            );
            const averages = avgData.data || [];

            // Step 3: merge — player info + live averages
            return players.map(p => {
                const avg = averages.find(a => a.player.id === p.id);
                const fullName = `${p.first_name} ${p.last_name}`;
                const team = p.team?.abbreviation || "—";
                const pos = p.position || "—";

                // Base shape — always available from /players
                const base = {
                    id: p.id,
                    name: fullName,
                    pos,
                    team,
                    age: p.height_feet ? null : null, // BDL free tier doesn't return age
                    // Advanced metrics not available in free tier for arbitrary players
                    // — null signals PlayerCard to hide the advanced section
                    per: null,
                    bpm: null,
                    vorp: null,
                    ortg: null,
                    drtg: null,
                    form: null,
                    // Defaults shown when no averages found
                    pts: 0,
                    ast: 0,
                    reb: 0,
                    ts: null,
                };

                if (!avg) return base;

                return {
                    ...base,
                    pts: parseFloat(avg.pts) || 0,
                    ast: parseFloat(avg.ast) || 0,
                    reb: parseFloat(avg.reb) || 0,
                    ts: avg.fg_pct ? parseFloat((avg.fg_pct * 100).toFixed(1)) : null,
                };
            }).filter(p => p.pts > 0 || p.ast > 0 || p.reb > 0); // filter out DNP/inactive
        },
        staleTime: 1000 * 60 * 5,
        enabled,
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