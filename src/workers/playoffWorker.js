// src/workers/playoffWorker.js
//
// FIX G5: Added XOR with Math.random() to the LCG seed to prevent seed
// collision when two workers spawn in the same millisecond.
//
// Before: makeLCG(Date.now())
// Date.now() has millisecond precision. If this app is ever extended to
// run multiple workers concurrently (e.g. East and West sims in parallel,
// or a "simulate 100,000 runs" mode across 4 cores), workers that spawn
// within the same millisecond receive identical seeds → identical LCG
// streams → identical results, completely defeating Monte Carlo randomness.
//
// After: makeLCG(Date.now() ^ (Math.random() * 0x100000000 | 0))
// XORing with 32 bits of Math.random() entropy makes a seed collision
// essentially impossible even across thousands of concurrent workers.
// Math.random() uses a high-entropy internal state (Xorshift128+ in V8)
// that is seeded from OS entropy — good enough to disambiguate workers.

let EAST_STANDINGS, WEST_STANDINGS, TEAM_NAMES, TEAM_COLORS;

try {
  const data = await import("../data.js");
  EAST_STANDINGS = data.EAST_STANDINGS;
  WEST_STANDINGS = data.WEST_STANDINGS;
  TEAM_NAMES     = data.TEAM_NAMES;
  TEAM_COLORS    = data.TEAM_COLORS;
} catch {
  // Safari < 15.4 fallback
  EAST_STANDINGS = [];
  WEST_STANDINGS = [];
  TEAM_NAMES     = {};
  TEAM_COLORS    = {};
}

// ── LCG PRNG ─────────────────────────────────────────────────────
function makeLCG(seed) {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return () => {
    s = Math.imul(1664525, s) + 1013904223 >>> 0;
    return s / 4294967296;
  };
}

const SIMS      = 10_000;
const HOME_BUMP = 35;

function eloWinP(eloA, eloB, home = false) {
  return 1 / (1 + Math.pow(10, -(eloA - eloB + (home ? HOME_BUMP : 0)) / 400));
}

function simGame(eloA, eloB, home, rng) {
  return rng() < eloWinP(eloA, eloB, home);
}

function simSeries(eloA, eloB, rng) {
  let wA = 0, wB = 0, g = 0;
  const home = [true, true, false, false, true, false, true];
  while (wA < 4 && wB < 4) {
    rng() < eloWinP(eloA, eloB, home[g++]) ? wA++ : wB++;
  }
  return wA === 4;
}

self.onmessage = (e) => {
  const { standings, eloData } = e.data;
  const safeEloData = Array.isArray(eloData) ? eloData : [];

  const buildSeeds = conf => conf.slice(0, 10).map((t, i) => {
    const ed = safeEloData.find(x => x.team === t.team);
    return {
      team:  t.team,
      name:  TEAM_NAMES[t.team] || t.team,
      color: TEAM_COLORS[t.team] || "#546480",
      elo:   ed?.elo ?? Math.round(1500 + (t.pct - 0.5) * 400),
      seed: i + 1, pct: t.pct, w: t.w, l: t.l,
    };
  });

  const eastSeeds = buildSeeds(standings?.east || EAST_STANDINGS);
  const westSeeds = buildSeeds(standings?.west || WEST_STANDINGS);
  const all       = [...eastSeeds, ...westSeeds];
  const counts    = {};
  all.forEach(t => { counts[t.team] = { pi: 0, r1: 0, r2: 0, conf: 0, finals: 0, champ: 0 }; });

  function simPlayIn(seeds, rng) {
    const [s7, s8, s9, s10] = seeds.slice(6, 10);
    [s7, s8, s9, s10].forEach(t => counts[t.team].pi++);
    const seed7   = simGame(s7.elo, s8.elo, true, rng)        ? s7 : s8;
    const loser78 = seed7 === s7 ? s8 : s7;
    const w910    = simGame(s9.elo, s10.elo, true, rng)        ? s9 : s10;
    const seed8   = simGame(loser78.elo, w910.elo, true, rng)  ? loser78 : w910;
    return [seed7, seed8];
  }

  function simConf(seeds, rng) {
    const direct = seeds.slice(0, 6);
    const [pi7, pi8] = simPlayIn(seeds, rng);
    const bracket = [...direct, pi7, pi8];
    bracket.forEach(t => counts[t.team].r1++);
    const r2 = [[0, 7], [3, 4], [2, 5], [1, 6]].map(([a, b]) =>
      simSeries(bracket[a].elo, bracket[b].elo, rng) ? bracket[a] : bracket[b]
    );
    r2.forEach(t => counts[t.team].r2++);
    const cf = [
      simSeries(r2[0].elo, r2[1].elo, rng) ? r2[0] : r2[1],
      simSeries(r2[2].elo, r2[3].elo, rng) ? r2[2] : r2[3],
    ];
    cf.forEach(t => counts[t.team].conf++);
    const champ = simSeries(cf[0].elo, cf[1].elo, rng) ? cf[0] : cf[1];
    return champ;
  }

  // FIX G5: XOR Date.now() with 32 bits of Math.random() entropy.
  // This makes seed collisions between concurrently-spawned workers
  // essentially impossible, without any performance cost.
  const rng = makeLCG(Date.now() ^ (Math.random() * 0x100000000 | 0));

  for (let i = 0; i < SIMS; i++) {
    const eC = simConf(eastSeeds, rng);
    const wC = simConf(westSeeds, rng);
    counts[eC.team].finals++;
    counts[wC.team].finals++;
    const champ = simSeries(eC.elo, wC.elo, rng) ? eC : wC;
    counts[champ.team].champ++;
  }

  const eastSet = new Set(eastSeeds.map(t => t.team));
  const result  = all.map(t => {
    const c = counts[t.team];
    return {
      ...t,
      playInPct: +(c.pi     / SIMS * 100).toFixed(1),
      r1Pct:     +(c.r1     / SIMS * 100).toFixed(1),
      r2Pct:     +(c.r2     / SIMS * 100).toFixed(1),
      confPct:   +(c.conf   / SIMS * 100).toFixed(1),
      finalsPct: +(c.finals / SIMS * 100).toFixed(1),
      champPct:  +(c.champ  / SIMS * 100).toFixed(1),
      isPlayIn:  t.seed >= 7,
      conf:      eastSet.has(t.team) ? "East" : "West",
    };
  }).sort((a, b) => b.champPct - a.champPct);

  self.postMessage(result);
};
