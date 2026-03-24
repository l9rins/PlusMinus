// api/notify.js — Vercel Serverless Function
//
// Called by the client on a schedule (every 60s when app is focused).
// Returns an array of notification payloads the client should show via
// the Notifications API. No push subscription infra needed — client-driven poll.
//
// Checks:
//   1. Game starts in next 5 minutes  (from ESPN games feed)
//   2. Line moves >= 0.5              (from props snapshot — same logic as api/props.js)
//
// Auth: requires Clerk JWT (same as /api/bets) so users only get alerts
// for games/players they've bet on.
//
// Response: { notifications: [{ title, body, tag, data }] }

import { handleOptions, setCORSHeaders } from "./_cors.js";
import { createClerkClient } from "@clerk/backend";
import { createClient } from "@vercel/kv";

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const kv = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
});

async function getUserId(req) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return null;
    try {
        const { sub } = await clerk.verifyToken(auth.slice(7));
        return sub;
    } catch { return null; }
}

// Reuse TEAM_MAP from odds.js — duplicated here to keep functions independent
const TEAM_MAP = {
    "Atlanta Hawks": "ATL", "Boston Celtics": "BOS", "Brooklyn Nets": "BKN",
    "Charlotte Hornets": "CHA", "Chicago Bulls": "CHI", "Cleveland Cavaliers": "CLE",
    "Dallas Mavericks": "DAL", "Denver Nuggets": "DEN", "Detroit Pistons": "DET",
    "Golden State Warriors": "GSW", "Houston Rockets": "HOU", "Indiana Pacers": "IND",
    "Los Angeles Clippers": "LAC", "Los Angeles Lakers": "LAL", "Memphis Grizzlies": "MEM",
    "Miami Heat": "MIA", "Milwaukee Bucks": "MIL", "Minnesota Timberwolves": "MIN",
    "New Orleans Pelicans": "NOP", "New York Knicks": "NYK", "Oklahoma City Thunder": "OKC",
    "Orlando Magic": "ORL", "Philadelphia 76ers": "PHI", "Phoenix Suns": "PHX",
    "Portland Trail Blazers": "POR", "Sacramento Kings": "SAC", "San Antonio Spurs": "SAS",
    "Toronto Raptors": "TOR", "Utah Jazz": "UTA", "Washington Wizards": "WAS",
};

const MARKET_SHORT = {
    player_points: "PTS", player_rebounds: "REB", player_assists: "AST",
    player_threes: "3PT", player_blocks_steals: "BLK+STL",
};

export default async function handler(req, res) {
    if (handleOptions(req, res)) return;
    setCORSHeaders(res, req.headers.origin || "");
    if (req.method !== "GET") return res.status(405).end();

    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const notifications = [];

    try {
        // ── 1. Fetch user's saved bets to scope alerts ──────────────
        const bets = (await kv.get(`bets:${userId}`)) ?? [];
        const pendingBets = bets.filter(b => b.result === "pending");

        // Teams and players the user has pending bets on
        const watchedTeams = new Set(pendingBets.map(b => b.team).filter(Boolean));
        const watchedPlayers = new Set(
            pendingBets.filter(b => b.type === "prop").map(b => b.player?.toLowerCase()).filter(Boolean)
        );
        const watchedMatchups = new Set(pendingBets.map(b => b.matchup).filter(Boolean));

        // ── 2. Game-start alerts (5-min window) ────────────────────
        try {
            const espnRes = await fetch(
                "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
                { signal: AbortSignal.timeout(5000) }
            );
            if (espnRes.ok) {
                const espnData = await espnRes.json();
                const nowMs = Date.now();

                for (const event of espnData?.events ?? []) {
                    const status = event.status?.type?.name;
                    if (status !== "STATUS_SCHEDULED") continue;

                    const startMs = new Date(event.date).getTime();
                    const minsUntil = (startMs - nowMs) / 60000;
                    if (minsUntil < 0 || minsUntil > 5) continue;

                    const comps = event.competitions?.[0];
                    const away = TEAM_MAP[comps?.competitors?.find(c => c.homeAway === "away")?.team?.displayName] ?? "?";
                    const home = TEAM_MAP[comps?.competitors?.find(c => c.homeAway === "home")?.team?.displayName] ?? "?";
                    const gameKey = `${away}@${home}`;

                    // Only alert if user has a bet on this game
                    const relevant = watchedTeams.has(away) || watchedTeams.has(home) ||
                        [...watchedMatchups].some(m => m.includes(away) || m.includes(home));
                    if (!relevant) continue;

                    notifications.push({
                        title: `🏀 ${away} @ ${home} starting soon`,
                        body: `Tip-off in ~${Math.ceil(minsUntil)} min — you have a bet on this game.`,
                        tag: `game-start-${gameKey}`,
                        data: { url: "/", urgent: false },
                    });
                }
            }
        } catch { /* ESPN failure — skip game-start alerts */ }

        // ── 3. Line movement alerts ────────────────────────────────
        // Read last props snapshot from KV (written by api/props.js)
        const propsSnapshot = await kv.get(`props_snapshot:latest`);
        const prevSnapshot = await kv.get(`props_snapshot:prev`);

        if (propsSnapshot && prevSnapshot && watchedPlayers.size > 0) {
            for (const [gameKey, game] of Object.entries(propsSnapshot)) {
                if (gameKey.startsWith("_")) continue;
                const prevGame = prevSnapshot[gameKey];
                if (!prevGame) continue;

                for (const [playerId, player] of Object.entries(game.players ?? {})) {
                    if (!watchedPlayers.has(player.name?.toLowerCase())) continue;

                    for (const [market, m] of Object.entries(player.markets ?? {})) {
                        const prevLine = prevGame.players?.[playerId]?.markets?.[market]?.line;
                        if (prevLine == null || m.line == null) continue;
                        const delta = +(m.line - prevLine).toFixed(1);
                        if (Math.abs(delta) < 0.5) continue;

                        // Find their pending bet on this player+market
                        const matchingBet = pendingBets.find(
                            b => b.type === "prop" &&
                                b.player?.toLowerCase() === player.name?.toLowerCase() &&
                                b.market === market
                        );
                        if (!matchingBet) continue;

                        const dir = delta > 0 ? "▲" : "▼";
                        const favors = (matchingBet.side === "over" && delta < 0) ||
                            (matchingBet.side === "under" && delta > 0)
                            ? "✅ favors your bet" : "⚠️ goes against your bet";

                        notifications.push({
                            title: `${dir} Line move: ${player.name} ${MARKET_SHORT[market] ?? market}`,
                            body: `${prevLine} → ${m.line} (${delta > 0 ? "+" : ""}${delta}) — ${favors}`,
                            tag: `line-move-${playerId}-${market}`,
                            data: { url: "/betting", urgent: Math.abs(delta) >= 1.0 },
                        });
                    }
                }
            }
        }

        return res.status(200).json({ notifications });

    } catch (err) {
        console.error("[api/notify] Error:", err);
        return res.status(500).json({ error: err.message });
    }
}