import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, BarChart3, Target,
  TrendingUp, Activity, ChevronDown, Search, Bell,
  Settings, X, Menu, Zap, ChevronRight,
} from "lucide-react";

// ── Nav definition ────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    id: "dashboard",
    sub: null,
  },
  {
    label: "Scores",
    icon: Target,
    id: "scores",
    sub: [
      { label: "Tonight's Games", id: "scores", desc: "Live + scheduled matchups" },
      { label: "Win Probabilities", id: "scores", desc: "Model vs market" },
    ],
  },
  {
    label: "Standings",
    icon: BarChart3,
    id: "standings",
    sub: [
      { label: "Eastern Conference", id: "standings", desc: "Atlantic · Central · Southeast" },
      { label: "Western Conference", id: "standings", desc: "Northwest · Pacific · Southwest" },
    ],
  },
  {
    label: "Players",
    icon: Users,
    id: "players",
    sub: [
      { label: "Browse Roster", id: "players", desc: "Top 30 by stat category" },
      { label: "Compare Players", id: "players", desc: "Side-by-side advanced metrics" },
    ],
  },
  {
    label: "Betting",
    icon: TrendingUp,
    id: "betting",
    sub: [
      { label: "Edge Finder", id: "betting", desc: "Model vs market opportunities" },
      { label: "Bet Tracker", id: "tracker", desc: "Log, track, and analyze bets" },
    ],
  },
  {
    label: "Analytics",
    icon: Activity,
    id: "analytics",
    sub: [
      { label: "Four Factors", id: "analytics", desc: "Dean Oliver efficiency model" },
      { label: "Elo Ratings", id: "analytics", desc: "Power rankings & trajectory" },
      { label: "Shot Quality", id: "analytics", desc: "Radar profiles & comparison" },
    ],
  },
];

// ── Keyboard shortcut map ─────────────────────────────────────────
const SHORTCUTS = {
  "d": "dashboard",
  "s": "scores",
  "l": "standings",
  "p": "players",
  "b": "betting",
  "t": "tracker",
  "a": "analytics",
};

// ── Sub-dropdown ──────────────────────────────────────────────────
function SubMenu({ item, onNavigate, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.14, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="absolute top-full left-0 mt-1.5 min-w-[220px] z-50
                 bg-pitch-800 border border-pitch-600 rounded-xl py-1.5
                 shadow-card-lg overflow-hidden"
    >
      {/* Triangle pointer */}
      <div className="absolute -top-1.5 left-4 w-3 h-3 bg-pitch-800 border-l border-t border-pitch-600 rotate-45" />

      {item.sub.map((sub) => (
        <button
          key={sub.label}
          onClick={() => { onNavigate(sub.id); onClose(); }}
          className="w-full text-left px-3 py-2.5 flex items-start gap-3
                     hover:bg-pitch-750 transition-colors group"
        >
          <div className="w-1 h-1 rounded-full bg-pitch-500 group-hover:bg-accent mt-1.5 flex-shrink-0 transition-colors" />
          <div>
            <div className="text-xs font-medium text-pitch-200 group-hover:text-pitch-50 transition-colors">
              {sub.label}
            </div>
            {sub.desc && (
              <div className="text-[10px] text-pitch-500 mt-0.5">{sub.desc}</div>
            )}
          </div>
        </button>
      ))}
    </motion.div>
  );
}

