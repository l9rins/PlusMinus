// ─── PlusMinus API Layer ──────────────────────────────────────────
// Data sources:
//   Standings      → ESPN free API via /api/espn  (no key)
//   Games          → ESPN free API via /api/espn  (no key)
//   Team schedule  → ESPN free API via /api/espn  (no key)
//   Odds           → The Odds API via /api/odds   (ODDS_API_KEY)
//   Players        → NBA Stats API via /api/nba   (no key)
//   Search         → BDL /players endpoint        (BDL_API_KEY, free tier)
//   Bets           → Vercel KV via /api/bets      (Clerk JWT auth)
//   Elo            → /api/elo                     (server-side, 1hr cache)
import { useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
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

// Real team stats — eFG%, TOV%, ORB%, FT Rate, NetRtg, OffRtg, DefRtg
export function useLeagueTeamStats() {
  return useQuery({
    queryKey: ["nba", "leagueTeamStats", currentSeason()],
    queryFn: async ({ signal }) => {
      const data = await nbaFetch("leaguedashteamstats", {
        Season: `${currentSeason() - 1}-${String(currentSeason()).slice(2)}`,
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

// Real player stats — PTS, AST, REB, TS%, PER, BPM etc.
export function useLeaguePlayerStats() {
  return useQuery({
    queryKey: ["nba", "leaguePlayerStats", currentSeason()],
    queryFn: async ({ signal }) => {
      const data = await nbaFetch("leaguedashplayerstats", {
        Season: `${currentSeason() - 1}-${String(currentSeason()).slice(2)}`,
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
    queryKey: ["nba", "leaguePlayerStatsAdvanced", currentSeason()],
    queryFn: async ({ signal }) => {
      const data = await nbaFetch("leaguedashplayerstats", {
        Season: `${currentSeason() - 1}-${String(currentSeason()).slice(2)}`,
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
    queryKey: ["nba", "commonAllPlayers", currentSeason()],
    queryFn: async ({ signal }) => {
      const data = await nbaFetch("commonallplayers", {
        LeagueID: "00",
        Season: `${currentSeason() - 1}-${String(currentSeason()).slice(2)}`,
        IsOnlyCurrentSeason: "1",
      }, signal);
      return data;
    },
    staleTime: 1000 * 60 * 60,
    placeholderData: null,
    retry: shouldRetry,
  });
}

export function useEnrichedPlayerStats() {
  const base = useLeaguePlayerStats();
  const advanced = useLeaguePlayerStatsAdvanced();
  const allPlayers = useAllPlayers();

  const data = useMemo(() => {
    if (!base.data) return null;

    const baseRows = reshapeNBAStats(base.data, "LeagueDashPlayerStats")
      .filter(r => r.GP >= 10);

    const advMap = {};
    if (advanced.data) {
      reshapeNBAStats(advanced.data, "LeagueDashPlayerStats").forEach(r => {
        advMap[r.PLAYER_ID] = r;
      });
    }

    const posMap = {};
    if (allPlayers.data) {
      reshapeNBAStats(allPlayers.data, "CommonAllPlayers").forEach(r => {
        posMap[r.PERSON_ID] = r.POSITION ?? "—";
      });
    }

    return baseRows.map(r => {
      const adv = advMap[r.PLAYER_ID] ?? {};
      return {
        id: r.PLAYER_ID,
        name: r.PLAYER_NAME,
        pos: posMap[r.PLAYER_ID] ?? "—",
        team: r.TEAM_ABBREVIATION,
        age: r.AGE,
        pts: +r.PTS.toFixed(1),
        ast: +r.AST.toFixed(1),
        reb: +r.REB.toFixed(1),
        ts: r.TS_PCT != null ? +(r.TS_PCT * 100).toFixed(1) : null,
        per: adv.PIE != null ? +adv.PIE.toFixed(1) : null,
        ortg: adv.OFF_RATING != null ? +adv.OFF_RATING.toFixed(1) : null,
        drtg: adv.DEF_RATING != null ? +adv.DEF_RATING.toFixed(1) : null,
        usg: adv.USG_PCT != null ? +(adv.USG_PCT * 100).toFixed(1) : null,
        bpm: null,
        vorp: null,
        form: null,
      };
    });
  }, [base.data, advanced.data, allPlayers.data]);

  return {
    data,
    isLoading: base.isLoading || advanced.isLoading || allPlayers.isLoading,
    isError: base.isError,
    isFetching: base.isFetching || advanced.isFetching || allPlayers.isFetching,
    dataUpdatedAt: base.dataUpdatedAt,
    refetch: base.refetch,
  };
}

export function useEloData() {
  return useQuery({
    queryKey: ["elo", currentSeason()],
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
    queryKey: ["nba", "playerGameLog", playerId, currentSeason()],
    queryFn: async ({ signal }) => {
      const data = await nbaFetch("playergamelog", {
        PlayerID: playerId,
        Season: `${currentSeason() - 1}-${String(currentSeason()).slice(2)}`,
        SeasonType: "Regular Season",
        LeagueID: "00",
      }, signal);

      const resultSet = data?.resultSets?.[0];
      if (!resultSet) return [];
      const headers = resultSet.headers;
      const rows = resultSet.rowSet;

      const wlIdx = headers.indexOf("WL");
      if (wlIdx === -1) return [];

      return rows
        .slice(0, 5)
        .map(row => row[wlIdx])
        .reverse();
    },
    staleTime: 1000 * 60 * 30,
    enabled: enabled && !!playerId,
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
      awayP: null,
      homeP: null,
      time, status, awayScore, homeScore, period,
      spread: "—", total: "—",
    };
  });
}

// ── FIX: refetchInterval gated on live game count ─────────────────
// Previously refetchInterval was hardcoded to 60s regardless of whether
// any games were actually in progress. On off-nights (no live games) this
// hammered ESPN's endpoint once a minute for nothing.
//
// New behaviour:
//   • Any live game in progress  → poll every 30s (score updates matter)
//   • Games today but none live  → poll every 2 min (tip-off timing)
//   • No games today / data      → poll every 10 min (just checking)
//
// The refetchInterval callback receives the latest cached data so we can
// inspect game statuses without an extra query. React Query calls it after
// each successful fetch and uses the returned interval for the next tick.
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
      const games = query.state.data;
      if (!Array.isArray(games) || games.length === 0) return 1000 * 60 * 10; // 10 min — no games
      const liveCount = games.filter(g => g.status === "live").length;
      if (liveCount > 0) return 1000 * 30;       // 30s  — games in progress
      return 1000 * 60 * 2;                       // 2min — games today, none live yet
    },
    placeholderData: GAMES_FALLBACK,
    retry: shouldRetry,
  });
}

// ── Team Schedule (ESPN) ──────────────────────────────────────────
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
    staleTime: 1000 * 60 * 15,
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

// ── Bets Persistence ──────────────────────────────────────────────
//
// Three operations exposed from useBets:
//
//   saveBets(bets[])   — PUT /api/bets       — replace the full array
//                        Used when adding a new bet or editing an existing one.
//                        The caller builds the new array and passes it in.
//
//   deleteBet(id)      — DELETE /api/bets/:id — remove a single bet server-side
//                        Atomic: server reads, filters, writes in one handler.
//                        Does NOT require the caller to manage the array.
//
// ID generation:
//   IDs are created client-side with crypto.randomUUID() (see generateBetId below).
//   This is exported so BetTracker can call it when constructing a new bet object
//   before passing it to saveBets. The server validates that id is a non-empty
//   string but does not care about format.

/** Generate a collision-resistant bet ID (client-side). */
export function generateBetId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `bet_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function useBets() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  // ── Fetch ───────────────────────────────────────────────────────
  const query = useQuery({
    queryKey: ["bets"],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      const res = await fetch("/api/bets", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load bets");
      return res.json();
    },
    staleTime: Infinity,
  });

  // ── PUT — replace full array ────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (bets) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bets"] });
    },
  });

  // ── DELETE — remove single bet by ID ───────────────────────────
  // Optimistic update: immediately remove the bet from the local cache
  // so the UI responds instantly, then sync with the server. On error,
  // roll back to the previous state so no data is silently lost.
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

    // Optimistically remove from cache before the server responds
    onMutate: async (betId) => {
      // Cancel any in-flight fetches for this key so they don't overwrite us
      await queryClient.cancelQueries({ queryKey: ["bets"] });

      // Snapshot the current value for rollback
      const previous = queryClient.getQueryData(["bets"]);

      // Optimistically update
      queryClient.setQueryData(["bets"], (old) =>
        Array.isArray(old) ? old.filter(b => b.id !== betId) : old
      );

      return { previous };
    },

    // On error, roll back to the snapshot
    onError: (_err, _betId, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(["bets"], context.previous);
      }
    },

    // Always re-sync with server after settle (success or error)
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["bets"] });
    },
  });

  return {
    bets: query.data ?? [],
    isLoading: query.isLoading,
    isSaving: saveMutation.isPending,
    isDeleting: deleteMutation.isPending,
    saveError: saveMutation.error?.message ?? null,
    deleteError: deleteMutation.error?.message ?? null,
    saveBets: saveMutation.mutateAsync,
    deleteBet: deleteMutation.mutateAsync,  // deleteBet(id: string) → Promise
  };
}