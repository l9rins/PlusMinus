// src/components/TopNav.jsx
// PlusMinus · Neon Dark Edition
// Same functionality as the Morphin white nav.
// Visual change: dark bg, monospace labels, green accent,
// Neon-style tight 56px height instead of 80px.

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, BarChart3, Target,
  TrendingUp, Activity, ChevronDown, Search,
  Settings, X, Menu, ChevronRight, GitCompare,
  BarChart2, Coins, Bell,
} from "lucide-react";
import { UserButton } from "@clerk/clerk-react";
import { useTodayGames } from "../api";
import { cn } from "../lib/utils";
import { MagneticButton } from "./ui/magnetic-button";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Scores", icon: Target, path: "/scores" },
  { label: "Standings", icon: BarChart3, path: "/standings" },
  { label: "Players", icon: Users, path: "/players" },
  {
    label: "Betting", icon: TrendingUp, path: "/betting",
    sub: [
      { label: "Edge Finder", path: "/betting", desc: "Model vs market · multi-book" },
      { label: "Bet Tracker", path: "/tracker", desc: "Log, track, and analyze" },
    ],
  },
  {
    label: "Analytics", icon: Activity, path: "/analytics",
    sub: [
      { label: "Power Index", path: "/analytics", desc: "Composite rankings" },
      { label: "Four Factors", path: "/analytics", desc: "Dean Oliver model" },
      { label: "Elo Ratings", path: "/analytics", desc: "Power + trajectory" },
      { label: "Playoff Sim", path: "/analytics?tab=playoff", desc: "Monte Carlo bracket" },
    ],
  },
  { label: "Compare", icon: GitCompare, path: "/compare" },
  { label: "Leaderboard", icon: Coins, path: "/paper" },
];

// ── Dropdown ──────────────────────────────────────────────────────
function SubMenu({ item, onNavigate, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.14 }}
      className="absolute top-full left-0 mt-2 min-w-[260px] z-50 rounded-xl overflow-hidden"
      style={{
        background: "var(--neon-raised)",
        border: "1px solid var(--neon-border-md)",
        boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
      }}
    >
      {item.sub.map((sub) => (
        <button
          key={sub.label}
          onClick={() => { onNavigate(sub.path); onClose(); }}
          className="w-full text-left px-4 py-3 flex items-start gap-3 transition-colors group"
          style={{ borderBottom: "1px solid var(--neon-border)" }}
          onMouseEnter={e => e.currentTarget.style.background = "var(--neon-overlay)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          <div className="w-1 h-1 rounded-full mt-2 flex-shrink-0 transition-colors"
            style={{ background: "var(--neon-dim)" }}
          />
          <div>
            <div className="text-sm font-semibold" style={{ color: "var(--neon-text)" }}>
              {sub.label}
            </div>
            {sub.desc && (
              <div className="text-[11px] mt-0.5 font-mono" style={{ color: "var(--neon-muted)" }}>
                {sub.desc}
              </div>
            )}
          </div>
        </button>
      ))}
    </motion.div>
  );
}

// ── Mobile drawer ─────────────────────────────────────────────────
function MobileDrawer({ open, onClose, activePath, onNavigate }) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100]"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 220 }}
            className="fixed top-0 left-0 bottom-0 w-72 z-[101] flex flex-col"
            style={{
              background: "var(--neon-surface)",
              borderRight: "1px solid var(--neon-border-md)",
            }}
          >
            <div className="flex items-center justify-between px-5 h-14"
              style={{ borderBottom: "1px solid var(--neon-border)" }}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold animate-neon-flicker"
                  style={{ color: "var(--neon-green)" }}>±</span>
                <span className="text-sm font-bold tracking-tight"
                  style={{ color: "var(--neon-text)" }}>PlusMinus</span>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg transition-colors"
                style={{ color: "var(--neon-muted)" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--neon-raised)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <X size={16} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activePath === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => { onNavigate(item.path); onClose(); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all",
                    )}
                    style={{
                      color: isActive ? "var(--neon-green)" : "var(--neon-muted)",
                      background: isActive ? "var(--neon-green-faint)" : "transparent",
                      borderLeft: isActive ? "2px solid var(--neon-green)" : "2px solid transparent",
                    }}
                  >
                    <Icon size={16} strokeWidth={2} />
                    <span className="text-xs font-semibold tracking-wide uppercase">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Main nav ──────────────────────────────────────────────────────
