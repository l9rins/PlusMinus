// ─── PlusMinus Analytics ──────────────────────────────────────
// Five analytical views:
//   1. Power Index   — composite ranking from all three models
//   2. Four Factors  — Dean Oliver's team efficiency framework
//   3. Elo Ratings   — probabilistic power rankings with trajectory
//   4. Shot Quality  — radar profile from roster data
//   5. Playoff Sim   — Monte Carlo bracket simulation (10,000 runs)

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, BarChart, Bar,
  XAxis, YAxis, Tooltip as RechartsTooltip, Cell, AreaChart, Area,
  CartesianGrid, ReferenceLine,
} from "recharts";
import {
  EAST_STANDINGS, WEST_STANDINGS, PLAYERS, TEAM_NAMES, TEAM_COLORS,
} from "../data";
import { useStandings, useLeagueTeamStats, useEnrichedPlayerStats, useEloData, useFourFactorsStats } from "../api";
import { FreshnessTag, RowSkeleton, ErrorState, Tooltip } from "./ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { signed, reshapeNBAStats, lsGet, lsSet, calcPercentile } from "../utils";
import { TrendingUp, BarChart2, Zap, Award, Info, Star, Trophy } from "lucide-react";
import { cn } from "../lib/utils";
import PlayoffBracket from "./PlayoffBracket";

// Constants mirrored from playoffWorker.js for display purposes
const SIMS = 10_000;
const HOME_BUMP = 35;

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

function teamSeed(abbr, index) {
  let hash = 0;
  for (let i = 0; i < abbr.length; i++) hash = ((hash << 5) - hash + abbr.charCodeAt(i)) | 0;
  return Math.sin(hash * 0.1 + index * 2.3) * 0.5 + Math.cos(hash * 0.07 + index) * 0.5;
}

const tooltipStyle = {
  contentStyle: { 
    background: "var(--neon-bg)", 
    border: "1px solid var(--neon-border-md)", 
    borderRadius: "4px", 
    fontSize: 10, 
    padding: "8px 12px", 
    boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
    fontFamily: "inherit"
  },
  labelStyle: { 
    color: "var(--neon-text)", 
    fontWeight: "700", 
    marginBottom: 4, 
    textTransform: "uppercase", 
    letterSpacing: "1px" 
  },
  itemStyle: { 
    color: "var(--neon-green)", 
    fontWeight: "500" 
  },
  cursor: { 
    stroke: "var(--neon-border)", 
    strokeWidth: 1 
  },
};


// ─── Elo ──────────────────────────────────────────────────────
function buildDerivedTrajectory(t) {
  const BASE = 1500, K = 20;
  const trajectory = [];
  let running = BASE;
  for (let cp = 1; cp <= 10; cp++) {
    const gAt   = Math.round((cp / 10) * (t.w + t.l));
    const gPrev = Math.round(((cp - 1) / 10) * (t.w + t.l));
    const seg   = gAt - gPrev;
    const wins  = Math.round(t.pct * seg);
    const noise = Math.sin(cp * 0.8 + teamSeed(t.team, cp) * 3) * 12;
    for (let g = 0; g < seg; g++) {
      const isW = g < wins;
      running += K * ((isW ? 1 : 0) - 1 / (1 + Math.pow(10, (BASE - running) / 400)));
    }
    trajectory.push({ game: gAt, elo: Math.round(running + noise) });
  }
  return trajectory;
}

// ─── Shot Quality ─────────────────────────────────────────────
function computeShotQuality(players = PLAYERS) {
  const teamMap = {};
  players.forEach(p => { if (!teamMap[p.team]) teamMap[p.team] = []; teamMap[p.team].push(p); });
  return Object.entries(teamMap).map(([team, pls]) => {
    const avg = k => pls.reduce((s, p) => s + (p[k] ?? 0), 0) / pls.length;
    const radar = [
      { factor: "Scoring",     value: +Math.min(100, (avg("pts") / 32) * 100).toFixed(1) },
      { factor: "Playmaking",  value: +Math.min(100, (avg("ast") / 11) * 100).toFixed(1) },
      { factor: "Rebounding",  value: +Math.min(100, (avg("reb") / 13) * 100).toFixed(1) },
      { factor: "Efficiency",  value: +Math.min(100, Math.max(0, ((avg("ts") - 50) / 20) * 100)).toFixed(1) },
      { factor: "Offense",     value: +Math.min(100, Math.max(0, ((avg("ortg") - 105) / 25) * 100)).toFixed(1) },
      { factor: "Defense",     value: +Math.min(100, Math.max(0, ((125 - avg("drtg")) / 25) * 100)).toFixed(1) },
    ];
    return {
      team, name: TEAM_NAMES[team] || team, color: TEAM_COLORS[team] || "#546480",
      players: pls.length, radar,
      overallScore: +(radar.reduce((s, r) => s + r.value, 0) / radar.length).toFixed(1),
      topPlayer: pls.reduce((a, b) => (a.per ?? 0) > (b.per ?? 0) ? a : b),
    };
  }).sort((a, b) => b.overallScore - a.overallScore);
}

