// src/components/MatchupCard.jsx
// ═══════════════════════════════════════════════════════════════════
// PlusMinus Crystal — Premium Matchup Card
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { ChevronRight, Check, Target, Activity, Flame, Shield, TrendingUp, Zap } from "lucide-react";
import { TEAM_COLORS, TEAM_NAMES } from "../data";
import {
  MorphingDialog,
  MorphingDialogTrigger,
  MorphingDialogContent,
  MorphingDialogClose,
  MorphingDialogContainer,
} from "./ui/morphing-dialog";
import { Tooltip } from "./ui/tooltip";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";

const EASE_LOCK = [0.16, 1, 0.3, 1];
const EASE_SHARP = [0.33, 1, 0.68, 1];
const TWEEN_DATA = { duration: 0.6, ease: EASE_SHARP };

function AnimatedValue({ value, suffix = "", prefix = "", className = "", decimals = 0 }) {
  const mv = useMotionValue(value);
  const display = useTransform(mv, v => `${prefix}${v.toFixed(decimals)}${suffix}`);
  const [text, setText] = useState(`${prefix}${value.toFixed(decimals)}${suffix}`);
  useEffect(() => {
    const ctrl = animate(mv, value, { duration: 0.5, ease: EASE_SHARP });
    return ctrl.stop;
  }, [value, mv]);
  useEffect(() => display.on("change", v => setText(v)), [display]);
  return <span className={className}>{text}</span>;
}

function ProbBar({ probA, colorA, colorB }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center px-1">
        <span className="pm-number text-sm">{Number(probA).toFixed(1).replace(/\.0$/, '')}%</span>
        <span className="pm-label opacity-40">Model Edge</span>
        <span className="pm-number text-sm">{Number(100 - probA).toFixed(1).replace(/\.0$/, '')}%</span>
      </div>
      <div className="flex h-1 rounded overflow-hidden bg-[var(--neon-overlay)] border border-[var(--neon-border)]">
        <motion.div
          className="h-full"
          style={{ background: colorA }}
          initial={{ width: 0 }}
          animate={{ width: `${probA}%` }}
          transition={TWEEN_DATA}
        />
        <motion.div
          className="h-full"
          style={{ background: colorB }}
          initial={{ width: 0 }}
          animate={{ width: `${100 - probA}%` }}
          transition={{ ...TWEEN_DATA, delay: 0.05 }}
        />
      </div>
    </div>
  );
}

function DataCell({ label, value, accent, sub }) {
  return (
    <div className="border border-[var(--neon-border)] rounded-lg px-4 py-3 bg-[var(--neon-surface)] hover:bg-[var(--neon-raised)] transition-colors group">
      <div className="pm-label opacity-50 mb-1.5">{label}</div>
      <div className={cn("pm-number text-lg leading-none", !accent && "text-[var(--neon-text)]")}
        style={accent ? { color: accent } : undefined}>
        {value ?? "—"}
      </div>
      {sub && <div className="text-[9px] font-semibold text-[var(--neon-muted)] mt-1 uppercase tracking-widest">{sub}</div>}
    </div>
  );
}

