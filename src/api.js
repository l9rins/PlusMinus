// ─── PlusMinus API Layer ──────────────────────────────────────────
// All data fetching proxied through Vercel serverless functions.
// API keys live server-side only — never in the client bundle.

import { useQuery } from "@tanstack/react-query";
import {
    EAST_STANDINGS as EAST_FALLBACK,
    WEST_STANDINGS as WEST_FALLBACK,
    TODAY_GAMES as GAMES_FALLBACK,
    PLAYERS as PLAYERS_FALLBACK,
} from "./data";
import { todayStr } from "./utils";

// ── Typed error ───────────────────────────────────────────────────
class ApiError extends Error {
    constructor(message, status, retryAfter = null) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.retryAfter = retryAfter;
    }
}

// ── Shared retry policy ───────────────────────────────────────────
// Used by every hook. Blocks retries on auth/rate-limit errors so
// a bad key doesn't spam BallDontLie with dozens of failing requests.
const shouldRetry = (count, err) => {
    if ([401, 429, 503].includes(err?.status)) return false;
    return count < 2;
};

// ── Proxy fetchers ────────────────────────────────────────────────
async function bdlFetch(path, signal) {
    const res = await fetch(`/api/bdl?path=${encodeURIComponent(path)}`, { signal });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));

        if (res.status === 401) {
            throw new ApiError(
                "Invalid BDL API key — check BDL_API_KEY in Vercel env vars", 401
            );
        }
        if (res.status === 429) {
            const retryAfter = parseInt(res.headers.get("Retry-After") || "60", 10);
            throw new ApiError(`BDL rate limited. Retry in ${retryAfter}s`, 429, retryAfter);
        }
        if (res.status === 500 && body.error?.includes("not configured")) {
            throw new ApiError("BDL_API_KEY not set in Vercel environment variables", 503);
        }
        throw new ApiError(body.error || `BDL proxy error ${res.status}`, res.status);
    }

    return res.json();
}

async function oddsFetch(signal) {
    const res = await fetch("/api/odds", { signal });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 401) {
            throw new ApiError(
                "Invalid Odds API key — check ODDS_API_KEY in Vercel env vars", 401
            );
        }
        if (res.status === 429) {
            throw new ApiError("Odds API rate limited", 429);
        }
        if (res.status === 500 && body.error?.includes("not configured")) {
            throw new ApiError("ODDS_API_KEY not set in Vercel environment variables", 503);
        }
        throw new ApiError(body.error || `Odds proxy error ${res.status}`, res.status);
    }

    return res.json();
}

// ── Season logic ──────────────────────────────────────────────────
function currentSeason() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    if (month >= 10 && day >= 15) return year;
    if (month >= 10 && day < 15) return year - 1;
    return year - 1;
}

// ── Server config ─────────────────────────────────────────────────
export function useServerConfig() {
    return useQuery({
        queryKey: ["serverConfig"],
        queryFn: async () => {
            const res = await fetch("/api/config");
            if (!res.ok) return { hasBdl: false, hasOdds: false };
            return res.json();
        },
        staleTime: 1000 * 60 * 60,
        placeholderData: { hasBdl: false, hasOdds: false },
        retry: false,
    });
}

// ── Standings ─────────────────────────────────────────────────────
function reshapeStandings(raw) {
    const sorted = [...raw].sort(
        (a, b) => b.wins / (b.wins + b.losses) - a.wins / (a.wins + a.losses)
    );
    const leader = sorted[0];

    return sorted.map((s) => {
        const total = s.wins + s.losses;
        const pct = total > 0 ? s.wins / total : 0;
        const gb = leader
            ? +((leader.wins - leader.losses - (s.wins - s.losses)) / 2).toFixed(1)
            : 0;
        return {
            team: s.team.abbreviation,
            w: s.wins,
            l: s.losses,
            pct: +pct.toFixed(3),
            gb,
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
                east: reshapeStandings(all.filter((s) => s.conference === "East")),
                west: reshapeStandings(all.filter((s) => s.conference === "West")),
            };
        },
        staleTime: 1000 * 60 * 10,
        placeholderData: { east: EAST_FALLBACK, west: WEST_FALLBACK },
        retry: shouldRetry,
    });
}

// ── Today's games ─────────────────────────────────────────────────
function reshapeGames(raw) {
    return raw.map((g) => {
        const status = g.status;
        const isFinal = status === "Final";
        const isLive = !isFinal && !status.match(/^\d{1,2}:\d{2}/);

        let time = status;
        if (status && status.includes("T") && status.includes("Z")) {
            try {
                time = new Date(status).toLocaleTimeString("en-US", {
                    hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
                }) + " ET";
            } catch { time = status; }
        }

        return {
            id: String(g.id),
            away: g.visitor_team.abbreviation,
            home: g.home_team.abbreviation,
            awayP: 42,
            homeP: 58,
            time,
            status: isFinal ? "final" : isLive ? "live" : "scheduled",
            awayScore: isFinal || isLive ? g.visitor_team_score : null,
            homeScore: isFinal || isLive ? g.home_team_score : null,
            period: isLive && g.period > 0 ? g.period : null,
            spread: "—",
            total: "—",
        };
    });
}

