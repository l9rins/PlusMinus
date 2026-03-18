import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
} from "recharts";
import { TEAM_NAMES, ODDS_GAMES } from "../data";
import { useStandings, useTodayGames } from "../api";
import { calcPL } from "../utils";
import { TileSkeleton, RowSkeleton, ErrorState, FreshnessTag } from "./ui";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

// ── SCORES ────────────────────────────────────────────────────
export function Scores() {
  const [selected, setSelected] = useState(null);
  const { data: games, isLoading, isError, isFetching, refetch, dataUpdatedAt } = useTodayGames();

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

                {/* Win probability bar — only for scheduled games */}
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
// Static odds data until The Odds API is wired up
export function Betting() {
  return (
    <motion.div variants={container} initial="hidden" animate="show">
      <div className="pm-label mb-3">Model vs market · Tonight's edges</div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        {ODDS_GAMES.map(g => {
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
        Model win% uses logistic regression on net rating, season W%, last-10 form, rest days, and home court.
        Market implied probability converts American moneyline odds. A difference ≥10% is flagged as a high edge.
        This is not financial advice — always bet responsibly.
      </div>
    </motion.div>
  );
}

// ── BET TRACKER ───────────────────────────────────────────────
export function BetTracker() {
  const [bets, setBets] = useState([
    { id: 1, game: "OKC @ BKN", type: "Spread", pick: "OKC -16", odds: -110, stake: 50, result: "win" },
    { id: 2, game: "GSW @ BOS", type: "Moneyline", pick: "BOS ML", odds: -240, stake: 100, result: "win" },
    { id: 3, game: "POR @ IND", type: "Over/Under", pick: "Over 228", odds: -112, stake: 40, result: "loss" },
    { id: 4, game: "LAL @ HOU", type: "Spread", pick: "HOU -1", odds: -108, stake: 55, result: "pending" },
  ]);

  const [form, setForm] = useState({ game: "", type: "Moneyline", pick: "", odds: "", stake: "", result: "pending" });
  const [formError, setFormError] = useState("");

  const addBet = () => {
    if (!form.game || !form.pick || !form.odds || !form.stake) {
      setFormError("Please fill in Game, Pick, Odds, and Stake.");
      return;
    }
    setFormError("");
    setBets(prev => [{ ...form, id: Date.now(), odds: +form.odds, stake: +form.stake }, ...prev]);
    setForm({ game: "", type: "Moneyline", pick: "", odds: "", stake: "", result: "pending" });
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

  const inputCls = `bg-pitch-700 border border-pitch-600 rounded-md px-2.5 py-1.5
    text-sm text-pitch-200 placeholder:text-pitch-500 w-full
    focus:outline-none focus:border-accent/50 transition-colors`;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
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
            <option value="pending">Pending</option><option value="win">Win</option>
            <option value="loss">Loss</option><option value="push">Push</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={addBet} className="px-4 py-2 bg-accent/15 text-accent border border-accent/30 rounded-md text-sm font-medium hover:bg-accent/25 transition-colors">
            Add bet
          </button>
          {formError && <span className="text-[11px] text-loss">{formError}</span>}
        </div>
      </div>

      <div className="pm-card overflow-x-auto mb-4">
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
              return (
                <tr key={b.id} className="border-b border-pitch-700 hover:bg-pitch-750 transition-colors">
                  <td className="px-3 py-2.5 font-medium text-pitch-100">{b.game}</td>
                  <td className="px-3 py-2.5 text-pitch-400 text-[11px]">{b.type}</td>
                  <td className="px-3 py-2.5 text-pitch-300">{b.pick}</td>
                  <td className="px-3 py-2.5 font-mono text-pitch-300">{b.odds}</td>
                  <td className="px-3 py-2.5 font-mono text-pitch-300">${b.stake}</td>
                  <td className={`px-3 py-2.5 font-mono font-medium ${b.result === "pending" ? "text-pitch-500" : pl > 0 ? "text-win" : pl < 0 ? "text-loss" : "text-pitch-400"}`}>
                    {b.result === "pending" ? "—" : `${pl >= 0 ? "+" : ""}$${pl.toFixed(2)}`}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`pm-badge ${b.result === "win" ? "bg-win/10 text-win border border-win/20" : b.result === "loss" ? "bg-loss/10 text-loss border border-loss/20" : "bg-pitch-700 text-pitch-500 border border-pitch-600"}`}>
                      {b.result.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => setBets(prev => prev.filter(x => x.id !== b.id))} className="text-pitch-600 hover:text-loss text-base leading-none transition-colors">×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {chartData.length >= 2 && (
        <div className="pm-card p-4">
          <div className="pm-label mb-3">Cumulative P&amp;L</div>
          <div style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="bet" tick={{ fill: "#546480", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#546480", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip contentStyle={{ background: "#1a1e2a", border: "1px solid #2e3a50", borderRadius: 6, fontSize: 11 }} labelStyle={{ color: "#7d91ab" }} itemStyle={{ color: "#00d4aa" }} formatter={v => [`$${v}`, "P&L"]} />
                <Line type="monotone" dataKey="pl" stroke="#00d4aa" strokeWidth={2} dot={{ fill: "#00d4aa", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </motion.div>
  );
}