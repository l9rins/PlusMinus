import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer, useWindowVirtualizer } from "@tanstack/react-virtual";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, SlidersHorizontal, ChevronDown, X, LoaderCircle,
  GitCompare, TrendingUp, TrendingDown, Minus,
  BarChart2, Zap, Target, ArrowUpDown, Info, Star
} from "lucide-react";
import { TEAM_COLORS, TEAM_NAMES } from "../data";
import { useEnrichedPlayerStats, usePlayerSearch, usePlayerGameLog, prefetchPlayerGameLog } from "../api";
import { signed, netRatingTier, debounce } from "../utils";
import {
  PremiumCard,
  PremiumCardHeader,
  PremiumCardTitle,
  PremiumCardDescription,
  PremiumCardContent,
  TileSkeleton,
  ErrorState,
  EmptyState,
  MorphingDialog,
  MorphingDialogTrigger,
  MorphingDialogContent,
  MorphingDialogClose,
  MorphingDialogContainer,
  Tooltip,
  MagneticButton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const POSITIONS = ["", "PG", "SG", "SF", "PF", "C"];

function TierBadge({ per }) {
  if (per == null) return null;
  const { label, className } =
    per >= 25 ? { label: "MVP", className: "bg-tier-elite/10 text-tier-elite border-tier-elite/20" } :
      per >= 20 ? { label: "ALL-STAR", className: "bg-tier-good/10 text-tier-good border-tier-good/20" } :
        per >= 15 ? { label: "STARTER", className: "bg-tier-avg/10 text-tier-avg border-tier-avg/20" } :
          per >= 10 ? { label: "ROTATION", className: "bg-tier-poor/10 text-tier-poor border-tier-poor/20" } :
            { label: "FRINGE", className: "bg-tier-bad/10 text-tier-bad border-tier-bad/20" };
  return <span className={cn("px-1.5 h-4 border text-[8px] font-bold flex items-center rounded tracking-tight", className)}>{label}</span>;
}

function Trend({ value, baseline }) {
  if (value == null || baseline == null) return null;
  const d = value - baseline;
  if (Math.abs(d) < 0.3) return <Minus size={9} className="text-[var(--neon-dim)]" />;
  return d > 0 ? <TrendingUp size={9} className="text-win" /> : <TrendingDown size={9} className="text-loss" />;
}

const MiniRadar = React.memo(function MiniRadar({ values, color, size = 64 }) {
  const n = values.length, cx = size / 2, cy = size / 2, r = size * 0.38;
  const ang = i => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pts = values.map((v, i) => ({ x: cx + Math.cos(ang(i)) * (v.value / 100) * r, y: cy + Math.sin(ang(i)) * (v.value / 100) * r }));
  const ring = s => values.map((_, i) => `${cx + Math.cos(ang(i)) * r * s},${cy + Math.sin(ang(i)) * r * s}`).join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0 opacity-80">
      {[0.33, 0.66, 1].map(s => <polygon key={s} points={ring(s)} fill="none" stroke="var(--neon-border)" strokeWidth={0.8} />)}
      {values.map((_, i) => <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(ang(i)) * r} y2={cy + Math.sin(ang(i)) * r} stroke="var(--neon-border)" strokeWidth={0.8} />)}
      <polygon points={pts.map(p => `${p.x},${p.y}`).join(" ")} fill={color} fillOpacity={0.12} stroke={color} strokeWidth={1.5} />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={1.2} fill={color} />)}
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
  const bar = p >= 80 ? "bg-tier-elite shadow-[0_0_8px_rgba(var(--tier-elite-rgb),0.3)]" : p >= 65 ? "bg-tier-good" : p >= 50 ? "bg-tier-avg" : p >= 35 ? "bg-tier-poor" : "bg-tier-bad";
  const ease = { duration: 0.7, ease: [0.16, 1, 0.3, 1] };
  return (
    <div className="flex items-center gap-3 mb-2.5 group">
      <span className="text-[10px] font-bold text-[var(--neon-dim)] w-14 flex-shrink-0 uppercase tracking-widest">{label}</span>
      <div className="flex-1 relative h-1 bg-[var(--neon-overlay)] overflow-hidden">
        <motion.div className={cn("absolute inset-y-0 left-0", bar)} initial={{ width: 0 }} animate={{ width: `${p}%` }} transition={{ ...ease, delay: 0.05 }} />
        {cp !== null && <motion.div className="absolute inset-y-0 left-0 opacity-20 border-r border-white/20" style={{ background: compareColor || "#000" }} initial={{ width: 0 }} animate={{ width: `${cp}%` }} transition={{ ...ease, delay: 0.1 }} />}
      </div>
      <span className="pm-number text-xs text-[var(--neon-text)] w-10 text-right tabular-nums">{value}</span>
      {compareValue != null && <span className="pm-number text-xs w-10 text-right tabular-nums opacity-30" style={{ color: compareColor }}>{compareValue}</span>}
    </div>
  );
}

