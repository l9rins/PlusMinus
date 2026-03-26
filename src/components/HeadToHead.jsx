// ─── HeadToHead.jsx ───────────────────────────────────────────────
// Route: /compare (add to App.jsx + TopNav)
// Lets the user pick two teams and see a full side-by-side breakdown:
//   • Record, Elo, streak, conference seed
//   • Win probability for a hypothetical matchup (home/away selector)
//   • Stat duel bars (NetRtg, eFG%, TOV%, ORB%, FT Rate)
//   • Last 5 form comparison
//   • Schedule strength proxy (opponent .pct average)
//   • Star player clash
//   • H2H matchup win probability from Elo

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import { ArrowLeftRight, TrendingUp, TrendingDown, Minus, ChevronDown, Zap, Shield, Target } from "lucide-react";
import { TEAM_COLORS, TEAM_NAMES, PLAYERS, EAST_STANDINGS, WEST_STANDINGS } from "../data";
import { useStandings, useLeagueTeamStats, useEnrichedPlayerStats } from "../api";
import { reshapeNBAStats, signed, netRatingTier } from "../utils";
import { ErrorState, RowSkeleton } from "./ui";

// ── Constants ─────────────────────────────────────────────────────
const ALL_TEAMS = Object.keys(TEAM_NAMES).sort();
const HOME_ADVANTAGE_ELO = 35; // ~3.5% win probability bump

// ── Elo from standings (same formula as Analytics + TeamDetail) ───
function buildElo(t) {
  if (!t) return 1500;
  const BASE = 1500, K = 20;
  let running = BASE;
  const total = t.w + t.l;
  for (let g = 0; g < total; g++) {
    const isW = g < Math.round(t.pct * total);
    running += K * ((isW ? 1 : 0) - 1 / (1 + Math.pow(10, (BASE - running) / 400)));
  }
  return Math.round(running);
}

// ── Elo win probability ────────────────────────────────────────────
function eloWinP(eloA, eloB, homeAdv = 0) {
  return +(100 / (1 + Math.pow(10, (eloB - eloA - homeAdv) / 400))).toFixed(1);
}

