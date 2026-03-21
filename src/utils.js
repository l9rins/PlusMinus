// ─── PlusMinus Utilities ──────────────────────────────────────────
// Pure functions — no side effects, no imports.
// Import only what you need; tree-shaking removes the rest.

// ── Constants ─────────────────────────────────────────────────────
export const BET_STORAGE_KEY = "bets_v2";
export const DEFAULT_BANKROLL = 1000;
export const BREAK_EVEN_PCT = 52.38;
export const DEFAULT_JUICE = -110;
export const KELLY_FRACTION = 0.5;
export const MAX_KELLY_PCT = 0.25;

// ── Number formatters ─────────────────────────────────────────────

export const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);

export const formatCurrency = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 2,
  }).format(n ?? 0);

export const formatPct = (n, decimals = 1) =>
  `${Number(n ?? 0).toFixed(decimals)}%`;

export const compactNumber = (n) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
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

/**
 * Kelly Criterion — returns the DOLLAR amount to bet.
 *
 * FIX: added `if (b <= 0) return 0` guard.
 *
 * The chain of events before this fix:
 *   1. User passes american=0 (or any invalid value)
 *   2. oddsToDecimal(0) correctly returns 1 (our previous fix)
 *   3. b = dec - 1 = 0
 *   4. k = (b * winProb - q) / b  →  division by zero  →  NaN
 *   5. halfKelly = Math.max(0, Math.min(0.25, NaN * 0.5))  →  NaN
 *   6. Math.round(NaN * bankroll)  →  NaN
 *   7. NaN silently rendered as an empty string in the Dashboard KellyTile
 *
 * b=0 means the bet pays out exactly what you stake (even money at
 * decimal 1.0). In practice this never comes from a real sportsbook;
 * it only happens when odds input is missing or corrupt. Returning 0
 * is the correct bet size: no edge can be calculated, don't bet.
 */
export const kellyBet = (winProb, american, bankroll = DEFAULT_BANKROLL) => {
  if (!bankroll || bankroll <= 0) return 0;
  const dec = oddsToDecimal(american);
  const b = dec - 1; // net odds (profit per $1 wagered)

  // FIX: b=0 means even-money or invalid odds — return 0, don't divide
  if (b <= 0) return 0;

  const q = 1 - winProb;
  const k = (b * winProb - q) / b; // full Kelly fraction

  // ½-Kelly for safety, capped at 25% of bankroll
  const halfKelly = Math.max(0, Math.min(0.25, k * 0.5));
  return Math.round(halfKelly * bankroll);
};

export const calcPL = (stake, american, result) => {
  const s = Number(stake) || 0;
  if (!s || !result || result === "pending" || result === "push") return 0;
  if (result === "loss") return -s;
  const dec = oddsToDecimal(Number(american) || DEFAULT_JUICE);
  return +(s * (dec - 1)).toFixed(2);
};

// ── Date helpers ──────────────────────────────────────────────────

export const currentSeason = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 10 ? year : year - 1;
};

/**
 * Returns today's date as "YYYY-MM-DD" in US Eastern Time.
 *
 * FIX: added a try/catch fallback around the formatToParts call.
 *
 * Why not Gemini's suggested alternative?
 *   new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }))
 *   has a documented DST bug on some V8 builds: during the spring-forward
 *   hour (2:00–3:00 AM ET), toLocaleString produces a string the Date
 *   constructor parses as one hour ahead of actual wall-clock time,
 *   returning tomorrow's date for users in that narrow window.
 *
 * This version keeps the formatToParts approach (correct everywhere) and
 * adds a defensive fallback for the rare privacy-hardened browser that
 * strips locale data and returns undefined parts. In that case we fall
 * back to the UTC ISO string — off by at most a few hours from ET, only
 * relevant to users between midnight UTC and ~5 AM ET.
 */
export const todayStr = () => {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(new Date());
    const get = (type) => parts.find(p => p.type === type)?.value;
    const yr = get("year");
    const mo = get("month");
    const da = get("day");

    // If any part is missing, throw to trigger the fallback below
    if (!yr || !mo || !da) throw new Error("incomplete locale parts");

    return `${yr}-${mo}-${da}`;
  } catch {
    // Fallback: UTC ISO date — never throws, always returns YYYY-MM-DD
    return new Date().toISOString().slice(0, 10);
  }
};

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
  if (netRtg >= 8) return "Elite";
  if (netRtg >= 4) return "Good";
  if (netRtg >= 0) return "Average";
  if (netRtg >= -4) return "Below avg";
  return "Poor";
};

export const netRatingColor = (netRtg) => {
  if (netRtg >= 8) return "text-tier-elite";
  if (netRtg >= 4) return "text-tier-good";
  if (netRtg >= 0) return "text-tier-avg";
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
export const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
export const sum = (arr) => arr.reduce((s, n) => s + (n ?? 0), 0);
export const avg = (arr) => (arr.length ? sum(arr) / arr.length : 0);

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

// ── Unit system helpers ───────────────────────────────────────────

export const DEFAULT_UNIT_PCT = 0.01;  // 1% of bankroll = 1 unit

// Get unit size in dollars from stored bankroll + unit % preference
export function getUnitSize(bankroll) {
  const pct = Number(lsGet("pm_unit_pct")) || DEFAULT_UNIT_PCT;
  return +(bankroll * pct).toFixed(2);
}

// Convert a dollar stake to units given a unit size
export function stakeToUnits(stake, unitSize) {
  if (!unitSize || unitSize <= 0) return null;
  return +(stake / unitSize).toFixed(2);
}

// Convert units to dollars
export function unitsToDollars(units, unitSize) {
  return +(units * unitSize).toFixed(2);
}

// P/L in units
export function plInUnits(pl, unitSize) {
  if (!unitSize || unitSize <= 0) return null;
  return +(pl / unitSize).toFixed(2);
}