import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    TrendingUp, TrendingDown, Target, BarChart2,
    Zap, ChevronRight, Activity, DollarSign, Flame, Shield,
} from "lucide-react";
import { TEAM_NAMES, ODDS_GAMES, TEAM_COLORS } from "../data";
import { useStandings, useTodayGames, useOdds, mergeOddsIntoGames, useBets } from "../api";
import { calcPL, lsGet, kellyBet, DEFAULT_BANKROLL, formatCurrency } from "../utils";
import { TileSkeleton, RowSkeleton, ErrorState, FreshnessTag, Tooltip, TeamLink } from "./ui";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } } };
const tile = { hidden: { opacity: 0, y: 14, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] } } };

function GameTile({ game }) {
    const fav = (game.homeP === null || game.awayP === null) ? null : game.homeP >= game.awayP ? "home" : "away";
    const isFinal = game.status === "final";
    const isLive = game.status === "live";
    const isScheduled = game.status === "scheduled";
    const awayColor = TEAM_COLORS[game.away] || "#546480";
    const homeColor = TEAM_COLORS[game.home] || "#546480";
    const favP = Math.max(game.homeP ?? 0, game.awayP ?? 0);
    const confidence = (game.homeP === null || game.awayP === null)
        ? "none"
        : favP >= 70 ? "high" : favP >= 58 ? "mid" : "low";

    return (
        <motion.div variants={tile} className="pm-tile p-3 group">
            <div className="flex items-center justify-between mb-2.5">
                <span className="pm-label">{game.time}</span>
                <div className="flex items-center gap-1.5">
                    {isFinal && <span className="pm-badge bg-pitch-700 text-pitch-400 border border-pitch-600">Final</span>}
                    {isLive && <span className="pm-live-badge pm-badge"><span className="pm-live-dot" />{game.period ? `Q${game.period}` : "Live"}</span>}
                    {isScheduled && confidence === "high" && (
                        <Tooltip content="High model confidence">
                            <span className="pm-badge bg-accent/10 text-accent border border-accent/20 flex items-center gap-1"><Flame size={8} /> Edge</span>
                        </Tooltip>
                    )}
                    {isScheduled && confidence !== "high" && <span className="pm-badge bg-pitch-700 text-pitch-400 border border-pitch-600">Tonight</span>}
                </div>
            </div>
            <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 text-center">
                    <div className={`font-display text-xl tracking-wider leading-none mb-0.5 ${fav === "away" ? "" : "text-pitch-300"}`} style={{ color: fav === "away" && fav !== null ? awayColor : undefined }}>{game.away}</div>
                    <div className="text-[10px] text-pitch-500 truncate px-1">{TEAM_NAMES[game.away] || game.away}</div>
                    {(isFinal || isLive) ? <motion.div key={game.awayScore} initial={{ scale: 1.1 }} animate={{ scale: 1 }} className="pm-number text-lg mt-1 text-pitch-100">{game.awayScore}</motion.div>
                        : game.awayP !== null
                            ? <div className="pm-number text-sm mt-1 text-pitch-400">{game.awayP}%</div>
                            : <div className="pm-number text-sm mt-1 text-pitch-600">—</div>}
                </div>
                <div className="flex flex-col items-center gap-0.5">
                    <div className="text-pitch-600 text-xs font-mono">{isFinal || isLive ? "—" : "vs"}</div>
                    {isScheduled && game.spread !== "—" && <div className="text-[9px] text-pitch-600">{game.spread}</div>}
                </div>
                <div className="flex-1 text-center">
                    <div className={`font-display text-xl tracking-wider leading-none mb-0.5 ${fav === "home" ? "" : "text-pitch-300"}`} style={{ color: fav === "home" && fav !== null ? homeColor : undefined }}>{game.home}</div>
                    <div className="text-[10px] text-pitch-500 truncate px-1">{TEAM_NAMES[game.home] || game.home}</div>
                    {(isFinal || isLive) ? <motion.div key={game.homeScore} initial={{ scale: 1.1 }} animate={{ scale: 1 }} className="pm-number text-lg mt-1 text-pitch-100">{game.homeScore}</motion.div>
                        : game.homeP !== null
                            ? <div className="pm-number text-sm mt-1 text-pitch-400">{game.homeP}%</div>
                            : <div className="pm-number text-sm mt-1 text-pitch-600">—</div>}
                </div>
            </div>
            {isScheduled && game.awayP !== null && (
                <div className="mb-2.5">
                    <div className="flex justify-between text-[9px] text-pitch-600 mb-1"><span>{game.away}</span><span>{game.home}</span></div>
                    <div className="h-1.5 rounded-full bg-pitch-700 overflow-hidden relative">
                        <motion.div className="h-full rounded-full absolute top-0 left-0" style={{ background: awayColor, opacity: 0.85 }} initial={{ width: 0 }} animate={{ width: `${game.awayP}%` }} transition={{ duration: 0.8 }} />
                    </div>
                </div>
            )}
            <div className="flex justify-between text-[10px] text-pitch-500">
                <span>{game.spread !== "—" ? <span>Spread: <span className="text-pitch-300">{game.spread}</span></span> : "—"}</span>
                <span>{game.total !== "—" ? <span>O/U: <span className="text-pitch-300">{game.total}</span></span> : null}</span>
            </div>
        </motion.div>
    );
}

