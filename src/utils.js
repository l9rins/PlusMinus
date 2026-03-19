// ─── PlusMinus Utilities ──────────────────────────────────────────
// Pure functions with no React dependencies.
// Imported by components, api.js, and any other module that needs them.

/**
 * Calculate profit/loss for a settled bet (American odds).
 *
 * @param {number} stake  - Amount wagered ($)
 * @param {number} odds   - American odds (e.g. -110, +150)
 * @param {string} result - "win" | "loss" | "push" | "pending"
 * @returns {number} Net P&L in dollars (0 for pending/push)
 *
 * @example
 *   calcPL(100, -110, "win")  → 90.91
 *   calcPL(50,  +150, "win")  → 75.00
 *   calcPL(50,  -110, "loss") → -50.00
 *   calcPL(50,  -110, "push") → 0
 */
export function calcPL(stake, odds, result) {
  if (!result || result === "pending" || result === "push") return 0;
  if (result === "loss") return -Math.abs(parseFloat(stake));
  const s = parseFloat(stake);
  const o = parseFloat(odds);
  if (isNaN(s) || isNaN(o)) return 0;
  if (o > 0) return +(s * o / 100).toFixed(2);
  return +(s * 100 / Math.abs(o)).toFixed(2);
}

/**
 * Convert American moneyline odds to implied win probability (0–1).
 * Used to normalize market odds, then strip vig via normalization.
 *
 * @param {number} odds - American odds
 * @returns {number} Implied probability as a decimal (0–1)
 *
 * @example
 *   oddsToImplied(-110) → 0.5238
 *   oddsToImplied(+150) → 0.4000
 */
export function oddsToImplied(odds) {
  const o = parseFloat(odds);
  if (isNaN(o)) return 0.5;
  if (o > 0) return 100 / (o + 100);
  return Math.abs(o) / (Math.abs(o) + 100);
}

/**
 * Format a number with an explicit sign (+/-).
 *
 * @param {number} n
 * @param {number} [decimals=1]
 * @returns {string} e.g. "+9.2", "-3.1", "+0.0"
 */
export function signed(n, decimals = 1) {
  const val = parseFloat(n);
  if (isNaN(val)) return "—";
  return (val >= 0 ? "+" : "") + val.toFixed(decimals);
}

/**
 * Clamp a value between min and max.
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation between two values.
 *
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Progress (0–1)
 * @returns {number}
 */
export function lerp(a, b, t) {
  return a + (b - a) * clamp(t, 0, 1);
}

/**
 * Format currency with sign and dollar symbol.
 *
 * @param {number} n - Dollar amount
 * @param {boolean} [showSign=true] - Prepend + for positive
 * @returns {string} e.g. "+$142.50", "-$32.00", "$0.00"
 */
export function formatCurrency(n, showSign = true) {
  const val = parseFloat(n);
  if (isNaN(val)) return "$0.00";
  const abs = `$${Math.abs(val).toFixed(2)}`;
  if (!showSign) return abs;
  return (val >= 0 ? "+" : "-") + abs;
}

/**
 * Format a win percentage as a 3-decimal string (e.g. ".785").
 *
 * @param {number} pct - Win percentage (0–1)
 * @returns {string}
 */
export function formatPct(pct) {
  if (typeof pct !== "number" || isNaN(pct)) return ".000";
  return pct.toFixed(3);
}

/**
 * Format American odds for display.
 *
 * @param {number} odds - American odds
 * @returns {string} e.g. "-110", "+150"
 */
export function formatOdds(odds) {
  const o = parseFloat(odds);
  if (isNaN(o)) return "—";
  return o > 0 ? `+${o}` : `${o}`;
}

/**
 * Convert implied probability to American moneyline.
 * Inverse of oddsToImplied.
 *
 * @param {number} prob - Implied probability (0–1)
 * @returns {number} American odds
 */
export function impliedToOdds(prob) {
  const p = clamp(prob, 0.01, 0.99);
  if (p >= 0.5) {
    return Math.round(-(p / (1 - p)) * 100);
  }
  return Math.round(((1 - p) / p) * 100);
}

/**
 * Format a number compactly (1200 → "1.2K").
 *
 * @param {number} n
 * @returns {string}
 */
