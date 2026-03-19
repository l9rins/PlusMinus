import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, SlidersHorizontal, ChevronDown, X, Loader } from "lucide-react";
import { TEAM_COLORS } from "../data";
import { usePlayers, usePlayerSearch } from "../api";
import { signed } from "../utils";
import { TileSkeleton, ErrorState } from "./ui";

// ── AttrBar ───────────────────────────────────────────────────
function AttrBar({ label, value, max = 100, min = 0, invert = false, isSigned = false }) {
    let pct;
    if (isSigned) {
        const range = max - min;
        const raw = invert ? max - value : value;
        pct = range > 0 ? Math.min(100, Math.max(0, ((raw - min) / range) * 100)) : 0;
    } else {
        const raw = invert ? Math.max(0, max - value) : value;
        pct = Math.min(100, Math.max(0, (raw / max) * 100));
    }

    const color =
        pct >= 80 ? "bg-tier-elite" :
            pct >= 65 ? "bg-tier-good" :
                pct >= 50 ? "bg-tier-avg" :
                    pct >= 35 ? "bg-tier-poor" : "bg-tier-bad";

    return (
        <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] text-pitch-400 w-14 flex-shrink-0">{label}</span>
            <div className="flex-1 pm-stat-bar">
                <motion.div
                    className={`pm-stat-bar-fill ${color}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
                />
            </div>
            <span className="font-mono text-[11px] text-pitch-200 w-8 text-right">{value}</span>
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
// Handles both static (full advanced metrics) and dynamic search
// results (basic stats only — BDL free tier limitation).
// Advanced section is hidden when player.per === null, which signals
// a search result rather than a static roster player.
function PlayerCard({ player }) {
    const [expanded, setExpanded] = useState(false);
    const color = TEAM_COLORS[player.team] || "#546480";
    const initials = player.name.split(" ").map(w => w[0]).join("").slice(0, 2);

    // A player from dynamic search has null advanced metrics
    const hasAdvanced = player.per !== null;
    // A player with no season data at all shouldn't show stats
    const hasStats = player.pts > 0 || player.ast > 0 || player.reb > 0;

    return (
        <motion.div
            layout
            className={`pm-tile transition-all ${expanded ? "pm-accent-border" : ""}`}
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
                                // Full expanded view for static roster players
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                        <div className="pm-label mb-3">Advanced metrics</div>
                                        <AttrBar label="PER" value={player.per} max={35} />
                                        <AttrBar label="TS%" value={player.ts} max={75} />
                                        <AttrBar label="BPM" value={player.bpm} min={-5} max={12} isSigned />
                                        <AttrBar label="VORP" value={player.vorp} min={-2} max={9} isSigned />
                                        <AttrBar label="O-RTG" value={player.ortg} max={135} />
                                        <AttrBar label="D-RTG" value={player.drtg} max={120} invert />
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
                                // Simplified view for dynamic search results
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
                                    {/* Honest disclosure for search results */}
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
// Delays updating the value until the user stops typing.
// 350ms is the sweet spot — fast enough to feel responsive,
// slow enough to avoid hammering the API on every keystroke.
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
    useEffect(() => {
        setQuery(initialQuery);
    }, [initialQuery]);

    // Debounce the query before firing the API search.
    // The raw query updates the input immediately; the debounced
    // value only changes after the user pauses typing.
    const debouncedQuery = useDebounce(query, 350);

    // Static roster — always loaded, shown when search is empty
    const { data: staticPlayers, isLoading: staticLoading, isError: staticError, refetch } = usePlayers();

    // Dynamic search — only fires when debouncedQuery.trim().length >= 2
    const {
        data: searchResults,
        isLoading: searchLoading,
        isFetching: searchFetching,
        isError: searchError,
    } = usePlayerSearch(debouncedQuery);

    // Determine which mode we're in:
    // - search mode: user has typed 2+ chars
    // - browse mode: show static roster with client-side filters
    const isSearchMode = debouncedQuery.trim().length >= 2;
    const isTyping = query.trim().length >= 2 && query !== debouncedQuery;

    // In browse mode, apply client-side position filter + sort to static roster
    const browsePlayers = (staticPlayers || [])
        .filter(p => !pos || p.pos === pos)
        .sort((a, b) => b[sortKey] - a[sortKey]);

    // In search mode, show results sorted by pts (dynamic results have no advanced metrics to sort by)
    const displayPlayers = isSearchMode
        ? (searchResults || []).sort((a, b) => b.pts - a.pts)
        : browsePlayers;

    const isLoading = isSearchMode ? (searchLoading && !searchResults) : staticLoading;
    const isError = isSearchMode ? searchError : staticError;
    const isFetching = isSearchMode && (searchLoading || searchFetching || isTyping);

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <div className="flex flex-wrap items-center gap-2 mb-4">
                {/* Search input */}
                <div className="relative flex-1 min-w-[180px]">
                    {isFetching ? (
                        <Loader
                            size={13}
                            strokeWidth={1.8}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-accent animate-spin"
                        />
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
                        <button
                            onClick={() => { setQuery(""); }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2"
                        >
                            <X size={11} className="text-pitch-500 hover:text-pitch-300" />
                        </button>
                    )}
                </div>

                {/* Position filter — hidden in search mode (search covers all positions) */}
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

                {/* Sort — hidden in search mode (dynamic results have no advanced metrics) */}
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

                {/* Search mode label */}
                {isSearchMode && (
                    <div className="ml-auto text-[10px] text-pitch-500">
                        {isFetching ? "Searching…" : `${displayPlayers.length} result${displayPlayers.length !== 1 ? "s" : ""}`}
                    </div>
                )}
            </div>

            {/* Hint when user has typed 1 char but not yet triggered search */}
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
                        {displayPlayers.map(p => <PlayerCard key={p.id} player={p} />)}
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