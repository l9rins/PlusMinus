// src/components/MatchupCard.jsx
// ═══════════════════════════════════════════════════════════════════
// PlusMinus Crystal — Premium Matchup Card
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { ChevronRight, Check, Target, Activity, Flame, Shield, TrendingUp } from "lucide-react";
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
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="font-display font-black text-sm tabular-nums text-morphin-text">{probA}%</span>
        <span className="text-[9px] text-morphin-muted uppercase tracking-[3px] font-bold">Model Edge</span>
        <span className="font-display font-black text-sm tabular-nums text-morphin-text">{(100 - probA)}%</span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-morphin-ghost border border-morphin-border shadow-sm">
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
    <div className="border border-morphin-border rounded-2xl px-4 py-3 bg-morphin-ghost/50 hover:bg-white transition-colors group">
      <div className="text-[9px] text-morphin-muted uppercase tracking-[2px] font-bold mb-1.5">{label}</div>
      <div className={cn("font-display text-lg font-black tabular-nums leading-none", !accent && "text-morphin-text")}
        style={accent ? { color: accent } : undefined}>
        {value ?? "—"}
      </div>
      {sub && <div className="text-[10px] text-morphin-muted mt-1 font-medium italic">{sub}</div>}
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
    <div className="grid grid-cols-[80px_1fr_100px_1fr_80px] items-center gap-0 py-2 border-b border-morphin-border/50 last:border-0 group">
      <div className={cn("font-display font-black text-sm tabular-nums text-right pr-4", aWins ? "text-morphin-text" : "text-morphin-muted")}>
        {format(aVal)}
      </div>
      <div className="h-1 bg-morphin-ghost rounded-full overflow-hidden flex justify-end">
        <motion.div
          className="h-full rounded-full"
          style={{ background: colorA, opacity: aWins ? 1 : 0.2 }}
          initial={{ width: 0 }} animate={{ width: `${aPct}%` }} transition={TWEEN_DATA}
        />
      </div>
      <div className="text-[9px] text-morphin-muted uppercase tracking-[3px] text-center font-bold px-2">
        {label}
      </div>
      <div className="h-1 bg-morphin-ghost rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: colorB, opacity: bWins ? 1 : 0.2 }}
          initial={{ width: 0 }} animate={{ width: `${bPct}%` }} transition={{ ...TWEEN_DATA, delay: 0.03 }}
        />
      </div>
      <div className={cn("font-display font-black text-sm tabular-nums pl-4", bWins ? "text-morphin-text" : "text-morphin-muted")}>
        {format(bVal)}
      </div>
    </div>
  );
}

