import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, BarChart, Bar, Cell, ReferenceLine, Area, AreaChart,
} from "recharts";
import {
  ArrowUpDown, Download, Trash2, Plus, ChevronUp, ChevronDown,
  TrendingUp, Flame, Shield, DollarSign, Target, X, Info,
} from "lucide-react";
import { TEAM_NAMES, ODDS_GAMES, TEAM_COLORS } from "../data";
import { useStandings, useTodayGames, useOdds, mergeOddsIntoGames } from "../api";
import {
  calcPL, BET_STORAGE_KEY, lsGet, lsSet,
  formatCurrency, formatPct, kellyBet, DEFAULT_BANKROLL,
  calcROI, breakEven,
} from "../utils";
import { TileSkeleton, RowSkeleton, ErrorState, FreshnessTag, EmptyState, useToast } from "./ui";

// ── Animation config ──────────────────────────────────────────────
const container = { hidden: {}, show: { transition: { staggerChildren: 0.035 } } };
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] } },
};

// ── Recharts tooltip style (shared) ──────────────────────────────
const tooltipStyle = {
  contentStyle: {
    background: "#161b28",
    border: "1px solid #2e3a50",
    borderRadius: 8,
    fontSize: 11,
    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
  },
  labelStyle: { color: "#7d91ab" },
  itemStyle: { color: "#00d4aa" },
};