// ─── Power Index ──────────────────────────────────────────────
function computePowerIndex(fourFactors, eloData, shotQuality) {
  return eloData.map(t => {
    const ff = fourFactors.find(f => f.team === t.team);
    const sq = shotQuality.find(s => s.team === t.team);
    const eloScore = Math.min(100, Math.max(0, ((t.elo - 1300) / 400) * 100));
    const netScore = ff ? Math.min(100, Math.max(0, ((ff.netRtg + 15) / 30) * 100)) : 50;
    const sqScore = sq ? sq.overallScore : 50;
    return {
      team: t.team, name: t.name, color: t.color, w: t.w, l: t.l, pct: t.pct,
      elo: t.elo, netRtg: ff?.netRtg ?? 0, sqScore,
      powerIndex: +((eloScore * 0.4 + netScore * 0.35 + sqScore * 0.25)).toFixed(1),
      tier: t.tier, tierColor: t.tierColor,
    };
  }).sort((a, b) => b.powerIndex - a.powerIndex);
}

// ─── Monte Carlo Playoff Sim (Worker) ───────────────────────────
// Simulation logic moved to src/workers/playoffWorker.js

// ─── Playoff Sim View ─────────────────────────────────────────
function PlayoffSimView({ data }) {
  const [confFilter, setConfFilter] = useState("all");
  const [highlight, setHighlight] = useState(null);

  const filtered = useMemo(() =>
    confFilter === "all" ? data : data.filter(t => t.conf === confFilter),
    [data, confFilter]
  );

  const maxChamp = Math.max(...filtered.map(t => t.champPct), 0.1);
  const chartData = filtered.slice(0, 16).map(t => ({
    team: t.team, color: t.color,
    champ: t.champPct, finals: t.finalsPct - t.champPct, conf: t.confPct - t.finalsPct,
  }));

  const COLS = [
    { key: "champPct", label: "🏆 Champ", tip: "Championship probability" },
    { key: "finalsPct", label: "Finals", tip: "NBA Finals appearance %" },
    { key: "confPct", label: "Conf Final", tip: "Conference Finals %" },
    { key: "r2Pct", label: "Round 2", tip: "2nd round appearance %" },
    { key: "r1Pct", label: "Playoffs", tip: "Playoff appearance %" },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show">
      {/* Header */}
      <motion.div variants={item} className="flex flex-wrap items-center justify-between gap-3 mb-6 border-l-2 border-[var(--neon-green-border)] pl-4">
        <div>
          <div className="pm-label opacity-40">Monte Carlo Playoff Simulation</div>
          <div className="pm-number text-3xl text-[var(--neon-text)] mt-1 tracking-tight">
            10,000 CYCLES · ELO SIGNAL
          </div>
        </div>
        <div className="flex gap-1 bg-[var(--neon-surface)] p-1 rounded-lg border border-[var(--neon-border)]">
          {[["all", "ALL"], ["East", "EAST"], ["West", "WEST"]].map(([id, lbl]) => (
            <button key={id} onClick={() => setConfFilter(id)}
              className={cn(
                 "px-3 py-1.5 rounded text-[9px] font-bold tracking-widest transition-all",
                confFilter === id ? "bg-[var(--neon-raised)] text-[var(--neon-green)] shadow-sm" : "text-[var(--neon-dim)] hover:text-[var(--neon-text)]"
              )}>{lbl}</button>
          ))}
        </div>
      </motion.div>

      {/* Stacked bar chart */}
      <motion.div variants={item} className="p-4 mb-4 rounded-lg border border-[var(--neon-border)] bg-[var(--neon-surface)]/30">
        <div className="pm-label opacity-40 mb-4 tracking-[2px]">CHAMPIONSHIP PROBABILITY · TOP 16</div>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="18%">
              <CartesianGrid strokeDasharray="2 2" stroke="var(--neon-border)" vertical={false} />
              <XAxis dataKey="team" tick={{ fill: "var(--neon-dim)", fontSize: 10, fontFamily: "inherit" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--neon-dim)", fontSize: 10, fontFamily: "inherit" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <RechartsTooltip {...tooltipStyle} formatter={(v, name) => [`${v.toFixed(1)}%`,
              name === "champ" ? "Championship" : name === "finals" ? "+ Finals" : "+ Conf Finals"]} />
              <Bar dataKey="conf" stackId="a" radius={[0, 0, 0, 0]}>
                {chartData.map(e => <Cell key={e.team} fill={e.color} fillOpacity={0.12} />)}
              </Bar>
              <Bar dataKey="finals" stackId="a" radius={[0, 0, 0, 0]}>
                {chartData.map(e => <Cell key={e.team} fill={e.color} fillOpacity={0.25} />)}
              </Bar>
              <Bar dataKey="champ" stackId="a" radius={[2, 2, 0, 0]}>
                {chartData.map(e => <Cell key={e.team} fill={e.color} fillOpacity={0.8} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Top 3 podium */}
      <motion.div variants={item} className="grid grid-cols-3 gap-3 mb-4">
        {filtered.slice(0, 3).map((t, i) => (
          <div key={t.team} className="border border-[var(--neon-border)] bg-[var(--neon-surface)] p-4 text-center relative overflow-hidden rounded-lg">
            <div className="absolute inset-0 opacity-10"
              style={{ background: `radial-gradient(ellipse at top, ${t.color}, transparent 70%)` }} />
            <div className="text-[9px] text-[var(--neon-muted)] font-bold mb-1 uppercase tracking-tight">#{i + 1} FAVORITE</div>
            <div className="pm-number text-2xl tracking-widest mb-1" style={{ color: t.color }}>{t.team}</div>
            <div className="pm-number text-xl text-[var(--neon-text)] tabular-nums">{t.champPct}%</div>
            <div className="text-[9px] font-bold text-[var(--neon-dim)] mt-1 uppercase tracking-widest">
              {t.conf} · {t.isPlayIn ? `PI-${t.seed}` : `SEED ${t.seed}`}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1 text-[8px] font-bold uppercase tracking-tight">
              <div className="bg-[var(--neon-overlay)] rounded border border-[var(--neon-border)] px-1.5 py-1">
                <div className="text-[var(--neon-muted)]">FINALS</div>
                <div className="text-[var(--neon-text)]">{t.finalsPct}%</div>
              </div>
              <div className="bg-[var(--neon-overlay)] rounded border border-[var(--neon-border)] px-1.5 py-1">
                <div className="text-[var(--neon-muted)]">CONF</div>
                <div className="text-[var(--neon-text)]">{t.confPct}%</div>
              </div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Visual Bracket */}
      <motion.div variants={item} className="mb-4">
        <PlayoffBracket simData={data} />
      </motion.div>

      {/* Full table */}
      <motion.div variants={item} className="border border-[var(--neon-border)] bg-[var(--neon-surface)] rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead>
            <tr className="border-b border-[var(--neon-border-md)] bg-[var(--neon-overlay)]">
              <th className="px-4 py-3 text-left pm-label opacity-40">#</th>
              <th className="px-4 py-3 text-left pm-label opacity-40">TEAM</th>
              <th className="px-4 py-3 text-left pm-label opacity-40">SEED</th>
              {COLS.map(c => (
                <th key={c.key} className="px-4 py-3 text-left pm-label opacity-40 whitespace-nowrap">
                   <Tooltip content={c.tip}>{c.label.toUpperCase()}</Tooltip>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, i) => (
              <motion.tr key={t.team}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: i * 0.01 }}
                onMouseEnter={() => setHighlight(t.team)}
                onMouseLeave={() => setHighlight(null)}
                className={cn("border-b border-[var(--neon-border)]/50 transition-colors",
                  highlight === t.team ? "bg-[var(--neon-raised)]" : "hover:bg-[var(--neon-overlay)]")}>
                <td className="px-4 py-3 pm-label opacity-30">{i + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: t.color }} />
                    <span className={cn("pm-number text-sm tracking-widest",
                      t.champPct >= 15 ? "text-[var(--neon-green)]" : t.champPct < 1 ? "text-[var(--neon-muted)]" : "text-[var(--neon-text)]")}>
                      {t.team}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border",
                    t.isPlayIn ? "text-loss bg-loss/5 border-loss/20" : "text-[var(--neon-muted)] bg-[var(--neon-overlay)] border-[var(--neon-border)]")}>
                    {t.isPlayIn ? `PI-${t.seed}` : `#${t.seed}`}
                  </span>
                </td>
                {COLS.map(c => {
                  const val = t[c.key];
                  const pct = val / (c.key === "champPct" ? maxChamp : 100);
                  return (
                    <td key={c.key} className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1 bg-[var(--neon-overlay)] overflow-hidden flex-shrink-0">
                          <motion.div className="h-full"
                            style={{ background: t.color, opacity: 0.6 }}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, pct * 100)}%` }}
                            transition={{ duration: 0.6, delay: i * 0.008 }} />
                        </div>
                        <span className={cn("pm-number text-[10px]",
                          c.key === "champPct" && val >= 15 ? "text-[var(--neon-green)]"
                            : c.key === "champPct" && val >= 5 ? "text-win"
                              : "text-[var(--neon-text)]")}>
                          {val}%
                        </span>
                      </div>
                    </td>
                  );
                })}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      <MethodologyNote>
        Seeds 1–6 per conference advance directly; seeds 7–10 play the NBA play-in tournament (7v8 for the 7 seed,
        loser-of-7v8 vs winner-of-9v10 for the 8 seed). Bracket follows the standard NBA format: 1v8, 4v5, 3v6, 2v7.
        Series win probability uses the Elo logistic formula with a {HOME_BUMP}-point home-court advantage per game.
        All {SIMS.toLocaleString()} iterations use a deterministic seeded LCG so results are consistent across page loads.
      </MethodologyNote>
    </motion.div>
  );
}

function PctBadge({ value, allValues, invert = false }) {
  if (value == null || !allValues?.length) return <span className="text-pitch-600 text-[10px]">—</span>;
  const { pct, color } = calcPercentile(value, allValues, invert);
  return (
    <span
      title={`${pct}th percentile`}
      className={`inline-flex items-center justify-center rounded text-[9px] font-bold
                  px-1.5 py-0.5 min-w-[28px] tabular-nums ${color}`}
    >
      {pct}
    </span>
  );
}

// ─── Four Factors View ────────────────────────────────────────
function FourFactorsView({ data }) {
  const [sortKey, setSortKey] = useState("netRtg");
  const [hovered, setHovered] = useState(null);

  // Build league-wide arrays for percentile calculation
  const allEfg    = useMemo(() => data.map(t => t.efg),    [data]);
  const allTov    = useMemo(() => data.map(t => t.tov),    [data]);
  const allOrb    = useMemo(() => data.map(t => t.orb),    [data]);
  const allFtRate = useMemo(() => data.map(t => t.ftRate), [data]);
  const allNetRtg = useMemo(() => data.map(t => t.netRtg), [data]);

  const sorted = useMemo(() => [...data].sort((a, b) =>
    sortKey === "tov" ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]
  ), [data, sortKey]);
  const barData = sorted.slice(0, 15).map(t => ({
    team: t.team, netRtg: t.netRtg,
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
      <div className="pm-card p-8 mb-6">
        <div className="text-[10px] font-bold text-morphin-muted mb-6 uppercase tracking-[2px]">Net rating by team · Top 15</div>
        <div style={{ height: 190 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} barCategoryGap="22%">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
              <XAxis dataKey="team" tick={{ fill: "#666666", fontSize: 10, fontWeight: "600" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#666666", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v > 0 ? "+" : ""}${v}`} />
              <ReferenceLine y={0} stroke="#e5e5e5" strokeWidth={1} />
              <RechartsTooltip {...tooltipStyle} formatter={v => [`${v > 0 ? "+" : ""}${v}`, "Net RTG"]} />
              <Bar dataKey="netRtg" radius={[4, 4, 0, 0]}>
                {barData.map(e => <Cell key={e.team} fill={e.color} fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <motion.div variants={item} className="border border-[var(--neon-border)] bg-[var(--neon-surface)] rounded-lg overflow-x-auto">
        <table className="w-full text-xs min-w-[660px]">
          <thead>
            <tr className="border-b border-[var(--neon-border-md)] bg-[var(--neon-overlay)]">
              {headers.map(h => (
                <th key={h.label} onClick={() => h.sortable && setSortKey(h.key)}
                  className={cn("px-3 py-3 text-left pm-label font-bold whitespace-nowrap opacity-40",
                    h.sortable && "cursor-pointer hover:opacity-100 transition-all select-none",
                    sortKey === h.key && "opacity-100 text-[var(--neon-green)]")}>
                  <Tooltip content={h.tip}>
                    <span className="inline-flex items-center gap-1">
                      {h.label.toUpperCase()}
                    </span>
                  </Tooltip>
                  {sortKey === h.key ? (h.key === "tov" ? " ↑" : " ↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => (
              <motion.tr key={t.team}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: i * 0.01 }}
                className={cn("border-b border-[var(--neon-border)]/50 transition-colors",
                  hovered === t.team ? "bg-[var(--neon-raised)]" : "hover:bg-[var(--neon-overlay)]")}
                onMouseEnter={() => setHovered(t.team)} onMouseLeave={() => setHovered(null)}>
                <td className="px-3 py-3 pm-label opacity-30">{i + 1}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: t.color }} />
                    <span className={cn("pm-number text-sm tracking-wider", i < 3 ? "text-[var(--neon-green)]" : "text-[var(--neon-text)]")}>{t.team}</span>
                    <span className="text-[9px] text-[var(--neon-muted)] opacity-60 ml-1">{t.w}-{t.l}</span>
                  </div>
                </td>
                <td className="px-3 py-3 pm-number text-[var(--neon-text)] opacity-80">{t.efg}%</td>
                <td className="px-3 py-3 pm-number text-[var(--neon-text)] opacity-80">{t.tov}%</td>
                <td className="px-3 py-3 pm-number text-[var(--neon-text)] opacity-80">{t.orb}%</td>
                <td className="px-3 py-3 pm-number text-[var(--neon-text)] opacity-80">{t.ftRate}</td>
                <td className={cn("px-3 py-3 pm-number text-[var(--neon-text)]",
                  t.netRtg >= 8 ? "text-[var(--neon-green)]" : t.netRtg >= 3 ? "text-win"
                    : t.netRtg >= 0 ? "text-[var(--neon-text)]" : t.netRtg >= -3 ? "text-loss" : "text-loss font-black")}>
                   {t.netRtg > 0 ? "+" : ""}{t.netRtg}
                </td>
                <td className="px-3 py-3 pm-number text-[var(--neon-muted)] opacity-50">{t.pct.toFixed(3)}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </motion.div>
      <MethodologyNote>
        eFG% weights three-pointers at 1.5× to reflect their value. TOV% is possessions lost; lower is better.
        ORB% captures second-chance opportunities. FT Rate (FTA/FGA) reflects aggression.
        Net Rating = O-RTG − D-RTG per 100 possessions.
        All values sourced live from the NBA Stats API (leaguedashteamstats, MeasureType=Four Factors).
      </MethodologyNote>
    </motion.div>
  );
}

// ─── Elo View ─────────────────────────────────────────────────
function EloView({ data }) {
  const [selectedTeams, setSelectedTeams] = useState(() => data.slice(0, 4).map(t => t.team));
  const toggle = team => setSelectedTeams(prev =>
    prev.includes(team) ? prev.filter(t => t !== team) : prev.length < 6 ? [...prev, team] : prev
  );
  const trajectoryData = useMemo(() => {
    if (!selectedTeams.length) return [];
    return Array.from({ length: 10 }, (_, i) => {
      const pt = { game: data[0]?.trajectory[i]?.game ?? (i + 1) * 7 };
      selectedTeams.forEach(team => { const td = data.find(t => t.team === team); if (td?.trajectory[i]) pt[team] = td.trajectory[i].elo; });
      return pt;
    });
  }, [data, selectedTeams]);
  return (
    <motion.div variants={container} initial="hidden" animate="show">
      <motion.div variants={item} className="pm-label mb-3 opacity-40 uppercase tracking-[2px]">Compare trajectories · Select up to 6 nodes</motion.div>
      <motion.div variants={item} className="border border-[var(--neon-border)] bg-[var(--neon-surface)]/20 p-6 rounded-lg mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="pm-label opacity-40 tracking-[2px]">SEASON ELO SIGNAL</div>
          <div className="flex gap-1.5 flex-wrap">
            {selectedTeams.map(team => {
              const td = data.find(t => t.team === team);
              return (
                <button key={team} onClick={() => toggle(team)}
                  className="px-2.5 py-1 rounded border border-[var(--neon-border-md)] bg-[var(--neon-overlay)] text-[9px] font-bold flex items-center gap-2 transition-all hover:bg-[var(--neon-raised)]"
                  style={{ color: td?.color }}>
                  {team} <span className="opacity-30">×</span>
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
                    <linearGradient key={team} id={`eg-${team}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={td?.color} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={td?.color} stopOpacity={0} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid strokeDasharray="2 2" stroke="var(--neon-border)" vertical={false} />
              <XAxis dataKey="game" tick={{ fill: "var(--neon-dim)", fontSize: 10, fontFamily: "inherit" }} axisLine={false} tickLine={false} />
              <YAxis domain={["auto", "auto"]} tick={{ fill: "var(--neon-dim)", fontSize: 10, fontFamily: "inherit" }} axisLine={false} tickLine={false} />
              <ReferenceLine y={1500} stroke="var(--neon-border-md)" strokeDasharray="4 2" strokeWidth={1} />
              <RechartsTooltip {...tooltipStyle} />
              {selectedTeams.map(team => {
                const td = data.find(t => t.team === team);
                return <Area key={team} type="monotone" dataKey={team}
                  stroke={td?.color || "#546480"} fill={`url(#eg-${team})`}
                  strokeWidth={2} dot={false} activeDot={{ r: 4, fill: td?.color }} name={team} />;
              })}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {data.map((t, i) => (
          <motion.div key={t.team} variants={item} onClick={() => toggle(t.team)}
            className={cn("p-4 rounded-lg border transition-all cursor-pointer",
              selectedTeams.includes(t.team) ? "border-[var(--neon-green-border)] bg-[var(--neon-green-faint)]" : "border-[var(--neon-border)] bg-[var(--neon-surface)]/40 hover:border-[var(--neon-border-md)]")}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[var(--neon-muted)] opacity-40">#{i + 1}</span>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: t.color }} />
              </div>
              <span className={cn("text-[9px] font-bold tracking-widest", t.tierColor)}>{t.tier.toUpperCase()}</span>
            </div>
            <div className="pm-number text-xl tracking-tight text-[var(--neon-text)] mb-1 leading-none">{t.team}</div>
            <div className="pm-number text-2xl text-[var(--neon-text)] tabular-nums">{t.elo}</div>
            <div className="text-[9px] font-bold text-[var(--neon-muted)] uppercase tracking-widest opacity-40 mt-1">{t.w}-{t.l}</div>
            <div className="flex items-end gap-px h-5 mt-4 opacity-30">
              {t.trajectory.map((tp, j) => (
                <div key={j} className="flex-1 rounded-t-sm"
                  style={{ height: `${Math.max(2, ((tp.elo - 1300) / 400) * 20)}px`, background: tp.elo >= 1500 ? t.color : "var(--neon-dim)" }} />
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

// ─── Shot Quality View ────────────────────────────────────────
function ShotQualityView({ data, isUsingFallback }) {
  const [selected, setSelected] = useState(0);
  const [compareIdx, setCompareIdx] = useState(null);
  const primary = data[selected];
  const comparison = compareIdx !== null ? data[compareIdx] : null;
  return (
    <motion.div variants={container} initial="hidden" animate="show">
      <motion.div variants={item} className="pm-label mb-3 flex items-center gap-2 opacity-40 uppercase tracking-[2px]">
        <span>Advanced Roster Capability Profiles</span>
        {isUsingFallback && (
          <span className="px-1.5 h-4 bg-loss/10 text-loss border border-loss/20 text-[9px] flex items-center rounded font-bold uppercase tracking-tight">
            CACHED SIGNAL
          </span>
        )}
      </motion.div>
      <motion.div variants={item} className="flex flex-wrap gap-1 mb-4">
        {data.map((t, i) => (
          <button key={t.team}
            onClick={() => { if (selected === i) return; if (compareIdx === i) { setCompareIdx(null); return; } setCompareIdx(selected); setSelected(i); }}
            className={cn("px-2.5 py-1 rounded border text-[10px] font-bold tracking-widest transition-all",
              selected === i ? "border-[var(--neon-green-border)] text-[var(--neon-green)] bg-[var(--neon-green-faint)]"
                : compareIdx === i ? "border-draw/30 text-draw bg-draw/10"
                  : "border-[var(--neon-border)] text-[var(--neon-dim)] bg-[var(--neon-surface)] hover:border-[var(--neon-border-md)] hover:text-[var(--neon-text)]")}>
            {t.team}
          </button>
        ))}
      </motion.div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={item} className="p-6 rounded-lg border border-[var(--neon-border)] bg-[var(--neon-surface)]/20 shadow-sm">
          <div className="pm-label mb-6 border-l-2 border-[var(--neon-green-border)] pl-3">
            <span className="pm-number" style={{ color: primary.color }}>{primary.team.toUpperCase()}</span>
            {comparison && (<><span className="opacity-20 mx-3">VS</span><span className="pm-number" style={{ color: comparison.color }}>{comparison.team.toUpperCase()}</span></>)}
          </div>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={primary.radar.map((r, i) => ({ ...r, compare: comparison?.radar[i]?.value ?? 0 }))}>
                <PolarGrid stroke="var(--neon-border)" />
                <PolarAngleAxis dataKey="factor" tick={{ fill: "var(--neon-dim)", fontSize: 10, fontFamily: "inherit" }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name={primary.team} dataKey="value" stroke={primary.color} fill={primary.color} fillOpacity={0.12} strokeWidth={2} />
                {comparison && <Radar name={comparison.team} dataKey="compare" stroke={comparison.color} fill={comparison.color} fillOpacity={0.05} strokeWidth={2} strokeDasharray="4 2" />}
                <RechartsTooltip {...tooltipStyle} formatter={v => [`${Number(v).toFixed(0)}`, ""]} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
        <motion.div variants={item} className="p-6 rounded-lg border border-[var(--neon-border)] bg-[var(--neon-surface)]/20 shadow-sm">
          <div className="pm-label mb-6 opacity-40 uppercase tracking-[2px]">Factor Breakdown</div>
          <div className="space-y-4">
            {primary.radar.map((r, i) => {
              const cmpVal = comparison?.radar[i]?.value;
              return (
                <div key={r.factor}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-[var(--neon-dim)] uppercase tracking-wider">{r.factor}</span>
                    <div className="flex items-center gap-3">
                      <span className="pm-number text-xs tabular-nums" style={{ color: primary.color }}>{r.value.toFixed(0)}</span>
                      {cmpVal !== undefined && <span className="pm-number text-xs tabular-nums" style={{ color: comparison.color }}>{cmpVal.toFixed(0)}</span>}
                    </div>
                  </div>
                  <div className="h-1 bg-[var(--neon-overlay)] overflow-hidden relative">
                    <motion.div className="h-full absolute top-0 left-0" style={{ background: primary.color }}
                      initial={{ width: 0 }} animate={{ width: `${r.value}%` }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: i * 0.07 }} />
                    {cmpVal !== undefined && (
                      <motion.div className="h-full absolute top-0 left-0 opacity-20" style={{ background: comparison.color }}
                        initial={{ width: 0 }} animate={{ width: `${cmpVal}%` }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: i * 0.07 + 0.1 }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-8 border-t border-[var(--neon-border)] pt-6">
            <div className="pm-label mb-4 opacity-40 flex items-center gap-2 uppercase tracking-[2px]">
              <Zap size={12} /> Unit Highlight
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-sm bg-[var(--neon-overlay)] border border-[var(--neon-border-md)] flex items-center justify-center text-[10px] font-bold"
                style={{ color: primary.color }}>
                {primary.topPlayer.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
              </div>
              <div>
                <div className="pm-number text-base text-[var(--neon-text)] leading-none">{primary.topPlayer.name}</div>
                <div className="pm-label opacity-40 mt-1.5 text-[9px]">{primary.topPlayer.pts} PPG · {primary.topPlayer.ast} APG · EFF {primary.topPlayer.per}</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
      <MethodologyNote>
        Profiles aggregate all rostered players per team with ≥10 games played.
        Scoring scales to 32 PPG, Playmaking to 11 APG, Rebounding to 13 RPG,
        Efficiency uses TS% above 50%, Offense uses O-RTG above 105, Defense uses D-RTG below 125.
        Stats sourced live from the NBA Stats API (leaguedashplayerstats base + MeasureType=Advanced).
        Efficiency rating uses PIE (Player Impact Estimate). Positions from commonallplayers.
        Click two teams to overlay their polygons.
      </MethodologyNote>
    </motion.div>
  );
}

// ─── Power Index View ─────────────────────────────────────────
function PowerIndexView({ data }) {
  const [hovered, setHovered] = useState(null);
  const maxPower = Math.max(...data.map(d => d.powerIndex));
  return (
    <motion.div variants={container} initial="hidden" animate="show">
      <motion.div variants={item} className="pm-label mb-3 border-l-2 border-[var(--neon-green-border)] pl-4">
        <div className="opacity-40 uppercase tracking-[2px] text-[10px]">Composite Power Index</div>
        <div className="pm-number text-xl text-[var(--neon-text)]">40% ELO + 35% NET + 25% SHOT QUALITY</div>
      </motion.div>
      <motion.div variants={item} className="grid grid-cols-3 gap-3 mb-6">
        {data.slice(0, 3).map((t, i) => (
          <div key={t.team} className="border border-[var(--neon-border)] bg-[var(--neon-surface)] p-6 text-center relative overflow-hidden rounded-lg">
            <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(ellipse at center, ${t.color}, transparent 70%)` }} />
            <div className="text-[10px] text-[var(--neon-muted)] font-bold mb-2 uppercase tracking-tight opacity-40">RANK #{i + 1}</div>
            <div className="pm-number text-2xl tracking-widest mb-1" style={{ color: t.color }}>{t.team}</div>
            <div className="pm-number text-3xl text-[var(--neon-text)] tabular-nums">{t.powerIndex}</div>
            <div className={cn("text-[10px] font-bold uppercase tracking-widest mt-2", t.tierColor)}>{t.tier}</div>
            <div className="text-[10px] text-[var(--neon-muted)] opacity-30 mt-1">{t.w}-{t.l}</div>
          </div>
        ))}
      </motion.div>
      <motion.div variants={item} className="border border-[var(--neon-border)] bg-[var(--neon-surface)] rounded-lg overflow-x-auto">
        <table className="w-full text-xs min-w-[580px]">
          <thead>
            <tr className="border-b border-[var(--neon-border-md)] bg-[var(--neon-overlay)]">
              {["#", "TEAM", "INDEX", "RECORD", "NET RTG", "ELO", "TIER"].map(h => (
                <th key={h} className="px-4 py-3 text-left pm-label font-bold whitespace-nowrap opacity-40">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((t, i) => (
              <motion.tr key={t.team}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}
                className={cn("border-b border-[var(--neon-border)]/50 transition-colors",
                  hovered === t.team ? "bg-[var(--neon-raised)]" : "hover:bg-[var(--neon-overlay)]")}
                onMouseEnter={() => setHovered(t.team)} onMouseLeave={() => setHovered(null)}>
                <td className="px-4 py-3 pm-label opacity-30">{i + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: t.color }} />
                    <span className={cn("pm-number text-sm tracking-widest", i < 6 ? "text-[var(--neon-text)]" : "text-[var(--neon-muted)]")}>{t.team}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-1 w-16 bg-[var(--neon-overlay)] overflow-hidden">
                      <div className="h-full transition-all" style={{ width: `${(t.powerIndex / maxPower) * 100}%`, background: t.color, opacity: 0.6 }} />
                    </div>
                    <span className="pm-number text-[var(--neon-text)] opacity-90">{t.powerIndex}</span>
                  </div>
                </td>
                <td className="px-4 py-3 pm-number text-[var(--neon-muted)] opacity-50">{t.w}-{t.l}</td>
                <td className={cn("px-4 py-3 pm-number", t.netRtg >= 0 ? "text-win" : "text-loss")}>
                  {t.netRtg > 0 ? "+" : ""}{t.netRtg}
                </td>
                <td className="px-4 py-3 pm-number text-[var(--neon-muted)] opacity-50">{t.elo}</td>
                <td className={cn("px-4 py-3 text-[10px] font-bold tracking-widest", t.tierColor)}>{t.tier.toUpperCase()}</td>
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

// ─── Methodology Note ─────────────────────────────────────────
function MethodologyNote({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div variants={item} className="mt-4">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded border border-[var(--neon-border)] bg-[var(--neon-surface)]/40 text-[9px] font-bold text-[var(--neon-dim)] hover:text-[var(--neon-text)] transition-all uppercase tracking-widest">
        <Info size={10} /> {open ? "Hide Protocol" : "View Protocol"}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, scaleY: 0.95 }} animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0.95 }} className="origin-top">
            <div className="mt-3 p-5 rounded border border-[var(--neon-border-md)] bg-[var(--neon-overlay)] text-[10px] text-[var(--neon-muted)] leading-relaxed font-semibold">
              <div className="mb-2 text-[var(--neon-text)] opacity-80 underline underline-offset-4 decoration-[var(--neon-green-border)]">TELEMETRY_LOG_v2.0</div>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────
const TABS = [
  { id: "power", label: "Power Index", icon: Award },
  { id: "factors", label: "Four Factors", icon: BarChart2 },
  { id: "elo", label: "Elo Ratings", icon: TrendingUp },
  { id: "quality", label: "Shot Quality", icon: Zap },
  { id: "playoff", label: "Playoff Sim", icon: Trophy },
];

// ─── Main Analytics Component ─────────────────────────────────
export default function Analytics() {
  const [searchParams] = useSearchParams();
  const VALID_TABS = ["power", "factors", "elo", "quality", "playoff"];
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get("tab");
    if (VALID_TABS.includes(tab)) return tab;
    return lsGet("analytics_tab") || "power";
  });

  const handleTab = (t) => {
    setActiveTab(t);
    lsSet("analytics_tab", t);
  };
  const { data: standingsData, isLoading, isError, isFetching, refetch, dataUpdatedAt } = useStandings();
  const { data: nbaTeamStats } = useFourFactorsStats();
  const { data: enrichedPlayers } = useEnrichedPlayerStats();
  const { data: eloApiData } = useEloData();

  const fourFactors = useMemo(() => {
    if (!nbaTeamStats) return [];
    const rows = reshapeNBAStats(nbaTeamStats, "LeagueDashTeamStats");
    
    return rows.map(r => ({
      team: r.TEAM_ABBREVIATION,
      name: r.TEAM_NAME,
      w: r.W, l: r.L,
      pct: r.W_PCT,
      efg: +(r.EFG_PCT * 100).toFixed(1),
      tov: +(r.TM_TOV_PCT * 100).toFixed(1),
      orb: +(r.OREB_PCT * 100).toFixed(1),
      ftRate: +r.FTA_RATE.toFixed(3),
      netRtg: +r.NET_RATING.toFixed(1),
      ortg: +r.OFF_RATING.toFixed(1),
      drtg: +r.DEF_RATING.toFixed(1),
      color: TEAM_COLORS[r.TEAM_ABBREVIATION] || "#546480",
    })).sort((a, b) => b.netRtg - a.netRtg);
  }, [nbaTeamStats]);

  const realPlayers = enrichedPlayers ?? PLAYERS;
  const isUsingFallback = !enrichedPlayers;

  const eloData = useMemo(() => {
    if (!standingsData) return [];

    const allTeams = [
      ...(standingsData.east || EAST_STANDINGS),
      ...(standingsData.west || WEST_STANDINGS),
    ];

    return allTeams.map(t => {
      // Use real Elo from API if available, fall back to derived
      const apiEntry = eloApiData?.teams?.find(e => e.team === t.team);
      const elo = apiEntry
        ? apiEntry.elo
        : Math.round(1500 + (t.pct - 0.5) * 600 + teamSeed(t.team, 6) * 20);

      // Use real trajectory if available, fall back to derived
      const trajectory = apiEntry?.trajectory?.length
        ? apiEntry.trajectory
        : buildDerivedTrajectory(t); // extract existing trajectory logic into helper

      const tier = elo >= 1640 ? ["Championship", "text-tier-elite"]
        : elo >= 1560 ? ["Contender",     "text-tier-good"]
        : elo >= 1480 ? ["Playoff",        "text-tier-avg"]
        : elo >= 1400 ? ["Lottery",        "text-tier-poor"]
        :               ["Rebuild",         "text-tier-bad"];

      return {
        team: t.team, name: TEAM_NAMES[t.team] || t.team,
        elo, pct: t.pct, w: t.w, l: t.l,
        tier: tier[0], tierColor: tier[1], trajectory,
        color: TEAM_COLORS[t.team] || "#546480",
        fromApi: !!apiEntry,
        // Simulation data included:
        isPlayIn:  false, // We can compute this based on seed later if needed, or get from UI
        playInPct: apiEntry?.playInPct ?? 0,
        r1Pct:     apiEntry?.r1Pct ?? 0,
        r2Pct:     apiEntry?.r2Pct ?? 0,
        confPct:   apiEntry?.confPct ?? 0,
        finalsPct: apiEntry?.finalsPct ?? 0,
        champPct:  apiEntry?.champPct ?? 0,
      };
    }).sort((a, b) => b.elo - a.elo);
  }, [standingsData, eloApiData]);
  const shotData = useMemo(() => computeShotQuality(realPlayers), [realPlayers]);
  const powerData = useMemo(() =>
    fourFactors.length && eloData.length && shotData.length
      ? computePowerIndex(fourFactors, eloData, shotData) : [],
    [fourFactors, eloData, shotData]
  );
  // Now setPlayoffData can just be derived from eloData since we appended it directly!
  // To avoid breaking PlayoffSimView completely, we sort by champPct and add conf/seed
  const playoffDataVal = useMemo(() => {
    if (!eloData.length) return [];
    const eastSet = new Set((standingsData?.east || EAST_STANDINGS).map(t => t.team));
    
    // Sort conferences by pct to determine seeds
    const all = eloData.map(t => ({ ...t, conf: eastSet.has(t.team) ? "East" : "West" }));
    const east = all.filter(t => t.conf === "East").sort((a, b) => b.pct - a.pct).slice(0, 10).map((t, i) => ({ ...t, seed: i + 1, isPlayIn: i >= 6 }));
    const west = all.filter(t => t.conf === "West").sort((a, b) => b.pct - a.pct).slice(0, 10).map((t, i) => ({ ...t, seed: i + 1, isPlayIn: i >= 6 }));
    
    return [...east, ...west].sort((a, b) => b.champPct - a.champPct);
  }, [eloData, standingsData]);

  const needsStandings = ["factors", "elo", "power", "playoff"].includes(activeTab);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
      <Tabs value={activeTab} onValueChange={handleTab} className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--neon-surface)] p-2 rounded-lg border border-[var(--neon-border)]">
          <TabsList className="bg-transparent border-0 p-0 h-auto gap-1">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <TabsTrigger key={t.id} value={t.id}
                  className="flex items-center gap-2 px-3 py-2 rounded text-[10px] font-mono font-bold tracking-widest transition-all data-[state=active]:bg-[var(--neon-raised)] data-[state=active]:text-[var(--neon-green)] data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-[var(--neon-border-md)]">
                  <Icon size={12} />{t.label.toUpperCase()}
                </TabsTrigger>
              );
            })}
          </TabsList>
          <div className="px-3 border-l border-[var(--neon-border-md)] ml-auto">
            <FreshnessTag isFetching={isFetching} dataUpdatedAt={dataUpdatedAt} />
          </div>
        </div>

        {isError && needsStandings ? (
          <ErrorState message="Couldn't load standings for analytics." onRetry={refetch} />
        ) : isLoading && needsStandings ? (
          <div className="pm-card p-4"><RowSkeleton rows={15} /></div>
        ) : (
          <>
            <TabsContent value="power" className="mt-0">
              <PowerIndexView data={powerData} />
            </TabsContent>
            <TabsContent value="factors" className="mt-0">
              <FourFactorsView data={fourFactors} />
            </TabsContent>
            <TabsContent value="elo" className="mt-0">
              <EloView data={eloData} />
            </TabsContent>
            <TabsContent value="quality" className="mt-0">
              <ShotQualityView data={shotData} isUsingFallback={isUsingFallback} />
            </TabsContent>
            <TabsContent value="playoff" className="mt-0">
              <PlayoffSimView data={playoffDataVal} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </motion.div>
  );
}