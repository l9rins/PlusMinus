// ─── PlusMinus API Layer ──────────────────────────────────────────
// Data sources:
//   Standings  → ESPN free API via /api/espn  (no key)
//   Games      → ESPN free API via /api/espn  (no key)
//   Odds       → The Odds API via /api/odds   (ODDS_API_KEY)
//   Players    → Static data.js               (BDL paywall bypass)
//   Search     → BDL /players endpoint        (BDL_API_KEY, free tier)

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
const shouldRetry = (count, err) => {
    if ([401, 429, 503].includes(err?.status)) return false;
    return count < 2;
};

// ── ESPN proxy fetcher ────────────────────────────────────────────
async function espnFetch(resource, params = {}, signal) {
    const qs = new URLSearchParams({ resource, ...params });
    const res = await fetch(`/api/espn?${qs}`, { signal });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(body.error || `ESPN proxy ${res.status}`, res.status);
    }
    return res.json();
}

// ── BDL proxy fetcher (player search only) ────────────────────────
async function bdlFetch(path, signal) {
    const res = await fetch(`/api/bdl?path=${encodeURIComponent(path)}`, { signal });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 401) throw new ApiError("Invalid BDL API key", 401);
        if (res.status === 429) {
            const ra = parseInt(res.headers.get("Retry-After") || "60", 10);
            throw new ApiError(`BDL rate limited. Retry in ${ra}s`, 429, ra);
        }
        if (res.status === 500 && body.error?.includes("not configured")) {
            throw new ApiError("BDL_API_KEY not configured on server", 503);
        }
        throw new ApiError(body.error || `BDL proxy ${res.status}`, res.status);
    }
    return res.json();
}

// ── Odds proxy fetcher ────────────────────────────────────────────
async function oddsFetch(signal) {
    const res = await fetch("/api/odds", { signal });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 401) throw new ApiError("Invalid Odds API key", 401);
        if (res.status === 429) throw new ApiError("Odds API rate limited", 429);
        if (res.status === 500 && body.error?.includes("not configured")) {
            throw new ApiError("ODDS_API_KEY not configured on server", 503);
        }
        throw new ApiError(body.error || `Odds proxy ${res.status}`, res.status);
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

// ── Standings (ESPN) ──────────────────────────────────────────────
// Real ESPN response shape (from site.web.api.espn.com/apis/v2/...):
//   data.children[0]  = Eastern Conference  (id: "5")
//   data.children[1]  = Western Conference  (id: "6")
//   Each: { name, standings: { entries: [ { team: { abbreviation }, stats: [...] } ] } }
//
// ESPN abbreviation quirks confirmed from live data:
//   SA  → SAS   (San Antonio Spurs)
//   WSH → WAS   (Washington Wizards)
//   NY  → NYK   (New York Knicks)
//   GS  → GSW   (Golden State Warriors)  — scoreboard only
//   NO  → NOP   (New Orleans Pelicans)   — scoreboard only

const ESPN_ABBR_FIX = {
    SA: "SAS",
    WSH: "WAS",
    NY: "NYK",
    GS: "GSW",
    NO: "NOP",
    PHO: "PHX",
};
const fixAbbr = (a) => ESPN_ABBR_FIX[a] ?? a;

function reshapeESPNStandings(data) {
    const reshapeConf = (conf) => {
        if (!conf) return [];
        const entries = conf.standings?.entries ?? [];
        return entries.map((e) => {
            const abbr = fixAbbr(e.team?.abbreviation ?? "???");

            // Find stat by name field
            const sv = (name) => e.stats?.find((s) => s.name === name)?.value ?? 0;
            const sd = (name) => e.stats?.find((s) => s.name === name)?.displayValue ?? "—";
            // Find stat by id field (records use id not name)
            const sid = (id) => e.stats?.find((s) => s.id === id)?.displayValue ?? "—";

            const w = sv("wins");
            const l = sv("losses");
            const pct = w + l > 0 ? +(w / (w + l)).toFixed(3) : 0;
            const gb = sv("gamesBehind");

            // streak value: positive = win streak, negative = loss streak
            const streakVal = sv("streak");
            const streak = streakVal > 0 ? `W${streakVal}` : streakVal < 0 ? `L${Math.abs(streakVal)}` : "—";

            return {
                team: abbr,
                w,
                l,
                pct,
                gb: gb === 0 ? 0 : +parseFloat(gb).toFixed(1),
                last10: sid("901"),   // "Last Ten Games" stat uses id "901"
                home: sid("33"),    // Home record uses id "33"
                road: sid("34"),    // Road record uses id "34"
                streak,
            };
        }).sort((a, b) => b.pct - a.pct);
    };

    const east = data?.children?.find((c) => c.name?.toLowerCase().includes("eastern"));
    const west = data?.children?.find((c) => c.name?.toLowerCase().includes("western"));

    return {
        east: reshapeConf(east),
        west: reshapeConf(west),
    };
}

