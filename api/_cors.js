const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "http://localhost:5173",
]);

const VERCEL_PREVIEW_RE = /^https:\/\/[a-zA-Z0-9-]+-[a-zA-Z0-9]+\.vercel\.app$/;

export function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (VERCEL_PREVIEW_RE.test(origin)) return true;
  if (process.env.PRODUCTION_ORIGIN && origin === process.env.PRODUCTION_ORIGIN) return true;
  return false;
}

export function setCORSHeaders(res, origin) {
  res.setHeader("Vary", "Origin");
  if (isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
}

export function handleOptions(req, res) {
  if (req.method !== "OPTIONS") return false;
  const origin = req.headers.origin || "";
  setCORSHeaders(res, origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,PUT,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.status(204).end();
  return true;
}
