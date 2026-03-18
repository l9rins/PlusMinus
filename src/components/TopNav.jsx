import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    LayoutDashboard, Users, BarChart3, Target,
    TrendingUp, Wallet, ChevronDown, Search, Bell, Settings,
} from "lucide-react";

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
        sub: ["Tonight's Games", "Recent Results", "Win Probabilities"],
    },
    {
        label: "Standings",
        icon: BarChart3,
        id: "standings",
        sub: ["Eastern Conference", "Western Conference", "Playoff Picture"],
    },
    {
        label: "Players",
        icon: Users,
        id: "players",
        sub: ["Player Explorer", "Shot Charts", "Advanced Stats", "Comparisons"],
    },
    {
        label: "Betting",
        icon: TrendingUp,
        id: "betting",
        sub: ["Edge Finder", "Bet Tracker", "ROI Dashboard", "Model Builder"],
    },
    {
        label: "Analytics",
        icon: Wallet,
        id: "analytics",
        sub: ["Four Factors", "Elo Ratings", "Lineup Tool", "Shot Quality"],
    },
];

export default function TopNav({ activeTab, onTabChange }) {
    const [hoveredItem, setHoveredItem] = useState(null);
    const [searchOpen, setSearchOpen] = useState(false);
    const timeoutRef = useRef(null);

    const handleMouseEnter = (id) => {
        clearTimeout(timeoutRef.current);
        setHoveredItem(id);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => setHoveredItem(null), 120);
    };

    return (
        <nav className="sticky top-0 z-50 border-b border-pitch-600 bg-pitch-850/95 backdrop-blur-sm">
            <div className="max-w-[1400px] mx-auto px-4">
                <div className="flex items-center h-12 gap-1">

                    {/* Logo */}
                    <div className="flex items-center gap-2 mr-4 flex-shrink-0">
                        <span className="font-display text-2xl tracking-widest text-accent leading-none">
                            ±
                        </span>
                        <div>
                            <div className="font-display text-lg tracking-[3px] text-pitch-50 leading-none">
                                PLUSMINUS
                            </div>
                            <div className="text-[8px] tracking-[2px] text-pitch-400 uppercase">
                                NBA Analytics
                            </div>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="w-px h-6 bg-pitch-600 mx-2" />

                    {/* Nav items */}
                    <div className="flex items-center flex-1">
                        {NAV_ITEMS.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.id;
                            const isHovered = hoveredItem === item.id;

                            return (
                                <div
                                    key={item.id}
                                    className="relative"
                                    onMouseEnter={() => handleMouseEnter(item.id)}
                                    onMouseLeave={handleMouseLeave}
                                >
                                    <button
                                        onClick={() => onTabChange(item.id)}
                                        className={`pm-nav-btn ${isActive ? "active" : ""}`}
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

                                    {/* Submenu */}
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
                                                        key={sub}
                                                        onClick={() => onTabChange(item.id)}
                                                        className="w-full text-left px-3 py-2 text-xs text-pitch-300
                                       hover:text-pitch-100 hover:bg-pitch-700
                                       transition-colors duration-100 flex items-center gap-2"
                                                    >
                                                        <div className="w-1 h-1 rounded-full bg-pitch-500" />
                                                        {sub}
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
                    <div className="flex items-center gap-1 ml-auto">
                        {/* Search */}
                        <button
                            onClick={() => setSearchOpen(!searchOpen)}
                            className="pm-nav-btn"
                        >
                            <Search size={13} strokeWidth={1.8} />
                        </button>

                        {/* Notifications */}
                        <button className="pm-nav-btn relative">
                            <Bell size={13} strokeWidth={1.8} />
                            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent" />
                        </button>

                        {/* Settings */}
                        <button className="pm-nav-btn">
                            <Settings size={13} strokeWidth={1.8} />
                        </button>

                        {/* Live indicator */}
                        <div className="flex items-center gap-1.5 ml-2 px-2 py-1 rounded bg-pitch-700 border border-pitch-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-glow" />
                            <span className="text-[9px] font-medium tracking-[1.5px] text-accent uppercase">Live</span>
                        </div>
                    </div>
                </div>

                {/* Search bar — slides in */}
                <AnimatePresence>
                    {searchOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 40, opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="overflow-hidden"
                        >
                            <div className="py-1.5">
                                <input
                                    autoFocus
                                    placeholder="Search players, teams, games..."
                                    className="w-full bg-pitch-700 border border-pitch-500 rounded-md
                             px-3 py-1.5 text-sm text-pitch-100 placeholder:text-pitch-400
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