export function useStandings() {
    return useQuery({
        queryKey: ["standings", "espn"],
        queryFn: async ({ signal }) => {
            const data = await espnFetch("standings", {}, signal);
            return reshapeESPNStandings(data);
        },
        staleTime: 1000 * 60 * 10,
        placeholderData: { east: EAST_FALLBACK, west: WEST_FALLBACK },
        retry: shouldRetry,
    });
}

// ── Today's games (ESPN scoreboard) ──────────────────────────────
// ESPN scoreboard shape:
//   data.events[ { id, competitions: [ { competitors: [...], status: {...} } ] } ]
// competitors: [ { homeAway: "home"|"away", team: { abbreviation }, score } ]
// status: { type: { state: "pre"|"in"|"post", completed, detail }, period }

function reshapeESPNScoreboard(data) {
    return (data?.events ?? []).map((ev) => {
        const comp = ev.competitions?.[0];
        const statusType = comp?.status?.type;
        const state = statusType?.state ?? "pre";
        const completed = statusType?.completed ?? false;
        const detail = statusType?.detail ?? "";

        const status = completed ? "final" : state === "in" ? "live" : "scheduled";

        const home = comp?.competitors?.find((c) => c.homeAway === "home");
        const away = comp?.competitors?.find((c) => c.homeAway === "away");

        const homeAbbr = fixAbbr(home?.team?.abbreviation ?? "???");
        const awayAbbr = fixAbbr(away?.team?.abbreviation ?? "???");

        const homeScore = status !== "scheduled" ? parseInt(home?.score ?? 0) : null;
        const awayScore = status !== "scheduled" ? parseInt(away?.score ?? 0) : null;
        const period = status === "live" ? (comp?.status?.period ?? null) : null;

        const time = status === "final" ? "Final"
            : status === "live" ? detail
                : detail; // "7:30 PM EDT" for scheduled

        return {
            id: String(ev.id),
            away: awayAbbr,
            home: homeAbbr,
            awayP: 42,
            homeP: 58,
            time,
            status,
            awayScore,
            homeScore,
            period,
            spread: "—",
            total: "—",
        };
    });
}

export function useTodayGames() {
    const today = todayStr().replace(/-/g, ""); // ESPN uses YYYYMMDD

    return useQuery({
        queryKey: ["games", "espn", today],
        queryFn: async ({ signal }) => {
            const data = await espnFetch("scoreboard", { date: today }, signal);
            return reshapeESPNScoreboard(data);
        },
        staleTime: 1000 * 60,
        refetchInterval: 1000 * 60,
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

// ── Players (static) ──────────────────────────────────────────────
// BDL season_averages is paywalled. Static data.js is the source.
export function usePlayers() {
    return useQuery({
        queryKey: ["players", "static"],
        queryFn: async () => PLAYERS_FALLBACK,
        staleTime: Infinity,
        placeholderData: PLAYERS_FALLBACK,
    });
}

// ── Player search (BDL free endpoint) ────────────────────────────
export function usePlayerSearch(query) {
    const season = currentSeason();
    const trimmed = query?.trim() ?? "";
    const enabled = trimmed.length >= 2;

    return useQuery({
        queryKey: ["playerSearch", trimmed],
        queryFn: async ({ signal }) => {
            const searchData = await bdlFetch(
                `/players?search=${encodeURIComponent(trimmed)}&per_page=25`,
                signal
            );
            const players = searchData.data ?? [];
            if (!players.length) return [];

            // Try to get averages — gracefully skip if paywalled
            let averages = [];
            try {
                const ids = players.map((p) => p.id).join("&player_ids[]=");
                const avgData = await bdlFetch(
                    `/season_averages?season=${season}&player_ids[]=${ids}`,
                    signal
                );
                averages = avgData.data ?? [];
            } catch {
                // Season averages behind paywall — show players without stats
            }

            return players.map((p) => {
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
            });
        },
        staleTime: 1000 * 60 * 5,
        enabled,
        retry: shouldRetry,
    });
}

// ── Query client config ───────────────────────────────────────────
export const queryClientConfig = {
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5,
            retry: shouldRetry,
            throwOnError: false,
        },
    },
};