import config from "../lib/api/config.js";
import nba from "../lib/api/nba.js";
import espn from "../lib/api/espn.js";
import bdl from "../lib/api/bdl.js";
import elo from "../lib/api/elo.js";
import injuries from "../lib/api/injuries.js";
import refs from "../lib/api/refs.js";

export default async function handler(req, res) {
  try {
    const route = req.query.route || req.url.split("/api/").pop()?.split("?")[0];

    // Log the incoming request to Vercel logs to help debug 500s
    console.info(`[api/public] Processing route: ${route} (url: ${req.url})`);

    // Allow HEAD probes for all public routes (used by some health checks)
    if (req.method === "HEAD") return res.status(200).end();

    switch (route) {
      case "config":   return await config(req, res);
      case "nba":      return await nba(req, res);
      case "espn":     return await espn(req, res);
      case "bdl":      return await bdl(req, res);
      case "elo":      return await elo(req, res);
      case "injuries": return await injuries(req, res);
      case "refs":     return await refs(req, res);
      default:
        // Return 404 instead of letting it fall through to a potentially broken state
        return res.status(404).json({ error: `Public route '${route}' not found`, debugUrl: req.url });
    }
  } catch (err) {
    console.error(`[api/public] Fatal Error:`, err);
    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
}
