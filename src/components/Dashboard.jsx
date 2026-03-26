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

// GameTile — Neon Dark Edition
// Drop this inside Dashboard.jsx to replace the existing GameTile function.
// Uses Neon's dense dark card style with colored team-bar accents.

function GameTile({ game, eloMap }) {
  const navigate = useNavigate();
  const { fav, isFinal, isLive, isScheduled, awayColor, homeColor, confidence } = useMemo(() => {
    const fav = (game.homeP === null || game.awayP === null)
      ? null : game.homeP >= game.awayP ? "home" : "away";
    const favP = Math.max(game.homeP ?? 0, game.awayP ?? 0);
    return {
      fav,
      isFinal: game.status === "final",
      isLive: game.status === "live",
      isScheduled: game.status === "scheduled",
      awayColor: TEAM_COLORS[game.away] || "#374151",
      homeColor: TEAM_COLORS[game.home] || "#374151",
      confidence: favP >= 70 ? "high" : favP >= 58 ? "mid" : "low",
    };
  }, [game]);

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      onClick={() => navigate("/scores")}
      className="cursor-pointer rounded-xl p-4 flex flex-col gap-4 h-full"
      style={{
        background: "var(--neon-surface)",
        border: "1px solid var(--neon-border)",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = "var(--neon-border-md)";
        e.currentTarget.style.background = "var(--neon-raised)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "var(--neon-border)";
        e.currentTarget.style.background = "var(--neon-surface)";
      }}
    >
      {/* Header: time + status */}
      <div className="flex items-center justify-between">
        <span className="pm-label">{game.time}</span>
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold"
              style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> LIVE
            </span>
          )}
          {isFinal && (
            <span className="pm-badge">Final</span>
          )}
          {isScheduled && confidence === "high" && (
            <span className="pm-badge-green">Edge</span>
          )}
        </div>
      </div>

      {/* Teams */}
      <div className="flex items-center justify-between gap-2">
        {/* Away */}
        <div className="flex flex-col items-center flex-1 gap-2">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-mono font-bold"
            style={{
              background: "var(--neon-overlay)",
              border: "1px solid var(--neon-border-md)",
              borderBottom: `2px solid ${awayColor}`,
              color: "var(--neon-text)",
            }}
          >
            {game.away}
          </div>
          <span className="text-xl font-display font-black tabular-nums"
            style={{ color: fav === "away" ? "var(--neon-text)" : "var(--neon-muted)" }}>
            {isLive || isFinal ? game.awayScore : (game.awayP ? `${game.awayP}%` : "—")}
          </span>
        </div>

        <div className="text-[9px] font-mono font-bold pb-4" style={{ color: "var(--neon-dim)" }}>VS</div>

        {/* Home */}
        <div className="flex flex-col items-center flex-1 gap-2">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-mono font-bold"
            style={{
              background: "var(--neon-overlay)",
              border: "1px solid var(--neon-border-md)",
              borderBottom: `2px solid ${homeColor}`,
              color: "var(--neon-text)",
            }}
          >
            {game.home}
          </div>
          <span className="text-xl font-display font-black tabular-nums"
            style={{ color: fav === "home" ? "var(--neon-text)" : "var(--neon-muted)" }}>
            {isLive || isFinal ? game.homeScore : (game.homeP ? `${game.homeP}%` : "—")}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-3 flex items-center justify-between"
        style={{ borderTop: "1px solid var(--neon-border)" }}>
        <span className="pm-label">{game.spread !== "—" ? `Spread ${game.spread}` : "No spread"}</span>
        <span className="pm-label">{game.total !== "—" ? `O/U ${game.total}` : ""}</span>
      </div>
    </motion.div>
  );
}

function MiniStandings({ teams, conf }) {
  return (
    <div className="space-y-3">
      <div className="pm-label mb-3 opacity-60">{conf} Conference</div>
      {teams.slice(0, 5).map((t, i) => (
        <div key={t.team} className="flex items-center justify-between group">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] font-bold text-[var(--neon-dim)] w-4">{i + 1}</span>
            <div className="w-6 h-6 rounded bg-[var(--neon-overlay)] flex items-center justify-center border border-[var(--neon-border)] text-[9px] font-bold">
              {t.team}
            </div>
            <TeamLink abbr={t.team} className="text-xs font-bold text-[var(--neon-text)] hover:text-[var(--neon-green)] transition-colors tracking-tight">{t.team}</TeamLink>
          </div>
          <span className="text-[11px] font-medium text-[var(--neon-muted)]">{t.w}-{t.l}</span>
        </div>
      ))}
    </div>
  );
}

