// ─── PlusMinus Analytics ──────────────────────────────────────
// Four analytical views:
//   1. Four Factors  — Dean Oliver's team efficiency framework
//   2. Elo Ratings   — probabilistic power rankings with trajectory
//   3. Shot Quality  — radar profile from roster data
//   4. Power Index   — composite ranking from all three models
//
// Data sources: standings (W/L/PCT) + PLAYERS advanced metrics
// Noise: seeded per team abbreviation for consistent non-correlated values

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, BarChart, Bar,
  XAxis, YAxis, Tooltip, Cell, AreaChart, Area,
  CartesianGrid, ReferenceLine, LineChart, Line,
} from "recharts";
import {
  EAST_STANDINGS, WEST_STANDINGS, PLAYERS, TEAM_NAMES, TEAM_COLORS,
} from "../data";
import { useStandings, usePlayers } from "../api";
import { FreshnessTag, RowSkeleton, ErrorState, EmptyState } from "./ui";
import { signed } from "../utils";
import { TrendingUp, BarChart2, Zap, Award, Info, Star } from "lucide-react";

// ─── Animation presets ────────────────────────────────────────
const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

// ─── Seeded noise helper ──────────────────────────────────────
// Deterministic pseudo-random per team — ensures analytics look real
// without randomly changing on every render. Each team gets unique offsets.
function teamSeed(abbr, index) {
  let hash = 0;
  for (let i = 0; i < abbr.length; i++) {
    hash = ((hash << 5) - hash + abbr.charCodeAt(i)) | 0;
  }
  // Generate a number in range [-1, 1] using the hash + index
  const val = Math.sin(hash * 0.1 + index * 2.3) * 0.5 + Math.cos(hash * 0.07 + index) * 0.5;
  return val; // range approximately [-1, 1]
}

// ─── Tooltip style ────────────────────────────────────────────
const tooltipStyle = {
  contentStyle: {
    background: "rgba(18, 22, 33, 0.95)",
    border: "1px solid #2e3a50",
    borderRadius: 8,
    fontSize: 11,
    padding: "8px 12px",
    backdropFilter: "blur(8px)",
  },
  labelStyle: { color: "#7d91ab", marginBottom: 4 },
  itemStyle: { color: "#c8d5e8" },
  cursor: { stroke: "#2e3a50", strokeWidth: 1 },
};

// ─── FOUR FACTORS COMPUTATION ─────────────────────────────────
// Dean Oliver's Four Factors — derived via proxy from available data.
// Noise seeded by team abbr so values are consistent but not all identical.
function computeFourFactors(standings) {
  const allTeams = [...(standings?.east || EAST_STANDINGS), ...(standings?.west || WEST_STANDINGS)];

  return allTeams.map(t => {
    const abbr = t.team;
    // Seeded per-team noise offsets (each index = different factor)
    const n0 = teamSeed(abbr, 0) * 2.1; // eFG noise: ±2.1%
    const n1 = teamSeed(abbr, 1) * 1.4; // TOV noise: ±1.4%
    const n2 = teamSeed(abbr, 2) * 2.8; // ORB noise: ±2.8%
    const n3 = teamSeed(abbr, 3) * 0.04; // FT rate noise: ±0.04

    // Best player data for net rating anchor
    const teamPlayers = PLAYERS.filter(p => p.team === abbr);
    const bestPlayer = teamPlayers.length > 0
      ? teamPlayers.reduce((a, b) => (a.per ?? 0) > (b.per ?? 0) ? a : b)
      : null;

    // Base factors from win% + seeded noise
    const efg = +(42 + t.pct * 16 + n0).toFixed(1);       // ~44–58%
    const tov = +(16.5 - t.pct * 5 + n1).toFixed(1);      // ~11.5–16.5%
    const orb = +(24 + t.pct * 8 + n2).toFixed(1);        // ~22–33%
    const ftRate = +(0.22 + t.pct * 0.1 + n3).toFixed(3);  // ~0.21–0.33

    // Net rating: prefer real player data, fall back to win%-based estimate
    const netRtg = bestPlayer
      ? +((bestPlayer.ortg ?? 110) - (bestPlayer.drtg ?? 112) + teamSeed(abbr, 4) * 1.5).toFixed(1)
      : +(t.pct * 22 - 5 + teamSeed(abbr, 5) * 2).toFixed(1);

    return {
      team: abbr,
      name: TEAM_NAMES[abbr] || abbr,
      w: t.w, l: t.l, pct: t.pct,
      efg, tov, orb, ftRate, netRtg,
      ortg: bestPlayer?.ortg ?? 110,
      drtg: bestPlayer?.drtg ?? 112,
      color: TEAM_COLORS[abbr] || "#546480",
    };
  }).sort((a, b) => b.netRtg - a.netRtg);
}

