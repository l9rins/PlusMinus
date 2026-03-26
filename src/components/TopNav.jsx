import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, BarChart3, Target,
  TrendingUp, Activity, ChevronDown, Search, Bell,
  Settings, X, Menu, Zap, ChevronRight, Sun, Moon,
  GitCompare, BarChart2, Coins, ArrowRight,
} from "lucide-react";
import { UserButton } from "@clerk/clerk-react";
import { useTodayGames, useOdds } from "../api";
import { cn } from "../lib/utils";

// ── Nav definition ────────────────────────────────────────────────
const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/", sub: null },
  {
    label: "Scores", icon: Target, path: "/scores",
    sub: [
      { label: "Tonight's Games", path: "/scores", desc: "Live + scheduled matchups" },
      { label: "Win Probabilities", path: "/scores", desc: "Model vs market" },
    ],
  },
  {
    label: "Standings", icon: BarChart3, path: "/standings",
    sub: [
      { label: "Eastern Conference", path: "/standings", desc: "Atlantic · Central · Southeast" },
      { label: "Western Conference", path: "/standings", desc: "Northwest · Pacific · Southwest" },
    ],
  },
  {
    label: "Players", icon: Users, path: "/players",
    sub: [
      { label: "Browse Roster", path: "/players", desc: "Top 30 by stat category" },
      { label: "Compare Players", path: "/players", desc: "Side-by-side advanced metrics" },
    ],
  },
  {
    label: "Betting", icon: TrendingUp, path: "/betting",
    sub: [
      { label: "Edge Finder", path: "/betting", desc: "Model vs market · multi-book" },
      { label: "Bet Tracker", path: "/tracker", desc: "Log, track, and analyze bets" },
    ],
  },
  {
    label: "Analytics", icon: Activity, path: "/analytics",
    sub: [
      { label: "Power Index", path: "/analytics", desc: "Composite team rankings" },
      { label: "Four Factors", path: "/analytics", desc: "Dean Oliver efficiency model" },
      { label: "Elo Ratings", path: "/analytics", desc: "Power rankings & trajectory" },
      { label: "Shot Quality", path: "/analytics", desc: "Radar profiles & comparison" },
      { label: "Playoff Sim", path: "/analytics?tab=playoff", desc: "Monte Carlo bracket odds" },
    ],
  },
  {
    label: "Compare", icon: GitCompare, path: "/compare",
    sub: [
      { label: "Team vs Team", path: "/compare", desc: "Elo, stats, star player clash" },
      { label: "Win probability", path: "/compare", desc: "Home court advantage included" },
    ],
  },
  {
    label: "Leaderboard", icon: Coins, path: "/paper",
    sub: [
      { label: "Paper Betting", path: "/paper", desc: "No real money · just PMC" },
      { label: "Global Ranking", path: "/paper", desc: "Compete with users & model" },
    ],
  },
];

