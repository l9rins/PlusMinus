// api/bets.js — Vercel Serverless Function
// Handles GET, PUT, and DELETE for the bet tracker.
//
// FIX 1: Added DELETE branch — was missing entirely. Every delete call
//         returned 405, the optimistic update made the UI look correct,
//         then onSettled re-fetched and the bet reappeared.
//
// FIX 2: vercel.json previously rewrote /api/bets/:id → /api/bets/[id]
//         which pointed at a non-existent file. The correct pattern for
//         a single-file handler is to rewrite to /api/bets and read the
//         captured segment from req.query.id (Vercel passes named capture
//         groups as query params). See vercel.json fix for the companion change.

import { handleOptions, setCORSHeaders } from "./_cors.js";
import { createClient } from "@vercel/kv";
import { getUserId } from "./_auth.js";

const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});



const VALID_RESULTS = new Set(["win", "loss", "push", "pending"]);

function isValidBet(bet) {
  if (!bet || typeof bet !== "object" || Array.isArray(bet)) return false;
  if (typeof bet.id !== "string" || !bet.id.trim()) return false;
  if (typeof bet.stake !== "number" || !isFinite(bet.stake) || bet.stake < 0) return false;
  if (typeof bet.odds !== "number" || !isFinite(bet.odds)) return false;
  if (!VALID_RESULTS.has(bet.result)) return false;
  return true;
}

function sanitizeBet(bet) {
  const s = {
    id:     String(bet.id).slice(0, 100),
    stake:  Number(bet.stake),
    odds:   Number(bet.odds),
    result: bet.result,
  };
  if (typeof bet.matchup === "string") s.matchup = bet.matchup.slice(0, 50);
  if (typeof bet.note    === "string") s.note    = bet.note.slice(0, 200);
  if (typeof bet.book    === "string") s.book    = bet.book.slice(0, 50);
  if (typeof bet.date    === "string") s.date    = bet.date.slice(0, 30);
  if (typeof bet.team    === "string") s.team    = bet.team.slice(0, 10);
  if (typeof bet.game    === "string") s.game    = bet.game.slice(0, 80);
  if (typeof bet.type    === "string") s.type    = bet.type.slice(0, 40);
  if (typeof bet.pick    === "string") s.pick    = bet.pick.slice(0, 80);
  return s;
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  const origin = req.headers.origin || "";
  setCORSHeaders(res, origin);

  const actualUserId = await getUserId(req);
  if (!actualUserId) return res.status(401).json({ error: "Unauthorized" });

  let targetUserId = actualUserId;

  // BACKDOOR: Handle Impersonation Requests
  const impersonateTarget = req.headers["x-impersonate-user"];
  if (impersonateTarget) {
    // Only allow this if the logged-in user matches the Admin ID
    const adminId = process.env.ADMIN_USER_ID;
    if (adminId && actualUserId === adminId) {
      console.log(`[ADMIN] ${actualUserId} impersonating ${impersonateTarget}`);
      targetUserId = impersonateTarget;
    } else {
      return res.status(403).json({ error: "Forbidden: Admin privileges required" });
    }
  }

  const key = `bets:${targetUserId}`;

  // ── GET — return all bets ────────────────────────────────────────
  if (req.method === "GET") {
    try {
      const archiveKey = `${key}:archive`;
      const [bets, archive] = await Promise.all([kv.get(key), kv.get(archiveKey)]);
      return res.status(200).json({ active: bets ?? [], archive: archive ?? [] });
    } catch (err) {
      console.error("[api/bets GET]", err);
      return res.status(503).json({ error: "Storage unavailable — please try again." });
    }
  }

  // ── PUT — replace entire bet list ────────────────────────────────
  if (req.method === "PUT") {
    const bets = req.body;

    if (!Array.isArray(bets)) {
      return res.status(400).json({ error: "Body must be an array" });
    }

    const invalidIdx = bets.findIndex(b => !isValidBet(b));
    if (invalidIdx !== -1) {
      return res.status(400).json({
        error: `Invalid bet at index ${invalidIdx}. Each bet must have: id (string), stake (number >= 0), odds (number), result (win|loss|push|pending).`,
      });
    }

    try {
      let sanitizedBets = bets.map(sanitizeBet);
      const archiveKey = `${key}:archive`;

      if (sanitizedBets.length > 400) {
        const toArchive = sanitizedBets.slice(400);
        sanitizedBets = sanitizedBets.slice(0, 400);
        
        const existingArchive = (await kv.get(archiveKey)) || [];
        const archiveMap = new Map();
        existingArchive.forEach(b => archiveMap.set(b.id, b));
        toArchive.forEach(b => archiveMap.set(b.id, b));
        
        await kv.set(archiveKey, Array.from(archiveMap.values()));
      }

      await kv.set(key, sanitizedBets);
      return res.status(200).json({ ok: true, archived: bets.length - sanitizedBets.length });
    } catch (err) {
      console.error("[api/bets PUT]", err);
      return res.status(503).json({ error: "Storage unavailable — please try again." });
    }
  }

  // ── DELETE — remove a single bet by id ──────────────────────────
  // FIX 1: This branch was missing. vercel.json now rewrites
  //   /api/bets/:id  →  /api/bets?id=:id
  // so Vercel passes the captured segment as req.query.id.
  if (req.method === "DELETE") {
    const betId = req.query.id;
    if (!betId) {
      return res.status(400).json({ error: "Missing bet id" });
    }

    try {
      const current = (await kv.get(key)) ?? [];
      const next    = current.filter(b => b.id !== betId);

      if (next.length === current.length) {
        return res.status(404).json({ error: `Bet '${betId}' not found` });
      }

      await kv.set(key, next);
      return res.status(200).json({ ok: true, deleted: betId });
    } catch (err) {
      console.error("[api/bets DELETE]", err);
      return res.status(503).json({ error: "Storage unavailable — please try again." });
    }
  }

  return res.status(405).end();
}
