// ─── PlusMinus UI Primitives ──────────────────────────────────────
// Reusable loading states, error surfaces, feedback elements.
// ⚠️  File must live at src/components/ui.jsx — all component
// siblings import from "./ui" (relative to their own directory).

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CircleAlert, RotateCw, Wifi, Key, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ReferenceLine } from "recharts";
import { oddsToImplied } from "../utils";

// ── Team Link ───────────────────────────────────────────────────
// FIX: was a <span> — not keyboard-navigable and invisible to screen readers.
// Now a <button> so it receives focus, fires on Enter/Space, and is
// announced as interactive by assistive technology.
export function TeamLink({ abbr, children, className, style }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); navigate(`/team/${abbr}`); }}
      className={`cursor-pointer hover:text-accent transition-colors bg-transparent border-0 p-0 text-left ${className ?? ""}`}
      style={style}
      aria-label={`View ${abbr} team page`}
    >
      {children}
    </button>
  );
}

// ── Skeleton pulse ────────────────────────────────────────────────
export function Skeleton({ className = "", style }) {
  return (
    <div
      className={`pm-skeleton rounded ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

// ── Tile skeleton — mimics pm-tile shape ──────────────────────────
export function TileSkeleton({ lines = 3, showHeader = true }) {
  return (
    <div className="pm-tile p-3 space-y-2.5" aria-busy="true" aria-label="Loading">
      {showHeader && (
        <div className="flex items-center justify-between">
          <Skeleton className="h-2.5 w-1/4" />
          <Skeleton className="h-4 w-10 rounded-full" />
        </div>
      )}
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-2.5"
          style={{ width: i === 0 ? "100%" : `${60 + (i % 3) * 15}%` }}
        />
      ))}
      {/* Probability bar */}
      <Skeleton className="h-1.5 w-full rounded-full" />
    </div>
  );
}

// ── Row skeleton — mimics a table row ────────────────────────────
export function RowSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-px" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-2 py-2.5 rounded-sm"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <Skeleton className="h-2.5 w-5 flex-shrink-0" />
          <Skeleton className="h-2.5 w-14 flex-shrink-0" />
          <Skeleton className="h-2.5 flex-1" />
          <Skeleton className="h-2.5 w-10" />
          <Skeleton className="h-2.5 w-8" />
          <Skeleton className="h-5 w-10 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ── Card skeleton — full card loading state ───────────────────────
export function CardSkeleton({ height = 200 }) {
  return (
    <div className="pm-card p-4 space-y-3" aria-busy="true">
      <div className="flex items-center justify-between">
        <Skeleton className="h-2.5 w-32" />
        <Skeleton className="h-2.5 w-16" />
      </div>
      <Skeleton className={`w-full rounded-lg`} style={{ height }} />
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────
export function Spinner({ size = 14, className = "" }) {
  return (
    <RotateCw
      size={size}
      className={`text-pitch-400 animate-spin ${className}`}
      strokeWidth={1.8}
      aria-label="Loading"
    />
  );
}

// ── Error state ───────────────────────────────────────────────────
export function ErrorState({ message, onRetry, type = "generic" }) {
  const icons = {
    network: Wifi,
    auth: Key,
    generic: CircleAlert,
  };
  const Icon = icons[type] || CircleAlert;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-14 gap-3"
      role="alert"
    >
      <div className="w-10 h-10 rounded-full bg-loss/10 border border-loss/20 flex items-center justify-center">
        <Icon size={18} className="text-loss/70" strokeWidth={1.5} />
      </div>
      <div className="text-sm text-pitch-400 text-center max-w-[260px] leading-relaxed">
        {message || "Failed to load data"}
      </div>
      {onRetry && (
        <motion.button
          onClick={onRetry}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-1.5 text-[11px] text-pitch-400
                     hover:text-accent transition-colors mt-1 px-3 py-1.5
                     rounded-md border border-pitch-600 hover:border-accent/30"
        >
          <RotateCw size={11} strokeWidth={1.8} />
          Try again
        </motion.button>
      )}
    </motion.div>
  );
}

// ── Data freshness indicator ──────────────────────────────────────
// FIX: The previous version registered the interval inside a useEffect
// with [dataUpdatedAt] as deps. If dataUpdatedAt was initially undefined
// and became truthy later, the interval was never registered (the effect
// ran on mount with no dataUpdatedAt and returned early before setting
// up the interval). We now always set up the interval when dataUpdatedAt
// is present, and correctly clear the previous one before registering
// the new one by using the ref pattern.
export function FreshnessTag({ isFetching, dataUpdatedAt }) {
  const [, forceUpdate] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    // Always clear any previous interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!dataUpdatedAt) return;

    // Immediately update the display, then tick every 30s
    forceUpdate(v => v + 1);
    intervalRef.current = setInterval(() => forceUpdate(v => v + 1), 30_000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [dataUpdatedAt]);

  if (isFetching) {
    return (
      <span className="flex items-center gap-1.5 text-[10px] text-pitch-400 select-none">
        <Spinner size={10} />
        <span>Updating…</span>
      </span>
    );
  }

  if (!dataUpdatedAt) return null;

  const mins = Math.floor((Date.now() - dataUpdatedAt) / 60_000);

  if (mins < 1) {
    return (
      <span className="flex items-center gap-1 text-[10px] text-accent/70 select-none">
        <span className="w-1 h-1 rounded-full bg-accent/60 animate-pulse" />
        Just now
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-[10px] text-pitch-600 select-none">
      <Clock size={9} strokeWidth={1.5} className="text-pitch-600" />
      {mins < 60
        ? `${mins}m ago`
        : `${Math.floor(mins / 60)}h ago`}
    </span>
  );
}

// ── Toast / notification system ───────────────────────────────────
// FIX: The previous implementation used a module-level Set for listeners.
// During Vite HMR, unmounted components left stale listeners in the Set,
// causing double-fires or missed toasts after hot reloads.
// We now use a WeakRef-based registry so garbage-collected handlers are
// automatically skipped, and stale entries are pruned on each dispatch.

const TOAST_DURATION = 3000;
const _toastListeners = new Set();

function _dispatchToast(payload) {
  // Prune any dead WeakRefs before dispatching
  for (const ref of _toastListeners) {
    const fn = ref.deref();
    if (!fn) {
      _toastListeners.delete(ref);
    } else {
      fn(payload);
    }
  }
}

export function useToast() {
  const addToast = useCallback((message, type = "info") => {
    const id = Date.now();
    _dispatchToast({ id, message, type });
    setTimeout(() => {
      _dispatchToast({ id, remove: true });
    }, TOAST_DURATION);
  }, []);

  return {
    success: (msg) => addToast(msg, "success"),
    error: (msg) => addToast(msg, "error"),
    info: (msg) => addToast(msg, "info"),
    warn: (msg) => addToast(msg, "warn"),
  };
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = ({ id, message, type, remove }) => {
      if (remove) {
        setToasts(prev => prev.filter(t => t.id !== id));
      } else {
        setToasts(prev => {
          if (prev.some(t => t.id === id)) return prev;
          return [...prev.slice(-4), { id, message, type }];
        });
      }
    };

    // Store as WeakRef so GC can collect the handler after unmount
    const ref = new WeakRef(handler);
    _toastListeners.add(ref);

    return () => { _toastListeners.delete(ref); };
  }, []);

  const colorMap = {
    success: "border-win/30 bg-win/10 text-win",
    error: "border-loss/30 bg-loss/10 text-loss",
    warn: "border-draw/30 bg-draw/10 text-draw",
    info: "border-accent/30 bg-accent/10 text-accent",
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`px-4 py-2.5 rounded-lg border text-[12px] font-medium
                        shadow-card-lg pointer-events-auto max-w-[280px]
                        ${colorMap[t.type] || colorMap.info}`}
          >
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────
export function EmptyState({ title, description, icon: Icon }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-16 gap-3"
    >
      {Icon && (
        <div className="w-12 h-12 rounded-xl bg-pitch-750 border border-pitch-600 flex items-center justify-center">
          <Icon size={20} className="text-pitch-500" strokeWidth={1.5} />
        </div>
      )}
      <div className="text-sm font-medium text-pitch-300">{title}</div>
      {description && (
        <div className="text-[11px] text-pitch-500 text-center max-w-[220px] leading-relaxed">
          {description}
        </div>
      )}
    </motion.div>
  );
}

// ── Stat badge — colored value display ───────────────────────────
export function StatBadge({ value, format = "default" }) {
  if (format === "pl") {
    const n = parseFloat(value);
    const cls = n > 0 ? "text-win" : n < 0 ? "text-loss" : "text-pitch-400";
    return (
      <span className={`pm-number font-medium ${cls}`}>
        {n >= 0 ? "+" : ""}${Math.abs(n).toFixed(2)}
      </span>
    );
  }
  return <span className="pm-number text-pitch-200">{value}</span>;
}

// ── Tooltip wrapper ───────────────────────────────────────────────
// FIX: previously only responded to mouse (onMouseEnter/Leave).
// Now also handles keyboard focus (onFocus/onBlur) so the tooltip
// is reachable for keyboard-only and screen reader users.
export function Tooltip({ content, children, placement = "top" }) {
  const [visible, setVisible] = useState(false);

  const placementStyles = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            role="tooltip"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className={`pm-tooltip absolute z-50 ${placementStyles[placement]}`}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Calibration Curve ─────────────────────────────────────────────
export function CalibrationCurve({ bets }) {
  const buckets = [
    { label: "0-2%", min: 0, max: 2, wins: 0, total: 0, expSum: 0 },
    { label: "2-5%", min: 2, max: 5, wins: 0, total: 0, expSum: 0 },
    { label: "5-10%", min: 5, max: 10, wins: 0, total: 0, expSum: 0 },
    { label: "10%+", min: 10, max: 100, wins: 0, total: 0, expSum: 0 },
  ];

  (bets || []).forEach(b => {
    if (b.result === "pending") return;

    // Use b.edge if available, otherwise assume 0
    const edge = b.edge || 0;
    const bucket = buckets.find(bk => edge >= bk.min && edge < bk.max) || buckets[0];

    const implied = (oddsToImplied(b.odds || -110)) * 100;
    const expected = implied + edge;

    bucket.total += 1;
    bucket.expSum += expected;
    if (b.result === "win") bucket.wins += 1;
    // push counts as half win for calibration purposes, or omit. We'll omit pushes for purity.
  });

  const data = buckets.map(bk => {
    if (bk.total === 0) return { bucket: bk.label, exp: 0, act: 0, total: 0 };
    return {
      bucket: bk.label,
      total: bk.total,
      exp: +(bk.expSum / bk.total).toFixed(1),
      act: +((bk.wins / bk.total) * 100).toFixed(1),
    };
  }).filter(bk => bk.total > 0);

  if (data.length === 0) {
    return <div className="text-[10px] text-pitch-500 p-4 pm-card text-center">Not enough data for calibration curve.</div>;
  }

  return (
    <div className="pm-card p-4">
      <div className="pm-label mb-1">Model Calibration</div>
      <div className="text-[10px] text-pitch-600 mb-4">Expected Win % vs Actual Win %, bucketed by edge</div>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2a38" />
            <XAxis dataKey="bucket" tick={{ fill: "#546480", fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: "#546480", fontSize: 10 }} tickFormatter={v => `${v}%`} tickLine={false} axisLine={false} />
            <RechartsTooltip
              contentStyle={{ background: "rgba(18,22,33,0.95)", border: "1px solid #2e3a50", borderRadius: 8, fontSize: 11 }}
              itemStyle={{ color: "#c8d5e8" }}
              formatter={(v, name) => [`${v}%`, name === "exp" ? "Expected" : "Actual"]}
              labelStyle={{ color: "#7d91ab" }}
            />
            <Line type="monotone" dataKey="exp" stroke="#546480" strokeWidth={2} dot={{ fill: "#546480" }} name="exp" />
            <Line type="monotone" dataKey="act" stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981" }} name="act" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-4 mt-3 text-[10px]">
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-pitch-500"></div><span className="text-pitch-400">Expected</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-win"></div><span className="text-pitch-400">Actual</span></div>
      </div>
    </div>
  );
}

// ── Morphin / Framer Motion Overlays ─────────────────────────────
export { AnimatedNumber } from "./ui/animated-number";
export { MagneticButton } from "./ui/magnetic-button";
export {
  MorphingDialog,
  MorphingDialogTrigger,
  MorphingDialogContent,
  MorphingDialogClose,
  MorphingDialogContainer,
} from "./ui/morphing-dialog";