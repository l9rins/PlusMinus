// ─── PlusMinus Utilities ──────────────────────────────────────────
// Pure functions — no side effects, no imports.
// Import only what you need; tree-shaking removes the rest.

// ── Constants ─────────────────────────────────────────────────────
export const BET_STORAGE_KEY = "bets_v2";   // bump to invalidate old bet format
export const DEFAULT_BANKROLL = 1000;         // default bankroll for Kelly sizing ($)
export const BREAK_EVEN_PCT = 52.38;        // break-even win rate at -110 juice
export const DEFAULT_JUICE = -110;         // standard American moneyline
export const KELLY_FRACTION = 0.5;          // ½-Kelly (applied inside kellyBet)
export const MAX_KELLY_PCT = 0.25;         // max 25% of bankroll on any single bet

// ── Number formatters ─────────────────────────────────────────────

/** "+5.2" or "-3.1" — always shows sign */
export const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);

/** "$1,234.50" */
export const formatCurrency = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 2,
  }).format(n ?? 0);

/** "54.3%" */
export const formatPct = (n, decimals = 1) =>
  `${Number(n ?? 0).toFixed(decimals)}%`;

/** "999" | "1.5K" | "2.5M" */
export const compactNumber = (n) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n ?? 0));
};

// ── Odds converters ───────────────────────────────────────────────

/**
 * American → decimal  (-110 → 1.909,  +150 → 2.5)
 * FIX: guard against zero / non-numeric input to avoid division by zero.
 */
export const oddsToDecimal = (american) => {
  const n = Number(american);
  if (!n || !isFinite(n)) return 1;          // ← FIX: was dividing by zero for american=0
  if (n > 0) return +(1 + n / 100).toFixed(3);
  return +(1 - 100 / n).toFixed(3);
};

/** American → raw implied probability including vig  (-110 → 0.5238) */
export const oddsToImplied = (american) => {
  const n = Number(american);
  if (!n || !isFinite(n)) return 0.5;        // ← FIX: guard for same reason
  if (n > 0) return 100 / (n + 100);
  return Math.abs(n) / (Math.abs(n) + 100);
};

/** Vig-removed implied probability → American odds string ("-110", "+120") */
export const impliedToOdds = (p) => {
  if (p <= 0 || p >= 1) return "—";
  if (p >= 0.5) return `-${Math.round((p / (1 - p)) * 100)}`;
  return `+${Math.round(((1 - p) / p) * 100)}`;
};

/** Break-even win rate for a given American line  (-110 → 0.5238) */
export const breakEven = (american) => oddsToImplied(american);

// ── Financial math ────────────────────────────────────────────────

/**
 * ROI percentage.
 *   calcROI(totalPL, totalStaked) → e.g. calcROI(45, 200) → 22.50
 *
 * FIX: removed the dual-mode overloading. This function now has one
 * clear contract: (net profit/loss, total amount wagered) → % return.
 * Any callers using the old legacy (winRate, american) signature need
 * to be updated — search the codebase for calcROI and confirm both
 * arguments are dollar amounts.
 *
 * @param {number} totalPL     — net profit or loss in dollars
 * @param {number} totalStaked — total amount wagered in dollars
 * @returns {number}           — ROI as a percentage, e.g. 22.50
 */
export const calcROI = (totalPL, totalStaked) => {
  if (!totalStaked || totalStaked === 0) return 0;
  return +((totalPL / totalStaked) * 100).toFixed(2);
};

/**
 * Kelly Criterion — returns the DOLLAR amount to bet (not a fraction).
 *
 * @param {number} winProb  — model probability 0–1
 * @param {number} american — American odds (e.g. -110)
 * @param {number} bankroll — total bankroll in dollars (default DEFAULT_BANKROLL)
 * @returns {number}        — dollar amount, capped at 25% of bankroll, rounded to $1
 *
 * Uses ½-Kelly for safety (industry standard risk management).
 */
