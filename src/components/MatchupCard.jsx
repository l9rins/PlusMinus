// src/components/MatchupCard.jsx
// Interactive Player Matchup Card — TikTok-inspired data discovery
//
// Combines: win probability ring, star player clash, live odds,
//           stat duel bars, and quick-bet strip — all spring-animated.

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence, useSpring, useTransform, useMotionValue } from "framer-motion";
import { ChevronDown, Zap, TrendingUp, TrendingDown, Sparkles, Target } from "lucide-react";
import { TEAM_COLORS, TEAM_NAMES } from "../data";

// ─── Spring configs ────────────────────────────────────────────
const SPRING_SNAPPY  = { type: "spring", stiffness: 400, damping: 25 };
const SPRING_BOUNCY  = { type: "spring", stiffness: 300, damping: 17 };
const SPRING_SMOOTH  = { type: "spring", stiffness: 200, damping: 22 };
const SPRING_GENTLE  = { type: "spring", stiffness: 120, damping: 20 };

// ─── AnimatedNumber ────────────────────────────────────────────
// Counter that springs to new values — the "alive" feel.
function AnimatedNumber({ value, suffix = "", prefix = "", className = "", decimals = 0 }) {
  const spring = useSpring(value, { stiffness: 200, damping: 30 });
  const display = useTransform(spring, v =>
    `${prefix}${v >= 0 && prefix === "+" ? "+" : ""}${v.toFixed(decimals)}${suffix}`
  );
  const [text, setText] = useState(`${prefix}${value.toFixed(decimals)}${suffix}`);

  useEffect(() => { spring.set(value); }, [value, spring]);
  useEffect(() => display.on("change", v => setText(v)), [display]);

  return <span className={className}>{text}</span>;
}

// ─── ProbRing ──────────────────────────────────────────────────
// SVG donut that morphs when probability shifts, with glow pulse.
function ProbRing({ probA, colorA, colorB, size = 120, strokeWidth = 8 }) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const springA = useSpring(probA / 100, SPRING_SMOOTH);
  const dashA = useTransform(springA, v => v * circumference);
  const dashB = useTransform(springA, v => (1 - v) * circumference);
  const offsetB = useTransform(springA, v => -(v * circumference));

  useEffect(() => { springA.set(probA / 100); }, [probA, springA]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background track */}
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e2a38" strokeWidth={strokeWidth} />
        {/* Team A arc */}
        <motion.circle
          cx={size/2} cy={size/2} r={r}
          fill="none" stroke={colorA} strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{ strokeDasharray: useTransform(dashA, d => `${d} ${circumference}`), filter: `drop-shadow(0 0 6px ${colorA}40)` }}
        />
        {/* Team B arc */}
        <motion.circle
          cx={size/2} cy={size/2} r={r}
          fill="none" stroke={colorB} strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{ strokeDasharray: useTransform(dashB, d => `${d} ${circumference}`), strokeDashoffset: offsetB, filter: `drop-shadow(0 0 6px ${colorB}40)` }}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <AnimatedNumber value={probA} suffix="%" className="font-mono text-2xl font-bold text-pitch-50 tabular-nums" />
        <span className="text-[9px] text-pitch-500 uppercase tracking-[2px] mt-0.5">win prob</span>
      </div>
      {/* Ambient glow */}
      <div className="absolute inset-0 rounded-full opacity-20 animate-pulse-glow pointer-events-none"
        style={{ boxShadow: `0 0 30px ${colorA}30, 0 0 60px ${colorA}10` }} />
    </div>
  );
}

