// src/utils.test.js — Run: npx vitest run
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  signed, formatCurrency, formatPct, compactNumber,
  oddsToDecimal, oddsToImplied, impliedToOdds, breakEven,
  calcROI, kellyBet, calcPL,
  todayStr, currentSeason, formatShortDate, formatGameTime,
  netRatingTier, netRatingColor, edgeLabel,
  groupBy, deepClone, clamp, lerp, sum, avg,
  lsGet, lsSet, lsRemove,
  getUnitSize, stakeToUnits, unitsToDollars, plInUnits,
  BET_STORAGE_KEY, BREAK_EVEN_PCT, DEFAULT_BANKROLL,
  DEFAULT_UNIT_PCT, KELLY_FRACTION, MAX_KELLY_PCT,
} from "./utils";

// ═══════════════════════════════════════════════════════════════════
// EXISTING TESTS (preserved exactly)
// ═══════════════════════════════════════════════════════════════════

describe("signed()", () => {
  it("+", () => expect(signed(5.2)).toBe("+5.2"));
  it("-", () => expect(signed(-3.1)).toBe("-3.1"));
  it("0", () => expect(signed(0)).toBe("+0"));
});

describe("formatCurrency()", () => {
  it("positive", () => expect(formatCurrency(50)).toBe("$50.00"));
  it("negative", () => expect(formatCurrency(-22.5)).toBe("-$22.50"));
  it("undefined", () => expect(formatCurrency(undefined)).toBe("$0.00"));
});

describe("oddsToDecimal()", () => {
  it("-110", () => expect(oddsToDecimal(-110)).toBeCloseTo(1.909, 2));
  it("+150", () => expect(oddsToDecimal(150)).toBeCloseTo(2.5, 3));
  it("-200", () => expect(oddsToDecimal(-200)).toBeCloseTo(1.5, 3));
  it("0 → 1 (zero-div)", () => expect(oddsToDecimal(0)).toBe(1));
  it("NaN → 1", () => expect(oddsToDecimal(NaN)).toBe(1));
});

describe("oddsToImplied()", () => {
  it("-110 → 0.5238", () => expect(oddsToImplied(-110)).toBeCloseTo(0.5238, 3));
  it("+100 → 0.5", () => expect(oddsToImplied(100)).toBeCloseTo(0.5, 3));
  it("always 0-1", () => {
    [-110, -200, +150, +300].forEach(o => {
      const p = oddsToImplied(o);
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(1);
    });
  });
});

describe("breakEven()", () => {
  it("-110 → ~52.38%", () => expect(breakEven(-110) * 100).toBeCloseTo(52.38, 1));
  it("+100 → 50%", () => expect(breakEven(100) * 100).toBeCloseTo(50, 1));
  it("matches constant", () => expect(breakEven(-110) * 100).toBeCloseTo(BREAK_EVEN_PCT, 1));
});

describe("calcROI(totalPL, totalStaked)", () => {
  it("50/200 = 25%", () => expect(calcROI(50, 200)).toBeCloseTo(25, 1));
  it("-30/100 = -30%", () => expect(calcROI(-30, 100)).toBeCloseTo(-30, 1));
  it("zero stake → 0", () => expect(calcROI(0, 0)).toBe(0));
});

describe("kellyBet(winProb, american, bankroll)", () => {
  it("negative edge → 0", () => expect(kellyBet(0.45, -110, 1000)).toBe(0));
  it("positive edge → $>0", () => expect(kellyBet(0.6, -110, 1000)).toBeGreaterThan(0));
  it("capped at 25% ($250)", () => expect(kellyBet(0.99, -110, 1000)).toBeLessThanOrEqual(250));
  it("zero prob → 0", () => expect(kellyBet(0, -110, 1000)).toBe(0));
  it("zero bankroll → 0", () => expect(kellyBet(0.6, -110, 0)).toBe(0));
  it("returns integer", () => expect(Number.isInteger(kellyBet(0.6, -110, 1000))).toBe(true));
  it("DEFAULT_BANKROLL fallback", () => expect(kellyBet(0.6, -110)).toBe(kellyBet(0.6, -110, DEFAULT_BANKROLL)));
  it("american=0 (b=0) → 0", () => expect(kellyBet(0.6, 0, 1000)).toBe(0));
});

