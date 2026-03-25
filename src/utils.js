// ─── PlusMinus Utilities ──────────────────────────────────────────
// Additional fixes layered on top of our previous utils.js:
//
// FIX G4a: todayStr() — replaced the try/catch formatToParts approach with
//   the cleaner en-CA locale trick. The en-CA locale always produces YYYY-MM-DD
//   output natively, so no manual part-splicing or fallback is needed.
//   The old fallback was new Date().toISOString().slice(0,10) which returns
//   UTC — wrong for users between midnight UTC and ~5 AM ET.
//   The new one-liner correctly returns Eastern Time in all browsers, always.
//
// FIX G4b: compactNumber() — fixed handling of large negative numbers.
//   Before: if (n >= 1_000_000) — fails for n = -1_500_000 (condition is false)
//   and falls through to String(Math.round(n)) → "-1500000" with no suffix.
//   After: threshold checks use Math.abs(n) and the sign is preserved.

// ── Constants ─────────────────────────────────────────────────────
export const BET_STORAGE_KEY  = "bets_v2";
export const DEFAULT_BANKROLL = 1000;
export const BREAK_EVEN_PCT   = 52.38;
export const DEFAULT_JUICE    = -110;
export const KELLY_FRACTION   = 0.5;
export const MAX_KELLY_PCT    = 0.25;

// ── Number formatters ─────────────────────────────────────────────
export const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);

export const formatCurrency = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 2,
  }).format(n ?? 0);

export const formatPct = (n, decimals = 1) =>
  `${Number(n ?? 0).toFixed(decimals)}%`;

