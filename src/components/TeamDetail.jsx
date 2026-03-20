// ─── TeamDetail.jsx ───────────────────────────────────────────────
// Full team page at /team/:abbr
// Shows: header with record, last-10 form, Elo chart, roster player,
//        recent results, upcoming schedule, standing stats.
// Data: ESPN schedule (live), standings (cached), static PLAYERS roster.

import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
    Tooltip, CartesianGrid, ReferenceLine,
} from "recharts";
import {
    ArrowLeft, TrendingUp, TrendingDown, Minus,
    Calendar, CheckCircle, XCircle, Clock
} from "lucide-react";
import { TEAM_COLORS, TEAM_NAMES, PLAYERS, EAST_STANDINGS, WEST_STANDINGS } from "../data";
import { useStandings, useTeamSchedule, useEnrichedPlayerStats } from "../api";
import { useTeamTheme } from "../App";
import { RowSkeleton, ErrorState } from "./ui";
import { signed } from "../utils";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

// ── Seeded noise (same helper as Analytics) ───────────────────────
function teamSeed(abbr, index) {
    let hash = 0;
    for (let i = 0; i < abbr.length; i++) hash = ((hash << 5) - hash + abbr.charCodeAt(i)) | 0;
    return Math.sin(hash * 0.1 + index * 2.3) * 0.5 + Math.cos(hash * 0.07 + index) * 0.5;
}

// ── Build Elo trajectory from standings entry ─────────────────────
function buildEloTrajectory(teamEntry) {
    if (!teamEntry) return [];
    const BASE = 1500, K = 20;
    const totalGames = teamEntry.w + teamEntry.l;
    let running = BASE;
    const points = [];
    for (let cp = 1; cp <= 20; cp++) {
        const gAt = Math.round((cp / 20) * totalGames);
        const gPrev = Math.round(((cp - 1) / 20) * totalGames);
        const seg = gAt - gPrev;
        const wins = Math.round(teamEntry.pct * seg);
        const noise = Math.sin(cp * 0.8 + teamSeed(teamEntry.team, cp) * 3) * 8;
        for (let g = 0; g < seg; g++) {
            const isW = g < wins;
            running += K * ((isW ? 1 : 0) - 1 / (1 + Math.pow(10, (BASE - running) / 400)));
        }
        if (gAt > 0) points.push({ game: gAt, elo: Math.round(running + noise) });
    }
    return points;
}

// ── Result badge ──────────────────────────────────────────────────
function ResultBadge({ result }) {
    if (!result) return <span className="text-pitch-600 text-[10px]">—</span>;
    return (
        <span className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold flex-shrink-0
      ${result === "W" ? "bg-win/15 text-win border border-win/30" : "bg-loss/15 text-loss border border-loss/30"}`}>
            {result}
        </span>
    );
}

// ── Form strip ────────────────────────────────────────────────────
function FormStrip({ games }) {
  // games is already pastGames which is schedule.filter(result).reverse() (newest first)
  // just slice the first 10 — do NOT reverse again
  const last10 = games.slice(0, 10);
  if (!last10.length) return null;
  return (
    <div className="flex items-center gap-1">
      {last10.map((g, i) => (
        <motion.div
          key={g.id}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.04 }}
          className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold
            ${g.result === "W"
              ? "bg-win/15 text-win border border-win/30"
              : "bg-loss/15 text-loss border border-loss/30"}`}
        >
          {g.result}
        </motion.div>
      ))}
    </div>
  );
}

// ── Stat tile ─────────────────────────────────────────────────────
function StatTile({ label, value, sub, color }) {
    return (
        <motion.div variants={item} className="pm-tile p-3 text-center">
            <div className="pm-label mb-1">{label}</div>
            <div className={`font-mono text-xl font-bold tabular-nums ${color || "text-pitch-50"}`}>{value ?? "—"}</div>
            {sub && <div className="text-[10px] text-pitch-500 mt-0.5">{sub}</div>}
        </motion.div>
    );
}