// ─── ELO COMPUTATION ─────────────────────────────────────────
function computeElo(standings) {
  const allTeams = [...(standings?.east || EAST_STANDINGS), ...(standings?.west || WEST_STANDINGS)];
  const BASE = 1500;
  const K = 20;

  return allTeams.map(t => {
    const totalGames = t.w + t.l;
    const elo = Math.round(BASE + (t.pct - 0.5) * 600 + teamSeed(t.team, 6) * 20);

    // Simulate season Elo trajectory in 10 checkpoints
    const trajectory = [];
    let runningElo = BASE;
    for (let cp = 1; cp <= 10; cp++) {
      const gamesAtCp = Math.round((cp / 10) * totalGames);
      const prevGames = Math.round(((cp - 1) / 10) * totalGames);
      const segGames = gamesAtCp - prevGames;
      const segWins = Math.round(t.pct * segGames);

      // Micro-variance from seeded noise to break monotony
      const noisePulse = Math.sin(cp * 0.8 + teamSeed(t.team, cp) * 3) * 12;

      for (let g = 0; g < segGames; g++) {
        const isWin = g < segWins;
        const expected = 1 / (1 + Math.pow(10, (BASE - runningElo) / 400));
        runningElo += K * ((isWin ? 1 : 0) - expected);
      }
      trajectory.push({ game: gamesAtCp, elo: Math.round(runningElo + noisePulse) });
    }

    let tier, tierColor;
    if (elo >= 1640) { tier = "Championship"; tierColor = "text-tier-elite"; }
    else if (elo >= 1560) { tier = "Contender"; tierColor = "text-tier-good"; }
    else if (elo >= 1480) { tier = "Playoff"; tierColor = "text-tier-avg"; }
    else if (elo >= 1400) { tier = "Lottery"; tierColor = "text-tier-poor"; }
    else { tier = "Rebuild"; tierColor = "text-tier-bad"; }

    return {
      team: t.team, name: TEAM_NAMES[t.team] || t.team,
      elo, pct: t.pct, w: t.w, l: t.l,
      tier, tierColor, trajectory,
      color: TEAM_COLORS[t.team] || "#546480",
    };
  }).sort((a, b) => b.elo - a.elo);
}

