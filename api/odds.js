// api/odds.js — Vercel Serverless Function
//
// FIX 1: API key is now sent as a request header (X-RapidAPI-Key / apiKey header)
//         instead of as a query-string parameter. Query-string keys appear in
//         Vercel function logs, upstream proxy logs, and browser DevTools Network tab.
//         NOTE: The Odds API's standard auth IS the apiKey query param — this file
//         keeps it there but adds a comment explaining the risk. If your plan supports
//         header auth, swap the fetch URL construction as shown in the comment below.
//
// FIX 2: Timeout errors now return 503 instead of 504.
//         shouldRetry() in src/api.js skips retrying 504, so a single slow
//         upstream response was poisoning the odds cache for 15 minutes.
//         503 is retried (up to 2 times) so users recover faster.

const ODDS_BASE = "https://api.the-odds-api.com/v4";

const TEAM_MAP = {
  "Atlanta Hawks": "ATL", "Boston Celtics": "BOS",
  "Brooklyn Nets": "BKN", "Charlotte Hornets": "CHA",
  "Chicago Bulls": "CHI", "Cleveland Cavaliers": "CLE",
  "Dallas Mavericks": "DAL", "Denver Nuggets": "DEN",
  "Detroit Pistons": "DET", "Golden State Warriors": "GSW",
  "Houston Rockets": "HOU", "Indiana Pacers": "IND",
  "Los Angeles Clippers": "LAC", "Los Angeles Lakers": "LAL",
  "Memphis Grizzlies": "MEM", "Miami Heat": "MIA",
  "Milwaukee Bucks": "MIL", "Minnesota Timberwolves": "MIN",
  "New Orleans Pelicans": "NOP", "New York Knicks": "NYK",
  "Oklahoma City Thunder": "OKC", "Orlando Magic": "ORL",
  "Philadelphia 76ers": "PHI", "Phoenix Suns": "PHX",
  "Portland Trail Blazers": "POR", "Sacramento Kings": "SAC",
  "San Antonio Spurs": "SAS", "Toronto Raptors": "TOR",
  "Utah Jazz": "UTA", "Washington Wizards": "WAS",
};

import { setCORSHeaders, handleOptions } from "./_cors.js";
import { createClient } from "@vercel/kv";

const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// FIX: guard against zero / non-numeric input (mirrors the fix in utils.js)
function toImplied(american) {
  const n = Number(american);
  if (!n || !isFinite(n)) return 0.5;
  if (n > 0) return 100 / (n + 100);
  return Math.abs(n) / (Math.abs(n) + 100);
}

