import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, BarChart, Bar, Cell, ReferenceLine,
} from "recharts";
import {
  ArrowUpDown, Download, Trash2, Plus, ChevronUp, ChevronDown,
  TrendingUp, Shield, DollarSign, Target, X, Info,
  Zap, ExternalLink, AlertTriangle, CheckCircle,
} from "lucide-react";
import { TEAM_NAMES, ODDS_GAMES, TEAM_COLORS } from "../data";
import { useStandings, useTodayGames, useOdds, mergeOddsIntoGames, useBets } from "../api";
import {
  calcPL, lsGet, lsSet,
  formatCurrency, formatPct, kellyBet, DEFAULT_BANKROLL,
  calcROI, breakEven, oddsToImplied,
} from "../utils";
import { TileSkeleton, RowSkeleton, ErrorState, FreshnessTag, EmptyState, useToast } from "./ui";

// ── Shared animation + tooltip config ────────────────────────────
const container = { hidden: {}, show: { transition: { staggerChildren: 0.035 } } };
const item = {
  hidden: { opacity: 0, y: 8 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const tooltipStyle = {
  contentStyle: {
    background: "#161b28", border: "1px solid #2e3a50",
    borderRadius: 8, fontSize: 11, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
  },
  labelStyle: { color: "#7d91ab" },
  itemStyle:  { color: "#00d4aa" },
};

// ── Book display names ────────────────────────────────────────────
const BOOK_LABELS = {
  draftkings:  "DraftKings",
  fanduel:     "FanDuel",
  betmgm:      "BetMGM",
  caesars:     "Caesars",
  pointsbet:   "PointsBet",
  betrivers:   "BetRivers",
  espnbet:     "ESPN Bet",
  bet365:      "Bet365",
};

// ═══════════════════════════════════════════════════════════════════
// SCORES
// ═══════════════════════════════════════════════════════════════════
export function Scores() {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter]     = useState("all");
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
    all:       games.length,
    live:      games.filter(g => g.status === "live").length,
    final:     games.filter(g => g.status === "final").length,
    scheduled: games.filter(g => g.status === "scheduled").length,
  }), [games]);

  return (
    <motion.div variants={container} initial="hidden" animate="show" exit={{ opacity: 0, y: -4 }}>
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
          { id: "all",       label: "All" },
          { id: "live",      label: "Live",     dot: true },
          { id: "scheduled", label: "Upcoming" },
          { id: "final",     label: "Final" },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all
              ${filter === f.id
                ? "bg-accent/15 text-accent border border-accent/30"
                : "bg-pitch-800 text-pitch-400 border border-pitch-600 hover:border-pitch-500 hover:text-pitch-300"}`}
          >
            {f.dot && counts.live > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-win animate-live-pulse" />
            )}
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
          description={filter === "all" ? "Check back later." : "Try a different filter."}
          icon={Target}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(g => {
            const fav = g.homeP >= g.awayP ? "home" : "away";
            const isSelected = selected === g.id;
            const isFinal    = g.status === "final";
            const isLive     = g.status === "live";
            const awayColor  = TEAM_COLORS[g.away] || "#546480";
            const homeColor  = TEAM_COLORS[g.home] || "#546480";

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
                  <div className="flex items-center gap-1.5">
                    {isFinal && (
                      <span className="pm-badge bg-pitch-700 text-pitch-400 border border-pitch-600">Final</span>
                    )}
                    {isLive && (
                      <span className="pm-badge bg-win/10 text-win border border-win/20 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-win animate-live-pulse inline-block" />
                        {g.period ? `Q${g.period}` : "Live"}
                      </span>
                    )}
                    {g.status === "scheduled" && (
                      <span className="pm-badge bg-pitch-750 text-pitch-400 border border-pitch-600">
                        {g.spread !== "—" ? g.spread : "Tonight"}
                      </span>
                    )}
                    {g.isArb && (
                      <span className="pm-badge bg-win/15 text-win border border-win/30 flex items-center gap-0.5">
                        <Zap size={8} /> ARB
                      </span>
                    )}
                  </div>
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
                    <div className="text-[10px] text-pitch-500 mt-0.5 truncate">
                      {TEAM_NAMES[g.away] || g.away}
                    </div>
                    {(isFinal || isLive) && (
                      <motion.div key={g.awayScore} initial={{ scale: 1.08 }} animate={{ scale: 1 }}
                        className="pm-number text-xl mt-1 text-pitch-100">
                        {g.awayScore}
                      </motion.div>
                    )}
                    {/* Best odds book hint */}
                    {g.status === "scheduled" && g.bestAwayBook && (
                      <div className="text-[9px] text-pitch-600 mt-0.5 font-mono">
                        Best: {BOOK_LABELS[g.bestAwayBook] || g.bestAwayBook}
                        {g.bestAwayOdds && (
                          <span className="text-pitch-400 ml-1">
                            {g.bestAwayOdds > 0 ? "+" : ""}{g.bestAwayOdds}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="text-center flex-shrink-0">
                    <div className="text-[10px] text-pitch-600 font-mono">
                      {isFinal || isLive ? "—" : "vs"}
                    </div>
                    {g.total !== "—" && (
                      <div className="text-[9px] text-pitch-600 mt-0.5">O/U {g.total}</div>
                    )}
                    {g.bookCount && (
                      <div className="text-[9px] text-pitch-700 mt-0.5">{g.bookCount} books</div>
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
                    <div className="text-[10px] text-pitch-500 mt-0.5 truncate text-right">
                      {TEAM_NAMES[g.home] || g.home}
                    </div>
                    {(isFinal || isLive) && (
                      <motion.div key={g.homeScore} initial={{ scale: 1.08 }} animate={{ scale: 1 }}
                        className="pm-number text-xl mt-1 text-pitch-100 text-right">
                        {g.homeScore}
                      </motion.div>
                    )}
                    {g.status === "scheduled" && g.bestHomeBook && (
                      <div className="text-[9px] text-pitch-600 mt-0.5 font-mono text-right">
                        Best: {BOOK_LABELS[g.bestHomeBook] || g.bestHomeBook}
                        {g.bestHomeOdds && (
                          <span className="text-pitch-400 ml-1">
                            {g.bestHomeOdds > 0 ? "+" : ""}{g.bestHomeOdds}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Probability bar */}
                {g.status === "scheduled" && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-pitch-500">
                      <span className="font-mono">{g.awayP != null ? `${g.awayP}%` : "—"}</span>
                      <span className="font-mono">{g.homeP != null ? `${g.homeP}%` : "—"}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-pitch-700 overflow-hidden relative">
                      <motion.div
                        className="h-full absolute top-0 left-0 rounded-full"
                        style={{ background: awayColor, opacity: 0.8 }}
                        initial={{ width: 0 }}
                        animate={{ width: `${g.awayP ?? 0}%` }}
                        transition={{ duration: 0.8 }}
                      />
                    </div>
                  </div>
                )}

                {/* Expanded: odds detail + book breakdown */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-3 border-t border-pitch-700">
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="bg-pitch-750 rounded-md p-2">
                            <div className="text-[9px] text-pitch-500 uppercase tracking-wide mb-0.5">Spread</div>
                            <div className="pm-number text-sm text-pitch-200">{g.spread}</div>
                          </div>
                          <div className="bg-pitch-750 rounded-md p-2">
                            <div className="text-[9px] text-pitch-500 uppercase tracking-wide mb-0.5">Over/Under</div>
                            <div className="pm-number text-sm text-pitch-200">{g.total}</div>
                          </div>
                        </div>

                        {/* Per-book odds breakdown */}
                        {g.books && g.books.length > 0 && (
                          <div>
                            <div className="pm-label mb-1.5">Line shopping</div>
                            <div className="space-y-1">
                              {g.books.map((bk, i) => {
                                const isBestHome = bk.book === g.bestHomeBook;
                                return (
                                  <div key={bk.book}
                                    className={`flex items-center justify-between px-2 py-1.5 rounded
                                      text-[10px] ${isBestHome ? "bg-win/8 border border-win/15" : "bg-pitch-750"}`}
                                  >
                                    <span className={`font-medium ${isBestHome ? "text-win" : "text-pitch-300"}`}>
                                      {BOOK_LABELS[bk.book] || bk.book}
                                      {isBestHome && <span className="ml-1 text-[8px] text-win/70">★ best</span>}
                                    </span>
                                    <div className="flex items-center gap-3 font-mono">
                                      <span className="text-pitch-400">
                                        {g.away} {bk.awayOdds > 0 ? "+" : ""}{bk.awayOdds}
                                      </span>
                                      <span className="text-pitch-600">|</span>
                                      <span className={isBestHome ? "text-win" : "text-pitch-300"}>
                                        {g.home} {bk.homeOdds > 0 ? "+" : ""}{bk.homeOdds}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Arbitrage alert */}
                        {g.isArb && (
                          <div className="mt-2.5 px-3 py-2 rounded-md bg-win/8 border border-win/20 flex items-start gap-2">
                            <Zap size={11} className="text-win flex-shrink-0 mt-0.5" />
                            <div className="text-[10px] text-win leading-relaxed">
                              <span className="font-semibold">Arbitrage opportunity!</span>
                              {" "}Best lines across books guarantee{" "}
                              <span className="font-mono font-semibold">+{g.arbPct}%</span>
                              {" "}profit regardless of outcome.
                            </div>
                          </div>
                        )}
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
  const [conf, setConf]       = useState("east");
  const [sortKey, setSortKey] = useState("pct");
  const [sortDir, setSortDir] = useState("desc");
  const { data, isLoading, isError, isFetching, refetch, dataUpdatedAt } = useStandings();

  const rawTeams = conf === "east" ? (data?.east || []) : (data?.west || []);

  const teams = useMemo(() => {
    return [...rawTeams].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [rawTeams, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return <ArrowUpDown size={10} className="text-pitch-700 ml-0.5" />;
    return sortDir === "desc"
      ? <ChevronDown size={10} className="text-accent ml-0.5" />
      : <ChevronUp size={10} className="text-accent ml-0.5" />;
  };

  const headers = [
    { key: null,     label: "#",      sortable: false },
    { key: "team",   label: "Team",   sortable: false },
    { key: "w",      label: "W",      sortable: true },
    { key: "l",      label: "L",      sortable: true },
    { key: "pct",    label: "PCT",    sortable: true },
    { key: "gb",     label: "GB",     sortable: true },
    { key: "last10", label: "L10",    sortable: false },
    { key: "home",   label: "HOME",   sortable: false },
    { key: "road",   label: "ROAD",   sortable: false },
    { key: "streak", label: "STREAK", sortable: false },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-1.5">
          {[["east", "Eastern"], ["west", "Western"]].map(([id, label]) => (
            <button key={id} onClick={() => setConf(id)}
              className={`pm-tab ${conf === id ? "active" : ""}`}>
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
            <table className="w-full text-sm min-w-[700px]">
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
                  const origRank = rawTeams.findIndex(rt => rt.team === t.team);
                  const isPlayIn  = origRank >= 6 && origRank <= 9;
                  const isFirst   = origRank === 0;
                  const isPlayoff = origRank < 6;

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
                          <div className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: TEAM_COLORS[t.team] || "#546480" }} />
                          <span className={`font-display text-base tracking-wider
                            ${isFirst ? "text-accent" : isPlayoff ? "text-pitch-200" : "text-pitch-400"}`}>
                            {t.team}
                          </span>
                          {isPlayIn && (
                            <span className="text-[9px] text-draw border border-draw/30
                                             bg-draw/10 px-1.5 py-0.5 rounded">
                              play-in
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-pitch-200 font-medium">{t.w}</td>
                      <td className="px-3 py-2.5 font-mono text-pitch-400">{t.l}</td>
                      <td className="px-3 py-2.5 font-mono text-pitch-300">{(t.pct || 0).toFixed(3).replace(/^0/, '')}</td>
                      <td className="px-3 py-2.5 font-mono text-pitch-500 text-[11px]">
                        {t.gb === 0 ? "—" : t.gb}
                      </td>
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
              <span className="pm-badge text-draw border border-draw/30 bg-draw/10 text-[8px]">
                play-in
              </span>
              Ranks 7–10 = play-in tournament
            </span>
          </div>
        </>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// BETTING — multi-book line shopping + arbitrage
// ═══════════════════════════════════════════════════════════════════
export function Betting() {
  const [expandedCard, setExpandedCard] = useState(null);
  const { data: rawGames }    = useTodayGames();
  const { data: oddsData, isFetching: oddsFetching, dataUpdatedAt: oddsUpdatedAt } = useOdds();
  const { data: standingsData, isFetching: standingsFetching } = useStandings();

  const [bankroll, setBankrollState] = useState(() => Number(lsGet("bankroll")) || DEFAULT_BANKROLL);
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.detail?.key?.includes("bankroll")) setBankrollState(Number(lsGet("bankroll")) || DEFAULT_BANKROLL);
    };
    window.addEventListener("plusminus:storage", handleStorage);
    return () => window.removeEventListener("plusminus:storage", handleStorage);
  }, []);
  const updateBankroll = (val) => {
    if (val < 1) val = 1;
    setBankrollState(val);
    lsSet("bankroll", val);
  };

  // Build edge cards from live multi-book odds
  const liveEdges = useMemo(() => {
    if (!oddsData || !standingsData || !rawGames) return null;

    const allTeams  = [...(standingsData.east || []), ...(standingsData.west || [])];
    const teamPct   = {};
    allTeams.forEach(t => { teamPct[t.team] = { pct: t.pct, games: t.w + t.l }; });

    const edges = [];
    for (const game of (rawGames || []).filter(g => g.status === "scheduled")) {
      const key  = `${game.away}@${game.home}`;
      const odds = oddsData[key];
      if (!odds) continue;

      const fav       = odds.homeP >= odds.awayP ? game.home : game.away;
      const dog       = fav === game.home ? game.away : game.home;
      const impliedP  = Math.max(odds.homeP, odds.awayP);
      const favStats  = teamPct[fav];
      const modelP    = (favStats?.games ?? 0) >= 10
        ? +(favStats.pct * 100).toFixed(1) : null;
      const diff      = modelP !== null ? +(modelP - impliedP).toFixed(1) : null;
      const edge      = diff !== null ? (diff >= 10 ? "high" : diff >= 5 ? "mid" : "low") : "none";
      const favOdds   = (fav === game.home ? odds.bestHomeOdds : odds.bestAwayOdds) ?? -110;
      const kellyAmt  = diff !== null && diff >= 5
        ? kellyBet(modelP / 100, favOdds, bankroll) : null;

      edges.push({
        matchup:    `${game.away} @ ${game.home}`,
        away:       game.away,
        home:       game.home,
        fav, dog,
        modelP,
        impliedP:   +impliedP.toFixed(1),
        consHomeP:  odds.consHomeP,
        consAwayP:  odds.consAwayP,
        diff, edge, kellyAmt,
        spread:     game.spread,
        total:      game.total,
        // Multi-book data
        books:      odds.books || [],
        bookCount:  odds.bookCount || 0,
        isArb:      odds.isArb || false,
        arbPct:     odds.arbPct || 0,
        bestHomeBook: odds.bestHomeBook,
        bestAwayBook: odds.bestAwayBook,
        bestHomeOdds: odds.bestHomeOdds,
        bestAwayOdds: odds.bestAwayOdds,
        favOdds,
      });
    }

    return edges.sort((a, b) => {
      const order = { high: 0, mid: 1, low: 2, none: 3 };
      // Arb opportunities always first
      if (a.isArb && !b.isArb) return -1;
      if (!a.isArb && b.isArb) return 1;
      return order[a.edge] - order[b.edge];
    });
  }, [oddsData, standingsData, rawGames]);

  const isLive     = !!(liveEdges && liveEdges.length > 0);
  const hasOddsKey = !!(oddsData && Object.keys(oddsData).length > 0);
  const displayCards = isLive ? liveEdges : ODDS_GAMES;
  const arbCount   = isLive ? liveEdges.filter(e => e.isArb).length : 0;

  return (
    <motion.div variants={container} initial="hidden" animate="show" exit={{ opacity: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="pm-label">
              {isLive ? "Live market edges" : "Sample edge data"}
            </div>
            {arbCount > 0 && (
              <span className="pm-badge bg-win/15 text-win border border-win/30 flex items-center gap-1">
                <Zap size={9} />
                {arbCount} arb{arbCount > 1 ? "s" : ""} detected
              </span>
            )}
          </div>
          {isLive && (
            <div className="text-[10px] text-pitch-500 mt-0.5">
              {liveEdges.length} games · best lines across {
                Math.max(...liveEdges.map(e => e.bookCount || 0))
              } books
            </div>
          )}
        </div>
        <FreshnessTag isFetching={oddsFetching || standingsFetching} dataUpdatedAt={oddsUpdatedAt} />
      </div>

      {/* API key banner */}
      {!hasOddsKey && (
        <motion.div variants={item}
          className="mb-4 px-3.5 py-3 rounded-lg border border-draw/20 bg-draw/5 flex items-start gap-2.5">
          <Info size={13} className="text-draw flex-shrink-0 mt-0.5" strokeWidth={1.8} />
          <div className="text-[11px] text-pitch-400 leading-relaxed">
            <span className="text-pitch-200 font-medium">Sample data shown.</span>
            {" "}Set <code className="font-mono text-pitch-300 bg-pitch-700 px-1 py-0.5 rounded text-[10px]">
              ODDS_API_KEY
            </code> in Vercel environment variables for live multi-book odds.
          </div>
        </motion.div>
      )}

      {/* Edge cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        {displayCards.map((g, idx) => {
          const diff = isLive ? g.diff : (g.modelP - g.impliedP);
          const edge = g.edge;
          const isExpanded  = expandedCard === idx;
          const favColor    = TEAM_COLORS[g.fav] || "#546480";

          const edgeMeta = {
            high: { label: "★ HIGH EDGE", cls: "text-win border-win/30 bg-win/10" },
            mid:  { label: "MOD EDGE",    cls: "text-draw border-draw/30 bg-draw/10" },
            low:  { label: "SMALL",       cls: "text-pitch-400 border-pitch-600 bg-pitch-750" },
            none: { label: "N/A",         cls: "text-pitch-600 border-pitch-700 bg-pitch-800" },
          }[edge] || { label: "LOW", cls: "text-pitch-400 border-pitch-600 bg-pitch-750" };

          return (
            <motion.div key={g.matchup + idx} variants={item} className="pm-tile p-4">
              {/* Arb banner */}
              {g.isArb && (
                <div className="mb-3 px-2.5 py-2 rounded-md bg-win/10 border border-win/25 flex items-center gap-2">
                  <Zap size={11} className="text-win flex-shrink-0" />
                  <span className="text-[10px] text-win font-medium">
                    Arbitrage: guaranteed +{g.arbPct}% across books
                  </span>
                </div>
              )}

              {/* Card header */}
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-pitch-100 truncate">{g.matchup}</div>
                  <div className="text-[10px] text-pitch-500 mt-0.5 flex items-center gap-1.5">
                    <span>Fav:</span>
                    <span className="font-medium" style={{ color: favColor }}>{g.fav}</span>
                    {g.bookCount > 0 && (
                      <span className="text-pitch-700">· {g.bookCount} books</span>
                    )}
                  </div>
                </div>
                <span className={`pm-badge border ml-2 flex-shrink-0 ${edgeMeta.cls}`}>
                  {edgeMeta.label}
                </span>
              </div>

              {/* Stats */}
              <div className="space-y-2 mb-3">
                {[
                  {
                    label: "Model prob",
                    value: g.modelP !== null ? `${g.modelP}%` : "—",
                    cls: "text-pitch-100",
                  },
                  {
                    label: "Market (best line)",
                    value: `${g.impliedP}%`,
                    cls: "text-pitch-300",
                  },
                  g.consHomeP != null ? {
                    label: "Market (consensus)",
                    value: `${Math.max(g.consHomeP ?? 0, g.consAwayP ?? 0)}%`,
                    cls: "text-pitch-500",
                  } : null,
                  {
                    label: "Edge",
                    value: diff != null ? (diff > 0 ? `+${diff}%` : `${diff}%`) : "—",
                    cls: diff == null ? "text-pitch-600"
                       : diff >= 10   ? "text-win font-semibold"
                       : diff >= 5    ? "text-draw font-semibold"
                       : "text-pitch-400",
                  },
                ].filter(Boolean).map(s => (
                  <div key={s.label} className="flex justify-between items-center text-[11px]">
                    <span className="text-pitch-500">{s.label}</span>
                    <span className={`pm-number ${s.cls}`}>{s.value}</span>
                  </div>
                ))}
              </div>

              {/* Edge bar */}
              {diff != null && diff > 0 && (
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

              {/* Kelly */}
              {isLive && g.kellyAmt > 0 && (
                <div className="mb-3 px-2.5 py-2 rounded-md bg-pitch-750 border border-pitch-700">
                  <div className="flex items-center gap-1.5 text-[10px] text-pitch-400">
                    <Shield size={10} className="text-accent flex-shrink-0" />
                    <span>½-Kelly: <span className="text-accent font-mono font-medium">
                      ${g.kellyAmt}
                    </span></span>
                    <span className="text-pitch-600 flex items-center gap-1">
                      on 
                      <input type="number" value={bankroll} onChange={e => updateBankroll(Number(e.target.value))} className="bg-transparent w-12 text-pitch-300 border-b border-pitch-600 focus:outline-none focus:border-accent font-mono px-0.5 py-0 placeholder-pitch-600" aria-label="Bankroll amount" />
                      at {g.favOdds > 0 ? `+${g.favOdds}` : g.favOdds}
                    </span>
                  </div>
                </div>
              )}

              {/* Best lines summary */}
              {isLive && g.bestHomeOdds && (
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <div className="px-2 py-1.5 rounded bg-pitch-750 border border-pitch-700">
                    <div className="text-[9px] text-pitch-600 mb-0.5">
                      {g.away} · {BOOK_LABELS[g.bestAwayBook] || g.bestAwayBook}
                    </div>
                    <div className={`font-mono text-xs font-semibold ${
                      g.bestAwayOdds > 0 ? "text-win" : "text-pitch-200"}`}>
                      {g.bestAwayOdds > 0 ? "+" : ""}{g.bestAwayOdds}
                    </div>
                  </div>
                  <div className="px-2 py-1.5 rounded bg-pitch-750 border border-pitch-700">
                    <div className="text-[9px] text-pitch-600 mb-0.5">
                      {g.home} · {BOOK_LABELS[g.bestHomeBook] || g.bestHomeBook}
                    </div>
                    <div className={`font-mono text-xs font-semibold ${
                      g.bestHomeOdds > 0 ? "text-win" : "text-pitch-200"}`}>
                      {g.bestHomeOdds > 0 ? "+" : ""}{g.bestHomeOdds}
                    </div>
                  </div>
                </div>
              )}

              {/* Expand toggle for per-book breakdown */}
              {isLive && g.books?.length > 0 && (
                <>
                  <button
                    onClick={() => setExpandedCard(isExpanded ? null : idx)}
                    className="w-full flex items-center justify-between text-[10px]
                               text-pitch-500 hover:text-pitch-300 transition-colors
                               border-t border-pitch-700 pt-2.5 mt-2.5"
                  >
                    <span>All {g.books.length} books</span>
                    {isExpanded
                      ? <ChevronUp size={11} />
                      : <ChevronDown size={11} />
                    }
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 space-y-1">
                          {g.books.map(bk => {
                            const isBestHome = bk.book === g.bestHomeBook;
                            const isBestAway = bk.book === g.bestAwayBook;
                            return (
                              <div
                                key={bk.book}
                                className={`flex items-center justify-between px-2 py-1.5 rounded text-[10px]
                                  ${isBestHome || isBestAway
                                    ? "bg-win/8 border border-win/15"
                                    : "bg-pitch-800"}`}
                              >
                                <span className={`font-medium w-24 truncate ${
                                  isBestHome || isBestAway ? "text-win" : "text-pitch-400"}`}>
                                  {BOOK_LABELS[bk.book] || bk.book}
                                </span>
                                <div className="flex items-center gap-4 font-mono">
                                  <span className={isBestAway ? "text-win" : "text-pitch-400"}>
                                    {g.away}{" "}
                                    {bk.awayOdds != null
                                      ? `${bk.awayOdds > 0 ? "+" : ""}${bk.awayOdds}`
                                      : "—"}
                                  </span>
                                  <span className={isBestHome ? "text-win" : "text-pitch-300"}>
                                    {g.home}{" "}
                                    {bk.homeOdds != null
                                      ? `${bk.homeOdds > 0 ? "+" : ""}${bk.homeOdds}`
                                      : "—"}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}

              {/* Footer */}
              <div className="border-t border-pitch-700 pt-2.5 mt-2.5 flex justify-between text-[10px] text-pitch-500">
                <span>{g.spread}</span>
                <span>O/U {g.total}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Methodology */}
      <motion.div variants={item} className="pm-card p-4 text-[11px] text-pitch-400 leading-relaxed">
        <span className="text-pitch-200 font-medium">How edges are calculated: </span>
        Model win% uses season win percentage (≥10 games) as a team strength proxy. Market implied
        probability uses the <span className="text-pitch-300 font-medium">best available line
        across all books</span> (DraftKings, FanDuel, BetMGM, Caesars, ESPN Bet, Bet365) with vig
        removed. Edge = model − best-line implied. Arbitrage is flagged when
        1/bestHomeDecimal + 1/bestAwayDecimal &lt; 1 across different books.{" "}
        <span className="text-pitch-600">Analytical tooling, not financial advice.</span>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// BET TRACKER
// ═══════════════════════════════════════════════════════════════════


function exportBetsCSV(bets) {
  const headers = "Date,Game,Type,Pick,Odds,Stake,Result,P&L,Break-even\n";
  const rows = bets.map(b => {
    const pl   = calcPL(b.stake, b.odds, b.result);
    const be   = (breakEven(b.odds) * 100).toFixed(1);
    const date = b.id > 1e12 ? new Date(b.id).toLocaleDateString("en-US") : "";
    return `"${date}","${b.game}","${b.type}","${b.pick}",${b.odds},${b.stake},${b.result},${
      b.result === "pending" ? "" : pl.toFixed(2)},${be}%`;
  }).join("\n");

  const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `plusminus-bets-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const RESULT_OPTIONS = [
  { value: "win",     label: "WIN",     cls: "bg-win/10  text-win  border-win/20"   },
  { value: "loss",    label: "LOSS",    cls: "bg-loss/10 text-loss border-loss/20"  },
  { value: "push",    label: "PUSH",    cls: "bg-draw/10 text-draw border-draw/20"  },
  { value: "pending", label: "PENDING", cls: "bg-pitch-750 text-pitch-500 border-pitch-600" },
];

export function BetTracker() {
  const { bets: savedBets, isLoading: betsLoading, saveBets } = useBets();
  const [bets,         setBets]         = useState([]);
  const [form,         setForm]         = useState({
    game: "", type: "Moneyline", pick: "", odds: "", stake: "", result: "pending",
  });
  const [formError,    setFormError]    = useState("");
  const [editingId,    setEditingId]    = useState(null);
  const [filterResult, setFilterResult] = useState("all");
  const toast = useToast();

  useEffect(() => {
    if (savedBets.length > 0 || !betsLoading) setBets(savedBets);
  }, [savedBets, betsLoading]);

  const addBet = useCallback(() => {
    const { game, pick, odds, stake } = form;
    if (!game.trim() || !pick.trim() || !odds || !stake) {
      setFormError("Game, Pick, Odds, and Stake are required."); return;
    }
    const oddsNum = parseFloat(odds);
    if (isNaN(oddsNum) || oddsNum === 0) {
      setFormError("Odds must be a valid number (e.g. -110 or +150)."); return;
    }
    if (parseFloat(stake) <= 0) {
      setFormError("Stake must be greater than $0."); return;
    }
    setFormError("");
    const newBets = [{
      ...form, id: Date.now(), odds: oddsNum, stake: parseFloat(stake),
    }, ...bets];
    setBets(newBets);
    saveBets(newBets);
    setForm({ game: "", type: "Moneyline", pick: "", odds: "", stake: "", result: "pending" });
    toast.success("Bet logged!");
  }, [form, toast, bets, saveBets]);

  const deleteBet = id => {
    const newBets = bets.filter(b => b.id !== id);
    setBets(newBets);
    saveBets(newBets);
  };
  const updateResult = (id, r) => {
    const newBets = bets.map(b => b.id === id ? { ...b, result: r } : b);
    setBets(newBets);
    saveBets(newBets);
    setEditingId(null);
    toast.success("Result updated.");
  };
  const clearAll = () => {
    if (window.confirm("Clear all bets? This cannot be undone.")) {
      setBets([]);
      saveBets([]); 
      toast.info("Bet log cleared.");
    }
  };

  const stats = useMemo(() => {
    const decisive  = bets.filter(b => b.result === "win" || b.result === "loss");
    const wins      = bets.filter(b => b.result === "win").length;
    const totalPL   = bets.reduce((s, b) => s + calcPL(b.stake, b.odds, b.result), 0);
    const totalStake = decisive.reduce((s, b) => s + b.stake, 0);
    const roi       = calcROI(totalPL, totalStake);
    const winRate   = decisive.length > 0 ? ((wins / decisive.length) * 100).toFixed(1) + "%" : "—";
    return {
      totalPL, roi, winRate, pending: bets.filter(b => b.result === "pending").length,
      wins, losses: decisive.length - wins,
    };
  }, [bets]);

  const chartData = useMemo(() => {
    let running = 0;
    return [...bets].filter(b => b.result !== "pending").reverse().map((b, i) => {
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

  const displayBets = filterResult === "all" ? bets : bets.filter(b => b.result === filterResult);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {[
          { lbl: "Total Bets", val: bets.length,                                         cls: "text-pitch-50"  },
          { lbl: "Win Rate",   val: stats.winRate,                                       cls: "text-pitch-50"  },
          { lbl: "Net P&L",    val: formatCurrency(stats.totalPL),                       cls: stats.totalPL >= 0 ? "text-win" : "text-loss" },
          { lbl: "ROI",        val: `${stats.roi >= 0 ? "+" : ""}${stats.roi.toFixed(1)}%`, cls: stats.roi >= 0 ? "text-win" : "text-loss" },
          { lbl: "Pending",    val: stats.pending,                                        cls: "text-draw"      },
        ].map(m => (
          <div key={m.lbl} className="pm-tile p-4 text-center">
            <div className="pm-label mb-1.5">{m.lbl}</div>
            <div className={`pm-number font-medium text-2xl ${m.cls}`}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* Add bet form */}
      <div className="pm-card p-4 mb-4">
        <div className="pm-label mb-3">Log a bet</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
          <input className="pm-input col-span-2 sm:col-span-1"
            placeholder="Game (OKC @ BKN)"
            value={form.game}
            onChange={e => setForm(f => ({ ...f, game: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && addBet()} />
          <select className="pm-select" value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            {["Moneyline","Spread","Over/Under","Player prop","Parlay","Futures"].map(t => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input className="pm-input" placeholder="Pick (OKC -16)"
            value={form.pick}
            onChange={e => setForm(f => ({ ...f, pick: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && addBet()} />
          <input className="pm-input" placeholder="Odds (-110)" type="number"
            value={form.odds}
            onChange={e => setForm(f => ({ ...f, odds: e.target.value }))} />
          <input className="pm-input" placeholder="Stake ($)" type="number" min="0"
            value={form.stake}
            onChange={e => setForm(f => ({ ...f, stake: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && addBet()} />
          <select className="pm-select" value={form.result}
            onChange={e => setForm(f => ({ ...f, result: e.target.value }))}>
            {RESULT_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        {/* Inline calculator */}
        {form.odds && !isNaN(parseFloat(form.odds)) && (
          <div className="mb-3 text-[11px] text-pitch-500 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1">
              <TrendingUp size={10} />
              Break-even:{" "}
              <span className="text-pitch-300 font-mono">
                {(breakEven(parseFloat(form.odds)) * 100).toFixed(1)}%
              </span>
            </span>
            {form.stake && !isNaN(parseFloat(form.stake)) && (
              <span>
                Win payout:{" "}
                <span className="text-win font-mono">
                  {formatCurrency(calcPL(parseFloat(form.stake), parseFloat(form.odds), "win"))}
                </span>
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button onClick={addBet} className="pm-btn">
            <Plus size={13} strokeWidth={1.8} /> Add bet
          </button>
          {formError && (
            <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
              className="text-[11px] text-loss">
              {formError}
            </motion.span>
          )}
        </div>
      </div>

      {/* Bet log table */}
      <div className="pm-card overflow-x-auto mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-pitch-700">
          <div className="flex items-center gap-2">
            <span className="pm-label">Bet log</span>
            <span className="text-[10px] text-pitch-600">· {bets.length} entries</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1">
              {["all","win","loss","pending"].map(f => (
                <button key={f} onClick={() => setFilterResult(f)}
                  className={`text-[10px] px-2 py-1 rounded border transition-all
                    ${filterResult === f
                      ? f === "win"     ? "bg-win/10 text-win border-win/20"
                      : f === "loss"    ? "bg-loss/10 text-loss border-loss/20"
                      : f === "pending" ? "bg-draw/10 text-draw border-draw/20"
                      : "bg-accent/10 text-accent border-accent/20"
                      : "bg-pitch-750 text-pitch-500 border-pitch-700 hover:border-pitch-600"}`}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            {bets.length > 0 && (
              <button onClick={() => exportBetsCSV(bets)}
                className="flex items-center gap-1 text-[10px] text-pitch-400
                           hover:text-accent transition-colors">
                <Download size={11} strokeWidth={1.8} /> Export CSV
              </button>
            )}
            {bets.length > 0 && (
              <button onClick={clearAll}
                className="flex items-center gap-1 text-[10px] text-pitch-500
                           hover:text-loss transition-colors">
                <Trash2 size={11} strokeWidth={1.8} /> Clear all
              </button>
            )}
          </div>
        </div>

        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-pitch-700">
              {["Game","Type","Pick","Odds","Stake","Break-even","P&L","Result",""].map(h => (
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
                const pl        = calcPL(b.stake, b.odds, b.result);
                const be        = (breakEven(b.odds) * 100).toFixed(1);
                const isEditing = editingId === b.id;

                return (
                  <motion.tr key={b.id} layout
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
                            <button key={opt.value} onClick={() => updateResult(b.id, opt.value)}
                              className={`pm-badge border cursor-pointer transition-all hover:scale-105
                                ${b.result === opt.value ? "ring-1 ring-accent/40" : ""} ${opt.cls}`}>
                              {opt.label}
                            </button>
                          ))}
                          <button onClick={() => setEditingId(null)}
                            className="text-pitch-600 hover:text-pitch-300 transition-colors ml-0.5">
                            <X size={12} strokeWidth={1.8} />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setEditingId(b.id)} title="Click to update"
                          className={`pm-badge border cursor-pointer hover:brightness-125 transition-all
                            ${b.result === "win"     ? "bg-win/10  text-win  border-win/20"
                            : b.result === "loss"    ? "bg-loss/10 text-loss border-loss/20"
                            : b.result === "push"    ? "bg-draw/10 text-draw border-draw/20"
                            : "bg-pitch-750 text-pitch-500 border-pitch-600"}`}>
                          {b.result.toUpperCase()}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => deleteBet(b.id)}
                        className="text-pitch-600 hover:text-loss transition-colors p-0.5 rounded">
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

      {/* Cumulative P&L chart */}
      {chartData.length >= 2 && (
        <div className="pm-card p-4 mb-4">
          <div className="pm-label mb-3">Cumulative P&L</div>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="plGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#00d4aa" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="plGradNeg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="bet" tick={{ fill: "#546480", fontSize: 10 }}
                  axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#546480", fontSize: 10 }}
                  axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <ReferenceLine y={0} stroke="#2e3a50" strokeDasharray="4 4" />
                <Tooltip {...tooltipStyle} formatter={v => [formatCurrency(v), "P&L"]} />
                <Area type="monotone" dataKey="pl" stroke="#00d4aa" strokeWidth={2}
                  fill={chartData.at(-1)?.pl >= 0 ? "url(#plGrad)" : "url(#plGradNeg)"}
                  dot={{ fill: "#00d4aa", r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#00d4aa", stroke: "#0a0b0d", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Win rate by bet type */}
      {typeBreakdown.length >= 2 && (
        <div className="pm-card p-4">
          <div className="pm-label mb-3">Win rate by bet type</div>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeBreakdown} barCategoryGap="28%">
                <XAxis dataKey="type" tick={{ fill: "#546480", fontSize: 10 }}
                  axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "#546480", fontSize: 10 }}
                  axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <ReferenceLine y={52.4} stroke="#3d4f6a" strokeDasharray="4 4"
                  label={{ value: "break-even", fill: "#3d4f6a", fontSize: 9, position: "right" }} />
                <Tooltip {...tooltipStyle}
                  formatter={(v, _n, props) => [
                    `${v}% (${props.payload.count} bets · ${formatCurrency(props.payload.pl)})`,
                    "Win rate",
                  ]} />
                <Bar dataKey="winRate" radius={[4, 4, 0, 0]}>
                  {typeBreakdown.map(e => (
                    <Cell key={e.type}
                      fill={e.winRate >= 55 ? "#00d4aa" : e.winRate >= 45 ? "#f59e0b" : "#ef4444"}
                      fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {typeBreakdown.map(t => (
              <div key={t.type} className="flex items-center gap-1.5 text-[10px]">
                <div className="w-2 h-2 rounded-full"
                  style={{ background: t.winRate >= 55 ? "#00d4aa" : t.winRate >= 45 ? "#f59e0b" : "#ef4444" }} />
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