function DuelRow({ label, aVal, bVal, colorA, colorB, invert = false, format = v => v }) {
  if (aVal == null || bVal == null) return null;
  const aWins = invert ? aVal < bVal : aVal > bVal;
  const bWins = invert ? bVal < aVal : bVal > aVal;
  const max = Math.max(Math.abs(aVal), Math.abs(bVal), 1);
  const aPct = Math.min(95, (Math.abs(aVal) / max) * 100);
  const bPct = Math.min(95, (Math.abs(bVal) / max) * 100);

  return (
    <div className="grid grid-cols-[80px_1fr_100px_1fr_80px] items-center gap-0 py-2.5 border-b border-[var(--neon-border)] last:border-0 group">
      <div className={cn("pm-number text-xs text-right pr-4", aWins ? "text-[var(--neon-text)]" : "text-[var(--neon-dim)]")}>
        {format(aVal)}
      </div>
      <div className="h-0.5 bg-[var(--neon-overlay)] overflow-hidden flex justify-end">
        <motion.div
          className="h-full"
          style={{ background: colorA, opacity: aWins ? 1 : 0.15 }}
          initial={{ width: 0 }} animate={{ width: `${aPct}%` }} transition={TWEEN_DATA}
        />
      </div>
      <div className="pm-label text-center opacity-40 px-2 tracking-[2px]">
        {label}
      </div>
      <div className="h-0.5 bg-[var(--neon-overlay)] overflow-hidden">
        <motion.div
          className="h-full"
          style={{ background: colorB, opacity: bWins ? 1 : 0.15 }}
          initial={{ width: 0 }} animate={{ width: `${bPct}%` }} transition={{ ...TWEEN_DATA, delay: 0.03 }}
        />
      </div>
      <div className={cn("pm-number text-xs pl-4", bWins ? "text-[var(--neon-text)]" : "text-[var(--neon-dim)]")}>
        {format(bVal)}
      </div>
    </div>
  );
}

