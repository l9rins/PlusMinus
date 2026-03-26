import { kv } from "../../lib/api/_kv.js";

const BASE = "https://stats.nba.com/stats";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function nbaHeaders() {
  return {
    "User-Agent": randomUA(),
    "Referer": "https://www.nba.com/",
    "Origin": "https://www.nba.com",
    "Accept": "application/json, text/plain, */*",
    "x-nba-stats-origin": "stats",
    "x-nba-stats-token": "true",
  };
}

async function fetchNBA(endpoint, params) {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE}/${endpoint}?${qs}`;
  console.info(`[Sync] Fetching ${endpoint}...`);
  
  const res = await fetch(url, {
    headers: nbaHeaders(),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) throw new Error(`NBA API error ${res.status}`);
  const data = await res.json();
  const cacheKey = `nba:${endpoint}:${qs}`;
  await kv.set(cacheKey, data, { ex: 86400 }); // Store for 24h as a hard backup
  return { endpoint, status: "success" };
}

export default async function handler(req, res) {
  // Simple auth check for cron (optional, but good for Vercel)
  // if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return res.status(401).end();
  // }

  const year = new Date().getFullYear();
  const month = new Date().getMonth();
  // Season logic: if before Oct (9), it's the previous year-current year
  const seasonYear = month < 9 ? year - 1 : year;
  const season = `${seasonYear}-${String(seasonYear + 1).slice(2)}`;

  const tasks = [
    { endpoint: "leaguedashteamstats", params: { Season: season, SeasonType: "Regular Season", PerMode: "PerGame", MeasureType: "Advanced" } },
    { endpoint: "leaguedashteamstats", params: { Season: season, SeasonType: "Regular Season", PerMode: "PerGame", MeasureType: "Four Factors" } },
    { endpoint: "leaguedashplayerstats", params: { Season: season, SeasonType: "Regular Season", PerMode: "PerGame" } },
    { endpoint: "leaguedashplayerstats", params: { Season: season, SeasonType: "Regular Season", PerMode: "PerGame", MeasureType: "Advanced" } },
    { endpoint: "commonallplayers", params: { LeagueID: "00", Season: season, IsOnlyCurrentSeason: "1" } },
    { endpoint: "leaguestandingsv3", params: { LeagueID: "00", Season: season, SeasonType: "Regular Season" } },
  ];

  const results = [];
  for (const task of tasks) {
    try {
      // Small delay between requests to avoid rate limiting
      await new Promise(r => setTimeout(r, 2000));
      const res = await fetchNBA(task.endpoint, task.params);
      results.push(res);
    } catch (err) {
      console.error(`[Sync] Failed ${task.endpoint}:`, err.message);
      results.push({ endpoint: task.endpoint, status: "failed", error: err.message });
    }
  }

  return res.status(200).json({
    message: "NBA Sync completed",
    results,
    timestamp: new Date().toISOString()
  });
}
