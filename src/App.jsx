import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import TopNav from "./components/TopNav";
import Dashboard from "./components/Dashboard";
import Players from "./components/Players";
import Analytics from "./components/Analytics";
import { Scores, Standings, Betting, BetTracker } from "./components/Views";

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState("");

  const handleTabChange = (newTab, query) => {
    setTab(newTab);
    if (query !== undefined) setSearchQuery(query);
    else setSearchQuery("");
  };

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
      <TopNav activeTab={tab} onTabChange={handleTabChange} />
      <main className="max-w-[1400px] mx-auto px-4 py-5">
        <AnimatePresence mode="wait">
          {renderContent()}
        </AnimatePresence>
      </main>
    </div>
  );
}