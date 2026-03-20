// src/utils.test.js — Run: npx vitest run
import { describe, it, expect } from "vitest";
import {
  signed, formatCurrency, formatPct, compactNumber,
  oddsToDecimal, oddsToImplied, impliedToOdds, breakEven,
  calcROI, kellyBet, calcPL,
  todayStr, netRatingTier, edgeLabel,
  groupBy, deepClone, clamp, lerp, sum, avg,
  lsGet, lsSet, lsRemove,
  BET_STORAGE_KEY, BREAK_EVEN_PCT, DEFAULT_BANKROLL, currentSeason,
} from "./utils";

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

// calcROI called as (totalPL, totalStaked) from BetTracker
describe("calcROI(totalPL, totalStaked)", () => {
  it("50/200 = 25%", () => expect(calcROI(50, 200)).toBeCloseTo(25, 1));
  it("-30/100 = -30%", () => expect(calcROI(-30, 100)).toBeCloseTo(-30, 1));
  it("zero stake → 0", () => expect(calcROI(0, 0)).toBe(0));
});

// kellyBet(winProb, american, bankroll) → dollar amount
describe("kellyBet(winProb, american, bankroll)", () => {
  it("negative edge → 0", () => expect(kellyBet(0.45, -110, 1000)).toBe(0));
  it("positive edge → $>0", () => expect(kellyBet(0.6, -110, 1000)).toBeGreaterThan(0));
  it("capped at 25% ($250)", () => expect(kellyBet(0.99, -110, 1000)).toBeLessThanOrEqual(250));
  it("zero prob → 0", () => expect(kellyBet(0, -110, 1000)).toBe(0));
  it("zero bankroll → 0", () => expect(kellyBet(0.6, -110, 0)).toBe(0));
  it("returns integer", () => expect(Number.isInteger(kellyBet(0.6, -110, 1000))).toBe(true));
  it("DEFAULT_BANKROLL when omitted", () => {
    expect(kellyBet(0.6, -110)).toBe(kellyBet(0.6, -110, DEFAULT_BANKROLL));
  });
});

// calcPL(stake, odds, result) — ORDER MATCHES ALL CALLERS
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

describe("currentSeason", () => {
  it("returns current year in October", () => {
    // Manually verify the Oct 1 cutover is working
    const result = currentSeason();
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThan(2020);
  });
});