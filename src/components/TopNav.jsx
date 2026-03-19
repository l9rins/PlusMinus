import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, BarChart3, Target,
  TrendingUp, Wallet, ChevronDown, Search, Bell, Settings, X,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, id: "dashboard", sub: null },
  {
    label: "Scores", icon: Target, id: "scores",
    sub: [
      { label: "Tonight's Games", id: "scores" },
      { label: "Win Probabilities", id: "scores" },
    ],
  },
  {
    label: "Standings", icon: BarChart3, id: "standings",
    sub: [
      { label: "Eastern Conference", id: "standings" },
      { label: "Western Conference", id: "standings" },
    ],
  },
  {
    label: "Players", icon: Users, id: "players",
    sub: [
      { label: "Player Explorer", id: "players" },
      { label: "Advanced Stats", id: "players" },
    ],
  },
  {
    label: "Betting", icon: TrendingUp, id: "betting",
    sub: [
      { label: "Edge Finder", id: "betting" },
      { label: "Bet Tracker", id: "tracker" },
    ],
  },
  {
    label: "Analytics", icon: Wallet, id: "analytics",
    sub: [
      { label: "Four Factors", id: "analytics" },
      { label: "Elo Ratings", id: "analytics" },
      { label: "Lineup Tool", id: "analytics" },
    ],
  },
];

export default function TopNav({ activeTab, onTabChange }) {
  const [hoveredItem, setHoveredItem] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const timeoutRef = useRef(null);

  // Clean up pending timeout on unmount to prevent state updates on unmounted component
  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  const handleMouseEnter = (id) => {
    clearTimeout(timeoutRef.current);
    setHoveredItem(id);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setHoveredItem(null), 120);
  };

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
    setSearchOpen(prev => !prev);
    if (searchOpen) setSearchQuery("");
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-pitch-600 bg-pitch-850/95 backdrop-blur-sm">
      <div className="max-w-[1400px] mx-auto px-4">
        <div className="flex items-center h-12 gap-1">

          {/* Logo */}
          <div className="flex items-center gap-2 mr-4 flex-shrink-0">
            <span className="font-display text-2xl tracking-widest text-accent leading-none">±</span>
            <div>
              <div className="font-display text-lg tracking-[3px] text-pitch-50 leading-none">PLUSMINUS</div>
              <div className="text-[8px] tracking-[2px] text-pitch-400 uppercase">NBA Analytics</div>
            </div>
          </div>

          <div className="w-px h-6 bg-pitch-600 mx-2" />

          {/* Nav items */}
          <div className="flex items-center flex-1 overflow-x-auto scrollbar-none">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id ||
                (item.id === "betting" && activeTab === "tracker");
              const isHovered = hoveredItem === item.id;

              return (
                <div
                  key={item.id}
                  className="relative flex-shrink-0"
                  onMouseEnter={() => handleMouseEnter(item.id)}
                  onMouseLeave={handleMouseLeave}
                >
                  <button
                    onClick={() => onTabChange(item.id)}
                    className={`pm-nav-btn ${isActive ? "active" : ""}`}
                  >
                    <Icon size={13} strokeWidth={1.8} />
                    <span className="text-[12px] font-medium hidden sm:inline">{item.label}</span>
                    {item.sub && (
                      <ChevronDown
                        size={10}
                        strokeWidth={2}
                        className={`transition-transform duration-150 hidden sm:block ${isHovered ? "rotate-180" : ""}`}
                      />
                    )}
                  </button>

                  <AnimatePresence>
                    {isHovered && item.sub && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute top-full left-0 mt-1 min-w-[180px] pm-card py-1 z-50"
                        onMouseEnter={() => handleMouseEnter(item.id)}
                        onMouseLeave={handleMouseLeave}
                      >
                        {item.sub.map((sub) => (
                          <button
                            key={sub.label}
                            onClick={() => { onTabChange(sub.id); setHoveredItem(null); }}
                            className="w-full text-left px-3 py-2 text-xs text-pitch-300
                                       hover:text-pitch-100 hover:bg-pitch-700
                                       transition-colors duration-100 flex items-center gap-2"
                          >
                            <div className="w-1 h-1 rounded-full bg-pitch-500 flex-shrink-0" />
                            {sub.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1 ml-auto flex-shrink-0">
            <button onClick={toggleSearch} className="pm-nav-btn" title="Search">
              {searchOpen
                ? <X size={13} strokeWidth={1.8} />
                : <Search size={13} strokeWidth={1.8} />
              }
            </button>

            <button
              className="pm-nav-btn relative"
              title="Notifications (coming soon)"
              onClick={() => console.info("[PlusMinus] Notifications not yet implemented")}
            >
              <Bell size={13} strokeWidth={1.8} />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent" />
            </button>

            <button
              className="pm-nav-btn"
              title="Settings (coming soon)"
              onClick={() => console.info("[PlusMinus] Settings not yet implemented")}
            >
              <Settings size={13} strokeWidth={1.8} />
            </button>

            <div className="flex items-center gap-1.5 ml-2 px-2 py-1 rounded bg-pitch-700 border border-pitch-600">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-glow" />
              <span className="text-[9px] font-medium tracking-[1.5px] text-accent uppercase">Live</span>
            </div>
          </div>
        </div>

        {/* Search bar */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 44, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="py-1.5">
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKey}
                  placeholder="Search players, teams… press Enter to go to Players"
                  className="w-full bg-pitch-700 border border-pitch-500 rounded-md
                             px-3 py-2 text-sm text-pitch-100 placeholder:text-pitch-400
                             focus:outline-none focus:border-accent/50 transition-colors"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}