function StatChip({ label, value, highlight }) {
  return (
    <div className={cn(
      "p-4 text-center transition-all border rounded-lg",
      highlight ? "bg-[var(--neon-green-faint)] border-[var(--neon-green-border)] text-[var(--neon-green)]" : "bg-[var(--neon-surface)]/20 border-[var(--neon-border)] text-[var(--neon-text)] hover:border-[var(--neon-border-md)]"
    )}>
      <div className="pm-number text-2xl tabular-nums leading-none tracking-tight">{value ?? "—"}</div>
      <div className={cn("text-[9px] font-semibold uppercase tracking-[1px] mt-2 opacity-40", highlight && "opacity-80")}>{label}</div>
    </div>
  );
}

function PlayerCard({ player, onCompare, comparePlayer, isComparing, sortKey, isKeyboardFocused }) {
  const queryClient = useQueryClient();
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

  const handleMouseEnter = useCallback(() => {
    prefetchPlayerGameLog(queryClient, player.id);
  }, [player.id, queryClient]);

  const onKey = useCallback(e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(v => !v); }
    if (e.key === "c" && onCompare) { e.preventDefault(); onCompare(player); }
  }, [player, onCompare]);

  useEffect(() => { if (isKeyboardFocused) cardRef.current?.focus(); }, [isKeyboardFocused]);

  return (
    <MorphingDialog transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
      <MorphingDialogTrigger className="w-full">
        <div ref={cardRef} tabIndex={0} role="button"
          aria-label={`${player.name}, ${player.pos}, ${player.team}. ${player.pts} pts, ${player.ast} ast, ${player.reb} reb.`}
          onKeyDown={onKey} onMouseEnter={handleMouseEnter}
          className={cn(
            "p-3 rounded border transition-all outline-none cursor-pointer group flex items-center gap-4",
            isComparing 
              ? "border-[var(--neon-green-border)] bg-[var(--neon-green-faint)]" 
              : "border-[var(--neon-border)] bg-[var(--neon-surface)]/40 hover:border-[var(--neon-border-md)] hover:bg-[var(--neon-surface)]"
          )}>

          <div className="w-9 h-9 rounded-sm flex items-center justify-center flex-shrink-0 text-[10px] font-bold relative"
            style={{ background: `var(--neon-overlay)`, color, border: `1px solid ${color}40` }}>
            {initials}
            {isComparing && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[var(--neon-green)] border-2 border-[var(--neon-surface)]" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="pm-number text-base text-[var(--neon-text)] truncate tracking-tight">{player.name}</span>
              <TierBadge per={player.per} />
            </div>
            <div className="text-[9px] font-bold text-[var(--neon-muted)] opacity-40 mt-1 flex items-center gap-2 uppercase tracking-tight">
              <span style={{ color }}>{player.team}</span>
              <span className="opacity-30">·</span><span>{player.pos}</span>
              {player.age && <><span className="opacity-30">·</span><span>AGE {player.age}</span></>}
            </div>
          </div>

          {radar && <div className="hidden sm:block flex-shrink-0"><MiniRadar values={radar} color={color} size={44} /></div>}

          {hasStat ? (
            <div className="flex gap-4 sm:gap-6 flex-shrink-0">
              {[{ lbl: "PTS", val: player.pts, active: sortKey === "pts" }, { lbl: "AST", val: player.ast, active: sortKey === "ast" }, { lbl: "REB", val: player.reb, active: sortKey === "reb" }].map(s => (
                <div key={s.lbl} className="text-right">
                  <div className={cn("pm-number text-sm tabular-nums", s.active ? "text-[var(--neon-green)]" : "text-[var(--neon-text)]")}>{s.val}</div>
                </div>
              ))}
            </div>
          ) : <span className="text-[9px] text-[var(--neon-muted)] flex-shrink-0 italic opacity-40 uppercase tracking-widest">NO_STAT</span>}

          {hasAdv && onCompare && (
            <button onClick={e => { e.stopPropagation(); onCompare(player); }}
              title={isComparing ? "Remove Comparison (C)" : "Add Comparison (C)"}
              className={cn("p-1.5 rounded border transition-all flex-shrink-0",
                isComparing 
                  ? "bg-[var(--neon-green-faint)] border-[var(--neon-green-border)] text-[var(--neon-green)]" 
                  : "bg-[var(--neon-overlay)] border-[var(--neon-border)] text-[var(--neon-dim)] hover:border-[var(--neon-border-md)] hover:text-[var(--neon-text)]")}>
              <GitCompare size={12} strokeWidth={2} />
            </button>
          )}
          <ChevronDown size={14} className="text-[var(--neon-dim)] opacity-40 flex-shrink-0" />
        </div>
      </MorphingDialogTrigger>

      <MorphingDialogContainer>
        <MorphingDialogContent className="max-w-xl border border-[var(--neon-border-md)] bg-[var(--neon-surface)] p-0 overflow-hidden shadow-2xl">
          <div className="px-8 py-8">
            <div className="flex items-center gap-6 mb-10 pb-6 border-b border-[var(--neon-border)]">
              <div className="w-20 h-20 rounded-sm flex items-center justify-center text-2xl font-bold flex-shrink-0"
                style={{ background: `var(--neon-overlay)`, color, border: `1px solid ${color}60` }}>
                {initials}
              </div>
              <div>
                <div className="pm-number text-3xl tracking-tight text-[var(--neon-text)] leading-none mb-2">{player.name.toUpperCase()}</div>
                <div className="text-[11px] text-[var(--neon-muted)] flex items-center gap-3 font-bold uppercase tracking-widest opacity-60">
                  <span style={{ color }}>{player.team}</span>
                  <span className="opacity-30">/</span>
                  <span>{player.pos}</span>
                  <span className="opacity-30">/</span>
                  <span>AGE {player.age}</span>
                </div>
              </div>
              <div className="ml-auto">
                <TierBadge per={player.per} />
              </div>
            </div>

            {hasAdv ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                <div>
                  <div className="pm-label mb-6 flex items-center gap-2 opacity-40 uppercase tracking-[2px]">
                    <BarChart2 size={12} /> TELEMETRY_ADV
                  </div>
                  <div className="space-y-1">
                    <AttrBar label="PER" value={player.per} max={35} compareValue={comparePlayer?.per} compareColor={cmpColor} />
                    <AttrBar label="TS%" value={player.ts} max={75} compareValue={comparePlayer?.ts} compareColor={cmpColor} />
                    <AttrBar label="O-RTG" value={player.ortg} min={100} max={135} compareValue={comparePlayer?.ortg} compareColor={cmpColor} />
                    <AttrBar label="D-RTG" value={player.drtg} min={100} max={125} invert compareValue={comparePlayer?.drtg} compareColor={cmpColor} />
                  </div>
                  {player.ortg && player.drtg && (
                    <div className="mt-8 p-4 rounded bg-[var(--neon-overlay)] border border-[var(--neon-border)]">
                      <div className="pm-label text-[9px] opacity-30 mb-2 uppercase tracking-widest">NET PERFORMANCE SIGNAL</div>
                      <div className="flex items-center justify-between">
                        <span className={cn("pm-number text-3xl font-bold tracking-tighter tabular-nums", player.ortg - player.drtg >= 0 ? "text-win" : "text-loss")}>
                          {signed(+(player.ortg - player.drtg).toFixed(1))}
                        </span>
                        <div className="text-right">
                          <div className="text-[10px] font-bold text-[var(--neon-muted)] uppercase tracking-wider">{netRatingTier(player.ortg - player.drtg)}</div>
                          <div className="text-[8px] text-[var(--neon-dim)] uppercase opacity-30 mt-0.5">EST. MARGIN/100</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <div className="pm-label mb-6 flex items-center gap-2 opacity-40 uppercase tracking-[2px]"><Target size={12} /> TELEMETRY_AVG</div>
                  <div className="grid grid-cols-3 gap-3 mb-8">
                    {[{ lbl: "PTS", val: player.pts, h: sortKey === "pts" }, { lbl: "AST", val: player.ast, h: sortKey === "ast" }, { lbl: "REB", val: player.reb, h: sortKey === "reb" }, { lbl: "PER", val: player.per, h: sortKey === "per" }, { lbl: "TS%", val: player.ts != null ? `${player.ts}%` : null, h: sortKey === "ts" }].map(s => (
                      <StatChip key={s.lbl} label={s.lbl} value={s.val} highlight={s.h} />
                    ))}
                  </div>
                  <div className="mt-2">
                    <div className="pm-label mb-4 flex items-center gap-2 opacity-40 uppercase tracking-[2px]">
                      <Zap size={12} /> FORM_L5
                      {formFetching && <LoaderCircle size={10} className="text-[var(--neon-dim)] animate-spin ml-2" />}
                    </div>
                    {gameLogForm?.length > 0 ? (
                      <div className="flex gap-1.5">
                        {gameLogForm.map((r, i) => (
                          <motion.span key={i} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                            className={cn("w-8 h-8 rounded-sm flex items-center justify-center text-[10px] font-bold border", 
                              r === "W" ? "bg-win/10 text-win border-win/30" : r === "L" ? "bg-loss/10 text-loss border-loss/30" : "bg-[var(--neon-overlay)] text-[var(--neon-dim)] border-[var(--neon-border)]")}>
                            {r}
                          </motion.span>
                        ))}
                      </div>
                    ) : !formFetching ? (
                      <div className="text-[10px] font-mono text-[var(--neon-dim)] opacity-40 uppercase tracking-widest italic">NO_LOG_DATA</div>
                    ) : (
                      <div className="flex gap-1.5">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="w-8 h-8 rounded-sm bg-[var(--neon-overlay)] border border-[var(--neon-border)] animate-pulse" />)}</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                <div>
                  <div className="pm-label mb-6 flex items-center gap-2 opacity-40 uppercase tracking-[2px]"><Target size={12} /> SEASON_LEVEL</div>
                  {hasStat ? (
                    <div className="grid grid-cols-3 gap-3">
                      {[{ lbl: "PTS", val: player.pts }, { lbl: "AST", val: player.ast }, { lbl: "REB", val: player.reb }].map(s => <StatChip key={s.lbl} label={s.lbl} value={s.val} />)}
                    </div>
                  ) : <div className="text-[10px] font-mono text-[var(--neon-dim)] opacity-40 uppercase tracking-widest italic">NO_TELEMETRY</div>}
                </div>
                <div className="flex items-end">
                  <div className="text-[10px] text-[var(--neon-dim)] leading-relaxed border border-[var(--neon-border)] bg-[var(--neon-surface)]/20 rounded p-5 opacity-60">
                    <div className="text-[var(--neon-text)] mb-2 uppercase tracking-widest font-bold">DATA_PROTOCOL_NOTE</div>
                    Advanced metrics (PER, BPM, VORP) are currently unavailable for non-indexed high-frequency nodes. System tracking active.
                  </div>
                </div>
              </div>
            )}
          </div>
          <MorphingDialogClose />
        </MorphingDialogContent>
      </MorphingDialogContainer>
    </MorphingDialog>
  );
}

function CompareBanner({ player, onClear }) {
  const color = TEAM_COLORS[player.team] || "#00e599";
  const initials = player.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      className="mb-4 px-4 py-3 rounded border border-[var(--neon-green-border)] bg-[var(--neon-green-faint)] flex items-center gap-4">
      <div className="w-8 h-8 rounded-sm flex items-center justify-center text-[10px] font-bold flex-shrink-0"
        style={{ background: `var(--neon-overlay)`, color, border: `1px solid ${color}40` }}>{initials}</div>
      <div className="flex-1 min-w-0">
        <span className="text-[11px] text-[var(--neon-muted)] opacity-60 uppercase tracking-widest">SIGNAL_LOCK — Comparing against </span>
        <span className="text-[11px] font-bold tracking-widest" style={{ color }}>{player.name.toUpperCase()}</span>
      </div>
      <kbd className="hidden sm:inline text-[8px] text-[var(--neon-text)] font-mono border border-[var(--neon-border-md)] px-1.5 py-0.5 rounded opacity-40">C</kbd>
      <button onClick={onClear} aria-label="Clear comparison" className="text-[var(--neon-muted)] hover:text-[var(--neon-text)] transition-colors p-1"><X size={14} /></button>
    </motion.div>
  );
}

