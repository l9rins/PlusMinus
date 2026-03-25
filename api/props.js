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

import { setCORSHeaders, handleOptions } from "./_cors.js";
import { TEAM_MAP } from "./_teams.js";
import { createClient } from "@vercel/kv";
const kv = createClient({
  url:   process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

function toDecimal(american) {
    const n = Number(american);
    if (!n || !isFinite(n)) return 1;
    if (n > 0) return 1 + n / 100;
    return 1 - 100 / n;
}

function currentSeasonStr() {
  const now  = new Date();
  const year = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${String(year + 1).slice(2)}`;
}

const NBA_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Referer":    "https://www.nba.com/",
  "Accept":     "application/json",
};

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

    // Optional: filter to a specific event ID passed as ?eventId=... or ?gameId=...
    const { eventId, gameId } = req.query;
    const resolvedEventId = eventId ?? gameId;

    // Player prop history mode: ?playerId=&market=&line=&limit=
    const { playerId: histPlayerId, market: histMarket, line: histLine, limit: histLimit } = req.query;
    if (histPlayerId && histMarket) {
      const cacheKey = `props_history:${histPlayerId}:${histMarket}`;
      try {
        const cached = await kv.get(cacheKey);
        if (cached) return res.status(200).json(cached);
      } catch {}

      const season = currentSeasonStr();
      const logUrl = `https://stats.nba.com/stats/playergamelog?PlayerID=${histPlayerId}&Season=${season}&SeasonType=Regular+Season&LeagueID=00`;

      try {
        const logRes  = await fetch(logUrl, { headers: NBA_HEADERS, signal: AbortSignal.timeout(7000) });
        if (!logRes.ok) return res.status(logRes.status).json({ error: "NBA log fetch failed" });
        const logData = await logRes.json();

        const rs      = logData?.resultSets?.[0];
        const headers = rs?.headers ?? [];
        const rows    = rs?.rowSet ?? [];
        const limit   = Math.min(Number(histLimit) || 10, 20);
        const targetLine = histLine != null ? Number(histLine) : null;

        // Build stat field index from market key
        const MARKET_STAT = {
          player_points:        "PTS",
          player_rebounds:      "REB",
          player_assists:       "AST",
          player_threes:        "FG3M",
          player_blocks_steals: ["BLK", "STL"],
        };

        const statKey = MARKET_STAT[histMarket];
        const isMulti = Array.isArray(statKey);
        const getIdx  = k => headers.indexOf(k);

        const games = rows.slice(0, limit).map(row => {
          const obj      = Object.fromEntries(headers.map((h, i) => [h, row[i]]));
          const value    = isMulti ? statKey.reduce((s, k) => s + (Number(obj[k]) || 0), 0) : Number(obj[statKey]) || 0;
          const hit      = targetLine != null ? value > targetLine : null;
          const matchup  = obj.MATCHUP ?? "";
          const date     = obj.GAME_DATE ?? "";
          return { value: +value.toFixed(1), hit, matchup, date };
        }).reverse(); // oldest first for chart

        const settled   = games.filter(g => g.hit !== null);
        const hits      = settled.filter(g => g.hit).length;
        const allValues = games.map(g => g.value);
        const avg       = allValues.length ? +(allValues.reduce((s, v) => s + v, 0) / allValues.length).toFixed(1) : null;
        const last5     = allValues.slice(-5);
        const last5Avg  = last5.length ? +(last5.reduce((s, v) => s + v, 0) / last5.length).toFixed(1) : null;

        const result = { games, total: settled.length, hits, hitRate: settled.length ? hits / settled.length : 0, avg, last5Avg };
        await kv.set(cacheKey, result, { ex: 1800 }).catch(() => {});
        res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=60");
        return res.status(200).json(result);
      } catch (err) {
        if (err.name === "TimeoutError") return res.status(503).json({ error: "NBA log timed out" });
        return res.status(502).json({ error: err.message });
      }
    }

    try {
        // Step 1: get today's NBA event list so we have event IDs
        const eventsUrl = `${ODDS_BASE}/sports/basketball_nba/events?apiKey=${apiKey}`;
        const eventsRes = await fetch(eventsUrl, { signal: AbortSignal.timeout(8000) });
        if (!eventsRes.ok) {
            return res.status(eventsRes.status).json({ error: `Odds API events ${eventsRes.status}` });
        }
        const events = await eventsRes.json();

        // Filter to requested event or all of today's
        const targetEvents = resolvedEventId
            ? events.filter(e => e.id === resolvedEventId)
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

        // ── Line movement detection ───────────────────────────────────────
        // Module-level cache survives warm Lambda invocations.
        // On each fresh fetch we diff every player/market line against the
        // previous snapshot and annotate moves of >=0.5 points.
        const prevSnapshot = (await kv.get("props_snapshot:latest")) ?? {};

        const moves = [];
        for (const [gameKey, game] of Object.entries(result)) {
            const prev = prevSnapshot[gameKey];
            if (!prev) continue;
            for (const [playerId, player] of Object.entries(game.players)) {
                const prevPlayer = prev.players?.[playerId];
                if (!prevPlayer) continue;
                for (const [market, m] of Object.entries(player.markets)) {
                    const prevLine = prevPlayer.markets?.[market]?.line;
                    if (prevLine == null || m.line == null) continue;
                    const delta = +(m.line - prevLine).toFixed(1);
                    if (Math.abs(delta) >= 0.5) {
                        moves.push({
                            gameKey, playerId, playerName: player.name,
                            market, prevLine, newLine: m.line, delta,
                            direction: delta > 0 ? "up" : "down",
                        });
                    }
                }
            }
        }

        // Persist to KV so api/notify.js can diff across Lambda invocations.
        // Fire-and-forget — don't await, don't let KV failure block the response.
        Promise.all([
          kv.set("props_snapshot:prev",   prevSnapshot, { ex: 7200 }),
          kv.set("props_snapshot:latest", result,       { ex: 7200 }),
        ]).catch(err => console.warn("[api/props] KV snapshot write failed:", err));

        // Background: Fire line movement alerts (TBD)
        // kv.keys("alerts:*").then(...)

        // Update in-memory snapshot for same-Lambda subsequent calls
        // Removed `handler._prevSnapshot = result;` to purely rely on KV

        // Cache for 10 minutes — props move slowly intraday
        res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=60");
        res.setHeader("Content-Type", "application/json");

        // Persist to KV for fallback cache
        await kv.set("props_cache", { ...result, _moves: moves, cachedAt: Date.now() }, { ex: 3600 }).catch(() => {});

        return res.status(200).json({ ...result, _moves: moves });

    } catch (err) {
        if (err.name === "TimeoutError") {
            const cached = await kv.get("props_cache").catch(() => null);
            if (cached) return res.status(200).json({ ...cached, stale: true });
            return res.status(503).json({ error: "Props API timed out — retrying" });
        }
        console.error("[api/props] Error:", err);
        const cached = await kv.get("props_cache").catch(() => null);
        if (cached) return res.status(200).json({ ...cached, stale: true });
        return res.status(502).json({ error: err.message });
    }
}