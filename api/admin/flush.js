import { handleOptions, setCORSHeaders } from "../_cors.js";
import { createClient } from "@vercel/kv";

const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCORSHeaders(res, req.headers.origin || "");

  // 1. Secure the endpoint
  const providedSecret = req.headers.authorization?.replace("Bearer ", "");
  if (!process.env.ADMIN_SECRET || providedSecret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // 2. Execute the flush
  const { target } = req.query;
  
  try {
    if (target === "odds") {
      await kv.del("odds_cache");
      return res.status(200).json({ success: true, message: "Odds cache flushed" });
    }
    
    if (target) {
      await kv.del(target);
      return res.status(200).json({ success: true, message: `Key '${target}' flushed` });
    }

    return res.status(400).json({ error: "Must specify ?target=key_name" });
  } catch (err) {
    console.error("[api/admin/flush] Error:", err);
    return res.status(500).json({ error: "Failed to flush cache" });
  }
}
