// src/utils.test.js
// ─────────────────────────────────────────────────────────────────
// Vitest unit tests for all financial math in utils.js.
// Run: npx vitest run
//
// These functions touch real money. Every edge case is covered.

import { describe, it, expect } from "vitest";
import {
  signed,
  formatCurrency,
  formatPct,
  compactNumber,
  oddsToDecimal,
  oddsToImplied,
  impliedToOdds,
  breakEven,
  calcROI,
  kellyBet,
  calcPL,
  todayStr,
  formatShortDate,
  netRatingTier,
  netRatingColor,
  edgeLabel,
  groupBy,
  deepClone,
  clamp,
  lerp,
  sum,
  avg,
  lsGet,
  lsSet,
  lsRemove,
  BET_STORAGE_KEY,
  BREAK_EVEN_PCT,
} from "./utils";

// ── signed() ─────────────────────────────────────────────────────
describe("signed()", () => {
  it("prefixes positive with +", () => expect(signed(5.2)).toBe("+5.2"));
  it("leaves negative as-is",     () => expect(signed(-3.1)).toBe("-3.1"));
  it("prefixes zero with +",      () => expect(signed(0)).toBe("+0"));
  it("handles large numbers",     () => expect(signed(100)).toBe("+100"));
});

// ── formatCurrency() ─────────────────────────────────────────────
describe("formatCurrency()", () => {
  it("formats positive",  () => expect(formatCurrency(50)).toBe("$50.00"));
  it("formats negative",  () => expect(formatCurrency(-22.5)).toBe("-$22.50"));
  it("formats zero",      () => expect(formatCurrency(0)).toBe("$0.00"));
  it("handles undefined", () => expect(formatCurrency(undefined)).toBe("$0.00"));
  it("handles null",      () => expect(formatCurrency(null)).toBe("$0.00"));
});

// ── formatPct() ──────────────────────────────────────────────────
describe("formatPct()", () => {
  it("formats with 1 decimal",   () => expect(formatPct(52.38)).toBe("52.4%"));
  it("respects decimals param",  () => expect(formatPct(52.38, 0)).toBe("52%"));
  it("handles 0",                () => expect(formatPct(0)).toBe("0.0%"));
  it("handles 100",              () => expect(formatPct(100)).toBe("100.0%"));
});

// ── compactNumber() ──────────────────────────────────────────────
describe("compactNumber()", () => {
  it("rounds small numbers",  () => expect(compactNumber(999)).toBe("999"));
  it("formats thousands",     () => expect(compactNumber(1500)).toBe("1.5K"));
  it("formats millions",      () => expect(compactNumber(2_500_000)).toBe("2.5M"));
  it("handles 0",             () => expect(compactNumber(0)).toBe("0"));
});

// ── oddsToDecimal() ──────────────────────────────────────────────
describe("oddsToDecimal()", () => {
  it("-110 → 1.909",  () => expect(oddsToDecimal(-110)).toBeCloseTo(1.909, 2));
  it("+150 → 2.5",    () => expect(oddsToDecimal(150)).toBeCloseTo(2.5, 3));
  it("+100 → 2.0",    () => expect(oddsToDecimal(100)).toBeCloseTo(2.0, 3));
  it("-200 → 1.5",    () => expect(oddsToDecimal(-200)).toBeCloseTo(1.5, 3));
  it("-300 → 1.333",  () => expect(oddsToDecimal(-300)).toBeCloseTo(1.333, 2));
  it("+300 → 4.0",    () => expect(oddsToDecimal(300)).toBeCloseTo(4.0, 3));
});

// ── oddsToImplied() ──────────────────────────────────────────────
describe("oddsToImplied()", () => {
  it("-110 → ~0.5238",  () => expect(oddsToImplied(-110)).toBeCloseTo(0.5238, 3));
  it("+150 → ~0.4000",  () => expect(oddsToImplied(150)).toBeCloseTo(0.4, 3));
  it("+100 → 0.5",      () => expect(oddsToImplied(100)).toBeCloseTo(0.5, 3));
  it("-200 → ~0.6667",  () => expect(oddsToImplied(-200)).toBeCloseTo(0.6667, 3));
  it("always between 0 and 1", () => {
    [-110, -200, -300, +150, +300, +500, -500].forEach(o => {
      const p = oddsToImplied(o);
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(1);
    });
  });
});

// ── impliedToOdds() ──────────────────────────────────────────────
describe("impliedToOdds()", () => {
  it("0.5 → +100",    () => expect(impliedToOdds(0.5)).toBe("+100"));
  it("0.5238 → -110", () => expect(impliedToOdds(0.5238)).toBe("-110"));
  it("0.6667 → -200", () => expect(impliedToOdds(0.6667)).toBe("-200"));
  it("handles 0",     () => expect(impliedToOdds(0)).toBe("—"));
  it("handles 1",     () => expect(impliedToOdds(1)).toBe("—"));
  it("handles > 1",   () => expect(impliedToOdds(1.5)).toBe("—"));
});

