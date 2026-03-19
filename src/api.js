// ─── PlusMinus API Layer ──────────────────────────────────────
// All data fetching lives here. Components import hooks, not raw fetches.
//
// APIs:
//   1. BallDontLie v1 (free tier) — scores, standings, player stats
//      Docs: https://www.balldontlie.io/home.html
//   2. The Odds API v4 (free tier, 500 req/month) — moneyline odds
//      Docs: https://the-odds-api.com/liveapi/guides/v4/
//
// Setup (.env):
//   VITE_BDLAPI_KEY=your_balldontlie_key
//   VITE_ODDS_API_KEY=your_odds_api_key

import { useQuery } from "@tanstack/react-query";
import {
    EAST_STANDINGS as EAST_FALLBACK,
    WEST_STANDINGS as WEST_FALLBACK,
    TODAY_GAMES as GAMES_FALLBACK,
    PLAYERS as PLAYERS_FALLBACK,
} from "./data";
import { oddsToImplied, todayStr } from "./utils";

// ── Config ────────────────────────────────────────────────────
const API_KEY = import.meta.env.VITE_BDLAPI_KEY;
const BASE = "https://api.balldontlie.io/nba/v1";
const ODDS_API_KEY = import.meta.env.VITE_ODDS_API_KEY;
export const HAS_ODDS_KEY = !!ODDS_API_KEY;

// ── Typed API errors ──────────────────────────────────────────
class ApiError extends Error {
    constructor(message, status, retryAfter = null) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.retryAfter = retryAfter; // seconds; populated on 429
    }
}

// ── Shared fetch wrapper with AbortController + 429 handling ──
async function bdlFetch(path, signal) {
    if (!API_KEY) throw new ApiError("VITE_BDLAPI_KEY not set", 401);

    const res = await fetch(`${BASE}${path}`, {
        headers: { Authorization: API_KEY },
        signal, // AbortController signal — cancelled on query key change
    });

    if (!res.ok) {
        if (res.status === 429) {
            // Parse Retry-After header if present (BDL sometimes sends it)
            const retryAfter = parseInt(res.headers.get("Retry-After") || "60", 10);
            throw new ApiError(`Rate limited. Retry in ${retryAfter}s`, 429, retryAfter);
        }
        if (res.status === 401) throw new ApiError("Invalid API key", 401);
        throw new ApiError(`BDL ${res.status}: ${path}`, res.status);
    }

    return res.json();
}

// ── Season logic ──────────────────────────────────────────────
// NBA season year = the year the season STARTED.
// Edge cases:
//   - Oct 1–Oct 14: pre-season, regular season hasn't begun → use prior year
//   - Oct 15+: new season in progress → current year
//   - Jan 1–Sep 30: mid-season of the year that started last fall → year - 1
function currentSeason() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    const day = now.getDate();

    // Full-season months (Nov–Sep of following year)
    if (month >= 10 && day >= 15) return year;  // Regular season started (mid-Oct+)
    if (month >= 10 && day < 15) return year - 1; // Pre-season / first two weeks
    return year - 1;  // Jan–Sep: mid-season of season that started last fall
}

// ── Standings ─────────────────────────────────────────────────
function reshapeStandings(raw) {
    const sorted = [...raw].sort((a, b) => b.wins / (b.wins + b.losses) - a.wins / (a.wins + a.losses));
    const leader = sorted[0];
    const leaderPct = leader ? leader.wins / (leader.wins + leader.losses) : 1;

    return sorted.map(s => {
        const gamesTotal = s.wins + s.losses;
        const pct = gamesTotal > 0 ? s.wins / gamesTotal : 0;

        // Games behind calculation: (leaderW - leaderL - (teamW - teamL)) / 2
        const gb = leader
            ? +((leader.wins - leader.losses - (s.wins - s.losses)) / 2).toFixed(1)
            : 0;

        return {
            team: s.team.abbreviation,
            w: s.wins,
            l: s.losses,
            pct: +pct.toFixed(3),
            gb: gb,
            last10: `${s.last_ten_wins}-${s.last_ten_losses}`,
            home: `${s.home_record_wins}-${s.home_record_losses}`,
            road: `${s.road_record_wins}-${s.road_record_losses}`,
            streak: `${s.streak_type === "W" ? "W" : "L"}${s.streak_length}`,
        };
    });
}

export function useStandings() {
    const season = currentSeason();
    return useQuery({
        queryKey: ["standings", season],
        queryFn: async ({ signal }) => {
            const data = await bdlFetch(`/standings?season=${season}&per_page=30`, signal);
            const all = data.data;
            return {
                east: reshapeStandings(all.filter(s => s.conference === "East")),
                west: reshapeStandings(all.filter(s => s.conference === "West")),
            };
        },
        staleTime: 1000 * 60 * 10, // 10 min
        placeholderData: { east: EAST_FALLBACK, west: WEST_FALLBACK },
        retry: (count, err) => err?.status === 401 ? false : count < 2,
    });
}