// ── Mobile drawer ─────────────────────────────────────────────────
function MobileDrawer({ open, onClose, activeTab, onNavigate }) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-pitch-900/80 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed top-0 left-0 bottom-0 w-72 z-50
                       bg-pitch-850 border-r border-pitch-600
                       flex flex-col shadow-card-lg"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-14 border-b border-pitch-700">
              <div className="flex items-center gap-2">
                <span className="font-display text-2xl tracking-widest text-accent">±</span>
                <div>
                  <div className="font-display text-lg tracking-[3px] text-pitch-50">PLUSMINUS</div>
                  <div className="text-[8px] tracking-[2px] text-pitch-500 uppercase">NBA Analytics</div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-md text-pitch-400 hover:text-pitch-200 hover:bg-pitch-700 transition-colors"
              >
                <X size={16} strokeWidth={1.8} />
              </button>
            </div>

            {/* Nav links */}
            <nav className="flex-1 overflow-y-auto py-3 px-2">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id || (item.id === "betting" && activeTab === "tracker");

                return (
                  <div key={item.id} className="mb-1">
                    <button
                      onClick={() => { onNavigate(item.id); onClose(); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                        ${isActive
                          ? "bg-accent/10 text-accent border border-accent/20"
                          : "text-pitch-300 hover:text-pitch-100 hover:bg-pitch-700"
                        }`}
                    >
                      <Icon size={16} strokeWidth={1.8} />
                      {item.label}
                    </button>

                    {/* Sub-items */}
                    {item.sub && (
                      <div className="mt-0.5 ml-4 border-l border-pitch-700 pl-3 space-y-0.5">
                        {item.sub.map((sub) => (
                          <button
                            key={sub.label}
                            onClick={() => { onNavigate(sub.id); onClose(); }}
                            className={`w-full text-left px-2 py-1.5 rounded-md text-[11px] transition-colors
                              ${activeTab === sub.id ? "text-accent" : "text-pitch-400 hover:text-pitch-200"}`}
                          >
                            {sub.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            {/* Bottom: keyboard shortcuts */}
            <div className="px-4 py-3 border-t border-pitch-700">
              <div className="pm-label mb-2">Keyboard shortcuts</div>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(SHORTCUTS).slice(0, 6).map(([key, tab]) => (
                  <div key={key} className="flex items-center gap-2 text-[10px] text-pitch-500">
                    <kbd className="bg-pitch-700 border border-pitch-600 rounded px-1.5 py-0.5 font-mono text-pitch-300">
                      {key.toUpperCase()}
                    </kbd>
                    <span className="capitalize">{tab}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Main TopNav ───────────────────────────────────────────────────
export default function TopNav({ activeTab, onTabChange }) {
  const [hoveredItem, setHoveredItem] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const timeoutRef = useRef(null);
  const searchInputRef = useRef(null);

  // Clean up hover timeout on unmount
  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      // Don't fire during input focus
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;

      // "/" to open search
      if (e.key === "/" && !searchOpen) {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
        return;
      }

      // Escape to close search
      if (e.key === "Escape") {
        setSearchOpen(false);
        setSearchQuery("");
        setNotifOpen(false);
        return;
      }

      // Letter shortcuts
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const tab = SHORTCUTS[e.key.toLowerCase()];
        if (tab) {
          e.preventDefault();
          onTabChange(tab);
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchOpen, onTabChange]);

  const handleMouseEnter = useCallback((id) => {
    clearTimeout(timeoutRef.current);
    setHoveredItem(id);
  }, []);

  const handleMouseLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => setHoveredItem(null), 130);
  }, []);

  const closeSubMenu = useCallback(() => setHoveredItem(null), []);

  const handleSearchKey = (e) => {
    if (e.key === "Escape") {
      setSearchOpen(false);
      setSearchQuery("");
    }
    if (e.key === "Enter" && searchQuery.trim()) {
      onTabChange("players", searchQuery.trim());
      setSearchOpen(false);
      setSearchQuery("");
    }
  };

  const toggleSearch = () => {
    const next = !searchOpen;
    setSearchOpen(next);
    if (next) {
      setTimeout(() => searchInputRef.current?.focus(), 60);
    } else {
      setSearchQuery("");
    }
  };

  return (
    <>
      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        activeTab={activeTab}
        onNavigate={onTabChange}
      />

      <nav
        className="sticky top-0 z-50 border-b border-pitch-600 glass-strong"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="max-w-[1400px] mx-auto px-4">
          <div className="flex items-center h-12 gap-1">

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(true)}
              className="pm-nav-btn lg:hidden mr-1 flex-shrink-0"
              aria-label="Open menu"
            >
              <Menu size={16} strokeWidth={1.8} />
            </button>

            {/* Logo */}
            <button
              onClick={() => onTabChange("dashboard")}
              className="flex items-center gap-2 mr-3 flex-shrink-0 group"
              aria-label="PlusMinus — go to dashboard"
            >
              <span className="font-display text-2xl tracking-widest text-accent leading-none group-hover:text-accent-hover transition-colors">
                ±
              </span>
              <div className="hidden sm:block">
                <div className="font-display text-lg tracking-[3px] text-pitch-50 leading-none group-hover:text-white transition-colors">
                  PLUSMINUS
                </div>
                <div className="text-[8px] tracking-[2px] text-pitch-500 uppercase">NBA Analytics</div>
              </div>
            </button>

            <div className="w-px h-5 bg-pitch-700 mx-1 hidden lg:block flex-shrink-0" />

            {/* Desktop nav items */}
            <div className="hidden lg:flex items-center flex-1 overflow-x-auto scrollbar-none gap-0.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id ||
                  (item.id === "betting" && activeTab === "tracker");
                const isHovered = hoveredItem === item.id;

                return (
                  <div
                    key={item.id}
                    className="relative flex-shrink-0"
                    onMouseEnter={() => item.sub && handleMouseEnter(item.id)}
                    onMouseLeave={item.sub ? handleMouseLeave : undefined}
                  >
                    <button
                      onClick={() => onTabChange(item.id)}
                      className={`pm-nav-btn ${isActive ? "active" : ""}`}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <Icon size={13} strokeWidth={1.8} />
                      <span className="text-[12px] font-medium">{item.label}</span>
                      {item.sub && (
                        <ChevronDown
                          size={10}
                          strokeWidth={2}
                          className={`transition-transform duration-150 ${isHovered ? "rotate-180" : ""}`}
                        />
                      )}
                    </button>

                    <AnimatePresence>
                      {isHovered && item.sub && (
                        <SubMenu
                          item={item}
                          onNavigate={onTabChange}
                          onClose={closeSubMenu}
                        />
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-0.5 ml-auto flex-shrink-0">

              {/* Search */}
              <button
                onClick={toggleSearch}
                className={`pm-nav-btn relative ${searchOpen ? "text-accent bg-accent/10" : ""}`}
                title="Search players  [/]"
                aria-label={searchOpen ? "Close search" : "Search players"}
                aria-expanded={searchOpen}
              >
                <AnimatePresence mode="wait">
                  {searchOpen ? (
                    <motion.span key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.12 }}>
                      <X size={13} strokeWidth={1.8} />
                    </motion.span>
                  ) : (
                    <motion.span key="search" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.12 }}>
                      <Search size={13} strokeWidth={1.8} />
                    </motion.span>
                  )}
                </AnimatePresence>
                {/* Keyboard hint */}
                {!searchOpen && (
                  <span className="hidden xl:flex items-center gap-1 text-[10px] text-pitch-600 ml-0.5">
                    /
                  </span>
                )}
              </button>

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setNotifOpen(p => !p)}
                  className={`pm-nav-btn relative ${notifOpen ? "text-accent bg-accent/10" : ""}`}
                  title="Notifications"
                  aria-label="Notifications"
                >
                  <Bell size={13} strokeWidth={1.8} />
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-accent animate-pulse-glow" />
                </button>

                <AnimatePresence>
                  {notifOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.14 }}
                      className="absolute top-full right-0 mt-1.5 w-72 z-50
                                 bg-pitch-800 border border-pitch-600 rounded-xl
                                 shadow-card-lg overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-pitch-700 flex items-center justify-between">
                        <span className="pm-label">Notifications</span>
                        <button
                          onClick={() => setNotifOpen(false)}
                          className="text-pitch-500 hover:text-pitch-300 transition-colors"
                        >
                          <X size={12} strokeWidth={1.8} />
                        </button>
                      </div>
                      <div className="px-4 py-3 space-y-2.5">
                        {[
                          { icon: Zap, text: "OKC vs BKN tips off in 2h", time: "Now", color: "text-accent" },
                          { icon: TrendingUp, text: "New high-edge bet identified", time: "15m", color: "text-win" },
                          { icon: Activity, text: "Live game: PHX leads LAL 87-82", time: "32m", color: "text-draw" },
                        ].map((n, i) => (
                          <div key={i} className="flex items-start gap-2.5 group cursor-pointer">
                            <div className={`w-7 h-7 rounded-md bg-pitch-700 flex items-center justify-center flex-shrink-0 ${n.color}`}>
                              <n.icon size={12} strokeWidth={1.8} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] text-pitch-200 leading-snug">{n.text}</div>
                              <div className="text-[10px] text-pitch-500 mt-0.5">{n.time} ago</div>
                            </div>
                            <ChevronRight size={10} className="text-pitch-600 group-hover:text-pitch-400 mt-1 transition-colors flex-shrink-0" />
                          </div>
                        ))}
                      </div>
                      <div className="px-4 py-2.5 border-t border-pitch-700">
                        <button className="w-full text-[10px] text-pitch-500 hover:text-accent transition-colors text-center">
                          View all notifications
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Settings */}
              <button
                className="pm-nav-btn"
                title="Settings"
                aria-label="Settings"
                onClick={() => console.info("[PlusMinus] Settings panel — coming soon")}
              >
                <Settings size={13} strokeWidth={1.8} />
              </button>

              {/* Live indicator */}
              <div
                className="flex items-center gap-1.5 ml-1.5 px-2 py-1 rounded-md
                           bg-pitch-750 border border-pitch-600"
                title="Data updates every 2 minutes during games"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-glow" />
                <span className="text-[9px] font-semibold tracking-[1.5px] text-accent uppercase hidden xs:inline">
                  Live
                </span>
              </div>
            </div>
          </div>

          {/* Search bar — expands below nav */}
          <AnimatePresence>
            {searchOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 48, opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="overflow-hidden"
              >
                <div className="py-1.5 relative">
                  <Search
                    size={13}
                    strokeWidth={1.8}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-pitch-500 pointer-events-none"
                  />
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKey}
                    placeholder="Search any NBA player — press Enter to navigate…"
                    className="w-full bg-pitch-750 border border-pitch-600 rounded-lg
                               pl-9 pr-24 py-2 text-sm text-pitch-100
                               placeholder:text-pitch-500 focus:outline-none
                               focus:border-accent/50 transition-colors"
                    aria-label="Player search"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="text-pitch-600 hover:text-pitch-400 transition-colors"
                      >
                        <X size={11} strokeWidth={1.8} />
                      </button>
                    )}
                    <kbd className="bg-pitch-700 border border-pitch-600 rounded px-1.5 py-0.5
                                    text-[9px] font-mono text-pitch-500">
                      ↵
                    </kbd>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>
    </>
  );
}