import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, SlidersHorizontal, ChevronDown, X, Loader, GitCompare } from "lucide-react";
import { TEAM_COLORS } from "../data";
import { usePlayers, usePlayerSearch } from "../api";
import { signed } from "../utils";
import { TileSkeleton, ErrorState } from "./ui";

// ── AttrBar ───────────────────────────────────────────────────
// compareValue: optional second player value to show alongside
function AttrBar({ label, value, max = 100, min = 0, invert = false, isSigned = false, compareValue, compareColor }) {
    const calcPct = (v) => {
        if (isSigned) {
            const range = max - min;
            const raw = invert ? max - v : v;
            return range > 0 ? Math.min(100, Math.max(0, ((raw - min) / range) * 100)) : 0;
        }
        const raw = invert ? Math.max(0, max - v) : v;
        return Math.min(100, Math.max(0, (raw / max) * 100));
    };

    const pct = calcPct(value);
    const cmpPct = compareValue !== undefined ? calcPct(compareValue) : null;

    const barColor =
        pct >= 80 ? "bg-tier-elite" :
            pct >= 65 ? "bg-tier-good" :
                pct >= 50 ? "bg-tier-avg" :
                    pct >= 35 ? "bg-tier-poor" : "bg-tier-bad";

    return (
        <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] text-pitch-400 w-14 flex-shrink-0">{label}</span>
            <div className="flex-1 pm-stat-bar relative">
                <motion.div
                    className={`pm-stat-bar-fill ${barColor}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
                />
                {cmpPct !== null && (
                    <motion.div
                        className="pm-stat-bar-fill absolute top-0 left-0 opacity-40"
                        style={{ background: compareColor || "#f59e0b" }}
                        initial={{ width: 0 }}
                        animate={{ width: `${cmpPct}%` }}
                        transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
                    />
                )}
            </div>
            <span className="font-mono text-[11px] text-pitch-200 w-8 text-right">{value}</span>
            {compareValue !== undefined && (
                <span className="font-mono text-[11px] w-8 text-right" style={{ color: compareColor || "#f59e0b" }}>
                    {compareValue}
                </span>
            )}
        </div>
    );
}

function Form({ results }) {
    return (
        <div className="flex gap-1">
            {results.map((r, i) => (
                <span key={i} className={`pm-result text-[8px]
          ${r === "W" ? "bg-win/20 text-win border border-win/30" :
                        r === "L" ? "bg-loss/20 text-loss border border-loss/30" :
                            "bg-draw/20 text-draw border border-draw/30"}`}>
                    {r}
                </span>
            ))}
        </div>
    );
}

// ── PlayerCard ────────────────────────────────────────────────
function PlayerCard({ player, onCompare, comparePlayer, isComparing }) {
    const [expanded, setExpanded] = useState(false);
    const color = TEAM_COLORS[player.team] || "#546480";
    const cmpColor = comparePlayer ? (TEAM_COLORS[comparePlayer.team] || "#f59e0b") : null;
    const initials = player.name.split(" ").map(w => w[0]).join("").slice(0, 2);

    const hasAdvanced = player.per !== null;
    const hasStats = player.pts > 0 || player.ast > 0 || player.reb > 0;

    return (
        <motion.div
            layout
            className={`pm-tile transition-all ${expanded ? "pm-accent-border" : ""} ${isComparing ? "ring-1 ring-draw/40" : ""}`}
            onClick={() => setExpanded(!expanded)}
        >
            <div className="p-3 flex items-center gap-3">
                <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-semibold"
                    style={{ background: color + "28", color, border: `1px solid ${color}44` }}
                >
                    {initials}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-pitch-100 truncate">{player.name}</div>
                    <div className="text-[10px] text-pitch-400 mt-0.5">
                        {player.pos} · {player.team}
                        {player.age ? ` · Age ${player.age}` : ""}
                    </div>
                </div>
                {hasStats && (
                    <div className="flex gap-4 flex-shrink-0">
                        {[{ lbl: "PTS", val: player.pts }, { lbl: "AST", val: player.ast }, { lbl: "REB", val: player.reb }].map(s => (
                            <div key={s.lbl} className="text-center">
                                <div className="font-mono font-medium text-sm text-pitch-100">{s.val}</div>
                                <div className="text-[9px] text-pitch-500 uppercase tracking-wider">{s.lbl}</div>
                            </div>
                        ))}
                    </div>
                )}
                {!hasStats && (
                    <span className="text-[10px] text-pitch-600 flex-shrink-0">No stats this season</span>
                )}
                {/* Compare button — only for static roster players with advanced metrics */}
                {hasAdvanced && onCompare && (
                    <button
                        onClick={e => { e.stopPropagation(); onCompare(player); }}
                        title={isComparing ? "Remove from comparison" : "Compare this player"}
                        className={`flex-shrink-0 p-1.5 rounded-md border transition-all
                            ${isComparing
                                ? "bg-draw/10 border-draw/30 text-draw"
                                : "bg-pitch-700 border-pitch-600 text-pitch-400 hover:text-pitch-200 hover:border-pitch-500"
                            }`}
                    >
                        <GitCompare size={11} strokeWidth={1.8} />
                    </button>
                )}
                <ChevronDown size={14} strokeWidth={1.8} className={`text-pitch-500 transition-transform duration-200 flex-shrink-0 ${expanded ? "rotate-180" : ""}`} />
            </div>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22 }}
                        className="overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="px-3 pb-4 border-t border-pitch-600 pt-4">
                            {hasAdvanced ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                        <div className="pm-label mb-1 flex items-center gap-2">
                                            Advanced metrics
                                            {comparePlayer && (
                                                <span className="text-[9px] text-pitch-500">
                                                    <span style={{ color }}>{player.name.split(" ")[1]}</span>
                                                    {" vs "}
                                                    <span style={{ color: cmpColor }}>{comparePlayer.name.split(" ")[1]}</span>
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-2">
                                            <AttrBar label="PER" value={player.per} max={35} compareValue={comparePlayer?.per} compareColor={cmpColor} />
                                            <AttrBar label="TS%" value={player.ts} max={75} compareValue={comparePlayer?.ts} compareColor={cmpColor} />
                                            <AttrBar label="BPM" value={player.bpm} min={-5} max={12} isSigned compareValue={comparePlayer?.bpm} compareColor={cmpColor} />
                                            <AttrBar label="VORP" value={player.vorp} min={-2} max={9} isSigned compareValue={comparePlayer?.vorp} compareColor={cmpColor} />
                                            <AttrBar label="O-RTG" value={player.ortg} max={135} compareValue={comparePlayer?.ortg} compareColor={cmpColor} />
                                            <AttrBar label="D-RTG" value={player.drtg} max={120} invert compareValue={comparePlayer?.drtg} compareColor={cmpColor} />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="pm-label mb-3">Season averages</div>
                                        <div className="grid grid-cols-3 gap-2 mb-4">
                                            {[
                                                { lbl: "PTS", val: player.pts },
                                                { lbl: "AST", val: player.ast },
                                                { lbl: "REB", val: player.reb },
                                                { lbl: "PER", val: player.per },
                                                { lbl: "TS%", val: player.ts + "%" },
                                                { lbl: "BPM", val: signed(player.bpm) },
                                            ].map(s => (
                                                <div key={s.lbl} className="bg-pitch-700 rounded-md p-2 text-center">
                                                    <div className="font-mono font-medium text-pitch-50 text-base">{s.val}</div>
                                                    <div className="text-[9px] text-pitch-500 uppercase tracking-wider mt-0.5">{s.lbl}</div>
                                                </div>
                                            ))}
                                        </div>
                                        {player.form && (
                                            <>
                                                <div className="pm-label mb-2">Last 5 games</div>
                                                <Form results={player.form} />
                                            </>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div className="pm-label mb-3">Season averages</div>
                                    {hasStats ? (
                                        <>
                                            <div className="grid grid-cols-3 gap-2 mb-3">
                                                {[
                                                    { lbl: "PTS", val: player.pts },
                                                    { lbl: "AST", val: player.ast },
                                                    { lbl: "REB", val: player.reb },
                                                ].map(s => (
                                                    <div key={s.lbl} className="bg-pitch-700 rounded-md p-2 text-center">
                                                        <div className="font-mono font-medium text-pitch-50 text-base">{s.val}</div>
                                                        <div className="text-[9px] text-pitch-500 uppercase tracking-wider mt-0.5">{s.lbl}</div>
                                                    </div>
                                                ))}
                                            </div>
                                            {player.ts !== null && (
                                                <div className="flex items-center gap-2 text-[11px] text-pitch-400">
                                                    <span className="text-pitch-500">FG%</span>
                                                    <span className="font-mono text-pitch-200">{player.ts}%</span>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="text-[11px] text-pitch-500">No stats available for this season.</div>
                                    )}
                                    <div className="mt-3 pt-3 border-t border-pitch-700">
                                        <div className="text-[10px] text-pitch-600">
                                            Advanced metrics (PER, BPM, VORP) not available for searched players via BallDontLie free tier.
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ── useDebounce ───────────────────────────────────────────────
function useDebounce(value, delay = 350) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debounced;
}

// ── Players ───────────────────────────────────────────────────
export default function Players({ initialQuery = "" }) {
    const [query, setQuery] = useState(initialQuery);
    const [pos, setPos] = useState("");
    const [sortKey, setSort] = useState("pts");

    // Sync query if parent updates initialQuery (e.g. TopNav search → Players tab)
    useEffect(() => { setQuery(initialQuery); }, [initialQuery]);

    // Compare mode — track one player to compare against
    const [comparePlayer, setComparePlayer] = useState(null);

    const handleCompare = (player) => {
        setComparePlayer(prev => prev?.id === player.id ? null : player);
    };

    const debouncedQuery = useDebounce(query, 350);

    const { data: staticPlayers, isLoading: staticLoading, isError: staticError, refetch } = usePlayers();
    const {
        data: searchResults,
        isLoading: searchLoading,
        isFetching: searchFetching,
        isError: searchError,
    } = usePlayerSearch(debouncedQuery);

    const isSearchMode = debouncedQuery.trim().length >= 2;
    const isTyping = query.trim().length >= 2 && query !== debouncedQuery;

    const browsePlayers = useMemo(() =>
        (staticPlayers || [])
            .filter(p => !pos || p.pos === pos)
            .sort((a, b) => b[sortKey] - a[sortKey]),
        [staticPlayers, pos, sortKey]
    );

    const displayPlayers = isSearchMode
        ? (searchResults || []).sort((a, b) => b.pts - a.pts)
        : browsePlayers;

    const isLoading = isSearchMode ? (searchLoading && !searchResults) : staticLoading;
    const isError = isSearchMode ? searchError : staticError;
    const isFetching = isSearchMode && (searchLoading || searchFetching || isTyping);

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            {/* Compare banner */}
            <AnimatePresence>
                {comparePlayer && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="mb-3 px-3 py-2 rounded-md border border-draw/30 bg-draw/5 flex items-center gap-2"
                    >
                        <div
                            className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-semibold flex-shrink-0"
                            style={{ background: (TEAM_COLORS[comparePlayer.team] || "#f59e0b") + "28", color: TEAM_COLORS[comparePlayer.team] || "#f59e0b" }}
                        >
                            {comparePlayer.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                        </div>
                        <span className="text-[11px] text-pitch-300 flex-1">
                            Comparing against <span className="text-draw font-medium">{comparePlayer.name}</span> — expand any player to see side-by-side bars
                        </span>
                        <button
                            onClick={() => setComparePlayer(null)}
                            className="text-pitch-500 hover:text-pitch-300 transition-colors"
                        >
                            <X size={12} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex flex-wrap items-center gap-2 mb-4">
                {/* Search input */}
                <div className="relative flex-1 min-w-[180px]">
                    {isFetching ? (
                        <Loader size={13} strokeWidth={1.8} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-accent animate-spin" />
                    ) : (
                        <Search size={13} strokeWidth={1.8} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-pitch-500" />
                    )}
                    <input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder={isSearchMode ? "Searching all NBA players…" : "Search player…"}
                        className="w-full bg-pitch-800 border border-pitch-600 rounded-md pl-8 pr-3 py-1.5 text-sm text-pitch-200 placeholder:text-pitch-500 focus:outline-none focus:border-accent/50 transition-colors"
                    />
                    {query && (
                        <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                            <X size={11} className="text-pitch-500 hover:text-pitch-300" />
                        </button>
                    )}
                </div>

                {!isSearchMode && (
                    <div className="flex gap-1">
                        {["", "PG", "SG", "SF", "PF", "C"].map(p => (
                            <button key={p} onClick={() => setPos(p)}
                                className={`px-2.5 py-1.5 rounded text-[11px] font-medium transition-all
                                    ${pos === p
                                        ? "bg-accent/15 text-accent border border-accent/30"
                                        : "bg-pitch-800 text-pitch-400 border border-pitch-600 hover:border-pitch-500 hover:text-pitch-300"
                                    }`}>
                                {p || "All"}
                            </button>
                        ))}
                    </div>
                )}

                {!isSearchMode && (
                    <div className="flex items-center gap-1 ml-auto">
                        <SlidersHorizontal size={12} className="text-pitch-500" />
                        <select value={sortKey} onChange={e => setSort(e.target.value)}
                            className="bg-pitch-800 border border-pitch-600 rounded-md px-2 py-1.5 text-[11px] text-pitch-300 focus:outline-none focus:border-accent/50">
                            <option value="pts">Sort: Points</option>
                            <option value="ast">Sort: Assists</option>
                            <option value="reb">Sort: Rebounds</option>
                            <option value="per">Sort: PER</option>
                            <option value="bpm">Sort: BPM</option>
                            <option value="ts">Sort: TS%</option>
                        </select>
                    </div>
                )}

                {isSearchMode && (
                    <div className="ml-auto text-[10px] text-pitch-500">
                        {isFetching ? "Searching…" : `${displayPlayers.length} result${displayPlayers.length !== 1 ? "s" : ""}`}
                    </div>
                )}
            </div>

            {query.trim().length === 1 && (
                <div className="text-center py-4 text-pitch-600 text-[11px]">
                    Type one more character to search all NBA players…
                </div>
            )}

            {isError ? (
                <ErrorState
                    message={isSearchMode ? "Couldn't search players." : "Couldn't load player stats."}
                    onRetry={refetch}
                />
            ) : isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => <TileSkeleton key={i} lines={2} />)}
                </div>
            ) : (
                <div className="space-y-2">
                    <AnimatePresence>
                        {displayPlayers.map(p => (
                            <PlayerCard
                                key={p.id}
                                player={p}
                                onCompare={!isSearchMode ? handleCompare : null}
                                comparePlayer={comparePlayer}
                                isComparing={comparePlayer?.id === p.id}
                            />
                        ))}
                    </AnimatePresence>
                    {displayPlayers.length === 0 && !isFetching && (
                        <div className="text-center py-12 text-pitch-500 text-sm">
                            {isSearchMode
                                ? `No active players found for "${debouncedQuery}".`
                                : "No players match your filters."
                            }
                        </div>
                    )}
                </div>
            )}
        </motion.div>
    );
}