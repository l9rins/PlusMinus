import { handleOptions, setCORSHeaders } from "./_cors.js";
import { kv } from "./_kv.js";

const BASE = "https://stats.nba.com/stats";

// Rotate User-Agent strings to reduce IP-based blocking by NBA.com
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
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "x-nba-stats-origin": "stats",
    "x-nba-stats-token": "true",
    "Connection": "keep-alive",
  };
}

const ENDPOINT_PARAMS = {
  leaguedashteamstats: ["Season", "SeasonType", "PerMode", "MeasureType", "PaceAdjust", "PlusMinus", "Rank"],
  leaguedashplayerstats: ["Season", "SeasonType", "PerMode", "MeasureType", "PaceAdjust", "PlusMinus", "Rank"],
  leaguedashteamclutch: ["Season", "SeasonType", "PerMode", "MeasureType"],
  teamdashboardbygeneralsplits: ["TeamID", "Season", "SeasonType", "PerMode", "MeasureType"],
  playerdashboardbyyearoveryear: ["PlayerID", "Season", "SeasonType", "PerMode", "MeasureType"],
  leaguestandingsv3: ["Season", "SeasonType", "LeagueID"],
  commonallplayers: ["LeagueID", "Season", "IsOnlyCurrentSeason"],
  teamgamelog: ["TeamID", "Season", "SeasonType", "LeagueID"],
  playergamelog: ["PlayerID", "Season", "SeasonType", "LeagueID", "LastNGames"],
  teamdashlineups: ["TeamID", "Season", "SeasonType", "PerMode", "MeasureType", "PlusMinus", "GameSegment"],
};

const ALLOWED_ENDPOINTS = Object.keys(ENDPOINT_PARAMS);

function cacheTTL(endpoint) {
  if (endpoint === "playergamelog") return 1800;
  if (endpoint.includes("dashboard")) return 600;
  return 1800;
}

// Retry fetch once with a fresh User-Agent and a longer timeout
async function fetchWithRetry(url, attempt = 0) {
  const timeout = attempt === 0 ? 12000 : 18000; // 12s first try, 18s retry
  const res = await fetch(url, {
    headers: nbaHeaders(),
    signal: AbortSignal.timeout(timeout),
  });
  if ((res.status === 429 || res.status === 503) && attempt === 0) {
    // Brief back-off before retry
    await new Promise((r) => setTimeout(r, 1500));
    return fetchWithRetry(url, 1);
  }
  return res;
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  const origin = req.headers.origin || "";
  setCORSHeaders(res, origin);
  if (req.method !== "GET") return res.status(405).end();

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
  const url = `${BASE}/${endpoint}?${qs}`;
  const cacheKey = `nba:${endpoint}:${qs}`;

  // Serve stale cache on upstream failure
  let cachedValue = null;
  try {
    cachedValue = await kv.get(cacheKey);
    if (cachedValue) {
      const ttl = cacheTTL(endpoint);
      res.setHeader("Cache-Control", `s-maxage=${ttl}, stale-while-revalidate=60`);
      res.setHeader("Content-Type", "application/json");
      return res.status(200).json(cachedValue);
    }
  } catch (e) {
    console.error("KV cache skip:", e);
  }

  try {
    const upstream = await fetchWithRetry(url);

    if (!upstream.ok) {
      // If we have stale cache, return it with a warning header rather than failing hard
      if (cachedValue) {
        res.setHeader("X-Cache-Stale", "true");
        res.setHeader("Content-Type", "application/json");
        return res.status(200).json(cachedValue);
      }
      return res.status(upstream.status).json({ error: `NBA Stats upstream ${upstream.status}` });
    }

    const data = await upstream.json();
    const ttl = cacheTTL(endpoint);

    try {
      await kv.set(cacheKey, data, { ex: 21600 });
    } catch (e) {
      console.error("KV cache set fail:", e);
    }

    res.setHeader("Cache-Control", `s-maxage=${ttl}, stale-while-revalidate=60`);
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json(data);
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      // Return stale data if available rather than a hard 503
      if (cachedValue) {
        res.setHeader("X-Cache-Stale", "true");
        res.setHeader("Content-Type", "application/json");
        return res.status(200).json(cachedValue);
      }
      return res.status(503).json({ error: "NBA Stats timed out after retry" });
    }
    console.error("[api/nba]", err.message);
    return res.status(502).json({ error: "NBA Stats fetch failed", message: err.message });
  }
}