// ═══════════════════════════════════════════════════════════════════
// SCORES
// ═══════════════════════════════════════════════════════════════════
export function Scores() {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");   // "all" | "live" | "final" | "scheduled"
  const { data: rawGames, isLoading, isError, isFetching, refetch, dataUpdatedAt } = useTodayGames();
  const { data: oddsData } = useOdds();
  const games = useMemo(() => mergeOddsIntoGames(rawGames, oddsData) || [], [rawGames, oddsData]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  const filtered = useMemo(() => {
    if (filter === "all") return games;
    return games.filter(g => g.status === filter);
  }, [games, filter]);

  const counts = useMemo(() => ({
    all: games.length,
    live: games.filter(g => g.status === "live").length,
    final: games.filter(g => g.status === "final").length,
    scheduled: games.filter(g => g.status === "scheduled").length,
  }), [games]);

  return (
    <motion.div variants={container} initial="hidden" animate="show" exit={{ opacity: 0, y: -4 }}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="pm-label">{today}</div>
          <div className="text-[11px] text-pitch-500 mt-0.5">{games.length} games</div>
        </div>
        <FreshnessTag isFetching={isFetching} dataUpdatedAt={dataUpdatedAt} />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {[
          { id: "all", label: "All" },
          { id: "live", label: "Live", dot: true },
          { id: "scheduled", label: "Upcoming" },
          { id: "final", label: "Final" },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all
              ${filter === f.id
                ? "bg-accent/15 text-accent border border-accent/30"
                : "bg-pitch-800 text-pitch-400 border border-pitch-600 hover:border-pitch-500 hover:text-pitch-300"
              }`}
          >
            {f.dot && counts.live > 0 && <span className="w-1.5 h-1.5 rounded-full bg-win animate-live-pulse" />}
            {f.label}
            {counts[f.id] > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full
                ${filter === f.id ? "bg-accent/20 text-accent" : "bg-pitch-700 text-pitch-500"}`}>
                {counts[f.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {isError ? (
        <ErrorState message="Couldn't load today's games." onRetry={refetch} type="network" />
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => <TileSkeleton key={i} lines={4} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={filter === "all" ? "No games today" : `No ${filter} games`}
          description={filter === "all" ? "Check back later for upcoming matchups." : "Try a different filter."}
          icon={Target}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(g => {
            const fav = g.homeP >= g.awayP ? "home" : "away";
            const isSelected = selected === g.id;
            const isFinal = g.status === "final";
            const isLive = g.status === "live";
            const awayColor = TEAM_COLORS[g.away] || "#546480";
            const homeColor = TEAM_COLORS[g.home] || "#546480";

            return (
              <motion.div
                key={g.id}
                variants={item}
                layout
                onClick={() => setSelected(isSelected ? null : g.id)}
                className={`pm-tile p-4 ${isSelected ? "pm-accent-border" : ""}`}
              >
                {/* Header */}
                <div className="flex justify-between items-center mb-3">
                  <span className="pm-label">{g.time}</span>
                  {isFinal && (
                    <span className="pm-badge bg-pitch-700 text-pitch-400 border border-pitch-600">Final</span>
                  )}
                  {isLive && (
                    <span className="pm-badge bg-win/10 text-win border border-win/20 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-win animate-live-pulse inline-block" />
                      Live
                    </span>
                  )}
                  {g.status === "scheduled" && (
                    <span className="pm-badge bg-pitch-750 text-pitch-400 border border-pitch-600">
                      {g.spread !== "—" ? g.spread : "Tonight"}
                    </span>
                  )}
                </div>

                {/* Teams */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1">
                    <div
                      className={`font-display text-2xl tracking-widest leading-none
                        ${fav === "away" ? "" : "text-pitch-400"}`}
                      style={{ color: fav === "away" ? awayColor : undefined }}
                    >
                      {g.away}
                    </div>
                    <div className="text-[10px] text-pitch-500 mt-0.5 truncate">{TEAM_NAMES[g.away] || g.away}</div>
                    {(isFinal || isLive) && (
                      <motion.div
                        key={g.awayScore}
                        initial={{ scale: 1.08 }}
                        animate={{ scale: 1 }}
                        className="pm-number text-xl mt-1 text-pitch-100"
                      >
                        {g.awayScore}
                      </motion.div>
                    )}
                  </div>

                  <div className="text-center flex-shrink-0">
                    <div className="text-[10px] text-pitch-600 font-mono">
                      {isFinal || isLive ? "—" : "vs"}
                    </div>
                    {g.total !== "—" && (
                      <div className="text-[9px] text-pitch-600 mt-0.5">O/U {g.total}</div>
                    )}
                  </div>

                  <div className="flex-1 text-right">
                    <div
                      className={`font-display text-2xl tracking-widest leading-none
                        ${fav === "home" ? "" : "text-pitch-400"}`}
                      style={{ color: fav === "home" ? homeColor : undefined }}
                    >
                      {g.home}
                    </div>
                    <div className="text-[10px] text-pitch-500 mt-0.5 truncate text-right">{TEAM_NAMES[g.home] || g.home}</div>
                    {(isFinal || isLive) && (
                      <motion.div
                        key={g.homeScore}
                        initial={{ scale: 1.08 }}
                        animate={{ scale: 1 }}
                        className="pm-number text-xl mt-1 text-pitch-100 text-right"
                      >
                        {g.homeScore}
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Probability bar (scheduled only) */}
                {g.status === "scheduled" && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-pitch-500">
                      <span className="font-mono">{g.awayP}%</span>
                      <span className="font-mono">{g.homeP}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-pitch-700 overflow-hidden relative">
                      <motion.div
                        className="h-full absolute top-0 left-0 rounded-full"
                        style={{ background: awayColor, opacity: 0.8 }}
                        initial={{ width: 0 }}
                        animate={{ width: `${g.awayP}%` }}
                        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                      />
                    </div>
                  </div>
                )}

                {/* Expanded odds detail */}
                <AnimatePresence>
                  {isSelected && g.spread !== "—" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-3 border-t border-pitch-700 grid grid-cols-2 gap-2">
                        <div className="bg-pitch-750 rounded-md p-2">
                          <div className="text-[9px] text-pitch-500 uppercase tracking-wide mb-0.5">Spread</div>
                          <div className="pm-number text-sm text-pitch-200">{g.spread}</div>
                        </div>
                        <div className="bg-pitch-750 rounded-md p-2">
                          <div className="text-[9px] text-pitch-500 uppercase tracking-wide mb-0.5">Over/Under</div>
                          <div className="pm-number text-sm text-pitch-200">{g.total}</div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STANDINGS
// ═══════════════════════════════════════════════════════════════════
export function Standings() {
  const [conf, setConf] = useState("east");
  const [sortKey, setSortKey] = useState("pct");
  const [sortDir, setSortDir] = useState("desc");
  const { data, isLoading, isError, isFetching, refetch, dataUpdatedAt } = useStandings();

  const rawTeams = conf === "east" ? (data?.east || []) : (data?.west || []);

  const teams = useMemo(() => {
    const sorted = [...rawTeams].sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
    return sorted;
  }, [rawTeams, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return <ArrowUpDown size={10} className="text-pitch-700 ml-0.5" />;
    return sortDir === "desc"
      ? <ChevronDown size={10} className="text-accent ml-0.5" />
      : <ChevronUp size={10} className="text-accent ml-0.5" />;
  };

  const headers = [
    { key: null, label: "#", sortable: false },
    { key: "team", label: "Team", sortable: false },
    { key: "w", label: "W", sortable: true },
    { key: "l", label: "L", sortable: true },
    { key: "pct", label: "PCT", sortable: true },
    { key: "last10", label: "L10", sortable: false },
    { key: "home", label: "HOME", sortable: false },
    { key: "road", label: "ROAD", sortable: false },
    { key: "streak", label: "STREAK", sortable: false },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-1.5">
          {[["east", "Eastern"], ["west", "Western"]].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setConf(id)}
              className={`pm-tab ${conf === id ? "active" : ""}`}
            >
              {label} Conference
            </button>
          ))}
        </div>
        <FreshnessTag isFetching={isFetching} dataUpdatedAt={dataUpdatedAt} />
      </div>

      {isError ? (
        <ErrorState message="Couldn't load standings." onRetry={refetch} type="network" />
      ) : isLoading ? (
        <div className="pm-card p-4"><RowSkeleton rows={15} /></div>
      ) : (
        <>
          <div className="pm-card overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-pitch-700">
                  {headers.map(h => (
                    <th
                      key={h.label}
                      onClick={() => h.sortable && handleSort(h.key)}
                      className={`px-3 py-2.5 text-left pm-label
                        ${h.sortable ? "cursor-pointer hover:text-pitch-300 select-none" : ""}
                        ${sortKey === h.key ? "text-accent" : ""}`}
                    >
                      <span className="inline-flex items-center">
                        {h.label}
                        {h.sortable && <SortIcon k={h.key} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teams.map((t, i) => {
                  // Find original rank (by pct desc) for playoff visual
                  const origRank = rawTeams.findIndex(rt => rt.team === t.team);
                  const isPlayIn = origRank >= 6 && origRank <= 9;
                  const isPlayoff = origRank < 6;
                  const isFirst = origRank === 0;

                  return (
                    <motion.tr
                      key={t.team}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.015 }}
                      className={`border-b border-pitch-700 hover:bg-pitch-750 transition-colors
                        ${origRank === 6 ? "border-t-2 border-t-accent/30" : ""}`}
                    >
                      <td className="px-3 py-2.5 font-mono text-[11px] text-pitch-600">{origRank + 1}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: TEAM_COLORS[t.team] || "#546480" }}
                          />
                          <span className={`font-display text-base tracking-wider
                            ${isFirst ? "text-accent" : isPlayoff ? "text-pitch-200" : "text-pitch-400"}`}>
                            {t.team}
                          </span>
                          {isPlayIn && (
                            <span className="text-[9px] text-draw border border-draw/30 bg-draw/10 px-1.5 py-0.5 rounded">
                              play-in
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-pitch-200 font-medium">{t.w}</td>
                      <td className="px-3 py-2.5 font-mono text-pitch-400">{t.l}</td>
                      <td className="px-3 py-2.5 font-mono text-pitch-300">{formatPct(t.pct)}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-pitch-400">{t.last10}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-pitch-400">{t.home}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-pitch-400">{t.road}</td>
                      <td className="px-3 py-2.5">
                        <span className={`pm-badge
                          ${t.streak?.startsWith("W")
                            ? "bg-win/10 text-win border border-win/20"
                            : "bg-loss/10 text-loss border border-loss/20"}`}>
                          {t.streak}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-4 text-[10px] text-pitch-600 px-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm border-t-2 border-t-accent/50 border border-pitch-600" />
              Ranks 1–6 = direct playoff
            </span>
            <span className="flex items-center gap-1.5">
              <span className="pm-badge text-draw border border-draw/30 bg-draw/10 text-[8px]">play-in</span>
              Ranks 7–10 = play-in tournament
            </span>
          </div>
        </>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// BETTING (Edge Finder)
// ═══════════════════════════════════════════════════════════════════
export function Betting() {
  const { data: rawGames } = useTodayGames();
  const { data: oddsData, isFetching: oddsFetching, dataUpdatedAt: oddsUpdatedAt } = useOdds();
  const { data: standingsData, isFetching: standingsFetching } = useStandings();

  const liveEdges = useMemo(() => {
    if (!oddsData || !standingsData || !rawGames) return null;

    const allTeams = [...(standingsData.east || []), ...(standingsData.west || [])];
    const teamPct = {};
    allTeams.forEach(t => { teamPct[t.team] = { pct: t.pct, games: t.w + t.l }; });

    const edges = [];
    for (const game of (rawGames || []).filter(g => g.status === "scheduled")) {
      const key = `${game.away}@${game.home}`;
      const odds = oddsData[key];
      if (!odds) continue;

      const fav = odds.homeP >= odds.awayP ? game.home : game.away;
      const impliedP = Math.max(odds.homeP, odds.awayP);
      const favStats = teamPct[fav];
      const totalGames = favStats?.games || 0;
      const modelP = totalGames >= 10 ? +(favStats.pct * 100).toFixed(1) : null;
      const diff = modelP !== null ? +(modelP - impliedP).toFixed(1) : null;
      const edge = diff !== null ? (diff >= 10 ? "high" : diff >= 5 ? "mid" : "low") : "none";

      // Kelly for high/mid edges
      const kellyAmt = (diff !== null && diff >= 5)
        ? kellyBet(modelP / 100, -110, DEFAULT_BANKROLL)
        : null;

      edges.push({
        matchup: `${game.away} @ ${game.home}`,
        away: game.away, home: game.home,
        fav, modelP, impliedP: +impliedP.toFixed(1),
        diff, edge, spread: game.spread, total: game.total, kellyAmt,
      });
    }
    return edges.sort((a, b) => ({ high: 0, mid: 1, low: 2, none: 3 }[a.edge] - { high: 0, mid: 1, low: 2, none: 3 }[b.edge]));
  }, [oddsData, standingsData, rawGames]);

  const isLive = !!(liveEdges && liveEdges.length > 0);
  const hasOddsKey = !!import.meta.env.VITE_ODDS_API_KEY;
  const displayCards = isLive ? liveEdges : ODDS_GAMES;

  return (
    <motion.div variants={container} initial="hidden" animate="show" exit={{ opacity: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="pm-label">
            {isLive ? "Live market edges — tonight's games" : "Sample edge data"}
          </div>
          {isLive && (
            <div className="text-[10px] text-pitch-500 mt-0.5">
              Model: season W% proxy · Market: vig-removed moneyline
            </div>
          )}
        </div>
        <FreshnessTag isFetching={oddsFetching || standingsFetching} dataUpdatedAt={oddsUpdatedAt} />
      </div>

      {/* API key banner */}
      {!hasOddsKey && (
        <motion.div
          variants={item}
          className="mb-4 px-3.5 py-3 rounded-lg border border-draw/20 bg-draw/5 flex items-start gap-2.5"
        >
          <Info size={13} className="text-draw flex-shrink-0 mt-0.5" strokeWidth={1.8} />
          <div className="text-[11px] text-pitch-400 leading-relaxed">
            <span className="text-pitch-200 font-medium">Sample data shown.</span>
            {" "}Add{" "}
            <code className="font-mono text-pitch-300 bg-pitch-700 px-1 py-0.5 rounded text-[10px]">
              VITE_ODDS_API_KEY
            </code>
            {" "}to{" "}
            <code className="font-mono text-pitch-300 bg-pitch-700 px-1 py-0.5 rounded text-[10px]">.env</code>
            {" "}for live market odds from The Odds API.
          </div>
        </motion.div>
      )}

      {/* Edge cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        {(isLive ? liveEdges : ODDS_GAMES).map((g, idx) => {
          const diff = isLive ? g.diff : (g.modelP - g.impliedP);
          const edge = isLive ? g.edge : g.edge;
          const favColor = TEAM_COLORS[(isLive ? g.fav : g.fav)] || "#546480";

          const edgeMeta = {
            high: { label: "★ HIGH EDGE", cls: "text-win border-win/30 bg-win/10" },
            mid: { label: "MOD", cls: "text-draw border-draw/30 bg-draw/10" },
            low: { label: "SMALL", cls: "text-pitch-400 border-pitch-600 bg-pitch-750" },
            none: { label: "N/A", cls: "text-pitch-600 border-pitch-700 bg-pitch-800" },
          }[edge] || { label: "LOW", cls: "text-pitch-400 border-pitch-600 bg-pitch-750" };

          return (
            <motion.div key={g.matchup + idx} variants={item} className="pm-tile p-4">
              {/* Card header */}
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-pitch-100 truncate">{g.matchup}</div>
                  <div className="text-[10px] text-pitch-500 mt-0.5">
                    Fav:{" "}
                    <span className="font-medium" style={{ color: favColor }}>
                      {g.fav}
                    </span>
                    {edge === "none" && (
                      <span className="text-pitch-600 ml-1">· low sample</span>
                    )}
                  </div>
                </div>
                <span className={`pm-badge border ml-2 flex-shrink-0 ${edgeMeta.cls}`}>
                  {edgeMeta.label}
                </span>
              </div>

              {/* Stats grid */}
              <div className="space-y-2 mb-3">
                {[
                  { label: "Model prob", value: g.modelP !== null ? `${g.modelP}%` : "—", cls: "text-pitch-100" },
                  { label: "Market implied", value: `${g.impliedP}%`, cls: "text-pitch-300" },
                  {
                    label: "Edge",
                    value: diff !== null ? (diff > 0 ? `+${diff}%` : `${diff}%`) : "—",
                    cls: diff === null ? "text-pitch-600"
                      : diff >= 10 ? "text-win font-semibold"
                        : diff >= 5 ? "text-draw font-semibold"
                          : "text-pitch-400",
                  },
                ].map(s => (
                  <div key={s.label} className="flex justify-between items-center text-[11px]">
                    <span className="text-pitch-500">{s.label}</span>
                    <span className={`pm-number ${s.cls}`}>{s.value}</span>
                  </div>
                ))}
              </div>

              {/* Visual edge bar */}
              {diff !== null && diff > 0 && (
                <div className="mb-3">
                  <div className="h-1.5 rounded-full bg-pitch-700 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: diff >= 10 ? "#22c55e" : diff >= 5 ? "#f59e0b" : "#546480",
                        opacity: 0.8,
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(diff * 5, 100)}%` }}
                      transition={{ duration: 0.7 }}
                    />
                  </div>
                </div>
              )}

              {/* Kelly suggestion */}
              {isLive && g.kellyAmt > 0 && (
                <div className="mb-3 px-2.5 py-2 rounded-md bg-pitch-750 border border-pitch-700">
                  <div className="flex items-center gap-1.5 text-[10px] text-pitch-400">
                    <Shield size={10} className="text-accent" />
                    <span>½-Kelly: <span className="text-accent font-mono font-medium">${g.kellyAmt}</span></span>
                    <span className="text-pitch-600">on ${DEFAULT_BANKROLL} bankroll</span>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="border-t border-pitch-700 pt-2.5 flex justify-between text-[10px] text-pitch-500">
                <span>{g.spread}</span>
                <span>O/U {g.total}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Methodology note */}
      <motion.div variants={item} className="pm-card p-4 text-[11px] text-pitch-400 leading-relaxed">
        <span className="text-pitch-200 font-medium">How edges are calculated: </span>
        Model win% uses season win percentage (≥10 games required) as a proxy for team strength.
        Market implied probability is derived from American moneyline odds via The Odds API, with
        vig removed via normalization. Edge = model prob − market implied. A difference ≥10% is
        flagged as high-value; ≥5% as moderate. Kelly Criterion bet sizes assume a $
        {DEFAULT_BANKROLL} bankroll and use ½-Kelly for risk management.{" "}
        <span className="text-pitch-600">This is analytical tooling, not financial advice.</span>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// BET TRACKER
// ═══════════════════════════════════════════════════════════════════

const DEMO_BETS = [
  { id: 1, game: "OKC @ BKN", type: "Spread", pick: "OKC -16", odds: -110, stake: 50, result: "win" },
  { id: 2, game: "GSW @ BOS", type: "Moneyline", pick: "BOS ML", odds: -240, stake: 100, result: "win" },
  { id: 3, game: "POR @ IND", type: "Over/Under", pick: "Over 228", odds: -112, stake: 40, result: "loss" },
  { id: 4, game: "LAL @ HOU", type: "Spread", pick: "HOU -1", odds: -108, stake: 55, result: "pending" },
  { id: 5, game: "MIA @ MIL", type: "Moneyline", pick: "MIL ML", odds: -160, stake: 80, result: "loss" },
];

function loadBets() {
  const raw = lsGet(BET_STORAGE_KEY);
  if (raw === null) return DEMO_BETS;
  return Array.isArray(raw) ? raw : DEMO_BETS;
}

function exportBetsCSV(bets) {
  const headers = "Date,Game,Type,Pick,Odds,Stake,Result,P&L,Break-even\n";
  const rows = bets.map(b => {
    const pl = calcPL(b.stake, b.odds, b.result);
    const be = (breakEven(b.odds) * 100).toFixed(1);
    const date = b.id > 1e12 ? new Date(b.id).toLocaleDateString("en-US") : "";
    return `"${date}","${b.game}","${b.type}","${b.pick}",${b.odds},${b.stake},${b.result},${b.result === "pending" ? "" : pl.toFixed(2)},${be}%`;
  }).join("\n");

  const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `plusminus-bets-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

const RESULT_OPTIONS = [
  { value: "win", label: "WIN", cls: "bg-win/10  text-win  border-win/20" },
  { value: "loss", label: "LOSS", cls: "bg-loss/10 text-loss border-loss/20" },
  { value: "push", label: "PUSH", cls: "bg-draw/10 text-draw border-draw/20" },
  { value: "pending", label: "PENDING", cls: "bg-pitch-750 text-pitch-500 border-pitch-600" },
];

export function BetTracker() {
  const [bets, setBets] = useState(loadBets);
  const [form, setForm] = useState({ game: "", type: "Moneyline", pick: "", odds: "", stake: "", result: "pending" });
  const [formError, setFormError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [filterResult, setFilterResult] = useState("all");
  const toast = useToast();

  // Save to localStorage on any change
  useEffect(() => {
    lsSet(BET_STORAGE_KEY, bets);
  }, [bets]);

  const addBet = useCallback(() => {
    const { game, pick, odds, stake } = form;
    if (!game.trim() || !pick.trim() || !odds || !stake) {
      setFormError("Game, Pick, Odds, and Stake are all required.");
      return;
    }
    const oddsNum = parseFloat(odds);
    if (isNaN(oddsNum) || oddsNum === 0) {
      setFormError("Odds must be a valid number (e.g. -110 or +150).");
      return;
    }
    if (parseFloat(stake) <= 0) {
      setFormError("Stake must be greater than $0.");
      return;
    }
    setFormError("");
    setBets(prev => [{
      ...form,
      id: Date.now(),
      odds: oddsNum,
      stake: parseFloat(stake),
    }, ...prev]);
    setForm({ game: "", type: "Moneyline", pick: "", odds: "", stake: "", result: "pending" });
    toast.success("Bet logged!");
  }, [form, toast]);

  const clearAll = () => {
    if (window.confirm("Clear all bets? This cannot be undone.")) {
      setBets([]);
      toast.info("Bet log cleared.");
    }
  };

  const deleteBet = (id) => {
    setBets(prev => prev.filter(b => b.id !== id));
  };

  const updateResult = (id, newResult) => {
    setBets(prev => prev.map(b => b.id === id ? { ...b, result: newResult } : b));
    setEditingId(null);
    toast.success("Result updated.");
  };

  // Stats
  const stats = useMemo(() => {
    const decisive = bets.filter(b => b.result === "win" || b.result === "loss");
    const wins = bets.filter(b => b.result === "win").length;
    const totalPL = bets.reduce((s, b) => s + calcPL(b.stake, b.odds, b.result), 0);
    const totalStake = decisive.reduce((s, b) => s + b.stake, 0);
    const roi = calcROI(totalPL, totalStake);
    const winRate = decisive.length > 0 ? ((wins / decisive.length) * 100).toFixed(1) + "%" : "—";
    const pending = bets.filter(b => b.result === "pending").length;
    return { totalPL, roi, winRate, pending, wins, losses: decisive.length - wins };
  }, [bets]);

  // Chart data
  const chartData = useMemo(() => {
    let running = 0;
    return [...bets]
      .filter(b => b.result !== "pending")
      .reverse()
      .map((b, i) => {
        running += calcPL(b.stake, b.odds, b.result);
        return { bet: i + 1, pl: +running.toFixed(2), result: b.result };
      });
  }, [bets]);

  const typeBreakdown = useMemo(() => {
    const types = {};
    bets.forEach(b => {
      if (b.result === "pending") return;
      if (!types[b.type]) types[b.type] = { wins: 0, losses: 0, pl: 0, count: 0 };
      if (b.result === "win") types[b.type].wins++;
      if (b.result === "loss") types[b.type].losses++;
      types[b.type].pl += calcPL(b.stake, b.odds, b.result);
      types[b.type].count++;
    });
    return Object.entries(types).map(([type, d]) => ({
      type,
      winRate: d.count > 0 ? +((d.wins / d.count) * 100).toFixed(0) : 0,
      pl: +d.pl.toFixed(2),
      count: d.count,
    })).sort((a, b) => b.winRate - a.winRate);
  }, [bets]);

  const displayBets = filterResult === "all"
    ? bets
    : bets.filter(b => b.result === filterResult);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

      {/* ── Summary tiles ───────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {[
          { lbl: "Total Bets", val: bets.length, cls: "text-pitch-50" },
          { lbl: "Win Rate", val: stats.winRate, cls: "text-pitch-50" },
          { lbl: "Net P&L", val: formatCurrency(stats.totalPL), cls: stats.totalPL >= 0 ? "text-win" : "text-loss" },
          { lbl: "ROI", val: `${stats.roi >= 0 ? "+" : ""}${stats.roi.toFixed(1)}%`, cls: stats.roi >= 0 ? "text-win" : "text-loss" },
          { lbl: "Pending", val: stats.pending, cls: "text-draw" },
        ].map(m => (
          <div key={m.lbl} className="pm-tile p-4 text-center">
            <div className="pm-label mb-1.5">{m.lbl}</div>
            <div className={`pm-number font-medium text-2xl ${m.cls}`}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* ── Add bet form ─────────────────────────────────────── */}
      <div className="pm-card p-4 mb-4">
        <div className="pm-label mb-3">Log a bet</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
          <input
            className="pm-input col-span-2 sm:col-span-1"
            placeholder="Game (OKC @ BKN)"
            value={form.game}
            onChange={e => setForm(f => ({ ...f, game: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && addBet()}
          />
          <select
            className="pm-select"
            value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
          >
            {["Moneyline", "Spread", "Over/Under", "Player prop", "Parlay", "Futures"].map(t => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input
            className="pm-input"
            placeholder="Pick (OKC -16)"
            value={form.pick}
            onChange={e => setForm(f => ({ ...f, pick: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && addBet()}
          />
          <input
            className="pm-input"
            placeholder="Odds (-110)"
            type="number"
            value={form.odds}
            onChange={e => setForm(f => ({ ...f, odds: e.target.value }))}
          />
          <input
            className="pm-input"
            placeholder="Stake ($)"
            type="number"
            min="0"
            value={form.stake}
            onChange={e => setForm(f => ({ ...f, stake: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && addBet()}
          />
          <select
            className="pm-select"
            value={form.result}
            onChange={e => setForm(f => ({ ...f, result: e.target.value }))}
          >
            {RESULT_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        {/* Break-even calc */}
        {form.odds && !isNaN(parseFloat(form.odds)) && (
          <div className="mb-3 text-[11px] text-pitch-500 flex items-center gap-2">
            <TrendingUp size={11} className="text-pitch-500" />
            Break-even at odds {form.odds}:{" "}
            <span className="text-pitch-300 font-mono">
              {(breakEven(parseFloat(form.odds)) * 100).toFixed(1)}%
            </span>
            {form.stake && !isNaN(parseFloat(form.stake)) && (
              <>
                {" · "}To profit{" "}
                <span className="text-pitch-300 font-mono">
                  {formatCurrency(calcPL(parseFloat(form.stake), parseFloat(form.odds), "win"), false)}
                </span>
                {" on win"}
              </>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button onClick={addBet} className="pm-btn">
            <Plus size={13} strokeWidth={1.8} />
            Add bet
          </button>
          {formError && (
            <motion.span
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-[11px] text-loss"
            >
              {formError}
            </motion.span>
          )}
        </div>
      </div>

      {/* ── Bet log table ────────────────────────────────────── */}
      <div className="pm-card overflow-x-auto mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-pitch-700">
          <div className="flex items-center gap-2">
            <span className="pm-label">Bet log</span>
            <span className="text-[10px] text-pitch-600">· {bets.length} entries</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter */}
            <div className="flex gap-1">
              {["all", "win", "loss", "pending"].map(f => (
                <button
                  key={f}
                  onClick={() => setFilterResult(f)}
                  className={`text-[10px] px-2 py-1 rounded border transition-all
                    ${filterResult === f
                      ? f === "win" ? "bg-win/10 text-win border-win/20"
                        : f === "loss" ? "bg-loss/10 text-loss border-loss/20"
                          : f === "pending" ? "bg-draw/10 text-draw border-draw/20"
                            : "bg-accent/10 text-accent border-accent/20"
                      : "bg-pitch-750 text-pitch-500 border-pitch-700 hover:border-pitch-600"
                    }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            {bets.length > 0 && (
              <button
                onClick={() => exportBetsCSV(bets)}
                className="flex items-center gap-1 text-[10px] text-pitch-400 hover:text-accent transition-colors"
              >
                <Download size={11} strokeWidth={1.8} />
                Export CSV
              </button>
            )}
            {bets.length > 0 && (
              <button
                onClick={clearAll}
                className="flex items-center gap-1 text-[10px] text-pitch-500 hover:text-loss transition-colors"
              >
                <Trash2 size={11} strokeWidth={1.8} />
                Clear all
              </button>
            )}
          </div>
        </div>

        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-pitch-700">
              {["Game", "Type", "Pick", "Odds", "Stake", "Break-even", "P&L", "Result", ""].map(h => (
                <th key={h} className="px-3 py-2.5 text-left pm-label">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayBets.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-pitch-500 text-sm">
                  {filterResult === "all" ? "No bets logged." : `No ${filterResult} bets.`}
                </td>
              </tr>
            )}
            <AnimatePresence>
              {displayBets.map(b => {
                const pl = calcPL(b.stake, b.odds, b.result);
                const be = (breakEven(b.odds) * 100).toFixed(1);
                const isEditing = editingId === b.id;

                return (
                  <motion.tr
                    key={b.id}
                    layout
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="border-b border-pitch-700 hover:bg-pitch-780 transition-colors"
                  >
                    <td className="px-3 py-2.5 font-medium text-pitch-100 max-w-[140px] truncate">{b.game}</td>
                    <td className="px-3 py-2.5 text-pitch-400 text-[11px]">{b.type}</td>
                    <td className="px-3 py-2.5 text-pitch-300 max-w-[120px] truncate">{b.pick}</td>
                    <td className="px-3 py-2.5 font-mono text-pitch-300 text-[12px]">
                      {b.odds > 0 ? "+" : ""}{b.odds}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-pitch-300">${b.stake}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-pitch-500">{be}%</td>
                    <td className={`px-3 py-2.5 font-mono font-medium
                      ${b.result === "pending" ? "text-pitch-500"
                        : pl > 0 ? "text-win" : pl < 0 ? "text-loss" : "text-pitch-400"}`}>
                      {b.result === "pending" ? "—" : formatCurrency(pl)}
                    </td>
                    <td className="px-3 py-2.5">
                      {isEditing ? (
                        <div className="flex flex-wrap gap-1 items-center">
                          {RESULT_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => updateResult(b.id, opt.value)}
                              className={`pm-badge border cursor-pointer transition-all hover:scale-105
                                ${b.result === opt.value ? "ring-1 ring-accent/40" : ""}
                                ${opt.cls}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-pitch-600 hover:text-pitch-300 transition-colors ml-0.5"
                          >
                            <X size={12} strokeWidth={1.8} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingId(b.id)}
                          title="Click to update result"
                          className={`pm-badge border cursor-pointer hover:brightness-125 transition-all
                            ${b.result === "win" ? "bg-win/10  text-win  border-win/20"
                              : b.result === "loss" ? "bg-loss/10 text-loss border-loss/20"
                                : b.result === "push" ? "bg-draw/10 text-draw border-draw/20"
                                  : "bg-pitch-750 text-pitch-500 border-pitch-600"}`}
                        >
                          {b.result.toUpperCase()}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => deleteBet(b.id)}
                        className="text-pitch-600 hover:text-loss transition-colors p-0.5 rounded"
                        title="Delete bet"
                      >
                        <X size={13} strokeWidth={1.8} />
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* ── Cumulative P&L chart ─────────────────────────────── */}
      {chartData.length >= 2 && (
        <div className="pm-card p-4 mb-4">
          <div className="pm-label mb-3">Cumulative P&amp;L</div>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="plGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="plGradNeg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="bet" tick={{ fill: "#546480", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#546480", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <ReferenceLine y={0} stroke="#2e3a50" strokeDasharray="4 4" />
                <Tooltip
                  {...tooltipStyle}
                  formatter={v => [formatCurrency(v), "P&L"]}
                />
                <Area
                  type="monotone"
                  dataKey="pl"
                  stroke="#00d4aa"
                  strokeWidth={2}
                  fill={chartData[chartData.length - 1]?.pl >= 0 ? "url(#plGrad)" : "url(#plGradNeg)"}
                  dot={{ fill: "#00d4aa", r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#00d4aa", stroke: "#0a0b0d", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Win rate by bet type ─────────────────────────────── */}
      {typeBreakdown.length >= 2 && (
        <div className="pm-card p-4">
          <div className="pm-label mb-3">Win rate by bet type</div>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeBreakdown} barCategoryGap="28%">
                <XAxis dataKey="type" tick={{ fill: "#546480", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "#546480", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <ReferenceLine y={52.4} stroke="#3d4f6a" strokeDasharray="4 4" label={{ value: "break-even", fill: "#3d4f6a", fontSize: 9, position: "right" }} />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v, _n, props) => [
                    `${v}%  (${props.payload.count} bets · ${formatCurrency(props.payload.pl)})`,
                    "Win rate",
                  ]}
                />
                <Bar dataKey="winRate" radius={[4, 4, 0, 0]}>
                  {typeBreakdown.map(entry => (
                    <Cell
                      key={entry.type}
                      fill={entry.winRate >= 55 ? "#00d4aa" : entry.winRate >= 45 ? "#f59e0b" : "#ef4444"}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-3">
            {typeBreakdown.map(t => (
              <div key={t.type} className="flex items-center gap-1.5 text-[10px]">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: t.winRate >= 55 ? "#00d4aa" : t.winRate >= 45 ? "#f59e0b" : "#ef4444" }}
                />
                <span className="text-pitch-400">{t.type}:</span>
                <span className={`pm-number font-medium ${t.winRate >= 55 ? "text-win" : t.winRate >= 45 ? "text-draw" : "text-loss"}`}>
                  {t.winRate}%
                </span>
                <span className={`pm-number ${t.pl >= 0 ? "text-win/70" : "text-loss/70"}`}>
                  {formatCurrency(t.pl)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}