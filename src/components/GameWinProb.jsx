// src/components/GameWinProb.jsx
import { useInjuries, applyInjuryAdjustment } from "../hooks/useInjuries";

export default function GameWinProb({ game, eloMap }) {
  const { data: injuryData } = useInjuries();
  const adj = injuryData?.eloAdjustments ?? {};

  const homeElo = applyInjuryAdjustment(game.home, eloMap[game.home] ?? 1500, adj);
  const awayElo = applyInjuryAdjustment(game.away, eloMap[game.away] ?? 1500, adj);

  // Elo win probability calculation (includes +100 home court advantage)
  const homeWinP = Math.round(1 / (1 + Math.pow(10, (awayElo - (homeElo + 100)) / 400)) * 100);
  const awayWinP = 100 - homeWinP;

  // Show which team has injured players with a penalty > 0
  const homeInjured = injuryData?.byTeam?.[game.home]?.filter(p => p.penalty > 0) ?? [];
  const awayInjured = injuryData?.byTeam?.[game.away]?.filter(p => p.penalty > 0) ?? [];

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[11px]">
        <span className="font-mono text-pitch-200">{awayWinP}%</span>
        <span className="font-mono text-pitch-200">{homeWinP}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-pitch-700 overflow-hidden flex">
        <div className="bg-accent h-full rounded-l-full" style={{ width: `${awayWinP}%` }} />
        <div className="bg-pitch-400 h-full rounded-r-full flex-1" />
      </div>
      
      {/* Injury indicators */}
      {(homeInjured.length > 0 || awayInjured.length > 0) && (
        <div className="flex justify-between text-[9px] text-loss/70">
          <div className="flex flex-wrap gap-1 max-w-[45%]">
            {awayInjured.map(p => (
              <span key={p.name}>{p.name.split(" ")[1]} ({p.status})</span>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 max-w-[45%] justify-end text-right">
            {homeInjured.map(p => (
              <span key={p.name}>{p.name.split(" ")[1]} ({p.status})</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
