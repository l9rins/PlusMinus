import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    TrendingUp, TrendingDown, Target, BarChart2,
    Zap, ChevronRight, Activity, DollarSign, Flame, Shield,
    ArrowUpRight, Users, Bell, Search, Filter,
} from "lucide-react";
import { TEAM_NAMES, ODDS_GAMES, TEAM_COLORS } from "../data";
import { useStandings, useTodayGames, useOdds, mergeOddsIntoGames, useBets, useEloData } from "../api";
import { formatCurrency, formatPct, lsGet, calcROI, calcPL, eloWinProb, kellyBet, DEFAULT_BANKROLL } from "../utils";
import { TileSkeleton, RowSkeleton, ErrorState, FreshnessTag, Tooltip, TeamLink, AnimatedNumber, MagneticButton } from "./ui";
import { 
    PremiumCard, 
    PremiumCardHeader, 
    PremiumCardTitle, 
    PremiumCardDescription, 
    PremiumCardContent 
} from "./ui/premium-card";
import { Badge } from "./ui/badge";
import GameWinProb from "./GameWinProb";
import RefCallout from "./RefCallout";
import { cn } from "../lib/utils";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

function GameTile({ game, eloMap }) {
    const navigate = useNavigate();
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
        return { fav, isFinal, isLive, isScheduled, awayColor, homeColor, confidence };
    }, [game]);
    
    const { fav, isFinal, isLive, isScheduled, awayColor, homeColor, confidence } = memoized;

    return (
        <PremiumCard className="p-5 h-full flex flex-col justify-between group cursor-pointer" onClick={() => navigate("/scores")}>
            <div>
                <div className="flex items-center justify-between mb-6">
                    <span className="text-[10px] font-bold text-morphin-muted uppercase tracking-[2px]">{game.time}</span>
                    <div className="flex items-center gap-2">
                        {isLive && <Badge variant="destructive" className="animate-pulse bg-loss text-white border-none text-[9px]">LIVE</Badge>}
                        {isFinal && <Badge variant="secondary" className="text-[9px]">FINAL</Badge>}
                        {isScheduled && confidence === "high" && <Badge className="bg-win text-white border-none text-[9px] flex items-center gap-1"><Flame size={10} /> EDGE</Badge>}
                    </div>
                </div>

                <div className="flex items-center justify-between gap-4 mb-4">
                    <div className="flex flex-col items-center flex-1">
                        <div className="w-12 h-12 rounded-2xl bg-morphin-ghost flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-sm" style={{ borderBottom: `3px solid ${awayColor}` }}>
                             <span className="font-display font-bold text-lg">{game.away}</span>
                        </div>
                        <span className={cn("text-2xl font-display font-bold", fav === "away" ? "text-morphin-text" : "text-morphin-muted")}>
                             {isLive || isFinal ? game.awayScore : (game.awayP ? `${game.awayP}%` : "—")}
                        </span>
                    </div>

                    <div className="text-[10px] font-bold text-morphin-muted uppercase tracking-widest pt-4">VS</div>

                    <div className="flex flex-col items-center flex-1">
                        <div className="w-12 h-12 rounded-2xl bg-morphin-ghost flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-sm" style={{ borderBottom: `3px solid ${homeColor}` }}>
                             <span className="font-display font-bold text-lg">{game.home}</span>
                        </div>
                        <span className={cn("text-2xl font-display font-bold", fav === "home" ? "text-morphin-text" : "text-morphin-muted")}>
                             {isLive || isFinal ? game.homeScore : (game.homeP ? `${game.homeP}%` : "—")}
                        </span>
                    </div>
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-morphin-border">
                 <div className="flex justify-between items-center text-[11px] font-semibold text-morphin-muted">
                    <span>{game.spread !== "—" ? `Spread: ${game.spread}` : "No Spread"}</span>
                    <span>{game.total !== "—" ? `O/U: ${game.total}` : ""}</span>
                 </div>
            </div>
        </PremiumCard>
    );
}

