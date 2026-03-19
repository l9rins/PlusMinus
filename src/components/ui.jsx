// ─── PlusMinus UI Primitives ──────────────────────────────────────
// Reusable loading states, error surfaces, feedback elements.
// ⚠️  File must live at src/components/ui.jsx — all component
// siblings import from "./ui" (relative to their own directory).

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, RefreshCw, Wifi, Key, Clock } from "lucide-react";

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
        <RefreshCw
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
        generic: AlertCircle,
    };
    const Icon = icons[type] || AlertCircle;

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
                    <RefreshCw size={11} strokeWidth={1.8} />
                    Try again
                </motion.button>
            )}
        </motion.div>
    );
}

// ── API key missing state ─────────────────────────────────────────
export function NoApiKey({ service = "BallDontLie", envVar = "VITE_BDLAPI_KEY", url = "https://www.balldontlie.io" }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="pm-card p-6 text-center"
        >
            <div className="w-10 h-10 rounded-full bg-draw/10 border border-draw/20 flex items-center justify-center mx-auto mb-3">
                <Key size={16} className="text-draw/70" strokeWidth={1.5} />
            </div>
            <div className="text-[10px] tracking-[1.6px] uppercase text-pitch-500 mb-1.5">
                API key required
            </div>
            <div className="text-sm text-pitch-300 mb-4 leading-relaxed">
                Connect your {service} API key to load live data.
            </div>
            <div className="pm-inset px-3 py-2.5 text-[11px] font-mono text-pitch-300 text-left space-y-0.5">
                <div className="text-pitch-500"># .env (project root)</div>
                <div>
                    <span className="text-accent">{envVar}</span>
                    <span className="text-pitch-400">=your_key_here</span>
                </div>
            </div>
            <div className="text-[10px] text-pitch-500 mt-3">
                Get a free key at{" "}
                <a
                    href={url}
                    className="text-accent hover:text-accent-hover underline underline-offset-2"
                    target="_blank"
                    rel="noreferrer"
                >
                    {url.replace("https://", "")}
                </a>
            </div>
        </motion.div>
    );
}

// ── Data freshness indicator ──────────────────────────────────────
export function FreshnessTag({ isFetching, dataUpdatedAt }) {
    const [, forceUpdate] = useState(0);

    // Tick every 30s so "Xm ago" stays accurate
    useEffect(() => {
        if (!dataUpdatedAt) return;
        const id = setInterval(() => forceUpdate(v => v + 1), 30_000);
        return () => clearInterval(id);
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
// Usage:
//   import { useToast } from "./ui";
//   const toast = useToast();
//   toast.success("Bet saved!");
//   toast.error("Something went wrong");

const TOAST_DURATION = 3000;

let _toastListeners = [];

export function useToast() {
    const addToast = useCallback((message, type = "info") => {
        const id = Date.now();
        _toastListeners.forEach(fn => fn({ id, message, type }));
        setTimeout(() => {
            _toastListeners.forEach(fn => fn({ id, remove: true }));
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
                setToasts(prev => [...prev.slice(-4), { id, message, type }]);
            }
        };
        _toastListeners.push(handler);
        return () => { _toastListeners = _toastListeners.filter(fn => fn !== handler); };
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
        >
            {children}
            <AnimatePresence>
                {visible && (
                    <motion.div
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