// api/config.js — Vercel Serverless Function
// ─────────────────────────────────────────────────────────────────
// Returns feature availability flags to the client WITHOUT
// exposing the actual API keys. The client calls this once on
// mount to know which features are live vs showing sample data.
//
// Response shape:
//   { hasBdl: boolean, hasOdds: boolean, env: "production"|"development" }

export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  res.setHeader("Cache-Control", "s-maxage=3600"); // 1 hour — keys don't change
  res.setHeader("Content-Type", "application/json");

  return res.status(200).json({
    hasBdl: !!process.env.BDL_API_KEY,
    hasOdds: !!process.env.ODDS_API_KEY,
    env: process.env.NODE_ENV || "production",
    // Build timestamp for cache-busting
    built: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
  });
}
