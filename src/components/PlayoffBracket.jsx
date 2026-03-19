// ─── PlayoffBracket.jsx ───────────────────────────────────────
// Visual SVG bracket derived from Monte Carlo playoff sim data.
// Shows the most likely bracket path — highest champPct team per
// seed position in each round. Hover a team to see their full odds.
//
// Layout: East bracket (left) → Finals (center) ← West bracket (right)
// Each column = one round. Lines connect seed matchups.

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TEAM_COLORS, TEAM_NAMES } from "../data";

// ── Constants ─────────────────────────────────────────────────
const SLOT_H = 52;   // height per team slot (px)
const SLOT_W = 130;  // width of team name box (px)
const COL_GAP = 80;   // gap between rounds (px)
const PAD_X = 16;   // horizontal padding
const PAD_Y = 24;   // vertical padding

// Round labels
const ROUND_LABELS = ["Play-in", "Round 1", "Conf Semi", "Conf Final", "Finals"];

// ── Build bracket structure from sim data ─────────────────────
// Returns structured bracket: { east, west } each with rounds array.
// Each round is an array of matchups: { topTeam, botTeam, winner, topPct, botPct }
function buildBracket(simData) {
    if (!simData || simData.length === 0) return null;

    const eastTeams = simData.filter(t => t.conf === "East").sort((a, b) => a.seed - b.seed);
    const westTeams = simData.filter(t => t.conf === "West").sort((a, b) => a.seed - b.seed);

    // Build one conference bracket
    // seeds: [1,2,3,4,5,6] direct + [pi7,pi8] from play-in
    // matchups: 1v8, 4v5, 3v6, 2v7
    function buildConf(teams) {
        if (teams.length < 8) return null;

        // Play-in: seeds 7-10
        const playInTeams = teams.slice(6, 10);
        const r1Seeds = [
            teams[0], teams[1], teams[2], teams[3],
            teams[4], teams[5], teams[6], teams[7],
        ];

        // Round 1 matchups by NBA bracket format: 1v8, 4v5, 3v6, 2v7
        const r1Pairs = [[0, 7], [3, 4], [2, 5], [1, 6]]; // indices into r1Seeds

        const r1Matchups = r1Pairs.map(([ai, bi]) => {
            const a = r1Seeds[ai];
            const b = r1Seeds[bi];
            // Winner = higher champPct weighted by round advancement
            const winner = (a?.r2Pct ?? 0) >= (b?.r2Pct ?? 0) ? a : b;
            return {
                top: a, bot: b, winner,
                topPct: a?.r1Pct?.toFixed(0) ?? "—",
                botPct: b?.r1Pct?.toFixed(0) ?? "—",
                winPct: winner === a
                    ? (a?.r2Pct ?? 0).toFixed(0)
                    : (b?.r2Pct ?? 0).toFixed(0),
            };
        });

        // Semi matchups: winners of (1v8 vs 4v5) and (3v6 vs 2v7)
        const semiMatchups = [
            { top: r1Matchups[0].winner, bot: r1Matchups[1].winner },
            { top: r1Matchups[2].winner, bot: r1Matchups[3].winner },
        ].map(({ top, bot }) => {
            const winner = (top?.confPct ?? 0) >= (bot?.confPct ?? 0) ? top : bot;
            return {
                top, bot, winner,
                topPct: top?.r2Pct?.toFixed(0) ?? "—",
                botPct: bot?.r2Pct?.toFixed(0) ?? "—",
                winPct: (winner?.confPct ?? 0).toFixed(0),
            };
        });

        // Conf final
        const cfTop = semiMatchups[0].winner;
        const cfBot = semiMatchups[1].winner;
        const cfWinner = (cfTop?.finalsPct ?? 0) >= (cfBot?.finalsPct ?? 0) ? cfTop : cfBot;
        const confFinal = {
            top: cfTop, bot: cfBot, winner: cfWinner,
            topPct: cfTop?.confPct?.toFixed(0) ?? "—",
            botPct: cfBot?.confPct?.toFixed(0) ?? "—",
            winPct: (cfWinner?.finalsPct ?? 0).toFixed(0),
        };

        return { r1: r1Matchups, semi: semiMatchups, confFinal, champion: cfWinner, playIn: playInTeams };
    }

    const east = buildConf(eastTeams);
    const west = buildConf(westTeams);
    if (!east || !west) return null;

    // Finals
    const finTop = east.champion;
    const finBot = west.champion;
    const finWinner = (finTop?.champPct ?? 0) >= (finBot?.champPct ?? 0) ? finTop : finBot;

    return {
        east, west,
        finals: {
            top: finTop, bot: finBot, winner: finWinner,
            topPct: finTop?.finalsPct?.toFixed(0) ?? "—",
            botPct: finBot?.finalsPct?.toFixed(0) ?? "—",
        },
    };
}

