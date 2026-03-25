// src/hooks/useInjuries.js
import { useQuery } from "@tanstack/react-query";

export function useInjuries() {
  return useQuery({
    queryKey: ["injuries"],
    queryFn: async () => {
      const res = await fetch("/api/injuries");
      if (!res.ok) throw new Error(`Injuries ${res.status}`);
      return res.json();
    },
    staleTime: 1000 * 60 * 30,       // 30 min
    refetchInterval: 1000 * 60 * 30,
  });
}

// Returns the adjusted Elo for a team given current injury report.
// Pass in the base Elo from api/elo.js and the eloAdjustments map.
export function applyInjuryAdjustment(teamAbbr, baseElo, eloAdjustments = {}) {
  const penalty = eloAdjustments[teamAbbr] ?? 0;
  return Math.round(baseElo - penalty);
}