// ── Sub-dropdown ──────────────────────────────────────────────────
function SubMenu({ item, onNavigate, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.98 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="absolute top-full left-0 mt-2 min-w-[280px] z-50
                 bg-white border border-morphin-border rounded-2xl py-2
                 shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden"
    >
      {item.sub.map((sub) => (
        <button
          key={sub.label}
          onClick={() => { onNavigate(sub.path); onClose(); }}
          className="w-full text-left px-5 py-3.5 flex items-start gap-4
                     hover:bg-morphin-ghost transition-all group"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-morphin-border group-hover:bg-morphin-accent
                          mt-2 flex-shrink-0 transition-colors" />
          <div>
            <div className="text-sm font-semibold text-morphin-text group-hover:text-black transition-colors">
              {sub.label}
            </div>
            {sub.desc && (
              <div className="text-[11px] text-morphin-muted mt-0.5 leading-relaxed">{sub.desc}</div>
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
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 left-0 bottom-0 w-80 z-[101] bg-white border-r border-morphin-border flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between px-6 h-20 border-b border-morphin-border">
              <div className="flex items-center gap-2">
                <span className="font-display text-3xl font-bold text-morphin-accent">±</span>
                <span className="font-display text-xl font-bold tracking-widest text-morphin-text uppercase">PlusMinus</span>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-morphin-ghost rounded-full transition-colors">
                <X size={20} className="text-morphin-muted" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activePath === item.path;
                return (
                  <div key={item.path}>
                    <button
                      onClick={() => !item.sub && onNavigate(item.path)}
                      className={cn(
                        "w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-semibold transition-all group",
                        isActive 
                          ? "bg-morphin-accent text-white shadow-lg" 
                          : "text-morphin-muted hover:bg-morphin-ghost hover:text-morphin-text"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <Icon size={18} strokeWidth={2.5} />
                        {item.label}
                      </div>
                      {item.sub && <ChevronDown size={14} className="opacity-50" />}
                    </button>
                    {item.sub && (
                       <div className="ml-10 mt-1 space-y-1">
                         {item.sub.map(sub => (
                           <button 
                             key={sub.label}
                             onClick={() => { onNavigate(sub.path); onClose(); }}
                             className="w-full text-left py-2 px-3 text-[13px] text-morphin-muted hover:text-morphin-accent transition-colors font-medium border-l border-morphin-border"
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Main TopNav ───────────────────────────────────────────────────
export default function TopNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [hoveredItem, setHoveredItem] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [isLight, setIsLight] = useState(true);
  const searchInputRef = useRef(null);

  const { data: games } = useTodayGames();
  const { data: oddsData } = useOdds();

  const notifications = useMemo(() => {
    const items = [];
    (games || []).filter(g => g.status === "live").forEach(g => items.push({
      id: `live-${g.id}`,
      icon: Activity,
      text: `${g.away} @ ${g.home} — Q${g.period}`,
      time: "Live",
      color: "text-win",
      action: () => { navigate("/scores"); setNotifOpen(false); }
    }));
    return items.slice(0, 5);
  }, [games, navigate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (["input", "textarea", "select"].includes(e.target.tagName.toLowerCase())) return;
      if (e.key === "/" && !searchOpen) {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setNotifOpen(false);
      }
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

      <nav className="sticky top-0 z-50 h-20 bg-white/80 backdrop-blur-xl border-b border-morphin-border flex items-center px-8">
        <div className="max-w-[1600px] w-full mx-auto flex items-center justify-between">
          
          {/* Left: Logo & Nav */}
          <div className="flex items-center gap-10">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-3 active:scale-95 transition-transform"
            >
              <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center shadow-2xl">
                <span className="font-display text-2xl font-bold text-white">±</span>
              </div>
              <span className="font-display text-xl font-bold tracking-widest text-morphin-text uppercase hidden md:block">PlusMinus</span>
            </button>

            <div className="hidden lg:flex items-center gap-2">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
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
                        "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all",
                        isActive 
                          ? "bg-morphin-ghost text-black" 
                          : "text-morphin-muted hover:bg-morphin-ghost hover:text-morphin-text"
                      )}
                    >
                      <span>{item.label}</span>
                      {item.sub && <ChevronDown size={14} className={cn("transition-transform", isHovered && "rotate-180")} />}
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

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSearchOpen(true)}
              className="p-3 rounded-full hover:bg-morphin-ghost text-morphin-muted hover:text-morphin-text transition-all active:scale-90"
            >
              <Search size={20} strokeWidth={2.5} />
            </button>
            
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="p-3 rounded-full hover:bg-morphin-ghost text-morphin-muted hover:text-morphin-text transition-all active:scale-90 relative"
              >
                <Bell size={20} strokeWidth={2.5} />
                {notifications.length > 0 && (
                  <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-morphin-accent rounded-full border-2 border-white ring-4 ring-morphin-accent/10" />
                )}
              </button>

              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.98 }}
                    className="absolute top-full right-0 mt-4 w-80 bg-white border border-morphin-border rounded-[2rem] shadow-2xl p-4 overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-4 px-2">
                        <span className="text-[10px] font-bold uppercase tracking-[3px] text-morphin-muted">Live Alerts</span>
                        <button onClick={() => setNotifOpen(false)} className="text-morphin-muted hover:text-morphin-text"><X size={14} /></button>
                    </div>
                    <div className="space-y-2">
                       {notifications.length > 0 ? notifications.map(n => (
                         <button key={n.id} onClick={n.action} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-morphin-ghost transition-colors text-left group">
                            <div className="w-10 h-10 rounded-full bg-morphin-accent/10 flex items-center justify-center text-morphin-accent"><Activity size={18} /></div>
                            <div className="flex-1 min-w-0">
                               <div className="text-sm font-bold text-morphin-text truncate">{n.text}</div>
                               <div className="text-[10px] font-medium text-morphin-muted uppercase tracking-wider">{n.time}</div>
                            </div>
                            <ChevronRight size={14} className="text-morphin-border group-hover:text-morphin-muted" />
                         </button>
                       )) : (
                         <div className="text-center py-8 text-sm text-morphin-muted">No active alerts.</div>
                       )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
               onClick={() => navigate("/settings")}
               className="p-3 rounded-full hover:bg-morphin-ghost text-morphin-muted hover:text-morphin-text transition-all active:scale-90"
            >
              <Settings size={20} strokeWidth={2.5} />
            </button>

            <div className="h-8 w-px bg-morphin-border mx-2 hidden md:block" />

            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-xl hover:scale-110 active:scale-95 transition-all cursor-pointer">
              <UserButton />
            </div>

            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-3 rounded-full hover:bg-morphin-ghost text-morphin-muted"
            >
              <Menu size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </nav>

      {/* Global Command/Search Overlay */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-white/60 backdrop-blur-3xl flex items-start justify-center pt-[15vh] px-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 30 }}
              className="w-full max-w-3xl bg-white border border-morphin-border rounded-[2.5rem] shadow-[0_50px_150px_rgba(0,0,0,0.15)] overflow-hidden"
            >
              <div className="p-10 relative">
                <Search size={32} className="absolute left-14 top-1/2 -translate-y-1/2 text-morphin-muted" />
                <input
                  ref={searchInputRef}
                  autoFocus
                  placeholder="Search rosters, matchups, or bets..."
                  className="w-full h-24 pl-20 pr-24 bg-morphin-ghost rounded-[2rem] text-3xl font-bold text-morphin-text placeholder:text-morphin-muted focus:outline-none focus:ring-4 focus:ring-morphin-accent/5 transition-all"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                <button 
                  onClick={() => setSearchOpen(false)}
                  className="absolute right-16 top-1/2 -translate-y-1/2 p-3 hover:bg-white rounded-2xl transition-colors shadow-sm"
                >
                  <X size={24} className="text-morphin-muted" />
                </button>
              </div>
              <div className="px-10 pb-10">
                 <div className="text-[10px] font-bold text-morphin-muted uppercase tracking-[4px] mb-6 mb-4">Quick Shortcuts</div>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {NAV_ITEMS.slice(0, 4).map(item => (
                       <button key={item.path} onClick={() => { navigate(item.path); setSearchOpen(false); }} className="flex flex-col items-center gap-4 p-8 rounded-[2rem] hover:bg-morphin-ghost transition-all border border-transparent hover:border-morphin-border group active:scale-95">
                          <div className="w-16 h-16 rounded-2xl bg-white border border-morphin-border flex items-center justify-center text-morphin-muted group-hover:text-morphin-accent transition-all shadow-sm">
                             <item.icon size={28} />
                          </div>
                          <span className="text-[12px] font-bold text-morphin-text uppercase tracking-widest">{item.label}</span>
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