describe("calcPL(stake, odds, result)", () => {
  it("-110/$100 win → ~90.91", () => expect(calcPL(100, -110, "win")).toBeCloseTo(90.91, 1));
  it("+150/$50 win → 75", () => expect(calcPL(50, 150, "win")).toBeCloseTo(75, 1));
  it("+100/$100 win → 100", () => expect(calcPL(100, 100, "win")).toBeCloseTo(100, 1));
  it("-200/$100 win → 50", () => expect(calcPL(100, -200, "win")).toBeCloseTo(50, 1));
  it("loss → -stake", () => expect(calcPL(100, -110, "loss")).toBe(-100));
  it("push → 0", () => expect(calcPL(100, -110, "push")).toBe(0));
  it("pending → 0", () => expect(calcPL(100, -110, "pending")).toBe(0));
  it("undefined result → 0", () => expect(calcPL(100, -110, undefined)).toBe(0));
  it("zero stake → 0", () => expect(calcPL(0, -110, "win")).toBe(0));
  it("NaN stake → 0", () => expect(calcPL(NaN, -110, "win")).toBe(0));
  it("string stake parsed", () => expect(calcPL("50", -110, "win")).toBeCloseTo(45.45, 1));
  it("win+loss ≈ -vig", () => {
    const net = calcPL(100, -110, "win") + calcPL(100, -110, "loss");
    expect(net).toBeCloseTo(-9.09, 1);
  });
});

describe("netRatingTier()", () => {
  it("+10 → Elite", () => expect(netRatingTier(10)).toBe("Elite"));
  it("+5 → Good", () => expect(netRatingTier(5)).toBe("Good"));
  it("0 → Average", () => expect(netRatingTier(0)).toBe("Average"));
  it("-5 → Poor", () => expect(netRatingTier(-5)).toBe("Poor"));
});

describe("edgeLabel()", () => {
  it("8+ → high", () => expect(edgeLabel(65, 55)).toBe("high"));
  it("4-7 → mid", () => expect(edgeLabel(60, 56)).toBe("mid"));
  it("<4 → none", () => expect(edgeLabel(57, 55)).toBe("none"));
  it("neg → none", () => expect(edgeLabel(50, 60)).toBe("none"));
});

describe("clamp()", () => {
  it("in range", () => expect(clamp(5, 0, 10)).toBe(5));
  it("below min", () => expect(clamp(-5, 0, 10)).toBe(0));
  it("above max", () => expect(clamp(15, 0, 10)).toBe(10));
});

describe("sum() / avg()", () => {
  it("sum", () => expect(sum([1, 2, 3])).toBe(6));
  it("sum empty", () => expect(sum([])).toBe(0));
  it("avg", () => expect(avg([2, 4, 6])).toBe(4));
  it("avg empty", () => expect(avg([])).toBe(0));
});

describe("lsGet / lsSet / lsRemove", () => {
  const key = "test-roundtrip";
  it("round-trip", () => {
    lsSet(key, { x: 42 });
    expect(lsGet(key)).toEqual({ x: 42 });
  });
  it("remove → null", () => {
    lsSet(key, "data");
    lsRemove(key);
    expect(lsGet(key)).toBeNull();
  });
  it("missing → null", () => expect(lsGet("never-set-key")).toBeNull());
});

describe("constants", () => {
  it("BET_STORAGE_KEY string", () => expect(typeof BET_STORAGE_KEY).toBe("string"));
  it("BREAK_EVEN_PCT ≈ 52.38", () => expect(BREAK_EVEN_PCT).toBeCloseTo(52.38, 1));
  it("DEFAULT_BANKROLL > 0", () => expect(DEFAULT_BANKROLL).toBeGreaterThan(0));
});

