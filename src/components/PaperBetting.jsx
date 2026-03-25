// src/components/PaperBetting.jsx
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@clerk/clerk-react";
import { Trophy, TrendingUp, TrendingDown, Coins, RotateCcw, ChevronDown } from "lucide-react";
import { useOdds, useTodayGames, mergeOddsIntoGames } from "../api";
import { oddsToDecimal, calcPL } from "../utils";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

// ── API helpers ───────────────────────────────────────────────
async function apiFetch(path, options, getToken) {
  const token = await getToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Leaderboard row ───────────────────────────────────────────
function LeaderboardRow({ entry, rank, isCurrentUser }) {
  const medal = rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : `#${rank + 1}`;
  const isModel = entry.isModel;
  return (
    <motion.div
      variants={item}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors
        ${isCurrentUser ? "bg-accent/10 border border-accent/20" : "hover:bg-pitch-700"}
        ${isModel ? "border border-pitch-600 bg-pitch-800" : ""}`}
    >
      <span className="w-7 text-center text-sm">{medal}</span>
      <div className="flex-1">
        <div className={`text-sm font-medium ${isModel ? "text-pitch-300" : "text-pitch-100"}`}>
          {entry.displayName}
          {isCurrentUser && <span className="ml-2 text-[10px] text-accent">YOU</span>}
        </div>
        <div className="text-[10px] text-pitch-500">
          {entry.bets} bets · {entry.wins ?? 0}W {entry.losses ?? 0}L
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono font-medium text-pitch-100">{entry.balance?.toFixed(0)} PMC</div>
        <div className={`text-[10px] font-mono ${entry.roi >= 0 ? "text-win" : "text-loss"}`}>
          {entry.roi >= 0 ? "+" : ""}{entry.roi?.toFixed(1)}% ROI
        </div>
      </div>
    </motion.div>
  );
}

// ── Place bet form ────────────────────────────────────────────
function PlaceBetForm({ game, onBet, balance }) {
  const [side, setSide] = useState("away");
  const [stake, setStake] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const odds = side === "away" ? game.awayOdds : game.homeOdds;
  const pick = side === "away" ? game.away : game.home;
  const maxStake = Math.floor(balance * 0.25);
  const potentialWin = stake
    ? +(Number(stake) * (oddsToDecimal(odds) - 1)).toFixed(2)
    : 0;

  const submit = async () => {
    const stakeNum = Number(stake);
    if (!stakeNum || stakeNum < 10) { setError("Min stake: 10 PMC"); return; }
    if (stakeNum > balance) { setError("Insufficient balance"); return; }
    if (stakeNum > maxStake) { setError(`Max: ${maxStake} PMC`); return; }
    setError("");
    setLoading(true);
    try {
      await onBet({ matchup: `${game.away} @ ${game.home}`, pick, side, odds, stake: stakeNum, gameId: game.id });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-pitch-600 space-y-3">
      {/* Side toggle */}
      <div className="flex gap-2">
        {["away", "home"].map(s => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all border
              ${side === s ? "bg-accent/15 text-accent border-accent/30" : "bg-pitch-700 text-pitch-400 border-pitch-600"}`}
          >
            {s === "away" ? game.away : game.home}
            <span className="ml-1.5 font-mono text-[11px] opacity-70">
              {s === "away" ? game.awayOdds : game.homeOdds}
            </span>
          </button>
        ))}
      </div>

      {/* Stake input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="number"
            value={stake}
            onChange={e => setStake(e.target.value)}
            placeholder={`Stake (max ${maxStake})`}
            className="w-full bg-pitch-700 border border-pitch-600 rounded-md px-3 py-1.5 text-sm
                       text-pitch-200 placeholder:text-pitch-500 focus:outline-none focus:border-accent/50"
          />
          {stake && potentialWin > 0 && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-win font-mono">
              +{potentialWin}
            </div>
          )}
        </div>
        <button
          onClick={submit}
          disabled={loading}
          className="px-4 py-1.5 bg-accent/15 text-accent border border-accent/30 rounded-md
                     text-sm font-medium hover:bg-accent/25 transition-colors disabled:opacity-50"
        >
          {loading ? "…" : "Place"}
        </button>
      </div>

      {/* Quick stake buttons */}
      <div className="flex gap-1.5">
        {[25, 50, 100, maxStake].map(v => (
          <button
            key={v}
            onClick={() => setStake(String(Math.min(v, balance)))}
            className="px-2 py-1 rounded text-[10px] bg-pitch-700 text-pitch-400 hover:text-accent
                       border border-pitch-600 hover:border-accent/30 transition-colors"
          >
            {v}
          </button>
        ))}
      </div>

      {error && <div className="text-[11px] text-loss">{error}</div>}
    </div>
  );
}