function MiniStandings({ teams, conf }) {
    return (
        <div className="space-y-3">
            <div className="text-[10px] font-bold text-morphin-muted uppercase tracking-[3px] mb-4">{conf} Conference</div>
            {teams.slice(0, 5).map((t, i) => (
                <div key={t.team} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-morphin-muted w-4">{i + 1}</span>
                        <div className="w-6 h-6 rounded-lg bg-morphin-ghost flex items-center justify-center border border-morphin-border text-[9px] font-bold group-hover:bg-morphin-border transition-colors">
                            {t.team}
                        </div>
                        <TeamLink abbr={t.team} className="text-xs font-bold text-morphin-text hover:text-morphin-accent transition-colors">{t.team}</TeamLink>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-morphin-muted">{t.w}-{t.l}</span>
                </div>
            ))}
        </div>
    );
}

function SummaryStat({ label, value, sub, icon: Icon, trend, trendValue, onClick }) {
    return (
        <PremiumCard className="p-6 cursor-pointer hover:bg-morphin-ghost/50 transition-all border-none bg-transparent shadow-none" onClick={onClick}>
            <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-2xl bg-white border border-morphin-border flex items-center justify-center text-morphin-muted shadow-sm">
                    <Icon size={18} strokeWidth={2.5} />
                </div>
                {trend && (
                    <div className={cn("flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full", 
                        trend === "up" ? "bg-win/10 text-win" : "bg-loss/10 text-loss")}>
                        {trend === "up" ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {trendValue}
                    </div>
                )}
            </div>
            <div className="space-y-1">
                <span className="text-[10px] font-bold text-morphin-muted uppercase tracking-[2px]">{label}</span>
                <div className="text-3xl font-display font-black text-morphin-text leading-tight">{value}</div>
                <div className="text-[11px] font-medium text-morphin-muted truncate">{sub}</div>
            </div>
        </PremiumCard>
    );
}

export default function Dashboard() {
    const navigate = useNavigate();
    const games = useTodayGames();
    const standings = useStandings();
    const { data: oddsData } = useOdds();
    const { data: eloApiData } = useEloData();
    const { bets } = useBets();
    
    const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric" });
    
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

    const bankroll = Number(lsGet("bankroll")) || DEFAULT_BANKROLL;

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
                return { matchup: `${away} @ ${home}`, fav: homeWinP >= awayWinP ? home : away, modelP: Math.round(Math.max(homeWinP, awayWinP)) }; 
            });
            return cards.reduce((best, g) => g.modelP > best.modelP ? g : best, { matchup: "—", fav: "—", modelP: 0 });
        }
        return { matchup: "—", fav: "—", modelP: 0 };
    }, [oddsData, elos]);

    const edgeDiff = topEdge.modelP - topEdge.impliedP;

    return (
        <div className="max-w-[1400px] mx-auto px-6 py-10">
            {/* Header / Top Stats */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div>
                    <h1 className="font-display text-5xl font-black text-morphin-text tracking-tight mb-2">Overview</h1>
                    <p className="text-morphin-muted font-semibold tracking-[4px] uppercase text-xs">{today}</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-6 py-3 bg-morphin-ghost rounded-2xl hover:bg-morphin-border transition-all text-xs font-bold uppercase tracking-widest text-morphin-text shadow-sm border border-morphin-border/50">
                        <Filter size={16} strokeWidth={2.5} />
                        Customize
                    </button>
                    <button className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-2xl hover:bg-morphin-accent transition-all text-xs font-bold uppercase tracking-widest shadow-xl shadow-black/10">
                        <ArrowUpRight size={16} strokeWidth={2.5} />
                        Pro Analytics
                    </button>
                </div>
            </div>

            <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                <SummaryStat 
                    label="Games Scheduled" 
                    value={gameCount || "0"} 
                    sub={liveCount > 0 ? `${liveCount} Live Matches` : "Tip-off tonight"} 
                    icon={Target} 
                    trend={liveCount > 0 ? "up" : null}
                    trendValue="LIVE"
                    onClick={() => navigate("/scores")}
                />
                <SummaryStat 
                    label="Top Model Edge" 
                    value={edgeDiff > 0 ? `+${edgeDiff.toFixed(1)}%` : "0.0%"} 
                    sub={topEdge.matchup} 
                    icon={TrendingUp} 
                    trend="up"
                    trendValue="ALPHA"
                    onClick={() => navigate("/betting")}
                />
                <SummaryStat 
                    label="Highest Win Prob" 
                    value={bestProb.modelP > 0 ? `${bestProb.modelP}%` : "—"} 
                    sub={bestProb.fav !== "—" ? `${bestProb.fav} Highlight` : "Calculating..."} 
                    icon={Zap} 
                    onClick={() => navigate("/scores")}
                />
                <SummaryStat 
                    label="Portfolio P&L" 
                    value={betStats.total > 0 ? formatCurrency(betStats.pl) : "$0.00"} 
                    sub={`${betStats.wins}W · ${betStats.losses}L`} 
                    icon={BarChart2} 
                    trend={betStats.pl >= 0 ? "up" : "down"}
                    trendValue={betStats.total > 0 ? `${Math.round((betStats.wins/betStats.total)*100)}% WR` : "0% WR"}
                    onClick={() => navigate("/tracker")}
                />
            </motion.div>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Main: Today's Games */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-xl font-black text-morphin-text tracking-tight">Today's Slate</h2>
                        <button onClick={() => navigate("/scores")} className="text-[10px] font-bold text-morphin-muted uppercase tracking-[3px] hover:text-morphin-accent transition-colors">See Performance <ChevronRight size={14} className="inline" /></button>
                    </div>
                    {games.isLoading ? (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[1,2,3,4].map(i => <div key={i} className="h-64 rounded-3xl bg-morphin-ghost animate-pulse" />)}
                         </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {gameList.slice(0, 4).map(g => (
                                <GameTile key={g.id} game={g} eloMap={elos} />
                            ))}
                        </div>
                    )}
                    {gameList.length > 4 && (
                        <button 
                            onClick={() => navigate("/scores")}
                            className="w-full py-6 rounded-3xl border-2 border-dashed border-morphin-border text-morphin-muted hover:text-morphin-text hover:border-morphin-text transition-all font-bold text-sm tracking-widest uppercase"
                        >
                            +{gameList.length - 4} More Matchups
                        </button>
                    )}
                </div>

                {/* Sidebar: Standings & Quick Access */}
                <div className="lg:col-span-4 space-y-6">
                    <PremiumCard className="p-8">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-lg font-black text-morphin-text tracking-tight">Standings</h2>
                            <button onClick={() => navigate("/standings")} className="p-2 hover:bg-morphin-ghost rounded-xl transition-colors text-morphin-muted">
                                <ArrowUpRight size={18} />
                            </button>
                        </div>
                        {standings.isLoading ? (
                             <div className="space-y-4 animate-pulse">
                                {[1,2,3,4,5].map(i => <div key={i} className="h-4 bg-morphin-ghost rounded" />)}
                             </div>
                        ) : (
                            <div className="space-y-10">
                                <MiniStandings teams={eastList} conf="East" />
                                <MiniStandings teams={westList} conf="West" />
                            </div>
                        )}
                    </PremiumCard>

                    <PremiumCard className="p-8 bg-morphin-ghost/30 border-none shadow-none">
                         <h2 className="text-lg font-black text-morphin-text tracking-tight mb-6">Quick Links</h2>
                         <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: "Odds Edge", icon: TrendingUp, path: "/betting", color: "text-win" },
                                { label: "Stat Lab", icon: Activity, path: "/analytics", color: "text-morphin-accent" },
                                { label: "Rosters", icon: Users, path: "/players", color: "text-loss" },
                                { label: "History", icon: Bell, path: "/tracker", color: "text-draw" },
                            ].map(link => (
                                <button key={link.label} onClick={() => navigate(link.path)} className="flex flex-col gap-4 p-5 bg-white rounded-2xl border border-morphin-border hover:shadow-xl hover:scale-105 transition-all group text-left">
                                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center bg-morphin-ghost transition-colors", link.color)}>
                                        <link.icon size={16} strokeWidth={2.5} />
                                    </div>
                                    <span className="text-[11px] font-bold text-morphin-text uppercase tracking-widest">{link.label}</span>
                                </button>
                            ))}
                         </div>
                    </PremiumCard>
                </div>

            </div>
        </div>
    );
}