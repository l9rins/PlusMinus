import { useState, useEffect, useCallback, Suspense, Component, lazy } from "react";
import {
  BrowserRouter, Routes, Route, Navigate,
  useNavigate, useLocation,
} from "react-router-dom";
import { SignedIn, SignedOut, SignIn } from "@clerk/clerk-react";
import { AnimatePresence, motion } from "framer-motion";
import TopNav from "./components/TopNav";
import { ToastContainer } from "./components/ui";
import { TEAM_COLORS } from "./data";

// ── Lazy route components ─────────────────────────────────────────
const Dashboard = lazy(() => import("./components/Dashboard"));
const Players = lazy(() => import("./components/Players"));
const Analytics = lazy(() => import("./components/Analytics"));
const TeamDetail = lazy(() => import("./components/TeamDetail"));
const Scores = lazy(() => import("./components/Views").then(m => ({ default: m.Scores })));
const Standings = lazy(() => import("./components/Views").then(m => ({ default: m.Standings })));
const Betting = lazy(() => import("./components/Views").then(m => ({ default: m.Betting })));
const BetTracker = lazy(() => import("./components/Views").then(m => ({ default: m.BetTracker })));

// ── Dynamic team theming ──────────────────────────────────────────
// Call useTeamTheme("OKC") from any view to shift the global --theme-accent
// CSS variable to that team's brand color — buttons, borders, glows update.
export function useTeamTheme(teamAbbr) {
  useEffect(() => {
    const color = (teamAbbr && TEAM_COLORS[teamAbbr]) ? TEAM_COLORS[teamAbbr] : null;
    if (color) {
      document.documentElement.style.setProperty("--theme-accent", color);
      const hex = color.replace("#", "");
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      document.documentElement.style.setProperty("--theme-accent-rgb", `${r},${g},${b}`);
    }
    // Always clean up on unmount regardless of whether color was set
    return () => {
      document.documentElement.style.setProperty("--theme-accent", "#00d4aa");
      document.documentElement.style.setProperty("--theme-accent-rgb", "0,212,170");
    };
  }, [teamAbbr]);
}

// ── Route metadata ────────────────────────────────────────────────
const ROUTE_META = {
  "/": { title: "Dashboard", tab: "dashboard" },
  "/scores": { title: "Scores", tab: "scores" },
  "/standings": { title: "Standings", tab: "standings" },
  "/players": { title: "Players", tab: "players" },
  "/betting": { title: "Betting", tab: "betting" },
  "/tracker": { title: "Bet Tracker", tab: "tracker" },
  "/analytics": { title: "Analytics", tab: "analytics" },
};

const SHORTCUT_ROUTES = {
  d: "/", s: "/scores", l: "/standings", p: "/players",
  b: "/betting", t: "/tracker", a: "/analytics",
};

const TAB_ROUTES = {
  dashboard: "/", scores: "/scores", standings: "/standings",
  players: "/players", betting: "/betting", tracker: "/tracker",
  analytics: "/analytics",
};

// ── Page skeleton ─────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="space-y-3 pt-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="pm-skeleton h-24 rounded-xl"
          style={{ animationDelay: `${i * 0.08}s` }} />
      ))}
    </div>
  );
}

// ── Error boundary ────────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(e, info) { console.error("[PlusMinus]", e, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="pm-card p-8 text-center mt-6">
          <div className="text-2xl mb-2">⚠️</div>
          <div className="text-pitch-200 font-medium mb-1">Something went wrong</div>
          <div className="text-pitch-500 text-sm mb-4 font-mono">{this.state.error?.message}</div>
          <button onClick={() => this.setState({ hasError: false, error: null })} className="pm-btn text-sm">
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Inner app ─────────────────────────────────────────────────────
function AppInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  // Document title — handles /team/:abbr dynamically
  useEffect(() => {
    const meta = ROUTE_META[location.pathname];
    if (meta) {
      document.title = `${meta.title} · PlusMinus`;
    } else if (location.pathname.startsWith("/team/")) {
      const abbr = location.pathname.split("/team/")[1]?.toUpperCase();
      document.title = abbr ? `${abbr} · PlusMinus` : "PlusMinus";
    } else {
      document.title = "PlusMinus";
    }
  }, [location.pathname]);

  // Global keyboard shortcuts (when no input is focused)
  useEffect(() => {
    const handler = (e) => {
      const tag = e.target.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const route = SHORTCUT_ROUTES[e.key.toLowerCase()];
      if (route) { e.preventDefault(); navigate(route); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  const handleTabChange = useCallback((tabId, query) => {
    setSearchQuery(query !== undefined ? query : "");
    navigate(TAB_ROUTES[tabId] || "/");
  }, [navigate]);

  const activeTab = ROUTE_META[location.pathname]?.tab || "dashboard";

  return (
  <div className="min-h-screen bg-pitch-900">
    <SignedOut>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center mb-8">
          <div className="font-display text-5xl tracking-widest text-accent mb-2">±</div>
          <div className="font-display text-2xl tracking-[4px] text-pitch-50 mb-1">PLUSMINUS</div>
          <div className="text-[11px] tracking-[2px] text-pitch-500 uppercase mb-8">NBA Analytics</div>
          <SignIn routing="hash" />
        </div>
      </div>
    </SignedOut>

    <SignedIn>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {ROUTE_META[location.pathname]?.title} page
      </div>

      <TopNav activeTab={activeTab} onTabChange={handleTabChange} />

      <main className="max-w-[1400px] mx-auto px-4 py-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <ErrorBoundary>
              <Suspense fallback={<PageSkeleton />}>
                <Routes>
                  <Route path="/" element={<Dashboard onNavigate={handleTabChange} />} />
                  <Route path="/scores" element={<Scores />} />
                  <Route path="/standings" element={<Standings />} />
                  <Route path="/players" element={<Players initialQuery={searchQuery} />} />
                  <Route path="/betting" element={<Betting />} />
                  <Route path="/tracker" element={<BetTracker />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/team/:abbr" element={<TeamDetail />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </main>

      <ToastContainer />
      <div className="hidden sm:block fixed bottom-3 right-4 z-10 pointer-events-none select-none">
        <div className="text-[9px] text-pitch-700 font-mono">
          D·S·L·P·B·T·A &nbsp;shortcuts &nbsp;|&nbsp; / &nbsp;search
        </div>
      </div>
    </SignedIn>
  </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}