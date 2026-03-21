import { handleOptions, setCORSHeaders } from "./_cors.js";
import { createClient } from "@vercel/kv";
import { createClerkClient } from "@clerk/backend";

const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

async function getUserId(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const { sub } = await clerk.verifyToken(auth.slice(7));
    return sub;
  } catch { return null; }
}

const VALID_RESULTS = new Set(["win", "loss", "push", "pending"]);
const VALID_BET_TYPES = new Set(["game", "prop", "parlay"]);
const VALID_PROP_MARKETS = new Set([
  "player_points", "player_rebounds", "player_assists",
  "player_threes", "player_blocks_steals",
]);
const VALID_PROP_SIDES = new Set(["over", "under"]);

function isValidLeg(leg) {
  if (!leg || typeof leg !== "object") return false;
  if (typeof leg.desc !== "string" || !leg.desc.trim()) return false;
  if (typeof leg.odds !== "number" || !isFinite(leg.odds)) return false;
  if (leg.result !== undefined && !VALID_RESULTS.has(leg.result)) return false;
  return true;
}

function isValidBet(bet) {
  if (!bet || typeof bet !== "object" || Array.isArray(bet)) return false;
  if (typeof bet.id !== "string" || !bet.id.trim()) return false;
  if (typeof bet.stake !== "number" || !isFinite(bet.stake) || bet.stake < 0) return false;
  if (!VALID_RESULTS.has(bet.result)) return false;
  if (bet.type !== undefined && !VALID_BET_TYPES.has(bet.type)) return false;
  if (typeof bet.odds !== "number" || !isFinite(bet.odds)) return false;
  if (bet.type === "parlay") {
    if (!Array.isArray(bet.legs) || bet.legs.length < 2 || bet.legs.length > 15) return false;
    if (bet.legs.some(l => !isValidLeg(l))) return false;
  }
  if (bet.type === "prop") {
    if (!VALID_PROP_MARKETS.has(bet.market)) return false;
    if (!VALID_PROP_SIDES.has(bet.side)) return false;
    if (typeof bet.player !== "string" || !bet.player.trim()) return false;
    if (typeof bet.line !== "number" || !isFinite(bet.line)) return false;
  }
  return true;
}

function sanitizeLeg(leg) {
  const s = {
    desc: String(leg.desc).slice(0, 100),
    odds: Number(leg.odds),
  };
  if (VALID_RESULTS.has(leg.result)) s.result = leg.result;
  if (typeof leg.matchup === "string") s.matchup = leg.matchup.slice(0, 50);
  if (typeof leg.team === "string") s.team = leg.team.slice(0, 10);
  if (typeof leg.player === "string") s.player = leg.player.slice(0, 60);
  if (typeof leg.market === "string" && VALID_PROP_MARKETS.has(leg.market)) s.market = leg.market;
  if (typeof leg.side === "string" && VALID_PROP_SIDES.has(leg.side)) s.side = leg.side;
  if (typeof leg.line === "number" && isFinite(leg.line)) s.line = leg.line;
  return s;
}

function sanitizeBet(bet) {
  const s = {
    id: String(bet.id).slice(0, 100),
    stake: Number(bet.stake),
    odds: Number(bet.odds),
    result: bet.result,
    type: VALID_BET_TYPES.has(bet.type) ? bet.type : "game",
  };
  if (typeof bet.matchup === "string") s.matchup = bet.matchup.slice(0, 50);
  if (typeof bet.note === "string") s.note = bet.note.slice(0, 200);
  if (typeof bet.book === "string") s.book = bet.book.slice(0, 50);
  if (typeof bet.date === "string") s.date = bet.date.slice(0, 30);
  if (typeof bet.team === "string") s.team = bet.team.slice(0, 10);
  // Snapshot unit size at time of logging so historical unit P/L stays accurate
  if (typeof bet.units === "number" && isFinite(bet.units) && bet.units > 0)
    s.units = +bet.units.toFixed(2);
  if (s.type === "prop") {
    s.player = String(bet.player).slice(0, 60);
    s.market = bet.market;
    s.side = bet.side;
    s.line = Number(bet.line);
    if (typeof bet.playerTeam === "string") s.playerTeam = bet.playerTeam.slice(0, 10);
  }
  if (s.type === "parlay") {
    s.legs = bet.legs.map(sanitizeLeg);
    s.legCount = s.legs.length;
  }
  return s;
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCORSHeaders(res, req.headers.origin || "");
  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const key = `bets:${userId}`;

  if (req.method === "GET") {
    return res.status(200).json((await kv.get(key)) ?? []);
  }

  if (req.method === "PUT") {
    const bets = req.body;
    if (!Array.isArray(bets)) return res.status(400).json({ error: "Body must be an array" });
    if (bets.length > 500) return res.status(400).json({ error: "Maximum 500 bets allowed" });
    const bad = bets.findIndex(b => !isValidBet(b));
    if (bad !== -1) return res.status(400).json({
      error: `Invalid bet at index ${bad}. ` +
        `Game bets need id/stake/odds/result. ` +
        `Prop bets also need player/market/side/line. ` +
        `Parlays need legs[] (2–15) each with desc+odds.`,
    });
    await kv.set(key, bets.map(sanitizeBet));
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}