function PlayerStrip({ player, color, align = "left" }) {
  if (!player) return null;
  const isRight = align === "right";
  return (
    <div className={cn("flex items-center gap-4", isRight && "flex-row-reverse")}>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xs font-black flex-shrink-0 border-2 shadow-sm"
        style={{ background: `${color}10`, color, borderColor: `${color}20` }}>
        {player.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
      </div>
      <div className={isRight ? "text-right" : ""}>
        <div className="text-sm font-black text-morphin-text leading-tight">{player.name}</div>
        <div className={cn("flex items-center gap-3 mt-1", isRight && "justify-end")}>
          {[
            { l: "P", v: player.pts },
            { l: "A", v: player.ast },
            { l: "R", v: player.reb },
          ].map(s => (
            <span key={s.l} className="text-[10px] font-bold text-morphin-muted uppercase tracking-wider">
               <span className="opacity-60">{s.l}</span> {s.v ?? "—"}
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
        "flex-1 p-5 rounded-[2rem] border-2 transition-all flex items-center justify-between group overflow-hidden relative",
        state === "idle" ? "bg-white border-morphin-border hover:border-black active:scale-[0.98]" : "bg-black border-black"
      )}
    >
      <div className="relative z-10 flex flex-col items-start">
        <span className={cn("font-display text-xl font-bold tracking-[3px] uppercase", state === "idle" ? "text-morphin-text" : "text-white")}>{team}</span>
        {spread != null && (
          <span className={cn("text-[10px] font-bold uppercase tracking-widest mt-1", state === "idle" ? "text-morphin-muted" : "text-white/60")}>
            {side === "away" ? (spread > 0 ? `+${spread}` : spread) : (spread > 0 ? `-${spread}` : `+${Math.abs(spread)}`)}
          </span>
        )}
      </div>
      <div className="relative z-10">
         <AnimatePresence mode="wait">
            {state === "confirmed" ? (
              <motion.div key="c" initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-10 h-10 rounded-full bg-win flex items-center justify-center text-white"><Check size={20} strokeWidth={4}/></motion.div>
            ) : (
              <motion.span key="o" className={cn("font-display text-2xl font-black", state === "idle" ? "text-morphin-accent" : "text-white")}>
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
        <div className="pm-tile group">
          <div className="flex h-1.5 overflow-hidden rounded-t-[2.5rem]">
            <div className="flex-1" style={{ background: colorA }} />
            <div className="flex-1" style={{ background: colorB }} />
          </div>
          <div className="p-8 text-left">
             <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                   {isLive && <Badge variant="destructive" className="animate-pulse">LIVE</Badge>}
                   <span className="text-[10px] font-bold text-morphin-muted uppercase tracking-[3px]">{isLive ? `Q${game.period}` : (isFinal ? "FINAL" : time)}</span>
                </div>
                {spread != null && <span className="text-[10px] font-bold text-morphin-muted uppercase tracking-[3px]">Spread: {spread > 0 ? `+${spread}` : spread}</span>}
             </div>

             <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6 mb-8">
                <div className="flex flex-col items-start gap-2">
                   <div className="w-16 h-16 rounded-3xl bg-morphin-ghost flex items-center justify-center border-2 border-transparent group-hover:border-morphin-border transition-all shadow-sm" style={{ borderBottom: `4px solid ${colorA}` }}>
                      <span className="font-display text-3xl font-black">{away}</span>
                   </div>
                   <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-morphin-muted uppercase tracking-widest">{TEAM_NAMES[away]}</span>
                      {awayScore != null && <span className="text-4xl font-display font-black text-morphin-text mt-1">{awayScore}</span>}
                   </div>
                </div>

                <div className="p-4 bg-morphin-ghost rounded-full border border-morphin-border">
                   <Activity size={20} className="text-morphin-muted" />
                </div>

                <div className="flex flex-col items-end gap-2">
                   <div className="w-16 h-16 rounded-3xl bg-morphin-ghost flex items-center justify-center border-2 border-transparent group-hover:border-morphin-border transition-all shadow-sm" style={{ borderBottom: `4px solid ${colorB}` }}>
                      <span className="font-display text-3xl font-black">{home}</span>
                   </div>
                   <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold text-morphin-muted uppercase tracking-widest">{TEAM_NAMES[home]}</span>
                      {homeScore != null && <span className="text-4xl font-display font-black text-morphin-text mt-1">{homeScore}</span>}
                   </div>
                </div>
             </div>

             <div className="pt-6 border-t border-morphin-border">
                <ProbBar probA={probA} colorA={colorA} colorB={colorB} />
             </div>
          </div>
        </div>
      </MorphingDialogTrigger>

      <MorphingDialogContainer>
        <MorphingDialogContent className="max-w-2xl bg-white border border-morphin-border rounded-[3rem] overflow-hidden shadow-2xl">
           <div className="p-10 space-y-12 overflow-y-auto max-h-[85vh] scrollbar-none">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                       <span className="text-[10px] font-black text-morphin-muted uppercase tracking-[4px] mb-2">Matchup</span>
                       <h2 className="font-display text-4xl font-black tracking-tight">{away} <span className="text-morphin-muted mx-2 font-normal">@</span> {home}</h2>
                    </div>
                 </div>
                 <Badge variant="outline" className="h-10 px-6 rounded-2xl border-morphin-border text-[11px]">Analytics Data v2.4</Badge>
              </div>

              {/* Quick High-Level Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                 <DataCell label="Home Elo" value={teamStats?.home?.elo || 1500} accent={colorB} />
                 <DataCell label="Away Elo" value={teamStats?.away?.elo || 1500} accent={colorA} />
                 <DataCell label="Implied Margin" value={spread ? `${Math.abs(spread)} pts` : "—"} />
                 <DataCell label="Strength of Schedule" value="Top 10%" accent="#f59e0b" />
              </div>

              {/* Star Duel */}
              {(starA || starB) && (
                <div className="p-8 bg-morphin-ghost/50 rounded-[2.5rem] border border-morphin-border/50">
                  <div className="flex items-center justify-between mb-8">
                     <div className="flex items-center gap-2">
                        <Flame size={18} className="text-loss" />
                        <span className="text-[10px] font-black text-morphin-muted uppercase tracking-[3px]">Key Personnel</span>
                     </div>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-10">
                    <PlayerStrip player={starA} color={colorA} align="left" />
                    <div className="w-12 h-12 rounded-full border border-morphin-border flex items-center justify-center bg-white shadow-sm font-display font-black text-sm">VS</div>
                    <PlayerStrip player={starB} color={colorB} align="right" />
                  </div>
                </div>
              )}

              {/* Deep Telemetry */}
              <div className="space-y-6">
                 <div className="flex items-center gap-2 px-2">
                    <TrendingUp size={18} className="text-win" />
                    <span className="text-[10px] font-black text-morphin-muted uppercase tracking-[3px]">Advanced Analytics</span>
                 </div>
                 <div className="bg-white rounded-[2rem] border border-morphin-border p-6 shadow-sm overflow-hidden">
                    <DuelRow label="Efficiency" aVal={sA?.netRtg} bVal={sB?.netRtg} colorA={colorA} colorB={colorB} format={v => (v > 0 ? `+${v}` : v)} />
                    <DuelRow label="True Shooting%" aVal={sA?.efg} bVal={sB?.efg} colorA={colorA} colorB={colorB} format={v => `${v}%`} />
                    <DuelRow label="Ball Security" aVal={sA?.tov} bVal={sB?.tov} colorA={colorA} colorB={colorB} invert format={v => `${v}%`} />
                    <DuelRow label="Pace Factor" aVal={sA?.pace} bVal={sB?.pace} colorA={colorA} colorB={colorB} />
                 </div>
              </div>

              {/* Market Execution */}
              <div className="space-y-6">
                 <div className="flex items-center gap-2 px-2">
                    <Shield size={18} className="text-morphin-accent" />
                    <span className="text-[10px] font-black text-morphin-muted uppercase tracking-[3px]">Smart Execution (ML)</span>
                 </div>
                 <div className="flex gap-4">
                    <BetButton team={away} odds={odds?.awayOdds || -110} spread={odds?.spread} color={colorA} side="away" onBet={onBet} />
                    <BetButton team={home} odds={odds?.homeOdds || -110} spread={odds?.spread} color={colorB} side="home" onBet={onBet} />
                 </div>
              </div>

           </div>
           <MorphingDialogClose className="absolute top-10 right-10 p-3 hover:bg-morphin-ghost rounded-2xl transition-all" />
        </MorphingDialogContent>
      </MorphingDialogContainer>
    </MorphingDialog>
  );
}
