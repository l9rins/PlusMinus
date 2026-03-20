// ─── PlusMinus API Layer ──────────────────────────────────────────
// Data sources:
//   Standings      → ESPN free API via /api/espn  (no key)
//   Games          → ESPN free API via /api/espn  (no key)
//   Team schedule  → ESPN free API via /api/espn  (no key)
//   Odds           → The Odds API via /api/odds   (ODDS_API_KEY)
//   Players        → Static data.js               (BDL paywall bypass)
//   Search         → BDL /players endpoint        (BDL_API_KEY, free tier)

import { useQuery } from "@tanstack/react-query";
import {
    EAST_STANDINGS as EAST_FALLBACK,
    WEST_STANDINGS as WEST_FALLBACK,
    TODAY_GAMES as GAMES_FALLBACK,
    PLAYERS as PLAYERS_FALLBACK,
} from "./data";
import { todayStr, currentSeason } from "./utils";

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
  // Don't retry auth failures, rate limits, misconfig, or timeouts
  if ([401, 429, 503, 504].includes(err?.status)) return false;
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
// ESPN shape: data.children[0/1].standings.entries[{team.abbreviation, stats[]}]
// Records use id fields: "33"=Home, "34"=Road, "901"=L10, name="streak"=streak

const ESPN_ABBR_FIX = { SA: "SAS", WSH: "WAS", NY: "NYK", GS: "GSW", NO: "NOP", PHO: "PHX" };
const fixAbbr = (a) => ESPN_ABBR_FIX[a] ?? a;

function reshapeESPNStandings(data) {
    const reshapeConf = (conf) => {
        if (!conf) return [];
        const entries = conf.standings?.entries ?? [];
        return entries.map((e) => {
            const abbr = fixAbbr(e.team?.abbreviation ?? "???");
            const sv = (name) => e.stats?.find((s) => s.name === name)?.value ?? 0;
            const sd = (name) => e.stats?.find((s) => s.name === name)?.displayValue ?? "—";
            const sid = (id) => e.stats?.find((s) => s.id === id)?.displayValue ?? "—";
            const w = sv("wins");
            const l = sv("losses");
            const pct = w + l > 0 ? +(w / (w + l)).toFixed(3) : 0;
            const gb = sv("gamesBehind");
            const streakV = sv("streak");
            const streak = streakV > 0 ? `W${streakV}` : streakV < 0 ? `L${Math.abs(streakV)}` : "—";
            return {
                team: abbr,
                w, l, pct,
                gb: gb === 0 ? 0 : +parseFloat(gb).toFixed(1),
                last10: sid("901"),
                home: sid("33"),
                road: sid("34"),
                streak,
            };
        }).sort((a, b) => b.pct - a.pct);
    };

    const east = data?.children?.find((c) => c.name?.toLowerCase().includes("eastern"));
    const west = data?.children?.find((c) => c.name?.toLowerCase().includes("western"));
    return { east: reshapeConf(east), west: reshapeConf(west) };
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
        const time = status === "final" ? "Final" : detail;
        return {
            id: String(ev.id), away: awayAbbr, home: homeAbbr,
            awayP: null,   // ← was hardcoded 42
            homeP: null,   // ← was hardcoded 58
            time, status, awayScore, homeScore, period,
            spread: "—", total: "—",
        };
    });
}

export function useTodayGames() {
    const today = todayStr().replace(/-/g, "");
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

// ── Team Schedule (ESPN) ──────────────────────────────────────────
// Returns up to 82 games for a team — past results + upcoming.
// ESPN shape: { team: {...}, events: [ { id, date, home, away, result, score } ] }

function reshapeTeamSchedule(data, teamAbbr) {
    const events = data?.events ?? [];
    return events.map((ev) => {
        const comp = ev.competitions?.[0];
        const homeTeam = comp?.competitors?.find((c) => c.homeAway === "home");
        const awayTeam = comp?.competitors?.find((c) => c.homeAway === "away");
        const isHome = fixAbbr(homeTeam?.team?.abbreviation ?? "") === teamAbbr;
        const opponent = fixAbbr(isHome
            ? awayTeam?.team?.abbreviation
            : homeTeam?.team?.abbreviation) ?? "???";
        const statusType = comp?.status?.type;
        const completed = statusType?.completed ?? false;
        const state = statusType?.state ?? "pre";
        const status = completed ? "final" : state === "in" ? "live" : "scheduled";

        let result = null, teamScore = null, oppScore = null;
        if (completed) {
            const teamComp = isHome ? homeTeam : awayTeam;
            const oppComp = isHome ? awayTeam : homeTeam;
            teamScore = parseInt(teamComp?.score ?? 0);
            oppScore = parseInt(oppComp?.score ?? 0);
            result = teamScore > oppScore ? "W" : "L";
        }

        // Date string — "Mar 19" format
        const dateObj = ev.date ? new Date(ev.date) : null;
        const dateStr = dateObj
            ? dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })
            : "—";

        return {
            id: String(ev.id),
            date: ev.date ?? "",
            dateStr,
            isHome,
            opponent,
            status,
            result,
            teamScore,
            oppScore,
            detail: statusType?.detail ?? "",
        };
    }).sort((a, b) => new Date(a.date) - new Date(b.date));
}

export function useTeamSchedule(teamAbbr) {
    return useQuery({
        queryKey: ["teamSchedule", teamAbbr],
        queryFn: async ({ signal }) => {
            const data = await espnFetch("team_schedule", { team: teamAbbr }, signal);
            return reshapeTeamSchedule(data, teamAbbr);
        },
        staleTime: 1000 * 60 * 5,
        enabled: !!teamAbbr,
        retry: shouldRetry,
    });
}

// ── Odds ──────────────────────────────────────────────────────────
export function useOdds() {
    return useQuery({
        queryKey: ["odds", todayStr()],
        queryFn: ({ signal }) => oddsFetch(signal),
        staleTime: 1000 * 60 * 15, // 15m
        refetchInterval: 1000 * 60 * 15,
        retry: shouldRetry,
        placeholderData: {},
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

            return players.map((p) => {
                const name = `${p.first_name} ${p.last_name}`.trim();
                return {
                    id: p.id, name,
                    pos: p.position || "—",
                    team: p.team?.abbreviation || "—",
                    age: null,
                    per: null, bpm: null, vorp: null,
                    ortg: null, drtg: null, form: null,
                    pts: 0, ast: 0, reb: 0, ts: null,
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