// ── Team selector dropdown ────────────────────────────────────────
function TeamPicker({ value, onChange, exclude, label, side }) {
  const [open, setOpen] = useState(false);
  const color = value ? (TEAM_COLORS[value] || "#546480") : "#546480";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all w-full"
        style={{
          borderColor: value ? `${color}50` : "var(--pitch-600, #2e3a50)",
          background: value ? `${color}10` : "var(--pitch-800, #161b28)",
          boxShadow: value ? `0 0 20px ${color}15` : "none",
        }}
      >
        {value ? (
          <>
            <span className="text-3xl font-bold tracking-tight" style={{ color }}>{value}</span>
            <div className="text-left flex-1">
              <div className="text-sm font-bold text-pitch-100">{TEAM_NAMES[value]}</div>
              <div className="text-[10px] text-pitch-500 uppercase tracking-widest">{label}</div>
            </div>
          </>
        ) : (
          <div className="flex-1 text-left">
            <div className="text-sm text-pitch-500">Select {label} team</div>
          </div>
        )}
        <ChevronDown
          size={14}
          strokeWidth={1.8}
          className={`text-pitch-500 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.13 }}
            className="absolute top-full mt-1.5 z-50 w-full rounded-xl border border-pitch-600 bg-pitch-800 overflow-hidden"
            style={{ boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}
          >
            <div className="max-h-64 overflow-y-auto py-1">
              {ALL_TEAMS.filter(t => t !== exclude).map(abbr => {
                const c = TEAM_COLORS[abbr] || "#546480";
                return (
                  <button
                    key={abbr}
                    onClick={() => { onChange(abbr); setOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-pitch-750 transition-colors text-left"
                  >
                    <span className="text-lg font-bold tracking-tight w-10 flex-shrink-0" style={{ color: c }}>{abbr}</span>
                    <span className="text-sm text-pitch-300">{TEAM_NAMES[abbr]}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Duel bar — two-sided stat comparison ─────────────────────────
function DuelBar({ label, aVal, bVal, aColor, bColor, invert = false, format = v => v }) {
  if (aVal == null || bVal == null) return null;
  const aWins = invert ? aVal < bVal : aVal > bVal;
  const bWins = invert ? bVal < aVal : bVal > aVal;
  const maxVal = Math.max(Math.abs(aVal), Math.abs(bVal), 1);

  // Normalize to 0–100 for bar width
  const normalize = v => {
    if (invert) return Math.min(100, Math.max(0, ((maxVal - v) / (maxVal * 0.4 + 0.001)) * 100));
    return Math.min(100, Math.max(0, (v / maxVal) * 60 + 40));
  };

  const aPct = normalize(aVal);
  const bPct = normalize(bVal);

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span
          className={`text-sm tabular-nums font-bold ${aWins ? "" : "text-pitch-400"}`}
          style={{ color: aWins ? aColor : undefined }}
        >
          {format(aVal)}
        </span>
        <span className="text-[10px] text-pitch-500 uppercase tracking-[1.5px] px-2 font-semibold">{label}</span>
        <span
          className={`text-sm tabular-nums font-bold ${bWins ? "" : "text-pitch-400"}`}
          style={{ color: bWins ? bColor : undefined }}
        >
          {format(bVal)}
        </span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
        {/* Left bar (team A) — right-aligned */}
        <div className="flex-1 bg-pitch-700 rounded-l-full overflow-hidden flex justify-end">
          <motion.div
            className="h-full rounded-l-full"
            style={{ background: aColor, opacity: aWins ? 0.9 : 0.4 }}
            initial={{ width: 0 }}
            animate={{ width: `${aPct}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
        {/* Right bar (team B) */}
        <div className="flex-1 bg-pitch-700 rounded-r-full overflow-hidden">
          <motion.div
            className="h-full rounded-r-full"
            style={{ background: bColor, opacity: bWins ? 0.9 : 0.4 }}
            initial={{ width: 0 }}
            animate={{ width: `${bPct}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Win probability arc ────────────────────────────────────────────
function WinProbArc({ teamA, teamB, probA, aColor, bColor }) {
  const angle = (probA / 100) * 180; // 0–180 degrees
  const r = 72;
  const cx = 130;
  const cy = 90;

  // Arc path for the A segment
  const rad = (deg) => (deg * Math.PI) / 180;
  const arcX = (deg) => cx + r * Math.cos(Math.PI - rad(deg));
  const arcY = (deg) => cy - r * Math.sin(Math.PI - rad(deg));

  return (
    <svg viewBox="0 0 260 100" className="w-full max-w-[280px] mx-auto overflow-visible">
      {/* Background track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#1e2a38" strokeWidth="10" strokeLinecap="round"
      />
      {/* Team A segment */}
      {probA > 0 && (
        <motion.path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${angle > 90 ? 1 : 0} 1 ${arcX(angle)} ${arcY(angle)}`}
          fill="none" stroke={aColor} strokeWidth="10" strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          style={{ opacity: 0.85 }}
        />
      )}
      {/* Team B segment */}
      {probA < 100 && (
        <motion.path
          d={`M ${arcX(angle)} ${arcY(angle)} A ${r} ${r} 0 ${angle < 90 ? 1 : 0} 1 ${cx + r} ${cy}`}
          fill="none" stroke={bColor} strokeWidth="10" strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          style={{ opacity: 0.85 }}
        />
      )}
      {/* Center labels */}
      <text x={cx - r - 2} y={cy + 18} textAnchor="end" fontSize="11" fill={aColor} fontWeight="800" letterSpacing="0.5">
        {teamA}
      </text>
      <text x={cx + r + 2} y={cy + 18} textAnchor="start" fontSize="11" fill={bColor} fontWeight="800" letterSpacing="0.5">
        {teamB}
      </text>
      {/* Center probability */}
      <text x={cx} y={cy - 10} textAnchor="middle" fontSize="26" fontWeight="700" fill="currentColor">
        {probA}%
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="10" fill="#546480" fontWeight="700" letterSpacing="2">
        WIN PROB
      </text>
    </svg>
  );
}

