import { handleOptions, setCORSHeaders } from "./_cors.js";

const BASE = "https://stats.nba.com/stats";

const NBA_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; PlusMinus/1.0)",
  "Referer": "https://www.nba.com/",
  "Accept": "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  "Origin": "https://www.nba.com",
};

const ALLOWED_ENDPOINTS = [
  "leaguedashteamstats",
  "leaguedashplayerstats",
  "leaguedashteamclutch",
  "teamdashboardbygeneralsplits",
  "playerdashboardbyyearoveryear",
  "leaguestandingsv3",
  "commonallplayers",
  "teamgamelog",
  "playergamelog",
];

function cacheTTL(endpoint) {
  if (endpoint === "playergamelog") return 1800;   // 30 min
  if (endpoint.includes("dashboard")) return 600;  // 10 min — team/player specific
  return 1800;                                     // 30 min — league-wide
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

  // Forward all query params except "endpoint" directly to NBA Stats
  const params = { ...req.query };
  delete params.endpoint;
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE}/${endpoint}?${qs}`;

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

    res.setHeader("Cache-Control", `s-maxage=${ttl}, stale-while-revalidate=60`);
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json(data);

  } catch (err) {
    if (err.name === "TimeoutError") {
      return res.status(504).json({ error: "NBA Stats timed out" });
    }
    console.error("[api/nba]", err.message);
    return res.status(502).json({ error: "NBA Stats fetch failed", message: err.message });
  }
}
