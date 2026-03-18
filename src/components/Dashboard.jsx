import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Target, BarChart2, Zap, ChevronRight } from "lucide-react";
import { TEAM_NAMES } from "../data";
import { useStandings, useTodayGames } from "../api";
import { calcPL } from "../utils";
import { TileSkeleton, RowSkeleton, ErrorState, FreshnessTag } from "./ui";

const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.05 } },
};
const tile = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

// ── Game tile ─────────────────────────────────────────────────
function GameTile({ game }) {
    const fav = game.homeP >= game.awayP ? "home" : "away";
    const isFinal = game.status === "final";
    const isLive = game.status === "live";
    const isScheduled = game.status === "scheduled";

    return (
        <motion.div variants={tile} className="pm-tile p-3">
            <div className="flex items-center justify-between mb-2">
                <span className="pm-label">{game.time}</span>
                {isFinal && (
                    <span className="pm-badge bg-pitch-700 text-pitch-400 border border-pitch-600">Final</span>
                )}
                {isLive && (
                    <span className="pm-badge bg-win/10 text-win border border-win/20 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-win animate-pulse inline-block" />
                        Live
                    </span>
                )}
                {isScheduled && (
                    <span className="pm-badge bg-accent/10 text-accent border border-accent/20">Tonight</span>
                )}
            </div>

            <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 text-center">
                    <div className={`font-display text-xl tracking-wider leading-none mb-0.5
            ${fav === "away" ? "text-accent" : "text-pitch-200"}`}>
                        {game.away}
                    </div>
                    <div className="text-[10px] text-pitch-400">{TEAM_NAMES[game.away] || game.away}</div>
                    {(isFinal || isLive)
                        ? <div className="pm-number text-lg mt-1 text-pitch-100">{game.awayScore}</div>
                        : <div className="pm-number text-sm mt-1 text-pitch-300">{game.awayP}%</div>
                    }
                </div>

                <div className="text-pitch-500 text-xs font-mono">
                    {isFinal || isLive ? "—" : "vs"}
                </div>

                <div className="flex-1 text-center">
                    <div className={`font-display text-xl tracking-wider leading-none mb-0.5
            ${fav === "home" ? "text-accent" : "text-pitch-200"}`}>
                        {game.home}
                    </div>
                    <div className="text-[10px] text-pitch-400">{TEAM_NAMES[game.home] || game.home}</div>
                    {(isFinal || isLive)
                        ? <div className="pm-number text-lg mt-1 text-pitch-100">{game.homeScore}</div>
                        : <div className="pm-number text-sm mt-1 text-pitch-300">{game.homeP}%</div>
                    }
                </div>
            </div>

            {/* Only show probability bar for scheduled games */}
            {isScheduled && (
                <div className="pm-stat-bar mb-2">
                    <div className="pm-stat-bar-fill bg-accent" style={{ width: `${game.awayP}%` }} />
                </div>
            )}

            <div className="flex justify-between text-[10px] text-pitch-400">
                <span>Spread: <span className="text-pitch-300">{game.spread}</span></span>
                <span>O/U: <span className="text-pitch-300">{game.total}</span></span>
            </div>
        </motion.div>
    );
}

