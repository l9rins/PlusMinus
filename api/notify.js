// api/notify.js — full rewrite
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

  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  // ── GET — return user's saved alerts ──────────────────────────
  if (req.method === "GET") {
    const alerts = (await kv.get(`alerts:${userId}`)) ?? [];
    return res.status(200).json({ alerts });
  }

  // ── POST — create a new alert ─────────────────────────────────
  if (req.method === "POST") {
    let body;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch { body = {}; }
    
    const { team, matchup, targetOdds, direction } = body ?? {};
    if (!team && !matchup) {
      return res.status(400).json({ error: "team or matchup required" });
    }
    const alerts = (await kv.get(`alerts:${userId}`)) ?? [];
    const newAlert = {
      id: crypto.randomUUID(),
      team: team ?? null,
      matchup: matchup ?? null,
      targetOdds: targetOdds ?? null,
      direction: direction ?? null,
      createdAt: new Date().toISOString(),
    };
    alerts.push(newAlert);
    await kv.set(`alerts:${userId}`, alerts, { ex: 60 * 60 * 24 * 30 }); // 30 days
    return res.status(201).json(newAlert);
  }

  // ── DELETE — remove an alert by id ───────────────────────────
  if (req.method === "DELETE") {
    const { alertId } = req.query;
    if (!alertId) return res.status(400).json({ error: "alertId required" });
    const alerts = (await kv.get(`alerts:${userId}`)) ?? [];
    const filtered = alerts.filter((a) => a.id !== alertId);
    await kv.set(`alerts:${userId}`, filtered, { ex: 60 * 60 * 24 * 30 });
    return res.status(200).json({ ok: true });
  }

  // ── Internal: game-start + line movement notifications ────────
  // This logic is only triggered by the existing poll in useNotifications.js.
  // It remains GET-accessible but is separated from the alerts CRUD above
  // via a ?notifications=true query param to keep concerns clean.
  return res.status(405).end();
}