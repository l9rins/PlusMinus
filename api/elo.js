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

function simSeries(teamA, teamB, rng) {
  let wA = 0, wB = 0, g = 0;
  // Compare seeds. If they are from different conferences (Finals), compare win pct.
  const aHasHome = teamA.seed < teamB.seed || (teamA.seed === teamB.seed && teamA.pct > teamB.pct);
  
  const homeElo = aHasHome ? teamA.elo : teamB.elo;
  const awayElo = aHasHome ? teamB.elo : teamA.elo;
  const homeSchedule = [true, true, false, false, true, false, true];

  while (wA < 4 && wB < 4) {
    const homeWin = rng() < eloWinP(homeElo, awayElo, homeSchedule[g++]);
    if (aHasHome) {
      homeWin ? wA++ : wB++;
    } else {
      homeWin ? wB++ : wA++;
    }
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

const ABBR_FIX = { SA: "SAS", WSH: "WAS", NY: "NYK", GS: "GSW", NO: "NOP", PHO: "PHX" };

// Derive current season string e.g. "2024-25"
function currentSeasonStr() {
  const now = new Date();
  const year = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${String(year + 1).slice(2)}`;
}

// Elo helpers — K=20, home court = +100 points advantage
const K = 20;
const HOME_ADV = 35;

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

async function fetchAllGamesViaLeagueLog(season) {
  const qs = new URLSearchParams({
    Season:     season,
    SeasonType: "Regular Season",
    LeagueID:   "00",
    Direction:  "ASC",
    Sorter:     "DATE",
  });
  const url = `${NBA_BASE}/leaguegamelog?${qs}`;

  const res = await fetch(url, {
    headers: NBA_HEADERS,
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return [];

  const data = await res.json();
  const resultSet = data?.resultSets?.[0];
  if (!resultSet) return [];

  const h = resultSet.headers;
  const rows = resultSet.rowSet;
  const abbrIdx    = h.indexOf("TEAM_ABBREVIATION");
  const dateIdx    = h.indexOf("GAME_DATE");
  const matchupIdx = h.indexOf("MATCHUP");
  const wlIdx      = h.indexOf("WL");

  // Each row is one team's side of a game. Collect home-team rows only
  // (MATCHUP contains "vs." for home, "@" for away).
  const games = [];
  const seen  = new Set();

  for (const row of rows) {
    const matchup = row[matchupIdx] ?? "";
    if (!matchup.includes("vs.")) continue; // away side — skip

    const rawAbbr = row[abbrIdx];
    const homeAbbr = ABBR_FIX[rawAbbr] ?? rawAbbr;

    // Opponent is the last token in "BOS vs. MIA" → "MIA"
    const parts    = matchup.split(/\s+/);
    const rawOpp   = parts[parts.length - 1];
    const awayAbbr = ABBR_FIX[rawOpp] ?? rawOpp;

    const date = row[dateIdx];
    const key  = `${date}|${homeAbbr}|${awayAbbr}`;
    if (seen.has(key)) continue;
    seen.add(key);

    games.push({
      date,
      home:    homeAbbr,
      away:    awayAbbr,
      homeWon: row[wlIdx] === "W",
    });
  }

  return games;
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

  // Get all 30 teams from a single API call
  const allGames = await fetchAllGamesViaLeagueLog(season);

  // FIX: Circuit breaker to prevent poisoning the KV cache
  if (!allGames || allGames.length === 0) {
    console.error("[api/elo] NBA API returned no games. Aborting rebuild to preserve cache.");
    return res.status(502).json({ error: "Upstream NBA API failure. Cache preserved." });
  }

  // Collect unique team abbreviations from the game log
  const allTeams = new Set();
  for (const g of allGames) { allTeams.add(g.home); allTeams.add(g.away); }

  const eloMap = {};
  const trajectories = {};
  const gameCounters = {};
  
  for (const abbr of allTeams) {
    eloMap[abbr]       = 1500;
    trajectories[abbr] = [];
    gameCounters[abbr] = 0;
  }

  allGames.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Process games in order — update Elo after each result
  for (const game of allGames) {
    const homeElo = eloMap[game.home] ?? 1500;
    const awayElo = eloMap[game.away] ?? 1500;

    // Apply home court advantage to win probability only
    const homeWinP = winProb(homeElo + HOME_ADV, awayElo);
    const newHomeElo = +(homeElo + K * ((game.homeWon ? 1 : 0) - homeWinP)).toFixed(2);
    const newAwayElo = +(awayElo + K * ((game.homeWon ? 0 : 1) - (1 - homeWinP))).toFixed(2);
    
    eloMap[game.home] = newHomeElo;
    eloMap[game.away] = newAwayElo;

    // Record trajectory point for both teams
    gameCounters[game.home] = (gameCounters[game.home] || 0) + 1;
    gameCounters[game.away] = (gameCounters[game.away] || 0) + 1;
    trajectories[game.home].push({ game: gameCounters[game.home], elo: eloMap[game.home], date: game.date });
    trajectories[game.away].push({ game: gameCounters[game.away], elo: eloMap[game.away], date: game.date });
  }

  // Build final response — one entry per team
  const result = [...allTeams].map((abbr) => ({
    team:       abbr,
    elo:        Math.round(eloMap[abbr] ?? 1500),
    games:      gameCounters[abbr] ?? 0,
    trajectory: trajectories[abbr] ?? [],
    finalsPct:  0,
    champPct:   0,
  })).sort((a, b) => b.elo - a.elo);

  const wl = {};
  for (const g of allGames) {
    wl[g.home] = wl[g.home] ?? { w: 0, l: 0 };
    wl[g.away] = wl[g.away] ?? { w: 0, l: 0 };
    if (g.homeWon) {
      wl[g.home].w++;
      wl[g.away].l++;
    } else {
      wl[g.home].l++;
      wl[g.away].w++;
    }
  }

  const getRecord = (abbr) => {
    const r = wl[abbr] ?? { w: 0, l: 0 };
    return { ...r, pct: (r.w + r.l) > 0 ? r.w / (r.w + r.l) : 0 };
  };

  const eastTeams = EAST_STANDINGS.map(t => ({ team: t.team, ...getRecord(t.team) })).sort((a, b) => b.pct - a.pct);
  const westTeams = WEST_STANDINGS.map(t => ({ team: t.team, ...getRecord(t.team) })).sort((a, b) => b.pct - a.pct);

  const stringToHash = JSON.stringify(eastTeams) + JSON.stringify(westTeams);
  let hash = 0;
  for (let i = 0; i < stringToHash.length; i++) hash = Math.imul(31, hash) + stringToHash.charCodeAt(i) | 0;

  const safeEloData = result;

  const buildSeeds = conf => conf.slice(0, 10).map((t, i) => {
    const ed = safeEloData.find(x => x.team === t.team);
    return {
      team:  t.team,
      elo:   ed?.elo ?? Math.round(1500 + (t.pct - 0.5) * 400),
      seed:  i + 1,
      pct:   t.pct,
    };
  });

  const eastSeeds = buildSeeds(eastTeams);
  const westSeeds = buildSeeds(westTeams);
  const counts = {};
  [...eastSeeds, ...westSeeds].forEach(t => { counts[t.team] = { pi: 0, r1: 0, r2: 0, conf: 0, finals: 0, champ: 0 }; });

  function simPlayIn(seeds, rng) {
    const [s7, s8, s9, s10] = seeds.slice(6, 10);
    [s7, s8, s9, s10].forEach(t => counts[t.team].pi++);
    const seed7   = simGame(s7.elo, s8.elo, true, rng)        ? s7 : s8;
    const loser78 = seed7 === s7 ? s8 : s7;
    const w910    = simGame(s9.elo, s10.elo, true, rng)        ? s9 : s10;
    const seed8   = simGame(loser78.elo, w910.elo, true, rng)  ? loser78 : w910;
    // Wrap to avoid mutating seed across sims
    return [{ ...seed7, seed: 7 }, { ...seed8, seed: 8 }];
  }

  function simConf(seeds, rng) {
    const direct = seeds.slice(0, 6);
    const [pi7, pi8] = simPlayIn(seeds, rng);
    const bracket = [...direct, pi7, pi8];
    bracket.forEach(t => counts[t.team].r1++);
    const r2 = [[0, 7], [3, 4], [2, 5], [1, 6]].map(([a, b]) =>
      simSeries(bracket[a], bracket[b], rng) ? bracket[a] : bracket[b]
    );
    r2.forEach(t => counts[t.team].r2++);
    const cf = [
      simSeries(r2[0], r2[1], rng) ? r2[0] : r2[1],
      simSeries(r2[2], r2[3], rng) ? r2[2] : r2[3],
    ];
    cf.forEach(t => counts[t.team].conf++);
    return simSeries(cf[0], cf[1], rng) ? cf[0] : cf[1];
  }

  const rng = makeLCG(hash);

  for (let i = 0; i < SIMS; i++) {
    const eC = simConf(eastSeeds, rng);
    const wC = simConf(westSeeds, rng);
    counts[eC.team].finals++;
    counts[wC.team].finals++;
    const champ = simSeries(eC, wC, rng) ? eC : wC;
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
  const teamsWithData = allTeams.size;

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