export default function TopNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [hoveredItem, setHoveredItem] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const searchInputRef = useRef(null);

  const { data: games } = useTodayGames();
  const liveGames = useMemo(
    () => (games || []).filter(g => g.status === "live"),
    [games]
  );

  useEffect(() => {
    const handler = (e) => {
      const tag = e.target.tagName.toLowerCase();
      if (["input", "textarea", "select"].includes(tag)) return;
      if (e.key === "/" && !searchOpen) { e.preventDefault(); setSearchOpen(true); }
      if (e.key === "Escape") { setSearchOpen(false); setNotifOpen(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchOpen]);

  return (
    <>
      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        activePath={location.pathname}
        onNavigate={path => navigate(path)}
      />

      {/* ── Nav bar ─────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 h-14 flex items-center px-6"
        style={{
          background: "rgba(10,10,15,0.92)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--neon-border)",
        }}
      >
        <div className="max-w-[1600px] w-full mx-auto flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-8">
            <MagneticButton
              onClick={() => navigate("/")}
              className="flex items-center gap-2.5 p-0 bg-transparent hover:bg-transparent"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xl font-bold animate-neon-flicker"
                style={{
                  background: "var(--neon-green-faint)",
                  border: "1px solid var(--neon-green-border)",
                  color: "var(--neon-green)",
                  boxShadow: "0 0 12px var(--neon-green-glow)",
                }}
              >±</div>
              <span className="text-sm font-bold tracking-tight hidden md:block"
                style={{ color: "var(--neon-text)" }}>
                PlusMinus
              </span>
            </MagneticButton>

            {/* Desktop nav links */}
            <div className="hidden lg:flex items-center gap-0.5">
              {NAV_ITEMS.map((item) => {
                const isActive = location.pathname === item.path ||
                  (item.path !== "/" && location.pathname.startsWith(item.path));
                const isHovered = hoveredItem === item.path;

                return (
                  <div
                    key={item.path}
                    className="relative"
                    onMouseEnter={() => setHoveredItem(item.path)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <button
                      onClick={() => !item.sub && navigate(item.path)}
                      className={cn(
                        "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold",
                        "tracking-wide uppercase transition-all"
                      )}
                      style={{
                        color: isActive ? "var(--neon-green)" : "var(--neon-muted)",
                        background: isActive ? "var(--neon-green-faint)" : "transparent",
                      }}
                      onMouseEnter={e => {
                        if (!isActive) {
                          e.currentTarget.style.color = "var(--neon-text)";
                          e.currentTarget.style.background = "var(--neon-raised)";
                        }
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.color = isActive ? "var(--neon-green)" : "var(--neon-muted)";
                        e.currentTarget.style.background = isActive ? "var(--neon-green-faint)" : "transparent";
                      }}
                    >
                      {item.label}
                      {item.sub && (
                        <ChevronDown size={11}
                          className={cn("transition-transform", isHovered && "rotate-180")}
                        />
                      )}
                    </button>
                    <AnimatePresence>
                      {isHovered && item.sub && (
                        <SubMenu
                          item={item}
                          onNavigate={navigate}
                          onClose={() => setHoveredItem(null)}
                        />
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1">
            {/* Live indicator */}
            {liveGames.length > 0 && (
              <button
                onClick={() => navigate("/scores")}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold mr-2"
                style={{
                  color: "#f87171",
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.20)",
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                {liveGames.length} Live
              </button>
            )}

            {/* Search */}
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 rounded-lg transition-colors flex items-center gap-2"
              style={{ color: "var(--neon-muted)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--neon-raised)"; e.currentTarget.style.color = "var(--neon-text)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--neon-muted)"; }}
            >
              <Search size={16} strokeWidth={2} />
              <kbd className="hidden md:block text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{ background: "var(--neon-raised)", border: "1px solid var(--neon-border-md)", color: "var(--neon-dim)" }}>
                /
              </kbd>
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="p-2 rounded-lg transition-colors relative"
                style={{ color: "var(--neon-muted)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--neon-raised)"; e.currentTarget.style.color = "var(--neon-text)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--neon-muted)"; }}
              >
                <Bell size={16} strokeWidth={2} />
              </button>
            </div>

            <button
              onClick={() => navigate("/settings")}
              className="p-2 rounded-lg transition-colors"
              style={{ color: "var(--neon-muted)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--neon-raised)"; e.currentTarget.style.color = "var(--neon-text)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--neon-muted)"; }}
            >
              <Settings size={16} strokeWidth={2} />
            </button>

            <div className="h-5 w-px mx-1 hidden md:block"
              style={{ background: "var(--neon-border-md)" }} />

            <div className="w-7 h-7 rounded-lg overflow-hidden transition-all cursor-pointer hover:scale-105 active:scale-95"
              style={{ border: "1px solid var(--neon-border-md)" }}>
              <UserButton />
            </div>

            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg"
              style={{ color: "var(--neon-muted)" }}
            >
              <Menu size={18} strokeWidth={2} />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Search overlay ───────────────────────────────────────── */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4"
            style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(16px)" }}
          >
            <motion.div
              initial={{ scale: 0.96, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 20 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-2xl rounded-xl overflow-hidden"
              style={{
                background: "var(--neon-raised)",
                border: "1px solid var(--neon-border-md)",
                boxShadow: "0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(0,229,153,0.08)",
              }}
            >
              <div className="flex items-center gap-3 px-5 py-4"
                style={{ borderBottom: "1px solid var(--neon-border)" }}
              >
                <Search size={18} style={{ color: "var(--neon-muted)" }} />
                <input
                  ref={searchInputRef}
                  autoFocus
                  placeholder="Search teams, players, matchups..."
                  className="flex-1 bg-transparent text-base font-medium focus:outline-none"
                  style={{ color: "var(--neon-text)", fontFamily: "inherit" }}
                />
                <button onClick={() => setSearchOpen(false)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: "var(--neon-muted)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--neon-overlay)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-4">
                <div className="text-[10px] font-mono font-semibold uppercase tracking-widest mb-3"
                  style={{ color: "var(--neon-dim)" }}>
                  Quick jump
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {NAV_ITEMS.slice(0, 8).map(item => (
                    <button
                      key={item.path}
                      onClick={() => { navigate(item.path); setSearchOpen(false); }}
                      className="flex flex-col items-center gap-2 p-4 rounded-lg transition-colors"
                      style={{ border: "1px solid var(--neon-border)" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--neon-overlay)"; e.currentTarget.style.borderColor = "var(--neon-green-border)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--neon-border)"; }}
                    >
                      <item.icon size={18} style={{ color: "var(--neon-green)" }} strokeWidth={1.5} />
                      <span className="text-[10px] font-mono font-semibold uppercase tracking-wide"
                        style={{ color: "var(--neon-muted)" }}>
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}