function SummaryStat({ label, value, sub, icon: Icon, trend, trendValue, onClick }) {
    return (
        <PremiumCard className="p-6 cursor-pointer hover:bg-[var(--neon-raised)] transition-all border-none bg-transparent shadow-none" onClick={onClick}>
            <div className="flex items-start justify-between mb-4">
                <div className="w-9 h-9 rounded-lg bg-[var(--neon-overlay)] border border-[var(--neon-border-md)] flex items-center justify-center text-[var(--neon-muted)]">
                    <Icon size={16} strokeWidth={2} />
                </div>
                {trend && (
                    <div className={cn("flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full",
                        trend === "up" ? "bg-win/10 text-win" : "bg-loss/10 text-loss")}>
                        {trend === "up" ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {trendValue}
                    </div>
                )}
            </div>
            <div className="space-y-1">
                <span className="pm-label opacity-60">{label}</span>
                <div className="text-3xl pm-number text-[var(--neon-text)] leading-tight">{value}</div>
                <div className="text-[10px] font-semibold text-[var(--neon-dim)] truncate uppercase tracking-[2px]">{sub}</div>
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
        <div className="max-w-[1400px] mx-auto px-6 py-10 min-h-screen bg-[var(--neon-bg)]">
            {/* Header / Top Stats */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div>
                    <h1 className="text-4xl font-bold text-[var(--neon-text)] tracking-tight mb-2">TELEMETRY</h1>
                    <p className="pm-label opacity-60">{today}</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-5 py-2.5 bg-[var(--neon-surface)] rounded-lg hover:border-[var(--neon-border-md)] transition-all text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--neon-muted)] border border-[var(--neon-border)]">
                        <Filter size={14} />
                        CONFIG
                    </button>
                    <button className="flex items-center gap-2 px-5 py-2.5 bg-[var(--neon-green-faint)] text-[var(--neon-green)] rounded-lg hover:bg-[var(--neon-green-border)] transition-all text-[10px] font-mono font-bold uppercase tracking-widest border border-[var(--neon-green-border)]">
                        <ArrowUpRight size={14} />
                        PRO ANALYTICS
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
                    trendValue={betStats.total > 0 ? `${Math.round((betStats.wins / betStats.total) * 100)}% WR` : "0% WR"}
                    onClick={() => navigate("/tracker")}
                />
            </motion.div>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Main: Today's Games */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-sm font-bold text-[var(--neon-text)] tracking-widest uppercase">Today's Slate</h2>
                        <button onClick={() => navigate("/scores")} className="pm-label hover:text-[var(--neon-green)] transition-colors">See All <ChevronRight size={14} className="inline" /></button>
                    </div>
                    {games.isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[1, 2, 3, 4].map(i => <div key={i} className="h-48 rounded-xl bg-[var(--neon-raised)] animate-pulse border border-[var(--neon-border)]" />)}
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
                            className="w-full py-5 rounded-xl border border-dashed border-[var(--neon-border-md)] text-[var(--neon-muted)] hover:text-[var(--neon-text)] hover:border-[var(--neon-muted)] transition-all font-mono font-bold text-[10px] tracking-[2px] uppercase bg-[var(--neon-surface)]/50"
                        >
                            +{gameList.length - 4} More Matchups
                        </button>
                    )}
                </div>

                {/* Sidebar: Standings & Quick Access */}
                <div className="lg:col-span-4 space-y-6">
                    <PremiumCard className="p-7">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xs font-bold text-[var(--neon-text)] tracking-widest uppercase">Standings</h2>
                            <button onClick={() => navigate("/standings")} className="p-1.5 hover:bg-[var(--neon-raised)] rounded transition-colors text-[var(--neon-muted)]">
                                <ArrowUpRight size={16} />
                            </button>
                        </div>
                        {standings.isLoading ? (
                            <div className="space-y-4 animate-pulse">
                                {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-4 bg-[var(--neon-raised)] rounded" />)}
                            </div>
                        ) : (
                            <div className="space-y-10">
                                <MiniStandings teams={eastList} conf="East" />
                                <MiniStandings teams={westList} conf="West" />
                            </div>
                        )}
                    </PremiumCard>

                    <div className="p-7 rounded-xl border border-[var(--neon-border)] bg-[var(--neon-surface)]/30">
                        <h2 className="text-[10px] font-bold text-[var(--neon-muted)] tracking-[3px] uppercase font-mono mb-6">Quick Links</h2>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: "Odds Edge", icon: TrendingUp, path: "/betting", color: "text-win" },
                                { label: "Stat Lab", icon: Activity, path: "/analytics", color: "text-[var(--neon-green)]" },
                                { label: "Rosters", icon: Users, path: "/players", color: "text-loss" },
                                { label: "History", icon: Bell, path: "/tracker", color: "text-draw" },
                            ].map(link => (
                                <button key={link.label} onClick={() => navigate(link.path)} className="flex flex-col gap-4 p-4 bg-[var(--neon-surface)] rounded-lg border border-[var(--neon-border)] hover:border-[var(--neon-border-md)] hover:bg-[var(--neon-raised)] transition-all text-left">
                                    <div className={cn("w-7 h-7 rounded flex items-center justify-center bg-[var(--neon-overlay)]", link.color)}>
                                        <link.icon size={14} />
                                    </div>
                                    <span className="text-[10px] font-bold text-[var(--neon-text)] uppercase tracking-widest font-mono">{link.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}