// ── Team box ──────────────────────────────────────────────────
function TeamBox({ team, x, y, w, h, isWinner, isHighlighted, onHover, seed, showSeed = true }) {
    if (!team) return null;
    const color = TEAM_COLORS[team.team] || "#546480";
    const baseOpacity = isWinner ? 1 : 0.5;

    return (
        <g
            onMouseEnter={() => onHover?.(team)}
            onMouseLeave={() => onHover?.(null)}
            style={{ cursor: "pointer" }}
        >
            {/* Background */}
            <rect
                x={x} y={y} width={w} height={h}
                rx={5} ry={5}
                fill={isHighlighted ? `${color}30` : "#1a2233"}
                stroke={isHighlighted ? color : isWinner ? `${color}60` : "#2e3a50"}
                strokeWidth={isHighlighted ? 1.5 : 1}
                opacity={baseOpacity}
            />
            {/* Color accent bar */}
            <rect
                x={x} y={y} width={3} height={h}
                rx={2} ry={2}
                fill={color}
                opacity={baseOpacity * 0.9}
            />
            {/* Seed badge */}
            {showSeed && (
                <text
                    x={x + 10} y={y + h / 2 + 1}
                    fontSize={8} fill="#546480"
                    textAnchor="middle" dominantBaseline="middle"
                    fontFamily="DM Mono, monospace"
                    opacity={baseOpacity}
                >
                    {team.isPlayIn ? `PI` : team.seed}
                </text>
            )}
            {/* Team abbr */}
            <text
                x={x + 22} y={y + h / 2}
                fontSize={11} fill={isWinner ? "#e8edf5" : "#7d91ab"}
                textAnchor="start" dominantBaseline="middle"
                fontFamily="Bebas Neue, sans-serif"
                letterSpacing={1.5}
                opacity={baseOpacity}
            >
                {team.team}
            </text>
            {/* Champ % */}
            <text
                x={x + w - 6} y={y + h / 2}
                fontSize={9} fill={isWinner ? color : "#546480"}
                textAnchor="end" dominantBaseline="middle"
                fontFamily="DM Mono, monospace"
                opacity={baseOpacity}
            >
                {team.champPct?.toFixed(0)}%
            </text>
        </g>
    );
}

// ── Connector line between rounds ─────────────────────────────
function Connector({ x1, y1, x2, y2, color = "#2e3a50", opacity = 0.6 }) {
    const mx = (x1 + x2) / 2;
    return (
        <path
            d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
            fill="none"
            stroke={color}
            strokeWidth={1}
            opacity={opacity}
        />
    );
}

// ── Bracket column (one conference, one round) ─────────────────
function BracketColumn({ matchups, xStart, yStart, boxW, boxH, gap, flip = false, hovered, onHover, roundLabel }) {
    const slots = [];
    const connectors = [];
    let y = yStart;

    matchups.forEach((m, mi) => {
        const topY = y;
        const botY = y + gap + boxH;
        const isTopWinner = m.winner?.team === m.top?.team;
        const isTopHovered = hovered?.team === m.top?.team;
        const isBotHovered = hovered?.team === m.bot?.team;

        // Bracket line connecting the two slots to the winner
        const midY = topY + boxH / 2 + gap / 2 + boxH / 2;
        const lineX = flip ? xStart - 1 : xStart + boxW + 1;

        slots.push(
            <TeamBox key={`${mi}-top`}
                team={m.top} x={xStart} y={topY} w={boxW} h={boxH}
                isWinner={isTopWinner} isHighlighted={isTopHovered}
                onHover={onHover} seed={m.top?.seed} />,
            <TeamBox key={`${mi}-bot`}
                team={m.bot} x={xStart} y={botY} w={boxW} h={boxH}
                isWinner={!isTopWinner} isHighlighted={isBotHovered}
                onHover={onHover} seed={m.bot?.seed} />
        );

        // Bracket join line
        const winColor = TEAM_COLORS[m.winner?.team] || "#2e3a50";
        connectors.push(
            <line key={`v-${mi}`}
                x1={lineX} y1={topY + boxH / 2}
                x2={lineX} y2={botY + boxH / 2}
                stroke="#2e3a50" strokeWidth={1} />,
            <line key={`h-${mi}`}
                x1={lineX} y1={midY}
                x2={flip ? lineX - COL_GAP / 2 : lineX + COL_GAP / 2}
                y2={midY}
                stroke={winColor} strokeWidth={1.5} strokeOpacity={0.7} />
        );

        y = botY + boxH + gap * 2;
    });

    return <>{slots}{connectors}</>;
}

