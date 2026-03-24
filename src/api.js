// ─── PlusMinus API Layer ──────────────────────────────────────────
// This file is our previously-fixed api.js with two additional fixes
// from the Gemini fact-check:
//
// FIX G1: userId added to ["bets"] query key.
//   The query was keyed as ["bets"] globally. If a user logs out and
//   a different user logs in on the same browser session without a hard
//   reload, React Query serves the first user's cached bets to the second
//   user until the refetch completes — a data-privacy leak between sessions.
//   Fix: include userId in the key and set enabled: !!userId so the query
//   doesn't fire at all when unauthenticated.
//
// FIX G2: 503 removed from the shouldRetry exclusion list.
//   api/odds.js was intentionally changed to return 503 on timeout
//   (instead of 504) specifically because the comment said "503 is retried".
//   But shouldRetry explicitly listed 503 as a non-retry status, so the
//   documented fix was dead on arrival — timeouts were never retried.
//   Fix: remove 503 from the exclusion array. 503 from odds.js is a
//   transient timeout; it should get up to 2 retries. Other 503s from
//   legitimate server errors (KV unavailable etc.) also benefit from retry.
//
// All previously documented fixes (Fix 4–6, 13, 16, 26 etc.) are retained.

import { useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/clerk-react";
import {
  EAST_STANDINGS as EAST_FALLBACK,
  WEST_STANDINGS as WEST_FALLBACK,
  TODAY_GAMES as GAMES_FALLBACK,
} from "./data";
import { todayStr, currentSeason, reshapeNBAStats } from "./utils";

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
// FIX G2: 503 removed. api/odds.js returns 503 on upstream timeout and
// explicitly expects it to be retried. Keeping 503 here made that fix
// completely inert — timeouts were never retried regardless of the
// server-side change. 503 is a transient "service unavailable" status;
// retrying it (up to 2 times) is the correct behaviour everywhere.
//
// Retained exclusions:
//   401 — auth failure, retrying without fresh token is pointless
//         (useBets has its own 401 retry with token refresh)
//   429 — rate limited, retrying immediately makes it worse
//   502 — bad gateway from upstream; we retry 503 not 502 because
//         502 usually indicates a harder upstream failure
//   504 — gateway timeout from Vercel infra; different from our 503
const shouldRetry = (count, err) => {
  if ([401, 429, 502, 504].includes(err?.status)) return false;
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

// ── BDL proxy fetcher ─────────────────────────────────────────────
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

// ── NBA stats proxy fetcher ───────────────────────────────────────
async function nbaFetch(endpoint, params = {}, signal) {
  const qs = new URLSearchParams({ endpoint, ...params });
  const res = await fetch(`/api/nba?${qs}`, { signal });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error || `NBA proxy ${res.status}`, res.status);
  }
  return res.json();
}

// ── League team stats ─────────────────────────────────────────────
export function useLeagueTeamStats() {
  return useQuery({
    queryKey: ["nba", "leagueTeamStats"],
    queryFn: async ({ signal }) => {
      const season = currentSeason();
      const data = await nbaFetch("leaguedashteamstats", {
        Season: `${season - 1}-${String(season).slice(2)}`,
        SeasonType: "Regular Season",
        PerMode: "PerGame",
        MeasureType: "Advanced",
      }, signal);
      return data;
    },
    staleTime: 1000 * 60 * 10,
    placeholderData: null,
    retry: shouldRetry,
  });
}

// ── League player stats ───────────────────────────────────────────
export function useLeaguePlayerStats() {
  return useQuery({
    queryKey: ["nba", "leaguePlayerStats"],
    queryFn: async ({ signal }) => {
      const season = currentSeason();
      const data = await nbaFetch("leaguedashplayerstats", {
        Season: `${season - 1}-${String(season).slice(2)}`,
        SeasonType: "Regular Season",
        PerMode: "PerGame",
      }, signal);
      return data;
    },
    staleTime: 1000 * 60 * 10,
    placeholderData: null,
    retry: shouldRetry,
  });
}

export function useLeaguePlayerStatsAdvanced() {
  return useQuery({
    queryKey: ["nba", "leaguePlayerStatsAdvanced"],
    queryFn: async ({ signal }) => {
      const season = currentSeason();
      const data = await nbaFetch("leaguedashplayerstats", {
        Season: `${season - 1}-${String(season).slice(2)}`,
        SeasonType: "Regular Season",
        PerMode: "PerGame",
        MeasureType: "Advanced",
      }, signal);
      return data;
    },
    staleTime: 1000 * 60 * 10,
    placeholderData: null,
    retry: shouldRetry,
  });
}

