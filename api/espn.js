// api/espn.js — Vercel Serverless Function
// Proxy for ESPN's free NBA API endpoints.
// No API key required.
//
// ?resource=standings  → current NBA standings
// ?resource=scoreboard → today's games (?date=YYYYMMDD optional)

const STANDINGS_URL =
    "https://site.web.api.espn.com/apis/v2/sports/basketball/nba/standings" +
    "?region=us&lang=en&contentorigin=espn&type=0&level=2&sort=gamesbehind:asc";

const SCOREBOARD_BASE =
    "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard";

export default async function handler(req, res) {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const resource = req.query.resource;
    if (!resource || !["standings", "scoreboard"].includes(resource)) {
        return res.status(400).json({ error: `Unknown resource "${resource}"` });
    }

    let url;
    if (resource === "standings") {
        url = STANDINGS_URL;
    } else {
        // scoreboard — optional ?date=YYYYMMDD
        url = req.query.date
            ? `${SCOREBOARD_BASE}?dates=${req.query.date}`
            : SCOREBOARD_BASE;
    }

    try {
        const upstream = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; PlusMinus/1.0)",
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
        const ttl = resource === "scoreboard" ? 60 : 600;

        res.setHeader("Cache-Control", `s-maxage=${ttl}, stale-while-revalidate=30`);
        res.setHeader("Content-Type", "application/json");
        return res.status(200).json(data);
    } catch (err) {
        if (err.name === "TimeoutError") {
            return res.status(504).json({ error: "ESPN upstream timed out" });
        }
        console.error("[api/espn]", err.message);
        return res.status(502).json({ error: "ESPN fetch failed", message: err.message });
    }
}