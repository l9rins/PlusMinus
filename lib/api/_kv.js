// api/_kv.js — Shared Vercel KV helper
// Prevents module initialization crashes when KV credentials are missing.

import { createClient } from "@vercel/kv";

let kv = null;

try {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (url && token) {
    kv = createClient({ url, token });
  } else {
    // Return a dummy client that returns null for gets and does nothing for sets.
    // This allows non-auth/non-KV functions to still run without crashing.
    kv = {
      get: async (key) => {
        console.warn(`[api/_kv] KV not initialized, cannot get key: ${key}`);
        return null;
      },
      set: async (key, val) => {
        console.warn(`[api/_kv] KV not initialized, cannot set key: ${key}`);
        return null;
      },
      del: async (key) => {
        console.warn(`[api/_kv] KV not initialized, cannot delete key: ${key}`);
        return null;
      },
      // ... add other methods as needed, or keep minimal
    };
  }
} catch (err) {
  console.error("[api/_kv] Failed to initialize KV client:", err.message);
}

export { kv };
