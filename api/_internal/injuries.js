// api/injuries.js
// Fetches today's injury/status report from BallDontLie.
// Returns: { [teamAbbr]: [ { name, status, pos } ] }
// Used by api/elo.js to apply dynamic Elo penalties per game.
//
// Status values from BDL: "Active", "Out", "Questionable", "Doubtful", "Day-To-Day"
// We cache in KV for 30 minutes — injury status changes throughout the day.

import { handleOptions, setCORSHeaders } from "./_cors.js";
import { kv } from "./_kv.js";

// Rough "value" weight per player — how many Elo points the team loses
// if this player sits out. Based on VORP-equivalent tiers.
// These are intentionally conservative estimates.
const PLAYER_VALUES = {
  // MVP-tier: -80 to -100 Elo
  "Nikola Jokic":              95,
  "Shai Gilgeous-Alexander":   90,
  "Giannis Antetokounmpo":     88,
  "Luka Doncic":               85,
  "Victor Wembanyama":         82,

  // All-Star tier: -50 to -75 Elo
  "LeBron James":              72,
  "Jayson Tatum":              68,
  "Anthony Edwards":           65,
  "Jalen Brunson":             62,
  "Tyrese Haliburton":         58,
  "Cade Cunningham":           55,
  "Scottie Barnes":            50,
  "Trae Young":                50,
  "Paolo Banchero":            50,
  "Alperen Sengun":            48,

  // Starter tier: -20 to -40 Elo
  // (add more as needed)
};

// Penalty multiplier by status
const STATUS_PENALTY = {
  "Out":         1.0,   // full penalty
  "Doubtful":    0.8,   // 80% chance they miss it
  "Questionable":0.4,   // 40% chance they miss it
  "Day-To-Day":  0.25,
  "Active":      0,     // no penalty
};

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCORSHeaders(res, req.headers.origin || "");
  if (req.method !== "GET") return res.status(405).end();

  const CACHE_KEY = "injuries:today";
  try {
    const cached = await kv.get(CACHE_KEY);
    if (cached) {
      res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=300");
      return res.status(200).json(cached);
    }
  } catch { /* skip cache on error */ }

  const apiKey = process.env.BDL_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "BDL_API_KEY not configured" });

  try {
    // BDL v1: GET /player_injuries returns current injury report
    const res2 = await fetch("https://api.balldontlie.io/nba/v1/player_injuries?per_page=100", {
      headers: { Authorization: apiKey },
      signal: AbortSignal.timeout(8000),
    });

    if (!res2.ok) {
      return res.status(res2.status).json({ error: `BDL ${res2.status}` });
    }

    const data = await res2.json();
    const injuries = data.data ?? [];

    // Group by team abbreviation
    const byTeam = {};
    const eloAdjustments = {}; // { [teamAbbr]: number } — total Elo penalty to apply

    for (const entry of injuries) {
      const abbr = entry.team?.abbreviation;
      if (!abbr) continue;

      const playerName = `${entry.player?.first_name} ${entry.player?.last_name}`;
      const status     = entry.status ?? "Active";
      const multiplier = STATUS_PENALTY[status] ?? 0;
      const baseValue  = PLAYER_VALUES[playerName] ?? 0;
      const penalty    = +(baseValue * multiplier).toFixed(1);

      if (!byTeam[abbr]) byTeam[abbr] = [];
      byTeam[abbr].push({
        name:    playerName,
        status,
        pos:     entry.player?.position ?? "—",
        penalty,
      });

      if (penalty > 0) {
        eloAdjustments[abbr] = +((eloAdjustments[abbr] ?? 0) + penalty).toFixed(1);
      }
    }

    const result = { byTeam, eloAdjustments, fetchedAt: new Date().toISOString() };

    try {
      await kv.set(CACHE_KEY, result, { ex: 1800 }); // 30 min TTL
    } catch { /* cache write failed — still return data */ }

    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=300");
    return res.status(200).json(result);

  } catch (err) {
    if (err.name === "TimeoutError") return res.status(503).json({ error: "BDL timed out — retrying" });
    return res.status(502).json({ error: err.message });
  }
}