export default function Players({ initialQuery = "" }) {
  const [localQuery, setLocalQuery] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [pos, setPos] = useState("");
  const [sortKey, setSortKey] = useState("pts");
  const [comparePlayer, setComparePlayer] = useState(null);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const inputRef = useRef(null);

  const debouncedSetQuery = useMemo(() => debounce(setQuery, 200), []);

  useEffect(() => { 
    setLocalQuery(initialQuery); 
    setQuery(initialQuery); 
  }, [initialQuery]);
  
  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 120); return () => clearTimeout(t); }, []);

  const handleCompare = useCallback(p => setComparePlayer(prev => prev?.id === p.id ? null : p), []);

  const trimmedQuery = localQuery.trim();
  const trimmedDebounced = query.trim();
  const isSearchMode = trimmedDebounced.length >= 2;
  const isTyping = trimmedQuery.length >= 2 && localQuery !== query;

  useEffect(() => { if (isSearchMode) setComparePlayer(null); }, [isSearchMode]);

  const { data: staticPlayers, isLoading: staticLoading, isError: staticError, isFetching: staticFetching, dataUpdatedAt, refetch } = useEnrichedPlayerStats();
  const { data: searchResults, isLoading: searchLoading, isFetching: searchFetching, isError: searchError, refetch: searchRefetch } = usePlayerSearch(query);

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

  const virtualizer = useWindowVirtualizer({
    count: displayPlayers.length,
    estimateSize: () => 72,
    overscan: 5,
  });

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

      <div className="flex flex-wrap items-center gap-3 mb-6 bg-[var(--neon-surface)] p-3 rounded border border-[var(--neon-border)]">
        <div className="relative flex-1 min-w-[220px]">
          {isFetching
            ? <LoaderCircle size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--neon-green)] animate-spin" />
            : <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--neon-dim)]" />}
          <input ref={inputRef} value={localQuery} onChange={e => { setLocalQuery(e.target.value); debouncedSetQuery(e.target.value); setFocusedIdx(-1); }}
            placeholder={isSearchMode ? "SCANNING_ALL_NODES…" : "SEARCH_PLAYER_ID…"}
            aria-label="Search players" className="w-full bg-[var(--neon-overlay)] border border-[var(--neon-border)] rounded px-10 py-2.5 text-xs font-bold text-[var(--neon-text)] placeholder:text-[var(--neon-dim)] placeholder:opacity-40 focus:outline-none focus:border-[var(--neon-border-md)] transition-all" />
          {localQuery && <button onClick={() => { setLocalQuery(""); setQuery(""); inputRef.current?.focus(); }} aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--neon-dim)] hover:text-[var(--neon-text)] transition-colors"><X size={14} /></button>}
        </div>

        {!isSearchMode && (staticPlayers || []).some(p => p.pos !== "—") && (
          <div className="flex gap-1" role="group" aria-label="Filter by position">
            {POSITIONS.map(p => (
              <button key={p} onClick={() => setPos(p)} aria-pressed={pos === p}
                className={cn("px-3 py-2 rounded text-[10px] font-bold tracking-widest transition-all border",
                  pos === p ? "bg-[var(--neon-raised)] text-[var(--neon-green)] border-[var(--neon-green-border)]" : "text-[var(--neon-dim)] border-transparent hover:text-[var(--neon-text)]")}>
                {p || "ALL"}
              </button>
            ))}
          </div>
        )}

        {!isSearchMode && (
          <div className="flex items-center gap-3 ml-auto">
            <div className="text-[10px] text-[var(--neon-dim)] opacity-40 uppercase tracking-widest flex items-center gap-2"><ArrowUpDown size={11} /> Sequence</div>
            <Select value={sortKey} onValueChange={setSortKey}>
              <SelectTrigger className="w-[120px] bg-[var(--neon-overlay)] border-[var(--neon-border)] text-[var(--neon-text)] text-[10px] font-bold focus:border-[var(--neon-border-md)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[var(--neon-surface)] border-[var(--neon-border)]">
                {[
                  { key: "pts", label: "Points" }, { key: "ast", label: "Assists" }, { key: "reb", label: "Rebounds" }, { key: "ts", label: "TS%" },
                  ...((staticPlayers || []).some(p => p.per !== null) ? [{ key: "per", label: "PER" }, { key: "ortg", label: "O-RTG" }, { key: "drtg", label: "D-RTG" }, { key: "usg", label: "USG%" }] : []),
                ].map(o => <SelectItem key={o.key} value={o.key} className="text-[var(--neon-text)] focus:bg-[var(--neon-overlay)] focus:text-[var(--neon-green)]">{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <AnimatePresence>
        {trimmedQuery.length === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-6 text-[var(--neon-dim)] font-mono text-[10px] uppercase tracking-[2px] opacity-40">
            Awaiting additional entropy for deep scan…
          </motion.div>
        )}
      </AnimatePresence>

      {!isSearchMode && displayPlayers.length > 0 && (
        <div className="hidden sm:flex items-center gap-4 mb-4 text-[9px] font-mono text-[var(--neon-dim)] uppercase tracking-widest opacity-30">
          <span className="flex items-center gap-1.5"><kbd className="border border-[var(--neon-border-md)] px-1 rounded">↑↓</kbd> NAV</span>
          <span className="flex items-center gap-1.5"><kbd className="border border-[var(--neon-border-md)] px-1 rounded">ENTER</kbd> EXPAND</span>
          <span className="flex items-center gap-1.5"><kbd className="border border-[var(--neon-border-md)] px-1 rounded">C</kbd> COMP</span>
          <span className="flex items-center gap-1.5"><kbd className="border border-[var(--neon-border-md)] px-1 rounded">ESC</kbd> RESET</span>
        </div>
      )}

      {isError ? (
        <ErrorState message={isSearchMode ? "Failed to synchronize remote player nodes." : "Failed to load cached roster telemetry."} onRetry={isSearchMode ? searchRefetch : refetch} />
      ) : isLoading ? (
        <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <TileSkeleton key={i} lines={2} />)}</div>
      ) : displayPlayers.length === 0 && !isFetching ? (
        <EmptyState icon={isSearchMode ? Search : SlidersHorizontal}
          title={isSearchMode ? `ZERO_MATCH: "${trimmedDebounced.toUpperCase()}"` : "NULL_RESULT"}
          description={isSearchMode ? "Refine player ID or check transmission logs." : "Broaden filter parameters for roster scan."} />
      ) : (
        <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
          {virtualizer.getVirtualItems().map(virtualItem => {
            const p = displayPlayers[virtualItem.index];
            return (
              <div key={`${p.id}-${p.name}`}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                className="absolute top-0 left-0 w-full"
                style={{
                  transform: `translateY(${virtualItem.start}px)`,
                  paddingBottom: "8px"
                }}>
                <PlayerCard player={p} onCompare={!isSearchMode ? handleCompare : null}
                  comparePlayer={comparePlayer} isComparing={comparePlayer?.id === p.id}
                  sortKey={sortKey} isKeyboardFocused={focusedIdx === virtualItem.index} />
              </div>
            );
          })}
          {isSearchMode && displayPlayers.length >= 10 && (
            <div className="text-center py-6 text-[9px] font-mono text-[var(--neon-dim)] uppercase tracking-[3px] opacity-40" style={{ transform: `translateY(${virtualizer.getTotalSize()}px)` }}>STREAM_LIMIT — REFYNE SCAN TO NARROW NODES</div>
          )}
        </div>
      )}
    </motion.div>
  );
}