// ─── PlusMinus Data ───────────────────────────────────────────
// Static seed data for 2025-26 NBA season (~69 games played).
// Live APIs override these values when keys are present.
// All W/L totals are internally consistent (W + L = games played).

// ─── TEAM COLORS ─────────────────────────────────────────────
// Primary brand colors sourced from official NBA style guides.
export const TEAM_COLORS = {
  ATL: "#E03A3E", BOS: "#007A33", BKN: "#AAAAAA", CHA: "#00788C",
  CHI: "#CE1141", CLE: "#860038", DAL: "#00538C", DEN: "#FEC524",
  DET: "#C8102E", GSW: "#1D428A", HOU: "#CE1141", IND: "#002D62",
  LAC: "#C8102E", LAL: "#FDB927", MEM: "#5D76A9", MIA: "#98002E",
  MIL: "#00471B", MIN: "#236192", NOP: "#0C2340", NYK: "#006BB6",
  OKC: "#007AC1", ORL: "#0077C0", PHI: "#006BB6", PHX: "#E56020",
  POR: "#E03A3E", SAC: "#5A2D81", SAS: "#C4CED4", TOR: "#CE1141",
  UTA: "#002B5C", WAS: "#C8102E",
};

// ─── TEAM NAMES ───────────────────────────────────────────────
export const TEAM_NAMES = {
  ATL: "Hawks", BOS: "Celtics", BKN: "Nets", CHA: "Hornets",
  CHI: "Bulls", CLE: "Cavaliers", DAL: "Mavericks", DEN: "Nuggets",
  DET: "Pistons", GSW: "Warriors", HOU: "Rockets", IND: "Pacers",
  LAC: "Clippers", LAL: "Lakers", MEM: "Grizzlies", MIA: "Heat",
  MIL: "Bucks", MIN: "Timberwolves", NOP: "Pelicans", NYK: "Knicks",
  OKC: "Thunder", ORL: "Magic", PHI: "76ers", PHX: "Suns",
  POR: "Trail Blazers", SAC: "Kings", SAS: "Spurs", TOR: "Raptors",
  UTA: "Jazz", WAS: "Wizards",
};