export function useAllPlayers() {
  return useQuery({
    queryKey: ["nba", "commonAllPlayers"],
    queryFn: async ({ signal }) => {
      const season = currentSeason();
      const data = await nbaFetch("commonallplayers", {
        LeagueID: "00",
        Season: `${season - 1}-${String(season).slice(2)}`,
        IsOnlyCurrentSeason: "1",
      }, signal);
      return data;
    },
    staleTime: 1000 * 60 * 60,
    placeholderData: null,
    retry: shouldRetry,
  });
}

// ── Enriched player stats ─────────────────────────────────────────
export function useEnrichedPlayerStats() {
  const base      = useLeaguePlayerStats();
  const advanced  = useLeaguePlayerStatsAdvanced();
  const allPlayers = useAllPlayers();

  const data = useMemo(() => {
    if (!base.data || !advanced.data) return null;

    const baseRows = reshapeNBAStats(base.data, "LeagueDashPlayerStats")
      .filter(r => r.GP >= 10);

    const advMap = {};
    reshapeNBAStats(advanced.data, "LeagueDashPlayerStats").forEach(r => {
      advMap[r.PLAYER_ID] = r;
    });

    const posMap = {};
    if (allPlayers.data) {
      reshapeNBAStats(allPlayers.data, "CommonAllPlayers").forEach(r => {
        posMap[r.PERSON_ID] = r.POSITION ?? "—";
      });
    }

    return baseRows.map(r => {
      const adv = advMap[r.PLAYER_ID] ?? {};
      return {
        id:   r.PLAYER_ID,
        name: r.PLAYER_NAME,
        pos:  posMap[r.PLAYER_ID] ?? "—",
        team: r.TEAM_ABBREVIATION,
        age:  r.AGE,
        pts:  +r.PTS.toFixed(1),
        ast:  +r.AST.toFixed(1),
        reb:  +r.REB.toFixed(1),
        ts:   r.TS_PCT != null      ? +(r.TS_PCT * 100).toFixed(1)      : null,
        per:  adv.PIE != null        ? +adv.PIE.toFixed(1)               : null,
        ortg: adv.OFF_RATING != null ? +adv.OFF_RATING.toFixed(1)        : null,
        drtg: adv.DEF_RATING != null ? +adv.DEF_RATING.toFixed(1)        : null,
        usg:  adv.USG_PCT != null    ? +(adv.USG_PCT * 100).toFixed(1)   : null,
        bpm: null, vorp: null, form: null,
      };
    });
  }, [base.data, advanced.data, allPlayers.data]);

  return {
    data,
    isLoading:     base.isLoading || advanced.isLoading,
    isError:       base.isError   || advanced.isError,
    isFetching:    base.isFetching || advanced.isFetching || allPlayers.isFetching,
    dataUpdatedAt: base.dataUpdatedAt,
    refetch:       base.refetch,
  };
}

export function useEloData() {
  return useQuery({
    queryKey: ["elo"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/elo", { signal });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(body.error || `Elo proxy ${res.status}`, res.status);
      }
      return res.json();
    },
    staleTime: 1000 * 60 * 60,
    placeholderData: null,
    retry: shouldRetry,
  });
}

export function usePlayerGameLog(playerId, enabled = false) {
  return useQuery({
    queryKey: ["nba", "playerGameLog", playerId],
    queryFn: async ({ signal }) => {
      const season = currentSeason();
      const data = await nbaFetch("playergamelog", {
        PlayerID:   playerId,
        Season:     `${season - 1}-${String(season).slice(2)}`,
        SeasonType: "Regular Season",
        LeagueID:   "00",
        LastNGames: "5",
      }, signal);

      const resultSet = data?.resultSets?.[0];
      if (!resultSet) return [];
      const headers = resultSet.headers;
      const rows    = resultSet.rowSet;
      const wlIdx   = headers.indexOf("WL");
      if (wlIdx === -1) return [];

      return rows.slice(0, 5).map(row => row[wlIdx]).reverse();
    },
    staleTime: 1000 * 60 * 30,
    enabled:   enabled && !!playerId,
    placeholderData: null,
    retry: shouldRetry,
  });
}

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
const ESPN_STANDING_STAT_IDS = { last10: "901", home: "33", road: "34" };
const ESPN_ABBR_FIX = { SA: "SAS", WSH: "WAS", NY: "NYK", GS: "GSW", NO: "NOP", PHO: "PHX" };
const fixAbbr = (a) => ESPN_ABBR_FIX[a] ?? a;

