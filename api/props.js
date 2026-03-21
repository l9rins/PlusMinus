// api/props.js — Vercel Serverless Function
//
// Returns player prop lines for all NBA games today.
// Markets: player_points, player_rebounds, player_assists,
//          player_threes, player_blocks_steals
//
// Response shape:
// {
//   "BOS@LAL": {
//     players: {
//       "Jayson Tatum": {
//         id: "jayson-tatum",
//         team: "BOS",
//         markets: {
//           player_points:        { line: 27.5, overOdds: -115, underOdds: -105, book: "draftkings", bestOver: -110, bestOverBook: "fanduel" },
//           player_rebounds:      { ... },
//           player_assists:       { ... },
//           player_threes:        { ... },
//           player_blocks_steals: { ... },
//         }
//       }
//     }
//   }
// }

const ODDS_BASE = "https://api.the-odds-api.com/v4";

const PROP_MARKETS = [
    "player_points",
    "player_rebounds",
    "player_assists",
    "player_threes",
    "player_blocks_steals",
];

const MARKET_LABELS = {
    player_points: "Points",
    player_rebounds: "Rebounds",
    player_assists: "Assists",
    player_threes: "Threes",
    player_blocks_steals: "Blks+Stls",
};

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

function toDecimal(american) {
    const n = Number(american);
    if (!n || !isFinite(n)) return 1;
    if (n > 0) return 1 + n / 100;
    return 1 - 100 / n;
}

// Normalize player name to a stable slug ID
function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default async function handler(req, res) {
    if (handleOptions(req, res)) return;
    const origin = req.headers.origin || "";
    setCORSHeaders(res, origin);

    if (req.method !== "GET") return res.status(405).end();

    const apiKey = process.env.ODDS_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: "ODDS_API_KEY not configured on server" });
    }

    // Optional: filter to a specific event ID passed as ?eventId=...
    const { eventId } = req.query;

    try {
        // Step 1: get today's NBA event list so we have event IDs
        const eventsUrl = `${ODDS_BASE}/sports/basketball_nba/events?apiKey=${apiKey}`;
        const eventsRes = await fetch(eventsUrl, { signal: AbortSignal.timeout(8000) });
        if (!eventsRes.ok) {
            return res.status(eventsRes.status).json({ error: `Odds API events ${eventsRes.status}` });
        }
        const events = await eventsRes.json();

        // Filter to requested event or all of today's
        const targetEvents = eventId
            ? events.filter(e => e.id === eventId)
            : events;

        if (!targetEvents.length) {
            return res.status(200).json({});
        }

        const result = {};
        const marketsParam = PROP_MARKETS.join(",");

        // Step 2: fetch props for each event (parallel, capped at 5 concurrent)
        const CONCURRENCY = 5;
        for (let i = 0; i < targetEvents.length; i += CONCURRENCY) {
            const batch = targetEvents.slice(i, i + CONCURRENCY);

            await Promise.all(batch.map(async (ev) => {
                const homeAbbr = TEAM_MAP[ev.home_team];
                const awayAbbr = TEAM_MAP[ev.away_team];
                if (!homeAbbr || !awayAbbr) return;

                const gameKey = `${awayAbbr}@${homeAbbr}`;

                const propsUrl =
                    `${ODDS_BASE}/sports/basketball_nba/events/${ev.id}/odds` +
                    `?apiKey=${apiKey}&regions=us&markets=${marketsParam}&oddsFormat=american` +
                    `&bookmakers=draftkings,fanduel,betmgm,caesars,betrivers,espnbet`;

                try {
                    const propsRes = await fetch(propsUrl, { signal: AbortSignal.timeout(8000) });
                    if (!propsRes.ok) return; // skip this game silently

                    const propsData = await propsRes.json();
                    const players = {};

                    for (const bookmaker of propsData.bookmakers || []) {
                        for (const market of bookmaker.markets || []) {
                            if (!PROP_MARKETS.includes(market.key)) continue;

                            for (const outcome of market.outcomes || []) {
                                const playerName = outcome.description || outcome.name;
                                if (!playerName) continue;

                                const playerId = slugify(playerName);
                                if (!players[playerId]) {
                                    players[playerId] = {
                                        id: playerId,
                                        name: playerName,
                                        team: null, // enriched below if available
                                        markets: {},
                                    };
                                }

                                if (!players[playerId].markets[market.key]) {
                                    players[playerId].markets[market.key] = {
                                        label: MARKET_LABELS[market.key],
                                        line: outcome.point ?? null,
                                        overOdds: null,
                                        underOdds: null,
                                        bestOverOdds: null,
                                        bestOverBook: null,
                                        bestUnderOdds: null,
                                        bestUnderBook: null,
                                        books: [],
                                    };
                                }

                                const m = players[playerId].markets[market.key];
                                const side = outcome.name?.toLowerCase();
                                const odds = outcome.price;
                                const line = outcome.point ?? m.line;

                                // Keep the most common line (first seen)
                                if (m.line === null) m.line = line;

                                // Track best over/under per book
                                const existingBook = m.books.find(b => b.book === bookmaker.key);
                                if (!existingBook) {
                                    m.books.push({ book: bookmaker.key, overOdds: null, underOdds: null, line });
                                }
                                const bk = m.books.find(b => b.book === bookmaker.key);

                                if (side === "over") {
                                    bk.overOdds = odds;
                                    if (m.bestOverOdds === null || toDecimal(odds) > toDecimal(m.bestOverOdds)) {
                                        m.bestOverOdds = odds;
                                        m.bestOverBook = bookmaker.key;
                                    }
                                    // Use first book's over as default display
                                    if (m.overOdds === null) m.overOdds = odds;
                                } else if (side === "under") {
                                    bk.underOdds = odds;
                                    if (m.bestUnderOdds === null || toDecimal(odds) > toDecimal(m.bestUnderOdds)) {
                                        m.bestUnderOdds = odds;
                                        m.bestUnderBook = bookmaker.key;
                                    }
                                    if (m.underOdds === null) m.underOdds = odds;
                                }
                            }
                        }
                    }

                    // Only include players who have at least one market
                    const filteredPlayers = Object.fromEntries(
                        Object.entries(players).filter(([, p]) => Object.keys(p.markets).length > 0)
                    );

                    if (Object.keys(filteredPlayers).length > 0) {
                        result[gameKey] = {
                            homeTeam: homeAbbr,
                            awayTeam: awayAbbr,
                            eventId: ev.id,
                            players: filteredPlayers,
                        };
                    }
                } catch {
                    // Individual event failure — skip silently, don't fail whole request
                }
            }));
        }

        // Cache for 10 minutes — props move slowly intraday
        res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=60");
        res.setHeader("Content-Type", "application/json");
        return res.status(200).json(result);

    } catch (err) {
        if (err.name === "TimeoutError") {
            return res.status(503).json({ error: "Props API timed out — retrying" });
        }
        console.error("[api/props] Error:", err);
        return res.status(502).json({ error: err.message });
    }
}