// ── Tooltip overlay ───────────────────────────────────────────
function BracketTooltip({ team, x, y }) {
    if (!team) return null;
    const color = TEAM_COLORS[team.team] || "#546480";
    const rows = [
        { label: "Playoffs", val: `${team.r1Pct}%` },
        { label: "Round 2", val: `${team.r2Pct}%` },
        { label: "Conf Final", val: `${team.confPct}%` },
        { label: "Finals", val: `${team.finalsPct}%` },
        { label: "Champion", val: `${team.champPct}%` },
    ];
    const tw = 140, th = 18 + rows.length * 18 + 10;

    return (
        <g style={{ pointerEvents: "none" }}>
            <rect x={x} y={y} width={tw} height={th} rx={6} ry={6}
                fill="#0d1320" stroke={color} strokeWidth={1} opacity={0.97} />
            <text x={x + 10} y={y + 14} fontSize={10} fill={color}
                fontFamily="Bebas Neue, sans-serif" letterSpacing={1.5}>
                {team.team} — {TEAM_NAMES[team.team] || ""}
            </text>
            {rows.map((r, i) => (
                <g key={r.label}>
                    <text x={x + 10} y={y + 28 + i * 17} fontSize={9} fill="#7d91ab" fontFamily="DM Sans, sans-serif">{r.label}</text>
                    <text x={x + tw - 10} y={y + 28 + i * 17} fontSize={9} fill="#c8d5e8"
                        textAnchor="end" fontFamily="DM Mono, monospace">{r.val}</text>
                </g>
            ))}
        </g>
    );
}

