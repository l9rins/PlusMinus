import { handleOptions, setCORSHeaders } from "./_cors.js";

const NBA_BASE = "https://stats.nba.com/stats";
const NBA_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; PlusMinus/1.0)",
  "Referer":    "https://www.nba.com/",
  "Accept":     "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  "Origin":     "https://www.nba.com",
};

// All 30 NBA team IDs → abbreviation mapping
const TEAM_IDS = {
  1610612737: "ATL", 1610612738: "BOS", 1610612739: "CLE",
  1610612740: "NOP", 1610612741: "CHI", 1610612742: "DAL",
  1610612743: "DEN", 1610612744: "GSW", 1610612745: "HOU",
  1610612746: "LAC", 1610612747: "LAL", 1610612748: "MIA",
  1610612749: "MIL", 1610612750: "MIN", 1610612751: "BKN",
  1610612752: "NYK", 1610612753: "ORL", 1610612754: "IND",
  1610612755: "PHI", 1610612756: "PHX", 1610612757: "POR",
  1610612758: "SAC", 1610612759: "SAS", 1610612760: "OKC",
  1610612761: "TOR", 1610612762: "UTA", 1610612763: "MEM",
  1610612764: "WAS", 1610612765: "DET", 1610612766: "CHA",
};

// Derive current season string e.g. "2024-25"
function currentSeasonStr() {
  const now = new Date();
  const year = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${String(year + 1).slice(2)}`;
}

// Elo helpers — K=20, home court = +100 points advantage
const K = 20;
const HOME_ADV = 100;

function winProb(eloA, eloB) {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

function updateElo(winnerElo, loserElo) {
  const exp = winProb(winnerElo, loserElo);
  return {
    winner: +(winnerElo + K * (1 - exp)).toFixed(2),
    loser:  +(loserElo  + K * (0 - (1 - exp))).toFixed(2),
  };
}

// Fetch one team's game log — returns array of { date, wl, isHome }
async function fetchTeamGameLog(teamId, season, attempt = 0) {
  const MAX_ATTEMPTS = 3;
  const qs = new URLSearchParams({
    TeamID:     teamId,
    Season:     season,
    SeasonType: "Regular Season",
    LeagueID:   "00",
  });
  const url = `${NBA_BASE}/teamgamelog?${qs}`;

  try {
    const res = await fetch(url, {
      headers: NBA_HEADERS,
      signal: AbortSignal.timeout(8000),
    });

    // 429 rate limit — back off and retry
    if (res.status === 429) {
      if (attempt >= MAX_ATTEMPTS) return [];
      const retryAfter = parseInt(res.headers.get("Retry-After") || "5", 10);
      await sleep(retryAfter * 1000);
      return fetchTeamGameLog(teamId, season, attempt + 1);
    }

    // Other non-ok responses — don't retry, return empty
    if (!res.ok) return [];

    const data = await res.json();
    const resultSet = data?.resultSets?.[0];
    if (!resultSet) return [];
    const headers = resultSet.headers;
    const rows    = resultSet.rowSet;

    const dateIdx    = headers.indexOf("GAME_DATE");
    const wlIdx      = headers.indexOf("WL");
    const matchupIdx = headers.indexOf("MATCHUP");

    return rows.map(row => {
      const matchup    = row[matchupIdx] ?? "";
      const parts      = matchup.split(/\s+/);
      const opponentRaw = parts[parts.length - 1];
      const ABBR_FIX   = { SA: "SAS", WSH: "WAS", NY: "NYK", GS: "GSW", NO: "NOP", PHO: "PHX" };
      const opponent   = ABBR_FIX[opponentRaw] ?? opponentRaw;
      return {
        date:     row[dateIdx],
        wl:       row[wlIdx],
        isHome:   !matchup.includes("@"),
        opponent,
      };
    }).reverse();

  } catch (err) {
    // Timeout or network error — retry with backoff
    if (attempt >= MAX_ATTEMPTS) return [];
    const backoff = Math.pow(2, attempt) * 500; // 500ms, 1s, 2s
    await sleep(backoff);
    return fetchTeamGameLog(teamId, season, attempt + 1);
  }
}

// Small delay to avoid hammering stats.nba.com
const sleep = ms => new Promise(r => setTimeout(r, ms));

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  const origin = req.headers.origin || "";
  setCORSHeaders(res, origin);

  if (req.method !== "GET") return res.status(405).end();

  const season = currentSeasonStr();
  const teamEntries = Object.entries(TEAM_IDS); // 30 teams

  // Initialize all Elo ratings at 1500
  const eloMap = {};
  const trajectories = {};
  const gameCounters = {};

  for (const [, abbr] of teamEntries) {
    eloMap[abbr]      = 1500;
    trajectories[abbr] = [];
    gameCounters[abbr] = 0;
  }

  // Fetch all 30 game logs sequentially with 150ms gap to avoid rate limiting
  // Total time: ~30 × 150ms = 4.5s worst case, well under Vercel's 10s function timeout
  // In practice logs are cached at the edge for 1 hour so this only runs ~24 times/day
  const gameLogs = {};
  for (const [teamId, abbr] of teamEntries) {
    gameLogs[abbr] = await fetchTeamGameLog(teamId, season);
    // 200ms between teams — gives rate limiter room to breathe
    await sleep(200);
  }

  // Build a unified chronological game list for proper Elo update ordering.
  // Each entry: { date, homeAbbr, awayAbbr, homeWon }
  // We derive this by cross-referencing each team's log — a game appears
  // in BOTH teams' logs, so we deduplicate by (date, homeAbbr, awayAbbr).
  const allGames = [];
  const seen = new Set();

  for (const [abbr, log] of Object.entries(gameLogs)) {
    for (const g of log) {
      if (!g.isHome) continue; // only process from home team's perspective to avoid duplicates
      const key = `${g.date}|${abbr}|${g.opponent}`;
      if (seen.has(key)) continue;
      seen.add(key);
      allGames.push({
        date:    g.date,
        home:    abbr,
        away:    g.opponent,
        homeWon: g.wl === "W",
      });
    }
  }

  allGames.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Process games in order — update Elo after each result
  for (const game of allGames) {
    const homeElo = eloMap[game.home] ?? 1500;
    const awayElo = eloMap[game.away] ?? 1500;

    // Apply home court advantage to win probability only
    const homeEloAdj = homeElo + HOME_ADV;
    const { winner: newWinner, loser: newLoser } = updateElo(
      game.homeWon ? homeEloAdj : awayElo,
      game.homeWon ? awayElo    : homeEloAdj,
    );

    if (game.homeWon) {
      eloMap[game.home] = newWinner;
      eloMap[game.away] = newLoser;
    } else {
      eloMap[game.away] = newWinner;
      eloMap[game.home] = newLoser;
    }

    // Record trajectory point for both teams
    gameCounters[game.home] = (gameCounters[game.home] || 0) + 1;
    gameCounters[game.away] = (gameCounters[game.away] || 0) + 1;
    trajectories[game.home].push({ game: gameCounters[game.home], elo: eloMap[game.home], date: game.date });
    trajectories[game.away].push({ game: gameCounters[game.away], elo: eloMap[game.away], date: game.date });
  }

  // Build final response — one entry per team
  const result = Object.entries(TEAM_IDS).map(([, abbr]) => ({
    team:       abbr,
    elo:        Math.round(eloMap[abbr] ?? 1500),
    games:      gameCounters[abbr] ?? 0,
    trajectory: trajectories[abbr] ?? [],
  })).sort((a, b) => b.elo - a.elo);

  // In the final result build, add a teamsWithData count:
  const teamsWithData = Object.values(gameLogs).filter(log => log.length > 0).length;

  // Cache for 1 hour at the edge — recomputes at most 24 times per day
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=300");
  res.setHeader("Content-Type", "application/json");
  return res.status(200).json({
    season,
    teams: result,
    computedAt: new Date().toISOString(),
    teamsWithData,          // client can show a warning if < 30
    partial: teamsWithData < 30,
  });
}
