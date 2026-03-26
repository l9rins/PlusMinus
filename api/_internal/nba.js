import { handleOptions, setCORSHeaders } from "../_cors.js";
import { kv } from "../_kv.js";

const BASE = "https://stats.nba.com/stats";

const NBA_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Referer": "https://www.nba.com/",
  "Accept": "application/json",
};

// ── SECURITY FIX: per-endpoint parameter whitelists ───────────────
// Previously: const params = { ...req.query }; delete params.endpoint;
// That forwarded ALL query params to the upstream NBA API unchanged.
// A malicious client could append ?cachebuster=1, cachebuster=2, etc.
// making every request a unique URL — bypassing Vercel's edge cache,
// executing the serverless function on every call, and burning both
// Vercel compute budget and NBA Stats rate-limit quota.
//
// Fix: each endpoint declares exactly which params it accepts.
// Anything not in the whitelist is silently dropped before the upstream
// URL is constructed, so the cache key is always deterministic.
//
// Param values are passed through as-is (NBA Stats API validates them).
// We only control *which* params reach the upstream, not their values.

const ENDPOINT_PARAMS = {
  leaguedashteamstats: [
    "Season", "SeasonType", "PerMode", "MeasureType",
    "PaceAdjust", "PlusMinus", "Rank",
  ],
  leaguedashplayerstats: [
    "Season", "SeasonType", "PerMode", "MeasureType",
    "PaceAdjust", "PlusMinus", "Rank",
  ],
  leaguedashteamclutch: [
    "Season", "SeasonType", "PerMode", "MeasureType",
  ],
  teamdashboardbygeneralsplits: [
    "TeamID", "Season", "SeasonType", "PerMode", "MeasureType",
  ],
  playerdashboardbyyearoveryear: [
    "PlayerID", "Season", "SeasonType", "PerMode", "MeasureType",
  ],
  leaguestandingsv3: [
    "Season", "SeasonType", "LeagueID",
  ],
  commonallplayers: [
    "LeagueID", "Season", "IsOnlyCurrentSeason",
  ],
  teamgamelog: [
    "TeamID", "Season", "SeasonType", "LeagueID",
  ],
  playergamelog: [
    "PlayerID", "Season", "SeasonType", "LeagueID",
  ],
  teamdashlineups: [
    "TeamID", "Season", "SeasonType", "PerMode",
    "MeasureType", "PlusMinus", "GameSegment",
  ],
};

const ALLOWED_ENDPOINTS = Object.keys(ENDPOINT_PARAMS);

function cacheTTL(endpoint) {
  if (endpoint === "playergamelog") return 1800;
  if (endpoint.includes("dashboard")) return 600;
  return 1800;
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

  // Build params from whitelist only — drop everything else
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

  try {
    const cached = await kv.get(cacheKey);
    if (cached) {
      const ttl = cacheTTL(endpoint);
      res.setHeader("Cache-Control", `s-maxage=${ttl}, stale-while-revalidate=60`);
      res.setHeader("Content-Type", "application/json");
      return res.status(200).json(cached);
    }
  } catch (e) {
    console.error("KV cache skip:", e);
  }

  try {
    const upstream = await fetch(url, {
      headers: NBA_HEADERS,
      signal: AbortSignal.timeout(7000),
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: `NBA Stats upstream ${upstream.status}`,
      });
    }

    const data = await upstream.json();
    const ttl = cacheTTL(endpoint);

    try {
      await kv.set(cacheKey, data, { ex: 21600 }); // 6 hours
    } catch (e) {
      console.error("KV cache set fail:", e);
    }

    res.setHeader("Cache-Control", `s-maxage=${ttl}, stale-while-revalidate=60`);
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json(data);

  } catch (err) {
    if (err.name === "TimeoutError") {
      return res.status(503).json({ error: "NBA Stats timed out — retrying" });
    }
    console.error("[api/nba]", err.message);
    return res.status(502).json({ error: "NBA Stats fetch failed", message: err.message });
  }
}
