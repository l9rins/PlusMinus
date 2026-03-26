import bets from "./_internal/bets.js";
import paper from "./_internal/paper.js";
import webhooks from "./_internal/webhooks.js";
import notify from "./_internal/notify.js";
import odds from "./_internal/odds.js";
import props from "./_internal/props.js";
import log from "./_internal/log.js";

export default async function handler(req, res) {
  try {
    const route = req.query.route || req.url.split("/api/").pop()?.split("?")[0];
    
    // Log the incoming request to Vercel logs to help debug 500s
    console.info(`[api/private] Processing route: ${route} (url: ${req.url})`);

    // Allow HEAD probes for all private routes (used by some health checks)
    if (req.method === "HEAD") return res.status(200).end();

    switch (route) {
      case "bets":     return await bets(req, res);
      case "paper":    return await paper(req, res);
      case "webhooks": return await webhooks(req, res);
      case "notify":   return await notify(req, res);
      case "odds":     return await odds(req, res);
      case "props":    return await props(req, res);
      case "log":      return await log(req, res);
      default:
        // Return 404 instead of letting it fall through to a potentially broken state
        return res.status(404).json({ error: `Private route '${route}' not found`, debugUrl: req.url });
    }
  } catch (err) {
    console.error(`[api/private] Fatal Error:`, err);
    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
}
