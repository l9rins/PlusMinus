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
    const token = auth.slice(7);
    const { sub } = await clerk.verifyToken(token);
    return sub;
  } catch {
    return null;
  }
}

const VALID_RESULTS = new Set(["win", "loss", "push", "pending"]);

// Validate shape — same checks as before
function isValidBet(bet) {
  if (!bet || typeof bet !== "object" || Array.isArray(bet)) return false;
  if (typeof bet.id !== "string" || !bet.id.trim()) return false;
  if (typeof bet.stake !== "number" || !isFinite(bet.stake) || bet.stake < 0) return false;
  if (typeof bet.odds !== "number" || !isFinite(bet.odds)) return false;
  if (!VALID_RESULTS.has(bet.result)) return false;
  return true;
}

// FIX: reconstruct each bet from only the known fields before writing to KV.
//
// isValidBet() correctly rejected malformed bets, but a valid bet could still
// carry arbitrary extra keys: { id, stake, odds, result, malicious: "x".repeat(1e7) }.
// That payload passes validation and gets stored as-is, letting a client exhaust
// Vercel KV storage quota despite the 500-item array cap.
//
// Fix: never trust the incoming object shape. Reconstruct from a known-safe
// allowlist and cap string lengths. The KV record size stays bounded regardless
// of what the client sends.
//
// Field limits:
//   id        — 100 chars  (UUID is 36, Date.now() str is 13, plenty of headroom)
//   matchup   — 50 chars   (e.g. "BOS @ LAL", optional display field)
//   note      — 200 chars  (optional user note)
//   book      — 50 chars   (bookmaker name, optional)
function sanitizeBet(bet) {
  const s = {
    id: String(bet.id).slice(0, 100),
    stake: Number(bet.stake),
    odds: Number(bet.odds),
    result: bet.result, // already validated as one of 4 known strings
  };
  // Optional display fields — only include if present and valid type
  if (typeof bet.matchup === "string") s.matchup = bet.matchup.slice(0, 50);
  if (typeof bet.note === "string") s.note = bet.note.slice(0, 200);
  if (typeof bet.book === "string") s.book = bet.book.slice(0, 50);
  if (typeof bet.date === "string") s.date = bet.date.slice(0, 30);
  if (typeof bet.team === "string") s.team = bet.team.slice(0, 10);
  return s;
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  const origin = req.headers.origin || "";
  setCORSHeaders(res, origin);

  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const key = `bets:${userId}`;

  if (req.method === "GET") {
    const bets = await kv.get(key);
    return res.status(200).json(bets ?? []);
  }

  if (req.method === "PUT") {
    const bets = req.body;

    if (!Array.isArray(bets)) {
      return res.status(400).json({ error: "Body must be an array" });
    }

    if (bets.length > 500) {
      return res.status(400).json({ error: "Maximum 500 bets allowed" });
    }

    const invalidIdx = bets.findIndex(b => !isValidBet(b));
    if (invalidIdx !== -1) {
      return res.status(400).json({
        error: `Invalid bet at index ${invalidIdx}. Each bet must have: id (string), stake (number >= 0), odds (number), result (win|loss|push|pending).`,
      });
    }

    // FIX: sanitize before write — strips unknown fields and caps string lengths
    const sanitizedBets = bets.map(sanitizeBet);
    await kv.set(key, sanitizedBets);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}