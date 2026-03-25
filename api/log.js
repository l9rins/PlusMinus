// api/log.js — Structured error telemetry
//
// Accepts POST from client ErrorBoundary + unhandledrejection handler.
// Stores last 100 errors per-app (not per-user) in a KV ring buffer.
// GET (with admin token) returns the log for debugging.
//
// Client usage (in src/api.js or ErrorBoundary):
//   await fetch("/api/log", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({
//       level:   "error",          // "error" | "warn"
//       message: err.message,
//       stack:   err.stack?.slice(0, 500),
//       context: "ErrorBoundary",  // where it came from
//       url:     window.location.pathname,
//       build:   import.meta.env.VITE_BUILD_SHA ?? "dev",
//     }),
//   });

import { handleOptions, setCORSHeaders } from "./_cors.js";
import { createClient } from "@vercel/kv";
import { createClerkClient } from "@clerk/backend";

const kv = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
});

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

async function getUserId(req) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return null;
    try {
        const token = auth.slice(7);
        const { sub } = await clerk.verifyToken(token);
        return sub;
    } catch {
        return null;
    }
}

const LOG_KEY = "error_log:app";
const MAX_ENTRIES = 100;

const VALID_LEVELS = new Set(["error", "warn", "info"]);

function sanitizeEntry(body) {
    return {
        ts: new Date().toISOString(),
        level: VALID_LEVELS.has(body.level) ? body.level : "error",
        message: String(body.message ?? "unknown").slice(0, 300),
        stack: String(body.stack ?? "").slice(0, 600),
        context: String(body.context ?? "").slice(0, 100),
        url: String(body.url ?? "").slice(0, 200),
        build: String(body.build ?? "").slice(0, 20),
    };
}

export default async function handler(req, res) {
    if (handleOptions(req, res)) return;
    setCORSHeaders(res, req.headers.origin || "");

    // ── POST: ingest an error ──────────────────────────────────────
    if (req.method === "POST") {
        const userId = await getUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        try {
            const entry = sanitizeEntry(req.body ?? {});

            // Ring buffer: read → prepend → trim → write
            let log = [];
            try { log = (await kv.get(LOG_KEY)) ?? []; } catch { log = []; }

            log.unshift(entry);                      // newest first
            if (log.length > MAX_ENTRIES) log.length = MAX_ENTRIES;

            // Fire-and-forget write — don't block the response
            kv.set(LOG_KEY, log, { ex: 60 * 60 * 24 * 7 }) // 7-day TTL
                .catch(e => console.error("[api/log] KV write failed:", e));

            return res.status(204).end();
        } catch (err) {
            console.error("[api/log] Handler error:", err);
            return res.status(500).json({ error: "log write failed" });
        }
    }

    // ── GET: read the log (requires ADMIN_TOKEN env var) ──────────
    if (req.method === "GET") {
        const adminToken = process.env.ADMIN_TOKEN;
        if (!adminToken) return res.status(403).json({ error: "Admin access not configured" });

        const provided = req.headers["x-admin-token"] ?? req.query.token;
        if (provided !== adminToken) return res.status(403).json({ error: "Forbidden" });

        try {
            const log = (await kv.get(LOG_KEY)) ?? [];
            const { level, limit = "50" } = req.query;
            const filtered = log
                .filter(e => !level || e.level === level)
                .slice(0, Math.min(parseInt(limit, 10) || 50, MAX_ENTRIES));

            res.setHeader("Cache-Control", "no-store");
            return res.status(200).json({ count: filtered.length, entries: filtered });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    return res.status(405).end();
}