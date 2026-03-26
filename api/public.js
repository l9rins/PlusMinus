import config from "./_internal/config.js";
import nba from "./_internal/nba.js";
import espn from "./_internal/espn.js";
import bdl from "./_internal/bdl.js";
import elo from "./_internal/elo.js";
import injuries from "./_internal/injuries.js";
import refs from "./_internal/refs.js";

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
