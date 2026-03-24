import { handleOptions, setCORSHeaders } from "./_cors.js";
import { createClient } from "@vercel/kv";
import { EAST_STANDINGS, WEST_STANDINGS } from "../src/data.js";

function makeLCG(seed) {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return () => {
    s = Math.imul(1664525, s) + 1013904223 >>> 0;
    return s / 4294967296;
  };
}

const SIMS = 10_000;
const HOME_BUMP = 35;

function eloWinP(eloA, eloB, home = false) {
  return 1 / (1 + Math.pow(10, -(eloA - eloB + (home ? HOME_BUMP : 0)) / 400));
}

function simGame(eloA, eloB, home, rng) {
  return rng() < eloWinP(eloA, eloB, home);
}

function simSeries(eloA, eloB, rng) {
  let wA = 0, wB = 0, g = 0;
  const home = [true, true, false, false, true, false, true];
  while (wA < 4 && wB < 4) {
    rng() < eloWinP(eloA, eloB, home[g++]) ? wA++ : wB++;
  }
  return wA === 4;
}

const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const NBA_BASE = "https://stats.nba.com/stats";
const NBA_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Referer":    "https://www.nba.com/",
  "Accept":     "application/json",
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

// Max 5 concurrent requests to avoid NBA Stats rate limiting
async function fetchAllGameLogs(teamEntries, season) {
  const CONCURRENCY = 5;
  const results = {};
  
  for (let i = 0; i < teamEntries.length; i += CONCURRENCY) {
    const batch = teamEntries.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(([teamId, abbr]) =>
        fetchTeamGameLog(teamId, season).then(log => ({ abbr, log }))
      )
    );
    batchResults.forEach(({ abbr, log }) => { results[abbr] = log; });
    if (i + CONCURRENCY < teamEntries.length) await sleep(300); // one gap between batches
  }
  return results;
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  const origin = req.headers.origin || "";
  setCORSHeaders(res, origin);

  if (req.method !== "GET") return res.status(405).end();

  const season = currentSeasonStr();
  const CACHE_KEY = `elo:${season}`;
  
  if (req.query.rebuild !== "true") {
    try {
      const cached = await kv.get(CACHE_KEY);
      if (cached) {
        res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=300");
        res.setHeader("Content-Type", "application/json");
        return res.status(200).json(cached);
      }
      return res.status(503).json({ error: "Elo data is computing. Please try again later." });
    } catch (e) {
      console.error("KV cache skip:", e);
      return res.status(503).json({ error: "Storage error" });
    }
  }

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

  const gameLogs = await fetchAllGameLogs(teamEntries, season);

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
    const expHome = winProb(homeElo + HOME_ADV, awayElo);
    const expAway = 1 - expHome;

    if (game.homeWon) {
      eloMap[game.home] = +(homeElo + K * (1 - expHome)).toFixed(2);
      eloMap[game.away] = +(awayElo + K * (0 - expAway)).toFixed(2);
    } else {
      eloMap[game.home] = +(homeElo + K * (0 - expHome)).toFixed(2);
      eloMap[game.away] = +(awayElo + K * (1 - expAway)).toFixed(2);
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
    finalsPct:  0,
    champPct:   0,
  })).sort((a, b) => b.elo - a.elo);

  const stringToHash = JSON.stringify(EAST_STANDINGS) + JSON.stringify(WEST_STANDINGS);
  let hash = 0;
  for (let i = 0; i < stringToHash.length; i++) hash = Math.imul(31, hash) + stringToHash.charCodeAt(i) | 0;

  const safeEloData = result;

  const buildSeeds = conf => conf.slice(0, 10).map((t, i) => {
    const ed = safeEloData.find(x => x.team === t.team);
    return {
      team:  t.team,
      elo:   ed?.elo ?? Math.round(1500 + (t.pct - 0.5) * 400),
    };
  });

  const eastSeeds = buildSeeds(EAST_STANDINGS);
  const westSeeds = buildSeeds(WEST_STANDINGS);
  const counts = {};
  [...eastSeeds, ...westSeeds].forEach(t => { counts[t.team] = { pi: 0, r1: 0, r2: 0, conf: 0, finals: 0, champ: 0 }; });

  function simPlayIn(seeds, rng) {
    const [s7, s8, s9, s10] = seeds.slice(6, 10);
    [s7, s8, s9, s10].forEach(t => counts[t.team].pi++);
    const seed7   = simGame(s7.elo, s8.elo, true, rng)        ? s7 : s8;
    const loser78 = seed7 === s7 ? s8 : s7;
    const w910    = simGame(s9.elo, s10.elo, true, rng)        ? s9 : s10;
    const seed8   = simGame(loser78.elo, w910.elo, true, rng)  ? loser78 : w910;
    return [seed7, seed8];
  }

  function simConf(seeds, rng) {
    const direct = seeds.slice(0, 6);
    const [pi7, pi8] = simPlayIn(seeds, rng);
    const bracket = [...direct, pi7, pi8];
    bracket.forEach(t => counts[t.team].r1++);
    const r2 = [[0, 7], [3, 4], [2, 5], [1, 6]].map(([a, b]) =>
      simSeries(bracket[a].elo, bracket[b].elo, rng) ? bracket[a] : bracket[b]
    );
    r2.forEach(t => counts[t.team].r2++);
    const cf = [
      simSeries(r2[0].elo, r2[1].elo, rng) ? r2[0] : r2[1],
      simSeries(r2[2].elo, r2[3].elo, rng) ? r2[2] : r2[3],
    ];
    cf.forEach(t => counts[t.team].conf++);
    return simSeries(cf[0].elo, cf[1].elo, rng) ? cf[0] : cf[1];
  }

  const rng = makeLCG(hash);

  for (let i = 0; i < SIMS; i++) {
    const eC = simConf(eastSeeds, rng);
    const wC = simConf(westSeeds, rng);
    counts[eC.team].finals++;
    counts[wC.team].finals++;
    const champ = simSeries(eC.elo, wC.elo, rng) ? eC : wC;
    counts[champ.team].champ++;
  }

  result.forEach(t => {
    const c = counts[t.team];
    if (c) {
      t.playInPct = +(c.pi     / SIMS * 100).toFixed(1);
      t.r1Pct     = +(c.r1     / SIMS * 100).toFixed(1);
      t.r2Pct     = +(c.r2     / SIMS * 100).toFixed(1);
      t.confPct   = +(c.conf   / SIMS * 100).toFixed(1);
      t.finalsPct = +(c.finals / SIMS * 100).toFixed(1);
      t.champPct  = +(c.champ  / SIMS * 100).toFixed(1);
    }
  });

  // In the final result build, add a teamsWithData count:
  const teamsWithData = Object.values(gameLogs).filter(log => log.length > 0).length;

  const responsePayload = {
    season,
    teams: result,
    computedAt: new Date().toISOString(),
    teamsWithData,          // client can show a warning if < 30
    partial: teamsWithData < 30,
  };

  try {
    const CACHE_KEY = `elo:${season}`;
    await kv.set(CACHE_KEY, responsePayload, { ex: 3600 }); // 1hr TTL
  } catch (e) {
    console.error("KV cache skip:", e);
  }

  // Cache for 1 hour at the edge — recomputes at most 24 times per day
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=300");
  res.setHeader("Content-Type", "application/json");
  return res.status(200).json(responsePayload);
}
