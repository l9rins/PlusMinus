// ─── PlusMinus API Layer ──────────────────────────────────────────
// Data sources after BDL paywall migration:
//   Standings  → ESPN free API  (no key, /api/espn proxy)
//   Games      → ESPN free API  (no key, /api/espn proxy)
//   Odds       → The Odds API   (ODDS_API_KEY in Vercel env)
//   Players    → Static data.js (BDL season_averages is now paywalled)
//   Search     → BDL /players   (name search still free on BDL)

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
// Never retry on auth/rate-limit errors — stops request flooding
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

// ── BDL proxy fetcher (player name search only) ───────────────────
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
// ESPN shape: { children: [ { name: "Eastern Conference",
//   standings: { entries: [ { team: { abbreviation }, stats: [...] } ] } } ] }

function reshapeESPNStandings(data) {
    const reshapeConf = (conf) => {
        const entries = conf?.standings?.entries ?? [];
        return entries.map((e) => {
            const abbr = e.team?.abbreviation ?? "???";
            const getStat = (name) => e.stats?.find((s) => s.name === name)?.value ?? 0;
            const getStatStr = (name) => e.stats?.find((s) => s.name === name)?.displayValue ?? "—";

            const w = getStat("wins");
            const l = getStat("losses");
            const pct = w + l > 0 ? +(w / (w + l)).toFixed(3) : 0;
            const gb = getStat("gamesBehind");

            return {
                team: abbr,
                w,
                l,
                pct,
                gb: gb === 0 ? 0 : +gb.toFixed(1),
                last10: getStatStr("vsconf"),
                home: getStatStr("Home"),
                road: getStatStr("Road"),
                streak: getStatStr("streak") || "—",
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

// ── Today's games (ESPN) ──────────────────────────────────────────
// ESPN abbreviation corrections (ESPN uses non-standard codes for some teams)
const ESPN_ABBR = {
    GS: "GSW", NO: "NOP", NY: "NYK", SA: "SAS",
    PHO: "PHX", WSH: "WAS",
};
const normAbbr = (a) => ESPN_ABBR[a] ?? a;

function reshapeESPNScoreboard(data) {
    return (data?.events ?? []).map((ev) => {
        const comp = ev.competitions?.[0];
        const statusType = comp?.status?.type;
        const detail = statusType?.detail ?? "";
        const state = statusType?.state ?? "pre"; // "pre" | "in" | "post"
        const completed = statusType?.completed ?? false;

        const status = completed ? "final" : state === "in" ? "live" : "scheduled";

        const home = comp?.competitors?.find((c) => c.homeAway === "home");
        const away = comp?.competitors?.find((c) => c.homeAway === "away");

        const homeAbbr = normAbbr(home?.team?.abbreviation ?? "???");
        const awayAbbr = normAbbr(away?.team?.abbreviation ?? "???");

        const homeScore = (status !== "scheduled") ? parseInt(home?.score ?? 0) : null;
        const awayScore = (status !== "scheduled") ? parseInt(away?.score ?? 0) : null;
        const period = status === "live" ? (comp?.status?.period ?? null) : null;

        // Time display: "Final", "Q3 4:22", or "7:30 PM ET"
        const time = status === "final" ? "Final"
            : status === "live" ? detail
                : detail;

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
        staleTime: 1000 * 60,       // 1 min
        refetchInterval: 1000 * 60,       // poll every 1 min
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
// BDL season_averages endpoint is now behind a paywall.
// Static data from data.js is used for the roster tab.
// Player name search still works via BDL's free /players endpoint.

export function usePlayers() {
    return useQuery({
        queryKey: ["players", "static"],
        queryFn: async () => PLAYERS_FALLBACK,
        staleTime: Infinity,
        placeholderData: PLAYERS_FALLBACK,
    });
}

export function usePlayerSearch(query) {
    const season = currentSeason();
    const trimmed = query?.trim() ?? "";
    const enabled = trimmed.length >= 2;

    return useQuery({
        queryKey: ["playerSearch", trimmed],
        queryFn: async ({ signal }) => {
            // BDL /players search — still free
            const searchData = await bdlFetch(
                `/players?search=${encodeURIComponent(trimmed)}&per_page=25`,
                signal
            );
            const players = searchData.data ?? [];
            if (!players.length) return [];

            // Attempt season averages — gracefully degrade if paywalled
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