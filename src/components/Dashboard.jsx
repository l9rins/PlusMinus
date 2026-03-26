import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    TrendingUp, TrendingDown, Target, BarChart2,
    Zap, ChevronRight, Activity, DollarSign, Flame, Shield,
} from "lucide-react";
import { TEAM_NAMES, ODDS_GAMES, TEAM_COLORS } from "../data";
import { useStandings, useTodayGames, useOdds, mergeOddsIntoGames, useBets, useEloData } from "../api";
import { formatCurrency, formatPct, lsGet, calcROI, calcPL, eloWinProb, kellyBet, DEFAULT_BANKROLL } from "../utils";
import { TileSkeleton, RowSkeleton, ErrorState, FreshnessTag, Tooltip, TeamLink, AnimatedNumber, MagneticButton } from "./ui";
import GameWinProb from "./GameWinProb";
import RefCallout from "./RefCallout";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } } };
const tile = { hidden: { opacity: 0, y: 14, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] } } };

function GameTile({ game, eloMap }) {
    const memoized = useMemo(() => {
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
        const awayName = TEAM_NAMES[game.away] || game.away;
        const homeName = TEAM_NAMES[game.home] || game.home;
        return { fav, isFinal, isLive, isScheduled, awayColor, homeColor, confidence, awayName, homeName };
    }, [game]);
    const { fav, isFinal, isLive, isScheduled, awayColor, homeColor, confidence, awayName, homeName } = memoized;

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
                    <div className="text-[10px] text-pitch-500 truncate px-1">{awayName}</div>
                    {(isFinal || isLive) ? <AnimatedNumber value={game.awayScore ?? 0} className="pm-number text-lg mt-1 text-pitch-100" />
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
                    <div className="text-[10px] text-pitch-500 truncate px-1">{homeName}</div>
                    {(isFinal || isLive) ? <AnimatedNumber value={game.homeScore ?? 0} className="pm-number text-lg mt-1 text-pitch-100" />
                        : game.homeP !== null
                            ? <div className="pm-number text-sm mt-1 text-pitch-400">{game.homeP}%</div>
                            : <div className="pm-number text-sm mt-1 text-pitch-600">—</div>}
                </div>
            </div>
                <div className="mt-4 pt-3 border-t border-pitch-750/50 space-y-3">
                    <GameWinProb game={game} eloMap={eloMap} />
                    <RefCallout matchup={`${game.away} @ ${game.home}`} />
                </div>
            <div className="flex justify-between text-[10px] text-pitch-500">
                <span>{game.spread !== "—" ? <span>Spread: <span className="text-pitch-300">{game.spread}</span></span> : "—"}</span>
                <span>{game.total !== "—" ? <span>O/U: <span className="text-pitch-300">{game.total}</span></span> : null}</span>
            </div>
        </motion.div>
    );
}

