import { handleOptions, setCORSHeaders } from "./_cors.js";
import { kv } from "./_kv.js";

const BASE_URL = "https://api.balldontlie.io/v1";
const API_KEY = process.env.BDL_API_KEY;

// Very short cache for search results — cuts 429s dramatically on keystroke searches
const CACHE_TTL = 30; // seconds

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  const origin = req.headers.origin || "";
  setCORSHeaders(res, origin);

  if (!API_KEY) {
    return res.status(500).json({ error: "BDL_API_KEY not configured" });
  }

  const path = req.query.path;
  if (!path) return res.status(400).json({ error: "Missing path parameter" });

  const cacheKey = `bdl:${path}`;

  // Check cache first — short-circuits repeated identical queries
  try {
    const cached = await kv.get(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      res.setHeader("Cache-Control", `s-maxage=${CACHE_TTL}`);
      return res.status(200).json(cached);
    }
  } catch (e) {
    // Cache miss or KV error — proceed to upstream
  }

  try {
    const url = `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
    const response = await fetch(url, {
      headers: { Authorization: API_KEY },
      signal: AbortSignal.timeout(8000),
    });

    if (response.status === 429) {
      // Forward the Retry-After header so the frontend can back off intelligently
      const retryAfter = response.headers.get("Retry-After") || "5";
      res.setHeader("Retry-After", retryAfter);
      return res.status(429).json({
        error: "BallDontLie rate limit exceeded",
        retryAfter: parseInt(retryAfter, 10),
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({ error: `BDL upstream error ${response.status}` });
    }

    const data = await response.json();

    // Cache the result
    try {
      await kv.set(cacheKey, data, { ex: CACHE_TTL });
    } catch (e) {
      // Non-fatal
    }

    res.setHeader("Cache-Control", `s-maxage=${CACHE_TTL}`);
    return res.status(200).json(data);
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      return res.status(504).json({ error: "BDL request timed out" });
    }
    console.error(`[api/bdl] Error fetching ${path}:`, err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
}