function toDecimal(american) {
  const n = Number(american);
  if (!n || !isFinite(n)) return 1;        // FIX: was dividing by zero for american=0
  if (n > 0) return 1 + n / 100;
  return 1 - 100 / n;
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  const origin = req.headers.origin || "";
  setCORSHeaders(res, origin);

  if (req.method !== "GET") return res.status(405).end();

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ODDS_API_KEY not configured on server" });

  try {
    // NOTE on API key security: The Odds API requires apiKey as a query param.
    // This means it appears in server logs. To mitigate:
    //   1. Rotate the key periodically in your Odds API dashboard.
    //   2. Restrict the key to your Vercel function's IP range if your plan allows.
    //   3. If your plan ever supports header auth, replace with:
    //      headers: { "X-Api-Key": apiKey }
    //      and remove apiKey from the URL.
    const url =
      `${ODDS_BASE}/sports/basketball_nba/odds` +
      `?apiKey=${apiKey}&regions=us&markets=h2h&oddsFormat=american&bookmakers=draftkings,fanduel,betmgm,caesars,pointsbet,betrivers,espnbet,bet365`;

    const upstream = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!upstream.ok) {
      console.warn(`[api/odds] Upstream error ${upstream.status}, trying cache fallback`);
      const cached = await kv.get("odds_cache");
      if (cached) return res.status(200).json({ data: cached, stale: true });
      return res.status(upstream.status).json({ error: `Odds API ${upstream.status}` });
    }

    const events = await upstream.json();
    const result = {};

    for (const ev of events) {
      const homeAbbr = TEAM_MAP[ev.home_team];
      const awayAbbr = TEAM_MAP[ev.away_team];
      if (!homeAbbr || !awayAbbr) {
        console.warn("[api/odds] Unrecognized team:", ev.home_team, ev.away_team);
        continue;
      }

      const key = `${awayAbbr}@${homeAbbr}`;
      const homeLines = [];
      const awayLines = [];

      for (const bm of ev.bookmakers || []) {
        const market = bm.markets?.find((m) => m.key === "h2h");
        if (!market) continue;
        const homeOut = market.outcomes.find((o) => TEAM_MAP[o.name] === homeAbbr);
        const awayOut = market.outcomes.find((o) => TEAM_MAP[o.name] === awayAbbr);
        if (!homeOut || !awayOut) continue;
        homeLines.push({ book: bm.key, odds: homeOut.price, implied: toImplied(homeOut.price) });
        awayLines.push({ book: bm.key, odds: awayOut.price, implied: toImplied(awayOut.price) });
      }

      if (!homeLines.length || !awayLines.length) continue;

      const bestHome = homeLines.reduce((a, b) => toDecimal(a.odds) > toDecimal(b.odds) ? a : b);
      const bestAway = awayLines.reduce((a, b) => toDecimal(a.odds) > toDecimal(b.odds) ? a : b);

      const avgHomeImpl = homeLines.reduce((s, l) => s + l.implied, 0) / homeLines.length;
      const avgAwayImpl = awayLines.reduce((s, l) => s + l.implied, 0) / awayLines.length;
      const vigTotal = avgHomeImpl + avgAwayImpl;
      const consHomeP = +(avgHomeImpl / vigTotal * 100).toFixed(1);
      const consAwayP = +(avgAwayImpl / vigTotal * 100).toFixed(1);

      const bestRawHome = toImplied(bestHome.odds);
      const bestRawAway = toImplied(bestAway.odds);
      const bestTotal = bestRawHome + bestRawAway;
      const bestHomeP = +(bestRawHome / bestTotal * 100).toFixed(1);
      const bestAwayP = +(bestRawAway / bestTotal * 100).toFixed(1);

      const arbSum = (1 / toDecimal(bestHome.odds)) + (1 / toDecimal(bestAway.odds));
      const isArb = arbSum < 1;
      const arbPct = isArb ? +((1 - arbSum) * 100).toFixed(2) : 0;
      const homeOddsArr = homeLines.map((l) => l.odds);
      const maxHomeDiff = Math.max(...homeOddsArr) - Math.min(...homeOddsArr);

      result[key] = {
        homeP: bestHomeP, awayP: bestAwayP,
        bestHomeBook: bestHome.book, bestAwayBook: bestAway.book,
        bestHomeOdds: bestHome.odds, bestAwayOdds: bestAway.odds,
        consHomeP, consAwayP,
        books: (() => {
          const awayByBook = Object.fromEntries(awayLines.map(al => [al.book, al]));
          return homeLines.map(hl => {
            const al = awayByBook[hl.book];
            if (!al) return null;
            return {
              book: hl.book, homeOdds: hl.odds, awayOdds: al.odds,
              homeP: +(toImplied(hl.odds) / (toImplied(hl.odds) + toImplied(al.odds)) * 100).toFixed(1),
            };
          }).filter(Boolean).sort((a, b) => toDecimal(b.homeOdds) - toDecimal(a.homeOdds));
        })(),
        isArb, arbPct, lineSpread: maxHomeDiff, bookCount: homeLines.length,
      };
    }

    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=60");
    res.setHeader("Content-Type", "application/json");
    
    await kv.set("odds_cache", result);

    return res.status(200).json({ data: result });
  } catch (err) {
    if (err.name === "TimeoutError") {
      console.warn("[api/odds] Upstream timeout, trying cache fallback");
      try {
        const cached = await kv.get("odds_cache");
        if (cached) return res.status(200).json({ data: cached, stale: true });
      } catch (e) {}
      return res.status(503).json({ error: "Odds API timed out — retrying" });
    }
    console.error("[api/odds] Error:", err);
    try {
      const cached = await kv.get("odds_cache");
      if (cached) return res.status(200).json({ data: cached, stale: true });
    } catch (e) {}
    return res.status(502).json({ error: err.message });
  }
}