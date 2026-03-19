import { useState, useEffect, useCallback, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import TopNav from "./components/TopNav";
import Dashboard from "./components/Dashboard";
import Players from "./components/Players";
import Analytics from "./components/Analytics";
import { Scores, Standings, Betting, BetTracker } from "./components/Views";
import { ToastContainer } from "./components/ui";

// ─── Tab metadata ─────────────────────────────────────────────
const TAB_META = {
  dashboard: { title: "Dashboard", desc: "Overview of scores, standings, and betting" },
  scores: { title: "Scores", desc: "Today's NBA game scores and odds" },
  standings: { title: "Standings", desc: "NBA conference standings" },
  players: { title: "Players", desc: "NBA player stats and advanced metrics" },
  betting: { title: "Betting", desc: "NBA odds and value edges" },
  tracker: { title: "Bet Tracker", desc: "Your personal bet log and P&L" },
  analytics: { title: "Analytics", desc: "Four Factors, Elo, and Power Index" },
};

// ─── Fallback while lazy chunks load ─────────────────────────
function PageSkeleton() {
  return (
    <div className="space-y-3 pt-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="pm-skeleton h-24 rounded-xl" style={{ animationDelay: `${i * 0.08}s` }} />
      ))}
    </div>
  );
}

// ─── Simple error boundary (class component required) ────────
import { Component } from "react";
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("[PlusMinus] Render error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="pm-card p-8 text-center mt-6">
          <div className="text-2xl mb-2">⚠️</div>
          <div className="text-pitch-200 font-medium mb-1">Something went wrong</div>
          <div className="text-pitch-500 text-sm mb-4">{this.state.error?.message}</div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="pm-btn text-sm"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Global keyboard shortcuts ────────────────────────────────
// 1=Dashboard 2=Scores 3=Standings 4=Players 5=Betting 6=Tracker 7=Analytics
const TAB_KEYS = {
  "1": "dashboard",
  "2": "scores",
  "3": "standings",
  "4": "players",
  "5": "betting",
  "6": "tracker",
  "7": "analytics",
};

// ─── Main App ─────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState("");

  // Update document title on tab change
  useEffect(() => {
    const meta = TAB_META[tab];
    if (meta) {
      document.title = `${meta.title} · PlusMinus`;
      // Update meta description for tab context
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute("content", meta.desc);
    }
  }, [tab]);

  const handleTabChange = useCallback((newTab, query) => {
    setTab(newTab);
    setSearchQuery(query !== undefined ? query : "");
  }, []);

  // Global keyboard shortcuts (only when no input is focused)
  useEffect(() => {
    const handler = (e) => {
      // Don't fire when typing in inputs / textareas
      const tag = e.target.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable) return;
      // Don't fire with modifiers
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const mapped = TAB_KEYS[e.key];
      if (mapped) {
        e.preventDefault();
        setTab(mapped);
        setSearchQuery("");
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const renderContent = () => {
    switch (tab) {
      case "dashboard": return <Dashboard key="dashboard" onNavigate={setTab} />;
      case "scores": return <Scores key="scores" />;
      case "standings": return <Standings key="standings" />;
      case "players": return <Players key="players" initialQuery={searchQuery} />;
      case "betting": return <Betting key="betting" />;
      case "tracker": return <BetTracker key="tracker" />;
      case "analytics": return <Analytics key="analytics" />;
      default:
        console.warn("[PlusMinus] Unknown tab:", tab);
        return <Dashboard key="dashboard" onNavigate={setTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-pitch-900">
      {/* Screen-reader page announcement */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {TAB_META[tab]?.title} page loaded
      </div>

      <TopNav activeTab={tab} onTabChange={handleTabChange} />

      <main
        id="main-content"
        className="max-w-[1400px] mx-auto px-4 py-5"
        aria-label={TAB_META[tab]?.title}
      >
        <ErrorBoundary key={tab}>
          <Suspense fallback={<PageSkeleton />}>
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </ErrorBoundary>
      </main>

      {/* Global toast notifications */}
      <ToastContainer />

      {/* Keyboard shortcut hint (subtle footer) */}
      <div className="hidden sm:block fixed bottom-4 right-4 z-10">
        <div className="text-[9px] text-pitch-700 font-mono select-none">
          Press 1–7 to switch tabs · / to search
        </div>
      </div>
    </div>
  );
}