// ─── PLAYERS ──────────────────────────────────────────────────
// One representative player per team (30 total) for Shot Quality analytics.
// Advanced metrics: PER, TS%, BPM, VORP, O-RTG, D-RTG — 2025-26 projections.
// form: last 5 results newest-first (index 0 = most recent).
export const PLAYERS = [
  // ── Tier 1: MVP Candidates ────────────────────────────────
  { id: 1, name: "Nikola Jokic", pos: "C", team: "DEN", age: 31, pts: 28.4, ast: 9.8, reb: 13.2, per: 31.8, ts: 67.4, bpm: 11.6, vorp: 8.9, ortg: 126, drtg: 112, form: ["W", "L", "W", "W", "W"] },
  { id: 2, name: "Shai Gilgeous-Alexander", pos: "PG", team: "OKC", age: 27, pts: 32.7, ast: 6.2, reb: 5.4, per: 29.1, ts: 63.1, bpm: 9.4, vorp: 7.2, ortg: 124, drtg: 110, form: ["W", "W", "W", "L", "W"] },
  { id: 3, name: "Giannis Antetokounmpo", pos: "PF", team: "MIL", age: 31, pts: 30.1, ast: 6.4, reb: 12.1, per: 29.4, ts: 64.7, bpm: 9.0, vorp: 7.0, ortg: 122, drtg: 109, form: ["L", "W", "W", "W", "L"] },
  { id: 4, name: "Luka Doncic", pos: "PG", team: "DAL", age: 27, pts: 29.6, ast: 9.3, reb: 8.9, per: 27.6, ts: 61.2, bpm: 7.9, vorp: 6.2, ortg: 121, drtg: 113, form: ["W", "W", "L", "W", "W"] },
  { id: 5, name: "Victor Wembanyama", pos: "C", team: "SAS", age: 21, pts: 27.4, ast: 4.9, reb: 11.7, per: 26.5, ts: 59.8, bpm: 8.3, vorp: 6.5, ortg: 118, drtg: 106, form: ["W", "L", "W", "W", "L"] },

  // ── Tier 2: All-Stars ─────────────────────────────────────
  { id: 6, name: "Jayson Tatum", pos: "SF", team: "BOS", age: 28, pts: 27.1, ast: 5.0, reb: 8.3, per: 22.4, ts: 58.9, bpm: 6.4, vorp: 5.2, ortg: 120, drtg: 111, form: ["W", "W", "W", "W", "L"] },
  { id: 7, name: "Jalen Brunson", pos: "PG", team: "NYK", age: 28, pts: 28.1, ast: 7.6, reb: 3.7, per: 22.8, ts: 62.1, bpm: 6.0, vorp: 4.8, ortg: 119, drtg: 114, form: ["W", "W", "L", "W", "W"] },
  { id: 8, name: "Cade Cunningham", pos: "PG", team: "DET", age: 24, pts: 26.7, ast: 8.9, reb: 5.9, per: 23.6, ts: 57.2, bpm: 6.2, vorp: 5.1, ortg: 117, drtg: 110, form: ["W", "W", "W", "L", "W"] },
  { id: 9, name: "Anthony Edwards", pos: "SG", team: "MIN", age: 24, pts: 27.6, ast: 5.5, reb: 5.7, per: 22.7, ts: 58.1, bpm: 5.6, vorp: 4.4, ortg: 116, drtg: 111, form: ["W", "W", "L", "W", "L"] },
  { id: 10, name: "Donovan Mitchell", pos: "SG", team: "CLE", age: 29, pts: 24.4, ast: 4.7, reb: 4.9, per: 21.0, ts: 57.8, bpm: 4.5, vorp: 3.6, ortg: 117, drtg: 111, form: ["W", "W", "L", "W", "W"] },
  { id: 11, name: "Trae Young", pos: "PG", team: "ATL", age: 28, pts: 27.1, ast: 11.2, reb: 3.8, per: 21.8, ts: 59.0, bpm: 5.1, vorp: 4.1, ortg: 118, drtg: 116, form: ["L", "W", "W", "W", "L"] },
  { id: 12, name: "Tyrese Haliburton", pos: "PG", team: "IND", age: 26, pts: 20.6, ast: 12.1, reb: 4.3, per: 21.5, ts: 62.0, bpm: 5.3, vorp: 4.2, ortg: 120, drtg: 113, form: ["L", "L", "W", "L", "L"] },
  { id: 13, name: "Tyrese Maxey", pos: "PG", team: "PHI", age: 25, pts: 26.2, ast: 5.7, reb: 3.9, per: 21.6, ts: 58.4, bpm: 4.1, vorp: 3.2, ortg: 116, drtg: 114, form: ["W", "L", "W", "L", "L"] },
  { id: 14, name: "Alperen Sengun", pos: "C", team: "HOU", age: 23, pts: 21.6, ast: 4.8, reb: 9.9, per: 22.6, ts: 60.1, bpm: 5.7, vorp: 4.5, ortg: 117, drtg: 111, form: ["W", "W", "L", "W", "L"] },
  { id: 15, name: "Scottie Barnes", pos: "SF", team: "TOR", age: 24, pts: 22.4, ast: 6.1, reb: 8.6, per: 20.0, ts: 58.6, bpm: 4.3, vorp: 3.4, ortg: 115, drtg: 112, form: ["W", "L", "W", "W", "W"] },
  { id: 16, name: "Paolo Banchero", pos: "PF", team: "ORL", age: 23, pts: 25.7, ast: 5.2, reb: 7.9, per: 22.1, ts: 57.4, bpm: 4.9, vorp: 3.9, ortg: 116, drtg: 113, form: ["W", "W", "L", "W", "W"] },
  { id: 17, name: "LeBron James", pos: "SF", team: "LAL", age: 41, pts: 24.3, ast: 8.5, reb: 7.2, per: 23.0, ts: 60.4, bpm: 6.1, vorp: 4.9, ortg: 118, drtg: 113, form: ["W", "L", "W", "L", "W"] },

  // ── Tier 3: Starters ──────────────────────────────────────
  { id: 18, name: "Stephen Curry", pos: "PG", team: "GSW", age: 37, pts: 22.9, ast: 6.4, reb: 4.6, per: 20.6, ts: 61.5, bpm: 4.2, vorp: 3.3, ortg: 118, drtg: 115, form: ["L", "L", "W", "L", "W"] },
  { id: 19, name: "Devin Booker", pos: "SG", team: "PHX", age: 29, pts: 26.0, ast: 5.9, reb: 4.4, per: 21.5, ts: 59.2, bpm: 3.9, vorp: 3.1, ortg: 116, drtg: 114, form: ["W", "L", "L", "W", "L"] },
  { id: 20, name: "James Harden", pos: "PG", team: "LAC", age: 36, pts: 20.1, ast: 8.6, reb: 5.8, per: 19.3, ts: 59.6, bpm: 3.5, vorp: 2.8, ortg: 115, drtg: 115, form: ["L", "W", "L", "L", "W"] },
  { id: 21, name: "Bam Adebayo", pos: "C", team: "MIA", age: 28, pts: 19.6, ast: 4.2, reb: 10.4, per: 20.8, ts: 57.1, bpm: 3.7, vorp: 3.0, ortg: 114, drtg: 109, form: ["L", "L", "W", "L", "L"] },
  { id: 22, name: "LaMelo Ball", pos: "PG", team: "CHA", age: 24, pts: 22.6, ast: 7.4, reb: 5.4, per: 19.5, ts: 55.7, bpm: 2.9, vorp: 2.3, ortg: 113, drtg: 114, form: ["L", "L", "W", "W", "L"] },
  { id: 23, name: "De'Aaron Fox", pos: "PG", team: "SAC", age: 28, pts: 25.1, ast: 6.3, reb: 4.3, per: 19.8, ts: 56.5, bpm: 2.2, vorp: 1.8, ortg: 114, drtg: 117, form: ["L", "L", "L", "L", "W"] },
  { id: 24, name: "Zach LaVine", pos: "SG", team: "CHI", age: 31, pts: 21.8, ast: 4.4, reb: 4.9, per: 18.0, ts: 57.9, bpm: 1.5, vorp: 1.2, ortg: 113, drtg: 116, form: ["W", "W", "L", "L", "L"] },
  { id: 25, name: "Zion Williamson", pos: "PF", team: "NOP", age: 25, pts: 22.1, ast: 4.3, reb: 6.5, per: 20.3, ts: 61.7, bpm: 3.3, vorp: 2.6, ortg: 116, drtg: 116, form: ["L", "L", "W", "L", "L"] },
  { id: 26, name: "Anfernee Simons", pos: "SG", team: "POR", age: 26, pts: 23.4, ast: 5.3, reb: 3.2, per: 18.8, ts: 57.6, bpm: 1.9, vorp: 1.5, ortg: 114, drtg: 116, form: ["W", "W", "W", "L", "W"] },
  { id: 27, name: "Ja Morant", pos: "PG", team: "MEM", age: 26, pts: 22.5, ast: 7.8, reb: 5.0, per: 20.0, ts: 54.9, bpm: 2.5, vorp: 2.0, ortg: 112, drtg: 115, form: ["L", "L", "L", "W", "L"] },
  { id: 28, name: "Lauri Markkanen", pos: "PF", team: "UTA", age: 29, pts: 21.1, ast: 2.2, reb: 7.2, per: 18.6, ts: 59.0, bpm: 1.7, vorp: 1.4, ortg: 113, drtg: 115, form: ["L", "L", "L", "W", "L"] },
  { id: 29, name: "Cam Thomas", pos: "SG", team: "BKN", age: 24, pts: 24.7, ast: 3.9, reb: 3.5, per: 17.4, ts: 55.1, bpm: 0.7, vorp: 0.6, ortg: 111, drtg: 117, form: ["L", "L", "L", "W", "L"] },
  { id: 30, name: "Jordan Poole", pos: "SG", team: "WAS", age: 27, pts: 20.3, ast: 5.0, reb: 3.7, per: 15.6, ts: 53.9, bpm: -0.7, vorp: -0.2, ortg: 110, drtg: 118, form: ["L", "L", "W", "L", "L"] },
];

