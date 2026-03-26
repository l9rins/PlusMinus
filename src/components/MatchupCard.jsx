// src/components/MatchupCard.jsx
// ═══════════════════════════════════════════════════════════════════
// F1 Broadcast / Command Center Matchup Card
//
// Design language: Dense, tabular, monospaced data. Mechanical
// transitions that sweep in and lock. Team color used only as
// surgical accent lines. No bounce, no confetti, no glow.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { ChevronRight, Check, Target, Activity } from "lucide-react";
import { TEAM_COLORS, TEAM_NAMES } from "../data";
import {
  MorphingDialog,
  MorphingDialogTrigger,
  MorphingDialogContent,
  MorphingDialogClose,
  MorphingDialogContainer,
  Tooltip,
  MagneticButton
} from "./ui";

// ─── Motion constants ──────────────────────────────────────────
// Tight expo-out easing — snaps into place like F1 telemetry
const EASE_LOCK = [0.16, 1, 0.3, 1];
const EASE_SHARP = [0.33, 1, 0.68, 1];
const TWEEN_FAST = { duration: 0.25, ease: EASE_LOCK };
const TWEEN_MED = { duration: 0.4, ease: EASE_LOCK };
const TWEEN_DATA = { duration: 0.6, ease: EASE_SHARP };

// ─── AnimatedValue ─────────────────────────────────────────────
// Counter that sweeps to target — mechanical, not springy.
function AnimatedValue({ value, suffix = "", prefix = "", className = "", decimals = 0 }) {
  const mv = useMotionValue(value);
  const display = useTransform(mv, v => {
    const num = v.toFixed(decimals);
    return `${prefix}${num}${suffix}`;
  });
  const [text, setText] = useState(`${prefix}${value.toFixed(decimals)}${suffix}`);

  useEffect(() => {
    const ctrl = animate(mv, value, { duration: 0.5, ease: EASE_SHARP });
    return ctrl.stop;
  }, [value, mv]);

  useEffect(() => display.on("change", v => setText(v)), [display]);

  return <span className={className}>{text}</span>;
}

// ─── ProbBar ───────────────────────────────────────────────────
// Horizontal split bar — no ring, no donut. Clean telemetry strip.
function ProbBar({ probA, colorA, colorB }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <span className="font-mono text-[11px] font-semibold tabular-nums text-pitch-100">{probA}%</span>
        <span className="text-[9px] text-pitch-600 uppercase tracking-[2px] self-center">win prob</span>
        <span className="font-mono text-[11px] font-semibold tabular-nums text-pitch-100">{(100 - probA)}%</span>
      </div>
      <div className="flex h-[3px] rounded-sm overflow-hidden gap-[1px]">
        <motion.div
          className="h-full rounded-l-sm"
          style={{ background: colorA }}
          initial={{ width: 0 }}
          animate={{ width: `${probA}%` }}
          transition={TWEEN_DATA}
        />
        <motion.div
          className="h-full rounded-r-sm"
          style={{ background: colorB }}
          initial={{ width: 0 }}
          animate={{ width: `${100 - probA}%` }}
          transition={{ ...TWEEN_DATA, delay: 0.05 }}
        />
      </div>
    </div>
  );
}

// ─── DataCell ──────────────────────────────────────────────────
// Atomic unit of the command center — label + mono value in a
// tight bordered pod.
function DataCell({ label, value, accent, sub }) {
  return (
    <div className="border border-pitch-700/50 rounded-sm px-2.5 py-1.5 bg-pitch-850/50">
      <div className="text-[8px] text-pitch-600 uppercase tracking-[2px] leading-none mb-1">{label}</div>
      <div className={`font-mono text-sm font-semibold tabular-nums leading-none ${accent ? "" : "text-pitch-100"}`}
        style={accent ? { color: accent } : undefined}>
        {value ?? "—"}
      </div>
      {sub && <div className="text-[8px] text-pitch-600 mt-0.5 leading-none">{sub}</div>}
    </div>
  );
}

