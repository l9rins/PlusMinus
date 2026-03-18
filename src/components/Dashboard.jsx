import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Target, BarChart2, Zap, ChevronRight } from "lucide-react";
import { TODAY_GAMES, TEAM_NAMES, EAST_STANDINGS, WEST_STANDINGS, PLAYERS } from "../data";

// ── Animation variants ────────────────────────────────────────
const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.05 } },
};
const tile = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

// ── Module-level constants — computed once, not on every render
// PLAYERS is static data so sorting at module level costs nothing.
const TOP_SCORERS = [...PLAYERS].sort((a, b) => b.pts - a.pts).slice(0, 5);

// ── Today's game tile ─────────────────────────────────────────
function GameTile({ game }) {
    const fav = game.homeP > game.awayP ? "home" : "away";
    return (
        <motion.div variants={tile} className="pm-tile p-3">
            <div className="flex items-center justify-between mb-2">
                <span className="pm-label">{game.time} ET</span>
                <span className="pm-badge bg-accent/10 text-accent border border-accent/20">
                    Tonight
                </span>
            </div>

            <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 text-center">
                    <div className={`font-display text-xl tracking-wider leading-none mb-0.5
            ${fav === "away" ? "text-accent" : "text-pitch-200"}`}>
                        {game.away}
                    </div>
                    <div className="text-[10px] text-pitch-400">{TEAM_NAMES[game.away]}</div>
                    <div className="pm-number text-sm mt-1 text-pitch-300">{game.awayP}%</div>
                </div>

                <div className="text-pitch-500 text-xs font-mono">vs</div>

                <div className="flex-1 text-center">
                    <div className={`font-display text-xl tracking-wider leading-none mb-0.5
            ${fav === "home" ? "text-accent" : "text-pitch-200"}`}>
                        {game.home}
                    </div>
                    <div className="text-[10px] text-pitch-400">{TEAM_NAMES[game.home]}</div>
                    <div className="pm-number text-sm mt-1 text-pitch-300">{game.homeP}%</div>
                </div>
            </div>

            <div className="pm-stat-bar mb-2">
                <div className="pm-stat-bar-fill bg-accent" style={{ width: `${game.awayP}%` }} />
            </div>

            <div className="flex justify-between text-[10px] text-pitch-400">
                <span>Spread: <span className="text-pitch-300">{game.spread}</span></span>
                <span>O/U: <span className="text-pitch-300">{game.total}</span></span>
            </div>
        </motion.div>
    );
}

// ── Conference mini-standings ─────────────────────────────────
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

// ── Top player tile ───────────────────────────────────────────
function PlayerTile({ player, rank }) {
    return (
        <motion.div variants={tile} className="pm-tile p-3 flex items-center gap-3">
            <span className="pm-number text-lg text-pitch-600 w-6 text-center">{rank}</span>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-pitch-100 truncate">{player.name}</div>
                <div className="text-[10px] text-pitch-400">{player.pos} · {player.team}</div>
            </div>
            <div className="text-right">
                <div className="pm-number text-lg text-accent">{player.pts}</div>
                <div className="text-[9px] text-pitch-500 uppercase tracking-wider">PPG</div>
            </div>
        </motion.div>
    );
}

// ── Summary stat tile ─────────────────────────────────────────
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
    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-12 gap-3"
        >
            {/* Summary row */}
            <motion.div variants={tile} className="col-span-12">
                <div className="pm-label mb-2">Overview · Mar 19, 2026</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <SummaryTile label="Games Tonight" value="9" sub="Tip-off 7:00 PM ET" icon={Target} trend="up" />
                    <SummaryTile label="Top Model Edge" value="+11%" sub="OKC @ BKN" icon={TrendingUp} trend="up" />
                    <SummaryTile label="Best Win Prob" value="94.7%" sub="OKC (away)" icon={Zap} />
                    <SummaryTile label="Tracked Bets" value="4" sub="2 wins · 1 loss · 1 open" icon={BarChart2} />
                </div>
            </motion.div>

            {/* Tonight's games */}
            <div className="col-span-12 lg:col-span-8">
                <div className="flex items-center justify-between mb-2">
                    <div className="pm-label">Tonight's games</div>
                    <button
                        onClick={() => onNavigate("scores")}
                        className="flex items-center gap-1 text-[10px] text-pitch-400 hover:text-accent transition-colors"
                    >
                        View all <ChevronRight size={10} />
                    </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {TODAY_GAMES.slice(0, 6).map(g => (
                        <GameTile key={g.id} game={g} />
                    ))}
                </div>
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
                    <div className="space-y-4">
                        <MiniStandings teams={EAST_STANDINGS} conf="Eastern" />
                        <div className="h-px bg-pitch-700" />
                        <MiniStandings teams={WEST_STANDINGS} conf="Western" />
                    </div>
                </motion.div>

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <div className="pm-label">Scoring leaders</div>
                        <button
                            onClick={() => onNavigate("players")}
                            className="text-[10px] text-pitch-400 hover:text-accent transition-colors flex items-center gap-1"
                        >
                            All players <ChevronRight size={10} />
                        </button>
                    </div>
                    <div className="space-y-2">
                        {TOP_SCORERS.map((p, i) => (
                            <PlayerTile key={p.id} player={p} rank={i + 1} />
                        ))}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}