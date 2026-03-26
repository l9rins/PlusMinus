// api/paper.js
// Virtual paper-betting engine. No real money — just "PlusMinus Coins" (PMC).
//
// Routes:
//   GET  /api/paper?action=bankroll          → user's balance + stats
//   GET  /api/paper?action=leaderboard       → global top-20 + model row
//   POST /api/paper   { action:"bet", ... }  → place a paper bet
//   POST /api/paper   { action:"settle" }    → cron: settle finished games
//   POST /api/paper   { action:"reset" }     → user resets bankroll to 1000
//
// Data schema in KV:
//   paper:bankroll:{userId}  → { balance, startedAt, totalBets, wins, losses, pl }
//   paper:bets:{userId}      → [ { id, matchup, pick, side, odds, stake, status, settledPL } ]
//   paper:lb                 → [ { userId, displayName, balance, roi, bets } ]  (rebuilt on settle)

import { handleOptions, setCORSHeaders } from "./_cors.js";
import { getUserId } from "./_auth.js";
import { createClient } from "@vercel/kv";
import { createClerkClient } from "@clerk/backend";

const kv    = createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

const STARTING_BALANCE = 1000;
const MIN_STAKE        = 10;
const MAX_STAKE_PCT    = 0.25; // max 25% of bankroll per bet

// ── Odds helpers (same as utils.js — duplicated server-side) ──
function oddsToDecimal(american) {
  const n = Number(american);
  if (!n || !isFinite(n)) return 1;
  return n > 0 ? 1 + n / 100 : 1 - 100 / n;
}

function calcWinnings(stake, odds) {
  return +(stake * (oddsToDecimal(odds) - 1)).toFixed(2);
}

