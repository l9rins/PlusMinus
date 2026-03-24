import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, SlidersHorizontal, ChevronDown, X, Loader,
  GitCompare, TrendingUp, TrendingDown, Minus,
  BarChart2, Zap, Target, ArrowUpDown,
} from "lucide-react";
import { TEAM_COLORS, TEAM_NAMES } from "../data";
import { useEnrichedPlayerStats, usePlayerSearch, usePlayerGameLog } from "../api";
import { signed, netRatingTier } from "../utils";
import { TileSkeleton, ErrorState, EmptyState } from "./ui";

const POSITIONS = ["", "PG", "SG", "SF", "PF", "C"];

function useDebounce(value, delay = 350) {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

function TierBadge({ per }) {
  if (per == null) return null;
  const { label, color } =
    per >= 25 ? { label: "MVP", color: "text-tier-elite bg-tier-elite/10 border-tier-elite/30" } :
      per >= 20 ? { label: "All-Star", color: "text-tier-good bg-tier-good/10 border-tier-good/30" } :
        per >= 15 ? { label: "Starter", color: "text-tier-avg bg-tier-avg/10 border-tier-avg/30" } :
          per >= 10 ? { label: "Rotation", color: "text-tier-poor bg-tier-poor/10 border-tier-poor/30" } :
            { label: "Fringe", color: "text-tier-bad bg-tier-bad/10 border-tier-bad/30" };
  return <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border uppercase tracking-widest ${color}`}>{label}</span>;
}

function Trend({ value, baseline }) {
  if (value == null || baseline == null) return null;
  const d = value - baseline;
  if (Math.abs(d) < 0.3) return <Minus size={9} className="text-pitch-500" />;
  return d > 0 ? <TrendingUp size={9} className="text-win" /> : <TrendingDown size={9} className="text-loss" />;
}

const MiniRadar = React.memo(function MiniRadar({ values, color, size = 64 }) {
  const n = values.length, cx = size / 2, cy = size / 2, r = size * 0.38;
  const ang = i => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pts = values.map((v, i) => ({ x: cx + Math.cos(ang(i)) * (v.value / 100) * r, y: cy + Math.sin(ang(i)) * (v.value / 100) * r }));
  const ring = s => values.map((_, i) => `${cx + Math.cos(ang(i)) * r * s},${cy + Math.sin(ang(i)) * r * s}`).join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      {[0.33, 0.66, 1].map(s => <polygon key={s} points={ring(s)} fill="none" stroke="#2e3a50" strokeWidth={0.8} />)}
      {values.map((_, i) => <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(ang(i)) * r} y2={cy + Math.sin(ang(i)) * r} stroke="#2e3a50" strokeWidth={0.8} />)}
      <polygon points={pts.map(p => `${p.x},${p.y}`).join(" ")} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={1.5} />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={1.5} fill={color} />)}
    </svg>
  );
});

function AttrBar({ label, value, max = 100, min = 0, invert = false, isSigned = false, compareValue, compareColor }) {
  const pct = v => {
    if (v == null) return 0;
    if (isSigned) { const raw = invert ? max - v : v; return max > min ? Math.min(100, Math.max(0, ((raw - min) / (max - min)) * 100)) : 0; }
    return Math.min(100, Math.max(0, ((invert ? Math.max(0, max - v) : v) / max) * 100));
  };
  if (value == null) return null;
  const p = pct(value), cp = compareValue !== undefined ? pct(compareValue) : null;
  const bar = p >= 80 ? "bg-tier-elite" : p >= 65 ? "bg-tier-good" : p >= 50 ? "bg-tier-avg" : p >= 35 ? "bg-tier-poor" : "bg-tier-bad";
  const ease = { duration: 0.7, ease: [0.16, 1, 0.3, 1] };
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className="text-[10px] text-pitch-400 w-14 flex-shrink-0">{label}</span>
      <div className="flex-1 relative h-1.5 rounded-full bg-pitch-700 overflow-hidden">
        <motion.div className={`absolute inset-y-0 left-0 rounded-full ${bar}`} initial={{ width: 0 }} animate={{ width: `${p}%` }} transition={{ ...ease, delay: 0.05 }} />
        {cp !== null && <motion.div className="absolute inset-y-0 left-0 rounded-full opacity-35" style={{ background: compareColor || "#f59e0b" }} initial={{ width: 0 }} animate={{ width: `${cp}%` }} transition={{ ...ease, delay: 0.1 }} />}
      </div>
      <span className="font-mono text-[11px] text-pitch-200 w-8 text-right tabular-nums">{value}</span>
      {compareValue != null && <span className="font-mono text-[11px] w-8 text-right tabular-nums" style={{ color: compareColor || "#f59e0b" }}>{compareValue}</span>}
    </div>
  );
}

function StatChip({ label, value, highlight }) {
  return (
    <div className={`rounded-md p-2 text-center transition-colors ${highlight ? "bg-accent/10 border border-accent/20" : "bg-pitch-750 border border-pitch-650"}`}>
      <div className={`font-mono font-semibold text-sm tabular-nums ${highlight ? "text-accent" : "text-pitch-100"}`}>{value ?? "—"}</div>
      <div className="text-[9px] text-pitch-500 uppercase tracking-widest mt-0.5">{label}</div>
    </div>
  );
}

function PlayerCard({ player, onCompare, comparePlayer, isComparing, sortKey, isKeyboardFocused }) {
  const [expanded, setExpanded] = useState(false);
  const cardRef = useRef(null);
  const color = TEAM_COLORS[player.team] || "#546480";
  const cmpColor = comparePlayer ? (TEAM_COLORS[comparePlayer.team] || "#f59e0b") : null;
  const initials = player.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const hasAdv = player.per != null;
  const hasStat = player.pts > 0 || player.ast > 0 || player.reb > 0;
  const { data: gameLogForm, isFetching: formFetching } = usePlayerGameLog(player.id, expanded);

  const radar = hasAdv ? [
    { label: "SCR", value: Math.min(100, (player.pts / 35) * 100) },
    { label: "AST", value: Math.min(100, (player.ast / 12) * 100) },
    { label: "REB", value: Math.min(100, (player.reb / 14) * 100) },
    { label: "EFF", value: Math.min(100, Math.max(0, ((player.ts - 48) / 22) * 100)) },
    { label: "USG", value: Math.min(100, Math.max(0, ((player.usg ?? 0) / 40) * 100)) },
    { label: "PER", value: Math.min(100, (player.per / 35) * 100) },
  ] : null;

  const onKey = useCallback(e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(v => !v); }
    if (e.key === "c" && onCompare) { e.preventDefault(); onCompare(player); }
  }, [player, onCompare]);

  useEffect(() => { if (isKeyboardFocused) cardRef.current?.focus(); }, [isKeyboardFocused]);

  return (
    <motion.div ref={cardRef} layout tabIndex={0} role="button" aria-expanded={expanded}
      aria-label={`${player.name}, ${player.pos}, ${player.team}. ${player.pts} pts, ${player.ast} ast, ${player.reb} reb. Enter to expand.`}
      onKeyDown={onKey} onClick={() => setExpanded(!expanded)}
      className={`pm-tile transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer ${expanded ? "ring-1 ring-accent/30" : ""} ${isComparing ? "ring-1 ring-draw/40 bg-draw/5" : ""}`}>

      <div className="p-3 flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold relative"
          style={{ background: `linear-gradient(135deg, ${color}30, ${color}10)`, color, border: `1px solid ${color}40`, boxShadow: `inset 0 1px 0 ${color}20` }}>
          {initials}
          {isComparing && <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-draw border border-pitch-800" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-pitch-100 truncate">{player.name}</span>
            <TierBadge per={player.per} />
          </div>
          <div className="text-[10px] text-pitch-400 mt-0.5 flex items-center gap-1.5">
            <span className="font-mono font-medium" style={{ color: `${color}cc` }}>{player.team}</span>
            <span className="text-pitch-600">·</span><span>{player.pos}</span>
            {player.age && <><span className="text-pitch-600">·</span><span>Age {player.age}</span></>}
          </div>
        </div>

        {radar && <div className="hidden sm:block flex-shrink-0"><MiniRadar values={radar} color={color} size={52} /></div>}

        {hasStat ? (
          <div className="flex gap-3 sm:gap-4 flex-shrink-0">
            {[{ lbl: "PTS", val: player.pts, active: sortKey === "pts" }, { lbl: "AST", val: player.ast, active: sortKey === "ast" }, { lbl: "REB", val: player.reb, active: sortKey === "reb" }].map(s => (
              <div key={s.lbl} className="text-center">
                <div className={`font-mono font-semibold text-sm tabular-nums ${s.active ? "text-accent" : "text-pitch-100"}`}>{s.val}</div>
                <div className="text-[9px] text-pitch-500 uppercase tracking-widest">{s.lbl}</div>
              </div>
            ))}
          </div>
        ) : <span className="text-[10px] text-pitch-600 flex-shrink-0 italic">No stats</span>}

        {hasAdv && onCompare && (
          <button tabIndex={-1} onClick={e => { e.stopPropagation(); onCompare(player); }}
            title={isComparing ? "Remove from comparison (C)" : "Compare (C)"}
            aria-label={isComparing ? "Remove from comparison" : "Add to comparison"}
            className={`flex-shrink-0 p-1.5 rounded-md border transition-all ${isComparing ? "bg-draw/15 border-draw/40 text-draw shadow-sm" : "bg-pitch-750 border-pitch-600 text-pitch-400 hover:text-pitch-200 hover:border-pitch-500 hover:bg-pitch-700"}`}>
            <GitCompare size={11} strokeWidth={1.8} />
          </button>
        )}
        <ChevronDown size={14} strokeWidth={1.8} className={`text-pitch-500 transition-transform duration-200 flex-shrink-0 ${expanded ? "rotate-180" : ""}`} />
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-3 pb-4 border-t border-pitch-700 pt-4">
              {hasAdv ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <div className="pm-label mb-2 flex items-center gap-2">
                      <BarChart2 size={10} /> Advanced metrics
                      {comparePlayer && <span className="text-[9px] text-pitch-500 font-normal"><span style={{ color }}>{player.name.split(" ").at(-1)}</span>{" vs "}<span style={{ color: cmpColor }}>{comparePlayer.name.split(" ").at(-1)}</span></span>}
                    </div>
                    <div className="mt-2 space-y-0">
                      <AttrBar label="PER" value={player.per} max={35} compareValue={comparePlayer?.per} compareColor={cmpColor} />
                      <AttrBar label="TS%" value={player.ts} max={75} compareValue={comparePlayer?.ts} compareColor={cmpColor} />
                      <AttrBar label="O-RTG" value={player.ortg} min={100} max={135} compareValue={comparePlayer?.ortg} compareColor={cmpColor} />
                      <AttrBar label="D-RTG" value={player.drtg} min={100} max={125} invert compareValue={comparePlayer?.drtg} compareColor={cmpColor} />
                    </div>
                    {player.ortg && player.drtg && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-[10px] text-pitch-500">Net RTG</span>
                        <span className={`font-mono text-sm font-semibold ${player.ortg - player.drtg >= 0 ? "text-win" : "text-loss"}`}>{signed(+(player.ortg - player.drtg).toFixed(1))}</span>
                        <span className="text-[9px] text-pitch-600 uppercase tracking-wider">{netRatingTier(player.ortg - player.drtg)}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="pm-label mb-2 flex items-center gap-2"><Target size={10} /> Season averages</div>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {[{ lbl: "PTS", val: player.pts, h: sortKey === "pts" }, { lbl: "AST", val: player.ast, h: sortKey === "ast" }, { lbl: "REB", val: player.reb, h: sortKey === "reb" }, { lbl: "PER", val: player.per, h: sortKey === "per" }, { lbl: "TS%", val: player.ts != null ? `${player.ts}%` : null, h: sortKey === "ts" }].map(s => (
                        <StatChip key={s.lbl} label={s.lbl} value={s.val} highlight={s.h} />
                      ))}
                    </div>
                    <div className="mt-1">
                      <div className="pm-label mb-2 flex items-center gap-2"><Zap size={10} /> Last 5 games {formFetching && <Loader size={9} className="text-pitch-500 animate-spin ml-1" />}</div>
                      {gameLogForm?.length > 0 ? (
                        <div className="flex gap-1.5">
                          {gameLogForm.map((r, i) => (
                            <motion.span key={i} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.06 }}
                              className={`w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold ${r === "W" ? "bg-win/15 text-win border border-win/30" : r === "L" ? "bg-loss/15 text-loss border border-loss/30" : "bg-pitch-600 text-pitch-400"}`}>
                              {r}
                            </motion.span>
                          ))}
                        </div>
                      ) : !formFetching ? (
                        <div className="text-[10px] text-pitch-600 italic">No recent games</div>
                      ) : (
                        <div className="flex gap-1.5">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="w-6 h-6 rounded bg-pitch-750 animate-pulse" />)}</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="pm-label mb-2 flex items-center gap-2"><Target size={10} /> Season averages</div>
                    {hasStat ? (
                      <div className="grid grid-cols-3 gap-2">
                        {[{ lbl: "PTS", val: player.pts }, { lbl: "AST", val: player.ast }, { lbl: "REB", val: player.reb }].map(s => <StatChip key={s.lbl} label={s.lbl} value={s.val} />)}
                      </div>
                    ) : <div className="text-[11px] text-pitch-500 italic">No stats this season.</div>}
                  </div>
                  <div className="flex items-end">
                    <div className="text-[10px] text-pitch-600 leading-relaxed border border-pitch-700 rounded-md px-3 py-2">
                      Advanced metrics (PER, BPM, VORP) unavailable on BDL free tier for searched players.
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

function CompareBanner({ player, onClear }) {
  const color = TEAM_COLORS[player.team] || "#f59e0b";
  const initials = player.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <motion.div initial={{ opacity: 0, y: -10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.98 }}
      className="mb-3 px-3 py-2 rounded-xl border border-draw/25 bg-draw/5 flex items-center gap-3"
      style={{ boxShadow: `0 0 0 1px ${color}20 inset` }}>
      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold flex-shrink-0"
        style={{ background: `${color}25`, color, border: `1px solid ${color}40` }}>{initials}</div>
      <div className="flex-1 min-w-0">
        <span className="text-[11px] text-pitch-400">Comparing against </span>
        <span className="text-[11px] font-semibold" style={{ color }}>{player.name}</span>
        <span className="text-[11px] text-pitch-500"> — expand any roster player to see side-by-side bars</span>
      </div>
      <kbd className="hidden sm:inline text-[9px] text-pitch-600 bg-pitch-750 border border-pitch-600 rounded px-1.5 py-0.5 font-mono">C</kbd>
      <button onClick={onClear} aria-label="Clear comparison" className="text-pitch-500 hover:text-pitch-200 transition-colors p-0.5"><X size={13} /></button>
    </motion.div>
  );
}

export default function Players({ initialQuery = "" }) {
  const [query, setQuery] = useState(initialQuery);
  const [pos, setPos] = useState("");
  const [sortKey, setSortKey] = useState("pts");
  const [comparePlayer, setComparePlayer] = useState(null);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const inputRef = useRef(null);

  useEffect(() => { setQuery(initialQuery); }, [initialQuery]);
  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 120); return () => clearTimeout(t); }, []);

  const handleCompare = useCallback(p => setComparePlayer(prev => prev?.id === p.id ? null : p), []);

  const debouncedQuery = useDebounce(query, 350);
  const trimmedQuery = query.trim();
  const trimmedDebounced = debouncedQuery.trim();
  const isSearchMode = trimmedDebounced.length >= 2;
  const isTyping = trimmedQuery.length >= 2 && query !== debouncedQuery;

  useEffect(() => { if (isSearchMode) setComparePlayer(null); }, [isSearchMode]);

  const { data: staticPlayers, isLoading: staticLoading, isError: staticError, isFetching: staticFetching, dataUpdatedAt, refetch } = useEnrichedPlayerStats();
  const { data: searchResults, isLoading: searchLoading, isFetching: searchFetching, isError: searchError, refetch: searchRefetch } = usePlayerSearch(debouncedQuery);

  // FIX: [...filtered] spread before sort prevents React Query cache mutation
  const browsePlayers = useMemo(() => {
    const filtered = (staticPlayers || []).filter(p => !pos || p.pos === pos);
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? -1;
      const bv = b[sortKey] ?? -1;
      return bv - av;
    });
  }, [staticPlayers, pos, sortKey]);

  const displayPlayers = isSearchMode ? (searchResults || []) : browsePlayers;
  const isLoading = isSearchMode ? (searchLoading && !searchResults) : staticLoading;
  const isError = isSearchMode ? searchError : staticError;
  const isFetching = isSearchMode && (searchLoading || searchFetching || isTyping);

  const handleListKeyDown = useCallback(e => {
    if (e.key === "ArrowDown") { e.preventDefault(); setFocusedIdx(p => Math.min(p + 1, displayPlayers.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setFocusedIdx(p => Math.max(p - 1, 0)); }
    else if (e.key === "Escape") { setFocusedIdx(-1); inputRef.current?.focus(); }
  }, [displayPlayers.length]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} onKeyDown={handleListKeyDown}>
      <AnimatePresence>
        {comparePlayer && <CompareBanner player={comparePlayer} onClear={() => setComparePlayer(null)} />}
      </AnimatePresence>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          {isFetching
            ? <Loader size={13} strokeWidth={1.8} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-accent animate-spin" />
            : <Search size={13} strokeWidth={1.8} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-pitch-500" />}
          <input ref={inputRef} value={query} onChange={e => { setQuery(e.target.value); setFocusedIdx(-1); }}
            placeholder={isSearchMode ? "Searching all NBA players…" : "Search player…"}
            aria-label="Search players" className="pm-input w-full pl-8 pr-8" />
          {query && <button onClick={() => { setQuery(""); inputRef.current?.focus(); }} aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-pitch-500 hover:text-pitch-300 transition-colors"><X size={12} /></button>}
        </div>

        {!isSearchMode && (staticPlayers || []).some(p => p.pos !== "—") && (
          <div className="flex gap-1" role="group" aria-label="Filter by position">
            {POSITIONS.map(p => (
              <button key={p} onClick={() => setPos(p)} aria-pressed={pos === p}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${pos === p ? "bg-accent/15 text-accent border border-accent/30" : "bg-pitch-800 text-pitch-400 border border-pitch-650 hover:border-pitch-500 hover:text-pitch-300"}`}>
                {p || "All"}
              </button>
            ))}
          </div>
        )}

        {!isSearchMode && (
          <div className="flex items-center gap-1.5 ml-auto">
            <ArrowUpDown size={11} className="text-pitch-500" />
            <select value={sortKey} onChange={e => setSortKey(e.target.value)} aria-label="Sort players by" className="pm-select text-[11px]">
              {[
                { key: "pts", label: "Points" }, { key: "ast", label: "Assists" }, { key: "reb", label: "Rebounds" }, { key: "ts", label: "TS%" },
                ...((staticPlayers || []).some(p => p.per !== null) ? [{ key: "per", label: "PER" }, { key: "ortg", label: "O-RTG" }, { key: "drtg", label: "D-RTG" }, { key: "usg", label: "USG%" }] : []),
              ].map(o => <option key={o.key} value={o.key}>Sort: {o.label}</option>)}
            </select>
          </div>
        )}

        {isSearchMode && <div className="ml-auto text-[10px] text-pitch-500 tabular-nums">{isFetching ? "Searching…" : `${displayPlayers.length} result${displayPlayers.length !== 1 ? "s" : ""}`}</div>}
      </div>

      <AnimatePresence>
        {trimmedQuery.length === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-4 text-pitch-600 text-[11px]">
            Type one more character to search all NBA players…
          </motion.div>
        )}
      </AnimatePresence>

      {!isSearchMode && displayPlayers.length > 0 && (
        <div className="hidden sm:flex items-center gap-3 mb-3 text-[10px] text-pitch-600">
          <span><kbd className="bg-pitch-750 border border-pitch-600 rounded px-1 font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="bg-pitch-750 border border-pitch-600 rounded px-1 font-mono">Enter</kbd> expand</span>
          <span><kbd className="bg-pitch-750 border border-pitch-600 rounded px-1 font-mono">C</kbd> compare</span>
          <span><kbd className="bg-pitch-750 border border-pitch-600 rounded px-1 font-mono">Esc</kbd> back to search</span>
        </div>
      )}

      {isError ? (
        <ErrorState message={isSearchMode ? "Couldn't search players." : "Couldn't load player stats."} onRetry={isSearchMode ? searchRefetch : refetch} />
      ) : isLoading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <TileSkeleton key={i} lines={2} />)}</div>
      ) : displayPlayers.length === 0 && !isFetching ? (
        <EmptyState icon={isSearchMode ? Search : SlidersHorizontal}
          title={isSearchMode ? `No results for "${trimmedDebounced}"` : "No players match"}
          description={isSearchMode ? "Try a different name, or check for typos." : "Try clearing the position filter."} />
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {displayPlayers.map((p, idx) => (
              <motion.div key={`${p.id}-${p.name}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, delay: Math.min(idx * 0.02, 0.3) }}>
                <PlayerCard player={p} onCompare={!isSearchMode ? handleCompare : null}
                  comparePlayer={comparePlayer} isComparing={comparePlayer?.id === p.id}
                  sortKey={sortKey} isKeyboardFocused={focusedIdx === idx} />
              </motion.div>
            ))}
          </AnimatePresence>
          {isSearchMode && displayPlayers.length >= 10 && (
            <div className="text-center py-3 text-[10px] text-pitch-600">Showing top {displayPlayers.length} results — refine your search to narrow down</div>
          )}
        </div>
      )}
    </motion.div>
  );
} 