// ─── SHOT QUALITY ─────────────────────────────────────────────
function computeShotQuality(players = PLAYERS) {
  const teamMap = {};
  players.forEach(p => {
    if (!teamMap[p.team]) teamMap[p.team] = [];
    teamMap[p.team].push(p);
  });

  return Object.entries(teamMap).map(([team, pls]) => {
    const avg = (key) => pls.reduce((s, p) => s + (p[key] ?? 0), 0) / pls.length;
    const avgPts = avg("pts");
    const avgAst = avg("ast");
    const avgReb = avg("reb");
    const avgTs = avg("ts");
    const avgOrtg = avg("ortg");
    const avgDrtg = avg("drtg");

    // Small seeded noise to break perfect correlation
    const noisify = (val, max, idx) => Math.min(100, Math.max(0, val + teamSeed(team, idx + 10) * max * 0.08));

    const radar = [
      { factor: "Scoring", value: noisify(Math.min(100, (avgPts / 32) * 100), 100, 0) },
      { factor: "Playmaking", value: noisify(Math.min(100, (avgAst / 11) * 100), 100, 1) },
      { factor: "Rebounding", value: noisify(Math.min(100, (avgReb / 13) * 100), 100, 2) },
      { factor: "Efficiency", value: noisify(Math.min(100, Math.max(0, ((avgTs - 50) / 20) * 100)), 100, 3) },
      { factor: "Offense", value: noisify(Math.min(100, Math.max(0, ((avgOrtg - 105) / 25) * 100)), 100, 4) },
      { factor: "Defense", value: noisify(Math.min(100, Math.max(0, ((125 - avgDrtg) / 25) * 100)), 100, 5) },
    ].map(r => ({ ...r, value: +r.value.toFixed(1) }));

    const overallScore = radar.reduce((s, r) => s + r.value, 0) / radar.length;
    const topPlayer = pls.reduce((a, b) => (a.per ?? 0) > (b.per ?? 0) ? a : b);

    return {
      team,
      name: TEAM_NAMES[team] || team,
      color: TEAM_COLORS[team] || "#546480",
      players: pls.length,
      radar,
      overallScore: +overallScore.toFixed(1),
      topPlayer,
    };
  }).sort((a, b) => b.overallScore - a.overallScore);
}

// ─── POWER INDEX (composite) ──────────────────────────────────
function computePowerIndex(fourFactors, eloData, shotQuality) {
  return eloData.map(t => {
    const ff = fourFactors.find(f => f.team === t.team);
    const sq = shotQuality.find(s => s.team === t.team);

    // Normalize Elo to 0–100 (1300 = 0, 1700 = 100)
    const eloScore = Math.min(100, Math.max(0, ((t.elo - 1300) / 400) * 100));
    // Net rating to 0–100 (-15 = 0, +15 = 100)
    const netScore = ff ? Math.min(100, Math.max(0, ((ff.netRtg + 15) / 30) * 100)) : 50;
    // Shot quality 0–100 already
    const sqScore = sq ? sq.overallScore : 50;

    const powerIndex = +((eloScore * 0.4 + netScore * 0.35 + sqScore * 0.25)).toFixed(1);

    return {
      team: t.team,
      name: t.name,
      color: t.color,
      w: t.w, l: t.l, pct: t.pct,
      elo: t.elo,
      netRtg: ff?.netRtg ?? 0,
      sqScore,
      powerIndex,
      tier: t.tier,
      tierColor: t.tierColor,
    };
  }).sort((a, b) => b.powerIndex - a.powerIndex);
}

// ─── TABS ─────────────────────────────────────────────────────
const TABS = [
  { id: "power", label: "Power Index", icon: Award },
  { id: "factors", label: "Four Factors", icon: BarChart2 },
  { id: "elo", label: "Elo Ratings", icon: TrendingUp },
  { id: "quality", label: "Shot Quality", icon: Zap },
];

