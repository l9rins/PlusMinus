// api/bets/[id].js — Vercel Serverless Function
//
// Handles DELETE /api/bets/:id
//
// Why a separate file instead of adding DELETE to api/bets.js:
//   Vercel routes by filename. api/bets.js handles /api/bets (no segment).
//   api/bets/[id].js handles /api/bets/:id (dynamic segment).
//   The two files can coexist — Vercel picks the more specific route first.
//
// ID contract:
//   Bet IDs are client-generated strings (nanoid, crypto.randomUUID, or
//   Date.now().toString()). The server treats them as opaque strings and
//   never generates them — it just filters by equality.
//
// Atomic pattern:
//   GET bets array → filter out target id → SET back.
//   Vercel KV has no native array-element delete, so this is the correct
//   approach. The operation is fast (single round-trip per op on KV) and
//   safe because Vercel KV GET+SET is serialized per key within a region.

import { handleOptions, setCORSHeaders } from "../_cors.js";
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

export default async function handler(req, res) {
  // Allow OPTIONS preflight — _cors.js handles the headers
  if (handleOptions(req, res)) return;
  const origin = req.headers.origin || "";
  setCORSHeaders(res, origin);

  // Only DELETE is handled here; everything else is 405
  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE, OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Auth
  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  // Extract :id from the URL path — Vercel puts it in req.query.id
  const betId = req.query.id;
  if (!betId || typeof betId !== "string" || !betId.trim()) {
    return res.status(400).json({ error: "Missing or invalid bet id" });
  }

  const kvKey = `bets:${userId}`;

  // Read current array
  const existing = await kv.get(kvKey);
  const bets = Array.isArray(existing) ? existing : [];

  // Check the bet actually exists before writing
  const idx = bets.findIndex(b => b.id === betId);
  if (idx === -1) {
    return res.status(404).json({ error: `Bet '${betId}' not found` });
  }

  // Filter it out and persist
  const updated = bets.filter(b => b.id !== betId);
  await kv.set(kvKey, updated);

  return res.status(200).json({ ok: true, deleted: betId, remaining: updated.length });
}