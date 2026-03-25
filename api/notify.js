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

export async function checkAlerts(userId, currentOdds) {
    const alerts = (await kv.get(`alerts:${userId}`)) || [];
    let updated = false;

    // Helper to send a push (we queue it for the next poll since push infra isn't here)
    // Wait, the notification poller expects notifications in the responses.
    // We can push to an inbox in KV or rely on the polling endpoint returning them.
    // If we just need to satisfy the prompt's "fires sendPushNotification":
    const sendPushNotification = async (uid, payload) => {
        const inbox = (await kv.get(`inbox:${uid}`)) || [];
        inbox.push(payload);
        await kv.set(`inbox:${uid}`, inbox, { ex: 3600 }); // expire in 1hr
    };

    for (const alert of alerts) {
        if (alert.triggered) continue;

        let currentVal = null;

        // Extract current value from currentOdds (which is props list)
        // Since we know api/props.js calls checkAlerts with the props result obj:
        for (const [gameKey, game] of Object.entries(currentOdds || {})) {
            if (game.players) {
                for (const p of Object.values(game.players)) {
                    if (p.team === alert.team || p.team === alert.matchup) { // fuzzy match
                        if (p.markets?.[alert.market] && p.markets[alert.market].line != null) {
                            currentVal = p.markets[alert.market].line;
                            break;
                        } else if (p.markets?.[alert.market] && p.markets[alert.market].overOdds != null) {
                            // If they set target odds, it might be the odds value
                            currentVal = p.markets[alert.market].overOdds;
                            break;
                        }
                    }
                }
            }
        }

        if (currentVal == null) continue;

        const crossed = alert.direction === "above" 
            ? currentVal >= alert.targetOdds 
            : currentVal <= alert.targetOdds;
        
        if (crossed) {
            alert.triggered = true;
            updated = true;
            await sendPushNotification(userId, {
                title: 'Line Movement Alert 🚨',
                body: `${alert.team}'s ${MARKET_SHORT[alert.market] || alert.market} is now ${currentVal} (crossed ${alert.targetOdds})`,
                tag: `alert-${alert.id}`,
                data: { url: '/betting', urgent: true }
            });
        }
    }

    if (updated) {
        await kv.set(`alerts:${userId}`, alerts);
    }
}

export default async function handler(req, res) {
    if (handleOptions(req, res)) return;
    setCORSHeaders(res, req.headers.origin || "");

    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const reqMethod = req.method;

    if (reqMethod === "POST") {
        try {
            // Usually need body-parser, but Vercel JSON parses automatically
            const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const alerts = (await kv.get(`alerts:${userId}`)) || [];
            const newAlert = {
                id: crypto.randomUUID(),
                userId,
                market: payload.market || "spread",
                team: payload.team || "",
                matchup: payload.matchup || "",
                targetOdds: parseFloat(payload.targetOdds) || 0,
                direction: payload.direction || "above", // 'above' | 'below'
                createdAt: new Date().toISOString(),
                triggered: false,
            };
            alerts.push(newAlert);
            await kv.set(`alerts:${userId}`, alerts);
            return res.status(200).json(newAlert);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    if (reqMethod === "DELETE") {
        try {
            const { alertId } = req.query;
            let alerts = (await kv.get(`alerts:${userId}`)) || [];
            alerts = alerts.filter(a => a.id !== alertId);
            await kv.set(`alerts:${userId}`, alerts);
            return res.status(200).json({ success: true });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    if (reqMethod !== "GET") return res.status(405).end();

    let notifications = [];
    const alerts = (await kv.get(`alerts:${userId}`)) || [];

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

        // ── 4. Deliver any queued push notifications ───────────────
        const inbox = await kv.get(`inbox:${userId}`);
        if (inbox && inbox.length > 0) {
            notifications.push(...inbox);
            await kv.del(`inbox:${userId}`);
        }

        return res.status(200).json({ notifications, alerts });

    } catch (err) {
        console.error("[api/notify] Error:", err);
        return res.status(500).json({ error: err.message });
    }
}