function PlayerStrip({ player, color, align = "left" }) {
  if (!player) return null;
  const isRight = align === "right";
  return (
    <div className={cn("flex items-center gap-3", isRight && "flex-row-reverse")}>
      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 border"
        style={{ background: "var(--neon-overlay)", color, borderColor: "var(--neon-border)" }}>
        {player.initials || player.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
      </div>
      <div className={isRight ? "text-right" : ""}>
        <div className="text-sm font-bold text-[var(--neon-text)] leading-tight tracking-tight">{player.name}</div>
        <div className={cn("flex items-center gap-3 mt-1", isRight && "justify-end")}>
          {[
            { l: "P", v: player.pts },
            { l: "A", v: player.ast },
            { l: "R", v: player.reb },
          ].map(s => (
            <span key={s.l} className="text-[9px] font-bold text-[var(--neon-muted)] uppercase tracking-wider">
               <span className="opacity-40">{s.l}</span> {s.v ?? "—"}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function BetButton({ team, odds, spread, color, side, onBet }) {
  const [state, setState] = useState("idle");
  const handleClick = () => {
    if (state !== "idle") return;
    setState("confirming");
    onBet?.(side);
    setTimeout(() => setState("confirmed"), 100);
    setTimeout(() => setState("idle"), 2000);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex-1 p-5 rounded-xl border transition-all flex items-center justify-between group overflow-hidden relative",
        state === "idle" 
          ? "bg-[var(--neon-surface)] border-[var(--neon-border)] hover:border-[var(--neon-border-md)] active:scale-[0.98]" 
          : "bg-[var(--neon-raised)] border-[var(--neon-green-border)]"
      )}
    >
      <div className="relative z-10 flex flex-col items-start">
        <span className={cn("text-lg font-bold tracking-tight uppercase", state === "idle" ? "text-[var(--neon-text)]" : "text-[var(--neon-green)]")}>{team}</span>
        {spread != null && (
          <span className={cn("text-[10px] font-bold uppercase tracking-widest mt-1", state === "idle" ? "text-[var(--neon-dim)]" : "text-[var(--neon-dim)]")}>
            {spread === 0 ? "PK" : side === "away" ? (spread > 0 ? `+${spread}` : spread) : (spread > 0 ? `-${spread}` : `+${Math.abs(spread)}`)}
          </span>
        )}
      </div>
      <div className="relative z-10">
         <AnimatePresence mode="wait">
            {state === "confirmed" ? (
              <motion.div key="c" initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-9 h-9 rounded-lg bg-[var(--neon-green-faint)] border border-[var(--neon-green-border)] flex items-center justify-center text-[var(--neon-green)]"><Check size={18} strokeWidth={3}/></motion.div>
            ) : (
              <motion.span key="o" className={cn("pm-number text-xl", state === "idle" ? "text-[var(--neon-green)]" : "text-[var(--neon-green)]")}>
                {odds > 0 ? `+${odds}` : odds}
              </motion.span>
            )}
         </AnimatePresence>
      </div>
    </button>
  );
}

export default function MatchupCard({
  game, odds, probA = 50, starA, starB, teamStats, lineups, onBet
}) {
  const { home, away, time, status, homeScore, awayScore } = game;
  const isLive = status === "live";
  const isFinal = status === "final";
  const spread = odds?.spread;
  const colorA = TEAM_COLORS[away] || "#000000";
  const colorB = TEAM_COLORS[home] || "#000000";

  const sA = teamStats?.away;
  const sB = teamStats?.home;

  return (
    <MorphingDialog>
      <MorphingDialogTrigger className="w-full">
        <div className="rounded-xl border border-[var(--neon-border)] bg-[var(--neon-surface)] overflow-hidden group hover:bg-[var(--neon-raised)] transition-colors">
          <div className="flex h-1 overflow-hidden opacity-50">
            <div className="flex-1" style={{ background: colorA }} />
            <div className="flex-1" style={{ background: colorB }} />
          </div>
          <div className="p-6 text-left">
             <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                   {isLive && <Badge className="pm-badge-live animate-pulse px-1.5 h-4 text-[9px]">LIVE</Badge>}
                   <span className="pm-label opacity-50">{isLive ? `Q${game.period}` : (isFinal ? "FINAL" : time)}</span>
                </div>
                {spread != null && <span className="pm-label opacity-50">SPR {spread > 0 ? `+${spread}` : spread}</span>}
             </div>

             <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6 mb-6">
                <div className="flex flex-col items-start gap-1">
                   <div className="w-12 h-12 rounded-lg bg-[var(--neon-overlay)] flex items-center justify-center border border-[var(--neon-border)] group-hover:border-[var(--neon-border-md)] transition-all" style={{ borderBottom: `2px solid ${colorA}` }}>
                      <span className="text-xl font-bold text-[var(--neon-text)]">{away}</span>
                   </div>
                   <div className="flex flex-col mt-1">
                      <span className="text-[9px] font-bold text-[var(--neon-dim)] uppercase tracking-wider opacity-60 truncate max-w-[80px]">{TEAM_NAMES[away]}</span>
                      {awayScore != null && <span className="pm-number text-2xl text-[var(--neon-text)]">{awayScore}</span>}
                   </div>
                </div>

                <div className="pm-label opacity-20">VS</div>

                <div className="flex flex-col items-end gap-1">
                   <div className="w-12 h-12 rounded-lg bg-[var(--neon-overlay)] flex items-center justify-center border border-[var(--neon-border)] group-hover:border-[var(--neon-border-md)] transition-all" style={{ borderBottom: `2px solid ${colorB}` }}>
                      <span className="text-xl font-bold text-[var(--neon-text)]">{home}</span>
                   </div>
                   <div className="flex flex-col items-end mt-1">
                      <span className="text-[9px] font-bold text-[var(--neon-dim)] uppercase tracking-wider opacity-60 truncate max-w-[80px]">{TEAM_NAMES[home]}</span>
                      {homeScore != null && <span className="pm-number text-2xl text-[var(--neon-text)]">{homeScore}</span>}
                   </div>
                </div>
             </div>

             <div className="pt-5 border-t border-[var(--neon-border)]">
                <ProbBar probA={probA} colorA={colorA} colorB={colorB} />
             </div>
          </div>
        </div>
      </MorphingDialogTrigger>

      <MorphingDialogContainer>
        <MorphingDialogContent className="max-w-2xl bg-[var(--neon-bg)] border border-[var(--neon-border)] rounded-xl overflow-hidden shadow-2xl">
           <div className="p-8 space-y-10 overflow-y-auto max-h-[90vh] scrollbar-none">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-6 border-l-2 border-[var(--neon-green-border)] pl-4">
                    <div className="flex flex-col">
                       <span className="pm-label opacity-40 mb-1">Telemetry Node</span>
                       <h2 className="pm-number text-3xl tracking-tight text-[var(--neon-text)]">{away} <span className="opacity-20 mx-2">@</span> {home}</h2>
                    </div>
                 </div>
                 <Badge className="pm-badge text-[9px] opacity-60">System v4.2.0</Badge>
              </div>

              {/* Quick High-Level Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                 <DataCell label="Home Elo" value={teamStats?.home?.elo || 1500} accent={colorB} />
                 <DataCell label="Away Elo" value={teamStats?.away?.elo || 1500} accent={colorA} />
                 <DataCell label="Margin" value={spread ? `${Math.abs(spread)} PTS` : "—"} />
                 <DataCell label="Hype Factor" value="CRITICAL" accent="#f87171" />
              </div>

              {/* Star Duel */}
              {(starA || starB) && (
                <div className="p-6 bg-[var(--neon-surface)] rounded-xl border border-[var(--neon-border)]">
                  <div className="flex items-center justify-between mb-8">
                     <div className="flex items-center gap-2">
                        <Flame size={14} className="text-loss" />
                        <span className="pm-label opacity-60">Impact Units</span>
                     </div>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6">
                    <PlayerStrip player={starA} color={colorA} align="left" />
                    <div className="w-8 h-8 rounded-full border border-[var(--neon-border-md)] flex items-center justify-center bg-[var(--neon-overlay)] font-bold text-[10px] text-[var(--neon-dim)]">VS</div>
                    <PlayerStrip player={starB} color={colorB} align="right" />
                  </div>
                </div>
              )}

              {/* Deep Telemetry */}
              <div className="space-y-4">
                 <div className="flex items-center gap-2 px-1">
                    <Activity size={14} className="text-[var(--neon-green)]" />
                    <span className="pm-label opacity-60">Signal Profiles</span>
                 </div>
                 <div className="bg-[var(--neon-surface)] rounded-lg border border-[var(--neon-border)] p-5 overflow-hidden">
                    <DuelRow label="Efficiency" aVal={sA?.netRtg} bVal={sB?.netRtg} colorA={colorA} colorB={colorB} format={v => (v > 0 ? `+${v}` : v)} />
                    <DuelRow label="Shot Bio" aVal={sA?.efg} bVal={sB?.efg} colorA={colorA} colorB={colorB} format={v => `${v}%`} />
                    <DuelRow label="Security" aVal={sA?.tov} bVal={sB?.tov} colorA={colorA} colorB={colorB} invert format={v => `${v}%`} />
                    <DuelRow label="T-Cycle" aVal={sA?.pace} bVal={sB?.pace} colorA={colorA} colorB={colorB} />
                 </div>
              </div>

              {/* Market Execution */}
              <div className="space-y-4">
                 <div className="flex items-center gap-2 px-1">
                    <Zap size={14} className="text-[var(--neon-green)]" />
                    <span className="pm-label opacity-60">Order Execution</span>
                 </div>
                 <div className="flex gap-3">
                    <BetButton team={away} odds={odds?.awayOdds || -110} spread={odds?.spread} color={colorA} side="away" onBet={onBet} />
                    <BetButton team={home} odds={odds?.homeOdds || -110} spread={odds?.spread} color={colorB} side="home" onBet={onBet} />
                 </div>
              </div>

           </div>
           <MorphingDialogClose className="absolute top-6 right-6 p-2 hover:bg-[var(--neon-raised)] rounded-lg transition-all text-[var(--neon-muted)]" />
        </MorphingDialogContent>
      </MorphingDialogContainer>
    </MorphingDialog>
  );
}