// ── Main component ────────────────────────────────────────────────
export default function TeamDetail() {
    const { abbr } = useParams();
    const navigate = useNavigate();
    const teamAbbr = abbr?.toUpperCase() ?? "";
    const color = TEAM_COLORS[teamAbbr] || "#546480";
    const teamName = TEAM_NAMES[teamAbbr] || teamAbbr;

    // Apply team color theming globally
    useTeamTheme(teamAbbr);

    const { data: standingsData, isLoading: standLoading } = useStandings();
    const { data: schedule, isLoading: schedLoading, isError: schedError, refetch } = useTeamSchedule(teamAbbr);

    // Find this team in standings
    const teamStanding = useMemo(() => {
        const all = [
            ...(standingsData?.east || EAST_STANDINGS),
            ...(standingsData?.west || WEST_STANDINGS),
        ];
        return all.find(t => t.team === teamAbbr) || null;
    }, [standingsData, teamAbbr]);

    // Conference + seed
    const confSeed = useMemo(() => {
        const eastList = standingsData?.east || EAST_STANDINGS;
        const westList = standingsData?.west || WEST_STANDINGS;
        const eastIdx = eastList.findIndex(t => t.team === teamAbbr);
        if (eastIdx >= 0) return { conf: "East", seed: eastIdx + 1 };
        const westIdx = westList.findIndex(t => t.team === teamAbbr);
        if (westIdx >= 0) return { conf: "West", seed: westIdx + 1 };
        return null;
    }, [standingsData, teamAbbr]);

    // Elo trajectory
    const eloTrajectory = useMemo(() => buildEloTrajectory(teamStanding), [teamStanding]);
    const currentElo = eloTrajectory.at(-1)?.elo ?? 1500;
    const eloTrend = eloTrajectory.length > 3
        ? currentElo - eloTrajectory[eloTrajectory.length - 4].elo : 0;

    // Roster player
    const { data: allPlayers } = useEnrichedPlayerStats();

    const starPlayer = useMemo(() => {
        const pool = (allPlayers || PLAYERS).filter(p => p.team === teamAbbr);
        if (!pool.length) return null;
        return pool.reduce((a, b) => (a?.per ?? a?.pts ?? 0) >= (b?.per ?? b?.pts ?? 0) ? a : b, null);
    }, [allPlayers, teamAbbr]);

    // Schedule splits
    const pastGames = useMemo(() => (schedule || []).filter(g => g.result).reverse(), [schedule]);
    const upcomingGames = useMemo(() => (schedule || []).filter(g => g.status === "scheduled").slice(0, 5), [schedule]);

    // Win streak
    const currentStreak = useMemo(() => {
        if (!pastGames.length) return null;
        const res = pastGames[0].result;
        let cnt = 0;
        for (const g of pastGames) {
            if (g.result === res) cnt++;
            else break;
        }
        return { result: res, count: cnt };
    }, [pastGames]);

    const tooltipStyle = {
        contentStyle: { background: "#161b28", border: "1px solid #2e3a50", borderRadius: 8, fontSize: 11 },
        labelStyle: { color: "#7d91ab" },
        itemStyle: { color },
    };

    if (!TEAM_COLORS[teamAbbr]) {
        return (
            <div className="pm-card p-8 text-center">
                <div className="text-pitch-300 font-medium mb-2">Unknown team: {teamAbbr}</div>
                <button onClick={() => navigate("/standings")} className="pm-btn text-sm">Back to Standings</button>
            </div>
        );
    }

    return (
        <motion.div variants={container} initial="hidden" animate="show"
            exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>

            {/* Back button */}
            <motion.div variants={item} className="mb-4">
                <button onClick={() => navigate(-1)}
                    className="flex items-center gap-1.5 text-[11px] text-pitch-500 hover:text-pitch-200 transition-colors">
                    <ArrowLeft size={12} strokeWidth={1.8} /> Back
                </button>
            </motion.div>

            {/* Hero header */}
            <motion.div variants={item}
                className="pm-card p-5 mb-4 relative overflow-hidden"
                style={{ boxShadow: `0 0 0 1px ${color}25 inset` }}>
                <div className="absolute inset-0 opacity-5"
                    style={{ background: `radial-gradient(ellipse at top left, ${color}, transparent 60%)` }} />

                <div className="relative flex flex-wrap items-start justify-between gap-4">
                    {/* Team identity */}
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                            style={{ background: `${color}20`, border: `1.5px solid ${color}50` }}>
                            <span className="font-display text-2xl tracking-widest" style={{ color }}>{teamAbbr}</span>
                        </div>
                        <div>
                            <div className="font-display text-3xl tracking-widest text-pitch-50">{teamName}</div>
                            <div className="text-[11px] text-pitch-400 mt-0.5 flex items-center gap-2">
                                {confSeed && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono border"
                                        style={{ borderColor: `${color}40`, color, background: `${color}15` }}>
                                        {confSeed.conf} #{confSeed.seed}
                                        {confSeed.seed >= 7 && confSeed.seed <= 10 && (
                                            <span className="ml-1 text-draw">· Play-in</span>
                                        )}
                                    </span>
                                )}
                                {teamStanding && (
                                    <span className="text-pitch-400">{teamStanding.w}-{teamStanding.l}</span>
                                )}
                                {currentStreak && (
                                    <span className={currentStreak.result === "W" ? "text-win" : "text-loss"}>
                                        {currentStreak.result}{currentStreak.count}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Last 10 form */}
                    {schedule && (
                        <div className="flex flex-col items-end gap-1.5">
                            <div className="pm-label text-right">Last 10</div>
                            <FormStrip games={pastGames} />
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Stat tiles */}
            <motion.div variants={item} className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 mb-4">
                <StatTile label="Record" value={teamStanding ? `${teamStanding.w}-${teamStanding.l}` : "—"} />
                <StatTile label="Win %" value={teamStanding ? teamStanding.pct.toFixed(3) : "—"} />
                <StatTile label="Elo" value={currentElo}
                    sub={eloTrend !== 0 ? `${eloTrend > 0 ? "+" : ""}${eloTrend} trend` : "Stable"}
                    color={eloTrend > 5 ? "text-win" : eloTrend < -5 ? "text-loss" : "text-pitch-50"} />
                <StatTile label="Streak" value={currentStreak ? `${currentStreak.result}${currentStreak.count}` : "—"}
                    color={currentStreak?.result === "W" ? "text-win" : currentStreak?.result === "L" ? "text-loss" : "text-pitch-50"} />
                <StatTile label="Home" value={teamStanding?.home ?? "—"} />
                <StatTile label="Road" value={teamStanding?.road ?? "—"} />
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                {/* Elo trajectory chart */}
                <motion.div variants={item} className="pm-card p-4 lg:col-span-2">
                    <div className="pm-label mb-3 flex items-center gap-2">
                        Season Elo Trajectory
                        <span className={`text-[10px] font-mono flex items-center gap-1
              ${eloTrend > 0 ? "text-win" : eloTrend < 0 ? "text-loss" : "text-pitch-500"}`}>
                            {eloTrend > 0 ? <TrendingUp size={10} /> : eloTrend < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
                            {eloTrend !== 0 ? `${eloTrend > 0 ? "+" : ""}${eloTrend}` : "Flat"}
                        </span>
                    </div>
                    <div style={{ height: 160 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={eloTrajectory}>
                                <defs>
                                    <linearGradient id={`eloGrad-${teamAbbr}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1a2233" vertical={false} />
                                <XAxis dataKey="game" tick={{ fill: "#546480", fontSize: 10 }} axisLine={false} tickLine={false}
                                    label={{ value: "Games played", position: "insideBottomRight", offset: -4, fill: "#3d4f6a", fontSize: 9 }} />
                                <YAxis domain={["auto", "auto"]} tick={{ fill: "#546480", fontSize: 10 }} axisLine={false} tickLine={false} />
                                <ReferenceLine y={1500} stroke="#2e3a50" strokeDasharray="4 2" strokeWidth={1}
                                    label={{ value: "avg", position: "right", fill: "#3d4f6a", fontSize: 9 }} />
                                <Tooltip {...tooltipStyle} formatter={v => [v, "Elo"]} />
                                <Area type="monotone" dataKey="elo" stroke={color} fill={`url(#eloGrad-${teamAbbr})`}
                                    strokeWidth={2} dot={false} activeDot={{ r: 4, fill: color }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Star player card */}
                <motion.div variants={item} className="pm-card p-4">
                    <div className="pm-label mb-3">Star Player</div>
                    {starPlayer ? (
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                                    style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>
                                    {starPlayer.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-pitch-100">{starPlayer.name}</div>
                                    <div className="text-[10px] text-pitch-400">{starPlayer.pos} · Age {starPlayer.age}</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mb-3">
                                {[
                                    { lbl: "PTS", val: starPlayer.pts },
                                    { lbl: "AST", val: starPlayer.ast },
                                    { lbl: "REB", val: starPlayer.reb },
                                ].map(s => (
                                    <div key={s.lbl} className="bg-pitch-750 rounded-md p-2 text-center border border-pitch-650">
                                        <div className="font-mono font-bold text-sm text-pitch-100 tabular-nums">{s.val}</div>
                                        <div className="text-[9px] text-pitch-500 uppercase tracking-widest mt-0.5">{s.lbl}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="space-y-1.5">
                                {[
                                    { lbl: "PER", val: starPlayer.per, max: 35 },
                                    { lbl: "TS%", val: starPlayer.ts, max: 75 },
                                    { lbl: "BPM", val: Math.max(0, starPlayer.bpm + 5), max: 17 },
                                ].map(s => (
                                    <div key={s.lbl} className="flex items-center gap-2">
                                        <span className="text-[10px] text-pitch-500 w-7">{s.lbl}</span>
                                        <div className="flex-1 h-1.5 bg-pitch-700 rounded-full overflow-hidden">
                                            <motion.div className="h-full rounded-full"
                                                style={{ background: color, opacity: 0.8 }}
                                                initial={{ width: 0 }}
                                                animate={{ width: `${Math.min(100, (s.val / s.max) * 100)}%` }}
                                                transition={{ duration: 0.7 }} />
                                        </div>
                                        <span className="font-mono text-[10px] text-pitch-300 w-6 text-right tabular-nums">{s.val}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="text-pitch-500 text-sm text-center py-4">No player data</div>
                    )}
                </motion.div>
            </div>

            {/* Schedule grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Recent results */}
                <motion.div variants={item} className="pm-card p-4">
                    <div className="pm-label mb-3">Recent Results</div>
                    {schedError ? (
                        <ErrorState message="Couldn't load schedule." onRetry={refetch} />
                    ) : schedLoading ? (
                        <RowSkeleton rows={5} />
                    ) : pastGames.length === 0 ? (
                        <div className="text-pitch-500 text-sm text-center py-4">No results yet</div>
                    ) : (
                        <div className="space-y-px">
                            {pastGames.slice(0, 10).map((g, i) => (
                                <motion.div key={g.id}
                                    initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.025 }}
                                    className="flex items-center gap-2.5 px-2 py-2 rounded hover:bg-pitch-750 transition-colors">
                                    <ResultBadge result={g.result} />
                                    <span className="flex-1 text-[11px] text-pitch-300">
                                        {g.isHome ? "vs" : "@"} {g.opponent}
                                    </span>
                                    {g.teamScore !== null && (
                                        <span className={`font-mono text-[11px] tabular-nums font-medium
                      ${g.result === "W" ? "text-win" : "text-loss"}`}>
                                            {g.teamScore}–{g.oppScore}
                                        </span>
                                    )}
                                    <span className="text-[10px] text-pitch-600 w-14 text-right">{g.dateStr}</span>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </motion.div>

                {/* Upcoming */}
                <motion.div variants={item} className="pm-card p-4">
                    <div className="pm-label mb-3">Upcoming Games</div>
                    {schedLoading ? (
                        <RowSkeleton rows={5} />
                    ) : upcomingGames.length === 0 ? (
                        <div className="text-pitch-500 text-sm text-center py-4">No upcoming games found</div>
                    ) : (
                        <div className="space-y-px">
                            {upcomingGames.map((g, i) => (
                                <motion.div key={g.id}
                                    initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.04 }}
                                    className="flex items-center gap-2.5 px-2 py-2 rounded hover:bg-pitch-750 transition-colors">
                                    <Clock size={11} className="text-pitch-600 flex-shrink-0" strokeWidth={1.5} />
                                    <span className="flex-1 text-[11px] text-pitch-300">
                                        {g.isHome ? "vs" : "@"}{" "}
                                        <span className="font-medium text-pitch-200">{g.opponent}</span>
                                    </span>
                                    <span className="text-[10px] text-pitch-500 font-mono">
                                        {g.detail || g.dateStr}
                                    </span>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </motion.div>
            </div>
        </motion.div>
    );
}