export function useTodayGames() {
    return useQuery({
        queryKey: ["games", todayStr()],
        queryFn: async ({ signal }) => {
            const data = await bdlFetch(`/games?dates[]=${todayStr()}&per_page=15`, signal);
            return reshapeGames(data.data);
        },
        staleTime: 1000 * 60 * 2,
        refetchInterval: 1000 * 60 * 2,
        placeholderData: GAMES_FALLBACK,
        retry: shouldRetry,
    });
}

// ── Odds ──────────────────────────────────────────────────────────
export function useOdds() {
    return useQuery({
        queryKey: ["odds", todayStr()],
        queryFn: ({ signal }) => oddsFetch(signal),
        staleTime: 1000 * 60 * 15,
        refetchInterval: 1000 * 60 * 15,
        retry: shouldRetry,
    });
}

export function mergeOddsIntoGames(games, odds) {
    if (!games || !odds) return games ?? [];
    return games.map((g) => {
        if (g.status !== "scheduled") return g;
        const match = odds[`${g.away}@${g.home}`];
        if (!match) return g;
        return {
            ...g,
            awayP: match.awayP,
            homeP: match.homeP,
            bestHomeBook: match.bestHomeBook,
            bestAwayBook: match.bestAwayBook,
            bestHomeOdds: match.bestHomeOdds,
            bestAwayOdds: match.bestAwayOdds,
            consHomeP: match.consHomeP,
            consAwayP: match.consAwayP,
            books: match.books,
            isArb: match.isArb,
            arbPct: match.arbPct,
            bookCount: match.bookCount,
        };
    });
}

// ── Players ───────────────────────────────────────────────────────
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
    return staticPlayers.map((sp) => {
        const bdlId = PLAYER_IDS[sp.name];
        const live = bdlId ? averages.find((a) => a.player.id === bdlId) : null;
        if (!live) return sp;
        return {
            ...sp,
            pts: +parseFloat(live.pts ?? sp.pts).toFixed(1),
            ast: +parseFloat(live.ast ?? sp.ast).toFixed(1),
            reb: +parseFloat(live.reb ?? sp.reb).toFixed(1),
            ts: live.fg_pct ? +parseFloat(live.fg_pct * 100).toFixed(1) : sp.ts,
        };
    });
}

export function usePlayers() {
    const season = currentSeason();
    const ids = Object.values(PLAYER_IDS).join("&player_ids[]=");
    return useQuery({
        queryKey: ["players", season],
        queryFn: async ({ signal }) => {
            const data = await bdlFetch(
                `/season_averages?season=${season}&player_ids[]=${ids}`, signal
            );
            return reshapePlayers(data.data, PLAYERS_FALLBACK);
        },
        staleTime: 1000 * 60 * 60,
        placeholderData: PLAYERS_FALLBACK,
        retry: shouldRetry,
    });
}

export function usePlayerSearch(query) {
    const season = currentSeason();
    const trimmed = query?.trim() ?? "";
    const enabled = trimmed.length >= 2;

    return useQuery({
        queryKey: ["playerSearch", trimmed, season],
        queryFn: async ({ signal }) => {
            const searchData = await bdlFetch(
                `/players?search=${encodeURIComponent(trimmed)}&per_page=25`, signal
            );
            const players = searchData.data ?? [];
            if (!players.length) return [];

            const ids = players.map((p) => p.id).join("&player_ids[]=");
            const avgData = await bdlFetch(
                `/season_averages?season=${season}&player_ids[]=${ids}`, signal
            );
            const averages = avgData.data ?? [];

            return players
                .map((p) => {
                    const avg = averages.find((a) => a.player.id === p.id);
                    const name = `${p.first_name} ${p.last_name}`.trim();
                    const base = {
                        id: p.id, name,
                        pos: p.position || "—",
                        team: p.team?.abbreviation || "—",
                        age: null,
                        per: null, bpm: null, vorp: null,
                        ortg: null, drtg: null, form: null,
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
                .filter((p) => p.pts > 0 || p.ast > 0 || p.reb > 0);
        },
        staleTime: 1000 * 60 * 5,
        enabled,
        retry: shouldRetry,
    });
}

// ── Query client global config ────────────────────────────────────
export const queryClientConfig = {
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5,
            retry: shouldRetry,
            throwOnError: false,
        },
    },
};