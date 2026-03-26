import { useState, useEffect, useCallback, Suspense, Component, lazy } from "react";
import {
  BrowserRouter, Routes, Route, Navigate,
  useNavigate, useLocation,
} from "react-router-dom";
import { SignedIn, SignedOut, SignIn } from "@clerk/clerk-react";
import { AnimatePresence, motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import TopNav from "./components/TopNav";
import { ToastContainer } from "./components/ui";
import { TooltipProvider } from "./components/ui/tooltip";
import { TEAM_COLORS } from "./data";
import { invalidateErroredQueries } from "./api";

// ── Lazy route components ─────────────────────────────────────────
const Dashboard  = lazy(() => import("./components/Dashboard"));
const Players    = lazy(() => import("./components/Players"));
const Analytics  = lazy(() => import("./components/Analytics"));
const TeamDetail = lazy(() => import("./components/TeamDetail"));
const HeadToHead = lazy(() => import("./components/HeadToHead"));
const Scores     = lazy(() => import("./components/Views").then(m => ({ default: m.Scores })));
const Standings  = lazy(() => import("./components/Views").then(m => ({ default: m.Standings })));
const Betting    = lazy(() => import("./components/Views").then(m => ({ default: m.Betting })));
const BetTracker = lazy(() => import("./components/Views").then(m => ({ default: m.BetTracker })));
const PaperBetting = lazy(() => import("./components/PaperBetting"));
const WebhookSettings = lazy(() => import("./components/WebhookSettings"));
import { useSSE } from "./hooks/useSSE";

// ── Dynamic team theming ──────────────────────────────────────────
// FIX G3a: Restore the *original* CSS variable values on unmount instead
// of hardcoding "#00d4aa" and "0,212,170".
//
// Before: cleanup always reset to the literal teal hex. If the default
// accent color in index.css or tailwind.config.js is ever changed, navigating
// away from any team page would flash the wrong legacy teal for one frame.
//
// After: read the current --theme-accent and --theme-accent-rgb from the
// computed style BEFORE overwriting them, then restore exactly those values.
// If no team color applies (bad abbr, unknown team), we skip the write
// entirely so there's nothing to restore.
export function useTeamTheme(teamAbbr) {
  useEffect(() => {
    const color = (teamAbbr && TEAM_COLORS[teamAbbr]) ? TEAM_COLORS[teamAbbr] : null;
    if (!color) return; // nothing written — no cleanup needed

    // Capture originals before overwriting
    const root         = document.documentElement;
    const origAccent   = root.style.getPropertyValue("--theme-accent")     || "";
    const origAccentRgb = root.style.getPropertyValue("--theme-accent-rgb") || "";

    root.style.setProperty("--theme-accent", color);
    const hex = color.replace("#", "");
    const r   = parseInt(hex.substring(0, 2), 16);
    const g   = parseInt(hex.substring(2, 4), 16);
    const b   = parseInt(hex.substring(4, 6), 16);
    root.style.setProperty("--theme-accent-rgb", `${r},${g},${b}`);

    return () => {
      // Restore whatever was set before this hook ran.
      // If the property had no inline style (controlled by CSS), removing it
      // lets the CSS cascade take over again — which is the correct behaviour.
      if (origAccent) {
        root.style.setProperty("--theme-accent", origAccent);
      } else {
        root.style.removeProperty("--theme-accent");
      }
      if (origAccentRgb) {
        root.style.setProperty("--theme-accent-rgb", origAccentRgb);
      } else {
        root.style.removeProperty("--theme-accent-rgb");
      }
    };
  }, [teamAbbr]);
}

// ── Route metadata ────────────────────────────────────────────────
const ROUTE_META = {
  "/":          { title: "Dashboard",   tab: "dashboard"  },
  "/scores":    { title: "Scores",      tab: "scores"     },
  "/standings": { title: "Standings",   tab: "standings"  },
  "/players":   { title: "Players",     tab: "players"    },
  "/betting":   { title: "Betting",     tab: "betting"    },
  "/tracker":   { title: "Bet Tracker", tab: "tracker"    },
  "/analytics": { title: "Analytics",   tab: "analytics"  },
  "/compare":   { title: "Compare",     tab: "compare"    },
  "/paper":     { title: "Leaderboard", tab: "paper"      },
  "/settings":  { title: "Settings",    tab: "settings"   },
};

const SHORTCUT_ROUTES = {
  d: "/", s: "/scores", l: "/standings", p: "/players",
  b: "/betting", t: "/tracker", a: "/analytics", c: "/compare", h: "/paper", g: "/settings",
};

const TAB_ROUTES = {
  dashboard: "/", scores: "/scores", standings: "/standings",
  players: "/players", betting: "/betting", tracker: "/tracker",
  analytics: "/analytics", compare: "/compare", paper: "/paper",
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
// FIX G3b: clearTimeout in componentWillUnmount prevents setState on an
// unmounted component.
//
// Before: handleRetry used setTimeout(() => setState(...), 400). If the
// user navigated away during the 400 ms window (unmounting the ErrorBoundary),
// the timeout still fired and called setState on an unmounted class component.
// React 18 suppresses the console warning for class components but the
// callback still ran, creating a subtle memory leak and potential stale
// closure executing against a detached component tree.
//
// After: the timer ID is stored in this._retryTimer so componentWillUnmount
// can cancel it before it fires.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state       = { hasError: false, error: null, retrying: false };
    this._retryTimer = null; // FIX G3b: stored so we can cancel on unmount
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error, retrying: false };
  }

  componentDidCatch(e, info) {
    console.error("[PlusMinus]", e, info);
  }

  // FIX G3b: cancel any pending retry timer when the boundary unmounts.
  componentWillUnmount() {
    if (this._retryTimer !== null) {
      clearTimeout(this._retryTimer);
      this._retryTimer = null;
    }
  }

  handleRetry = () => {
    this.setState({ retrying: true });
    invalidateErroredQueries(this.props.queryClient);

    // FIX G3b: store the ID so componentWillUnmount can cancel it.
    this._retryTimer = setTimeout(() => {
      this._retryTimer = null;
      this.setState({ hasError: false, error: null, retrying: false });
    }, 400);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="pm-card p-8 text-center mt-6">
          <div className="text-2xl mb-2">⚠️</div>
          <div className="text-pitch-200 font-medium mb-1">Something went wrong</div>
          <div className="text-pitch-500 text-sm mb-4 font-mono">
            {this.state.error?.message}
          </div>
          <button
            onClick={this.handleRetry}
            disabled={this.state.retrying}
            className="pm-btn text-sm"
          >
            {this.state.retrying ? "Retrying…" : "Try again"}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Inner app ─────────────────────────────────────────────────────
function AppInner() {
  const navigate    = useNavigate();
  const location    = useLocation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");

  // SSE: Real-time odds and alerts
  useSSE({
    onAlert: (alert) => {
      // Browser notification handled inside useSSE.
    }
  });

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
    <div className="min-h-screen">
      <SignedOut>
        <main role="main" className="min-h-screen flex items-center justify-center">
          <div className="text-center mb-8">
            <div className="text-5xl font-bold tracking-tight text-accent mb-2">±</div>
            <div className="text-2xl font-bold tracking-tight text-pitch-50 mb-1 uppercase">PLUSMINUS</div>
            <div className="text-[11px] font-semibold tracking-widest text-pitch-500 uppercase mb-8">NBA Analytics</div>
            <SignIn routing="hash" />
          </div>
        </main>
      </SignedOut>

      <SignedIn>
        <TooltipProvider>
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
              <ErrorBoundary queryClient={queryClient}>
                <Suspense fallback={<PageSkeleton />}>
                  <Routes>
                    <Route path="/"           element={<Dashboard onNavigate={handleTabChange} />} />
                    <Route path="/scores"     element={<Scores />} />
                    <Route path="/standings"  element={<Standings />} />
                    <Route path="/players"    element={<Players initialQuery={searchQuery} />} />
                    <Route path="/betting"    element={<Betting />} />
                    <Route path="/tracker"    element={<BetTracker />} />
                    <Route path="/analytics"  element={<Analytics />} />
                    <Route path="/compare"    element={<HeadToHead />} />
                    <Route path="/paper"      element={<PaperBetting />} />
                    <Route path="/settings"   element={<WebhookSettings />} />
                    <Route path="/team/:abbr" element={<TeamDetail />} />
                    <Route path="*"           element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>

        <ToastContainer />
        <div className="hidden sm:block fixed bottom-3 right-4 z-10 pointer-events-none select-none">
          <div className="text-[9px] text-pitch-700 font-semibold uppercase tracking-widest">
            D·S·L·P·B·T·A·C &nbsp;shortcuts &nbsp;|&nbsp; / &nbsp;search
          </div>
        </div>
        </TooltipProvider>
      </SignedIn>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppInner />
    </BrowserRouter>
  );
}
