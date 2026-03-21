import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, BarChart, Bar, Cell, ReferenceLine,
} from "recharts";
import {
  ArrowUpDown, Download, Trash2, Plus, ChevronUp, ChevronDown,
  TrendingUp, Shield, DollarSign, Target, X, Info,
  Zap, ExternalLink, AlertTriangle, CheckCircle, Loader, Activity, Layers,
} from "lucide-react";
import { TEAM_NAMES, ODDS_GAMES, TEAM_COLORS } from "../data";
import { useStandings, useTodayGames, useOdds, mergeOddsIntoGames, useBets, usePlayerProps } from "../api";
import {
  calcPL, lsGet, lsSet,
  formatCurrency, formatPct, kellyBet, DEFAULT_BANKROLL,
  calcROI, breakEven, oddsToImplied,
} from "../utils";
import { TileSkeleton, RowSkeleton, ErrorState, FreshnessTag, EmptyState, useToast, TeamLink } from "./ui";

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
    timeZone: "America/New_York",
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
            const fav = (g.homeP === null || g.awayP === null) ? null : g.homeP >= g.awayP ? "home" : "away";
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
                    <TeamLink abbr={g.away}
                      className={`font-display text-2xl tracking-widest leading-none block
                        ${fav === "away" ? "" : "text-pitch-400"}`}
                      style={{ color: fav === "away" && fav !== null ? awayColor : undefined }}
                    >
                      {g.away}
                    </TeamLink>
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
                    <TeamLink abbr={g.home}
                      className={`font-display text-2xl tracking-widest leading-none block
                        ${fav === "home" ? "" : "text-pitch-400"}`}
                      style={{ color: fav === "home" && fav !== null ? homeColor : undefined }}
                    >
                      {g.home}
                    </TeamLink>
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
                          <TeamLink abbr={t.team} className={`font-display text-base tracking-wider block
                            ${isFirst ? "text-accent" : isPlayoff ? "text-pitch-200" : "text-pitch-400"}`}>
                            {t.team}
                          </TeamLink>
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
                            : t.streak?.startsWith("L")
                            ? "bg-loss/10 text-loss border border-loss/20"
                            : "bg-pitch-750 text-pitch-500 border-pitch-600"}`}>
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

    return edges
      .filter(e => e.modelP !== null)
      .sort((a, b) => {
      const order = { high: 0, mid: 1, low: 2, none: 3 };
      // Arb opportunities always first
      if (a.isArb && !b.isArb) return -1;
      if (!a.isArb && b.isArb) return 1;
      const catDiff = order[a.edge] - order[b.edge];
      if (catDiff !== 0) return catDiff;
      return (b.diff ?? 0) - (a.diff ?? 0);
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
              {isLive ? "Live Line Shopping" : "Sample Line Shopping"}
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

      {/* Methodology Disclaimer */}
      <motion.div variants={item} className="pm-card p-4 mb-4 border border-draw/30 bg-draw/5">
        <div className="flex items-start gap-2.5">
          <AlertCircle size={14} className="text-draw flex-shrink-0 mt-0.5" strokeWidth={2} />
          <div className="text-[11px] text-pitch-300 leading-relaxed">
            <span className="text-pitch-100 font-medium mb-1 block">Line Shopping & Edge Estimation</span>
            This tool is primarily for <strong className="text-pitch-100">line shopping</strong> across books to find the best available odds and arbitrage opportunities. <br/><br/>
            Currently, the "Model Prob" uses simple season win percentage (≥10 games) as a baseline proxy. 
            Because actual market lines aggressively price in rest, matchups, injuries, and travel, 
            <strong className="text-pitch-200"> relying purely on these estimated "Edge" calculations as a betting signal will likely result in systematic losses</strong>. 
            A robust, fully-featured predictive model is coming soon.
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// BET TRACKER
// ═══════════════════════════════════════════════════════════════════


const MARKET_LABELS = {
  player_points:        "Points",
  player_rebounds:      "Rebounds",
  player_assists:       "Assists",
  player_threes:        "3-Pointers",
  player_blocks_steals: "Blks+Stls",
};

const MARKET_KEYS = Object.keys(MARKET_LABELS);

// Signed american odds formatter  e.g. -110, +145
function fmtOdds(n) {
  if (n == null || !isFinite(n)) return "—";
  return n > 0 ? `+${n}` : `${n}`;
}

// ── PropsBrowser ─────────────────────────────────────────────────
// Shows today's prop markets, grouped by game → player → market.
// "Bet this" button pre-fills the add-bet form below.
function PropsBrowser({ onAddPropBet, bankroll }) {
  const { data: propsData, isLoading, isError } = usePlayerProps();
  const [selectedGame, setSelectedGame] = useState(null);
  const [selectedMarket, setSelectedMarket] = useState("player_points");
  const [expandedPlayer, setExpandedPlayer] = useState(null);

  const games = useMemo(() => {
    if (!propsData) return [];
    return Object.entries(propsData).map(([key, g]) => ({ key, ...g }));
  }, [propsData]);

  // Auto-select first game
  useEffect(() => {
    if (games.length > 0 && !selectedGame) setSelectedGame(games[0].key);
  }, [games, selectedGame]);

  const currentGame = games.find(g => g.key === selectedGame);
  const players = useMemo(() => {
    if (!currentGame) return [];
    return Object.values(currentGame.players)
      .filter(p => p.markets[selectedMarket])
      .sort((a, b) => {
        const la = a.markets[selectedMarket]?.line ?? 0;
        const lb = b.markets[selectedMarket]?.line ?? 0;
        return lb - la;
      });
  }, [currentGame, selectedMarket]);

  if (isLoading) {
    return (
      <div className="space-y-2 py-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 rounded-md bg-pitch-750 animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError || (!isLoading && games.length === 0)) {
    return (
      <div className="py-6 text-center">
        <Activity size={20} className="text-pitch-600 mx-auto mb-2" />
        <div className="text-[11px] text-pitch-500">
          {isError ? "Couldn't load prop lines." : "No prop lines available today."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Game picker */}
      <div className="flex gap-1.5 flex-wrap">
        {games.map(g => (
          <button
            key={g.key}
            onClick={() => { setSelectedGame(g.key); setExpandedPlayer(null); }}
            className={`px-2.5 py-1 rounded text-[10px] font-mono font-medium transition-all
              ${selectedGame === g.key
                ? "bg-accent/15 text-accent border border-accent/30"
                : "bg-pitch-750 text-pitch-400 border border-pitch-600 hover:border-pitch-500"}`}
          >
            {g.awayTeam}@{g.homeTeam}
          </button>
        ))}
      </div>

      {/* Market picker */}
      <div className="flex gap-1.5 flex-wrap">
        {MARKET_KEYS.map(mk => (
          <button
            key={mk}
            onClick={() => { setSelectedMarket(mk); setExpandedPlayer(null); }}
            className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all
              ${selectedMarket === mk
                ? "bg-pitch-700 text-pitch-100 border border-pitch-500"
                : "bg-pitch-800 text-pitch-500 border border-pitch-700 hover:text-pitch-300"}`}
          >
            {MARKET_LABELS[mk]}
          </button>
        ))}
      </div>

      {/* Player rows */}
      {players.length === 0 ? (
        <div className="py-4 text-center text-[11px] text-pitch-600">
          No lines for this market yet.
        </div>
      ) : (
        <div className="space-y-1">
          {players.map(player => {
            const m = player.markets[selectedMarket];
            const isExpanded = expandedPlayer === player.id;
            const bestOverImpl  = m.bestOverOdds  != null ? oddsToImplied(m.bestOverOdds)  : null;
            const bestUnderImpl = m.bestUnderOdds != null ? oddsToImplied(m.bestUnderOdds) : null;
            const kellyO = bestOverImpl && bankroll
              ? kellyBet(bestOverImpl, m.bestOverOdds, bankroll) : null;
            const kellyU = bestUnderImpl && bankroll
              ? kellyBet(bestUnderImpl, m.bestUnderOdds, bankroll) : null;

            return (
              <motion.div key={player.id} layout className="overflow-hidden">
                {/* Main row */}
                <div
                  onClick={() => setExpandedPlayer(isExpanded ? null : player.id)}
                  className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer
                    transition-colors text-[11px]
                    ${isExpanded
                      ? "bg-pitch-700 border border-pitch-600"
                      : "bg-pitch-800 border border-pitch-700 hover:border-pitch-600"}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-pitch-200 truncate">{player.name}</span>
                    {player.team && (
                      <span className="text-[9px] text-pitch-500 font-mono flex-shrink-0">{player.team}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-mono text-pitch-300">{m.line}</span>
                    <div className="flex gap-1.5">
                      <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded
                        ${m.bestOverOdds != null && m.bestOverOdds > 0
                          ? "bg-win/10 text-win border border-win/20"
                          : "bg-pitch-750 text-pitch-400 border border-pitch-600"}`}>
                        O {fmtOdds(m.bestOverOdds ?? m.overOdds)}
                      </span>
                      <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded
                        ${m.bestUnderOdds != null && m.bestUnderOdds > 0
                          ? "bg-win/10 text-win border border-win/20"
                          : "bg-pitch-750 text-pitch-400 border border-pitch-600"}`}>
                        U {fmtOdds(m.bestUnderOdds ?? m.underOdds)}
                      </span>
                    </div>
                    <ChevronDown
                      size={10}
                      className={`text-pitch-600 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </div>
                </div>

                {/* Expanded: book breakdown + bet buttons */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 py-2.5 bg-pitch-750 rounded-b-md border border-t-0 border-pitch-600 space-y-2.5">
                        {/* Kelly sizing hints */}
                        {(kellyO || kellyU) && (
                          <div className="flex gap-3 text-[9px] text-pitch-500">
                            {kellyO != null && kellyO > 0 && (
                              <span>Kelly Over: <span className="text-pitch-300 font-mono">{formatCurrency(kellyO)}</span></span>
                            )}
                            {kellyU != null && kellyU > 0 && (
                              <span>Kelly Under: <span className="text-pitch-300 font-mono">{formatCurrency(kellyU)}</span></span>
                            )}
                          </div>
                        )}

                        {/* Per-book lines */}
                        {m.books && m.books.length > 0 && (
                          <div className="space-y-1">
                            <div className="pm-label text-[9px] mb-1">Line shopping</div>
                            {m.books.map(bk => {
                              const isBestOver  = bk.book === m.bestOverBook;
                              const isBestUnder = bk.book === m.bestUnderBook;
                              return (
                                <div key={bk.book}
                                  className="flex items-center justify-between text-[10px] font-mono">
                                  <span className="text-pitch-500">{BOOK_LABELS[bk.book] || bk.book}</span>
                                  <div className="flex gap-3">
                                    <span className={isBestOver ? "text-win" : "text-pitch-400"}>
                                      O {fmtOdds(bk.overOdds)}
                                      {isBestOver && <span className="text-[8px] text-win/60 ml-0.5">★</span>}
                                    </span>
                                    <span className={isBestUnder ? "text-win" : "text-pitch-400"}>
                                      U {fmtOdds(bk.underOdds)}
                                      {isBestUnder && <span className="text-[8px] text-win/60 ml-0.5">★</span>}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Bet these buttons */}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddPropBet({
                                player: player.name,
                                playerTeam: player.team,
                                market: selectedMarket,
                                side: "over",
                                line: m.line,
                                odds: m.bestOverOdds ?? m.overOdds,
                                book: m.bestOverBook,
                                matchup: currentGame ? `${currentGame.awayTeam}@${currentGame.homeTeam}` : "",
                              });
                            }}
                            className="flex-1 py-1.5 rounded text-[10px] font-medium
                              bg-accent/10 text-accent border border-accent/25
                              hover:bg-accent/20 transition-colors"
                          >
                            + Bet Over
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddPropBet({
                                player: player.name,
                                playerTeam: player.team,
                                market: selectedMarket,
                                side: "under",
                                line: m.line,
                                odds: m.bestUnderOdds ?? m.underOdds,
                                book: m.bestUnderBook,
                                matchup: currentGame ? `${currentGame.awayTeam}@${currentGame.homeTeam}` : "",
                              });
                            }}
                            className="flex-1 py-1.5 rounded text-[10px] font-medium
                              bg-pitch-700 text-pitch-300 border border-pitch-600
                              hover:bg-pitch-650 transition-colors"
                          >
                            + Bet Under
                          </button>
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
    </div>
  );
}

// ── BetTracker (unified game + prop bets) ────────────────────────
export function BetTracker() {
  const toast    = useToast();
  const { bets, isLoading, isSaving, isDeleting, saveBets, deleteBet } = useBets();

  // ── tracker sub-tab: "log" | "props"
  const [trackerTab, setTrackerTab] = useState("log");

  // ── add-bet form
  const EMPTY_FORM = {
    type: "game",
    // game fields
    matchup: "", team: "",
    // prop fields
    player: "", playerTeam: "", market: "player_points", side: "over", line: "",
    // shared
    stake: "", odds: "", result: "pending", book: "", note: "",
  };
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [filterResult, setFilterResult] = useState("all");
  const [filterType, setFilterType]     = useState("all");

  // ── bankroll from localStorage (mirrors Betting view)
  const [bankroll, setBankrollState] = useState(() => {
    const stored = Number(lsGet("bankroll"));
    return Number.isFinite(stored) && stored > 0 ? stored : DEFAULT_BANKROLL;
  });

  useEffect(() => {
    const handleStorage = (e) => {
      if (e.detail?.key?.includes("bankroll")) {
        const stored = Number(lsGet("bankroll"));
        if (Number.isFinite(stored) && stored > 0) setBankrollState(stored);
      }
    };
    window.addEventListener("plusminus:storage", handleStorage);
    return () => window.removeEventListener("plusminus:storage", handleStorage);
  }, []);

  // ── Pre-fill form from prop browser "Bet this" button
  const handleAddPropBet = useCallback((prefill) => {
    setForm(f => ({
      ...EMPTY_FORM,
      type:       "prop",
      player:     prefill.player     ?? "",
      playerTeam: prefill.playerTeam ?? "",
      market:     prefill.market     ?? "player_points",
      side:       prefill.side       ?? "over",
      line:       String(prefill.line ?? ""),
      odds:       prefill.odds != null ? String(prefill.odds) : "",
      book:       prefill.book ?? "",
      matchup:    prefill.matchup ?? "",
      result:     "pending",
    }));
    setShowForm(true);
    setTrackerTab("log");
    // Scroll the form into view after render
    setTimeout(() => {
      document.getElementById("bet-form-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }, []);

  // ── Stats derived from bets
  const stats = useMemo(() => {
    if (!bets?.length) return null;
    const settled = bets.filter(b => b.result !== "pending");
    const wins    = settled.filter(b => b.result === "win");
    const losses  = settled.filter(b => b.result === "loss");
    const pushes  = settled.filter(b => b.result === "push");

    const totalStaked = settled.reduce((s, b) => s + (b.stake || 0), 0);
    const totalPL     = settled.reduce((s, b) => s + calcPL(b.odds, b.stake, b.result), 0);

    const gameBets = bets.filter(b => b.type !== "prop");
    const propBets = bets.filter(b => b.type === "prop");
    const propSettled = propBets.filter(b => b.result !== "pending");

    return {
      total:      bets.length,
      pending:    bets.filter(b => b.result === "pending").length,
      wins:       wins.length,
      losses:     losses.length,
      pushes:     pushes.length,
      totalPL,
      totalStaked,
      roi:        totalStaked > 0 ? calcROI(totalPL, totalStaked) : 0,
      winRate:    settled.length > 0 ? wins.length / settled.length : 0,
      gameBets:   gameBets.length,
      propBets:   propBets.length,
      propWins:   propSettled.filter(b => b.result === "win").length,
      propTotal:  propSettled.length,
    };
  }, [bets]);

  // ── Filtered list
  const filteredBets = useMemo(() => {
    if (!bets) return [];
    return [...bets]
      .filter(b => filterResult === "all" || b.result === filterResult)
      .filter(b => filterType   === "all" || (filterType === "prop" ? b.type === "prop" : b.type !== "prop"))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [bets, filterResult, filterType]);

  // ── Bankroll curve for chart
  const bankrollCurve = useMemo(() => {
    if (!bets?.length) return [];
    const sorted = [...bets]
      .filter(b => b.result !== "pending" && b.date)
      .sort((a, b) => a.date.localeCompare(b.date));
    let running = bankroll;
    return sorted.map((b, i) => {
      running += calcPL(b.odds, b.stake, b.result);
      return { i: i + 1, value: +running.toFixed(2), pl: +calcPL(b.odds, b.stake, b.result).toFixed(2) };
    });
  }, [bets, bankroll]);

  // ── Form submit
  const handleSubmit = () => {
    const stake = parseFloat(form.stake);
    const odds  = parseFloat(form.odds);
    if (!form.odds || isNaN(odds)) { toast.error("Enter valid odds."); return; }
    if (isNaN(stake) || stake < 0) { toast.error("Enter a valid stake."); return; }
    if (form.type === "prop") {
      if (!form.player.trim()) { toast.error("Enter player name."); return; }
      const line = parseFloat(form.line);
      if (isNaN(line)) { toast.error("Enter a valid line."); return; }
    }

    const newBet = {
      id:     crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      type:   form.type,
      stake, odds,
      result: form.result,
      date:   new Date().toISOString().slice(0, 10),
      ...(form.matchup.trim() && { matchup: form.matchup.trim() }),
      ...(form.note.trim()    && { note:    form.note.trim() }),
      ...(form.book.trim()    && { book:    form.book.trim() }),
      ...(form.team.trim()    && form.type !== "prop" && { team: form.team.trim().slice(0, 10) }),
      ...(form.type === "prop" && {
        player:     form.player.trim(),
        playerTeam: form.playerTeam.trim(),
        market:     form.market,
        side:       form.side,
        line:       parseFloat(form.line),
      }),
    };

    saveBets([...(bets || []), newBet], {
      onSuccess: () => {
        toast.success(form.type === "prop"
          ? `${form.player} ${form.side} ${form.line} logged.`
          : "Bet logged.");
        setForm(EMPTY_FORM);
        setShowForm(false);
      },
      onError: () => toast.error("Couldn't save bet. Try again."),
    });
  };

  const handleDelete = (id) => {
    deleteBet(id, {
      onSuccess: () => toast.success("Bet removed."),
      onError:   () => toast.error("Couldn't delete bet."),
    });
  };

  const handleUpdate = (id, result) => {
    const updated = (bets || []).map(b => b.id === id ? { ...b, result } : b);
    saveBets(updated, {
      onSuccess: () => toast.success("Result updated."),
      onError:   () => toast.error("Couldn't update result."),
    });
  };

  // ── CSV export
  const handleExport = () => {
    if (!bets?.length) return;
    const headers = ["date","type","matchup","player","market","side","line","team","odds","stake","result","book","note","pl"];
    const rows = bets.map(b => {
      const pl = calcPL(b.odds, b.stake, b.result);
      return [
        b.date ?? "",
        b.type ?? "game",
        b.matchup ?? "",
        b.player ?? "",
        b.market ?? "",
        b.side ?? "",
        b.line ?? "",
        b.team ?? "",
        b.odds,
        b.stake,
        b.result,
        b.book ?? "",
        `"${(b.note ?? "").replace(/"/g, '""')}"`,
        pl.toFixed(2),
      ].join(",");
    });
    const csv  = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: "plusminus-bets.csv" });
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  // ─────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-4"
    >
      {/* ── Top tabs: Bet Log | Props Browser */}
      <div className="flex gap-1.5 border-b border-pitch-700 pb-3">
        {[
          { id: "log",   label: "Bet Log",      Icon: Layers },
          { id: "props", label: "Prop Markets",  Icon: Activity },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTrackerTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all
              ${trackerTab === id
                ? "bg-accent/15 text-accent border border-accent/30"
                : "bg-pitch-800 text-pitch-400 border border-pitch-700 hover:text-pitch-300 hover:border-pitch-600"}`}
          >
            <Icon size={11} />
            {label}
            {id === "log" && stats && stats.propBets > 0 && (
              <span className="text-[9px] px-1 py-0.5 rounded-full bg-accent/10 text-accent/70">
                {stats.propBets} props
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══ PROPS BROWSER TAB ═══════════════════════════════════ */}
      <AnimatePresence mode="wait">
        {trackerTab === "props" && (
          <motion.div
            key="props"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            <PropsBrowser onAddPropBet={handleAddPropBet} bankroll={bankroll} />
          </motion.div>
        )}

        {/* ═══ BET LOG TAB ═══════════════════════════════════════ */}
        {trackerTab === "log" && (
          <motion.div
            key="log"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="space-y-4"
          >
            {/* ── Summary stats ─────────────────────────────── */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Record",   value: `${stats.wins}–${stats.losses}${stats.pushes ? `–${stats.pushes}` : ""}`, sub: `${stats.total} total` },
                  { label: "Win Rate", value: formatPct(stats.winRate),                  sub: `${stats.wins}W of ${stats.wins + stats.losses}` },
                  { label: "P/L",      value: formatCurrency(stats.totalPL),             sub: `${stats.roi >= 0 ? "+" : ""}${stats.roi.toFixed(1)}% ROI`, color: stats.totalPL >= 0 ? "text-win" : "text-loss" },
                  { label: "Props",    value: `${stats.propWins}/${stats.propTotal}`,    sub: `${stats.propBets} tracked` },
                ].map(s => (
                  <div key={s.label} className="pm-tile p-3">
                    <div className="pm-label mb-1">{s.label}</div>
                    <div className={`pm-number text-lg ${s.color || "text-pitch-100"}`}>{s.value}</div>
                    <div className="text-[10px] text-pitch-600 mt-0.5">{s.sub}</div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Bankroll curve ─────────────────────────────── */}
            {bankrollCurve.length > 2 && (
              <div className="pm-card p-3">
                <div className="pm-label mb-2">Bankroll curve</div>
                <ResponsiveContainer width="100%" height={90}>
                  <AreaChart data={bankrollCurve} margin={{ top: 2, right: 4, bottom: 0, left: 4 }}>
                    <defs>
                      <linearGradient id="btGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#00d4aa" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="i" hide />
                    <YAxis hide domain={["auto", "auto"]} />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(v) => [formatCurrency(v), "Bankroll"]}
                    />
                    <ReferenceLine y={bankroll} stroke="#2e3a50" strokeDasharray="3 3" />
                    <Area
                      type="monotone" dataKey="value"
                      stroke="#00d4aa" strokeWidth={1.5}
                      fill="url(#btGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── Add bet button + form anchor ──────────────── */}
            <div id="bet-form-anchor">
              <button
                onClick={() => setShowForm(s => !s)}
                className="pm-btn-primary flex items-center gap-1.5 text-[11px] py-1.5 px-3"
              >
                <Plus size={12} />
                {showForm ? "Cancel" : "Log Bet"}
              </button>
            </div>

            {/* ── Add bet form ──────────────────────────────── */}
            <AnimatePresence>
              {showForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pm-card p-4 space-y-3">
                    {/* Bet type toggle */}
                    <div className="flex gap-1.5">
                      {[["game","Game Bet"], ["prop","Prop Bet"]].map(([t, label]) => (
                        <button
                          key={t}
                          onClick={() => setForm(f => ({ ...f, type: t }))}
                          className={`px-3 py-1 rounded text-[10px] font-medium transition-all
                            ${form.type === t
                              ? "bg-accent/15 text-accent border border-accent/30"
                              : "bg-pitch-750 text-pitch-500 border border-pitch-700 hover:text-pitch-300"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Game-specific fields */}
                    {form.type === "game" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="pm-label block mb-1">Matchup</label>
                          <input
                            className="pm-input w-full"
                            placeholder="e.g. BOS@LAL"
                            value={form.matchup}
                            onChange={e => setForm(f => ({ ...f, matchup: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="pm-label block mb-1">Team bet on</label>
                          <input
                            className="pm-input w-full"
                            placeholder="e.g. BOS"
                            maxLength={10}
                            value={form.team}
                            onChange={e => setForm(f => ({ ...f, team: e.target.value.toUpperCase() }))}
                          />
                        </div>
                      </div>
                    )}

                    {/* Prop-specific fields */}
                    {form.type === "prop" && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="pm-label block mb-1">Player</label>
                            <input
                              className="pm-input w-full"
                              placeholder="e.g. Jayson Tatum"
                              value={form.player}
                              onChange={e => setForm(f => ({ ...f, player: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="pm-label block mb-1">Matchup</label>
                            <input
                              className="pm-input w-full"
                              placeholder="e.g. BOS@LAL"
                              value={form.matchup}
                              onChange={e => setForm(f => ({ ...f, matchup: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="pm-label block mb-1">Market</label>
                            <select
                              className="pm-input w-full"
                              value={form.market}
                              onChange={e => setForm(f => ({ ...f, market: e.target.value }))}
                            >
                              {MARKET_KEYS.map(mk => (
                                <option key={mk} value={mk}>{MARKET_LABELS[mk]}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="pm-label block mb-1">Side</label>
                            <select
                              className="pm-input w-full"
                              value={form.side}
                              onChange={e => setForm(f => ({ ...f, side: e.target.value }))}
                            >
                              <option value="over">Over</option>
                              <option value="under">Under</option>
                            </select>
                          </div>
                          <div>
                            <label className="pm-label block mb-1">Line</label>
                            <input
                              className="pm-input w-full"
                              type="number"
                              step="0.5"
                              placeholder="27.5"
                              value={form.line}
                              onChange={e => setForm(f => ({ ...f, line: e.target.value }))}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Shared fields: odds / stake / result / book */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="pm-label block mb-1">Odds (American)</label>
                        <input
                          className="pm-input w-full"
                          type="number"
                          placeholder="-110"
                          value={form.odds}
                          onChange={e => setForm(f => ({ ...f, odds: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="pm-label block mb-1">Stake ($)</label>
                        <input
                          className="pm-input w-full"
                          type="number"
                          min="0"
                          step="5"
                          placeholder="50"
                          value={form.stake}
                          onChange={e => setForm(f => ({ ...f, stake: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="pm-label block mb-1">Result</label>
                        <select
                          className="pm-input w-full"
                          value={form.result}
                          onChange={e => setForm(f => ({ ...f, result: e.target.value }))}
                        >
                          {["pending","win","loss","push"].map(r => (
                            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="pm-label block mb-1">Book</label>
                        <select
                          className="pm-input w-full"
                          value={form.book}
                          onChange={e => setForm(f => ({ ...f, book: e.target.value }))}
                        >
                          <option value="">Any</option>
                          {Object.entries(BOOK_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Kelly hint */}
                    {form.odds && form.stake && !isNaN(parseFloat(form.odds)) && (
                      <div className="text-[10px] text-pitch-500">
                        Kelly suggest:{" "}
                        <span className="text-pitch-300 font-mono">
                          {formatCurrency(kellyBet(oddsToImplied(parseFloat(form.odds)), parseFloat(form.odds), bankroll))}
                        </span>
                        {" "}· Break-even:{" "}
                        <span className="text-pitch-300 font-mono">
                          {formatPct(breakEven(parseFloat(form.odds)))}
                        </span>
                      </div>
                    )}

                    {/* Note */}
                    <div>
                      <label className="pm-label block mb-1">Note (optional)</label>
                      <input
                        className="pm-input w-full"
                        placeholder="e.g. fade the public, injury report edge…"
                        maxLength={200}
                        value={form.note}
                        onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                      />
                    </div>

                    <button
                      onClick={handleSubmit}
                      disabled={isSaving}
                      className="pm-btn-primary flex items-center gap-1.5 text-[11px] py-1.5 px-4 disabled:opacity-50"
                    >
                      {isSaving ? <Loader size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                      {isSaving ? "Saving…" : "Save Bet"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Filter bar ────────────────────────────────── */}
            {bets && bets.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {/* Result filter */}
                {["all","pending","win","loss","push"].map(r => (
                  <button
                    key={r}
                    onClick={() => setFilterResult(r)}
                    className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all
                      ${filterResult === r
                        ? "bg-accent/15 text-accent border border-accent/30"
                        : "bg-pitch-800 text-pitch-500 border border-pitch-700 hover:text-pitch-300"}`}
                  >
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
                <div className="w-px bg-pitch-700 self-stretch mx-0.5" />
                {/* Type filter */}
                {[["all","All"],["game","Game"],["prop","Prop"]].map(([t, label]) => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all
                      ${filterType === t
                        ? "bg-pitch-600 text-pitch-100 border border-pitch-500"
                        : "bg-pitch-800 text-pitch-500 border border-pitch-700 hover:text-pitch-300"}`}
                  >
                    {label}
                  </button>
                ))}

                {/* Export */}
                <button
                  onClick={handleExport}
                  className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded text-[10px]
                    bg-pitch-800 text-pitch-500 border border-pitch-700 hover:text-pitch-300 transition-all"
                >
                  <Download size={9} /> Export CSV
                </button>
              </div>
            )}

            {/* ── Bet list ──────────────────────────────────── */}
            {isLoading ? (
              <div className="space-y-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-md bg-pitch-800 animate-pulse" />
                ))}
              </div>
            ) : filteredBets.length === 0 ? (
              <EmptyState
                title="No bets yet"
                description={bets?.length
                  ? "No bets match this filter."
                  : 'Log your first bet above, or browse prop lines in the "Prop Markets" tab.'}
                icon={Target}
              />
            ) : (
              <motion.div variants={container} initial="hidden" animate="show" className="space-y-1.5">
                {filteredBets.map(bet => {
                  const pl       = calcPL(bet.odds, bet.stake, bet.result);
                  const isProp   = bet.type === "prop";
                  const isPending = bet.result === "pending";

                  return (
                    <motion.div
                      key={bet.id}
                      variants={item}
                      layout
                      className="group flex items-start justify-between gap-3 px-3 py-2.5 rounded-md
                        bg-pitch-800 border border-pitch-700 hover:border-pitch-600 transition-colors"
                    >
                      {/* Left: description */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Type badge */}
                          {isProp ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent/80 border border-accent/20">
                              PROP
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-pitch-700 text-pitch-500 border border-pitch-600">
                              GAME
                            </span>
                          )}

                          {/* Primary label */}
                          {isProp ? (
                            <span className="text-[11px] font-medium text-pitch-200 truncate">
                              {bet.player}
                              <span className="text-pitch-500 font-normal ml-1">
                                {bet.side} {bet.line} {MARKET_LABELS[bet.market] ?? bet.market}
                              </span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium text-pitch-200">
                              {bet.matchup || bet.team || "—"}
                            </span>
                          )}

                          {/* Matchup context for props */}
                          {isProp && bet.matchup && (
                            <span className="text-[9px] text-pitch-600 font-mono">{bet.matchup}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="font-mono text-[10px] text-pitch-500">
                            {bet.odds > 0 ? "+" : ""}{bet.odds}
                          </span>
                          <span className="text-[10px] text-pitch-600">·</span>
                          <span className="font-mono text-[10px] text-pitch-500">
                            {formatCurrency(bet.stake)}
                          </span>
                          {bet.book && (
                            <>
                              <span className="text-[10px] text-pitch-700">·</span>
                              <span className="text-[10px] text-pitch-600">
                                {BOOK_LABELS[bet.book] || bet.book}
                              </span>
                            </>
                          )}
                          {bet.date && (
                            <>
                              <span className="text-[10px] text-pitch-700">·</span>
                              <span className="text-[10px] text-pitch-700 font-mono">{bet.date}</span>
                            </>
                          )}
                        </div>
                        {bet.note && (
                          <div className="text-[10px] text-pitch-600 mt-0.5 italic truncate">{bet.note}</div>
                        )}
                      </div>

                      {/* Right: P/L + result selector + delete */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* P/L */}
                        {!isPending && (
                          <span className={`font-mono text-[11px] font-medium w-16 text-right
                            ${pl > 0 ? "text-win" : pl < 0 ? "text-loss" : "text-pitch-500"}`}>
                            {pl > 0 ? "+" : ""}{formatCurrency(pl)}
                          </span>
                        )}

                        {/* Result quick-edit */}
                        <select
                          value={bet.result}
                          onChange={e => handleUpdate(bet.id, e.target.value)}
                          className={`text-[10px] rounded px-1.5 py-0.5 border font-medium cursor-pointer
                            bg-pitch-750 transition-colors
                            ${bet.result === "win"     ? "text-win  border-win/30"  : ""}
                            ${bet.result === "loss"    ? "text-loss border-loss/30" : ""}
                            ${bet.result === "push"    ? "text-draw border-draw/30" : ""}
                            ${bet.result === "pending" ? "text-pitch-400 border-pitch-600" : ""}`}
                        >
                          <option value="pending">Pending</option>
                          <option value="win">Win</option>
                          <option value="loss">Loss</option>
                          <option value="push">Push</option>
                        </select>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(bet.id)}
                          disabled={isDeleting}
                          className="opacity-0 group-hover:opacity-100 transition-opacity
                            p-1 rounded hover:bg-loss/15 text-pitch-600 hover:text-loss disabled:opacity-30"
                          aria-label="Delete bet"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