// ── Form strip (last 5) ───────────────────────────────────────────
function FormRow({ results, align = "left" }) {
  if (!results || !results.length) return <span className="text-pitch-600 text-[10px]">—</span>;
  return (
    <div className={`flex gap-1 ${align === "right" ? "justify-end" : ""}`}>
      {results.map((r, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
          className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold
            ${r === "W" ? "bg-win/15 text-win border border-win/30"
              : "bg-loss/15 text-loss border border-loss/30"}`}
        >
          {r}
        </motion.span>
      ))}
    </div>
  );
}

// ── Radar chart data builder ──────────────────────────────────────
function buildRadar(statsMap, abbr) {
  const s = statsMap?.[abbr];
  if (!s) return null;
  return [
    { factor: "eFG%",  A: s.efg ?? 50 },
    { factor: "NetRtg", A: Math.min(100, Math.max(0, ((s.netRtg ?? 0) + 15) / 30 * 100)) },
    { factor: "ORB%",  A: s.orb ?? 50 },
    { factor: "FTr",   A: s.ftr ?? 50 },
    { factor: "Pace",  A: Math.min(100, Math.max(0, ((s.pace ?? 100) - 96) / 10 * 100)) },
    { factor: "TOV%",  A: Math.max(0, 100 - (s.tov ?? 14)) },
  ];
}

// ── Main component ─────────────────────────────────────────────────
export default function HeadToHead() {
  const [teamA, setTeamA] = useState("BOS");
  const [teamB, setTeamB] = useState("OKC");
  const [homeTeam, setHomeTeam] = useState("A"); // which team is "home"

  const { data: standingsData, isLoading: standLoading } = useStandings();
  const { data: teamStatsRaw, isLoading: statsLoading } = useLeagueTeamStats();
  const { data: allPlayers } = useEnrichedPlayerStats();

  // ── Flatten standings into map ────────────────────────────────
  const standingsMap = useMemo(() => {
    const east = standingsData?.east || EAST_STANDINGS;
    const west = standingsData?.west || WEST_STANDINGS;
    const all = [...east, ...west];
    return Object.fromEntries(all.map(t => [t.team, t]));
  }, [standingsData]);

  // ── Conference + seed for a team ──────────────────────────────
  const confSeed = (abbr) => {
    const east = standingsData?.east || EAST_STANDINGS;
    const west = standingsData?.west || WEST_STANDINGS;
    const ei = east.findIndex(t => t.team === abbr);
    if (ei >= 0) return { conf: "East", seed: ei + 1 };
    const wi = west.findIndex(t => t.team === abbr);
    if (wi >= 0) return { conf: "West", seed: wi + 1 };
    return null;
  };

  // ── Team stats map (NBA Stats API) ────────────────────────────
  const teamStatsMap = useMemo(() => {
    if (!teamStatsRaw) return {};
    const rows = reshapeNBAStats(teamStatsRaw, "LeagueDashTeamStats");
    return Object.fromEntries(rows.map(r => [r.TEAM_ABBREVIATION, {
      efg:    r.EFG_PCT   != null ? +(r.EFG_PCT   * 100).toFixed(1) : null,
      tov:    r.TM_TOV_PCT != null ? +(r.TM_TOV_PCT * 100).toFixed(1) : null,
      orb:    r.OREB_PCT  != null ? +(r.OREB_PCT   * 100).toFixed(1) : null,
      ftr:    r.FTA_RATE  != null ? +(r.FTA_RATE   * 100).toFixed(1) : null,
      offRtg: r.OFF_RATING != null ? +r.OFF_RATING.toFixed(1) : null,
      defRtg: r.DEF_RATING != null ? +r.DEF_RATING.toFixed(1) : null,
      netRtg: r.NET_RATING != null ? +r.NET_RATING.toFixed(1) : null,
      pace:   r.PACE      != null ? +r.PACE.toFixed(1) : null,
    }]));
  }, [teamStatsRaw]);

  const tA = standingsMap[teamA];
  const tB = standingsMap[teamB];
  const eloA = useMemo(() => buildElo(tA), [tA]);
  const eloB = useMemo(() => buildElo(tB), [tB]);
  const homeAdv = homeTeam === "A" ? HOME_ADVANTAGE_ELO : homeTeam === "B" ? -HOME_ADVANTAGE_ELO : 0;
  const probA = eloWinP(eloA, eloB, homeAdv);
  const probB = +(100 - probA).toFixed(1);

  const colorA = TEAM_COLORS[teamA] || "#546480";
  const colorB = TEAM_COLORS[teamB] || "#f59e0b";

  const sA = teamStatsMap[teamA];
  const sB = teamStatsMap[teamB];

  // ── Star players ──────────────────────────────────────────────
  const starA = useMemo(() => {
    const pool = (allPlayers || PLAYERS).filter(p => p.team === teamA);
    if (!pool.length) return null;
    return pool.reduce((a, b) => ((a.per ?? 0) >= (b.per ?? 0) ? a : b), pool[0]);
  }, [allPlayers, teamA]);

  const starB = useMemo(() => {
    const pool = (allPlayers || PLAYERS).filter(p => p.team === teamB);
    if (!pool.length) return null;
    return pool.reduce((a, b) => ((a.per ?? 0) >= (b.per ?? 0) ? a : b), pool[0]);
  }, [allPlayers, teamB]);

  // ── Last 5 form from standings streak proxy ───────────────────
  const formA = useMemo(() => {
    if (!tA) return [];
    const s = tA.streak;
    const res = s?.startsWith("W") ? "W" : "L";
    const cnt = parseInt(s?.slice(1) || "0");
    return Array(Math.min(cnt, 5)).fill(res);
  }, [tA]);

  const formB = useMemo(() => {
    if (!tB) return [];
    const s = tB.streak;
    const res = s?.startsWith("W") ? "W" : "L";
    const cnt = parseInt(s?.slice(1) || "0");
    return Array(Math.min(cnt, 5)).fill(res);
  }, [tB]);

  // ── Radar data (merge both teams on same axes) ─────────────────
  const radarData = useMemo(() => {
    const factors = ["eFG%", "NetRtg", "ORB%", "FTr", "Pace", "TOV%"];
    const rA = buildRadar(teamStatsMap, teamA);
    const rB = buildRadar(teamStatsMap, teamB);
    if (!rA || !rB) return null;
    return factors.map((f, i) => ({ factor: f, A: rA[i].A, B: rB[i].A }));
  }, [teamStatsMap, teamA, teamB]);

  const isLoading = standLoading || statsLoading;

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } } };
  const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] } } };

  const csA = confSeed(teamA);
  const csB = confSeed(teamB);

  return (
    <motion.div variants={container} initial="hidden" animate="show" exit={{ opacity: 0, y: -4 }}>

      {/* ── Team selectors ────────────────────────────────── */}
      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 mb-4 items-center">
        <TeamPicker value={teamA} onChange={setTeamA} exclude={teamB} label="Team A" side="left" />

        {/* Swap + home selector */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => { setTeamA(teamB); setTeamB(teamA); setHomeTeam(h => h === "A" ? "B" : h === "B" ? "A" : "N"); }}
            className="w-9 h-9 rounded-full bg-pitch-750 border border-pitch-600 flex items-center justify-center hover:bg-pitch-700 hover:border-pitch-500 transition-all"
            title="Swap teams"
          >
            <ArrowLeftRight size={13} strokeWidth={1.8} className="text-pitch-400" />
          </button>
          <div className="text-[9px] text-pitch-600 uppercase tracking-[1.5px]">vs</div>
        </div>

        <TeamPicker value={teamB} onChange={setTeamB} exclude={teamA} label="Team B" side="right" />
      </motion.div>

      {/* ── Home court selector ───────────────────────────── */}
      <motion.div variants={item} className="flex items-center justify-center gap-3 mb-5">
        <div className="pm-label">Home court</div>
        <div className="flex gap-1.5">
          {[
            { id: "A", label: teamA, color: colorA },
            { id: "N", label: "Neutral", color: "#546480" },
            { id: "B", label: teamB, color: colorB },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setHomeTeam(opt.id)}
              className="px-3 py-1 rounded-md text-[11px] font-medium transition-all border"
              style={homeTeam === opt.id ? {
                background: `${opt.color}20`,
                borderColor: `${opt.color}50`,
                color: opt.color,
              } : {
                background: "transparent",
                borderColor: "#2e3a50",
                color: "#546480",
              }}
            >
              {opt.id === "N" ? "Neutral" : (
                <span className="font-bold tracking-tight">{opt.label}</span>
              )}
            </button>
          ))}
        </div>
      </motion.div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="pm-card p-4 h-32 pm-skeleton" style={{ animationDelay: `${i * 0.08}s` }} />
          ))}
        </div>
      ) : (
        <>
          {/* ── Win probability + team headers ───────────── */}
          <motion.div variants={item} className="pm-card p-5 mb-3">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
              {/* Team A header */}
              <div className="text-left">
                <div className="text-4xl sm:text-5xl font-bold tracking-tight" style={{ color: colorA }}>
                  {teamA}
                </div>
                <div className="text-[11px] text-pitch-400 mt-1">{TEAM_NAMES[teamA]}</div>
                {csA && (
                  <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border"
                    style={{ borderColor: `${colorA}40`, color: colorA, background: `${colorA}12` }}>
                    {csA.conf} #{csA.seed}
                  </div>
                )}
                {tA && (
                  <div className="mt-2">
                    <div className="text-lg text-pitch-100 tabular-nums font-bold">{tA.w}-{tA.l}</div>
                    <div className="text-[10px] text-pitch-500">{(tA.pct * 100).toFixed(1)}% WR</div>
                  </div>
                )}
              </div>

              {/* Arc */}
              <div className="flex flex-col items-center min-w-[160px]">
                <WinProbArc
                  teamA={teamA} teamB={teamB}
                  probA={probA}
                  aColor={colorA} bColor={colorB}
                />
                <div className="flex items-center gap-2 mt-1">
                  {homeTeam !== "N" && (
                    <span className="text-[9px] text-pitch-600 uppercase tracking-wider">
                      {homeTeam === "A" ? teamA : teamB} home
                    </span>
                  )}
                </div>
                <div className="text-[9px] text-pitch-700 mt-0.5">Elo-based projection</div>
              </div>

              {/* Team B header */}
              <div className="text-right">
                <div className="text-4xl sm:text-5xl font-bold tracking-tight" style={{ color: colorB }}>
                  {teamB}
                </div>
                <div className="text-[11px] text-pitch-400 mt-1">{TEAM_NAMES[teamB]}</div>
                {csB && (
                  <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border"
                    style={{ borderColor: `${colorB}40`, color: colorB, background: `${colorB}12` }}>
                    {csB.conf} #{csB.seed}
                  </div>
                )}
                {tB && (
                  <div className="mt-2 text-right">
                    <div className="text-lg text-pitch-100 tabular-nums font-bold">{tB.w}-{tB.l}</div>
                    <div className="text-[10px] text-pitch-500">{(tB.pct * 100).toFixed(1)}% WR</div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* ── Elo + streak + last10 row ────────────────── */}
          <motion.div variants={item} className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: "Elo Rating", aVal: eloA, bVal: eloB, format: v => v },
              { label: "Last 10", aVal: tA?.last10, bVal: tB?.last10, format: v => v, noBar: true },
              { label: "Home W-L", aVal: tA?.home, bVal: tB?.home, format: v => v, noBar: true },
            ].map(({ label, aVal, bVal, format, noBar }) => (
              <div key={label} className="pm-card p-3 text-center">
                <div className="pm-label mb-2">{label}</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-pitch-100 tabular-nums font-bold" style={{ color: colorA }}>{format(aVal) ?? "—"}</span>
                  <span className="text-[9px] text-pitch-600">vs</span>
                  <span className="text-sm text-pitch-100 tabular-nums font-bold" style={{ color: colorB }}>{format(bVal) ?? "—"}</span>
                </div>
              </div>
            ))}
          </motion.div>

          {/* ── Stat duel bars + radar ────────────────────── */}
          <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
            {/* Duel bars */}
            <div className="pm-card p-4">
              <div className="pm-label mb-4">Stat duel</div>
              <DuelBar label="Net Rtg" aVal={sA?.netRtg} bVal={sB?.netRtg} aColor={colorA} bColor={colorB} format={v => signed(v)} />
              <DuelBar label="eFG%" aVal={sA?.efg} bVal={sB?.efg} aColor={colorA} bColor={colorB} format={v => `${v}%`} />
              <DuelBar label="TOV%" aVal={sA?.tov} bVal={sB?.tov} aColor={colorA} bColor={colorB} invert format={v => `${v}%`} />
              <DuelBar label="ORB%" aVal={sA?.orb} bVal={sB?.orb} aColor={colorA} bColor={colorB} format={v => `${v}%`} />
              <DuelBar label="FT Rate" aVal={sA?.ftr} bVal={sB?.ftr} aColor={colorA} bColor={colorB} format={v => `${v}%`} />
              <DuelBar label="Off Rtg" aVal={sA?.offRtg} bVal={sB?.offRtg} aColor={colorA} bColor={colorB} format={v => v} />
              <DuelBar label="Def Rtg" aVal={sA?.defRtg} bVal={sB?.defRtg} aColor={colorA} bColor={colorB} invert format={v => v} />
              {(!sA || !sB) && (
                <div className="text-[11px] text-pitch-600 italic text-center py-2">
                  Live team stats unavailable — connect NBA Stats API
                </div>
              )}
            </div>

            {/* Radar */}
            <div className="pm-card p-4 flex flex-col">
              <div className="pm-label mb-2">Team profile radar</div>
              {radarData ? (
                <div className="flex-1 min-h-[220px]">
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                      <PolarGrid stroke="#1e2a38" />
                      <PolarAngleAxis dataKey="factor" tick={{ fill: "#546480", fontSize: 10, fontFamily: "inherit" }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar dataKey="A" stroke={colorA} fill={colorA} fillOpacity={0.15} strokeWidth={1.5} dot={{ r: 2, fill: colorA }} />
                      <Radar dataKey="B" stroke={colorB} fill={colorB} fillOpacity={0.15} strokeWidth={1.5} dot={{ r: 2, fill: colorB }} />
                    </RadarChart>
                  </ResponsiveContainer>
                  <div className="flex items-center justify-center gap-4 mt-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-0.5 rounded-full" style={{ background: colorA }} />
                      <span className="text-[10px] text-pitch-500 font-bold tracking-tight">{teamA}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-0.5 rounded-full" style={{ background: colorB }} />
                      <span className="text-[10px] text-pitch-500 font-bold tracking-tight">{teamB}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-[11px] text-pitch-600 italic">
                  Team stats unavailable
                </div>
              )}
            </div>
          </motion.div>

          {/* ── Star player clash ─────────────────────────── */}
          <motion.div variants={item} className="pm-card p-4 mb-3">
            <div className="pm-label mb-4">Star player clash</div>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-start">
              {/* Player A */}
              {starA ? (
                <div>
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: `${colorA}20`, color: colorA, border: `1px solid ${colorA}40` }}>
                      {starA.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-pitch-100 leading-tight">{starA.name}</div>
                      <div className="text-[10px] text-pitch-400">{starA.pos} · Age {starA.age}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[{ l: "PTS", v: starA.pts }, { l: "AST", v: starA.ast }, { l: "REB", v: starA.reb }].map(s => (
                      <div key={s.l} className="bg-pitch-750 rounded-md p-1.5 text-center border border-pitch-700">
                        <div className="font-mono text-sm font-semibold tabular-nums text-pitch-100">{s.v}</div>
                        <div className="text-[9px] text-pitch-500 uppercase tracking-widest">{s.l}</div>
                      </div>
                    ))}
                  </div>
                  {starA.per && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] font-bold text-pitch-500">PER</span>
                      <span className="text-sm font-bold" style={{ color: colorA }}>{starA.per}</span>
                      <span className="text-[9px] text-pitch-600 uppercase tracking-wider">{netRatingTier((starA.ortg ?? 115) - (starA.drtg ?? 113))}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-pitch-600 text-sm py-4">No player data</div>
              )}

              {/* Clash indicator */}
              <div className="flex flex-col items-center gap-1 pt-6">
                <div className="w-px h-8 bg-pitch-700" />
                <Zap size={14} strokeWidth={1.8} className="text-pitch-600" />
                <div className="w-px h-8 bg-pitch-700" />
                {starA?.per && starB?.per && (
                  <div className="mt-2 text-[9px] text-pitch-600 text-center leading-relaxed">
                    PER<br />edge
                  </div>
                )}
                {starA?.per && starB?.per && (
                  <div className="font-bold text-xs" style={{ color: starA.per > starB.per ? colorA : colorB }}>
                    {signed(+(starA.per - starB.per).toFixed(1))}
                  </div>
                )}
              </div>

              {/* Player B */}
              {starB ? (
                <div className="text-right">
                  <div className="flex items-center gap-2.5 mb-3 flex-row-reverse">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: `${colorB}20`, color: colorB, border: `1px solid ${colorB}40` }}>
                      {starB.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-pitch-100 leading-tight">{starB.name}</div>
                      <div className="text-[10px] text-pitch-400">{starB.pos} · Age {starB.age}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[{ l: "PTS", v: starB.pts }, { l: "AST", v: starB.ast }, { l: "REB", v: starB.reb }].map(s => (
                      <div key={s.l} className="bg-pitch-750 rounded-md p-1.5 text-center border border-pitch-700">
                        <div className="font-mono text-sm font-semibold tabular-nums text-pitch-100">{s.v}</div>
                        <div className="text-[9px] text-pitch-500 uppercase tracking-widest">{s.l}</div>
                      </div>
                    ))}
                  </div>
                  {starB.per && (
                    <div className="mt-2 flex items-center gap-2 justify-end">
                      <span className="text-[9px] text-pitch-600 uppercase tracking-wider font-bold">{netRatingTier((starB.ortg ?? 115) - (starB.drtg ?? 113))}</span>
                      <span className="text-sm font-bold" style={{ color: colorB }}>{starB.per}</span>
                      <span className="text-[10px] font-bold text-pitch-500">PER</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-pitch-600 text-sm py-4 text-right">No player data</div>
              )}
            </div>
          </motion.div>

          {/* ── Current form ──────────────────────────────── */}
          <motion.div variants={item} className="pm-card p-4">
            <div className="pm-label mb-3">Current streak</div>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
              <FormRow results={formA} align="left" />
              <span className="text-[10px] text-pitch-600 uppercase tracking-wider">streak</span>
              <FormRow results={formB} align="right" />
            </div>
            {tA?.streak && tB?.streak && (
              <div className="flex justify-between mt-2 text-[10px] text-pitch-500">
                <span className={tA.streak.startsWith("W") ? "text-win" : "text-loss"}>{tA.streak}</span>
                <span className={tB.streak.startsWith("W") ? "text-win" : "text-loss"}>{tB.streak}</span>
              </div>
            )}
          </motion.div>
        </>
      )}
    </motion.div>
  );
}