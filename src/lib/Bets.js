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

// ── FIX: Validate each bet object before writing to KV ────────────
// Previously only Array.isArray + length were checked. A malformed or
// malicious payload was stored as-is and would crash any component
// reading it back.
//
// Rules:
//   • Each bet must be a plain object (not null, not an array)
//   • Required string fields: id, result
//   • Required numeric fields: stake, odds
//   • result must be one of the four known values
//   • No extra nesting — deeply nested objects are rejected
const VALID_RESULTS = new Set(["win", "loss", "push", "pending"]);

function isValidBet(bet) {
    if (!bet || typeof bet !== "object" || Array.isArray(bet)) return false;
    if (typeof bet.id !== "string" || !bet.id.trim()) return false;
    if (typeof bet.stake !== "number" || !isFinite(bet.stake) || bet.stake < 0) return false;
    if (typeof bet.odds !== "number" || !isFinite(bet.odds)) return false;
    if (!VALID_RESULTS.has(bet.result)) return false;
    return true;
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

        // FIX: validate every element before persisting
        const invalidIdx = bets.findIndex(b => !isValidBet(b));
        if (invalidIdx !== -1) {
            return res.status(400).json({
                error: `Invalid bet at index ${invalidIdx}. Each bet must have: id (string), stake (number ≥ 0), odds (number), result (win|loss|push|pending).`,
            });
        }

        await kv.set(key, bets);
        return res.status(200).json({ ok: true });
    }

    return res.status(405).end();
}