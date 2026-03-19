// api/config.js — Feature flags for the client
// hasEspn always true — ESPN needs no key.
// hasBdl gates player search only (standings/games now use ESPN).
// hasOdds gates the betting edge finder.
export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  res.setHeader("Cache-Control", "s-maxage=3600");
  res.setHeader("Content-Type", "application/json");
  return res.status(200).json({
    hasEspn: true,
    hasBdl: !!process.env.BDL_API_KEY,
    hasOdds: !!process.env.ODDS_API_KEY,
    env: process.env.NODE_ENV || "production",
    built: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
  });
}