// ── breakEven() ──────────────────────────────────────────────────
describe("breakEven()", () => {
  it("-110 → ~52.38%",  () => expect(breakEven(-110) * 100).toBeCloseTo(52.38, 1));
  it("+100 → 50%",      () => expect(breakEven(100) * 100).toBeCloseTo(50, 1));
  it("-200 → ~66.67%",  () => expect(breakEven(-200) * 100).toBeCloseTo(66.67, 1));
  it("+200 → ~33.33%",  () => expect(breakEven(200) * 100).toBeCloseTo(33.33, 1));
  it("matches BREAK_EVEN_PCT constant", () => {
    expect(breakEven(-110) * 100).toBeCloseTo(BREAK_EVEN_PCT, 1);
  });
});

// ── calcROI() ────────────────────────────────────────────────────
describe("calcROI()", () => {
  it("positive when profitable",      () => expect(calcROI(50, 100)).toBeGreaterThan(0));
  it("negative when losing",          () => expect(calcROI(-20, 100)).toBeLessThan(0));
  it("zero on zero total stake",      () => expect(calcROI(0, 0)).toBe(0));
  it("returns number",                () => expect(typeof calcROI(10, 100)).toBe("number"));
});

// ── kellyBet() ───────────────────────────────────────────────────
describe("kellyBet()", () => {
  it("returns 0 for edge below 0",        () => expect(kellyBet(0.45, -110, 1000)).toBe(0));
  it("returns positive for edge above 0", () => expect(kellyBet(0.6, -110, 1000)).toBeGreaterThan(0));
  it("caps at 25% of bankroll (MAX_KELLY_STAKE check)", () => {
    // Very high probability — kelly fraction should be capped
    const bet = kellyBet(0.99, -110, 1000);
    expect(bet).toBeLessThanOrEqual(250); // 0.25 * 1000
  });
  it("zero win probability → 0",  () => expect(kellyBet(0, -110, 1000)).toBe(0));
  it("handles +150 odds",         () => expect(kellyBet(0.55, 150, 1000)).toBeGreaterThan(0));
  it("bankroll of 0 → 0",         () => expect(kellyBet(0.6, -110, 0)).toBe(0));
});

// ── calcPL() ─────────────────────────────────────────────────────
describe("calcPL()", () => {
  // Win scenarios
  it("-110, $100 win → +$90.91",     () => expect(calcPL(100, -110, "win")).toBeCloseTo(90.91, 1));
  it("+150, $50 win → +$75",         () => expect(calcPL(50, 150, "win")).toBeCloseTo(75, 1));
  it("+100, $100 win → +$100",       () => expect(calcPL(100, 100, "win")).toBeCloseTo(100, 1));
  it("-200, $100 win → +$50",        () => expect(calcPL(100, -200, "win")).toBeCloseTo(50, 1));

  // Loss scenarios
  it("-110, $100 loss → -$100",      () => expect(calcPL(100, -110, "loss")).toBe(-100));
  it("+150, $50 loss → -$50",        () => expect(calcPL(50, 150, "loss")).toBe(-50));

  // Push / pending scenarios
  it("push → $0",                    () => expect(calcPL(100, -110, "push")).toBe(0));
  it("pending → $0",                 () => expect(calcPL(100, -110, "pending")).toBe(0));

  // Edge cases
  it("zero stake → $0",              () => expect(calcPL(0, -110, "win")).toBe(0));
  it("string stake parsed correctly",() => expect(calcPL("50", -110, "win")).toBeCloseTo(45.45, 1));
  it("NaN stake → $0",              () => expect(calcPL(NaN, -110, "win")).toBe(0));
  it("undefined result → $0",        () => expect(calcPL(100, -110, undefined)).toBe(0));
});

