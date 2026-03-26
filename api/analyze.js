// api/analyze.js — AI bet analysis via Anthropic Claude
//
// POST /api/analyze
// Accepts a bet object (game or prop) + optional context (standings, odds).
// Returns a structured analysis: value assessment, risk factors, historical
// ATS context, line movement interpretation, recommended action.
//
// Auth: Clerk JWT required — same pattern as /api/bets
// Rate limit: 1 request per 10s per user via KV timestamp guard
// Cost: ~500 input tokens + ~400 output tokens per call ≈ $0.0005 on Haiku

import { handleOptions, setCORSHeaders } from "./_cors.js";
import { getUserId } from "./_auth.js";
import { kv } from "./_kv.js";
import Anthropic from "@anthropic-ai/sdk";


const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MARKET_LABELS = {
    player_points: "Points",
    player_rebounds: "Rebounds",
    player_assists: "Assists",
    player_threes: "3-Pointers Made",
    player_blocks_steals: "Blocks + Steals",
};

// Build a tight, structured prompt from the bet + context
function buildPrompt(bet, context) {
    const lines = ["You are a sharp sports betting analyst. Analyze this bet concisely and objectively."];
    lines.push("");

    if (bet.type === "prop") {
        lines.push(`BET TYPE: Player Prop`);
        lines.push(`PLAYER: ${bet.player}${bet.playerTeam ? ` (${bet.playerTeam})` : ""}`);
        lines.push(`MARKET: ${MARKET_LABELS[bet.market] ?? bet.market}`);
        lines.push(`LINE: ${bet.side?.toUpperCase()} ${bet.line}`);
        lines.push(`ODDS: ${bet.odds > 0 ? "+" : ""}${bet.odds}`);
        lines.push(`STAKE: $${bet.stake}`);
        if (bet.matchup) lines.push(`GAME: ${bet.matchup}`);
        if (bet.book) lines.push(`BOOK: ${bet.book}`);
    } else if (bet.type === "parlay") {
        lines.push(`BET TYPE: Parlay (${bet.legCount ?? bet.legs?.length ?? "?"} legs)`);
        lines.push(`COMBINED ODDS: ${bet.odds > 0 ? "+" : ""}${bet.odds}`);
        lines.push(`STAKE: $${bet.stake}`);
        if (bet.legs?.length) {
            lines.push(`LEGS:`);
            bet.legs.forEach((l, i) => {
                lines.push(`  ${i + 1}. ${l.desc} (${l.odds > 0 ? "+" : ""}${l.odds})`);
            });
        }
    } else {
        lines.push(`BET TYPE: Game Bet`);
        if (bet.matchup) lines.push(`MATCHUP: ${bet.matchup}`);
        if (bet.team) lines.push(`SIDE: ${bet.team}`);
        lines.push(`ODDS: ${bet.odds > 0 ? "+" : ""}${bet.odds}`);
        lines.push(`STAKE: $${bet.stake}`);
        if (bet.book) lines.push(`BOOK: ${bet.book}`);
    }

    if (bet.note) lines.push(`BETTOR'S NOTE: "${bet.note}"`);

    // Inject live context if provided
    if (context?.bookComparison) {
        lines.push("");
        lines.push(`MARKET CONTEXT: ${context.bookComparison}`);
    }
    if (context?.propHistory) {
        lines.push(`RECENT FORM: ${context.propHistory}`);
    }
    if (context?.lineMove) {
        lines.push(`LINE MOVEMENT: ${context.lineMove}`);
    }

    lines.push("");
    lines.push(`Respond in this EXACT JSON format (no markdown, no explanation outside the JSON):
{
  "verdict": "value" | "fair" | "avoid",
  "confidence": 1-10,
  "impliedProbability": number (0-100, what the odds imply),
  "edgeSummary": "one sentence — what makes this bet good or bad",
  "riskFactors": ["factor 1", "factor 2"],
  "positiveFactors": ["factor 1", "factor 2"],
  "recommendation": "one actionable sentence",
  "kellyNote": "one sentence on sizing given the stake"
}`);

    return lines.join("\n");
}

