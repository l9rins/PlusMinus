// api/stream.js — Server-Sent Events for real-time line movement alerts.
//
// The client opens one long-lived GET /api/stream connection.
// This endpoint:
//   1. Immediately sends the current odds snapshot.
//   2. Polls odds every 60s server-side and pushes diffs to the client.
//   3. Sends a heartbeat every 25s to keep the connection alive through
//      Vercel's 30s serverless timeout. Each heartbeat resets the 30s clock
//      because we use the streaming response body.
//
// ⚠️ Vercel Serverless has a hard 60s max duration on Hobby, 300s on Pro.
// For production, enable "Fluid Compute" or use Edge Runtime (see comment below).
//
// Vercel config needed in vercel.json:
//   { "functions": { "api/stream.js": { "maxDuration": 300 } } }

import { setCORSHeaders, handleOptions } from "./_cors.js";
import { getUserIdFromQuery } from "./_auth.js";
import { kv } from "./_kv.js";

const POLL_MS      = 60_000;
const HEARTBEAT_MS = 25_000;
const MOVEMENT_THRESHOLD = 5; // points of line movement to alert on

async function fetchCurrentOdds() {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/basketball_nba/odds?apiKey=${apiKey}&regions=us&markets=h2h,spreads&oddsFormat=american`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

function buildOddsSnapshot(events) {
  if (!events) return {};
  const snap = {};
  for (const ev of events) {
    const key = `${ev.away_team}@${ev.home_team}`;
    const book = ev.bookmakers?.[0];
    if (!book) continue;
    const h2h     = book.markets?.find(m => m.key === "h2h");
    const spreads = book.markets?.find(m => m.key === "spreads");
    snap[key] = {
      homeML: h2h?.outcomes?.find(o => o.name === ev.home_team)?.price ?? null,
      awayML: h2h?.outcomes?.find(o => o.name === ev.away_team)?.price ?? null,
      homeSpread: spreads?.outcomes?.find(o => o.name === ev.home_team)?.point ?? null,
      awaySpread: spreads?.outcomes?.find(o => o.name === ev.away_team)?.point ?? null,
    };
  }
  return snap;
}

function detectMovements(prev, curr) {
  const alerts = [];
  for (const [matchup, currOdds] of Object.entries(curr)) {
    const prevOdds = prev[matchup];
    if (!prevOdds) continue;

    for (const side of ["homeML", "awayML"]) {
      const before = prevOdds[side];
      const after  = currOdds[side];
      if (before == null || after == null) continue;
      const move = Math.abs(after - before);
      if (move >= MOVEMENT_THRESHOLD) {
        alerts.push({
          type:    "line_movement",
          matchup,
          side:    side === "homeML" ? "home" : "away",
          from:    before,
          to:      after,
          move:    after - before,
          tag:     `line_${matchup}_${side}_${Date.now()}`,
        });
      }
    }
  }
  return alerts;
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  // SSE requires specific CORS headers
  setCORSHeaders(res, req.headers.origin || "");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method !== "GET" && req.method !== "HEAD") return res.status(405).end();
  if (req.method === "HEAD") return res.status(200).end();

  const userId = await getUserIdFromQuery(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  // Set SSE headers
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable Nginx buffering

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Send initial connection confirmation
  send("connected", { userId, ts: Date.now() });

  // Load baseline snapshot from KV (set by last cron run)
  let prevSnapshot = (await kv.get("odds:snapshot").catch(() => null)) ?? {};

  // Send current odds immediately
  const initial = await fetchCurrentOdds();
  const currSnapshot = buildOddsSnapshot(initial);
  if (Object.keys(currSnapshot).length > 0) {
    prevSnapshot = currSnapshot;
    send("odds", currSnapshot);
    await kv.set("odds:snapshot", currSnapshot, { ex: 7200 }).catch(() => {});
  }

  // Heartbeat — keeps connection alive through 30s timeout
  const heartbeatTimer = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, HEARTBEAT_MS);

  // Poll for line movements
  let pollActive = true;
  const schedulePoll = () => {
    if (!pollActive) return;
    setTimeout(async () => {
      const events  = await fetchCurrentOdds();
      if (!events || !Object.keys(events).length) {
        if (pollActive) schedulePoll();
        return;
      }
      const newSnap = buildOddsSnapshot(events);
      if (!Object.keys(newSnap).length) {
        if (pollActive) schedulePoll();
        return;
      }

      const movements = detectMovements(prevSnapshot, newSnap);
      prevSnapshot = newSnap;

      send("odds", newSnap);

      for (const alert of movements) {
        send("alert", alert);
        const webhooks = await kv.get(`webhooks:${userId}`).catch(() => null);
        if (webhooks?.discord) await pushDiscord(webhooks.discord, alert).catch(() => {});
        if (webhooks?.telegram) await pushTelegram(webhooks.telegram, alert).catch(() => {});
      }

      await kv.set("odds:snapshot", newSnap, { ex: 7200 }).catch(() => {});
      if (pollActive) schedulePoll();
    }, POLL_MS);
  };
  schedulePoll();

  // Cleanup on client disconnect
  req.on("close", () => {
    pollActive = false;
    clearInterval(heartbeatTimer);
  });

  // Keep response open
  await new Promise(resolve => req.on("close", resolve));
}

// ── Discord webhook push ──────────────────────────────────────
async function pushDiscord(webhookUrl, alert) {
  try {
    const url = new URL(webhookUrl);
    if (url.hostname !== 'discord.com' && url.hostname !== 'canary.discord.com') {
      console.warn("Invalid Discord webhook domain:", url.hostname);
      return;
    }
  } catch (e) {
    return; // Invalid URL
  }

  const dir   = alert.move > 0 ? "📈" : "📉";
  const color = alert.move > 0 ? 0x00d4aa : 0xef4444;
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [{
        title: `${dir} Line Movement — ${alert.matchup}`,
        color,
        fields: [
          { name: "Side",      value: alert.side,                         inline: true },
          { name: "Was",       value: `${alert.from > 0 ? "+" : ""}${alert.from}`, inline: true },
          { name: "Now",       value: `${alert.to > 0 ? "+" : ""}${alert.to}`,     inline: true },
          { name: "Movement",  value: `${alert.move > 0 ? "+" : ""}${alert.move} pts`, inline: true },
        ],
        footer: { text: "PlusMinus · Real-time odds tracking" },
        timestamp: new Date().toISOString(),
      }],
    }),
    signal: AbortSignal.timeout(5000),
  });
}

// ── Telegram push ─────────────────────────────────────────────
async function pushTelegram({ botToken, chatId }, alert) {
  const dir = alert.move > 0 ? "📈" : "📉";
  const text = `${dir} *Line Movement*\n`
    + `*${alert.matchup}* (${alert.side})\n`
    + `${alert.from > 0 ? "+" : ""}${alert.from} → ${alert.to > 0 ? "+" : ""}${alert.to} `
    + `(${alert.move > 0 ? "+" : ""}${alert.move} pts)`;

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    signal: AbortSignal.timeout(5000),
  });
}