function reshapeESPNStandings(data) {
  const reshapeConf = (conf) => {
    if (!conf) return [];
    const entries = conf.standings?.entries ?? [];
    return entries.map((e) => {
      const abbr    = fixAbbr(e.team?.abbreviation ?? "???");
      const sv      = (name) => e.stats?.find((s) => s.name === name)?.value ?? 0;
      const sid     = (id)   => e.stats?.find((s) => s.id === id)?.displayValue ?? "—";
      const w       = sv("wins");
      const l       = sv("losses");
      const pct     = w + l > 0 ? +(w / (w + l)).toFixed(3) : 0;
      const gb      = sv("gamesBehind");
      const streakV = sv("streak");
      const streak  = streakV > 0 ? `W${streakV}` : streakV < 0 ? `L${Math.abs(streakV)}` : "—";
      return {
        team: abbr, w, l, pct,
        gb:     gb === 0 ? 0 : +parseFloat(gb).toFixed(1),
        last10: sid(ESPN_STANDING_STAT_IDS.last10),
        home:   sid(ESPN_STANDING_STAT_IDS.home),
        road:   sid(ESPN_STANDING_STAT_IDS.road),
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

// ── Today's games ─────────────────────────────────────────────────
function reshapeESPNScoreboard(data) {
  return (data?.events ?? []).map((ev) => {
    const comp       = ev.competitions?.[0];
    const statusType = comp?.status?.type;
    const state      = statusType?.state ?? "pre";
    const completed  = statusType?.completed ?? false;
    const detail     = statusType?.detail ?? "";
    const status     = completed ? "final" : state === "in" ? "live" : "scheduled";
    const home       = comp?.competitors?.find((c) => c.homeAway === "home");
    const away       = comp?.competitors?.find((c) => c.homeAway === "away");
    const homeAbbr   = fixAbbr(home?.team?.abbreviation ?? "???");
    const awayAbbr   = fixAbbr(away?.team?.abbreviation ?? "???");
    const homeScore  = status !== "scheduled" ? parseInt(home?.score ?? 0) : null;
    const awayScore  = status !== "scheduled" ? parseInt(away?.score ?? 0) : null;
    const period     = status === "live" ? (comp?.status?.period ?? null) : null;
    const time       = status === "final" ? "Final" : detail;
    return {
      id: String(ev.id), away: awayAbbr, home: homeAbbr,
      awayP: null, homeP: null,
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
    staleTime: 1000 * 30,
    refetchInterval: (query) => {
      const games     = query.state.data;
      if (!Array.isArray(games) || games.length === 0) return 1000 * 60 * 10;
      const liveCount = games.filter(g => g.status === "live").length;
      if (liveCount > 0) return 1000 * 30;
      return 1000 * 60 * 2;
    },
    placeholderData: GAMES_FALLBACK,
    retry: shouldRetry,
  });
}

// ── Team Schedule (ESPN) ──────────────────────────────────────────
function reshapeTeamSchedule(data, teamAbbr) {
  const events = data?.events ?? [];
  return events.map((ev) => {
    const comp       = ev.competitions?.[0];
    const homeTeam   = comp?.competitors?.find((c) => c.homeAway === "home");
    const awayTeam   = comp?.competitors?.find((c) => c.homeAway === "away");
    const isHome     = fixAbbr(homeTeam?.team?.abbreviation ?? "") === teamAbbr;
    const opponent   = fixAbbr(isHome ? awayTeam?.team?.abbreviation : homeTeam?.team?.abbreviation) ?? "???";
    const statusType = comp?.status?.type;
    const completed  = statusType?.completed ?? false;
    const state      = statusType?.state ?? "pre";
    const status     = completed ? "final" : state === "in" ? "live" : "scheduled";

    let result = null, teamScore = null, oppScore = null;
    if (completed) {
      const teamComp = isHome ? homeTeam : awayTeam;
      const oppComp  = isHome ? awayTeam : homeTeam;
      teamScore = parseInt(teamComp?.score ?? 0);
      oppScore  = parseInt(oppComp?.score  ?? 0);
      result    = teamScore > oppScore ? "W" : "L";
    }

    const dateObj = ev.date ? new Date(ev.date) : null;
    const dateStr = dateObj
      ? dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })
      : "—";

    return {
      id: String(ev.id), date: ev.date ?? "", dateStr,
      isHome, opponent, status, result, teamScore, oppScore,
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
    enabled:   !!teamAbbr,
    retry:     shouldRetry,
  });
}

// ── Odds ──────────────────────────────────────────────────────────
export function useOdds() {
  return useQuery({
    queryKey: ["odds", todayStr()],
    queryFn: ({ signal }) => oddsFetch(signal),
    staleTime:       1000 * 60 * 15,
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
      awayP: match.awayP, homeP: match.homeP,
      bestHomeBook: match.bestHomeBook, bestAwayBook: match.bestAwayBook,
      bestHomeOdds: match.bestHomeOdds, bestAwayOdds: match.bestAwayOdds,
      consHomeP: match.consHomeP, consAwayP: match.consAwayP,
      books: match.books, isArb: match.isArb,
      arbPct: match.arbPct, bookCount: match.bookCount,
    };
  });
}

// ── Player search ─────────────────────────────────────────────────
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
          pos:  p.position || "—",
          team: p.team?.abbreviation || "—",
          age: null, per: null, bpm: null, vorp: null,
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
      retryDelay: (attempt, err) =>
        err?.retryAfter ? err.retryAfter * 1000 : Math.min(1000 * 2 ** attempt, 30000),
      throwOnError: false,
    },
  },
};

// ── Targeted cache invalidation for ErrorBoundary ─────────────────
export function invalidateErroredQueries(queryClient) {
  if (!queryClient) return;
  const cache = queryClient.getQueryCache();
  const erroredQueries = cache.getAll().filter(q => q.state.status === "error");
  erroredQueries.forEach(q => {
    queryClient.invalidateQueries({ queryKey: q.queryKey });
  });
}

// ── Bet ID generator ──────────────────────────────────────────────
export function generateBetId() {
  return crypto.randomUUID();
}

// ── Bets Persistence ──────────────────────────────────────────────
// FIX G1: userId is now part of the query key.
//
// Before: queryKey: ["bets"]
// The cache was shared across ALL Clerk sessions in the same browser.
// If user A logs out and user B logs in without a hard reload, React Query
// serves user A's cached bets to user B for the duration of gcTime.
//
// After: queryKey: ["bets", userId]
// Each user gets their own isolated cache slot. Switching users immediately
// produces a cache miss and fetches fresh data for the new session.
// The query is also gated on !!userId so it never fires unauthenticated.
export function useBets() {
  const { getToken } = useAuth();
  const { user }     = useUser();
  const userId       = user?.id ?? null;
  const queryClient  = useQueryClient();

  const query = useQuery({
    // FIX G1: userId scopes the cache entry to this specific Clerk user.
    queryKey: ["bets", userId],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new ApiError("Not authenticated", 401);
      const res = await fetch("/api/bets", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load bets");
      return res.json();
    },
    staleTime: Infinity,
    gcTime:    Infinity,
    // FIX G1: don't run the query at all until we have a userId.
    enabled: !!userId,
    retry: async (count, err) => {
      if (err?.status === 401 && count === 0) {
        try { await getToken({ skipCache: true }); return true; } catch { return false; }
      }
      return false;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (bets) => {
      const token = await getToken();
      if (!token) throw new ApiError("Not authenticated", 401);
      const res = await fetch("/api/bets", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(bets),
      });
      if (!res.ok) throw new Error("Failed to save bets");
    },
    onMutate: async (bets) => {
      await queryClient.cancelQueries({ queryKey: ["bets", userId] });
      const previous = queryClient.getQueryData(["bets", userId]);
      queryClient.setQueryData(["bets", userId], bets);
      return { previous };
    },
    onError: (_err, _bets, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(["bets", userId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["bets", userId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (betId) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      const res = await fetch(`/api/bets/${encodeURIComponent(betId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 404) throw new Error(`Bet '${betId}' not found`);
      if (!res.ok) throw new Error("Failed to delete bet");
      return res.json();
    },
    onMutate: async (betId) => {
      await queryClient.cancelQueries({ queryKey: ["bets", userId] });
      const previous = queryClient.getQueryData(["bets", userId]);
      queryClient.setQueryData(["bets", userId], (old) =>
        Array.isArray(old) ? old.filter(b => b.id !== betId) : old
      );
      return { previous };
    },
    onError: (_err, _betId, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(["bets", userId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["bets", userId] });
    },
  });

  return {
    bets:        query.data ?? [],
    isLoading:   query.isLoading,
    isSaving:    saveMutation.isPending,
    isDeleting:  deleteMutation.isPending,
    saveError:   saveMutation.error?.message  ?? null,
    deleteError: deleteMutation.error?.message ?? null,
    saveBets:    saveMutation.mutateAsync,
    deleteBet:   deleteMutation.mutateAsync,
  };
}