export default async function handler(req, res) {
    if (handleOptions(req, res)) return;
    setCORSHeaders(res, req.headers.origin || "");
    if (req.method !== "POST") return res.status(405).end();

    // ── Auth ────────────────────────────────────────────────────────
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // ── Rate limit: 1 req / 10s per user ───────────────────────────
    const rateLimitKey = `analyze_rl:${userId}`;
    const lastCall = await kv.get(rateLimitKey).catch(() => null);
    if (lastCall) {
        const elapsed = Date.now() - lastCall;
        if (elapsed < 10_000) {
            const retryAfter = Math.ceil((10_000 - elapsed) / 1000);
            res.setHeader("Retry-After", String(retryAfter));
            return res.status(429).json({
                error: `Rate limited. Try again in ${retryAfter}s.`,
            });
        }
    }
    // Record timestamp — fire and forget
    kv.set(rateLimitKey, Date.now(), { ex: 15 }).catch(() => { });

    // ── Validate input ──────────────────────────────────────────────
    const { bet, context } = req.body ?? {};
    if (!bet || typeof bet !== "object") {
        return res.status(400).json({ error: "bet object required" });
    }
    if (typeof bet.odds !== "number" || !isFinite(bet.odds)) {
        return res.status(400).json({ error: "bet.odds must be a valid number" });
    }
    if (typeof bet.stake !== "number" || bet.stake < 0) {
        return res.status(400).json({ error: "bet.stake must be >= 0" });
    }

    // ── Call Claude ────────────────────────────────────────────────
    const prompt = buildPrompt(bet, context);

    try {
        const message = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",  // fast + cheap for structured output
            max_tokens: 512,
            messages: [{ role: "user", content: prompt }],
        });

        const raw = message.content
            .filter(b => b.type === "text")
            .map(b => b.text)
            .join("")
            .trim();

        // Strip accidental markdown fences
        const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

        let analysis;
        try {
            analysis = JSON.parse(cleaned);
        } catch {
            // Model returned non-JSON — surface gracefully
            return res.status(500).json({ error: "Analysis parse failed", raw: cleaned.slice(0, 200) });
        }

        // Validate required fields before returning
        const required = ["verdict", "confidence", "impliedProbability", "edgeSummary", "recommendation"];
        for (const field of required) {
            if (analysis[field] === undefined) {
                return res.status(500).json({ error: `Missing field in analysis: ${field}` });
            }
        }

        // Sanitize — clamp confidence, probability
        analysis.confidence = Math.max(1, Math.min(10, Number(analysis.confidence) || 5));
        analysis.impliedProbability = Math.max(0, Math.min(100, Number(analysis.impliedProbability) || 50));
        analysis.verdict = ["value", "fair", "avoid"].includes(analysis.verdict) ? analysis.verdict : "fair";
        analysis.riskFactors = (analysis.riskFactors ?? []).slice(0, 4).map(s => String(s).slice(0, 120));
        analysis.positiveFactors = (analysis.positiveFactors ?? []).slice(0, 4).map(s => String(s).slice(0, 120));
        analysis.edgeSummary = String(analysis.edgeSummary ?? "").slice(0, 200);
        analysis.recommendation = String(analysis.recommendation ?? "").slice(0, 200);
        analysis.kellyNote = String(analysis.kellyNote ?? "").slice(0, 200);

        // No caching — each analysis should be fresh
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json({ analysis, tokensUsed: message.usage?.input_tokens ?? null });

    } catch (err) {
        if (err.status === 429) return res.status(429).json({ error: "AI rate limited — try again shortly" });
        if (err.name === "TimeoutError") return res.status(503).json({ error: "AI timed out" });
        console.error("[api/analyze]", err);
        return res.status(502).json({ error: err.message });
    }
}