// FIX G4b: use Math.abs for threshold checks; preserve sign in output.
// Before: if (n >= 1_000_000) — silently broke for any negative value > 1M.
export const compactNumber = (n) => {
  const sign = n < 0 ? "-" : "";
  const abs  = Math.abs(n ?? 0);
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${sign}${(abs / 1_000).toFixed(1)}K`;
  return String(Math.round(n ?? 0));
};

// ── Odds converters ───────────────────────────────────────────────
/** American → decimal  (-110 → 1.909,  +150 → 2.5) */
export const oddsToDecimal = (american) => {
  const n = Number(american);
  if (!n || !isFinite(n)) return 1;
  if (n > 0) return +(1 + n / 100).toFixed(3);
  return +(1 - 100 / n).toFixed(3);
};

/** American → raw implied probability including vig  (-110 → 0.5238) */
export const oddsToImplied = (american) => {
  const n = Number(american);
  if (!n || !isFinite(n)) return 0.5;
  if (n > 0) return 100 / (n + 100);
  return Math.abs(n) / (Math.abs(n) + 100);
};

export const impliedToOdds = (p) => {
  if (p <= 0 || p >= 1) return "—";
  if (p >= 0.5) return `-${Math.round((p / (1 - p)) * 100)}`;
  return `+${Math.round(((1 - p) / p) * 100)}`;
};

export const breakEven = (american) => oddsToImplied(american);

// ── Financial math ────────────────────────────────────────────────
export const calcROI = (totalPL, totalStaked) => {
  if (!totalStaked || totalStaked === 0) return 0;
  return +((totalPL / totalStaked) * 100).toFixed(2);
};

export const kellyBet = (winProb, american, bankroll = DEFAULT_BANKROLL) => {
  if (!bankroll || bankroll <= 0) return 0;
  const dec = oddsToDecimal(american);
  const b   = dec - 1;
  if (b <= 0) return 0;
  const q         = 1 - winProb;
  const k         = (b * winProb - q) / b;
  const halfKelly = Math.max(0, Math.min(0.25, k * 0.5));
  return Math.round(halfKelly * bankroll);
};

export const calcPL = (stake, american, result) => {
  const s = Number(stake) || 0;
  if (!s || !result || result === "pending" || result === "push") return 0;
  if (result === "loss") return -s;
  const dec = oddsToDecimal(Number(american));
  if (dec - 1 <= 0) return 0;
  return +(s * (dec - 1)).toFixed(2);
};

// ── Date helpers ──────────────────────────────────────────────────
export const currentSeason = () => {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 10 ? year : year - 1;
};

/**
 * Returns today's date as "YYYY-MM-DD" in US Eastern Time.
 *
 * FIX G4a: replaced the try/catch formatToParts approach with the
 * en-CA locale trick suggested by Gemini. This is cleaner and has
 * no edge cases:
 *
 *   - The en-CA locale always produces "YYYY-MM-DD" output natively.
 *     No manual splicing of month/day/year parts needed.
 *   - No fallback path: the en-CA locale + America/New_York timeZone
 *     combination is universally supported in every browser that supports
 *     the rest of this app. There is no scenario where this throws.
 *   - The old fallback (new Date().toISOString().slice(0,10)) returned
 *     the UTC date, which is wrong for users between midnight UTC and
 *     ~5 AM ET — they'd see yesterday's games all morning.
 *
 * Why the old formatToParts approach was worse:
 *   - Required re-assembling YYYY-MM-DD from individual { type, value }
 *     parts, which could produce undefined parts on a small set of
 *     privacy-hardened browsers with locale data stripped.
 *   - The try/catch fallback kicked in precisely when we needed
 *     correctness most (restricted environments), and gave a UTC date.
 */
export const todayStr = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

export const formatShortDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short", day: "numeric", timeZone: "America/New_York",
  });
};

export const formatGameTime = (isoStr) => {
  try {
    return new Date(isoStr).toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
    }) + " ET";
  } catch {
    return isoStr;
  }
};

// ── Analytics helpers ─────────────────────────────────────────────
export const netRatingTier = (netRtg) => {
  if (netRtg >= 8)  return "Elite";
  if (netRtg >= 4)  return "Good";
  if (netRtg >= 0)  return "Average";
  if (netRtg >= -4) return "Below avg";
  return "Poor";
};

export const netRatingColor = (netRtg) => {
  if (netRtg >= 8)  return "text-tier-elite";
  if (netRtg >= 4)  return "text-tier-good";
  if (netRtg >= 0)  return "text-tier-avg";
  if (netRtg >= -4) return "text-tier-poor";
  return "text-tier-bad";
};

export const edgeLabel = (modelP, impliedP) => {
  const diff = modelP - impliedP;
  if (diff >= 8) return "high";
  if (diff >= 4) return "mid";
  return "none";
};

// ── Functional helpers ────────────────────────────────────────────
export const groupBy = (arr, keyFn) =>
  arr.reduce((acc, item) => {
    const key = keyFn(item);
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {});

export const deepClone = (obj) => {
  if (typeof structuredClone === "function") return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
};

export const debounce = (fn, wait = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
};

export const clamp = (val, min, max) => Math.min(max, Math.max(min, val));
export const lerp  = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
export const sum   = (arr)     => arr.reduce((s, n) => s + (n ?? 0), 0);
export const avg   = (arr)     => (arr.length ? sum(arr) / arr.length : 0);

// ── Local storage helpers ─────────────────────────────────────────
const LS_PREFIX = "plusminus:";

export const lsGet = (key) => {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw !== null ? JSON.parse(raw) : null;
  } catch { return null; }
};

export const lsSet = (key, value) => {
  try {
    const fullKey = LS_PREFIX + key;
    localStorage.setItem(fullKey, JSON.stringify(value));
    window.dispatchEvent(
      new CustomEvent("plusminus:storage", { detail: { key: fullKey } })
    );
    return true;
  } catch { return false; }
};

export const lsRemove = (key) => {
  try {
    localStorage.removeItem(LS_PREFIX + key);
    return true;
  } catch { return false; }
};

export function reshapeNBAStats(data, setName = null) {
  const resultSet = setName
    ? data?.resultSets?.find(rs => rs.name === setName)
    : data?.resultSets?.[0];
  if (!resultSet) return [];
  const { headers, rowSet } = resultSet;
  return rowSet.map(row =>
    Object.fromEntries(headers.map((h, i) => [h, row[i]]))
  );
}

// ── Unit-based betting helpers ────────────────────────────────────
export const getUnitSize = (bankroll = DEFAULT_BANKROLL) =>
  +(bankroll / 100).toFixed(2);

export const stakeToUnits = (stake, bankroll = DEFAULT_BANKROLL) => {
  const unit = getUnitSize(bankroll);
  if (!unit) return 0;
  return +(Number(stake) / unit).toFixed(2);
};

export const unitsToDollars = (units, bankroll = DEFAULT_BANKROLL) =>
  +(Number(units) * getUnitSize(bankroll)).toFixed(2);

export const plInUnits = (pl, unitSize) => {
  if (!unitSize || !isFinite(pl)) return null;
  return +(Number(pl) / unitSize).toFixed(2);
};

// ── Elo ──────────────────────────────────────────────────────────
export function eloWinProb(eloA, eloB, isAHome = false) {
  const diff = eloA - eloB + (isAHome ? 35 : 0);
  return 1 / (1 + Math.pow(10, -diff / 400));
}
// ── Prop hit-rate helpers ─────────────────────────────────────────
/**
 * Given an array of game objects with a boolean `.hit` field,
 * returns { hitRate, streak, streakType, last5Rate }.
 * Works with the shape returned by usePlayerPropHistory.
 */
export function calcPropHitRate(games = []) {
  if (!games.length) return { hitRate: 0, streak: 0, streakType: null, last5Rate: null };

  const settled = games.filter(g => g.hit !== null && g.hit !== undefined);
  if (!settled.length) return { hitRate: 0, streak: 0, streakType: null, last5Rate: null };

  const hits    = settled.filter(g => g.hit === true).length;
  const hitRate = hits / settled.length;

  // Current streak (from most recent backward)
  let streak     = 0;
  let streakType = null;
  for (let i = settled.length - 1; i >= 0; i--) {
    const current = settled[i].hit;
    if (streakType === null) { streakType = current ? "over" : "under"; streak = 1; }
    else if ((streakType === "over") === current) streak++;
    else break;
  }

  // Last-5 rate (most recent 5 settled games)
  const last5     = settled.slice(-5);
  const last5Rate = last5.length ? last5.filter(g => g.hit).length / last5.length : null;

  return { hitRate, streak, streakType, last5Rate };
}

/**
 * Returns a label + CSS class for a hit rate, matching PlusMinus' tier colors.
 */
export function hitRateTier(rate) {
  if (rate >= 0.75) return { label: "🔥 Hot",  cls: "text-win  border-win/30  bg-win/10"  };
  if (rate >= 0.60) return { label: "↑ Solid", cls: "text-draw border-draw/30 bg-draw/10" };
  if (rate <= 0.30) return { label: "🧊 Cold", cls: "text-loss border-loss/30 bg-loss/10" };
  return { label: "~ Even",   cls: "text-pitch-400 border-pitch-600 bg-pitch-750" };
}

// ── Percentile helper ─────────────────────────────────────────────
/**
 * Given a value and an array of all values for that stat,
 * returns { pct, color, label } using Cleaning the Glass color coding.
 *
 * @param {number}   value     - the team/player's value
 * @param {number[]} allValues - full league array (must contain value)
 * @param {boolean}  invert    - true for stats where LOWER is better (e.g. TOV%)
 */
export function calcPercentile(value, allValues, invert = false) {
  if (!allValues || allValues.length === 0) return { pct: 50, color: "bg-pitch-700 text-pitch-400", label: "—" };

  const sorted = [...allValues].filter(v => v != null).sort((a, b) => a - b);
  const rank   = sorted.filter(v => v < value).length;
  const rawPct = Math.round((rank / sorted.length) * 100);
  const pct    = invert ? 100 - rawPct : rawPct;

  // CTG-style: orange = elite, green = good, yellow = average, blue = below
  if (pct >= 90) return { pct, color: "bg-orange-500  text-white",      label: "Elite"  };
  if (pct >= 75) return { pct, color: "bg-green-500   text-white",      label: "Good"   };
  if (pct >= 50) return { pct, color: "bg-yellow-400  text-black",      label: "Avg+"   };
  if (pct >= 25) return { pct, color: "bg-pitch-600   text-pitch-300",  label: "Avg-"   };
  return              { pct, color: "bg-blue-500    text-white",      label: "Poor"   };
}
