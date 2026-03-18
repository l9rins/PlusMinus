// ─── PlusMinus Utilities ──────────────────────────────────────
// Pure functions with no React dependencies.
// Import from any component that needs them.

/**
 * Calculate profit/loss for a settled bet using American odds.
 *
 * @param {number} stake  - Amount wagered in dollars
 * @param {number} odds   - American odds (e.g. -110, +150)
 * @param {string} result - "win" | "loss" | "push" | "pending"
 * @returns {number} Net P&L in dollars (0 for pending/push)
 *
 * Examples:
 *   calcPL(100, -110, "win")  → 90.91
 *   calcPL(50,  +150, "win")  → 75.00
 *   calcPL(50,  -110, "loss") → -50.00
 *   calcPL(50,  -110, "push") → 0
 */
export function calcPL(stake, odds, result) {
  if (result === "pending" || result === "push") return 0;
  if (result === "loss") return -Math.abs(parseFloat(stake));
  const o = parseFloat(odds);
  if (o > 0) return +(parseFloat(stake) * o / 100).toFixed(2);
  return +(parseFloat(stake) * 100 / Math.abs(o)).toFixed(2);
}

/**
 * Convert American moneyline odds to implied win probability (0–1).
 * Used by: Views.jsx Betting edge cards to display implied market probability.
 * Future use: wire ODDS_GAMES.impliedP to derive from actual moneyline rather
 * than hardcoding it in data.js.
 *
 * @param {number} odds - American odds
 * @returns {number} Implied probability as a decimal
 *
 * Examples:
 *   oddsToImplied(-110) → 0.524
 *   oddsToImplied(+150) → 0.400
 */
export function oddsToImplied(odds) {
  const o = parseFloat(odds);
  if (o > 0) return 100 / (o + 100);
  return Math.abs(o) / (Math.abs(o) + 100);
}

/**
 * Format a number as a signed string ("+5.2" or "-3.1").
 * Used by: Players.jsx BPM stat display to handle negative values correctly.
 * Prevents "+-3.1" when BPM is negative.
 *
 * @param {number} n
 * @param {number} [decimals=1]
 * @returns {string}
 *
 * Example:
 *   signed(9.2)  → "+9.2"
 *   signed(-3.1) → "-3.1"
 */
export function signed(n, decimals = 1) {
  return (n >= 0 ? "+" : "") + n.toFixed(decimals);
}

/**
 * Clamp a value between min and max.
 * Used by: future shot chart zone sizing, model builder slider bounds.
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * LocalStorage key for persisted bets.
 * Used by: BetTracker (Views.jsx) and Dashboard summary tile.
 * Single source of truth — import this instead of hardcoding the string.
 */
export const BET_STORAGE_KEY = "plusminus_bets";