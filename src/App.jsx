import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import TopNav from "./components/TopNav";
import Dashboard from "./components/Dashboard";
import Players from "./components/Players";
import { Scores, Standings, Betting, BetTracker } from "./components/Views";

function Placeholder({ title }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
      className="text-center py-20"
    >
      <div className="font-display text-4xl tracking-widest text-pitch-600 mb-3">{title}</div>
      <div className="text-pitch-500 text-sm">Coming soon — hook up the API and build this section out</div>
    </motion.div>
  );
}

export default function App() {
  const [tab, setTab] = useState("dashboard");

  const renderContent = () => {
    switch (tab) {
      case "dashboard": return <Dashboard   key="dashboard" onNavigate={setTab} />;
      case "scores":    return <Scores      key="scores"    />;
      case "standings": return <Standings   key="standings" />;
      case "players":   return <Players     key="players"   />;
      case "betting":   return <Betting     key="betting"   />;
      case "tracker":   return <BetTracker  key="tracker"   />;
      case "analytics": return <Placeholder key="analytics" title="Analytics" />;
      default:
        console.warn("[PlusMinus] Unknown tab:", tab);
        return <Dashboard key="dashboard" onNavigate={setTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-pitch-900">
      <TopNav activeTab={tab} onTabChange={setTab} />
      <main className="max-w-[1400px] mx-auto px-4 py-5">
        <AnimatePresence mode="wait">
          {renderContent()}
        </AnimatePresence>
      </main>
    </div>
  );
}
