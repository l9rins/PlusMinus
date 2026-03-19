// ─── PlusMinus Utilities ──────────────────────────────────────
// Pure functions — no side effects, no imports.
// Import only what you need; tree-shaking removes the rest.

// ── Number formatters ─────────────────────────────────────────

/** "+5.2" or "-3.1" — always shows sign */
export const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);

/** "$1,234.50" */
export const formatCurrency = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n ?? 0);

/** "54.3%" */
export const formatPct = (n, decimals = 1) => `${Number(n ?? 0).toFixed(decimals)}%`;

/** "1,234" or "1.2K" or "1.2M" */
export const compactNumber = (n) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n ?? 0));
};

/** "-110" → "1.91" (decimal odds) */
export const oddsToDecimal = (american) => {
  if (american > 0) return +(1 + american / 100).toFixed(3);
  return +(1 - 100 / american).toFixed(3);
};

/** "-110" → 0.5238 (raw implied probability, includes vig) */
export const oddsToImplied = (american) => {
  if (american > 0) return 100 / (american + 100);
  return Math.abs(american) / (Math.abs(american) + 100);
};

/** implied probability → American odds string ("-110", "+120") */
export const impliedToOdds = (p) => {
  if (p <= 0 || p >= 1) return "—";
  if (p >= 0.5) return `-${Math.round(p / (1 - p) * 100)}`;
  return `+${Math.round((1 - p) / p * 100)}`;
};

/** Break-even win rate for a given American line: "-110" → 0.5238 */
export const breakEven = (american) => oddsToImplied(american);

/** ROI % given payout odds and win rate: kellyBet uses this internally */
export const calcROI = (winRate, american) => {
  const dec = oddsToDecimal(american);
  return winRate * (dec - 1) - (1 - winRate);
};

/**
 * Kelly Criterion bet size as fraction of bankroll.
 * @param {number} winProb  — model probability 0-1
 * @param {number} american — American odds (e.g. -110)
 * @returns {number}        — kelly fraction 0-1 (cap at 0.25 for sanity)
 */
export const kellyBet = (winProb, american) => {
  const dec = oddsToDecimal(american);
  const b = dec - 1; // net odds
  const q = 1 - winProb;
  const k = (b * winProb - q) / b;
  return Math.max(0, Math.min(0.25, k));
};

/**
 * Calculate P&L for a single bet.
 * @param {"win"|"loss"|"push"|"pending"} result
 * @param {number} stake   — dollar amount
 * @param {number} american — odds
 */
export const calcPL = (result, stake, american) => {
  const s = Number(stake) || 0;
  if (!s || result === "pending") return 0;
  if (result === "push") return 0;
  if (result === "loss") return -s;
  // Win
  const dec = oddsToDecimal(Number(american) || -110);
  return +(s * (dec - 1)).toFixed(2);
};

// ── Date helpers ──────────────────────────────────────────────

/** "2025-11-14" — always in local timezone */
export const todayStr = () => {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};

/** "Nov 14" */
export const formatShortDate = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00"); // avoid UTC offset shift
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/** "7:30 PM" from an ISO string */
export const formatGameTime = (isoStr) => {
  try {
    return new Date(isoStr).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    }) + " ET";
  } catch {
    return isoStr;
  }
};

// ── Analytics helpers ─────────────────────────────────────────

/**
 * Net rating → tier label.
 * @param {number} netRtg — O-RTG minus D-RTG
 */
export const netRatingTier = (netRtg) => {
  if (netRtg >= 8) return "Elite";
  if (netRtg >= 4) return "Good";
  if (netRtg >= 0) return "Average";
  if (netRtg >= -4) return "Below avg";
  return "Poor";
};

/**
 * Net rating → Tailwind text-color class.
 */
export const netRatingColor = (netRtg) => {
  if (netRtg >= 8) return "text-tier-elite";
  if (netRtg >= 4) return "text-tier-good";
  if (netRtg >= 0) return "text-tier-avg";
  if (netRtg >= -4) return "text-tier-poor";
  return "text-tier-bad";
};

/**
 * Edge classification from model vs implied probability.
 * @param {number} modelP   — 0-100
 * @param {number} impliedP — 0-100 (vig-removed)
 */
export const edgeLabel = (modelP, impliedP) => {
  const diff = modelP - impliedP;
  if (diff >= 8) return "high";
  if (diff >= 4) return "mid";
  return "none";
};

// ── Functional helpers ────────────────────────────────────────

/**
 * Group an array by a key function.
 * @example groupBy([{t:"A"},{t:"B"},{t:"A"}], x => x.t) → { A:[...], B:[...] }
 */
export const groupBy = (arr, keyFn) =>
  arr.reduce((acc, item) => {
    const key = keyFn(item);
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {});

/** Deep clone via structuredClone (or JSON fallback for old browsers) */
export const deepClone = (obj) => {
  if (typeof structuredClone === "function") return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Returns a debounced version of fn that fires after `wait` ms of inactivity.
 * @param {Function} fn
 * @param {number}   wait — ms
 */
export const debounce = (fn, wait = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
};

/** Clamp a value between min and max */
export const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

/** Linear interpolate from a to b by t (0-1) */
export const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);

/** Sum an array of numbers */
export const sum = (arr) => arr.reduce((s, n) => s + (n ?? 0), 0);

/** Average of an array of numbers */
export const avg = (arr) => arr.length ? sum(arr) / arr.length : 0;

// ── Local storage helpers ─────────────────────────────────────
// All throw-safe; return null on any error.

const LS_PREFIX = "plusminus:";

/** Get a JSON-parsed value from localStorage */
export const lsGet = (key) => {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw !== null ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/** Set a JSON-stringified value in localStorage */
export const lsSet = (key, value) => {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

/** Remove a key from localStorage */
export const lsRemove = (key) => {
  try {
    localStorage.removeItem(LS_PREFIX + key);
    return true;
  } catch {
    return false;
  }
};

// ── Constants ─────────────────────────────────────────────────
export const BET_STORAGE_KEY = "bets_v2";          // versioned key — change to invalidate old format
export const BREAK_EVEN_PCT = 52.38;              // break-even win rate at -110 juice
export const DEFAULT_JUICE = -110;               // standard American moneyline
export const KELLY_FRACTION = 0.25;               // quarter-Kelly is industry standard for safety
export const MAX_KELLY_STAKE = 0.10;               // never more than 10% of bankroll on one bet