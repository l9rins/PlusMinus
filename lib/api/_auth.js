// api/_auth.js — Shared Clerk authentication helper
// Extracted from bets.js, stream.js, webhooks.js, analyze.js to avoid duplication.

import { clerk } from "./_clerk.js";

/**
 * Extract and verify a Clerk JWT from the Authorization header.
 * Returns the Clerk user ID (sub claim) or null if invalid/missing.
 */
export async function getUserId(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    if (!clerk) return null;
    const { sub } = await clerk.verifyToken(auth.slice(7));
    return sub;
  } catch {
    return null;
  }
}

/**
 * Extract and verify a Clerk JWT from a query parameter (for SSE/EventSource).
 * EventSource can't set headers, so tokens are passed as ?token=...
 */
export async function getUserIdFromQuery(req) {
  const token = req.query.token;
  if (!token) return null;
  try {
    if (!clerk) return null;
    const { sub } = await clerk.verifyToken(token);
    return sub;
  } catch {
    return null;
  }
}