// ── Game card with embedded bet form ─────────────────────────
function GameCard({ game, onBet, balance, odds }) {
  const [open, setOpen] = useState(false);
  if (game.status !== "scheduled") return null;

  // Merge actual American odds into the card
  const oddsKey = `${game.away}@${game.home}`;
  const rawOdds = odds?.[oddsKey];
  const enriched = {
    ...game,
    awayOdds: rawOdds?.awayOdds ?? -110,
    homeOdds: rawOdds?.homeOdds ?? -110,
  };

  return (
    <motion.div variants={item} className={`pm-tile p-4 ${open ? "pm-accent-border" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 font-display text-xl tracking-wider text-pitch-100">
            <span>{game.away}</span>
            <span className="text-pitch-600 text-sm">@</span>
            <span>{game.home}</span>
          </div>
          <div className="text-[10px] text-pitch-500 mt-0.5">{game.time}</div>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs
                     bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors"
        >
          Bet
          <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <PlaceBetForm game={enriched} onBet={onBet} balance={balance} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function PaperBetting() {
  const { getToken, userId } = useAuth();
  const [tab, setTab] = useState("bet");
  const [bankroll, setBankroll] = useState(null);
  const [myBets, setMyBets] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLb, setLoadingLb] = useState(false);
  const [error, setError] = useState(null);

  const { data: rawGames } = useTodayGames();
  const { data: oddsData } = useOdds();
  const games = useMemo(() => mergeOddsIntoGames(rawGames, oddsData) || [], [rawGames, oddsData]);

  // Load bankroll on mount
  useEffect(() => {
    apiFetch("/api/paper?action=bankroll", {}, getToken)
      .then(d => { setBankroll(d.bankroll); setMyBets(d.bets); })
      .catch(e => setError(e.message));
  }, [getToken]);

  // Load leaderboard when tab opens
  useEffect(() => {
    if (tab !== "leaderboard") return;
    setLoadingLb(true);
    fetch("/api/paper?action=leaderboard")
      .then(r => r.json())
      .then(d => setLeaderboard(d.leaderboard ?? []))
      .finally(() => setLoadingLb(false));
  }, [tab]);

  const placeBet = async (params) => {
    const data = await apiFetch("/api/paper", { method: "POST", body: JSON.stringify({ action: "bet", ...params }) }, getToken);
    setBankroll(data.bankroll);
    setMyBets(prev => [data.bet, ...prev]);
  };

  const handleReset = async () => {
    if (!window.confirm("Reset your bankroll to 1,000 PMC? All bets will be cleared.")) return;
    const data = await apiFetch("/api/paper", { method: "POST", body: JSON.stringify({ action: "reset" }) }, getToken);
    setBankroll(data.bankroll);
    setMyBets([]);
  };

  const pendingBets = myBets.filter(b => b.status === "pending");
  const settledBets = myBets.filter(b => b.status !== "pending");
  const totalPL     = settledBets.reduce((s, b) => s + (b.settledPL ?? 0), 0);
  const winRate     = settledBets.length
    ? ((settledBets.filter(b => b.status === "win").length / settledBets.length) * 100).toFixed(1)
    : null;

  return (
    <motion.div variants={container} initial="hidden" animate="show">
      {/* Balance header */}
      <motion.div variants={item} className="pm-card p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Coins size={16} className="text-accent" />
            <span className="pm-label">Paper Bankroll</span>
          </div>
          <button onClick={handleReset} className="flex items-center gap-1.5 text-[10px] text-pitch-500 hover:text-loss transition-colors">
            <RotateCcw size={10} /> Reset
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Balance", value: bankroll ? `${bankroll.balance.toFixed(0)} PMC` : "—" },
            { label: "Total bets", value: bankroll?.totalBets ?? "—" },
            { label: "Net P&L", value: bankroll ? `${totalPL >= 0 ? "+" : ""}${totalPL.toFixed(0)} PMC` : "—", colored: true, pl: totalPL },
            { label: "Win rate", value: winRate ? `${winRate}%` : "—" },
          ].map(m => (
            <div key={m.label} className="text-center">
              <div className="pm-label mb-1">{m.label}</div>
              <div className={`font-mono font-medium text-xl ${m.colored ? (m.pl >= 0 ? "text-win" : "text-loss") : "text-pitch-50"}`}>
                {m.value}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={item} className="flex gap-2 mb-4">
        {[
          { id: "bet", label: "Tonight's Games" },
          { id: "mybets", label: `My Bets (${pendingBets.length} pending)` },
          { id: "leaderboard", label: "🏆 Leaderboard" },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all border
              ${tab === t.id ? "bg-accent/15 text-accent border-accent/30" : "bg-pitch-800 text-pitch-400 border-pitch-600 hover:border-pitch-500"}`}
          >
            {t.label}
          </button>
        ))}
      </motion.div>

      {/* Bet tab */}
      {tab === "bet" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {games.filter(g => g.status === "scheduled").length === 0 && (
            <div className="col-span-full text-center py-12 text-pitch-500">No games scheduled today.</div>
          )}
          {games.map(g => (
            <GameCard key={g.id} game={g} onBet={placeBet} balance={bankroll?.balance ?? 0} odds={oddsData} />
          ))}
        </div>
      )}

      {/* My bets tab */}
      {tab === "mybets" && (
        <div className="space-y-2">
          {myBets.length === 0 && <div className="text-center py-12 text-pitch-500">No bets placed yet.</div>}
          {myBets.map(b => (
            <motion.div key={b.id} variants={item} className="pm-tile p-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="text-sm font-medium text-pitch-100">{b.matchup}</div>
                <div className="text-[10px] text-pitch-400 mt-0.5">{b.pick} · {b.odds > 0 ? "+" : ""}{b.odds}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm text-pitch-200">{b.stake} PMC</div>
                <span className={`pm-badge border text-[10px] ${
                  b.status === "win" ? "bg-win/10 text-win border-win/20"
                  : b.status === "loss" ? "bg-loss/10 text-loss border-loss/20"
                  : "bg-pitch-700 text-pitch-500 border-pitch-600"
                }`}>
                  {b.status === "pending" ? "PENDING"
                    : b.status === "win" ? `+${b.settledPL} PMC`
                    : `${b.settledPL} PMC`}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Leaderboard tab */}
      {tab === "leaderboard" && (
        <motion.div variants={container} initial="hidden" animate="show" className="pm-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={14} className="text-accent" />
            <span className="pm-label">Man vs. Machine · Season standings</span>
          </div>
          {loadingLb ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-pitch-700 rounded-md animate-pulse" />
            ))}</div>
          ) : (
            <div className="space-y-1">
              {leaderboard.map((entry, i) => (
                <LeaderboardRow
                  key={entry.userId ?? "model"}
                  entry={entry}
                  rank={i}
                  isCurrentUser={entry.userId === userId}
                />
              ))}
              {leaderboard.length === 0 && (
                <div className="text-center py-8 text-pitch-500 text-sm">No bets placed yet — be the first!</div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
