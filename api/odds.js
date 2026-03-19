// api/odds.js — Vercel Serverless Function
// ─────────────────────────────────────────────────────────────────
// BFF proxy for The Odds API v4.
//
// KEY UPGRADES over client-side approach:
//   1. API key stays server-side (never in JS bundle)
//   2. Fetches ALL bookmakers, not just ev.bookmakers?.[0]
//   3. Returns best-line per game (consensus + outlier detection)
//   4. Computes arbitrage opportunities server-side
//   5. 15-min Vercel edge cache = ~96 reqs/day well within 500/month
//
// SETUP:
//   Vercel → Environment Variables:
//     ODDS_API_KEY = your_odds_api_key   ← NO "VITE_" prefix

const ODDS_BASE = "https://api.the-odds-api.com/v4";

// Full team name → abbreviation map
const TEAM_MAP = {
  "Atlanta Hawks": "ATL",       "Boston Celtics": "BOS",
  "Brooklyn Nets": "BKN",       "Charlotte Hornets": "CHA",
  "Chicago Bulls": "CHI",       "Cleveland Cavaliers": "CLE",
  "Dallas Mavericks": "DAL",    "Denver Nuggets": "DEN",
  "Detroit Pistons": "DET",     "Golden State Warriors": "GSW",
  "Houston Rockets": "HOU",     "Indiana Pacers": "IND",
  "Los Angeles Clippers": "LAC","Los Angeles Lakers": "LAL",
  "Memphis Grizzlies": "MEM",   "Miami Heat": "MIA",
  "Milwaukee Bucks": "MIL",     "Minnesota Timberwolves": "MIN",
  "New Orleans Pelicans": "NOP","New York Knicks": "NYK",
  "Oklahoma City Thunder": "OKC","Orlando Magic": "ORL",
  "Philadelphia 76ers": "PHI",  "Phoenix Suns": "PHX",
  "Portland Trail Blazers": "POR","Sacramento Kings": "SAC",
  "San Antonio Spurs": "SAS",   "Toronto Raptors": "TOR",
  "Utah Jazz": "UTA",           "Washington Wizards": "WAS",
};

// American odds → raw implied probability (includes vig)
function toImplied(american) {
  if (american > 0) return 100 / (american + 100);
  return Math.abs(american) / (Math.abs(american) + 100);
}

// American odds → decimal
function toDecimal(american) {
  if (american > 0) return 1 + american / 100;
  return 1 - 100 / american;
}

// Detect arbitrage: sum of best-price implied probs < 1
function detectArbitrage(bestHomeP, bestAwayP) {
  // bestHomeP and bestAwayP are already vig-removed per-book
  // For arb, we need the raw best price at each book
  // arb exists when 1/homeDecimal + 1/awayDecimal < 1
  return false; // placeholder — real arb computed below per event
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  const isAllowedOrigin =
    origin.includes("vercel.app") ||
    origin.includes("localhost") ||
    origin.includes("plusminus");

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", isAllowedOrigin ? origin : "");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    return res.status(204).end();
  }

  if (req.method !== "GET") return res.status(405).end();

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ODDS_API_KEY not configured on server" });
  }

  try {
    // Fetch h2h odds for ALL available bookmakers
    const url =
      `${ODDS_BASE}/sports/basketball_nba/odds` +
      `?apiKey=${apiKey}&regions=us&markets=h2h&oddsFormat=american&bookmakers=draftkings,fanduel,betmgm,caesars,pointsbet,betrivers,espnbet,bet365`;

    const upstream = await fetch(url, {
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Odds API ${upstream.status}` });
    }

    const events = await upstream.json();
    const result = {};

    for (const ev of events) {
      const homeAbbr = TEAM_MAP[ev.home_team];
      const awayAbbr = TEAM_MAP[ev.away_team];
      if (!homeAbbr || !awayAbbr) continue;

      const key = `${awayAbbr}@${homeAbbr}`;

      // Collect all book prices for this event
      const homeLines = []; // { book, odds, implied }
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

      if (!homeLines.length) continue;

      // Best line = highest decimal odds (most favorable to bettor)
      const bestHome = homeLines.reduce((a, b) => toDecimal(a.odds) > toDecimal(b.odds) ? a : b);
      const bestAway = awayLines.reduce((a, b) => toDecimal(a.odds) > toDecimal(b.odds) ? a : b);

      // Consensus (average across books, vig-removed)
      const avgHomeImpl = homeLines.reduce((s, l) => s + l.implied, 0) / homeLines.length;
      const avgAwayImpl = awayLines.reduce((s, l) => s + l.implied, 0) / awayLines.length;
      const vigTotal = avgHomeImpl + avgAwayImpl;
      const consHomeP = +(avgHomeImpl / vigTotal * 100).toFixed(1);
      const consAwayP = +(avgAwayImpl / vigTotal * 100).toFixed(1);

      // Vig-removed best-line probabilities
      const bestRawHome = toImplied(bestHome.odds);
      const bestRawAway = toImplied(bestAway.odds);
      const bestTotal = bestRawHome + bestRawAway;
      const bestHomeP = +(bestRawHome / bestTotal * 100).toFixed(1);
      const bestAwayP = +(bestRawAway / bestTotal * 100).toFixed(1);

      // Arbitrage check: 1/bestHomeDecimal + 1/bestAwayDecimal < 1
      const arbSum = (1 / toDecimal(bestHome.odds)) + (1 / toDecimal(bestAway.odds));
      const isArb = arbSum < 1;
      const arbPct = isArb ? +((1 - arbSum) * 100).toFixed(2) : 0;

      // Line spread — max difference between any two books
      const homeOddsArr = homeLines.map((l) => l.odds);
      const maxHomeDiff = Math.max(...homeOddsArr) - Math.min(...homeOddsArr);

      result[key] = {
        // Best available line
        homeP: bestHomeP,
        awayP: bestAwayP,
        bestHomeBook: bestHome.book,
        bestAwayBook: bestAway.book,
        bestHomeOdds: bestHome.odds,
        bestAwayOdds: bestAway.odds,

        // Consensus (average across all books, vig-removed)
        consHomeP,
        consAwayP,

        // Line shopping data — full breakdown per book
        books: homeLines.map((hl, i) => ({
          book: hl.book,
          homeOdds: hl.odds,
          awayOdds: awayLines[i]?.odds ?? null,
          homeP: +(toImplied(hl.odds) / (toImplied(hl.odds) + toImplied(awayLines[i]?.odds ?? hl.odds)) * 100).toFixed(1),
        })).sort((a, b) => toDecimal(b.homeOdds) - toDecimal(a.homeOdds)),

        // Arbitrage
        isArb,
        arbPct,

        // Line movement signal
        lineSpread: maxHomeDiff,
        bookCount: homeLines.length,
      };
    }

    // 15 min edge cache
    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=60");
    res.setHeader("Content-Type", "application/json");
    if (isAllowedOrigin) res.setHeader("Access-Control-Allow-Origin", origin);

    return res.status(200).json(result);
  } catch (err) {
    if (err.name === "TimeoutError") {
      return res.status(504).json({ error: "Odds API timed out" });
    }
    console.error("[api/odds] Error:", err);
    return res.status(502).json({ error: err.message });
  }
}
