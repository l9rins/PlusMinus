import config from "./_internal/config.js";
import nba from "./_internal/nba.js";
import espn from "./_internal/espn.js";
import bdl from "./_internal/bdl.js";
import elo from "./_internal/elo.js";
import injuries from "./_internal/injuries.js";
import refs from "./_internal/refs.js";

export default async function handler(req, res) {
  const route = req.query.route || req.url.split("/").pop()?.split("?")[0];

  switch (route) {
    case "config":   return config(req, res);
    case "nba":      return nba(req, res);
    case "espn":     return espn(req, res);
    case "bdl":      return bdl(req, res);
    case "elo":      return elo(req, res);
    case "injuries": return injuries(req, res);
    case "refs":     return refs(req, res);
    default:
      return res.status(404).json({ error: `Public route '${route}' not found` });
  }
}
