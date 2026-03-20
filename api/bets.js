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

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  const origin = req.headers.origin || "";
  setCORSHeaders(res, origin);

  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const key = `bets:${userId}`;

  if (req.method === "GET") {
    const bets = await kv.get(key);
    return res.status(200).json(bets ?? []);
  }

  if (req.method === "PUT") {
    const bets = req.body;
    if (!Array.isArray(bets)) return res.status(400).json({ error: "Body must be array" });
    await kv.set(key, bets);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