// ── Today's games ─────────────────────────────────────────────
function reshapeGames(raw) {
    return raw.map(g => {
        const status = g.status;
        const isFinal = status === "Final";
        const isLive = !isFinal && !status.match(/^\d{1,2}:\d{2}/); // scheduled = "7:00 PM" style

        // BDL returns UTC ISO string for scheduled games; format to ET
        let time = status;
        if (status && status.includes("T") && status.includes("Z")) {
            try {
                time = new Date(status).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    timeZoneName: "short",
                    timeZone: "America/New_York",
                });
            } catch {
                time = status;
            }
        }

        return {
            id: String(g.id),
            away: g.visitor_team.abbreviation,
            home: g.home_team.abbreviation,
            awayP: 42, // overridden by mergeOddsIntoGames
            homeP: 58,
            time,
            status: isFinal ? "final" : isLive ? "live" : "scheduled",
            awayScore: (isFinal || isLive) ? g.visitor_team_score : null,
            homeScore: (isFinal || isLive) ? g.home_team_score : null,
            period: isLive ? (g.period > 0 ? g.period : null) : null,
            spread: "—",
            total: "—",
        };
    });
}

export function useTodayGames() {
    const today = todayStr();
    return useQuery({
        queryKey: ["games", today],
        queryFn: async ({ signal }) => {
            const data = await bdlFetch(`/games?dates[]=${today}&per_page=15`, signal);
            return reshapeGames(data.data);
        },
        staleTime: 1000 * 60 * 2,  // 2 min
        refetchInterval: 1000 * 60 * 2, // poll while tab open
        placeholderData: GAMES_FALLBACK,
        retry: (count, err) => err?.status === 429 || err?.status === 401 ? false : count < 2,
    });
}

// ── Odds API ──────────────────────────────────────────────────
// Free tier: 500 requests/month → 15-min refresh keeps well within budget.
// Lines only exist for scheduled games — live/final games keep 42/58 defaults.

const ODDS_TEAM_MAP = {
    "Atlanta Hawks": "ATL", "Boston Celtics": "BOS",
    "Brooklyn Nets": "BKN", "Charlotte Hornets": "CHA",
    "Chicago Bulls": "CHI", "Cleveland Cavaliers": "CLE",
    "Dallas Mavericks": "DAL", "Denver Nuggets": "DEN",
    "Detroit Pistons": "DET", "Golden State Warriors": "GSW",
    "Houston Rockets": "HOU", "Indiana Pacers": "IND",
    "Los Angeles Clippers": "LAC", "Los Angeles Lakers": "LAL",
    "Memphis Grizzlies": "MEM", "Miami Heat": "MIA",
    "Milwaukee Bucks": "MIL", "Minnesota Timberwolves": "MIN",
    "New Orleans Pelicans": "NOP", "New York Knicks": "NYK",
    "Oklahoma City Thunder": "OKC", "Orlando Magic": "ORL",
    "Philadelphia 76ers": "PHI", "Phoenix Suns": "PHX",
    "Portland Trail Blazers": "POR", "Sacramento Kings": "SAC",
    "San Antonio Spurs": "SAS", "Toronto Raptors": "TOR",
    "Utah Jazz": "UTA", "Washington Wizards": "WAS",
};

export function useOdds() {
    return useQuery({
        queryKey: ["odds", todayStr()],
        queryFn: async ({ signal }) => {
            if (!ODDS_API_KEY) throw new ApiError("VITE_ODDS_API_KEY not set", 401);

            const url = `https://api.the-odds-api.com/v4/sports/basketball_nba/odds`
                + `?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h&oddsFormat=american`;

            const res = await fetch(url, { signal });
            if (!res.ok) {
                const retryAfter = parseInt(res.headers.get("Retry-After") || "60", 10);
                throw new ApiError(`Odds API ${res.status}`, res.status, res.status === 429 ? retryAfter : null);
            }

            const events = await res.json();
            const lookup = {};

            for (const ev of events) {
                const home = ODDS_TEAM_MAP[ev.home_team];
                const away = ODDS_TEAM_MAP[ev.away_team];
                if (!home || !away) continue;

                const market = ev.bookmakers?.[0]?.markets?.find(m => m.key === "h2h");
                if (!market) continue;

                const homeOdds = market.outcomes.find(o => ODDS_TEAM_MAP[o.name] === home);
                const awayOdds = market.outcomes.find(o => ODDS_TEAM_MAP[o.name] === away);
                if (!homeOdds || !awayOdds) continue;

                const rawH = oddsToImplied(homeOdds.price);
                const rawA = oddsToImplied(awayOdds.price);
                const tot = rawH + rawA;

                lookup[`${away}@${home}`] = {
                    homeP: +(rawH / tot * 100).toFixed(1),
                    awayP: +(rawA / tot * 100).toFixed(1),
                    homeOdds: homeOdds.price,
                    awayOdds: awayOdds.price,
                };
            }
            return lookup;
        },
        staleTime: 1000 * 60 * 15,
        refetchInterval: 1000 * 60 * 15,
        enabled: !!ODDS_API_KEY,
        retry: (count, err) => err?.status === 429 || err?.status === 401 ? false : count < 2,
    });
}

