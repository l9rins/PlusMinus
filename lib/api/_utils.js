// api/_utils.js — Shared utility functions for API endpoints

/**
 * Derive the current NBA season string, e.g. "2024-25".
 * October onwards = new season year; before October = previous year.
 */
export function currentSeasonStr() {
  const now = new Date();
  const year = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${String(year + 1).slice(2)}`;
}