function MiniStandings({ teams, conf }) {
    const navigate = useNavigate();
    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <div className="pm-label">{conf}</div>
                <MagneticButton strength={0.2} onClick={() => navigate("/standings")}>
                    <div className="text-[9px] text-pitch-500 hover:text-accent transition-colors flex items-center gap-0.5 px-2 py-1 bg-pitch-750/50 rounded-md border border-pitch-700/50">
                        Full <ChevronRight size={9} />
                    </div>
                </MagneticButton>
            </div>
            <div className="space-y-0">
                {teams.slice(0, 8).map((t, i) => {
                    const isPlayoff = i < 6;
                    const isPlayIn = i >= 6 && i <= 9;
                    const color = TEAM_COLORS[t.team] || "#546480";
                    return (
                        <div key={`${t.team}-${i}`} className={`flex items-center gap-2 px-2 py-1.5 rounded-sm transition-colors hover:bg-pitch-700 cursor-pointer ${i === 6 ? "border-t border-dashed border-pitch-600 mt-1 pt-2.5" : ""}`}>
                            <span className="pm-number text-[10px] text-pitch-600 w-4 flex-shrink-0">{i + 1}</span>
                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 opacity-80" style={{ background: color }} />
                            <TeamLink abbr={t.team} className={`font-display text-sm tracking-wider flex-1 block ${i === 0 ? "text-accent" : isPlayoff ? "text-pitch-200" : "text-pitch-400"}`}>{t.team}</TeamLink>
                            {t.streak && <span className={`text-[9px] font-mono hidden sm:inline ${t.streak.startsWith("W") ? "text-win/60" : t.streak.startsWith("L") ? "text-loss/60" : "text-pitch-500"}`}>{t.streak}</span>}
                            <span className="pm-number text-[10px] text-pitch-400 flex-shrink-0">{t.w}-{t.l}</span>
                            {isPlayIn && <span className="text-[8px] text-draw border border-draw/30 bg-draw/10 px-1 py-0.5 rounded flex-shrink-0">PI</span>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function SummaryTile({ label, value, sub, icon: Icon, trend, color, onClick, badge, tooltip }) {
    return (
        <motion.div variants={tile} className={`pm-tile p-4 ${onClick ? "cursor-pointer" : ""}`} onClick={onClick} whileHover={onClick ? { scale: 1.01 } : undefined}>
            <div className="flex items-start justify-between mb-2.5">
                <Tooltip content={tooltip}>
                    <div className="pm-label truncate pr-2">{label}</div>
                </Tooltip>
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

function KellyTile({ topEdge, bankroll }) {
    const odds = topEdge.bestFavOdds ?? -110;
    const kelly = kellyBet(topEdge.modelP / 100, odds, bankroll);
    return (
        <motion.div variants={tile} className="pm-tile p-4">
            <div className="flex items-start justify-between mb-2.5">
                <Tooltip content="Optimal bet size based on model edge and bankroll risk management.">
                    <div className="pm-label truncate pr-2">Kelly Bet Size</div>
                </Tooltip>
                <div className="w-7 h-7 rounded-md bg-pitch-750 border border-pitch-600 flex items-center justify-center">
                    <DollarSign size={13} strokeWidth={1.8} className="text-pitch-400" />
                </div>
            </div>
            <div className="pm-number text-3xl text-pitch-50">{kelly > 0 ? formatCurrency(kelly) : "—"}</div>
            <div className="flex items-center gap-1.5 mt-2">
                <Shield size={10} className="text-pitch-500 flex-shrink-0" />
                <span className="text-[11px] text-pitch-500">½-Kelly · {topEdge.matchup} · {odds > 0 ? `+${odds}` : odds}</span>
            </div>
        </motion.div>
    );
}

export default function Dashboard() {
    const navigate = useNavigate();
    const games = useTodayGames();
    const standings = useStandings();
    const { data: oddsData } = useOdds();
    const { data: eloApiData } = useEloData();
    const { bets } = useBets();
    const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });
    const rawGameList = games.data || [];
    const gameList = useMemo(() => mergeOddsIntoGames(rawGameList, oddsData) || [], [rawGameList, oddsData]);
    const eastList = standings.data?.east || [];
    const westList = standings.data?.west || [];
    const liveCount = gameList.filter(g => g.status === "live").length;
    const gameCount = gameList.length;

    const betStats = useMemo(() => {
        if (!bets.length) return { total: 0, wins: 0, losses: 0, pending: 0, pl: 0 };
        const wins = bets.filter(b => b.result === "win").length;
        const losses = bets.filter(b => b.result === "loss").length;
        const pending = bets.filter(b => b.result === "pending").length;
        const pl = bets.reduce((s, b) => s + calcPL(b.stake, b.odds, b.result), 0);
        return { total: bets.length, wins, losses, pending, pl };
    }, [bets]);

    // FIX: bankroll zero/negative guard.
    //
    // Previous: Number(lsGet("bankroll")) || DEFAULT_BANKROLL
    // Bug: Number(0) is falsy, so a user who intentionally sets bankroll=0
    // (empty/cleared state) silently gets DEFAULT_BANKROLL instead.
    // Number("invalid") is NaN which is also falsy — that case was fine.
    // But Number(-50) is truthy and would pass through as a negative bankroll,
    // causing kellyBet to return 0 (already guarded there, but defensive here too).
    //
    // Fix: explicit isFinite + positive check. Only use DEFAULT_BANKROLL when
    // the stored value is missing, non-numeric, or non-positive.
    const storedBankroll = Number(lsGet("bankroll"));
    const bankroll = Number.isFinite(storedBankroll) && storedBankroll > 0
        ? storedBankroll
        : DEFAULT_BANKROLL;

    const elos = useMemo(() => {
        const allTeams = [...(standings.data?.east || []), ...(standings.data?.west || [])];
        const res = {};
        allTeams.forEach(t => {
            const apiEntry = eloApiData?.teams?.find(e => e.team === t.team);
            res[t.team] = apiEntry ? apiEntry.elo : Math.round(1500 + (t.pct - 0.5) * 600);
        });
        return res;
    }, [standings.data, eloApiData]);

    const topEdge = useMemo(() => {
        const odds = oddsData?.data || oddsData;
        if (odds && Object.keys(odds).length > 0) {
            const cards = Object.entries(odds).map(([key, o]) => {
                const [away, home] = key.split("@");
                
                const homeElo = elos[home] || 1500;
                const awayElo = elos[away] || 1500;
                const homeWinP = eloWinProb(awayElo, homeElo, true) * 100;
                const awayWinP = eloWinProb(homeElo, awayElo, false) * 100;
                
                const favIsHome = homeWinP >= awayWinP;
                const modelP = favIsHome ? homeWinP : awayWinP;
                const marketP = (favIsHome ? o.consHomeP : o.consAwayP) ?? (favIsHome ? o.homeP : o.awayP);
                const bestFavOdds = favIsHome ? o.bestHomeOdds : o.bestAwayOdds;
                return {
                    matchup: `${away} @ ${home}`,
                    fav: favIsHome ? home : away,
                    modelP, impliedP: marketP, bestFavOdds,
                    edge: isNaN(modelP - marketP) ? 0 : modelP - marketP,
                };
            });
      return cards.reduce((best, g) => g.edge > best.edge ? g : best,
        { matchup: "—", fav: "—", modelP: 0, impliedP: 0, bestFavOdds: null, edge: 0 });
    }
    return { matchup: "—", fav: "—", modelP: 0, impliedP: 0, bestFavOdds: null, edge: 0 };
  }, [oddsData, elos]);

    const bestProb = useMemo(() => {
        const odds = oddsData?.data || oddsData;
        if (odds && Object.keys(odds).length > 0) {
            const cards = Object.entries(odds).map(([key, o]) => { 
                const [away, home] = key.split("@"); 
                const homeElo = elos[home] || 1500;
                const awayElo = elos[away] || 1500;
                const homeWinP = eloWinProb(awayElo, homeElo, true) * 100;
                const awayWinP = eloWinProb(homeElo, awayElo, false) * 100;
                
                return { matchup: `${away} @ ${home}`, fav: homeWinP >= awayWinP ? home : away, modelP: Math.max(homeWinP, awayWinP) }; 
            });
      return cards.reduce((best, g) => g.modelP > best.modelP ? g : best, { matchup: "—", fav: "—", modelP: 0 });
    }
    return { matchup: "—", fav: "—", modelP: 0 };
  }, [oddsData, elos]);

    const betSub = betStats.total > 0 ? `${betStats.wins}W · ${betStats.losses}L · ${betStats.pending} open` : "No bets logged yet";
    const edgeDiff = topEdge.modelP - topEdge.impliedP;

    return (
        <motion.div variants={container} initial="hidden" animate="show" exit={{ opacity: 0, y: -6 }} className="grid grid-cols-12 gap-3">
            <motion.div variants={tile} className="col-span-12">
                <div className="flex items-center justify-between mb-2">
                    <div className="pm-label">{today}</div>
                    <div className="flex items-center gap-2">
                        {oddsData?.stale && <span className="text-[9px] text-draw/70 hidden sm:inline-block border border-draw/30 bg-draw/10 px-1.5 py-0.5 rounded cursor-help" title="Using cached odds.">Stale Odds</span>}
                        <FreshnessTag isFetching={games.isFetching || standings.isFetching} dataUpdatedAt={games.dataUpdatedAt} />
                    </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <SummaryTile label="Games Today" value={gameCount || "—"} sub={gameCount === 0 ? "No games today" : liveCount > 0 ? `${liveCount} in progress` : "Tip-off tonight"} icon={Target} trend={liveCount > 0 ? "up" : null} badge={liveCount > 0 ? { label: "LIVE", cls: "bg-win/10 text-win border border-win/20" } : null} onClick={() => navigate("/scores")} tooltip="Total NBA games scheduled for the current broadcast window." />
                    <SummaryTile label="Top Model Edge" value={edgeDiff > 0 ? `+${edgeDiff.toFixed(1)}%` : "—"} sub={topEdge.matchup} icon={TrendingUp} trend="up" color={edgeDiff >= 10 ? "text-win" : edgeDiff >= 5 ? "text-draw" : "text-pitch-50"} onClick={() => navigate("/betting")} tooltip="Variance between predicted win probability and consensus market odds." />
                    <SummaryTile label="Best Win Prob" value={bestProb.modelP > 0 ? `${bestProb.modelP}%` : "—"} sub={bestProb.fav !== "—" ? `${bestProb.fav} · ${bestProb.matchup}` : "No data"} icon={Zap} onClick={() => navigate("/betting")} tooltip="Highest confidence prediction across all scheduled matchups." />
                    <SummaryTile label="Net P&L" value={betStats.total > 0 ? formatCurrency(betStats.pl) : "—"} sub={betSub} icon={BarChart2} color={betStats.pl > 0 ? "text-win" : betStats.pl < 0 ? "text-loss" : "text-pitch-50"} trend={betStats.pl > 0 ? "up" : betStats.pl < 0 ? "down" : null} onClick={() => navigate("/tracker")} tooltip="Cumulative profit or loss across all settled bets." />
                </div>
            </motion.div>

            <div className="col-span-12 lg:col-span-8">
                <div className="flex items-center justify-between mb-2">
                    <div className="pm-label">Today's Games{liveCount > 0 && <span className="ml-2 pm-badge bg-win/10 text-win border border-win/20 inline-flex items-center gap-1"><span className="pm-live-dot" />{liveCount} live</span>}</div>
                    <button onClick={() => navigate("/scores")} className="flex items-center gap-1 text-[10px] text-pitch-500 hover:text-accent transition-colors">View all <ChevronRight size={10} /></button>
                </div>
                {games.isError ? (
                    <ErrorState message="Couldn't load today's games." onRetry={() => games.refetch()} type="network" />
                ) : games.isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <TileSkeleton key={i} lines={4} />)}</div>
                ) : gameList.length === 0 ? (
                    <div className="pm-card p-12 text-center"><Activity size={28} className="text-pitch-700 mx-auto mb-3" /><div className="text-sm text-pitch-500">No games scheduled today.</div></div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"><AnimatePresence>{gameList.slice(0, 6).map(g => <GameTile key={g.id} game={g} eloMap={elos} />)}</AnimatePresence></div>
                )}
                {gameList.length > 6 && <button onClick={() => navigate("/scores")} className="mt-3 w-full pm-btn-ghost text-center justify-center">+{gameList.length - 6} more games <ChevronRight size={13} /></button>}
            </div>

            <div className="col-span-12 lg:col-span-4 space-y-3">
                {oddsData && Object.keys(oddsData).length > 0 && topEdge.modelP > 0 && <KellyTile topEdge={topEdge} bankroll={bankroll} />}
                <motion.div variants={tile} className="pm-card p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="pm-label">Standings</div>
                        <button onClick={() => navigate("/standings")} className="text-[10px] text-pitch-500 hover:text-accent transition-colors flex items-center gap-0.5">Full table <ChevronRight size={10} /></button>
                    </div>
                    {standings.isError ? <ErrorState message="Couldn't load standings." onRetry={() => standings.refetch()} /> : standings.isLoading ? <RowSkeleton rows={8} /> : (
                        <div className="space-y-4">
                            <MiniStandings teams={eastList} conf="Eastern" />
                            <div className="pm-divider" />
                            <MiniStandings teams={westList} conf="Western" />
                        </div>
                    )}
                </motion.div>
                <motion.div variants={tile} className="pm-card p-4">
                    <div className="pm-label mb-3">Quick access</div>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { label: "Line Shopping", path: "/betting", icon: TrendingUp, color: "text-accent" },
                            { label: "Bet Tracker", path: "/tracker", icon: BarChart2, color: "text-win" },
                            { label: "Four Factors", path: "/analytics?tab=factors", icon: Activity, color: "text-draw" },
                            { label: "Players", path: "/players", icon: Zap, color: "text-pitch-300" },
                        ].map(item => (
                            <button key={item.path} onClick={() => navigate(item.path)}
                                className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-pitch-750 border border-pitch-700 hover:border-pitch-500 hover:bg-pitch-700 transition-all group text-left">
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