// ── Mini standings ────────────────────────────────────────────
function MiniStandings({ teams, conf }) {
    return (
        <div>
            <div className="pm-label mb-2">{conf}</div>
            <div className="space-y-0">
                {teams.slice(0, 6).map((t, i) => (
                    <div
                        key={t.team}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-sm
              transition-colors hover:bg-pitch-700 cursor-pointer
              ${i === 5 ? "border-t border-pitch-600 mt-1 pt-2" : ""}`}
                    >
                        <span className="pm-number text-[10px] text-pitch-500 w-4">{i + 1}</span>
                        <span className={`font-display text-sm tracking-wider flex-1
              ${i === 0 ? "text-accent" : "text-pitch-200"}`}>
                            {t.team}
                        </span>
                        <span className="pm-number text-[11px] text-pitch-300">{t.w}-{t.l}</span>
                        <span className="pm-number text-[10px] text-pitch-400 w-8 text-right">
                            {t.pct.toFixed(3)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Summary tile ──────────────────────────────────────────────
function SummaryTile({ label, value, sub, icon: Icon, trend }) {
    return (
        <motion.div variants={tile} className="pm-tile p-4">
            <div className="flex items-start justify-between mb-3">
                <div className="pm-label">{label}</div>
                {Icon && (
                    <div className="w-7 h-7 rounded bg-pitch-700 flex items-center justify-center">
                        <Icon size={13} strokeWidth={1.8} className="text-pitch-300" />
                    </div>
                )}
            </div>
            <div className="pm-number text-3xl text-pitch-50">{value}</div>
            {sub && (
                <div className="flex items-center gap-1 mt-1.5">
                    {trend === "up" && <TrendingUp size={11} className="text-win" />}
                    {trend === "down" && <TrendingDown size={11} className="text-loss" />}
                    <span className="text-[11px] text-pitch-400">{sub}</span>
                </div>
            )}
        </motion.div>
    );
}

// ── Main Dashboard ────────────────────────────────────────────
export default function Dashboard({ onNavigate }) {
    const games = useTodayGames();
    const standings = useStandings();

    const today = new Date().toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
    });

    const gameList = games.data || [];
    const eastList = standings.data?.east || [];
    const westList = standings.data?.west || [];
    const liveCount = gameList.filter(g => g.status === "live").length;
    const gameCount = gameList.length;

    // Read bet stats from same localStorage key as BetTracker
    const betStats = useMemo(() => {
        try {
            const raw = localStorage.getItem("plusminus_bets");
            if (!raw) return { total: 0, wins: 0, losses: 0, pending: 0, pl: 0 };
            const bets = JSON.parse(raw);
            if (!Array.isArray(bets)) return { total: 0, wins: 0, losses: 0, pending: 0, pl: 0 };
            const wins = bets.filter(b => b.result === "win").length;
            const losses = bets.filter(b => b.result === "loss").length;
            const pending = bets.filter(b => b.result === "pending").length;
            const pl = bets.reduce((s, b) => s + calcPL(b.stake, b.odds, b.result), 0);
            return { total: bets.length, wins, losses, pending, pl };
        } catch {
            return { total: 0, wins: 0, losses: 0, pending: 0, pl: 0 };
        }
    }, []);

    const betSub = betStats.total > 0
        ? `${betStats.wins} wins · ${betStats.losses} losses · ${betStats.pending} open`
        : "No bets logged yet";

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-12 gap-3"
        >
            {/* Summary row */}
            <motion.div variants={tile} className="col-span-12">
                <div className="flex items-center justify-between mb-2">
                    <div className="pm-label">Overview · {today}</div>
                    <FreshnessTag
                        isFetching={games.isFetching || standings.isFetching}
                        dataUpdatedAt={games.dataUpdatedAt}
                    />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <SummaryTile
                        label="Games Today"
                        value={gameCount || "—"}
                        sub={liveCount > 0 ? `${liveCount} in progress` : "Tip-off 7:00 PM ET"}
                        icon={Target}
                        trend={liveCount > 0 ? "up" : null}
                    />
                    <SummaryTile label="Top Model Edge" value="+11%" sub="OKC @ BKN" icon={TrendingUp} trend="up" />
                    <SummaryTile label="Best Win Prob" value="94.7%" sub="OKC (away)" icon={Zap} />
                    <SummaryTile label="Tracked Bets" value={betStats.total || "—"} sub={betSub} icon={BarChart2} />
                </div>
            </motion.div>

            {/* Tonight's games */}
            <div className="col-span-12 lg:col-span-8">
                <div className="flex items-center justify-between mb-2">
                    <div className="pm-label">Today's games</div>
                    <button
                        onClick={() => onNavigate("scores")}
                        className="flex items-center gap-1 text-[10px] text-pitch-400 hover:text-accent transition-colors"
                    >
                        View all <ChevronRight size={10} />
                    </button>
                </div>

                {games.isError ? (
                    <ErrorState
                        message="Couldn't load today's games."
                        onRetry={() => games.refetch()}
                    />
                ) : games.isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Array.from({ length: 6 }).map((_, i) => <TileSkeleton key={i} lines={4} />)}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {gameList.slice(0, 6).map(g => <GameTile key={g.id} game={g} />)}
                    </div>
                )}
            </div>

            {/* Right column */}
            <div className="col-span-12 lg:col-span-4 space-y-4">
                <motion.div variants={tile} className="pm-card p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="pm-label">Standings</div>
                        <button
                            onClick={() => onNavigate("standings")}
                            className="text-[10px] text-pitch-400 hover:text-accent transition-colors flex items-center gap-1"
                        >
                            Full <ChevronRight size={10} />
                        </button>
                    </div>

                    {standings.isError ? (
                        <ErrorState message="Couldn't load standings." onRetry={() => standings.refetch()} />
                    ) : standings.isLoading ? (
                        <RowSkeleton rows={6} />
                    ) : (
                        <div className="space-y-4">
                            <MiniStandings teams={eastList} conf="Eastern" />
                            <div className="h-px bg-pitch-700" />
                            <MiniStandings teams={westList} conf="Western" />
                        </div>
                    )}
                </motion.div>
            </div>
        </motion.div>
    );
}