// ─── STANDINGS ────────────────────────────────────────────────
// ~69 games played. gb calculated as (leaderW - leaderL - (teamW - teamL)) / 2.
export const EAST_STANDINGS = [
  { team: "BOS", w: 52, l: 17, pct: .754, gb: 0.0, last10: "8-2", home: "29-6", road: "23-11", streak: "W3" },
  { team: "CLE", w: 45, l: 24, pct: .652, gb: 7.0, last10: "6-4", home: "24-11", road: "21-13", streak: "L1" },
  { team: "NYK", w: 44, l: 25, pct: .638, gb: 8.0, last10: "7-3", home: "23-11", road: "21-14", streak: "W2" },
  { team: "MIL", w: 43, l: 26, pct: .623, gb: 9.0, last10: "5-5", home: "25-8", road: "18-18", streak: "W1" },
  { team: "ORL", w: 40, l: 29, pct: .580, gb: 12.0, last10: "6-4", home: "24-9", road: "16-20", streak: "W4" },
  { team: "IND", w: 38, l: 31, pct: .551, gb: 14.0, last10: "5-5", home: "20-14", road: "18-17", streak: "L2" },
  { team: "MIA", w: 37, l: 32, pct: .536, gb: 15.0, last10: "4-6", home: "18-16", road: "19-16", streak: "L1" },
  { team: "PHI", w: 35, l: 34, pct: .507, gb: 17.0, last10: "3-7", home: "19-15", road: "16-19", streak: "L4" },
  { team: "CHI", w: 32, l: 37, pct: .464, gb: 20.0, last10: "5-5", home: "17-18", road: "15-19", streak: "W1" },
  { team: "ATL", w: 30, l: 39, pct: .435, gb: 22.0, last10: "4-6", home: "15-19", road: "15-20", streak: "L1" },
  { team: "DET", w: 28, l: 41, pct: .406, gb: 24.0, last10: "6-4", home: "16-19", road: "12-22", streak: "W3" },
  { team: "BKN", w: 25, l: 44, pct: .362, gb: 27.0, last10: "2-8", home: "14-21", road: "11-23", streak: "L3" },
  { team: "TOR", w: 22, l: 47, pct: .319, gb: 30.0, last10: "1-9", home: "12-22", road: "10-25", streak: "L7" },
  { team: "CHA", w: 17, l: 52, pct: .246, gb: 35.0, last10: "3-7", home: "9-26", road: "8-26", streak: "W1" },
  { team: "WAS", w: 12, l: 57, pct: .174, gb: 40.0, last10: "1-9", home: "6-28", road: "6-29", streak: "L5" },
];

