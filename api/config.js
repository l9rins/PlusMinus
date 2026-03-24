// api/config.js — Feature flags for the client
//
// FIX 11: Removed `env` and `built` fields from the response.
//   - `built` (VERCEL_GIT_COMMIT_SHA slice) let attackers correlate the
//     deployed bundle with the exact public commit, trivially revealing the
//     full source tree. This is an unauthenticated endpoint — no auth required.
//   - `env` (NODE_ENV) leaking as "development" in staging exposed dev-mode
//     error verbosity. Neither field is consumed by any frontend component;
//     only hasBdl and hasOdds are read by useServerConfig().

import { setCORSHeaders, handleOptions } from "./_cors.js";

export default function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") return res.status(405).end();
  const origin = req.headers.origin || "";
  setCORSHeaders(res, origin);
  res.setHeader("Cache-Control", "s-maxage=3600");
  res.setHeader("Content-Type", "application/json");
  return res.status(200).json({
    hasEspn: true,
    hasBdl:  !!process.env.BDL_API_KEY,
    hasOdds: !!process.env.ODDS_API_KEY,
    // NOTE: do NOT add env or build info here — this endpoint is unauthenticated.
  });
}
