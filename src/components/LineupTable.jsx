import { motion } from "framer-motion";
import { useTeamLineups } from "../api";
import { RowSkeleton, ErrorState, AnimatedNumber } from "./ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.025 } } };
const item      = { hidden: { opacity: 0, y: 4 }, show: { opacity: 1, y: 0 } };

function NetBar({ value, range = 20 }) {
  const pct  = Math.min(100, Math.max(0, ((value + range) / (range * 2)) * 100));
  const color = value >= 8  ? "#22c55e"
              : value >= 3  ? "#4ade80"
              : value >= 0  ? "#facc15"
              : value >= -5 ? "#f97316"
              :               "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1 bg-pitch-700 rounded-full overflow-hidden relative flex-shrink-0">
        <div className="absolute inset-y-0 left-1/2 w-px bg-pitch-500 opacity-40" />
        <motion.div
          className="absolute inset-y-0 rounded-full"
          style={{ background: color, left: value >= 0 ? "50%" : `${pct}%`, width: `${Math.abs(value / range) * 50}%` }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <span className={`text-[10px] tabular-nums font-bold flex-shrink-0
        ${value >= 8 ? "text-tier-elite" : value >= 3 ? "text-tier-good"
        : value >= 0 ? "text-tier-avg"   : value >= -5 ? "text-tier-poor" : "text-tier-bad"}`}>
        {value > 0 ? "+" : ""}{value}
      </span>
    </div>
  );
}

function StatHeader({ label, tooltip }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help border-b border-dotted border-pitch-600 pb-0.5">{label}</span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="max-w-[200px] leading-tight text-center">{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default function LineupTable({ teamId }) {
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
    <div className="space-y-6">
      {/* Best lineups */}
      <section>
        <div className="px-1 mb-3 flex items-center justify-between">
          <div className="pm-label text-pitch-200">Best 5-man lineups</div>
          <div className="text-[9px] text-pitch-600 uppercase tracking-wider">min 5 min · per 100 poss</div>
        </div>
        <div className="pm-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[280px]">Lineup</TableHead>
                <TableHead className="text-right"><StatHeader label="MIN" tooltip="Total minutes played together" /></TableHead>
                <TableHead><StatHeader label="NET RTG" tooltip="Point differential per 100 possessions" /></TableHead>
                <TableHead className="text-right text-win"><StatHeader label="O-RTG" tooltip="Offensive Rating: Points scored per 100 poss" /></TableHead>
                <TableHead className="text-right"><StatHeader label="D-RTG" tooltip="Defensive Rating: Points allowed per 100 poss" /></TableHead>
                <TableHead className="text-right"><StatHeader label="PACE" tooltip="Possessions per 48 minutes" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody as={motion.tbody} variants={container} initial="hidden" animate="show">
              {best.map((l) => (
                <TableRow key={l.lineup} as={motion.tr} variants={item} className="group">
                  <TableCell className="max-w-[280px]">
                    <div className="text-[10px] text-pitch-400 group-hover:text-pitch-200 transition-colors leading-tight truncate" title={l.lineup}>
                      {l.lineup.split(" - ").map((name, j) => (
                        <span key={j}>
                          <span className={j === 0 ? "text-pitch-100 font-medium" : ""}>{name.split(" ").at(-1)}</span>
                          {j < 4 && <span className="text-pitch-650 mx-0.5">·</span>}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-pitch-500">{l.min}</TableCell>
                  <TableCell><NetBar value={l.netRtg} /></TableCell>
                  <TableCell className="text-right text-win">
                    <AnimatedNumber value={l.ortg} format={v => v.toFixed(1)} />
                  </TableCell>
                  <TableCell className="text-right text-pitch-400">
                    <AnimatedNumber value={l.drtg} format={v => v.toFixed(1)} />
                  </TableCell>
                  <TableCell className="text-right text-pitch-500">
                    <AnimatedNumber value={l.pace} format={v => v.toFixed(1)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Worst lineups */}
      <section>
        <div className="px-1 mb-3">
          <div className="pm-label text-pitch-200">Worst 5-man lineups</div>
        </div>
        <div className="pm-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[280px]">Lineup</TableHead>
                <TableHead className="text-right">MIN</TableHead>
                <TableHead>NET RTG</TableHead>
                <TableHead className="text-right">O-RTG</TableHead>
                <TableHead className="text-right">D-RTG</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody as={motion.tbody} variants={container} initial="hidden" animate="show">
              {worst.map((l) => (
                <TableRow key={l.lineup} as={motion.tr} variants={item} className="group">
                  <TableCell className="max-w-[280px]">
                    <div className="text-[10px] text-pitch-400 group-hover:text-pitch-200 transition-colors leading-tight truncate" title={l.lineup}>
                      {l.lineup.split(" - ").map((name, j) => (
                        <span key={j}>
                          <span>{name.split(" ").at(-1)}</span>
                          {j < 4 && <span className="text-pitch-650 mx-0.5">·</span>}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-pitch-500">{l.min}</TableCell>
                  <TableCell><NetBar value={l.netRtg} /></TableCell>
                  <TableCell className="text-right text-pitch-400">
                    <AnimatedNumber value={l.ortg} format={v => v.toFixed(1)} />
                  </TableCell>
                  <TableCell className={`text-right ${l.drtg <= 105 ? "text-win" : l.drtg >= 118 ? "text-loss" : "text-pitch-400"}`}>
                    <AnimatedNumber value={l.drtg} format={v => v.toFixed(1)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