// ─── DuelRow ───────────────────────────────────────────────────
// Two-sided stat comparison — horizontal bars sweep from center.
function DuelRow({ label, aVal, bVal, colorA, colorB, invert = false, format = v => v }) {
  if (aVal == null || bVal == null) return null;
  const aWins = invert ? aVal < bVal : aVal > bVal;
  const bWins = invert ? bVal < aVal : bVal > aVal;
  const max = Math.max(Math.abs(aVal), Math.abs(bVal), 1);
  const aPct = Math.min(95, (Math.abs(aVal) / max) * 65 + 30);
  const bPct = Math.min(95, (Math.abs(bVal) / max) * 65 + 30);

  return (
    <div className="grid grid-cols-[60px_1fr_72px_1fr_60px] items-center gap-0 h-6 border-b border-pitch-700/30 last:border-0">
      {/* A value */}
      <div className={`font-mono text-[11px] tabular-nums text-right pr-2 font-medium ${aWins ? "text-pitch-50" : "text-pitch-500"}`}>
        {format(aVal)}
      </div>
      {/* A bar — grows right-to-left */}
      <div className="h-[2px] bg-pitch-800 overflow-hidden flex justify-end">
        <motion.div
          className="h-full"
          style={{ background: colorA, opacity: aWins ? 0.8 : 0.25 }}
          initial={{ width: 0 }}
          animate={{ width: `${aPct}%` }}
          transition={TWEEN_DATA}
        />
      </div>
      {/* Label */}
      <div className="text-[8px] text-pitch-600 uppercase tracking-[2.5px] text-center leading-none px-1">
        {label}
      </div>
      {/* B bar — grows left-to-right */}
      <div className="h-[2px] bg-pitch-800 overflow-hidden">
        <motion.div
          className="h-full"
          style={{ background: colorB, opacity: bWins ? 0.8 : 0.25 }}
          initial={{ width: 0 }}
          animate={{ width: `${bPct}%` }}
          transition={{ ...TWEEN_DATA, delay: 0.03 }}
        />
      </div>
      {/* B value */}
      <div className={`font-mono text-[11px] tabular-nums pl-2 font-medium ${bWins ? "text-pitch-50" : "text-pitch-500"}`}>
        {format(bVal)}
      </div>
    </div>
  );
}