// ── Model ROI benchmark (pulled from Elo KV cache) ────────────
// We simulate the model placing flat $100 bets on its top pick each night.
// This gives users something to beat on the leaderboard.
async function getModelStats() {
  try {
    const cached = await kv.get("paper:model_stats");
    if (cached) return cached;
  } catch { /* ignore */ }
  // Default if not yet computed
  return { displayName: "🤖 PlusMinus Model", balance: 1000, roi: 0, bets: 0, isModel: true };
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCORSHeaders(res, req.headers.origin || "");

  // Leaderboard is public — no auth needed
  if (req.method === "GET" && req.query.action === "leaderboard") {
    const [lb, modelStats] = await Promise.all([
      kv.get("paper:lb").catch(() => []),
      getModelStats(),
    ]);
    const board = (lb ?? [])
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 20)
      .map(({ userId: _removed, ...pub }) => pub); // drop internal ID
    return res.status(200).json({ leaderboard: [modelStats, ...board] });
  }

  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const bankrollKey = `paper:bankroll:${userId}`;
  const betsKey     = `paper:bets:${userId}`;

  // ── GET bankroll ───────────────────────────────────────────────
  if (req.method === "GET" && req.query.action === "bankroll") {
    const [bankroll, bets] = await Promise.all([
      kv.get(bankrollKey),
      kv.get(betsKey),
    ]);
    if (!bankroll) {
      // First visit — provision starting balance
      const initial = { balance: STARTING_BALANCE, startedAt: new Date().toISOString(), totalBets: 0, wins: 0, losses: 0, pl: 0 };
      await kv.set(bankrollKey, initial, { ex: 60 * 60 * 24 * 365 });
      return res.status(200).json({ bankroll: initial, bets: [] });
    }
    return res.status(200).json({ bankroll, bets: bets ?? [] });
  }

  if (req.method !== "POST") return res.status(405).end();

  let body;
  try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
  catch { body = {}; }

  // ── POST reset ─────────────────────────────────────────────────
  if (body.action === "reset") {
    const initial = { balance: STARTING_BALANCE, startedAt: new Date().toISOString(), totalBets: 0, wins: 0, losses: 0, pl: 0 };
    await Promise.all([
      kv.set(bankrollKey, initial, { ex: 60 * 60 * 24 * 365 }),
      kv.set(betsKey, [], { ex: 60 * 60 * 24 * 365 }),
    ]);
    return res.status(200).json({ ok: true, bankroll: initial });
  }

  // ── POST place bet ─────────────────────────────────────────────
  if (body.action === "bet") {
    const { matchup, pick, side, odds, stake, gameId } = body;
    if (!matchup || !pick || !odds || !stake) {
      return res.status(400).json({ error: "matchup, pick, odds, and stake are required" });
    }
    const stakeNum = Number(stake);
    if (!isFinite(stakeNum) || stakeNum < MIN_STAKE) {
      return res.status(400).json({ error: `Minimum stake is ${MIN_STAKE} PMC` });
    }

    const [bankroll, bets] = await Promise.all([
      kv.get(bankrollKey),
      kv.get(betsKey),
    ]);
    const br = bankroll ?? { balance: STARTING_BALANCE, totalBets: 0, wins: 0, losses: 0, pl: 0 };

    const maxStake = Math.floor(br.balance * MAX_STAKE_PCT);
    if (stakeNum > br.balance) {
      return res.status(400).json({ error: "Insufficient balance" });
    }
    if (stakeNum > maxStake) {
      return res.status(400).json({ error: `Max stake is ${maxStake} PMC (25% of bankroll)` });
    }

    const newBet = {
      id: crypto.randomUUID(),
      matchup,
      pick,
      side: side ?? null,
      odds: Number(odds),
      stake: stakeNum,
      gameId: gameId ?? null,
      status: "pending",
      settledPL: null,
      placedAt: new Date().toISOString(),
    };

    const updatedBankroll = { ...br, balance: +(br.balance - stakeNum).toFixed(2), totalBets: br.totalBets + 1 };
    const updatedBets = [newBet, ...(bets ?? [])].slice(0, 200);

    await Promise.all([
      kv.set(bankrollKey, updatedBankroll, { ex: 60 * 60 * 24 * 365 }),
      kv.set(betsKey, updatedBets, { ex: 60 * 60 * 24 * 365 }),
      kv.sadd("paper:users", userId),
    ]);

    return res.status(201).json({ bet: newBet, bankroll: updatedBankroll });
  }

  // ── POST settle (called by Vercel cron, not users) ─────────────
  // Reads finished game results from BDL, matches pending paper bets,
  // credits winnings, rebuilds leaderboard.
  if (body.action === "settle") {
    const provided = req.headers.authorization?.replace("Bearer ", "") ?? "";
    const expected = process.env.CRON_SECRET ?? "";
    if (!expected || provided !== expected) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Use a set instead of KEYS scan for O(1) user lookup
    const userIds = await kv.smembers("paper:users");
    const settled = [];

    for (const uid of userIds) {
      const bkKey = `paper:bankroll:${uid}`;
      const [bankroll, bets] = await Promise.all([
        kv.get(bkKey),
        kv.get(`paper:bets:${uid}`),
      ]);
      if (!bets?.length) continue;

      let updatedBankroll = { ...bankroll };
      const updatedBets = bets.map(bet => {
        if (bet.status !== "pending") return bet;

        // In production: look up bet.gameId in BDL final scores
        // For now, we expose a manual settle endpoint that Vercel cron
        // triggers after fetching game results in api/nba.js.
        // The actual result injection happens via body.results: { [gameId]: "home"|"away" }
        const resultMap = body.results ?? {};
        const winner = resultMap[bet.gameId];
        if (!winner) return bet; // game not finished yet

        const won = bet.side === winner;
        const pl  = won ? calcWinnings(bet.stake, bet.odds) : -bet.stake;
        if (won) {
          updatedBankroll.balance  = +(updatedBankroll.balance + bet.stake + calcWinnings(bet.stake, bet.odds)).toFixed(2);
          updatedBankroll.wins     = (updatedBankroll.wins ?? 0) + 1;
        } else {
          updatedBankroll.losses   = (updatedBankroll.losses ?? 0) + 1;
        }
        updatedBankroll.pl = +((updatedBankroll.pl ?? 0) + pl).toFixed(2);
        settled.push({ uid, betId: bet.id, pl });

        return { ...bet, status: won ? "win" : "loss", settledPL: pl };
      });

      await Promise.all([
        kv.set(bkKey, updatedBankroll, { ex: 60 * 60 * 24 * 365 }),
        kv.set(`paper:bets:${uid}`, updatedBets, { ex: 60 * 60 * 24 * 365 }),
      ]);
    }

    // Rebuild leaderboard from all users with > 0 bets
    const lbEntries = [];
    for (const uid of userIds) {
      const bkKey = `paper:bankroll:${uid}`;
      const br  = await kv.get(bkKey);
      if (!br || br.totalBets === 0) continue;

      // Fetch display name from Clerk — best-effort
      let displayName = "Anonymous";
      try {
        const user = await clerk.users.getUser(uid);
        displayName = user.username ?? user.firstName ?? "Anonymous";
      } catch { /* Clerk lookup failed */ }

      const startBalance = STARTING_BALANCE;
      const roi = br.totalBets > 0
        ? +(((br.balance - startBalance) / startBalance) * 100).toFixed(1)
        : 0;

      lbEntries.push({ userId: uid, displayName, balance: br.balance, roi, bets: br.totalBets, wins: br.wins ?? 0, losses: br.losses ?? 0 });
    }

    await kv.set("paper:lb", lbEntries, { ex: 60 * 60 * 24 });

    return res.status(200).json({ ok: true, settled: settled.length });
  }

  return res.status(400).json({ error: "Unknown action" });
}
