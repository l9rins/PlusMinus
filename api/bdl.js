// api/bdl.js — Vercel Serverless Function
const BASE = "https://api.balldontlie.io/nba/v1";

import { setCORSHeaders, handleOptions } from "./_cors.js";

function cacheTTL(path) {
  if (path.startsWith("/games")) return 90;
  if (path.startsWith("/players?search")) return 300;
  return 600;
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  const origin = req.headers.origin || "";
  setCORSHeaders(res, origin);

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.BDL_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "BDL_API_KEY not configured on server" });

  const path = req.query.path;
  if (!path || typeof path !== "string") {
    return res.status(400).json({ error: "Missing ?path= parameter" });
  }

  // FIX: normalize the path through the URL constructor before validating.
  //
  // Previous code: ALLOWED_PREFIXES.some(p => path.startsWith(p))
  // A client could send ?path=/players/../../admin/secret — this passes
  // startsWith("/players") but when appended to BASE and fetched, the HTTP
  // client resolves the ../ segments and probes an unintended upstream endpoint
  // using your BDL API key.
  //
  // Fix: parse with a dummy base URL so the browser/Node URL resolver collapses
  // any ../ or ./ sequences, then validate the fully-normalized pathname.
  // After normalization, /players/../admin/secret becomes /admin/secret, which
  // fails the allowlist check and returns 400 before any upstream request is made.
  let normalizedPath;
  try {
    const parsed = new URL(path, "https://dummy.invalid");
    // Reconstruct path + query from the normalized URL
    normalizedPath = parsed.pathname + (parsed.search || "");
  } catch {
    return res.status(400).json({ error: "Invalid path parameter" });
  }

  const ALLOWED_PREFIXES = ["/games", "/standings", "/players", "/season_averages"];
  if (!ALLOWED_PREFIXES.some(p => normalizedPath.startsWith(p))) {
    return res.status(400).json({ error: "Path not allowed" });
  }

  try {
    const upstream = await fetch(`${BASE}${normalizedPath}`, {
      headers: { Authorization: apiKey },
      signal: AbortSignal.timeout(8000),
    });

    // Forward Retry-After so the client backs off correctly
    if (upstream.status === 429) {
      const retryAfter = upstream.headers.get("Retry-After") || "60";
      res.setHeader("Retry-After", retryAfter);
      return res.status(429).json({ error: `BDL rate limited. Retry in ${retryAfter}s` });
    }

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return res.status(upstream.status).json({
        error: `BDL upstream error ${upstream.status}`,
        detail: text.slice(0, 200),
      });
    }

    const data = await upstream.json();
    const ttl = cacheTTL(normalizedPath);

    res.setHeader("Cache-Control", `s-maxage=${ttl}, stale-while-revalidate=30`);
    res.setHeader("Content-Type", "application/json");

    return res.status(200).json(data);
  } catch (err) {
    if (err.name === "TimeoutError") return res.status(504).json({ error: "BDL upstream timed out" });
    console.error("[api/bdl] Error:", err);
    return res.status(502).json({ error: "Upstream fetch failed", message: err.message });
  }
}