export const kellyBet = (winProb, american, bankroll = DEFAULT_BANKROLL) => {
  if (!bankroll || bankroll <= 0) return 0;
  const dec = oddsToDecimal(american);
  const b = dec - 1;       // net odds (profit per $1 wagered)
  const q = 1 - winProb;
  const k = (b * winProb - q) / b;   // full Kelly fraction

  // ½-Kelly for safety, capped at 25% of bankroll
  const halfKelly = Math.max(0, Math.min(0.25, k * 0.5));
  return Math.round(halfKelly * bankroll);
};

/**
 * Calculate P&L for a single bet.
 *
 * Argument order matches ALL callers in Dashboard.jsx and Views.jsx:
 *   calcPL(stake, odds, result)
 *
 * @param {number|string} stake   — dollar amount wagered
 * @param {number|string} american — American odds (-110, +150, etc.)
 * @param {string}        result  — "win" | "loss" | "push" | "pending"
 * @returns {number}              — net P&L in dollars
 */
export const calcPL = (stake, american, result) => {
  const s = Number(stake) || 0;
  if (!s || !result || result === "pending" || result === "push") return 0;
  if (result === "loss") return -s;
  // Win — profit = stake × (decimal odds − 1)
  const dec = oddsToDecimal(Number(american) || DEFAULT_JUICE);
  return +(s * (dec - 1)).toFixed(2);
};

// ── Date helpers ──────────────────────────────────────────────────

export const currentSeason = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  // NBA season starts first week of October — use Oct 1 as cutover
  return month >= 10 ? year : year - 1;
};

/** "2025-11-14" in US Eastern Time (prevents rollover during late NBA games) */
export const todayStr = () => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const yr = parts.find(p => p.type === "year").value;
  const mo = parts.find(p => p.type === "month").value;
  const da = parts.find(p => p.type === "day").value;
  return `${yr}-${mo}-${da}`;
};

/** "Nov 14" */
export const formatShortDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short", day: "numeric", timeZone: "America/New_York",
  });
};

/** ISO string → "7:30 PM ET" */
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

/** Net rating → tier label */
export const netRatingTier = (netRtg) => {
  if (netRtg >= 8) return "Elite";
  if (netRtg >= 4) return "Good";
  if (netRtg >= 0) return "Average";
  if (netRtg >= -4) return "Below avg";
  return "Poor";
};

/** Net rating → Tailwind text-color class */
export const netRatingColor = (netRtg) => {
  if (netRtg >= 8) return "text-tier-elite";
  if (netRtg >= 4) return "text-tier-good";
  if (netRtg >= 0) return "text-tier-avg";
  if (netRtg >= -4) return "text-tier-poor";
  return "text-tier-bad";
};

/** Edge classification — model vs implied probability (both 0–100) */
export const edgeLabel = (modelP, impliedP) => {
  const diff = modelP - impliedP;
  if (diff >= 8) return "high";
  if (diff >= 4) return "mid";
  return "none";
};

// ── Functional helpers ────────────────────────────────────────────

/** Group array by key function */
export const groupBy = (arr, keyFn) =>
  arr.reduce((acc, item) => {
    const key = keyFn(item);
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {});

/** Safe deep clone */
export const deepClone = (obj) => {
  if (typeof structuredClone === "function") return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
};

/** Debounce — returns a debounced fn that fires after `wait` ms of inactivity */
export const debounce = (fn, wait = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
};

/** Clamp value between min and max */
export const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

/** Linear interpolate from a to b by t (0–1) */
export const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);

/** Sum array of numbers */
export const sum = (arr) => arr.reduce((s, n) => s + (n ?? 0), 0);

/** Average of array of numbers */
export const avg = (arr) => (arr.length ? sum(arr) / arr.length : 0);

// ── Local storage helpers ─────────────────────────────────────────
// All throw-safe — return null / false on any error.

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

/**
 * NBA Stats API always returns:
 * { resultSets: [{ name, headers: [...], rowSet: [[...], [...]] }] }
 * This turns any resultSet into an array of plain objects.
 */
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