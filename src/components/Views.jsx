import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, Cell,
} from "recharts";
import { TEAM_NAMES, ODDS_GAMES } from "../data";
import { useStandings, useTodayGames, useOdds, mergeOddsIntoGames } from "../api";
import { calcPL, BET_STORAGE_KEY } from "../utils";
import { TileSkeleton, RowSkeleton, ErrorState, FreshnessTag } from "./ui";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

// ── SCORES ────────────────────────────────────────────────────
export function Scores() {
  const [selected, setSelected] = useState(null);
  const { data: rawGames, isLoading, isError, isFetching, refetch, dataUpdatedAt } = useTodayGames();
  const { data: oddsData } = useOdds();
  const games = useMemo(() => mergeOddsIntoGames(rawGames, oddsData), [rawGames, oddsData]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <motion.div variants={container} initial="hidden" animate="show">
      <div className="flex items-center justify-between mb-3">
        <div className="pm-label">{today} · {games?.length || 0} games</div>
        <FreshnessTag isFetching={isFetching} dataUpdatedAt={dataUpdatedAt} />
      </div>

      {isError ? (
        <ErrorState message="Couldn't load today's games." onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => <TileSkeleton key={i} lines={4} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(games || []).map(g => {
            const fav = g.homeP >= g.awayP ? "home" : "away";
            const isSelected = selected === g.id;
            const isFinal = g.status === "final";
            const isLive = g.status === "live";

            return (
              <motion.div
                key={g.id}
                variants={item}
                onClick={() => setSelected(isSelected ? null : g.id)}
                className={`pm-tile p-4 ${isSelected ? "pm-accent-border" : ""}`}
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="pm-label">{g.time}</span>
                  {isFinal && (
                    <span className="pm-badge bg-pitch-700 text-pitch-400 border border-pitch-600">Final</span>
                  )}
                  {isLive && (
                    <span className="pm-badge bg-win/10 text-win border border-win/20 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-win animate-pulse inline-block" />
                      Live
                    </span>
                  )}
                  {g.status === "scheduled" && (
                    <span className="pm-badge bg-pitch-700 text-pitch-300 border border-pitch-500">
                      {g.spread !== "—" ? g.spread : "Tonight"}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1">
                    <div className={`font-display text-2xl tracking-widest leading-none
                      ${fav === "away" ? "text-accent" : "text-pitch-300"}`}>
                      {g.away}
                    </div>
                    <div className="text-[10px] text-pitch-500 mt-0.5">
                      {TEAM_NAMES[g.away] || g.away}
                    </div>
                    {(isFinal || isLive) && (
                      <div className="pm-number text-xl mt-1 text-pitch-100">{g.awayScore}</div>
                    )}
                  </div>

                  <div className="text-center">
                    <div className="text-[10px] text-pitch-600 font-mono">
                      {isFinal || isLive ? "—" : "vs"}
                    </div>
                    {g.total !== "—" && (
                      <div className="text-[9px] text-pitch-600 mt-0.5">O/U {g.total}</div>
                    )}
                  </div>

                  <div className="flex-1 text-right">
                    <div className={`font-display text-2xl tracking-widest leading-none
                      ${fav === "home" ? "text-accent" : "text-pitch-300"}`}>
                      {g.home}
                    </div>
                    <div className="text-[10px] text-pitch-500 mt-0.5">
                      {TEAM_NAMES[g.home] || g.home}
                    </div>
                    {(isFinal || isLive) && (
                      <div className="pm-number text-xl mt-1 text-pitch-100">{g.homeScore}</div>
                    )}
                  </div>
                </div>

                {g.status === "scheduled" && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-pitch-500">
                      <span className="font-mono">{g.awayP}%</span>
                      <span className="font-mono">{g.homeP}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-pitch-700 overflow-hidden">
                      <motion.div
                        className="h-full bg-accent rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${g.awayP}%` }}
                        transition={{ duration: 0.7, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ── STANDINGS ─────────────────────────────────────────────────
export function Standings() {
  const [conf, setConf] = useState("east");
  const { data, isLoading, isError, isFetching, refetch, dataUpdatedAt } = useStandings();

  const teams = conf === "east"
    ? (data?.east || [])
    : (data?.west || []);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {[["east", "Eastern Conference"], ["west", "Western Conference"]].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setConf(id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all
                ${conf === id
                  ? "bg-accent/15 text-accent border border-accent/30"
                  : "bg-pitch-800 text-pitch-400 border border-pitch-600 hover:border-pitch-500"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <FreshnessTag isFetching={isFetching} dataUpdatedAt={dataUpdatedAt} />
      </div>

      {isError ? (
        <ErrorState message="Couldn't load standings." onRetry={refetch} />
      ) : isLoading ? (
        <div className="pm-card p-4"><RowSkeleton rows={15} /></div>
      ) : (
        <>
          <div className="pm-card overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-pitch-600">
                  {["#", "Team", "W", "L", "PCT", "L10", "HOME", "ROAD", "STREAK"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left pm-label font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teams.map((t, i) => (
                  <motion.tr
                    key={t.team}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className={`border-b border-pitch-700 hover:bg-pitch-700 transition-colors cursor-pointer
                      ${i === 5 ? "border-t-2 border-t-accent/40" : ""}`}
                  >
                    <td className="px-3 py-2.5 font-mono text-[11px] text-pitch-500">{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <span className={`font-display text-base tracking-wider
                        ${i === 0 ? "text-accent" : "text-pitch-200"}`}>
                        {t.team}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-pitch-200">{t.w}</td>
                    <td className="px-3 py-2.5 font-mono text-pitch-400">{t.l}</td>
                    <td className="px-3 py-2.5 font-mono text-pitch-300">{t.pct.toFixed(3)}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-pitch-400">{t.last10}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-pitch-400">{t.home}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-pitch-400">{t.road}</td>
                    <td className="px-3 py-2.5">
                      <span className={`pm-badge
                        ${t.streak.startsWith("W")
                          ? "bg-win/10 text-win border border-win/20"
                          : "bg-loss/10 text-loss border border-loss/20"}`}>
                        {t.streak}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-[10px] text-pitch-600">
            Line above rank 7 = playoff / play-in cutoff
          </div>
        </>
      )}
    </motion.div>
  );
}

// ── BETTING ───────────────────────────────────────────────────
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
    const scheduled = (rawGames || []).filter(g => g.status === "scheduled");

    for (const game of scheduled) {
      const key = `${game.away}@${game.home}`;
      const odds = oddsData[key];
      if (!odds) continue;

      const fav = odds.homeP >= odds.awayP ? game.home : game.away;
      const impliedP = Math.max(odds.homeP, odds.awayP);

      const favStats = teamPct[fav];
      const totalGames = favStats?.games || 0;
      const modelP = totalGames >= 10
        ? +(favStats.pct * 100).toFixed(1)
        : null;

      const diff = modelP !== null ? +(modelP - impliedP).toFixed(1) : null;
      const edge = diff !== null
        ? (diff >= 10 ? "high" : diff >= 5 ? "mid" : "low")
        : "none";

      edges.push({
        matchup: `${game.away} @ ${game.home}`,
        fav,
        modelP,
        impliedP: +impliedP.toFixed(1),
        diff,
        edge,
        spread: game.spread,
        total: game.total,
      });
    }

    const order = { high: 0, mid: 1, low: 2, none: 3 };
    return edges.sort((a, b) => order[a.edge] - order[b.edge]);
  }, [oddsData, standingsData, rawGames]);

  const edgeCards = liveEdges && liveEdges.length > 0 ? liveEdges : null;
  const isLive = !!edgeCards;

  const hasOddsKey = !!import.meta.env.VITE_ODDS_API_KEY;
  const showOfflineBanner = !hasOddsKey || (!isLive && !oddsFetching);

  return (
    <motion.div variants={container} initial="hidden" animate="show">
      <div className="flex items-center justify-between mb-3">
        <div className="pm-label">
          {isLive ? "Model vs market · Tonight's edges" : "Model vs market · Sample edges"}
        </div>
        <FreshnessTag
          isFetching={oddsFetching || standingsFetching}
          dataUpdatedAt={oddsUpdatedAt}
        />
      </div>

      {showOfflineBanner && (
        <motion.div
          variants={item}
          className="mb-4 px-3 py-2.5 rounded-md border border-pitch-600
                     bg-pitch-800 flex items-center gap-2"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-draw flex-shrink-0" />
          <span className="text-[11px] text-pitch-400">
            {!hasOddsKey
              ? <>Showing sample data — add <span className="font-mono text-pitch-300">VITE_ODDS_API_KEY</span> to .env for live market odds</>
              : "Live odds unavailable — showing sample data"
            }
          </span>
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        {isLive ? edgeCards.map(g => {
          const edgeColor =
            g.edge === "high" ? "text-win border-win/30 bg-win/10" :
              g.edge === "mid" ? "text-draw border-draw/30 bg-draw/10" :
                g.edge === "none" ? "text-pitch-600 border-pitch-700 bg-pitch-800" :
                  "text-pitch-400 border-pitch-600 bg-pitch-700";

          const edgeLabel =
            g.edge === "high" ? "★ EDGE" :
              g.edge === "mid" ? "MOD" :
                g.edge === "none" ? "N/A" : "SMALL";

          return (
            <motion.div key={g.matchup} variants={item} className="pm-tile p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm font-medium text-pitch-100">{g.matchup}</div>
                  <div className="text-[10px] text-pitch-400 mt-0.5">
                    Favourite: <span className="text-accent">{g.fav}</span>
                    {g.edge === "none" && (
                      <span className="text-pitch-600 ml-1">· insufficient data</span>
                    )}
                  </div>
                </div>
                <span className={`pm-badge border ${edgeColor}`}>{edgeLabel}</span>
              </div>

              <div className="space-y-1.5 mb-3">
                <div className="flex justify-between text-[11px]">
                  <span className="text-pitch-400">Model prob</span>
                  <span className="font-mono text-pitch-100">
                    {g.modelP !== null ? `${g.modelP}%` : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-pitch-400">Market implied</span>
                  <span className="font-mono text-pitch-300">{g.impliedP}%</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-pitch-400">Edge</span>
                  <span className={`font-mono font-medium
                    ${g.diff === null ? "text-pitch-600"
                      : g.diff >= 10 ? "text-win"
                        : g.diff >= 5 ? "text-draw"
                          : "text-pitch-400"}`}>
                    {g.diff !== null ? `${g.diff > 0 ? "+" : ""}${g.diff}%` : "—"}
                  </span>
                </div>
              </div>

              <div className="border-t border-pitch-600 pt-3 flex justify-between text-[10px] text-pitch-500">
                <span>{g.spread}</span>
                <span>O/U {g.total}</span>
              </div>
            </motion.div>
          );
        }) : ODDS_GAMES.map(g => {
          const diff = g.modelP - g.impliedP;
          const edgeColor =
            g.edge === "high" ? "text-win border-win/30 bg-win/10" :
              g.edge === "mid" ? "text-draw border-draw/30 bg-draw/10" :
                "text-pitch-400 border-pitch-600 bg-pitch-700";

          return (
            <motion.div key={g.matchup} variants={item} className="pm-tile p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm font-medium text-pitch-100">{g.matchup}</div>
                  <div className="text-[10px] text-pitch-400 mt-0.5">
                    Favourite: <span className="text-accent">{g.fav}</span>
                  </div>
                </div>
                <span className={`pm-badge border ${edgeColor}`}>
                  {g.edge === "high" ? "★ EDGE" : g.edge === "mid" ? "MOD" : "SMALL"}
                </span>
              </div>

              <div className="space-y-1.5 mb-3">
                <div className="flex justify-between text-[11px]">
                  <span className="text-pitch-400">Model prob</span>
                  <span className="font-mono text-pitch-100">{g.modelP}%</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-pitch-400">Market implied</span>
                  <span className="font-mono text-pitch-300">{g.impliedP}%</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-pitch-400">Edge</span>
                  <span className={`font-mono font-medium
                    ${diff >= 10 ? "text-win" : diff >= 5 ? "text-draw" : "text-pitch-400"}`}>
                    +{diff}%
                  </span>
                </div>
              </div>

              <div className="border-t border-pitch-600 pt-3 flex justify-between text-[10px] text-pitch-500">
                <span>{g.spread}</span>
                <span>O/U {g.total}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="pm-card p-4 text-[11px] text-pitch-400 leading-relaxed">
        <span className="text-pitch-200 font-medium">How edges are calculated: </span>
        {isLive ? (
          <>
            Model win% is a proxy derived from each team's season win percentage (minimum 10 games required).
            Market implied probability is computed from live American moneyline odds via The Odds API, with vig removed.
            A model-vs-market difference ≥10% is flagged as a high edge, ≥5% as moderate.
            This is a directional signal, not a sophisticated model — always bet responsibly.
          </>
        ) : (
          <>
            Sample data shown — add VITE_ODDS_API_KEY to .env for live market odds.
            Model win% uses season W% as a proxy. Market implied probability converts American moneyline odds.
            A difference ≥10% is flagged as a high edge. This is not financial advice — always bet responsibly.
          </>
        )}
      </div>
    </motion.div>
  );
}

// ── BET TRACKER ───────────────────────────────────────────────
// Bets persist in localStorage. Key imported from utils.js.
// If missing (raw === null = first visit), we seed with demo bets.

const DEMO_BETS = [
  { id: 1, game: "OKC @ BKN", type: "Spread", pick: "OKC -16", odds: -110, stake: 50, result: "win" },
  { id: 2, game: "GSW @ BOS", type: "Moneyline", pick: "BOS ML", odds: -240, stake: 100, result: "win" },
  { id: 3, game: "POR @ IND", type: "Over/Under", pick: "Over 228", odds: -112, stake: 40, result: "loss" },
  { id: 4, game: "LAL @ HOU", type: "Spread", pick: "HOU -1", odds: -108, stake: 55, result: "pending" },
];

function loadBets() {
  try {
    const raw = localStorage.getItem(BET_STORAGE_KEY);
    if (raw === null) return DEMO_BETS;          // first visit — show demo
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEMO_BETS;  // respect empty array
  } catch {
    return DEMO_BETS;
  }
}

function saveBets(bets) {
  try {
    localStorage.setItem(BET_STORAGE_KEY, JSON.stringify(bets));
    // Notify same-tab listeners — native "storage" only fires for other tabs.
    window.dispatchEvent(new StorageEvent("storage", { key: BET_STORAGE_KEY }));
  } catch {
    console.warn("[PlusMinus] Could not persist bets to localStorage.");
  }
}

// CSV export utility.
// Triggers a browser download of all bets as a .csv file.
// Uses a hidden <a> tag + object URL — no server required.
function exportBetsCSV(bets) {
  const headers = "Date,Game,Type,Pick,Odds,Stake,Result,P&L\n";
  const rows = bets.map(b => {
    const pl = calcPL(b.stake, b.odds, b.result);
    const plStr = b.result === "pending" ? "" : pl.toFixed(2);
    // Only treat id as a timestamp if it's a real Date.now() value (13 digits)
    const date = b.id > 1000000000000 ? new Date(b.id).toLocaleDateString("en-US") : "";
    // Wrap fields in quotes to handle commas inside game/pick strings
    return `"${date}","${b.game}","${b.type}","${b.pick}",${b.odds},${b.stake},${b.result},${plStr}`;
  }).join("\n");

  const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `plusminus-bets-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function BetTracker() {
  const [bets, setBets] = useState(loadBets);
  const [form, setForm] = useState({ game: "", type: "Moneyline", pick: "", odds: "", stake: "", result: "pending" });
  const [formError, setFormError] = useState("");
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    saveBets(bets);
  }, [bets]);

  const addBet = () => {
    if (!form.game || !form.pick || !form.odds || !form.stake) {
      setFormError("Please fill in Game, Pick, Odds, and Stake.");
      return;
    }
    setFormError("");
    setBets(prev => [{ ...form, id: Date.now(), odds: +form.odds, stake: +form.stake }, ...prev]);
    setForm({ game: "", type: "Moneyline", pick: "", odds: "", stake: "", result: "pending" });
  };

  const clearAll = () => {
    if (window.confirm("Clear all bets? This cannot be undone.")) {
      setBets([]);
    }
  };

  const updateResult = (id, newResult) => {
    setBets(prev => prev.map(b => b.id === id ? { ...b, result: newResult } : b));
    setEditingId(null);
  };

  const stats = useMemo(() => {
    const decisive = bets.filter(b => b.result === "win" || b.result === "loss");
    const wins = bets.filter(b => b.result === "win").length;
    const totalPL = bets.reduce((s, b) => s + calcPL(b.stake, b.odds, b.result), 0);
    const totalStake = decisive.reduce((s, b) => s + b.stake, 0);
    const roi = totalStake > 0 ? (totalPL / totalStake * 100) : 0;
    const winRate = decisive.length > 0 ? (wins / decisive.length * 100).toFixed(1) + "%" : "—";
    return { totalPL, roi, winRate };
  }, [bets]);

  const chartData = useMemo(() => {
    let running = 0;
    return [...bets].filter(b => b.result !== "pending").reverse().map((b, i) => {
      running += calcPL(b.stake, b.odds, b.result);
      return { bet: i + 1, pl: +running.toFixed(2) };
    });
  }, [bets]);

  // Bet type breakdown — win rate + P&L per bet type.
  // Only includes decisive (non-pending) bets. Skips types with no history.
  const typeBreakdown = useMemo(() => {
    const types = {};
    bets.forEach(b => {
      if (b.result === "pending") return;
      if (!types[b.type]) types[b.type] = { wins: 0, losses: 0, pl: 0 };
      if (b.result === "win") types[b.type].wins++;
      if (b.result === "loss") types[b.type].losses++;
      types[b.type].pl += calcPL(b.stake, b.odds, b.result);
    });
    return Object.entries(types)
      .map(([type, d]) => {
        const total = d.wins + d.losses;
        return {
          type,
          winRate: total > 0 ? +((d.wins / total) * 100).toFixed(0) : 0,
          pl: +d.pl.toFixed(2),
          total,
        };
      })
      .sort((a, b) => b.winRate - a.winRate);
  }, [bets]);

  const inputCls = `bg-pitch-700 border border-pitch-600 rounded-md px-2.5 py-1.5
    text-sm text-pitch-200 placeholder:text-pitch-500 w-full
    focus:outline-none focus:border-accent/50 transition-colors`;

  const RESULT_OPTIONS = [
    { value: "win", label: "WIN", cls: "bg-win/10  text-win  border-win/20" },
    { value: "loss", label: "LOSS", cls: "bg-loss/10 text-loss border-loss/20" },
    { value: "push", label: "PUSH", cls: "bg-draw/10 text-draw border-draw/20" },
    { value: "pending", label: "PENDING", cls: "bg-pitch-700 text-pitch-500 border-pitch-600" },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { lbl: "Total bets", val: bets.length, cls: "" },
          { lbl: "Win rate", val: stats.winRate, cls: "" },
          { lbl: "Net P&L", val: `${stats.totalPL >= 0 ? "+" : ""}$${stats.totalPL.toFixed(2)}`, cls: stats.totalPL >= 0 ? "text-win" : "text-loss" },
          { lbl: "ROI", val: `${stats.roi >= 0 ? "+" : ""}${stats.roi.toFixed(1)}%`, cls: stats.roi >= 0 ? "text-win" : "text-loss" },
        ].map(m => (
          <div key={m.lbl} className="pm-tile p-4 text-center">
            <div className="pm-label mb-1">{m.lbl}</div>
            <div className={`font-mono font-medium text-2xl ${m.cls || "text-pitch-50"}`}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* Log a bet form */}
      <div className="pm-card p-4 mb-4">
        <div className="pm-label mb-3">Log a bet</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          <input className={inputCls} placeholder="Game (e.g. OKC @ BKN)" value={form.game} onChange={e => setForm(f => ({ ...f, game: e.target.value }))} />
          <select className={inputCls} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            {["Moneyline", "Spread", "Over/Under", "Player prop", "Parlay"].map(t => <option key={t}>{t}</option>)}
          </select>
          <input className={inputCls} placeholder="Pick (e.g. OKC -16)" value={form.pick} onChange={e => setForm(f => ({ ...f, pick: e.target.value }))} />
          <input className={inputCls} placeholder="Odds (-110)" type="number" value={form.odds} onChange={e => setForm(f => ({ ...f, odds: e.target.value }))} />
          <input className={inputCls} placeholder="Stake ($)" type="number" value={form.stake} onChange={e => setForm(f => ({ ...f, stake: e.target.value }))} />
          <select className={inputCls} value={form.result} onChange={e => setForm(f => ({ ...f, result: e.target.value }))}>
            <option value="pending">Pending</option>
            <option value="win">Win</option>
            <option value="loss">Loss</option>
            <option value="push">Push</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={addBet} className="px-4 py-2 bg-accent/15 text-accent border border-accent/30 rounded-md text-sm font-medium hover:bg-accent/25 transition-colors">
            Add bet
          </button>
          {formError && <span className="text-[11px] text-loss">{formError}</span>}
        </div>
      </div>

      {/* Bet log table */}
      <div className="pm-card overflow-x-auto mb-4">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-pitch-600">
          <span className="pm-label">Bet log · {bets.length} entries</span>
          <div className="flex items-center gap-3">
            {bets.length > 0 && (
              <button
                onClick={() => exportBetsCSV(bets)}
                className="text-[10px] text-pitch-400 hover:text-accent transition-colors"
              >
                Export CSV
              </button>
            )}
            {bets.length > 0 && (
              <button
                onClick={clearAll}
                className="text-[10px] text-pitch-500 hover:text-loss transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
        <table className="w-full text-sm min-w-[540px]">
          <thead>
            <tr className="border-b border-pitch-600">
              {["Game", "Type", "Pick", "Odds", "Stake", "P&L", "Result", ""].map(h => (
                <th key={h} className="px-3 py-2.5 text-left pm-label">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bets.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-pitch-500 text-sm">No bets yet.</td></tr>
            )}
            {bets.map(b => {
              const pl = calcPL(b.stake, b.odds, b.result);
              const isEditing = editingId === b.id;
              return (
                <tr key={b.id} className="border-b border-pitch-700 hover:bg-pitch-750 transition-colors">
                  <td className="px-3 py-2.5 font-medium text-pitch-100">{b.game}</td>
                  <td className="px-3 py-2.5 text-pitch-400 text-[11px]">{b.type}</td>
                  <td className="px-3 py-2.5 text-pitch-300">{b.pick}</td>
                  <td className="px-3 py-2.5 font-mono text-pitch-300">{b.odds}</td>
                  <td className="px-3 py-2.5 font-mono text-pitch-300">${b.stake}</td>
                  <td className={`px-3 py-2.5 font-mono font-medium ${b.result === "pending" ? "text-pitch-500"
                    : pl > 0 ? "text-win" : pl < 0 ? "text-loss" : "text-pitch-400"
                    }`}>
                    {b.result === "pending" ? "—" : `${pl >= 0 ? "+" : ""}$${pl.toFixed(2)}`}
                  </td>
                  <td className="px-3 py-2.5 relative">
                    {isEditing ? (
                      <div className="flex gap-1 flex-wrap">
                        {RESULT_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => updateResult(b.id, opt.value)}
                            className={`pm-badge border cursor-pointer transition-all hover:scale-105
                              ${b.result === opt.value ? "ring-1 ring-accent/50" : ""}
                              ${opt.cls}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-pitch-600 hover:text-pitch-300 text-[10px] ml-1 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingId(b.id)}
                        title="Click to change result"
                        className={`pm-badge border cursor-pointer hover:brightness-125 transition-all ${b.result === "win" ? "bg-win/10  text-win  border-win/20"
                          : b.result === "loss" ? "bg-loss/10 text-loss border-loss/20"
                            : b.result === "push" ? "bg-draw/10 text-draw border-draw/20"
                              : "bg-pitch-700 text-pitch-500 border-pitch-600"
                          }`}
                      >
                        {b.result.toUpperCase()}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => setBets(prev => prev.filter(x => x.id !== b.id))}
                      className="text-pitch-600 hover:text-loss text-base leading-none transition-colors"
                    >×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cumulative P&L chart */}
      {chartData.length >= 2 && (
        <div className="pm-card p-4 mb-4">
          <div className="pm-label mb-3">Cumulative P&amp;L</div>
          <div style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="bet" tick={{ fill: "#546480", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#546480", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: "#1a1e2a", border: "1px solid #2e3a50", borderRadius: 6, fontSize: 11 }}
                  labelStyle={{ color: "#7d91ab" }}
                  itemStyle={{ color: "#00d4aa" }}
                  formatter={v => [`$${v}`, "P&L"]}
                />
                <Line type="monotone" dataKey="pl" stroke="#00d4aa" strokeWidth={2} dot={{ fill: "#00d4aa", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Bet type breakdown — win rate by bet type.
          Only renders when there are at least 2 settled bets across at least 2 types. */}
      {typeBreakdown.length >= 2 && (
        <div className="pm-card p-4">
          <div className="pm-label mb-3">Win rate by bet type</div>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeBreakdown} barCategoryGap="28%">
                <XAxis
                  dataKey="type"
                  tick={{ fill: "#546480", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: "#546480", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `${v}%`}
                />
                <Tooltip
                  contentStyle={{ background: "#1a1e2a", border: "1px solid #2e3a50", borderRadius: 6, fontSize: 11 }}
                  labelStyle={{ color: "#7d91ab" }}
                  formatter={(v, name, props) => [
                    `${v}% (${props.payload.total} bets · ${props.payload.pl >= 0 ? "+" : ""}$${props.payload.pl})`,
                    "Win rate",
                  ]}
                />
                <Bar dataKey="winRate" radius={[3, 3, 0, 0]}>
                  {typeBreakdown.map((entry) => (
                    <Cell
                      key={entry.type}
                      fill={entry.winRate >= 55 ? "#00d4aa" : entry.winRate >= 45 ? "#facc15" : "#ef4444"}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            {typeBreakdown.map(t => (
              <div key={t.type} className="flex items-center gap-1.5">
                <span className="text-[10px] text-pitch-400">{t.type}:</span>
                <span className={`pm-number text-[11px] ${t.winRate >= 55 ? "text-win" : t.winRate >= 45 ? "text-draw" : "text-loss"}`}>
                  {t.winRate}%
                </span>
                <span className={`text-[10px] font-mono ${t.pl >= 0 ? "text-win" : "text-loss"}`}>
                  {t.pl >= 0 ? "+" : ""}${t.pl}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}