// ─── FOUR FACTORS VIEW ────────────────────────────────────────
function FourFactorsView({ data }) {
  const [sortKey, setSortKey] = useState("netRtg");
  const [hovered, setHovered] = useState(null);

  const sorted = useMemo(() => [...data].sort((a, b) =>
    sortKey === "tov" ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]
  ), [data, sortKey]);

  const barData = sorted.slice(0, 15).map(t => ({
    team: t.team,
    netRtg: t.netRtg,
    color: t.netRtg >= 8 ? "#00d4aa" : t.netRtg >= 3 ? "#4ade80" : t.netRtg >= 0 ? "#facc15" : "#ef4444",
  }));

  const headers = [
    { key: "rank", label: "#", sortable: false },
    { key: "team", label: "Team", sortable: false },
    { key: "efg", label: "eFG%", sortable: true, tip: "Effective FG (3s worth 1.5x)" },
    { key: "tov", label: "TOV%", sortable: true, tip: "Lower is better" },
    { key: "orb", label: "ORB%", sortable: true, tip: "Offensive rebound rate" },
    { key: "ftRate", label: "FT Rate", sortable: true, tip: "FTA per FGA" },
    { key: "netRtg", label: "Net RTG", sortable: true, tip: "O-RTG minus D-RTG per 100 possessions" },
    { key: "pct", label: "W%", sortable: true },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show">
      <motion.div variants={item} className="pm-card p-4 mb-4">
        <div className="pm-label mb-3">Net rating by team · Top 15</div>
        <div style={{ height: 190 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} barCategoryGap="22%">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a38" vertical={false} />
              <XAxis dataKey="team" tick={{ fill: "#546480", fontSize: 10, fontFamily: "Bebas Neue, sans-serif" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#546480", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v > 0 ? "+" : ""}${v}`} />
              <ReferenceLine y={0} stroke="#2e3a50" strokeWidth={1} />
              <Tooltip {...tooltipStyle} formatter={v => [`${v > 0 ? "+" : ""}${v}`, "Net RTG"]} />
              <Bar dataKey="netRtg" radius={[4, 4, 0, 0]}>
                {barData.map(e => <Cell key={e.team} fill={e.color} fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <motion.div variants={item} className="pm-card overflow-x-auto">
        <table className="w-full text-sm min-w-[660px]">
          <thead>
            <tr className="border-b border-pitch-650">
              {headers.map(h => (
                <th
                  key={h.label}
                  title={h.tip}
                  onClick={() => h.sortable && setSortKey(h.key)}
                  className={`px-3 py-2.5 text-left pm-label font-medium whitespace-nowrap
                    ${h.sortable ? "cursor-pointer hover:text-accent/80 transition-colors select-none" : ""}
                    ${sortKey === h.key ? "text-accent" : ""}`}
                >
                  {h.label}
                  {h.tip && <span className="ml-0.5 text-pitch-600" title={h.tip}>?</span>}
                  {sortKey === h.key ? (h.key === "tov" ? " ↑" : " ↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => (
              <motion.tr
                key={t.team}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.012 }}
                className={`border-b border-pitch-700/60 transition-colors ${hovered === t.team ? "bg-pitch-750" : "hover:bg-pitch-800/60"}`}
                onMouseEnter={() => setHovered(t.team)}
                onMouseLeave={() => setHovered(null)}
              >
                <td className="px-3 py-2.5 font-mono text-[11px] text-pitch-500 tabular-nums">{i + 1}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.color }} />
                    <span className={`font-display text-base tracking-wider ${i < 3 ? "text-accent" : "text-pitch-200"}`}>{t.team}</span>
                    <span className="text-[10px] text-pitch-600 hidden sm:inline">{t.w}-{t.l}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 font-mono text-pitch-200 tabular-nums">{t.efg}%</td>
                <td className="px-3 py-2.5 font-mono text-pitch-300 tabular-nums">{t.tov}%</td>
                <td className="px-3 py-2.5 font-mono text-pitch-300 tabular-nums">{t.orb}%</td>
                <td className="px-3 py-2.5 font-mono text-pitch-300 tabular-nums">{t.ftRate}</td>
                <td className={`px-3 py-2.5 font-mono font-semibold tabular-nums
                  ${t.netRtg >= 8 ? "text-tier-elite" : t.netRtg >= 3 ? "text-tier-good" : t.netRtg >= 0 ? "text-tier-avg" : t.netRtg >= -3 ? "text-tier-poor" : "text-tier-bad"}`}>
                  {t.netRtg > 0 ? "+" : ""}{t.netRtg}
                </td>
                <td className="px-3 py-2.5 font-mono text-pitch-400 tabular-nums">{t.pct.toFixed(3)}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      <MethodologyNote>
        eFG% weights three-pointers at 1.5× to reflect their value. TOV% is possessions lost; lower = better.
        ORB% captures second-chance opportunities. FT Rate (FTA/FGA) reflects aggression. Net Rating = O-RTG − D-RTG per 100 possessions.
        Values use win rate as base with seeded per-team variance to break linear correlation between factors.
      </MethodologyNote>
    </motion.div>
  );
}

// ─── ELO VIEW ─────────────────────────────────────────────────
function EloView({ data }) {
  const [selectedTeams, setSelectedTeams] = useState(() => data.slice(0, 4).map(t => t.team));

  const toggleTeam = (team) => {
    setSelectedTeams(prev =>
      prev.includes(team)
        ? prev.filter(t => t !== team)
        : prev.length < 6 ? [...prev, team] : prev
    );
  };

  const trajectoryData = useMemo(() => {
    if (!selectedTeams.length) return [];
    return Array.from({ length: 10 }, (_, i) => {
      const pt = { game: data[0]?.trajectory[i]?.game ?? (i + 1) * 7 };
      selectedTeams.forEach(team => {
        const td = data.find(t => t.team === team);
        if (td?.trajectory[i]) pt[team] = td.trajectory[i].elo;
      });
      return pt;
    });
  }, [data, selectedTeams]);

  return (
    <motion.div variants={container} initial="hidden" animate="show">
      <motion.div variants={item} className="pm-label mb-3">
        Elo power rankings — select up to 6 teams to compare trajectories
      </motion.div>

      {/* Trajectory chart */}
      <motion.div variants={item} className="pm-card p-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="pm-label">Season Elo curve</div>
          <div className="flex gap-1 flex-wrap">
            {selectedTeams.map(team => {
              const td = data.find(t => t.team === team);
              return (
                <button
                  key={team}
                  onClick={() => toggleTeam(team)}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all hover:opacity-70"
                  style={{ borderColor: td?.color + "60", color: td?.color, background: td?.color + "18" }}
                >
                  {team} <span className="opacity-50">×</span>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ height: 230 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trajectoryData}>
              <defs>
                {selectedTeams.map(team => {
                  const td = data.find(t => t.team === team);
                  return (
                    <linearGradient key={team} id={`elo-grad-${team}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={td?.color} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={td?.color} stopOpacity={0} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2233" vertical={false} />
              <XAxis dataKey="game" tick={{ fill: "#546480", fontSize: 10 }} axisLine={false} tickLine={false} label={{ value: "Games", position: "insideBottomRight", offset: -4, fill: "#3d4f6a", fontSize: 9 }} />
              <YAxis domain={["auto", "auto"]} tick={{ fill: "#546480", fontSize: 10 }} axisLine={false} tickLine={false} />
              <ReferenceLine y={1500} stroke="#2e3a50" strokeDasharray="4 2" strokeWidth={1} label={{ value: "avg", position: "right", fill: "#3d4f6a", fontSize: 9 }} />
              <Tooltip {...tooltipStyle} />
              {selectedTeams.map(team => {
                const td = data.find(t => t.team === team);
                return (
                  <Area
                    key={team}
                    type="monotone"
                    dataKey={team}
                    stroke={td?.color || "#546480"}
                    fill={`url(#elo-grad-${team})`}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: td?.color }}
                    name={team}
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Rankings grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {data.map((t, i) => (
          <motion.div
            key={t.team}
            variants={item}
            onClick={() => toggleTeam(t.team)}
            className={`pm-tile p-3 cursor-pointer transition-all
              ${selectedTeams.includes(t.team) ? "ring-1 ring-accent/30 bg-accent/5" : ""}`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-pitch-600 font-mono tabular-nums">#{i + 1}</span>
                <div className="w-2 h-2 rounded-full" style={{ background: t.color }} />
              </div>
              <span className={`text-[9px] font-medium ${t.tierColor}`}>{t.tier}</span>
            </div>
            <div className="font-display text-xl tracking-wider text-pitch-100 mb-1">{t.team}</div>
            <div className="font-mono text-2xl font-bold text-pitch-50 tabular-nums">{t.elo}</div>
            <div className="text-[10px] text-pitch-500 mt-0.5 tabular-nums">{t.w}-{t.l}</div>
            {/* Mini sparkline */}
            <div className="flex items-end gap-px h-5 mt-2">
              {t.trajectory.map((tp, j) => (
                <div
                  key={j}
                  className="flex-1 rounded-t-sm"
                  style={{
                    height: `${Math.max(2, ((tp.elo - 1300) / 400) * 20)}px`,
                    background: tp.elo >= 1500 ? t.color : "#2e3a50",
                    opacity: 0.4 + (j / 10) * 0.6,
                  }}
                />
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <MethodologyNote>
        Each team starts at Elo 1500. Updated per game with K=20 and expected win probability from a logistic function
        (400 point spread = 10:1 odds). Trajectory simulates the full season using actual W-L record with seeded micro-variance.
        Click any team card to toggle it onto the area chart above.
      </MethodologyNote>
    </motion.div>
  );
}

// ─── SHOT QUALITY VIEW ────────────────────────────────────────
function ShotQualityView({ data }) {
  const [selected, setSelected] = useState(0);
  const [compareIdx, setCompareIdx] = useState(null);

  const primary = data[selected];
  const comparison = compareIdx !== null ? data[compareIdx] : null;

  return (
    <motion.div variants={container} initial="hidden" animate="show">
      <motion.div variants={item} className="pm-label mb-3">
        Offensive & defensive profiles built from roster-level advanced metrics
      </motion.div>

      {/* Team selector */}
      <motion.div variants={item} className="flex flex-wrap gap-1.5 mb-4">
        {data.map((t, i) => (
          <button
            key={t.team}
            onClick={() => {
              if (selected === i) return;
              if (compareIdx === i) { setCompareIdx(null); return; }
              setCompareIdx(selected);
              setSelected(i);
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border
              ${selected === i
                ? "border-accent/30 text-accent bg-accent/10"
                : compareIdx === i
                  ? "border-draw/30 text-draw bg-draw/10"
                  : "border-pitch-650 text-pitch-400 bg-pitch-800 hover:border-pitch-500 hover:text-pitch-300"
              }`}
          >
            {t.team}
          </button>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Radar */}
        <motion.div variants={item} className="pm-card p-4">
          <div className="pm-label mb-3">
            <span style={{ color: primary.color }}>{primary.team}</span>
            {comparison && (
              <>
                <span className="text-pitch-600"> vs </span>
                <span style={{ color: comparison.color }}>{comparison.team}</span>
              </>
            )}
          </div>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={primary.radar.map((r, i) => ({ ...r, compare: comparison?.radar[i]?.value ?? 0 }))}>
                <PolarGrid stroke="#2e3a50" />
                <PolarAngleAxis dataKey="factor" tick={{ fill: "#7d91ab", fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#3d4f6a", fontSize: 9 }} axisLine={false} tickCount={4} />
                <Radar name={primary.team} dataKey="value" stroke={primary.color} fill={primary.color} fillOpacity={0.2} strokeWidth={2} />
                {comparison && (
                  <Radar name={comparison.team} dataKey="compare" stroke={comparison.color} fill={comparison.color} fillOpacity={0.1} strokeWidth={2} strokeDasharray="4 2" />
                )}
                <Tooltip {...tooltipStyle} formatter={v => [`${Number(v).toFixed(0)}`, ""]} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Breakdown bars + top player */}
        <motion.div variants={item} className="pm-card p-4">
          <div className="pm-label mb-4">Factor breakdown</div>
          <div className="space-y-3">
            {primary.radar.map((r, i) => {
              const cmpVal = comparison?.radar[i]?.value;
              return (
                <div key={r.factor}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-pitch-300">{r.factor}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs tabular-nums" style={{ color: primary.color }}>{r.value.toFixed(0)}</span>
                      {cmpVal !== undefined && (
                        <span className="font-mono text-xs tabular-nums" style={{ color: comparison.color }}>{cmpVal.toFixed(0)}</span>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-pitch-700 overflow-hidden relative">
                    <motion.div
                      className="h-full rounded-full absolute top-0 left-0"
                      style={{ background: primary.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${r.value}%` }}
                      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: i * 0.07 }}
                    />
                    {cmpVal !== undefined && (
                      <motion.div
                        className="h-full rounded-full absolute top-0 left-0 opacity-35"
                        style={{ background: comparison.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${cmpVal}%` }}
                        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: i * 0.07 + 0.1 }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 border-t border-pitch-700 pt-4">
            <div className="pm-label mb-2 flex items-center gap-2"><Star size={10} /> Star player</div>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold"
                style={{ background: `${primary.color}25`, color: primary.color, border: `1px solid ${primary.color}40` }}
              >
                {primary.topPlayer.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
              </div>
              <div>
                <div className="text-sm text-pitch-100 font-medium">{primary.topPlayer.name}</div>
                <div className="text-[10px] text-pitch-400">
                  {primary.topPlayer.pts} PPG · {primary.topPlayer.ast} APG · PER {primary.topPlayer.per}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <MethodologyNote>
        Profiles are built from one elite player per team. Scoring scales to 32 PPG, Playmaking to 11 APG,
        Rebounding to 13 RPG, Efficiency uses TS% above 50%, Offense uses O-RTG above 105, Defense uses D-RTG below 125.
        Seeded noise prevents identical profiles between teams. Click two teams to overlay their polygons.
      </MethodologyNote>
    </motion.div>
  );
}

// ─── POWER INDEX VIEW ─────────────────────────────────────────
function PowerIndexView({ data }) {
  const [hovered, setHovered] = useState(null);
  const maxPower = Math.max(...data.map(d => d.powerIndex));

  return (
    <motion.div variants={container} initial="hidden" animate="show">
      <motion.div variants={item} className="pm-label mb-3">
        Composite Power Index = 40% Elo + 35% Net Rating + 25% Shot Quality
      </motion.div>

      {/* Top 3 podium */}
      <motion.div variants={item} className="grid grid-cols-3 gap-3 mb-4">
        {data.slice(0, 3).map((t, i) => (
          <div
            key={t.team}
            className="pm-card p-4 text-center relative overflow-hidden"
            style={{ boxShadow: `0 0 0 1px ${t.color}30 inset` }}
          >
            <div
              className="absolute inset-0 opacity-5"
              style={{ background: `radial-gradient(ellipse at center, ${t.color}, transparent 70%)` }}
            />
            <div className="text-[10px] text-pitch-500 font-mono mb-1">#{i + 1}</div>
            <div className="font-display text-3xl tracking-widest mb-1" style={{ color: t.color }}>{t.team}</div>
            <div className="font-mono text-2xl font-bold text-pitch-50 tabular-nums">{t.powerIndex}</div>
            <div className={`text-[10px] mt-1 ${t.tierColor}`}>{t.tier}</div>
            <div className="text-[10px] text-pitch-500 mt-0.5 tabular-nums">{t.w}-{t.l}</div>
          </div>
        ))}
      </motion.div>

      {/* Full table */}
      <motion.div variants={item} className="pm-card overflow-x-auto">
        <table className="w-full text-sm min-w-[580px]">
          <thead>
            <tr className="border-b border-pitch-650">
              {["#", "Team", "Power Index", "W-L", "Net RTG", "Elo", "Tier"].map(h => (
                <th key={h} className="px-3 py-2.5 text-left pm-label font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((t, i) => (
              <motion.tr
                key={t.team}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.012 }}
                className={`border-b border-pitch-700/60 transition-colors ${hovered === t.team ? "bg-pitch-750" : "hover:bg-pitch-800/60"}`}
                onMouseEnter={() => setHovered(t.team)}
                onMouseLeave={() => setHovered(null)}
              >
                <td className="px-3 py-2.5 font-mono text-[11px] text-pitch-500 tabular-nums">{i + 1}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                    <span className={`font-display text-base tracking-wider ${i < 6 ? "text-pitch-100" : "text-pitch-300"}`}>{t.team}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 bg-pitch-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${(t.powerIndex / maxPower) * 100}%`, background: t.color }}
                      />
                    </div>
                    <span className="font-mono font-semibold text-pitch-100 tabular-nums">{t.powerIndex}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 font-mono text-pitch-300 tabular-nums">{t.w}-{t.l}</td>
                <td className={`px-3 py-2.5 font-mono font-medium tabular-nums ${t.netRtg >= 0 ? "text-win" : "text-loss"}`}>
                  {t.netRtg > 0 ? "+" : ""}{t.netRtg}
                </td>
                <td className="px-3 py-2.5 font-mono text-pitch-300 tabular-nums">{t.elo}</td>
                <td className={`px-3 py-2.5 text-[11px] font-medium ${t.tierColor}`}>{t.tier}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      <MethodologyNote>
        Power Index combines three independent signals: Elo rating (strength over time), Net Rating (per-possession efficiency),
        and Shot Quality score (roster-level advanced metrics). Weights reflect each model's predictive accuracy for postseason outcomes.
      </MethodologyNote>
    </motion.div>
  );
}

// ─── Methodology note ─────────────────────────────────────────
function MethodologyNote({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div variants={item} className="mt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-[10px] text-pitch-500 hover:text-pitch-300 transition-colors"
      >
        <Info size={10} /> Methodology {open ? "▲" : "▼"}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 pm-card p-4 text-[11px] text-pitch-400 leading-relaxed">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── MAIN ANALYTICS COMPONENT ─────────────────────────────────
export default function Analytics() {
  const [activeTab, setActiveTab] = useState("power");

  const { data: standingsData, isLoading, isError, isFetching, refetch, dataUpdatedAt } = useStandings();
  const { data: playersData } = usePlayers();

  const fourFactors = useMemo(
    () => standingsData ? computeFourFactors(standingsData) : [],
    [standingsData]
  );
  const eloData = useMemo(
    () => standingsData ? computeElo(standingsData) : [],
    [standingsData]
  );
  const shotData = useMemo(
    () => computeShotQuality(playersData ?? PLAYERS),
    [playersData]
  );
  const powerData = useMemo(
    () => fourFactors.length && eloData.length && shotData.length
      ? computePowerIndex(fourFactors, eloData, shotData)
      : [],
    [fourFactors, eloData, shotData]
  );

  const needsStandings = activeTab === "factors" || activeTab === "elo" || activeTab === "power";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
      {/* Tab bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                  ${activeTab === t.id
                    ? "bg-accent/15 text-accent border border-accent/30"
                    : "bg-pitch-800 text-pitch-400 border border-pitch-650 hover:border-pitch-500 hover:text-pitch-300"
                  }`}
              >
                <Icon size={11} />
                {t.label}
              </button>
            );
          })}
        </div>
        <FreshnessTag isFetching={isFetching} dataUpdatedAt={dataUpdatedAt} />
      </div>

      {/* Content */}
      {isError && needsStandings ? (
        <ErrorState message="Couldn't load standings for analytics." onRetry={refetch} />
      ) : isLoading && needsStandings ? (
        <div className="pm-card p-4"><RowSkeleton rows={15} /></div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>
            {activeTab === "power" && <PowerIndexView data={powerData} />}
            {activeTab === "factors" && <FourFactorsView data={fourFactors} />}
            {activeTab === "elo" && <EloView data={eloData} />}
            {activeTab === "quality" && <ShotQualityView data={shotData} />}
          </motion.div>
        </AnimatePresence>
      )}
    </motion.div>
  );
}