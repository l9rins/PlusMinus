import { motion } from "framer-motion";
import { useTeamLineups } from "../api";
import { RowSkeleton, ErrorState } from "./ui";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.025 } } };
const item      = { hidden: { opacity: 0, x: -4 }, show: { opacity: 1, x: 0 } };

function NetBar({ value, range = 20 }) {
  const pct  = Math.min(100, Math.max(0, ((value + range) / (range * 2)) * 100));
  const color = value >= 8  ? "#22c55e"
              : value >= 3  ? "#4ade80"
              : value >= 0  ? "#facc15"
              : value >= -5 ? "#f97316"
              :               "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-pitch-700 rounded-full overflow-hidden relative flex-shrink-0">
        {/* center line */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-pitch-500 opacity-40" />
        <motion.div
          className="absolute inset-y-0 rounded-full"
          style={{ background: color, left: value >= 0 ? "50%" : `${pct}%`, width: `${Math.abs(value / range) * 50}%` }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <span className={`font-mono text-[11px] tabular-nums font-semibold flex-shrink-0
        ${value >= 8 ? "text-tier-elite" : value >= 3 ? "text-tier-good"
        : value >= 0 ? "text-tier-avg"   : value >= -5 ? "text-tier-poor" : "text-tier-bad"}`}>
        {value > 0 ? "+" : ""}{value}
      </span>
    </div>
  );
}

export default function LineupTable({ teamId, teamColor = "#546480" }) {
  const { data, isLoading, isError, refetch } = useTeamLineups(teamId);

  if (isLoading) return <div className="pm-card p-4"><RowSkeleton rows={8} /></div>;
  if (isError)   return <ErrorState message="Couldn't load lineup data." onRetry={refetch} />;
  if (!data?.length) return (
    <div className="pm-card p-6 text-center text-[11px] text-pitch-500">
      No lineup data available yet this season.
    </div>
  );

  const best  = data.slice(0, 10);
  const worst = [...data].sort((a, b) => a.netRtg - b.netRtg).slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Best lineups */}
      <div className="pm-card overflow-x-auto">
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="pm-label">Best 5-man lineups</div>
          <div className="text-[9px] text-pitch-600">per 100 possessions · min 5 min</div>
        </div>
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="border-b border-pitch-650">
              {["Lineup", "MIN", "NET RTG", "O-RTG", "D-RTG", "PACE"].map(h => (
                <th key={h} className="px-3 py-2 text-left pm-label text-[10px]">{h}</th>
              ))}
            </tr>
          </thead>
          <motion.tbody variants={container} initial="hidden" animate="show">
            {best.map((l, i) => (
              <motion.tr key={l.lineup} variants={item}
                className="border-b border-pitch-700/60 hover:bg-pitch-750 transition-colors">
                <td className="px-3 py-2.5 max-w-[240px]">
                  <div className="text-[10px] text-pitch-300 leading-tight truncate" title={l.lineup}>
                    {l.lineup.split(" - ").map((name, j) => (
                      <span key={j}>
                        <span className={j === 0 ? "text-pitch-100 font-medium" : ""}>{name.split(" ").at(-1)}</span>
                        {j < l.lineup.split(" - ").length - 1 && <span className="text-pitch-600"> · </span>}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2.5 font-mono text-[10px] text-pitch-500 tabular-nums">{l.min}</td>
                <td className="px-3 py-2.5"><NetBar value={l.netRtg} /></td>
                <td className="px-3 py-2.5 font-mono text-[10px] text-win tabular-nums">{l.ortg}</td>
                <td className="px-3 py-2.5 font-mono text-[10px] text-pitch-400 tabular-nums">{l.drtg}</td>
                <td className="px-3 py-2.5 font-mono text-[10px] text-pitch-500 tabular-nums">{l.pace}</td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      </div>

      {/* Worst lineups */}
      <div className="pm-card overflow-x-auto">
        <div className="px-4 pt-3 pb-2">
          <div className="pm-label">Worst 5-man lineups</div>
        </div>
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="border-b border-pitch-650">
              {["Lineup", "MIN", "NET RTG", "O-RTG", "D-RTG"].map(h => (
                <th key={h} className="px-3 py-2 text-left pm-label text-[10px]">{h}</th>
              ))}
            </tr>
          </thead>
          <motion.tbody variants={container} initial="hidden" animate="show">
            {worst.map((l, i) => (
              <motion.tr key={l.lineup} variants={item}
                className="border-b border-pitch-700/60 hover:bg-pitch-750 transition-colors">
                <td className="px-3 py-2.5 max-w-[240px]">
                  <div className="text-[10px] text-pitch-300 leading-tight truncate" title={l.lineup}>
                    {l.lineup.split(" - ").map((name, j) => (
                      <span key={j}>
                        <span>{name.split(" ").at(-1)}</span>
                        {j < l.lineup.split(" - ").length - 1 && <span className="text-pitch-600"> · </span>}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2.5 font-mono text-[10px] text-pitch-500 tabular-nums">{l.min}</td>
                <td className="px-3 py-2.5"><NetBar value={l.netRtg} /></td>
                <td className="px-3 py-2.5 font-mono text-[10px] text-pitch-400 tabular-nums">{l.ortg}</td>
                <td className={`px-3 py-2.5 font-mono text-[10px]
                  ${l.drtg <= 105 ? "text-win" : l.drtg >= 118 ? "text-loss" : "text-pitch-400"} tabular-nums`}>
                  {l.drtg}
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      </div>
    </div>
  );
}