export const WEST_STANDINGS = [
  { team: "OKC", w: 51, l: 18, pct: .739, gb: 0.0, last10: "7-3", home: "28-7", road: "23-11", streak: "W2" },
  { team: "DEN", w: 48, l: 21, pct: .696, gb: 3.0, last10: "8-2", home: "28-7", road: "20-14", streak: "W5" },
  { team: "MIN", w: 47, l: 22, pct: .681, gb: 4.0, last10: "6-4", home: "25-9", road: "22-13", streak: "L1" },
  { team: "LAC", w: 43, l: 26, pct: .623, gb: 8.0, last10: "5-5", home: "22-12", road: "21-14", streak: "L2" },
  { team: "DAL", w: 42, l: 27, pct: .609, gb: 9.0, last10: "8-2", home: "22-13", road: "20-14", streak: "W6" },
  { team: "NOP", w: 40, l: 29, pct: .580, gb: 11.0, last10: "7-3", home: "20-14", road: "20-15", streak: "W3" },
  { team: "PHX", w: 38, l: 31, pct: .551, gb: 13.0, last10: "4-6", home: "20-14", road: "18-17", streak: "L1" },
  { team: "LAL", w: 37, l: 32, pct: .536, gb: 14.0, last10: "6-4", home: "23-12", road: "14-20", streak: "L1" },
  { team: "HOU", w: 36, l: 33, pct: .522, gb: 15.0, last10: "7-3", home: "22-13", road: "14-20", streak: "W4" },
  { team: "GSW", w: 35, l: 34, pct: .507, gb: 16.0, last10: "5-5", home: "18-17", road: "17-17", streak: "W1" },
  { team: "SAC", w: 34, l: 35, pct: .493, gb: 17.0, last10: "5-5", home: "18-16", road: "16-19", streak: "W2" },
  { team: "UTA", w: 27, l: 42, pct: .391, gb: 24.0, last10: "2-8", home: "18-16", road: "9-26", streak: "L5" },
  { team: "MEM", w: 23, l: 46, pct: .333, gb: 28.0, last10: "3-7", home: "8-25", road: "15-21", streak: "L2" },
  { team: "POR", w: 18, l: 51, pct: .261, gb: 33.0, last10: "2-8", home: "10-24", road: "8-27", streak: "L6" },
  { team: "SAS", w: 14, l: 55, pct: .203, gb: 37.0, last10: "1-9", home: "7-27", road: "7-28", streak: "L8" },
];

