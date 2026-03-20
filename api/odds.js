// api/odds.js — Vercel Serverless Function
const ODDS_BASE = "https://api.the-odds-api.com/v4";

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

const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "http://localhost:5173",
]);
const VERCEL_PREVIEW_RE = /^https:\/\/[a-zA-Z0-9-]+-[a-zA-Z0-9]+\.vercel\.app$/;

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (VERCEL_PREVIEW_RE.test(origin)) return true;
  if (origin === "https://plusminus.vercel.app") return true;
  return false;
}

function toImplied(american) {
  if (american > 0) return 100 / (american + 100);
  return Math.abs(american) / (Math.abs(american) + 100);
}

function toDecimal(american) {
  if (american > 0) return 1 + american / 100;
  return 1 - 100 / american;
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  const allowed = isAllowedOrigin(origin);

  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    if (allowed) res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    return res.status(204).end();
  }

  if (req.method !== "GET") return res.status(405).end();

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ODDS_API_KEY not configured on server" });

  try {
    const url =
      `${ODDS_BASE}/sports/basketball_nba/odds` +
      `?apiKey=${apiKey}&regions=us&markets=h2h&oddsFormat=american&bookmakers=draftkings,fanduel,betmgm,caesars,pointsbet,betrivers,espnbet,bet365`;

    const upstream = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!upstream.ok) {
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

      if (!homeLines.length) continue;

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
    if (allowed) res.setHeader("Access-Control-Allow-Origin", origin);

    return res.status(200).json(result);
  } catch (err) {
    if (err.name === "TimeoutError") return res.status(504).json({ error: "Odds API timed out" });
    console.error("[api/odds] Error:", err);
    return res.status(502).json({ error: err.message });
  }
}