// ─── StatDuelBar ───────────────────────────────────────────────
// Animated comparative bar with spring physics.
function StatDuelBar({ label, aVal, bVal, colorA, colorB, invert = false, format = v => v }) {
  if (aVal == null || bVal == null) return null;
  const aWins = invert ? aVal < bVal : aVal > bVal;
  const bWins = !aWins && aVal !== bVal;
  const max = Math.max(Math.abs(aVal), Math.abs(bVal), 1);
  const aPct = Math.min(100, (Math.abs(aVal) / max) * 60 + 40);
  const bPct = Math.min(100, (Math.abs(bVal) / max) * 60 + 40);

  return (
    <div className="group mb-2.5 last:mb-0">
      <div className="flex items-center justify-between mb-1">
        <motion.span
          className={`font-mono text-xs tabular-nums font-semibold transition-colors`}
          style={{ color: aWins ? colorA : "#546480" }}
          animate={{ scale: aWins ? [1, 1.08, 1] : 1 }}
          transition={SPRING_BOUNCY}
        >
          {format(aVal)}
        </motion.span>
        <span className="text-[9px] text-pitch-600 uppercase tracking-[2px] px-2 group-hover:text-pitch-400 transition-colors">
          {label}
        </span>
        <motion.span
          className={`font-mono text-xs tabular-nums font-semibold transition-colors`}
          style={{ color: bWins ? colorB : "#546480" }}
          animate={{ scale: bWins ? [1, 1.08, 1] : 1 }}
          transition={SPRING_BOUNCY}
        >
          {format(bVal)}
        </motion.span>
      </div>
      <div className="flex h-1 rounded-full overflow-hidden gap-px">
        <div className="flex-1 bg-pitch-700 rounded-l-full overflow-hidden flex justify-end">
          <motion.div
            className="h-full rounded-l-full"
            style={{ background: colorA, opacity: aWins ? 0.9 : 0.35 }}
            initial={{ width: 0 }}
            animate={{ width: `${aPct}%` }}
            transition={SPRING_SMOOTH}
          />
        </div>
        <div className="flex-1 bg-pitch-700 rounded-r-full overflow-hidden">
          <motion.div
            className="h-full rounded-r-full"
            style={{ background: colorB, opacity: bWins ? 0.9 : 0.35 }}
            initial={{ width: 0 }}
            animate={{ width: `${bPct}%` }}
            transition={SPRING_SMOOTH}
          />
        </div>
      </div>
    </div>
  );
}