/**
 * Merge odds into game tiles.
 * Only scheduled games get odds; live/final keep the 42/58 defaults.
 */
export function mergeOddsIntoGames(games, odds) {
    if (!games || !odds) return games ?? [];
    return games.map(g => {
        if (g.status !== "scheduled") return g;
        const match = odds[`${g.away}@${g.home}`];
        if (!match) return g;
        return { ...g, awayP: match.awayP, homeP: match.homeP, awayOdds: match.awayOdds, homeOdds: match.homeOdds };
    });
}

// ── Players (static roster) ───────────────────────────────────
// Verified BallDontLie IDs for top-15 players.
// Run: GET /v1/players?search=FirstName+LastName to confirm.
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
        const live = bdlId ? averages.find(a => a.player.id === bdlId) : null;
        if (!live) return sp;

        return {
            ...sp,
            pts: +parseFloat(live.pts ?? sp.pts).toFixed(1),
            ast: +parseFloat(live.ast ?? sp.ast).toFixed(1),
            reb: +parseFloat(live.reb ?? sp.reb).toFixed(1),
            // BDL free tier doesn't expose TS% — use fg_pct as a rough proxy
            ts: live.fg_pct ? +parseFloat(live.fg_pct * 100).toFixed(1) : sp.ts,
            // per / bpm / vorp / ortg / drtg stay from static data (not in BDL free tier)
        };
    });
}

export function usePlayers() {
    const season = currentSeason();
    const ids = Object.values(PLAYER_IDS).join("&player_ids[]=");

    return useQuery({
        queryKey: ["players", season],
        queryFn: async ({ signal }) => {
            const data = await bdlFetch(`/season_averages?season=${season}&player_ids[]=${ids}`, signal);
            return reshapePlayers(data.data, PLAYERS_FALLBACK);
        },
        staleTime: 1000 * 60 * 60, // 1 hour — averages don't change mid-game
        placeholderData: PLAYERS_FALLBACK,
        retry: (count, err) => err?.status === 401 ? false : count < 2,
    });
}

// ── Player search ─────────────────────────────────────────────
// Two-step: search by name → fetch season averages for found IDs.
// Min 2 chars before firing. Returns only players with > 0 stats (filters DNPs).
// AbortController via `signal` cancels in-flight searches on keystroke.
export function usePlayerSearch(query) {
    const season = currentSeason();
    const trimmed = query?.trim() ?? "";
    const enabled = !!API_KEY && trimmed.length >= 2;

    return useQuery({
        queryKey: ["playerSearch", trimmed, season],
        queryFn: async ({ signal }) => {
            // Step 1: search players by name
            const searchData = await bdlFetch(
                `/players?search=${encodeURIComponent(trimmed)}&per_page=25`,
                signal
            );
            const players = searchData.data ?? [];
            if (players.length === 0) return [];

            // Step 2: fetch season averages
            const ids = players.map(p => p.id).join("&player_ids[]=");
            const avgData = await bdlFetch(
                `/season_averages?season=${season}&player_ids[]=${ids}`,
                signal
            );
            const averages = avgData.data ?? [];

            // Step 3: merge
            return players
                .map(p => {
                    const avg = averages.find(a => a.player.id === p.id);
                    const name = `${p.first_name} ${p.last_name}`.trim();

                    const base = {
                        id: p.id,
                        name,
                        pos: p.position || "—",
                        team: p.team?.abbreviation || "—",
                        age: null,
                        // Advanced metrics unavailable on BDL free tier for arbitrary players
                        per: null, bpm: null, vorp: null, ortg: null, drtg: null, form: null,
                        pts: 0, ast: 0, reb: 0, ts: null,
                    };

                    if (!avg) return base;

                    return {
                        ...base,
                        pts: +parseFloat(avg.pts ?? 0).toFixed(1),
                        ast: +parseFloat(avg.ast ?? 0).toFixed(1),
                        reb: +parseFloat(avg.reb ?? 0).toFixed(1),
                        ts: avg.fg_pct ? +parseFloat(avg.fg_pct * 100).toFixed(1) : null,
                    };
                })
                .filter(p => p.pts > 0 || p.ast > 0 || p.reb > 0); // skip DNP / inactive
        },
        staleTime: 1000 * 60 * 5, // 5 min — search results stable within session
        enabled,
        retry: (count, err) => err?.status === 401 || err?.status === 429 ? false : count < 2,
    });
}

// ── Query client config ───────────────────────────────────────
export const queryClientConfig = {
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5,
            // Don't retry on auth / rate-limit errors
            retry: (count, error) => {
                if (error?.status === 401 || error?.status === 429) return false;
                return count < 2;
            },
            // Expose error details for 429 → let UI show "rate limited" message
            throwOnError: false,
        },
    },
};