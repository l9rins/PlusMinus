// api/bdl.js — Vercel Serverless Function
// ─────────────────────────────────────────────────────────────────
// BFF (Backend-For-Frontend) proxy for BallDontLie v1 API.
//
// WHY THIS EXISTS:
//   VITE_* env vars are bundled into the client JS and visible to
//   anyone who opens DevTools. This proxy keeps the API key on the
//   server where it belongs.
//
// SETUP:
//   In Vercel dashboard → Settings → Environment Variables:
//     BDL_API_KEY = your_balldontlie_key   ← NO "VITE_" prefix
//
// USAGE FROM CLIENT:
//   fetch("/api/bdl?path=/standings?season=2025&per_page=30")
//   The ?path= param is forwarded directly to BallDontLie.
//
// CACHING:
//   Vercel Edge Cache headers are set per endpoint type:
//   - Standings / players → 10 min (slow-changing)
//   - Games              → 90 sec (live scores)
//   - Search             → 5 min

const BASE = "https://api.balldontlie.io/nba/v1";

// Which paths get which cache TTL (seconds)
function cacheTTL(path) {
  if (path.startsWith("/games")) return 90;
  if (path.startsWith("/players?search")) return 300;
  return 600; // standings, season_averages, etc.
}

export default async function handler(req, res) {
  // CORS — same-origin only in prod, dev localhost allowed
  const origin = req.headers.origin || "";
  const allowed =
    origin.includes("vercel.app") ||
    origin.includes("localhost") ||
    origin.includes("plusminus"); // your custom domain

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", allowed ? origin : "");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.BDL_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "BDL_API_KEY not configured on server" });
  }

  const path = req.query.path;
  if (!path || typeof path !== "string") {
    return res.status(400).json({ error: "Missing ?path= parameter" });
  }

  // Security: only allow paths that start with /
  // Prevent SSRF by whitelisting BDL endpoints
  const allowed_prefixes = [
    "/games",
    "/standings",
    "/players",
    "/season_averages",
  ];
  const isAllowed = allowed_prefixes.some((p) => path.startsWith(p));
  if (!isAllowed) {
    return res.status(400).json({ error: "Path not allowed" });
  }

  try {
    const upstream = await fetch(`${BASE}${path}`, {
      headers: { Authorization: apiKey },
      // 8 second timeout — Vercel serverless limit is 10s on hobby
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return res.status(upstream.status).json({
        error: `BDL upstream error ${upstream.status}`,
        detail: text.slice(0, 200),
      });
    }

    const data = await upstream.json();
    const ttl = cacheTTL(path);

    // Cache at Vercel edge — clients revalidate after TTL
    res.setHeader("Cache-Control", `s-maxage=${ttl}, stale-while-revalidate=30`);
    res.setHeader("Content-Type", "application/json");
    if (allowed) res.setHeader("Access-Control-Allow-Origin", origin);

    return res.status(200).json(data);
  } catch (err) {
    if (err.name === "TimeoutError") {
      return res.status(504).json({ error: "BDL upstream timed out" });
    }
    console.error("[api/bdl] Error:", err);
    return res.status(502).json({ error: "Upstream fetch failed", message: err.message });
  }
}