// ─── PlayerStrip ───────────────────────────────────────────────
// Compact star player row — initials badge + stats in mono grid.
function PlayerStrip({ player, color, align = "left" }) {
  if (!player) return null;
  const initials = player.name.split(" ").map(w => w[0]).join("").slice(0, 2);
  const isRight = align === "right";

  return (
    <div className={`flex items-center gap-2 ${isRight ? "flex-row-reverse" : ""}`}>
      <div className="w-7 h-7 rounded-sm flex items-center justify-center text-[9px] font-bold flex-shrink-0 border"
        style={{ background: `${color}0a`, color, borderColor: `${color}30` }}>
        {initials}
      </div>
      <div className={`min-w-0 ${isRight ? "text-right" : ""}`}>
        <div className="text-[11px] font-medium text-pitch-100 truncate leading-tight">{player.name}</div>
        <div className={`flex items-center gap-2 mt-0.5 ${isRight ? "justify-end" : ""}`}>
          {[
            { l: "PTS", v: player.pts },
            { l: "AST", v: player.ast },
            { l: "REB", v: player.reb },
          ].map(s => (
            <span key={s.l} className="font-mono text-[9px] tabular-nums text-pitch-400">
              <span className="text-pitch-600">{s.l}</span> {s.v ?? "—"}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── BetButton ─────────────────────────────────────────────────
// Premium bet action — instant invert + checkmark sweep on click.
// No bounce, no confetti. Stock-ticker flash.
function BetButton({ team, odds, spread, color, side, onBet }) {
  const [state, setState] = useState("idle"); // idle | confirming | confirmed
  const fmtOdds = o => (o > 0 ? `+${o}` : `${o}`);
  const fmtSpread = (s, side) => {
    if (s == null) return null;
    const v = side === "away" ? s : -s;
    return v > 0 ? `+${v}` : `${v}`;
  };

  const handleClick = () => {
    if (state !== "idle") return;
    setState("confirming");
    onBet?.(side);
    setTimeout(() => setState("confirmed"), 80);
    setTimeout(() => setState("idle"), 1800);
  };

  const isActive = state !== "idle";

  return (
    <motion.button
      onClick={handleClick}
      className="flex-1 relative overflow-hidden rounded-sm border transition-colors"
      style={{
        background: isActive ? `${color}12` : "transparent",
        borderColor: isActive ? `${color}40` : "rgba(37,45,61,0.5)",
      }}
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.08 }}
    >
      <div className="px-3 py-2.5 flex items-center justify-between relative z-10">
        <div>
          <div className="font-display text-base tracking-[3px]" style={{ color: isActive ? color : "#d4e0ec" }}>
            {team}
          </div>
          {spread != null && (
            <div className="font-mono text-[9px] text-pitch-500 tabular-nums mt-0.5">
              {fmtSpread(spread, side)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <AnimatePresence mode="wait">
            {state === "confirmed" ? (
              <motion.div
                key="check"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={TWEEN_FAST}
              >
                <Check size={12} style={{ color }} strokeWidth={2.5} />
              </motion.div>
            ) : (
              <motion.span
                key="odds"
                className="font-mono text-sm font-semibold tabular-nums"
                style={{ color: isActive ? color : "#adbdd0" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={TWEEN_FAST}
              >
                {fmtOdds(odds)}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
      {/* Flash sweep — stock ticker update */}
      <AnimatePresence>
        {state === "confirming" && (
          <motion.div
            className="absolute inset-0 z-0"
            style={{ background: `linear-gradient(90deg, transparent, ${color}15, transparent)` }}
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE_LOCK }}
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ─── LineupRow ─────────────────────────────────────────────────
// Compact lineup data row — tabular, monospaced, border-separated.
function LineupRow({ lineup, color, delay = 0 }) {
  const names = lineup.lineup.split(" - ").map(n => n.split(" ").at(-1));
  const netColor = lineup.netRtg >= 0 ? "#22c55e" : "#ef4444";

  return (
    <motion.div
      className="flex items-center gap-0 border-b border-pitch-700/20 last:border-0 py-1"
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: EASE_LOCK, delay }}
    >
      <div className="flex-1 flex items-center gap-0 min-w-0">
        {names.map((n, i) => (
          <span key={i} className={`text-[10px] ${i === 0 ? "text-pitch-200 font-medium" : "text-pitch-500"}`}>
            {n}{i < names.length - 1 && <span className="text-pitch-700 mx-[3px]">·</span>}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
        <div className="w-10 h-[2px] bg-pitch-800 rounded-sm overflow-hidden">
          <motion.div
            className="h-full"
            style={{ background: netColor }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.max(8, (Math.abs(lineup.netRtg) / 15) * 100))}%` }}
            transition={{ duration: 0.5, ease: EASE_SHARP, delay: delay + 0.1 }}
          />
        </div>
        <span className={`font-mono text-[10px] tabular-nums font-medium w-8 text-right ${lineup.netRtg >= 0 ? "text-win" : "text-loss"}`}>
          {lineup.netRtg > 0 ? "+" : ""}{lineup.netRtg}
        </span>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MatchupCard — Main component
// ═══════════════════════════════════════════════════════════════
export default function MatchupCard({
  game,          // { home, away, time, status, homeScore, awayScore }
  odds,          // { homeOdds, awayOdds, spread, total }
  probA = 50,    // win probability for away team (0-100)
  starA = null,  // { name, pts, ast, reb, per, pos }
  starB = null,  // { name, pts, ast, reb, per, pos }
  teamStats,     // { away: { netRtg, efg, tov, pace }, home: { ... } }
  lineups,       // { away: [...top3], home: [...top3] }
  onBet,         // (side) => void
}) {
  return (
    <MorphingDialog transition={TWEEN_DATA}>
      <MorphingDialogTrigger className="w-full">
        <div className="border border-pitch-700/50 rounded-md bg-pitch-850 overflow-hidden relative"
             style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>
          {/* ── Team color accent line (2px) ───────────────────── */}
          <div className="flex h-[2px]">
            <div className="flex-1" style={{ background: colorA }} />
            <div className="flex-1" style={{ background: colorB }} />
          </div>

          {/* ── Header row ─────────────────────────────────────── */}
          <div className="w-full text-left px-4 py-3 hover:bg-pitch-800/50 transition-colors">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
              {/* Away */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-2xl tracking-[4px]" style={{ color: colorA }}>{away}</span>
                  {isLive && game.awayScore != null && (
                    <AnimatedValue value={game.awayScore} className="font-mono text-lg font-bold text-pitch-50 tabular-nums" />
                  )}
                </div>
                <div className="text-[9px] text-pitch-600 uppercase tracking-[1.5px] mt-0.5">{TEAM_NAMES[away] ?? away}</div>
              </div>

              {/* Center meta */}
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-1.5">
                  {isLive && <div className="w-1.5 h-1.5 rounded-full bg-win animate-live-pulse" />}
                  <span className="font-mono text-[10px] text-pitch-500 tabular-nums">{isLive ? "LIVE" : game?.time ?? "TBD"}</span>
                </div>
                {spread != null && (
                  <span className="font-mono text-[10px] text-pitch-400 tabular-nums">{spread > 0 ? `+${spread}` : spread}</span>
                )}
                <div className="flex items-center gap-1 text-pitch-600">
                  <ChevronRight size={10} strokeWidth={2} />
                </div>
              </div>

              {/* Home */}
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end">
                  {isLive && game.homeScore != null && (
                    <AnimatedValue value={game.homeScore} className="font-mono text-lg font-bold text-pitch-50 tabular-nums" />
                  )}
                  <span className="font-display text-2xl tracking-[4px]" style={{ color: colorB }}>{home}</span>
                </div>
                <div className="text-[9px] text-pitch-600 uppercase tracking-[1.5px] mt-0.5">{TEAM_NAMES[home] ?? home}</div>
              </div>
            </div>

            {/* Probability bar */}
            <div className="mt-3">
              <ProbBar probA={probA} colorA={colorA} colorB={colorB} />
            </div>
          </div>
        </div>
      </MorphingDialogTrigger>

      <MorphingDialogContainer>
        <MorphingDialogContent className="max-w-xl">
          <div className="p-0 border-t border-pitch-700/40">
            {/* Re-render the summary header as a non-clickable title in the modal */}
            <div className="px-4 py-4 bg-pitch-900/50 border-b border-pitch-700/50">
                <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center opacity-80 scale-95 origin-center">
                    <div className="font-display text-xl tracking-[4px]" style={{ color: colorA }}>{away}</div>
                    <div className="text-[10px] text-pitch-600 font-mono tracking-widest uppercase">matchup details</div>
                    <div className="font-display text-xl tracking-[4px] text-right" style={{ color: colorB }}>{home}</div>
                </div>
            </div>

            {/* ── Star players ─────────────────────────────── */}
            {(starA || starB) && (
              <div className="px-6 py-5 border-b border-pitch-700/30">
                <div className="text-[9px] text-pitch-500 uppercase tracking-[2.5px] mb-4 flex items-center gap-1.5 font-semibold">
                  <Target size={10} strokeWidth={2} />STAR PLAYERS
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] gap-6 items-center">
                  <PlayerStrip player={starA} color={colorA} align="left" />
                  <div className="flex flex-col items-center">
                    <div className="w-px h-6 bg-pitch-700" />
                    {starA?.per && starB?.per && (
                      <div className="py-1">
                        <Tooltip content="Efficiency gap between star players (PER)">
                           <div className="font-mono text-[11px] tabular-nums font-bold"
                             style={{ color: starA.per >= starB.per ? colorA : colorB }}>
                             {starA.per > starB.per ? "+" : ""}{(starA.per - starB.per).toFixed(1)}
                           </div>
                        </Tooltip>
                      </div>
                    )}
                    <div className="w-px h-6 bg-pitch-700" />
                  </div>
                  <PlayerStrip player={starB} color={colorB} align="right" />
                </div>
              </div>
            )}

            {/* ── Stat duel grid ───────────────────────────── */}
            {sA && sB && (
              <div className="px-6 py-5 border-b border-pitch-700/30 bg-pitch-800/20">
                <div className="text-[9px] text-pitch-500 uppercase tracking-[2.5px] mb-4 flex items-center gap-1.5 font-semibold">
                  <Activity size={10} strokeWidth={2} />TEAM TELEMETRY
                </div>
                <div className="space-y-1">
                  <DuelRow label="NET" aVal={sA.netRtg} bVal={sB.netRtg} colorA={colorA} colorB={colorB} format={v => (v > 0 ? `+${v}` : v)} />
                  <DuelRow label="eFG%" aVal={sA.efg} bVal={sB.efg} colorA={colorA} colorB={colorB} format={v => `${v}%`} />
                  <DuelRow label="TOV%" aVal={sA.tov} bVal={sB.tov} colorA={colorA} colorB={colorB} invert format={v => `${v}%`} />
                  <DuelRow label="PACE" aVal={sA.pace} bVal={sB.pace} colorA={colorA} colorB={colorB} />
                </div>
              </div>
            )}

            {/* ── Lineups ──────────────────────────────────── */}
            {(lineups?.away?.length > 0 || lineups?.home?.length > 0) && (
              <div className="px-6 py-5 border-b border-pitch-700/30 grid grid-cols-1 sm:grid-cols-2 gap-8">
                {lineups?.away?.length > 0 && (
                  <div>
                    <div className="text-[9px] uppercase tracking-[2.5px] mb-3 font-semibold" style={{ color: `${colorA}bb` }}>
                      {away} UNIT PERFORMANCE
                    </div>
                    <div className="space-y-1">
                      {lineups.away.slice(0, 3).map((l, i) => (
                        <LineupRow key={i} lineup={l} color={colorA} delay={i * 0.05} />
                      ))}
                    </div>
                  </div>
                )}
                {lineups?.home?.length > 0 && (
                  <div>
                    <div className="text-[9px] uppercase tracking-[2.5px] mb-3 font-semibold" style={{ color: `${colorB}bb` }}>
                      {home} UNIT PERFORMANCE
                    </div>
                    <div className="space-y-1">
                      {lineups.home.slice(0, 3).map((l, i) => (
                        <LineupRow key={i} lineup={l} color={colorB} delay={i * 0.05} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Bet strip ────────────────────────────────── */}
            <div className="px-6 py-6 bg-pitch-900/30">
              <div className="text-[9px] text-pitch-500 uppercase tracking-[2.5px] mb-3 font-semibold">MARKET EXECUTION (MONEYLINE)</div>
              <div className="flex gap-2">
                <BetButton team={away} odds={awayOdds} spread={spread} color={colorA} side="away" onBet={onBet} />
                <BetButton team={home} odds={homeOdds} spread={spread} color={colorB} side="home" onBet={onBet} />
              </div>
            </div>
          </div>
          <MorphingDialogClose />
        </MorphingDialogContent>
      </MorphingDialogContainer>
    </MorphingDialog>
  );
}
