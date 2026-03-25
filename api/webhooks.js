// api/webhooks.js — Store/retrieve user webhook URLs
import { handleOptions, setCORSHeaders } from "./_cors.js";
import { createClerkClient } from "@clerk/backend";
import { createClient } from "@vercel/kv";

const kv    = createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

async function getUserId(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  try { const { sub } = await clerk.verifyToken(auth.slice(7)); return sub; }
  catch { return null; }
}

// Validate Discord webhook URL format
function isValidDiscordWebhook(url) {
  return /^https:\/\/discord(app)?\.com\/api\/webhooks\/\d+\/.+$/.test(url);
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCORSHeaders(res, req.headers.origin || "");
  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const key = `webhooks:${userId}`;

  if (req.method === "GET") {
    const webhooks = await kv.get(key).catch(() => null);
    // Never return actual URLs to client — just whether they're configured
    return res.status(200).json({
      discord:  !!webhooks?.discord,
      telegram: !!webhooks?.telegram,
    });
  }

  if (req.method === "PUT") {
    let body;
    try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
    catch { return res.status(400).json({ error: "Invalid JSON" }); }

    const current = (await kv.get(key).catch(() => null)) ?? {};
    const updated = { ...current };

    if ("discord" in body) {
      if (body.discord === null) {
        delete updated.discord;
      } else if (!isValidDiscordWebhook(body.discord)) {
        return res.status(400).json({ error: "Invalid Discord webhook URL" });
      } else {
        // Test the webhook before saving
        try {
          const test = await fetch(body.discord, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: "✅ PlusMinus alerts connected!" }),
            signal: AbortSignal.timeout(5000),
          });
          if (!test.ok && test.status !== 204) {
            return res.status(400).json({ error: "Discord webhook test failed — check the URL" });
          }
        } catch {
          return res.status(400).json({ error: "Could not reach Discord webhook" });
        }
        updated.discord = body.discord;
      }
    }

    if ("telegram" in body) {
      if (body.telegram === null) {
        delete updated.telegram;
      } else {
        updated.telegram = { botToken: body.telegram.botToken, chatId: body.telegram.chatId };
      }
    }

    await kv.set(key, updated, { ex: 60 * 60 * 24 * 365 });
    return res.status(200).json({ ok: true, discord: !!updated.discord, telegram: !!updated.telegram });
  }

  return res.status(405).end();
}
