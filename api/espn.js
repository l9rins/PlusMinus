// api/espn.js — Vercel Serverless Function
// ─────────────────────────────────────────────────────────────────
// Proxy for ESPN's unofficial free NBA API.
// No API key required — ESPN's endpoints are open to the public.
//
// Supported ?resource= values:
//   standings   → current NBA standings (both conferences)
//   scoreboard  → today's games (or ?date=YYYYMMDD for specific date)
//
// WHY A PROXY?
//   ESPN blocks direct browser requests from unknown origins due to
//   CORS policies. Running through a Vercel function bypasses this
//   since the request comes from a server IP, not a browser.
//
// CACHING:
//   Vercel edge cache headers keep ESPN load minimal:
//   - Standings  → 10 min  (slow-changing)
//   - Scoreboard → 60 sec  (live games update frequently)

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";

const RESOURCE_MAP = {
    standings: `${ESPN_BASE}/standings`,
    scoreboard: `${ESPN_BASE}/scoreboard`,
};

const CACHE_TTL = {
    standings: 600, // 10 min
    scoreboard: 60,  // 1 min
};

export default async function handler(req, res) {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const resource = req.query.resource;
    if (!resource || !RESOURCE_MAP[resource]) {
        return res.status(400).json({
            error: `Unknown resource "${resource}". Use: standings, scoreboard`,
        });
    }

    // Forward optional query params (e.g. ?date=20260319 for scoreboard)
    const params = new URLSearchParams();
    if (resource === "scoreboard" && req.query.date) {
        params.set("dates", req.query.date); // ESPN uses "dates" not "date"
    }

    const upstreamUrl = params.toString()
        ? `${RESOURCE_MAP[resource]}?${params}`
        : RESOURCE_MAP[resource];

    try {
        const upstream = await fetch(upstreamUrl, {
            headers: {
                // ESPN occasionally blocks requests without a browser-like UA
                "User-Agent":
                    "Mozilla/5.0 (compatible; PlusMinus/1.0; +https://plusminus.vercel.app)",
                Accept: "application/json",
            },
            signal: AbortSignal.timeout(8000),
        });

        if (!upstream.ok) {
            return res.status(upstream.status).json({
                error: `ESPN upstream returned ${upstream.status}`,
            });
        }

        const data = await upstream.json();
        const ttl = CACHE_TTL[resource] ?? 300;

        res.setHeader("Cache-Control", `s-maxage=${ttl}, stale-while-revalidate=30`);
        res.setHeader("Content-Type", "application/json");

        return res.status(200).json(data);
    } catch (err) {
        if (err.name === "TimeoutError") {
            return res.status(504).json({ error: "ESPN upstream timed out" });
        }
        console.error("[api/espn] Error:", err.message);
        return res.status(502).json({ error: "ESPN upstream fetch failed", message: err.message });
    }
}