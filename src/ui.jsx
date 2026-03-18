// ─── PlusMinus UI Primitives ──────────────────────────────────
// Reusable loading skeletons and error states.
// Used by all data-fetching components.

import { motion } from "framer-motion";
import { AlertCircle, RefreshCw } from "lucide-react";

// ── Skeleton pulse ────────────────────────────────────────────
// Pass width + height as Tailwind classes via className.
export function Skeleton({ className = "" }) {
    return (
        <div
            className={`bg-pitch-700 rounded animate-pulse ${className}`}
        />
    );
}

// ── Tile skeleton — mimics pm-tile shape ──────────────────────
export function TileSkeleton({ lines = 3 }) {
    return (
        <div className="pm-tile p-3 space-y-2.5">
            <Skeleton className="h-3 w-1/3" />
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton key={i} className={`h-3 ${i === 0 ? "w-full" : "w-2/3"}`} />
            ))}
        </div>
    );
}

// ── Row skeleton — mimics a table or list row ─────────────────
export function RowSkeleton({ rows = 5 }) {
    return (
        <div className="space-y-1">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-2 py-2">
                    <Skeleton className="h-3 w-6" />
                    <Skeleton className="h-3 flex-1" />
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-10" />
                </div>
            ))}
        </div>
    );
}

// ── Inline loading state ──────────────────────────────────────
// Small spinner for buttons and inline refresh indicators.
export function Spinner({ size = 14 }) {
    return (
        <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            style={{ width: size, height: size }}
        >
            <RefreshCw size={size} className="text-pitch-400" strokeWidth={1.8} />
        </motion.div>
    );
}

// ── Error state ───────────────────────────────────────────────
export function ErrorState({ message, onRetry }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
            <AlertCircle size={22} className="text-loss/60" strokeWidth={1.5} />
            <div className="text-sm text-pitch-400 text-center max-w-xs leading-relaxed">
                {message || "Failed to load data"}
            </div>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="flex items-center gap-1.5 text-[11px] text-pitch-400
                     hover:text-accent transition-colors mt-1"
                >
                    <RefreshCw size={11} strokeWidth={1.8} />
                    Try again
                </button>
            )}
        </div>
    );
}

// ── API key missing state ─────────────────────────────────────
export function NoApiKey() {
    return (
        <div className="pm-card p-5 text-center">
            <div className="text-[10px] tracking-[1.4px] uppercase text-pitch-500 mb-2">
                API key required
            </div>
            <div className="text-sm text-pitch-300 mb-3 leading-relaxed">
                Add your BallDontLie API key to connect live data.
            </div>
            <div className="bg-pitch-700 rounded-md px-3 py-2 text-[11px] font-mono text-pitch-300 text-left">
                # .env<br />
                VITE_BDLAPI_KEY=your_key_here
            </div>
            <div className="text-[10px] text-pitch-500 mt-3">
                Get a free key at{" "}
                <a
                    href="https://www.balldontlie.io"
                    className="text-accent hover:underline"
                    target="_blank"
                    rel="noreferrer"
                >
                    balldontlie.io
                </a>
            </div>
        </div>
    );
}

// ── Data freshness indicator ──────────────────────────────────
// Shows when data was last updated. Pass isFetching from useQuery.
export function FreshnessTag({ isFetching, dataUpdatedAt }) {
    if (isFetching) {
        return (
            <span className="flex items-center gap-1 text-[9px] text-pitch-500">
                <Spinner size={9} />
                Updating
            </span>
        );
    }
    if (!dataUpdatedAt) return null;
    const mins = Math.floor((Date.now() - dataUpdatedAt) / 60000);
    if (mins < 1) return null;
    return (
        <span className="text-[9px] text-pitch-600">
            {mins}m ago
        </span>
    );
}