// ── todayStr() ───────────────────────────────────────────────────
describe("todayStr()", () => {
  it("returns YYYY-MM-DD format", () => {
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("matches current date", () => {
    const d = new Date();
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    expect(todayStr()).toBe(expected);
  });
});

// ── formatShortDate() ────────────────────────────────────────────
describe("formatShortDate()", () => {
  it("formats correctly", () => {
    expect(formatShortDate("2025-11-14")).toMatch(/Nov\s+14/);
  });
  it("doesn't have year", () => {
    expect(formatShortDate("2025-03-01")).not.toContain("2025");
  });
});

// ── netRatingTier() ──────────────────────────────────────────────
describe("netRatingTier()", () => {
  it("+10 → Elite",        () => expect(netRatingTier(10)).toBe("Elite"));
  it("+5 → Good",          () => expect(netRatingTier(5)).toBe("Good"));
  it("0 → Average",        () => expect(netRatingTier(0)).toBe("Average"));
  it("-2 → Below avg",     () => expect(netRatingTier(-2)).toBe("Below avg"));
  it("-8 → Poor",          () => expect(netRatingTier(-8)).toBe("Poor"));
  it("exactly 4 → Good",   () => expect(netRatingTier(4)).toBe("Good"));
  it("exactly 8 → Elite",  () => expect(netRatingTier(8)).toBe("Elite"));
});

// ── edgeLabel() ──────────────────────────────────────────────────
describe("edgeLabel()", () => {
  it("10+ diff → high",       () => expect(edgeLabel(65, 55)).toBe("high"));
  it("5-9 diff → mid",        () => expect(edgeLabel(60, 55)).toBe("mid"));
  it("<5 diff → none",        () => expect(edgeLabel(57, 55)).toBe("none"));
  it("negative diff → none",  () => expect(edgeLabel(50, 60)).toBe("none"));
  it("exactly 8 → mid",       () => expect(edgeLabel(63, 55)).toBe("mid"));
  it("exactly 10 → high",     () => expect(edgeLabel(65, 55)).toBe("high"));
});

// ── groupBy() ────────────────────────────────────────────────────
describe("groupBy()", () => {
  it("groups by key", () => {
    const data = [{ t: "A" }, { t: "B" }, { t: "A" }];
    const result = groupBy(data, x => x.t);
    expect(result.A).toHaveLength(2);
    expect(result.B).toHaveLength(1);
  });

  it("empty array → empty object", () => {
    expect(groupBy([], x => x.t)).toEqual({});
  });
});

// ── deepClone() ──────────────────────────────────────────────────
describe("deepClone()", () => {
  it("clones nested objects", () => {
    const obj = { a: 1, b: { c: [1, 2, 3] } };
    const clone = deepClone(obj);
    clone.b.c.push(4);
    expect(obj.b.c).toHaveLength(3);
  });

  it("clones arrays", () => {
    const arr = [1, 2, { x: 3 }];
    const clone = deepClone(arr);
    clone[2].x = 99;
    expect(arr[2].x).toBe(3);
  });
});

// ── clamp() ──────────────────────────────────────────────────────
describe("clamp()", () => {
  it("returns value within range", () => expect(clamp(5, 0, 10)).toBe(5));
  it("clamps to min",              () => expect(clamp(-5, 0, 10)).toBe(0));
  it("clamps to max",              () => expect(clamp(15, 0, 10)).toBe(10));
  it("at min boundary",            () => expect(clamp(0, 0, 10)).toBe(0));
  it("at max boundary",            () => expect(clamp(10, 0, 10)).toBe(10));
});

// ── lerp() ───────────────────────────────────────────────────────
describe("lerp()", () => {
  it("t=0 → a",   () => expect(lerp(0, 100, 0)).toBe(0));
  it("t=1 → b",   () => expect(lerp(0, 100, 1)).toBe(100));
  it("t=0.5 → midpoint", () => expect(lerp(0, 100, 0.5)).toBe(50));
  it("clamps t > 1",     () => expect(lerp(0, 100, 2)).toBe(100));
  it("clamps t < 0",     () => expect(lerp(0, 100, -1)).toBe(0));
});

// ── sum() / avg() ─────────────────────────────────────────────────
describe("sum()", () => {
  it("sums numbers",    () => expect(sum([1, 2, 3, 4])).toBe(10));
  it("handles empty",   () => expect(sum([])).toBe(0));
  it("handles nulls",   () => expect(sum([1, null, 3])).toBe(4));
});

describe("avg()", () => {
  it("averages correctly",  () => expect(avg([2, 4, 6])).toBe(4));
  it("handles empty → 0",   () => expect(avg([])).toBe(0));
  it("single element",      () => expect(avg([7])).toBe(7));
});

// ── localStorage helpers ──────────────────────────────────────────
// These tests run in jsdom (vitest default) which has localStorage.
describe("lsGet / lsSet / lsRemove", () => {
  const key = "test-key";

  it("set and get round-trip", () => {
    lsSet(key, { hello: "world" });
    expect(lsGet(key)).toEqual({ hello: "world" });
  });

  it("get non-existent key → null", () => {
    lsRemove(key);
    expect(lsGet(key)).toBeNull();
  });

  it("handles arrays", () => {
    lsSet(key, [1, 2, 3]);
    expect(lsGet(key)).toEqual([1, 2, 3]);
  });

  it("remove actually removes", () => {
    lsSet(key, "exists");
    lsRemove(key);
    expect(lsGet(key)).toBeNull();
  });

  it("overwrites existing key", () => {
    lsSet(key, "v1");
    lsSet(key, "v2");
    expect(lsGet(key)).toBe("v2");
  });
});

// ── Constants ─────────────────────────────────────────────────────
describe("constants", () => {
  it("BET_STORAGE_KEY is a string",     () => expect(typeof BET_STORAGE_KEY).toBe("string"));
  it("BREAK_EVEN_PCT is close to 52.38", () => expect(BREAK_EVEN_PCT).toBeCloseTo(52.38, 1));
});