function MiniStandings({ teams, conf, onNavigate }) {
    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <div className="pm-label">{conf}</div>
                <button onClick={() => onNavigate("standings")} className="text-[9px] text-pitch-500 hover:text-accent transition-colors flex items-center gap-0.5">Full <ChevronRight size={9} /></button>
            </div>
            <div className="space-y-0">
                {teams.slice(0, 8).map((t, i) => {
                    const isPlayoff = i < 6; const isPlayIn = i >= 6 && i <= 9;
                    return (
                        <div key={t.team} className={`flex items-center gap-2 px-2 py-1.5 rounded-sm transition-colors hover:bg-pitch-700 cursor-pointer ${i === 6 ? "border-t border-dashed border-pitch-600 mt-1 pt-2.5" : ""}`}>
                            <span className="pm-number text-[10px] text-pitch-600 w-4 flex-shrink-0">{i + 1}</span>
                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 opacity-80" style={{ background: TEAM_COLORS[t.team] || "#546480" }} />
                            <TeamLink abbr={t.team} className={`font-display text-sm tracking-wider flex-1 block ${i === 0 ? "text-accent" : isPlayoff ? "text-pitch-200" : "text-pitch-400"}`}>{t.team}</TeamLink>
                            {t.streak && <span className={`text-[9px] font-mono hidden sm:inline ${
                              t.streak.startsWith("W") ? "text-win/60"
                              : t.streak.startsWith("L") ? "text-loss/60"
                              : "text-pitch-500"
                            }`}>{t.streak}</span>}
                            <span className="pm-number text-[10px] text-pitch-400 flex-shrink-0">{t.w}-{t.l}</span>
                            {isPlayIn && <span className="text-[8px] text-draw border border-draw/30 bg-draw/10 px-1 py-0.5 rounded flex-shrink-0">PI</span>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function SummaryTile({ label, value, sub, icon: Icon, trend, color, onClick, badge }) {
    return (
        <motion.div variants={tile} className={`pm-tile p-4 ${onClick ? "cursor-pointer" : ""}`} onClick={onClick} whileHover={onClick ? { scale: 1.01 } : undefined}>
            <div className="flex items-start justify-between mb-2.5">
                <div className="pm-label">{label}</div>
                {Icon && <div className="w-7 h-7 rounded-md bg-pitch-750 border border-pitch-600 flex items-center justify-center flex-shrink-0"><Icon size={13} strokeWidth={1.8} className="text-pitch-400" /></div>}
            </div>
            <div className={`pm-number text-3xl ${color || "text-pitch-50"}`}>{value}</div>
            {(sub || trend || badge) && (
                <div className="flex items-center gap-1.5 mt-2">
                    {trend === "up" && <TrendingUp size={11} className="text-win flex-shrink-0" />}
                    {trend === "down" && <TrendingDown size={11} className="text-loss flex-shrink-0" />}
                    {badge && <span className={`pm-badge text-[9px] px-1.5 py-0.5 ${badge.cls}`}>{badge.label}</span>}
                    {sub && <span className="text-[11px] text-pitch-500 truncate">{sub}</span>}
                </div>
            )}
        </motion.div>
    );
}

// ── Fixed KellyTile — uses real odds from the top edge game ──
function KellyTile({ topEdge, bankroll }) {
  // Use the actual best available odds, fall back to -110 standard juice
  const odds = topEdge.bestFavOdds ?? -110;
  const kelly = kellyBet(topEdge.modelP / 100, odds, bankroll);
  return (
    <motion.div variants={tile} className="pm-tile p-4">
      <div className="flex items-start justify-between mb-2.5">
        <div className="pm-label">Kelly Bet Size</div>
        <div className="w-7 h-7 rounded-md bg-pitch-750 border border-pitch-600 flex items-center justify-center">
          <DollarSign size={13} strokeWidth={1.8} className="text-pitch-400" />
        </div>
      </div>
      <div className="pm-number text-3xl text-pitch-50">{kelly > 0 ? formatCurrency(kelly) : "—"}</div>
      <div className="flex items-center gap-1.5 mt-2">
        <Shield size={10} className="text-pitch-500 flex-shrink-0" />
        <span className="text-[11px] text-pitch-500">
          ½-Kelly · {topEdge.matchup} · {odds > 0 ? `+${odds}` : odds}
        </span>
      </div>
    </motion.div>
  );
}


export default function Dashboard({ onNavigate }) {
    // Games and standings now use ESPN (no key needed) — no hasBdl gate
    const games = useTodayGames();
    const standings = useStandings();
    const { data: oddsData } = useOdds();

    const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" });
    const rawGameList = games.data || [];
    const gameList = useMemo(() => mergeOddsIntoGames(rawGameList, oddsData) || [], [rawGameList, oddsData]);
    const eastList = standings.data?.east || [];
    const westList = standings.data?.west || [];
    const liveCount = gameList.filter(g => g.status === "live").length;
    const gameCount = gameList.length;

    const { bets } = useBets();

    const betStats = useMemo(() => {
        if (!bets.length) return { total: 0, wins: 0, losses: 0, pending: 0, pl: 0 };
        const wins    = bets.filter(b => b.result === "win").length;
        const losses  = bets.filter(b => b.result === "loss").length;
        const pending = bets.filter(b => b.result === "pending").length;
        const pl      = bets.reduce((s, b) => s + calcPL(b.stake, b.odds, b.result), 0);
        return { total: bets.length, wins, losses, pending, pl };
    }, [bets]);

    const bankroll = Number(lsGet("bankroll")) || DEFAULT_BANKROLL;

  const topEdge = useMemo(() => {
    if (oddsData && Object.keys(oddsData).length > 0) {
      const cards = Object.entries(oddsData).map(([key, o]) => {
        const [away, home] = key.split("@");
        // Determine which side is the model's favorite
        const favIsHome = o.homeP >= o.awayP;
        const modelP = favIsHome ? o.homeP : o.awayP;
        // The market's vig-removed implied probability for THAT SAME SIDE
        const marketP = favIsHome ? o.consHomeP : o.consAwayP;
        const bestFavOdds = favIsHome ? o.bestHomeOdds : o.bestAwayOdds;
        return {
          matchup: `${away} @ ${home}`,
          fav: favIsHome ? home : away,
          modelP,
          impliedP: marketP,   // now actually the market's probability for the same side
          bestFavOdds,
          edge: modelP - marketP,
        };
      });
      return cards.reduce((best, g) => g.edge > best.edge ? g : best,
        { matchup: "—", fav: "—", modelP: 0, impliedP: 0, bestFavOdds: null, edge: 0 });
    }
    // Fallback to static ODDS_GAMES
    if (!ODDS_GAMES.length) return { matchup: "—", fav: "—", modelP: 0, impliedP: 0, bestFavOdds: null, edge: 0 };
    return ODDS_GAMES.reduce((best, g) => (g.modelP - g.impliedP) > (best.modelP - best.impliedP) ? g : best);
  }, [oddsData]);

    const bestProb = useMemo(() => {
        if (oddsData && Object.keys(oddsData).length > 0) {
            const cards = Object.entries(oddsData).map(([key, o]) => { const [away, home] = key.split("@"); return { matchup: `${away} @ ${home}`, fav: o.homeP >= o.awayP ? home : away, modelP: Math.max(o.homeP, o.awayP) }; });
            return cards.reduce((best, g) => g.modelP > best.modelP ? g : best, { matchup: "—", fav: "—", modelP: 0 });
        }
        if (!ODDS_GAMES.length) return { matchup: "—", fav: "—", modelP: 0 };
        return ODDS_GAMES.reduce((best, g) => g.modelP > best.modelP ? g : best);
    }, [oddsData]);

    const betSub = betStats.total > 0 ? `${betStats.wins}W · ${betStats.losses}L · ${betStats.pending} open` : "No bets logged yet";
    const edgeDiff = topEdge.modelP - topEdge.impliedP;

    return (
        <motion.div variants={container} initial="hidden" animate="show" exit={{ opacity: 0, y: -6 }} className="grid grid-cols-12 gap-3">
            <motion.div variants={tile} className="col-span-12">
                <div className="flex items-center justify-between mb-2">
                    <div className="pm-label">{today}</div>
                    <FreshnessTag isFetching={games.isFetching || standings.isFetching} dataUpdatedAt={games.dataUpdatedAt} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <SummaryTile label="Games Today" value={gameCount || "—"} sub={liveCount > 0 ? `${liveCount} in progress` : "Tip-off tonight"} icon={Target} trend={liveCount > 0 ? "up" : null} badge={liveCount > 0 ? { label: "LIVE", cls: "bg-win/10 text-win border border-win/20" } : null} onClick={() => onNavigate("scores")} />
                    <SummaryTile label="Top Model Edge" value={edgeDiff > 0 ? `+${edgeDiff.toFixed(1)}%` : "—"} sub={topEdge.matchup} icon={TrendingUp} trend="up" color={edgeDiff >= 10 ? "text-win" : edgeDiff >= 5 ? "text-draw" : "text-pitch-50"} onClick={() => onNavigate("betting")} />
                    <SummaryTile label="Best Win Prob" value={bestProb.modelP > 0 ? `${bestProb.modelP}%` : "—"} sub={bestProb.fav !== "—" ? `${bestProb.fav} · ${bestProb.matchup}` : "No data"} icon={Zap} onClick={() => onNavigate("betting")} />
                    <SummaryTile label="Net P&L" value={betStats.total > 0 ? formatCurrency(betStats.pl) : "—"} sub={betSub} icon={BarChart2} color={betStats.pl > 0 ? "text-win" : betStats.pl < 0 ? "text-loss" : "text-pitch-50"} trend={betStats.pl > 0 ? "up" : betStats.pl < 0 ? "down" : null} onClick={() => onNavigate("tracker")} />
                </div>
            </motion.div>

            <div className="col-span-12 lg:col-span-8">
                <div className="flex items-center justify-between mb-2">
                    <div className="pm-label">Today's Games{liveCount > 0 && <span className="ml-2 pm-badge bg-win/10 text-win border border-win/20 inline-flex items-center gap-1"><span className="pm-live-dot" />{liveCount} live</span>}</div>
                    <button onClick={() => onNavigate("scores")} className="flex items-center gap-1 text-[10px] text-pitch-500 hover:text-accent transition-colors">View all <ChevronRight size={10} /></button>
                </div>
                {games.isError ? (
                    <ErrorState message="Couldn't load today's games." onRetry={() => games.refetch()} type="network" />
                ) : games.isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <TileSkeleton key={i} lines={4} />)}</div>
                ) : gameList.length === 0 ? (
                    <div className="pm-card p-12 text-center"><Activity size={28} className="text-pitch-700 mx-auto mb-3" /><div className="text-sm text-pitch-500">No games scheduled today.</div></div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"><AnimatePresence>{gameList.slice(0, 6).map(g => <GameTile key={g.id} game={g} />)}</AnimatePresence></div>
                )}
                {gameList.length > 6 && <button onClick={() => onNavigate("scores")} className="mt-3 w-full pm-btn-ghost text-center justify-center">+{gameList.length - 6} more games <ChevronRight size={13} /></button>}
            </div>

            <div className="col-span-12 lg:col-span-4 space-y-3">
                {oddsData && Object.keys(oddsData).length > 0 && topEdge.modelP > 0 && <KellyTile topEdge={topEdge} bankroll={bankroll} />}
                <motion.div variants={tile} className="pm-card p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="pm-label">Standings</div>
                        <button onClick={() => onNavigate("standings")} className="text-[10px] text-pitch-500 hover:text-accent transition-colors flex items-center gap-0.5">Full table <ChevronRight size={10} /></button>
                    </div>
                    {standings.isError ? <ErrorState message="Couldn't load standings." onRetry={() => standings.refetch()} /> : standings.isLoading ? <RowSkeleton rows={8} /> : (
                        <div className="space-y-4">
                            <MiniStandings teams={eastList} conf="Eastern" onNavigate={onNavigate} />
                            <div className="pm-divider" />
                            <MiniStandings teams={westList} conf="Western" onNavigate={onNavigate} />
                        </div>
                    )}
                </motion.div>
                <motion.div variants={tile} className="pm-card p-4">
                    <div className="pm-label mb-3">Quick access</div>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { label: "Line Shopping", id: "betting", icon: TrendingUp, color: "text-accent" },
                            { label: "Bet Tracker", id: "tracker", icon: BarChart2, color: "text-win" },
                            { label: "Four Factors", id: "analytics", icon: Activity, color: "text-draw" },
                            { label: "Players", id: "players", icon: Zap, color: "text-pitch-300" },
                        ].map(item => (
                            <button key={item.id} onClick={() => onNavigate(item.id)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-pitch-750 border border-pitch-700 hover:border-pitch-500 hover:bg-pitch-700 transition-all group text-left">
                                <item.icon size={13} strokeWidth={1.8} className={`${item.color} flex-shrink-0`} />
                                <span className="text-[11px] text-pitch-300 group-hover:text-pitch-100 transition-colors font-medium">{item.label}</span>
                            </button>
                        ))}
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
}