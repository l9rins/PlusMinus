// api/config.js — Feature flags + Odds API credit monitor
import { setCORSHeaders, handleOptions } from "./_cors.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") return res.status(405).end();
  setCORSHeaders(res, req.headers.origin || "");

  const hasOdds = !!process.env.ODDS_API_KEY;

  // ── Odds API usage check ────────────────────────────────────────
  // The Odds API exposes remaining credits in the response headers of
  // every call (x-requests-remaining, x-requests-used). We can also
  // hit the dedicated usage endpoint to get the quota without spending
  // a request credit. Cache this for 5 minutes — no need to hit it more.
  let oddsCredits = null;
  if (hasOdds) {
    try {
      const usageRes = await fetch(
        `https://api.the-odds-api.com/v4/sports?apiKey=${process.env.ODDS_API_KEY}`,
        { signal: AbortSignal.timeout(4000) }
      );
      // Credits come back in response headers regardless of endpoint
      const remaining = usageRes.headers.get("x-requests-remaining");
      const used = usageRes.headers.get("x-requests-used");
      if (remaining !== null) {
        oddsCredits = {
          remaining: parseInt(remaining, 10),
          used: used !== null ? parseInt(used, 10) : null,
        };
      }
    } catch {
      // Non-fatal — credits just won't show in UI
    }
  }

  // Cache 5 min — credits update after every API call so no need to hammer this
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
  res.setHeader("Content-Type", "application/json");
  return res.status(200).json({
    hasEspn: true,
    hasBdl: !!process.env.BDL_API_KEY,
    hasOdds,
    oddsCredits, // null if key missing or fetch failed
    env: process.env.NODE_ENV || "production",
    built: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
  });
}