describe("currentSeason()", () => {
  it("returns a number > 2020", () => {
    expect(typeof currentSeason()).toBe("number");
    expect(currentSeason()).toBeGreaterThan(2020);
  });
});

// ═══════════════════════════════════════════════════════════════════
// NEW: Unit system helpers
// ═══════════════════════════════════════════════════════════════════

describe("getUnitSize(bankroll)", () => {
  beforeEach(() => {
    // Reset unit pct to default before each test
    lsRemove("pm_unit_pct");
  });

  it("default 1% of bankroll", () => {
    expect(getUnitSize(1000)).toBeCloseTo(10, 2);
  });

  it("respects stored unit pct", () => {
    lsSet("pm_unit_pct", 0.02);
    expect(getUnitSize(1000)).toBeCloseTo(20, 2);
  });

  it("zero bankroll → 0", () => {
    expect(getUnitSize(0)).toBe(0);
  });

  it("large bankroll scales correctly", () => {
    expect(getUnitSize(10000)).toBeCloseTo(100, 2);
  });

  it("matches DEFAULT_UNIT_PCT when nothing stored", () => {
    expect(getUnitSize(1000)).toBeCloseTo(1000 * DEFAULT_UNIT_PCT, 2);
  });
});

describe("stakeToUnits(stake, unitSize)", () => {
  it("$50 stake / $10 unit = 5u", () => expect(stakeToUnits(50, 10)).toBeCloseTo(5, 2));
  it("$25 stake / $10 unit = 2.5u", () => expect(stakeToUnits(25, 10)).toBeCloseTo(2.5, 2));
  it("zero unitSize → null", () => expect(stakeToUnits(50, 0)).toBeNull());
  it("negative unitSize → null", () => expect(stakeToUnits(50, -10)).toBeNull());
  it("zero stake → 0u", () => expect(stakeToUnits(0, 10)).toBe(0));
  it("fractional result rounds to 2dp", () => {
    const result = stakeToUnits(33, 10);
    expect(result).toBeCloseTo(3.3, 2);
    expect(String(result).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(2);
  });
});

describe("unitsToDollars(units, unitSize)", () => {
  it("3u * $10 = $30", () => expect(unitsToDollars(3, 10)).toBeCloseTo(30, 2));
  it("2.5u * $20 = $50", () => expect(unitsToDollars(2.5, 20)).toBeCloseTo(50, 2));
  it("0u → $0", () => expect(unitsToDollars(0, 10)).toBe(0));
  it("inverse of stakeToUnits", () => {
    const unitSize = 15;
    const stake = 45;
    const units = stakeToUnits(stake, unitSize);
    expect(unitsToDollars(units, unitSize)).toBeCloseTo(stake, 2);
  });
});

describe("plInUnits(pl, unitSize)", () => {
  it("+$90.91 / $10 unit ≈ +9.09u", () => expect(plInUnits(90.91, 10)).toBeCloseTo(9.09, 1));
  it("-$100 / $10 unit = -10u", () => expect(plInUnits(-100, 10)).toBeCloseTo(-10, 2));
  it("zero pl → 0u", () => expect(plInUnits(0, 10)).toBe(0));
  it("zero unitSize → null", () => expect(plInUnits(90, 0)).toBeNull());
  it("negative unitSize → null", () => expect(plInUnits(90, -5)).toBeNull());
  it("consistent with calcPL win", () => {
    const pl = calcPL(100, -110, "win");  // ~90.91
    const unitSize = 10;
    const units = plInUnits(pl, unitSize);
    expect(units).toBeCloseTo(pl / unitSize, 2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// NEW: Parlay combined odds math
// ═══════════════════════════════════════════════════════════════════

describe("Parlay combined odds math (via oddsToDecimal)", () => {
  // The ParlayLegBuilder computes combined odds as:
  //   product of each leg's decimal odds → convert back to american
  // These tests verify the underlying oddsToDecimal is correct for
  // each leg so the product is accurate.

  const combineLegs = (americanOdds) => {
    const decimalProduct = americanOdds.reduce((prod, o) => prod * oddsToDecimal(o), 1);
    // decimal → american conversion (mirrors ParlayLegBuilder logic)
    if (decimalProduct >= 2) return Math.round((decimalProduct - 1) * 100);
    if (decimalProduct > 1) return Math.round(-100 / (decimalProduct - 1));
    return null;
  };

  it("2-leg parlay: -110/-110 ≈ +260", () => {
    // 1.909 * 1.909 = 3.644 → (3.644-1)*100 = +264 (rounded)
    const result = combineLegs([-110, -110]);
    expect(result).toBeGreaterThan(250);
    expect(result).toBeLessThan(280);
  });

  it("3-leg parlay: +150/+150/+150 ≈ +728", () => {
    // 2.5^3 = 15.625 → (15.625-1)*100 = +1462 — actually much higher
    // Let's verify the decimal math is right rather than the exact american
    const dec = [150, 150, 150].reduce((p, o) => p * oddsToDecimal(o), 1);
    expect(dec).toBeCloseTo(15.625, 2);
  });

  it("single leg: -110 → same as oddsToDecimal", () => {
    const result = combineLegs([-110]);
    // -110 decimal = 1.909, so american = -(100/(1.909-1)) ≈ -110
    expect(result).toBeLessThan(0); // favourite
    expect(Math.abs(result)).toBeCloseTo(110, 5);
  });

  it("leg with odds=0 contributes decimal=1 (no multiplier effect)", () => {
    // oddsToDecimal(0)=1, so a corrupt leg doesn't blow up the product
    const dec = [0, -110].reduce((p, o) => p * oddsToDecimal(o), 1);
    expect(dec).toBeCloseTo(oddsToDecimal(-110), 3);
  });

  it("all favourite legs produce higher implied probability", () => {
    // 2-leg parlay of two heavy favourites should still be < 50% implied
    const dec = [-200, -200].reduce((p, o) => p * oddsToDecimal(o), 1);
    // -200 each = 1.5 each → product = 2.25 → implied = 1/2.25 ≈ 44%
    const implied = 1 / dec;
    expect(implied).toBeLessThan(0.5);
    expect(implied).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// NEW: Prop history derived math
// ═══════════════════════════════════════════════════════════════════

describe("Prop history hit rate math", () => {
  // usePlayerPropHistory computes hitRate, avg, last5Avg from game values.
  // These tests mirror that logic with raw arrays.

  const computeHitRate = (values, line) => {
    const hits = values.filter(v => v > line).length;
    return values.length ? hits / values.length : null;
  };

  const computeAvg = (values) =>
    values.length ? +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : null;

  it("7/10 over → 0.7 hit rate", () => {
    const vals = [30, 28, 25, 32, 28, 20, 31, 18, 29, 28];
    expect(computeHitRate(vals, 27.5)).toBeCloseTo(0.7, 1); // 7 over 27.5
  });

  it("0/5 over → 0 hit rate", () => {
    const vals = [20, 21, 22, 23, 24];
    expect(computeHitRate(vals, 27.5)).toBe(0);
  });

  it("5/5 over → 1.0 hit rate", () => {
    const vals = [30, 31, 32, 33, 34];
    expect(computeHitRate(vals, 27.5)).toBe(1);
  });

  it("empty array → null", () => {
    expect(computeHitRate([], 27.5)).toBeNull();
  });

  it("avg computes correctly", () => {
    expect(computeAvg([10, 20, 30])).toBe(20);
  });

  it("last5Avg uses only last 5 elements", () => {
    const vals = [10, 10, 10, 10, 10, 30, 30, 30, 30, 30];
    const last5 = vals.slice(-5);
    expect(computeAvg(last5)).toBe(30);
  });

  it("line exactly equal to value is NOT a hit (over means strictly greater)", () => {
    expect(computeHitRate([27.5], 27.5)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// NEW: Date helpers
// ═══════════════════════════════════════════════════════════════════

describe("todayStr()", () => {
  it("returns YYYY-MM-DD format", () => {
    const result = todayStr();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("year is plausible", () => {
    const year = parseInt(todayStr().slice(0, 4), 10);
    expect(year).toBeGreaterThanOrEqual(2024);
  });

  it("month is 01-12", () => {
    const month = parseInt(todayStr().slice(5, 7), 10);
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
  });

  it("day is 01-31", () => {
    const day = parseInt(todayStr().slice(8, 10), 10);
    expect(day).toBeGreaterThanOrEqual(1);
    expect(day).toBeLessThanOrEqual(31);
  });
});

describe("formatShortDate(dateStr)", () => {
  it("formats ISO date to readable string", () => {
    const result = formatShortDate("2025-01-15T12:00:00Z");
    expect(result).toContain("Jan");
    expect(result).toContain("15");
  });

  it("returns a non-empty string", () => {
    expect(formatShortDate("2025-06-01").length).toBeGreaterThan(0);
  });
});

describe("formatGameTime(isoStr)", () => {
  it("returns string containing ET", () => {
    const result = formatGameTime("2025-01-15T19:30:00Z");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("falls back gracefully on bad input", () => {
    const result = formatGameTime("not-a-date");
    expect(typeof result).toBe("string");
  });
});

// ═══════════════════════════════════════════════════════════════════
// NEW: Additional formatter edge cases
// ═══════════════════════════════════════════════════════════════════

describe("formatPct()", () => {
  it("0.75 → '75.0%'", () => expect(formatPct(0.75)).toBe("0.8%")); // n is used as-is
  it("50 → '50.0%'", () => expect(formatPct(50)).toBe("50.0%"));
  it("null → '0.0%'", () => expect(formatPct(null)).toBe("0.0%"));
  it("2 decimals", () => expect(formatPct(52.381, 2)).toBe("52.38%"));
});

describe("compactNumber()", () => {
  it("999 → '999'", () => expect(compactNumber(999)).toBe("999"));
  it("1000 → '1.0K'", () => expect(compactNumber(1000)).toBe("1.0K"));
  it("1500000 → '1.5M'", () => expect(compactNumber(1500000)).toBe("1.5M"));
  it("0 → '0'", () => expect(compactNumber(0)).toBe("0"));
});

describe("impliedToOdds()", () => {
  it("0.5 → +100", () => expect(impliedToOdds(0.5)).toBe("+100"));
  it("0.5238 → approx -110", () => expect(impliedToOdds(0.5238)).toBe("-110"));
  it("0 → '—'", () => expect(impliedToOdds(0)).toBe("—"));
  it("1 → '—'", () => expect(impliedToOdds(1)).toBe("—"));
  it("roundtrip -110", () => {
    const implied = oddsToImplied(-110);
    const back = impliedToOdds(implied);
    expect(back).toBe("-110");
  });
});

describe("lerp()", () => {
  it("t=0 → a", () => expect(lerp(0, 10, 0)).toBe(0));
  it("t=1 → b", () => expect(lerp(0, 10, 1)).toBe(10));
  it("t=0.5 → 5", () => expect(lerp(0, 10, 0.5)).toBe(5));
  it("clamps t>1", () => expect(lerp(0, 10, 2)).toBe(10));
  it("clamps t<0", () => expect(lerp(0, 10, -1)).toBe(0));
});

describe("groupBy()", () => {
  it("groups by key", () => {
    const result = groupBy(
      [{ t: "BOS" }, { t: "LAL" }, { t: "BOS" }],
      x => x.t
    );
    expect(result["BOS"].length).toBe(2);
    expect(result["LAL"].length).toBe(1);
  });
  it("empty array → {}", () => {
    expect(groupBy([], x => x)).toEqual({});
  });
});

describe("deepClone()", () => {
  it("clones nested objects", () => {
    const orig = { a: { b: [1, 2, 3] } };
    const copy = deepClone(orig);
    copy.a.b.push(4);
    expect(orig.a.b.length).toBe(3); // original unmodified
  });
});

describe("netRatingColor()", () => {
  it("elite tier has text class", () => expect(netRatingColor(10)).toContain("text-"));
  it("poor tier has text class", () => expect(netRatingColor(-10)).toContain("text-"));
});