export function compactNumber(n) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * Calculate ROI as a percentage.
 *
 * @param {number} pl         - Net profit/loss
 * @param {number} totalStake - Total amount wagered
 * @returns {number} ROI percentage (or 0 if no stake)
 */
export function calcROI(pl, totalStake) {
  if (!totalStake || totalStake <= 0) return 0;
  return +((pl / totalStake) * 100).toFixed(2);
}

/**
 * Calculate Kelly Criterion bet size.
 * Tells you what fraction of bankroll to wager.
 *
 * @param {number} prob     - Your estimated win probability (0–1)
 * @param {number} odds     - American odds
 * @param {number} bankroll - Total bankroll ($)
 * @returns {number} Recommended bet size in dollars
 */
export function kellyBet(prob, odds, bankroll) {
  const o = parseFloat(odds);
  const b = o > 0 ? o / 100 : 100 / Math.abs(o);
  const q = 1 - prob;
  const kelly = (b * prob - q) / b;
  if (kelly <= 0) return 0;
  const halfKelly = kelly * 0.5; // half-Kelly for safety
  return +(clamp(halfKelly, 0, 0.25) * bankroll).toFixed(2);
}

/**
 * Compute break-even win percentage for a given odds line.
 *
 * @param {number} odds - American odds
 * @returns {number} Required win rate to break even (0–1)
 */
export function breakEven(odds) {
  return oddsToImplied(odds);
}

/**
 * Debounce a function.
 * Note: for React hooks, use the useDebounce hook in Players.jsx instead.
 *
 * @param {Function} fn
 * @param {number} delay - milliseconds
 * @returns {Function}
 */
export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Deep clone a plain object/array (no functions, no class instances).
 *
 * @param {*} value
 * @returns {*}
 */
export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Group an array of objects by a key.
 *
 * @param {Array} arr
 * @param {string} key
 * @returns {Record<string, Array>}
 */
export function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key] ?? "unknown";
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

/**
 * Get the current date string in "YYYY-MM-DD" format (UTC).
 *
 * @returns {string}
 */
export function todayStr() {
  return new Date().toISOString().split("T")[0];
}

/**
 * Format a date as "Mon Mar 19" style.
 *
 * @param {Date|number|string} date
 * @returns {string}
 */
export function formatShortDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a time as "7:30 PM ET" from a UTC ISO string.
 *
 * @param {string} isoString
 * @returns {string}
 */
export function formatGameTime(isoString) {
  try {
    return new Date(isoString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    }) + " ET";
  } catch {
    return isoString;
  }
}

/**
 * Return a tier label + class for a net rating value.
 *
 * @param {number} netRtg
 * @returns {{ label: string, cls: string }}
 */
export function netRatingTier(netRtg) {
  if (netRtg >= 8) return { label: "Elite", cls: "text-tier-elite" };
  if (netRtg >= 3) return { label: "Solid", cls: "text-tier-good" };
  if (netRtg >= 0) return { label: "Average", cls: "text-tier-avg" };
  if (netRtg >= -3) return { label: "Below Avg", cls: "text-tier-poor" };
  return { label: "Poor", cls: "text-tier-bad" };
}

/**
 * Safe localStorage read — returns null on any failure.
 *
 * @param {string} key
 * @returns {*} Parsed value or null
 */
export function lsGet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Safe localStorage write.
 *
 * @param {string} key
 * @param {*} value - Will be JSON-serialized
 * @param {boolean} [dispatchEvent=true] - Dispatch storage event for cross-component sync
 * @returns {boolean} Success
 */
export function lsSet(key, value, dispatchEvent = true) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    if (dispatchEvent) {
      window.dispatchEvent(new StorageEvent("storage", { key }));
    }
    return true;
  } catch {
    console.warn(`[PlusMinus] localStorage write failed for key "${key}"`);
    return false;
  }
}

/**
 * Safe localStorage remove.
 *
 * @param {string} key
 */
export function lsRemove(key) {
  try { localStorage.removeItem(key); } catch { /* silently fail */ }
}

// ── Constants ────────────────────────────────────────────────────

/** LocalStorage key for persisted bets. Single source of truth. */
export const BET_STORAGE_KEY = "plusminus_bets_v2";

/** LocalStorage key for user preferences. */
export const PREFS_STORAGE_KEY = "plusminus_prefs";

/** Default bankroll for Kelly Criterion calculations. */
export const DEFAULT_BANKROLL = 1000;