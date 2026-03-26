import { handleOptions, setCORSHeaders } from "./_cors.js";
import { kv } from "./_kv.js";

const BASE = "https://stats.nba.com/stats";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
];

function nbaHeaders() {
  return {
    "User-Agent": USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
    "Referer": "https://www.nba.com/",
    "Origin": "https://www.nba.com",
    "Accept": "application/json, text/plain, */*",
    "x-nba-stats-origin": "stats",
    "x-nba-stats-token": "true",
  };
}

const ENDPOINT_PARAMS = {
  leaguedashteamstats: ["Season", "SeasonType", "PerMode", "MeasureType", "PaceAdjust", "PlusMinus", "Rank"],
  leaguedashplayerstats: ["Season", "SeasonType", "PerMode", "MeasureType", "PaceAdjust", "PlusMinus", "Rank"],
  leaguestandingsv3: ["Season", "SeasonType", "LeagueID"],
  commonallplayers: ["LeagueID", "Season", "IsOnlyCurrentSeason"],
  teamgamelog: ["TeamID", "Season", "SeasonType", "LeagueID"],
  playergamelog: ["PlayerID", "Season", "SeasonType", "LeagueID", "LastNGames"],
  teamdashlineups: ["TeamID", "Season", "SeasonType", "PerMode", "MeasureType", "PlusMinus", "GameSegment"],
};

const ALLOWED_ENDPOINTS = Object.keys(ENDPOINT_PARAMS);

async function fetchWithRetry(url, attempt = 0) {
  const timeout = attempt === 0 ? 12000 : 18000;
  const res = await fetch(url, {
    headers: nbaHeaders(),
    signal: AbortSignal.timeout(timeout),
  });
  if ((res.status === 429 || res.status === 503) && attempt === 0) {
    await new Promise((r) => setTimeout(r, 2000));
    return fetchWithRetry(url, 1);
  }
  return res;
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCORSHeaders(res, req.headers.origin || "");

  const endpoint = req.query.endpoint;
  if (!endpoint || !ALLOWED_ENDPOINTS.includes(endpoint)) {
    return res.status(400).json({ error: `Unknown endpoint: ${endpoint}` });
  }

  const allowed = ENDPOINT_PARAMS[endpoint];
  const params = {};
  for (const key of allowed) {
    if (req.query[key] !== undefined) {
      params[key] = Array.isArray(req.query[key]) ? req.query[key][0] : req.query[key];
    }
  }

  const qs = new URLSearchParams(params).toString();
  const cacheKey = `nba:${endpoint}:${qs}`;

  // 1. ALWAYS try KV first. The CRON pre-warms this.
  try {
    const cached = await kv.get(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=600");
      return res.status(200).json(cached);
    }
  } catch (e) {
    console.error("[api/nba] KV read fail:", e.message);
  }

  // 2. Fallback to live fetch (for non-cron'd params)
  const url = `${BASE}/${endpoint}?${qs}`;
  try {
    const upstream = await fetchWithRetry(url);
    if (!upstream.ok) throw new Error(`Status ${upstream.status}`);

    const data = await upstream.json();
    
    // Save to KV for next time
    try {
      await kv.set(cacheKey, data, { ex: 3600 });
    } catch (e) {}

    res.setHeader("X-Cache", "MISS");
    res.setHeader("Cache-Control", "public, s-maxage=1800");
    return res.status(200).json(data);
  } catch (err) {
    console.warn(`[api/nba] Live fetch failed for ${endpoint}:`, err.message);
    return res.status(503).json({ error: "NBA Stats Service Unavailable", message: "Maximum retries reached on Vercel" });
  }
}