// ─── TODAY'S GAMES (fallback) ─────────────────────────────────
export const TODAY_GAMES = [
  { id: "g1", away: "NYK", home: "DEN", awayP: 31.2, homeP: 68.8, time: "9:00 PM ET", spread: "DEN -5.5", total: "215.5", status: "scheduled", awayScore: null, homeScore: null },
  { id: "g2", away: "DAL", home: "OKC", awayP: 44.8, homeP: 55.2, time: "10:00 PM ET", spread: "OKC -2", total: "235", status: "scheduled", awayScore: null, homeScore: null },
  { id: "g3", away: "BOS", home: "MIL", awayP: 53.4, homeP: 46.6, time: "7:30 PM ET", spread: "BOS -1", total: "228.5", status: "scheduled", awayScore: null, homeScore: null },
  { id: "g4", away: "MIN", home: "LAC", awayP: 57.1, homeP: 42.9, time: "10:30 PM ET", spread: "MIN -3", total: "212", status: "scheduled", awayScore: null, homeScore: null },
  { id: "g5", away: "MIA", home: "PHI", awayP: 46.3, homeP: 53.7, time: "7:00 PM ET", spread: "PHI -1", total: "208", status: "scheduled", awayScore: null, homeScore: null },
];

// ─── ODDS / BETTING EDGE (fallback) ──────────────────────────
// edge = "high" when |modelP - impliedP| >= 8, "mid" >= 4, else "none"
// impliedP: vig-removed market probability
export const ODDS_GAMES = [
  { matchup: "NYK @ DEN", fav: "DEN", awayTeam: "NYK", homeTeam: "DEN", modelP: 70, impliedP: 62, spread: "DEN -5.5", total: "215.5", edge: "mid" },
  { matchup: "DAL @ OKC", fav: "OKC", awayTeam: "DAL", homeTeam: "OKC", modelP: 74, impliedP: 55, spread: "OKC -2", total: "235", edge: "high" },
  { matchup: "BOS @ MIL", fav: "BOS", awayTeam: "BOS", homeTeam: "MIL", modelP: 79, impliedP: 53, spread: "BOS -1", total: "228.5", edge: "high" },
  { matchup: "MIN @ LAC", fav: "MIN", awayTeam: "MIN", homeTeam: "LAC", modelP: 72, impliedP: 57, spread: "MIN -3", total: "212", edge: "high" },
  { matchup: "MIA @ PHI", fav: "PHI", awayTeam: "MIA", homeTeam: "PHI", modelP: 56, impliedP: 54, spread: "PHI -1", total: "208", edge: "none" },
];

// ─── NOTABLE STREAKS ─────────────────────────────────────────
// Used by Dashboard hot-streak widget.
export const WIN_STREAKS = [
  { team: "SAS", player: "V. Wembanyama", streak: 8, type: "L", note: "Rebuild season" },
  { team: "DAL", player: "L. Doncic", streak: 6, type: "W", note: "On fire" },
  { team: "DEN", player: "N. Jokic", streak: 5, type: "W", note: "MVP pace" },
  { team: "HOU", player: "A. Sengun", streak: 4, type: "W", note: "Surging" },
  { team: "ORL", player: "P. Banchero", streak: 4, type: "W", note: "Playoff push" },
];