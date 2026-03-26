import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Info, BarChartHorizontal } from "lucide-react";

export default function RefCallout({ matchup }) {
  const { data, isLoading } = useQuery({
    queryKey: ["nba", "refs"],
    queryFn: async () => {
      const res = await fetch("/api/refs");
      if (!res.ok) throw new Error("Refs unavailable");
      return res.json();
    },
    staleTime: 1000 * 60 * 60 * 2,
  });

  if (isLoading || !data) return null;

  const game = data.games.find(g => g.matchup === matchup);
  if (!game) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mt-3 pm-card p-3 border-l-2 bg-pitch-800/80 border-l-accent/40"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 pm-label text-[10px]">
          <BarChartHorizontal size={10} className="text-accent" />
          Referee Crew Trends
        </div>
        <div className="text-[9px] text-pitch-600 font-bold uppercase tracking-tight">
          Last 50 games {data.mock && "· Mock Data"}
        </div>
      </div>
      {data.mock && (
        <p className="text-[10px] text-win/60 mb-2 italic">
          ⚠ Live ref data unavailable — showing sample assignments
        </p>
      )}

      <div className="space-y-1.5">
        {game.crew.map((ref, idx) => {
          const trend = data.trends[ref];
          return (
            <div key={idx} className="flex items-center justify-between">
              <span className="text-[11px] text-pitch-300 font-medium">
                {ref}
              </span>
              {trend ? (
                <div className="flex gap-2">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter
                    ${trend.favoring === "Away" ? "text-win bg-win/8" :
                    trend.favoring === "Home" ? "text-loss bg-loss/8" : "text-pitch-500 bg-pitch-750"}`}>
                    Fav: {trend.favoring}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter
                    ${trend.overRate > "55%"  ? "text-win bg-win/8" :
                    trend.overRate < "45%"  ? "text-loss bg-loss/8" : "text-pitch-500 bg-pitch-750"}`}>
                    Over: {trend.overRate}
                  </span>
                </div>
              ) : (
                <span className="text-[9px] text-pitch-600">No trend data</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2.5 pt-2 border-t border-pitch-700/50 flex items-center gap-1.5">
        <Info size={9} className="text-pitch-600" />
        <span className="text-[9px] leading-tight text-pitch-500 italic">
          High-foul ref crews typically favor underdogs (@ {matchup.split(" @ ")[0]}) due to game-pacing impact.
        </span>
      </div>
    </motion.div>
  );
}
