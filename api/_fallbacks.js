// api/_fallbacks.js
// Fallback standings used if the live fetch fails or for module init.
export const EAST_STANDINGS = [
    { team: "BOS", pct: 0.8 }, { team: "CLE", pct: 0.75 }, { team: "MIL", pct: 0.6 },
    { team: "NYK", pct: 0.6 }, { team: "PHI", pct: 0.55 }, { team: "MIA", pct: 0.5 },
    { team: "ORL", pct: 0.5 }, { team: "IND", pct: 0.48 }, { team: "CHI", pct: 0.45 },
    { team: "ATL", pct: 0.4 }, { team: "BKN", pct: 0.35 }, { team: "TOR", pct: 0.3 },
    { team: "CHA", pct: 0.25 }, { team: "WAS", pct: 0.2 }, { team: "DET", pct: 0.15 }
];

export const WEST_STANDINGS = [
    { team: "OKC", pct: 0.7 }, { team: "MIN", pct: 0.7 }, { team: "DEN", pct: 0.7 },
    { team: "LAC", pct: 0.6 }, { team: "DAL", pct: 0.6 }, { team: "PHX", pct: 0.55 },
    { team: "NOP", pct: 0.55 }, { team: "LAL", pct: 0.55 }, { team: "SAC", pct: 0.5 },
    { team: "GSW", pct: 0.5 }, { team: "HOU", pct: 0.48 }, { team: "UTA", pct: 0.35 },
    { team: "MEM", pct: 0.3 }, { team: "SAS", pct: 0.25 }, { team: "POR", pct: 0.25 }
];
