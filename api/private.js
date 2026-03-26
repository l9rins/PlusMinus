import bets from "./_internal/bets.js";
import paper from "./_internal/paper.js";
import webhooks from "./_internal/webhooks.js";
import notify from "./_internal/notify.js";
import odds from "./_internal/odds.js";
import props from "./_internal/props.js";
import log from "./_internal/log.js";

export default async function handler(req, res) {
  const route = req.query.route || req.url.split("/").pop()?.split("?")[0];

  switch (route) {
    case "bets":     return bets(req, res);
    case "paper":    return paper(req, res);
    case "webhooks": return webhooks(req, res);
    case "notify":   return notify(req, res);
    case "odds":     return odds(req, res);
    case "props":    return props(req, res);
    case "log":      return log(req, res);
    default:
      return res.status(404).json({ error: `Private route '${route}' not found` });
  }
}
