// api/espn.js — Vercel Serverless Function
// Proxy for ESPN's free NBA API. No API key required.
//
// ?resource=standings                      → current NBA standings
// ?resource=scoreboard                     → today's games (?date=YYYYMMDD)
// ?resource=team_schedule&team=OKC         → full team schedule + results

const STANDINGS_URL =
    "https://site.web.api.espn.com/apis/v2/sports/basketball/nba/standings" +
    "?region=us&lang=en&contentorigin=espn&type=0&level=2&sort=gamesbehind:asc";

const SCOREBOARD_BASE =
    "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard";

// ESPN numeric team IDs (abbreviation → ESPN ID)
const ESPN_TEAM_IDS = {
    ATL: "1", BOS: "2", BKN: "17", CHA: "30", CHI: "4",
    CLE: "5", DAL: "6", DEN: "7", DET: "8", GSW: "9",
    HOU: "10", IND: "11", LAC: "12", LAL: "13", MEM: "29",
    MIA: "14", MIL: "15", MIN: "16", NOP: "3", NYK: "18",
    OKC: "25", ORL: "19", PHI: "20", PHX: "21", POR: "22",
    SAC: "23", SAS: "24", TOR: "28", UTA: "26", WAS: "27",
};

import { setCORSHeaders, handleOptions } from "./_cors.js";

export default async function handler(req, res) {
    if (handleOptions(req, res)) return;
    const origin = req.headers.origin || "";
    setCORSHeaders(res, origin);

    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const resource = req.query.resource;
    if (!resource || !["standings", "scoreboard", "team_schedule"].includes(resource)) {
        return res.status(400).json({ error: `Unknown resource "${resource}"` });
    }

    let url, ttl;

    if (resource === "standings") {
        url = STANDINGS_URL;
        ttl = 600;
    } else if (resource === "scoreboard") {
        url = req.query.date
            ? `${SCOREBOARD_BASE}?dates=${req.query.date}`
            : SCOREBOARD_BASE;
        ttl = 60;
    } else if (resource === "team_schedule") {
        const teamParam = Array.isArray(req.query.team) ? req.query.team[0] : req.query.team;
        const abbr = (teamParam || "").toUpperCase();
        const espnId = ESPN_TEAM_IDS[abbr];
        if (!espnId) return res.status(400).json({ error: `Unknown team: ${abbr}` });
        url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${espnId}/schedule`;
        ttl = 300;
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
            return res.status(upstream.status).json({ error: `ESPN upstream ${upstream.status}` });
        }

        const data = await upstream.json();
        res.setHeader("Cache-Control", `s-maxage=${ttl}, stale-while-revalidate=30`);
        res.setHeader("Content-Type", "application/json");
        return res.status(200).json(data);

    } catch (err) {
        if (err.name === "TimeoutError") return res.status(504).json({ error: "ESPN timed out" });
        console.error("[api/espn]", err.message);
        return res.status(502).json({ error: "ESPN fetch failed", message: err.message });
    }
}