// ─── StarClash ─────────────────────────────────────────────────
// Side-by-side star player badges with PER comparison.
function StarClash({ starA, starB, colorA, colorB }) {
  if (!starA || !starB) return null;
  const initials = p => p.name.split(" ").map(w => w[0]).join("").slice(0, 2);
  const winner = (starA.per ?? 0) >= (starB.per ?? 0) ? "A" : "B";

  return (
    <div className="flex items-center gap-3">
      {/* Player A */}
      <motion.div
        className="flex-1 flex items-center gap-2 p-2 rounded-lg border transition-colors"
        style={{
          background: `${colorA}08`, borderColor: `${colorA}25`,
          boxShadow: winner === "A" ? `0 0 16px ${colorA}15` : "none",
        }}
        whileHover={{ scale: 1.02 }}
        transition={SPRING_SNAPPY}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
          style={{ background: `${colorA}20`, color: colorA, border: `1px solid ${colorA}35` }}>
          {initials(starA)}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-pitch-100 truncate">{starA.name}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="font-mono text-[10px] text-pitch-300">{starA.pts ?? "—"}</span>
            <span className="text-pitch-700">·</span>
            <span className="font-mono text-[10px] text-pitch-300">{starA.ast ?? "—"}</span>
            <span className="text-pitch-700">·</span>
            <span className="font-mono text-[10px] text-pitch-300">{starA.reb ?? "—"}</span>
          </div>
        </div>
      </motion.div>

      {/* VS flash */}
      <motion.div
        className="flex flex-col items-center gap-0.5 flex-shrink-0"
        animate={{ rotate: [0, 5, -5, 0] }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Zap size={12} className="text-pitch-500" />
        {starA.per && starB.per && (
          <div className="text-[9px] font-mono tabular-nums" style={{ color: winner === "A" ? colorA : colorB }}>
            {winner === "A" ? "+" : ""}{(starA.per - starB.per).toFixed(1)}
          </div>
        )}
      </motion.div>

      {/* Player B */}
      <motion.div
        className="flex-1 flex items-center gap-2 p-2 rounded-lg border transition-colors flex-row-reverse text-right"
        style={{
          background: `${colorB}08`, borderColor: `${colorB}25`,
          boxShadow: winner === "B" ? `0 0 16px ${colorB}15` : "none",
        }}
        whileHover={{ scale: 1.02 }}
        transition={SPRING_SNAPPY}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
          style={{ background: `${colorB}20`, color: colorB, border: `1px solid ${colorB}35` }}>
          {initials(starB)}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-pitch-100 truncate">{starB.name}</div>
          <div className="flex items-center gap-1.5 mt-0.5 justify-end">
            <span className="font-mono text-[10px] text-pitch-300">{starB.pts ?? "—"}</span>
            <span className="text-pitch-700">·</span>
            <span className="font-mono text-[10px] text-pitch-300">{starB.ast ?? "—"}</span>
            <span className="text-pitch-700">·</span>
            <span className="font-mono text-[10px] text-pitch-300">{starB.reb ?? "—"}</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── QuickBetStrip ─────────────────────────────────────────────
// One-tap bet buttons with bounce confirmation.
function QuickBetStrip({ away, home, awayOdds, homeOdds, spread, colorA, colorB, onBet }) {
  const [justBet, setJustBet] = useState(null);
  const [particles, setParticles] = useState([]);

  const handleBet = (side) => {
    setJustBet(side);
    // Generate confetti particles
    const p = Array.from({ length: 12 }, (_, i) => ({
      id: Date.now() + i,
      x: (Math.random() - 0.5) * 120,
      y: -(Math.random() * 60 + 20),
      r: Math.random() * 360,
      color: side === "away" ? colorA : colorB,
      size: Math.random() * 4 + 2,
      delay: Math.random() * 0.1,
    }));
    setParticles(p);
    setTimeout(() => { setJustBet(null); setParticles([]); }, 1200);
    onBet?.(side);
  };

  const fmtOdds = o => (o > 0 ? `+${o}` : `${o}`);

  return (
    <div className="relative">
      <div className="flex gap-2">
        {[
          { side: "away", team: away, odds: awayOdds, color: colorA },
          { side: "home", team: home, odds: homeOdds, color: colorB },
        ].map(({ side, team, odds, color }) => (
          <motion.button
            key={side}
            onClick={() => handleBet(side)}
            className="flex-1 relative overflow-hidden rounded-lg border p-2.5 transition-all group"
            style={{
              background: justBet === side ? `${color}15` : "#161b2808",
              borderColor: justBet === side ? `${color}50` : "#2e3a50",
            }}
            whileTap={{ scale: 0.95 }}
            animate={justBet === side ? { scale: [1, 1.05, 1], boxShadow: [`0 0 0px ${color}00`, `0 0 30px ${color}30`, `0 0 0px ${color}00`] } : {}}
            transition={SPRING_BOUNCY}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-lg tracking-widest" style={{ color: justBet === side ? color : "#d4e0ec" }}>
                  {team}
                </div>
                {spread != null && (
                  <div className="text-[9px] text-pitch-500 mt-0.5">
                    {side === "away" ? (spread > 0 ? `+${spread}` : spread) : (spread > 0 ? -spread : `+${Math.abs(spread)}`)}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className={`font-mono text-sm font-semibold tabular-nums ${justBet === side ? "" : "text-pitch-200"}`}
                  style={justBet === side ? { color } : undefined}>
                  {fmtOdds(odds)}
                </div>
                <div className="text-[9px] text-pitch-600 mt-0.5 group-hover:text-accent transition-colors">
                  tap to bet
                </div>
              </div>
            </div>

            {/* Shimmer sweep on hover */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{ background: `linear-gradient(105deg, transparent 40%, ${color}08 50%, transparent 60%)` }} />
          </motion.button>
        ))}
      </div>

      {/* Confetti particles */}
      <AnimatePresence>
        {particles.map(p => (
          <motion.div
            key={p.id}
            className="absolute rounded-full pointer-events-none"
            style={{ width: p.size, height: p.size, background: p.color, left: "50%", top: "50%", zIndex: 50 }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
            animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.3, rotate: p.r }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: p.delay }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── LineupMiniRow ─────────────────────────────────────────────
// Compact lineup snippet for the expanded view.
function LineupMiniRow({ lineup, color, delay = 0 }) {
  const names = lineup.lineup.split(" - ").map(n => n.split(" ").at(-1));
  return (
    <motion.div
      className="flex items-center gap-2 py-1 group/row"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...SPRING_SNAPPY, delay }}
    >
      <div className="flex-1 flex items-center gap-1 min-w-0">
        {names.map((n, i) => (
          <span key={i} className="text-[10px] text-pitch-300">
            {i === 0 ? <span className="text-pitch-100 font-medium">{n}</span> : n}
            {i < names.length - 1 && <span className="text-pitch-700 mx-0.5">·</span>}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-12 h-1 bg-pitch-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: lineup.netRtg >= 0 ? "#22c55e" : "#ef4444" }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.max(5, (Math.abs(lineup.netRtg) / 15) * 100))}%` }}
            transition={{ ...SPRING_SMOOTH, delay: delay + 0.1 }}
          />
        </div>
        <span className={`font-mono text-[10px] tabular-nums font-semibold w-8 text-right ${lineup.netRtg >= 0 ? "text-win" : "text-loss"}`}>
          {lineup.netRtg > 0 ? "+" : ""}{lineup.netRtg}
        </span>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MatchupCard — Main exported component
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
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const cardRef = useRef(null);

  const away = game?.away ?? "TBA";
  const home = game?.home ?? "TBA";
  const colorA = TEAM_COLORS[away] || "#546480";
  const colorB = TEAM_COLORS[home] || "#f59e0b";
  const awayOdds = odds?.awayOdds ?? -110;
  const homeOdds = odds?.homeOdds ?? -110;
  const spread = odds?.spread ?? null;
  const isLive = game?.status === "live" || game?.status === "in-progress";

  const sA = teamStats?.away;
  const sB = teamStats?.home;

  return (
    <motion.div
      ref={cardRef}
      layout
      className={`pm-card overflow-hidden transition-all cursor-pointer ${expanded ? "pm-accent-border" : ""}`}
      onClick={() => setExpanded(v => !v)}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ y: -2 }}
      transition={SPRING_SNAPPY}
      style={{ willChange: "transform" }}
    >
      {/* ── Layer 0: Collapsed header ──────────────────────── */}
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-4">

          {/* Away team */}
          <div className="flex-1 min-w-0">
            <motion.div
              className="font-display text-3xl sm:text-4xl tracking-widest"
              style={{ color: colorA }}
              animate={hovered ? { x: 3 } : { x: 0 }}
              transition={SPRING_SNAPPY}
            >
              {away}
            </motion.div>
            <div className="text-[10px] text-pitch-500 mt-0.5 truncate">
              {TEAM_NAMES[away] ?? away}
            </div>
            {isLive && game.awayScore != null && (
              <motion.div
                className="font-mono text-xl font-bold text-pitch-50 mt-1"
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ ...SPRING_BOUNCY, repeat: 0 }}
                key={game.awayScore}
              >
                {game.awayScore}
              </motion.div>
            )}
          </div>

          {/* Prob ring (center) */}
          <div className="flex-shrink-0">
            <ProbRing probA={probA} colorA={colorA} colorB={colorB} size={hovered || expanded ? 110 : 90} />
          </div>

          {/* Home team */}
          <div className="flex-1 min-w-0 text-right">
            <motion.div
              className="font-display text-3xl sm:text-4xl tracking-widest"
              style={{ color: colorB }}
              animate={hovered ? { x: -3 } : { x: 0 }}
              transition={SPRING_SNAPPY}
            >
              {home}
            </motion.div>
            <div className="text-[10px] text-pitch-500 mt-0.5 truncate">
              {TEAM_NAMES[home] ?? home}
            </div>
            {isLive && game.homeScore != null && (
              <motion.div
                className="font-mono text-xl font-bold text-pitch-50 mt-1"
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ ...SPRING_BOUNCY, repeat: 0 }}
                key={game.homeScore}
              >
                {game.homeScore}
              </motion.div>
            )}
          </div>
        </div>

        {/* Subline: time + odds peek */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            {isLive && <span className="pm-live-dot" />}
            <span className="text-[10px] text-pitch-500">
              {isLive ? "LIVE" : game?.time ?? "TBD"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {spread != null && (
              <span className="font-mono text-[11px] text-pitch-400 tabular-nums">
                {spread > 0 ? `+${spread}` : spread}
              </span>
            )}
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={SPRING_SNAPPY}
            >
              <ChevronDown size={14} className="text-pitch-500" />
            </motion.div>
          </div>
        </div>
      </div>

      {/* ── Layer 1: Hover preview (star clash) ────────────── */}
      <AnimatePresence>
        {hovered && !expanded && starA && starB && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-5 pb-3">
              <StarClash starA={starA} starB={starB} colorA={colorA} colorB={colorB} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Layer 2: Expanded detail ───────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={SPRING_GENTLE}
            className="overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="border-t border-pitch-700 px-4 sm:px-5 py-4 space-y-4">

              {/* Star player clash (always show when expanded) */}
              {starA && starB && (
                <div>
                  <div className="pm-label mb-2 flex items-center gap-1.5">
                    <Target size={10} />Star player clash
                  </div>
                  <StarClash starA={starA} starB={starB} colorA={colorA} colorB={colorB} />
                </div>
              )}

              {/* Stat duel */}
              {sA && sB && (
                <div>
                  <div className="pm-label mb-2.5 flex items-center gap-1.5">
                    <Zap size={10} />Stat duel
                  </div>
                  <StatDuelBar label="Net Rtg" aVal={sA.netRtg} bVal={sB.netRtg} colorA={colorA} colorB={colorB} format={v => (v > 0 ? `+${v}` : v)} />
                  <StatDuelBar label="eFG%" aVal={sA.efg} bVal={sB.efg} colorA={colorA} colorB={colorB} format={v => `${v}%`} />
                  <StatDuelBar label="TOV%" aVal={sA.tov} bVal={sB.tov} colorA={colorA} colorB={colorB} invert format={v => `${v}%`} />
                  <StatDuelBar label="Pace" aVal={sA.pace} bVal={sB.pace} colorA={colorA} colorB={colorB} />
                </div>
              )}

              {/* Top lineups preview */}
              {lineups?.away?.length > 0 && (
                <div>
                  <div className="pm-label mb-1.5">
                    <span style={{ color: colorA }}>{away}</span> best lineups
                  </div>
                  {lineups.away.slice(0, 3).map((l, i) => (
                    <LineupMiniRow key={i} lineup={l} color={colorA} delay={i * 0.06} />
                  ))}
                </div>
              )}
              {lineups?.home?.length > 0 && (
                <div>
                  <div className="pm-label mb-1.5">
                    <span style={{ color: colorB }}>{home}</span> best lineups
                  </div>
                  {lineups.home.slice(0, 3).map((l, i) => (
                    <LineupMiniRow key={i} lineup={l} color={colorB} delay={i * 0.06} />
                  ))}
                </div>
              )}

              {/* Quick bet strip */}
              <div>
                <div className="pm-label mb-2 flex items-center gap-1.5">
                  <Sparkles size={10} />Quick bet
                </div>
                <QuickBetStrip
                  away={away} home={home}
                  awayOdds={awayOdds} homeOdds={homeOdds}
                  spread={spread}
                  colorA={colorA} colorB={colorB}
                  onBet={onBet}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
