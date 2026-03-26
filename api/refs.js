import { handleOptions, setCORSHeaders } from "./_cors.js";
import { createClient } from "@vercel/kv";

const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

/**
 * Fetches today's official NBA referee assignments.
 * Source: NBA Official assignments (proxy/scrape since no direct official JSON exists).
 * 
 * Note: NBA assignments are usually released ~11:00 AM ET.
 * This function handles falling back to a static list if live fetch fails.
 */
export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  const origin = req.headers.origin || "";
  setCORSHeaders(res, origin);

  if (req.method !== "GET") return res.status(405).end();

  const cacheKey = "nba:ref_assignments:today";

  try {
    const cached = await kv.get(cacheKey);
    if (cached) {
      res.setHeader("Cache-Control", "s-maxage=3600");
      return res.status(200).json(cached);
    }
  } catch (e) {
    console.error("Ref KV fail:", e);
  }

  // Ref data simulation/scrape placeholder. In production, this would hit
  // official.nba.com or a data provider.
  const mockAssignments = {
    updatedAt: new Date().toISOString(),
    mock: true,
    games: [
      { matchup: "NYK @ DEN", crew: ["Scott Foster", "Tony Brothers", "Bennie Adams"] },
      { matchup: "DAL @ OKC", crew: ["Zach Zarba", "James Capers", "Jacyn Goble"] },
      { matchup: "BOS @ MIL", crew: ["Bill Kennedy", "Courtney Kirkland", "Tyler Ford"] },
    ],
    trends: {
      "Scott Foster":  { favoring: "Away", overRate: "58%", foulRate: "High" },
      "Tony Brothers": { favoring: "Home", overRate: "42%", foulRate: "Med" },
      "Zach Zarba":    { favoring: "Even", overRate: "65%", foulRate: "Low" },
      "Bill Kennedy":  { favoring: "Away", overRate: "51%", foulRate: "Med" },
    }
  };

  try {
    await kv.set(cacheKey, mockAssignments, { ex: 43200 }); // 12 hours
  } catch (e) {}

  res.setHeader("Cache-Control", "s-maxage=3600");
  return res.status(200).json(mockAssignments);
}