// ── Main export ───────────────────────────────────────────────
export default function PlayoffBracket({ simData }) {
    const [hovered, setHovered] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

    const bracket = useMemo(() => buildBracket(simData), [simData]);

    if (!bracket) {
        return (
            <div className="pm-card p-8 text-center text-pitch-500 text-sm">
                Bracket unavailable — run the simulation first.
            </div>
        );
    }

    // ── Layout math ───────────────────────────────────────────
    // East side: rounds go left→right
    // West side: rounds go right→left (mirrored)
    // Finals in the center

    const BOX_W = SLOT_W;
    const BOX_H = 32;
    const R1_GAP = 8;    // gap between matchup slots within a pair
    const M_GAP = 20;   // gap between matchup pairs

    // Round 1: 4 matchups × 2 teams = 8 slots
    // Each matchup occupies: 2*BOX_H + R1_GAP, then M_GAP between pairs
    const pairH = 2 * BOX_H + R1_GAP;

    // Total height for R1 column (4 pairs)
    const r1H = 4 * pairH + 3 * M_GAP;

    // Semi: 2 matchups — each centered over 2 R1 pairs
    const semiPairH = 2 * (pairH + M_GAP) - M_GAP;

    // Conf final: 1 matchup — centered over 2 semi pairs
    const cfH = 2 * semiPairH + M_GAP;

    const SVG_H = r1H + PAD_Y * 2 + 40; // +40 for round labels
    const EAST_R1_X = PAD_X;
    const EAST_SEMI_X = EAST_R1_X + BOX_W + COL_GAP;
    const EAST_CF_X = EAST_SEMI_X + BOX_W + COL_GAP;
    const FINALS_X = EAST_CF_X + BOX_W + COL_GAP;
    const WEST_CF_X = FINALS_X + BOX_W + COL_GAP;
    const WEST_SEMI_X = WEST_CF_X + BOX_W + COL_GAP;
    const WEST_R1_X = WEST_SEMI_X + BOX_W + COL_GAP;
    const SVG_W = WEST_R1_X + BOX_W + PAD_X;

    const LABEL_Y = PAD_Y - 10;
    const R1_Y = PAD_Y + 30;

    // Build Y positions for each round
    // R1: 4 pairs
    const r1Ys = [0, 1, 2, 3].map(i => R1_Y + i * (pairH + M_GAP));

    // Semi: centered over pairs 0+1, 2+3
    const semiYs = [0, 1].map(i => {
        const topPairY = r1Ys[i * 2];
        const botPairY = r1Ys[i * 2 + 1];
        const spanCenter = (topPairY + botPairY + pairH) / 2;
        return spanCenter - pairH / 2;
    });

    // CF: centered over both semi pairs
    const cfY = (semiYs[0] + semiYs[1] + pairH) / 2 - pairH / 2;

    // Finals: centered vertically
    const finalsY = cfY;

    // Build matchup data with Y positions
    function withY(matchups, ys) {
        return matchups.map((m, i) => ({ ...m, y: ys[i] }));
    }

    const eastR1 = withY(bracket.east.r1, r1Ys);
    const eastSemi = withY(bracket.east.semi, semiYs);
    const eastCF = [{ ...bracket.east.confFinal, y: cfY }];
    const westR1 = withY(bracket.west.r1, r1Ys);
    const westSemi = withY(bracket.west.semi, semiYs);
    const westCF = [{ ...bracket.west.confFinal, y: cfY }];

    const handleHover = (team, evt) => {
        setHovered(team);
        if (team && evt) {
            const svgEl = evt.currentTarget?.closest("svg");
            if (svgEl) {
                const rect = svgEl.getBoundingClientRect();
                // position tooltip — try right side, flip left if too close to edge
                const rawX = evt.clientX - rect.left + 8;
                const rawY = evt.clientY - rect.top - 40;
                setTooltipPos({
                    x: rawX + 150 > SVG_W ? rawX - 160 : rawX,
                    y: Math.max(0, rawY),
                });
            }
        }
    };

    const renderMatchupColumn = (matchups, xStart, boxW, boxH, gap) =>
        matchups.map((m, mi) => {
            const topY = m.y;
            const botY = m.y + boxH + gap;
            const isTopWin = m.winner?.team === m.top?.team;
            const winColor = TEAM_COLORS[m.winner?.team] || "#2e3a50";

            return (
                <g key={mi}>
                    <TeamBox team={m.top} x={xStart} y={topY} w={boxW} h={boxH}
                        isWinner={isTopWin} isHighlighted={hovered?.team === m.top?.team}
                        onHover={(t) => handleHover(t)} />
                    <TeamBox team={m.bot} x={xStart} y={botY} w={boxW} h={boxH}
                        isWinner={!isTopWin} isHighlighted={hovered?.team === m.bot?.team}
                        onHover={(t) => handleHover(t)} />
                    {/* vertical bracket line */}
                    <line x1={xStart + boxW} y1={topY + boxH / 2}
                        x2={xStart + boxW} y2={botY + boxH / 2}
                        stroke="#2e3a50" strokeWidth={1} />
                    {/* horizontal winner line */}
                    <line x1={xStart + boxW} y1={(topY + botY + boxH) / 2}
                        x2={xStart + boxW + COL_GAP / 2} y2={(topY + botY + boxH) / 2}
                        stroke={winColor} strokeWidth={1.5} strokeOpacity={0.6} />
                </g>
            );
        });

    const renderWestColumn = (matchups, xStart, boxW, boxH, gap) =>
        matchups.map((m, mi) => {
            const topY = m.y;
            const botY = m.y + boxH + gap;
            const isTopWin = m.winner?.team === m.top?.team;
            const winColor = TEAM_COLORS[m.winner?.team] || "#2e3a50";

            return (
                <g key={mi}>
                    <TeamBox team={m.top} x={xStart} y={topY} w={boxW} h={boxH}
                        isWinner={isTopWin} isHighlighted={hovered?.team === m.top?.team}
                        onHover={(t) => handleHover(t)} />
                    <TeamBox team={m.bot} x={xStart} y={botY} w={boxW} h={boxH}
                        isWinner={!isTopWin} isHighlighted={hovered?.team === m.bot?.team}
                        onHover={(t) => handleHover(t)} />
                    <line x1={xStart} y1={topY + boxH / 2}
                        x2={xStart} y2={botY + boxH / 2}
                        stroke="#2e3a50" strokeWidth={1} />
                    <line x1={xStart} y1={(topY + botY + boxH) / 2}
                        x2={xStart - COL_GAP / 2} y2={(topY + botY + boxH) / 2}
                        stroke={winColor} strokeWidth={1.5} strokeOpacity={0.6} />
                </g>
            );
        });

    return (
        <div className="pm-card p-3 overflow-x-auto">
            <div className="pm-label mb-2 flex items-center justify-between">
                <span>Most Likely Bracket Path</span>
                <span className="text-[10px] text-pitch-600 font-normal">Hover any team for full odds breakdown</span>
            </div>

            <svg
                width={SVG_W}
                height={SVG_H}
                viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                style={{ minWidth: SVG_W, display: "block" }}
                onMouseMove={(e) => {
                    if (hovered) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const rawX = e.clientX - rect.left + 8;
                        const rawY = e.clientY - rect.top - 40;
                        setTooltipPos({
                            x: rawX + 150 > SVG_W ? rawX - 160 : rawX,
                            y: Math.max(0, rawY),
                        });
                    }
                }}
            >
                {/* Round labels */}
                {[
                    { label: "EAST R1", x: EAST_R1_X + BOX_W / 2 },
                    { label: "SEMI", x: EAST_SEMI_X + BOX_W / 2 },
                    { label: "CONF FINAL", x: EAST_CF_X + BOX_W / 2 },
                    { label: "FINALS", x: FINALS_X + BOX_W / 2 },
                    { label: "CONF FINAL", x: WEST_CF_X + BOX_W / 2 },
                    { label: "SEMI", x: WEST_SEMI_X + BOX_W / 2 },
                    { label: "WEST R1", x: WEST_R1_X + BOX_W / 2 },
                ].map((l, i) => (
                    <text key={i} x={l.x} y={LABEL_Y}
                        fontSize={8} fill="#546480" textAnchor="middle"
                        fontFamily="DM Mono, monospace" letterSpacing={1}>
                        {l.label}
                    </text>
                ))}

                {/* Conference labels */}
                <text x={EAST_R1_X + (EAST_CF_X + BOX_W - EAST_R1_X) / 2} y={LABEL_Y - 12}
                    fontSize={9} fill="#7d91ab" textAnchor="middle"
                    fontFamily="Bebas Neue, sans-serif" letterSpacing={2}>
                    EASTERN CONFERENCE
                </text>
                <text x={WEST_CF_X + (WEST_R1_X + BOX_W - WEST_CF_X) / 2} y={LABEL_Y - 12}
                    fontSize={9} fill="#7d91ab" textAnchor="middle"
                    fontFamily="Bebas Neue, sans-serif" letterSpacing={2}>
                    WESTERN CONFERENCE
                </text>

                {/* East bracket */}
                {renderMatchupColumn(eastR1, EAST_R1_X, BOX_W, BOX_H, R1_GAP)}
                {renderMatchupColumn(eastSemi, EAST_SEMI_X, BOX_W, BOX_H, R1_GAP)}
                {renderMatchupColumn(eastCF, EAST_CF_X, BOX_W, BOX_H, R1_GAP)}

                {/* West bracket (mirrored) */}
                {renderWestColumn(westR1, WEST_R1_X, BOX_W, BOX_H, R1_GAP)}
                {renderWestColumn(westSemi, WEST_SEMI_X, BOX_W, BOX_H, R1_GAP)}
                {renderWestColumn(westCF, WEST_CF_X, BOX_W, BOX_H, R1_GAP)}

                {/* Finals */}
                {(() => {
                    const f = bracket.finals;
                    const topY = finalsY;
                    const botY = finalsY + BOX_H + R1_GAP;
                    const isTopWin = f.winner?.team === f.top?.team;
                    const winColor = TEAM_COLORS[f.winner?.team] || "#00d4aa";
                    return (
                        <g>
                            <TeamBox team={f.top} x={FINALS_X} y={topY} w={BOX_W} h={BOX_H}
                                isWinner={isTopWin} isHighlighted={hovered?.team === f.top?.team}
                                onHover={handleHover} />
                            <TeamBox team={f.bot} x={FINALS_X} y={botY} w={BOX_W} h={BOX_H}
                                isWinner={!isTopWin} isHighlighted={hovered?.team === f.bot?.team}
                                onHover={handleHover} />
                            {/* Trophy icon area */}
                            <text x={FINALS_X + BOX_W / 2} y={topY - 8}
                                fontSize={14} textAnchor="middle">🏆</text>
                            {/* Champion label */}
                            <text x={FINALS_X + BOX_W / 2} y={botY + BOX_H + 14}
                                fontSize={8} fill={winColor} textAnchor="middle"
                                fontFamily="DM Mono, monospace" letterSpacing={1}>
                                {f.winner?.champPct?.toFixed(0)}% CHAMP
                            </text>
                        </g>
                    );
                })()}

                {/* Hover tooltip */}
                {hovered && (
                    <BracketTooltip team={hovered} x={tooltipPos.x} y={tooltipPos.y} />
                )}
            </svg>

            <div className="mt-2 flex flex-wrap gap-4 text-[9px] text-pitch-600 px-1">
                <span>Bracket shows most likely advancement path based on Monte Carlo sim</span>
                <span className="ml-auto">% shown = championship probability</span>
            </div>
        </div>
    );
}