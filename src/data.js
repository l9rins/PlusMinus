// ─── PlusMinus Data ───────────────────────────────────────────
// All static data for the 2025-26 NBA season.
// Replace any export with a fetch() call to go live.

// ─── TEAM COLORS ─────────────────────────────────────────────
export const TEAM_COLORS = {
  OKC: "#007AC1", SAS: "#C4CED4", BOS: "#007A33", LAL: "#552583",
  DEN: "#0E2240", MIL: "#00471B", NYK: "#006BB6", DET: "#C8102E",
  CLE: "#860038", HOU: "#CE1141", MIN: "#236192", TOR: "#CE1141",
  GSW: "#1D428A", DAL: "#00538C", ATL: "#E03A3E", MIA: "#98002E",
  ORL: "#0077C0", PHI: "#006BB6", IND: "#002D62", BKN: "#777777",
  CHI: "#CE1122", POR: "#E03A3E", NOP: "#0C2340", UTA: "#002B5C",
  SAC: "#5A2D81", PHX: "#1D1160", LAC: "#C8102E", MEM: "#5D76A9",
  WAS: "#002B5C", CHA: "#1D1160",
};

// ─── TEAM NAMES ───────────────────────────────────────────────
export const TEAM_NAMES = {
  GSW: "Warriors",      BOS: "Celtics",        POR: "Trail Blazers", IND: "Pacers",
  OKC: "Thunder",       BKN: "Nets",           TOR: "Raptors",       CHI: "Bulls",
  LAC: "Clippers",      NOP: "Pelicans",       UTA: "Jazz",          MIN: "Timberwolves",
  DEN: "Nuggets",       MEM: "Grizzlies",      ATL: "Hawks",         DAL: "Mavericks",
  LAL: "Lakers",        HOU: "Rockets",        CLE: "Cavaliers",     MIL: "Bucks",
  PHI: "76ers",         NYK: "Knicks",         MIA: "Heat",          ORL: "Magic",
  CHA: "Hornets",       WAS: "Wizards",        DET: "Pistons",       SAS: "Spurs",
  SAC: "Kings",         PHX: "Suns",
};

// ─── PLAYERS ──────────────────────────────────────────────────
// Full shape required by Players.jsx expanded card:
// pts/ast/reb per game · per: PER · ts: TS% · bpm: BPM
// vorp: VORP · ortg/drtg: per-100-poss ratings · form: last 5 W/L
//
// One representative player per team ensures all 30 NBA teams
// appear in the Shot Quality radar view and Players page.
export const PLAYERS = [
  // ── Original 15 ────────────────────────────────────────────
  { id: 1,  name: "Shai Gilgeous-Alexander", pos: "PG", team: "OKC", age: 27, pts: 32.4, ast: 6.1,  reb: 5.3,  per: 28.6, ts: 62.8, bpm: 9.2,  vorp: 7.1, ortg: 123, drtg: 110, form: ["W","W","W","L","W"] },
  { id: 2,  name: "Victor Wembanyama",        pos: "C",  team: "SAS", age: 21, pts: 27.1, ast: 4.8,  reb: 11.4, per: 26.2, ts: 59.4, bpm: 8.1,  vorp: 6.3, ortg: 118, drtg: 106, form: ["W","W","L","W","W"] },
  { id: 3,  name: "Nikola Jokic",             pos: "C",  team: "DEN", age: 31, pts: 28.3, ast: 9.7,  reb: 13.1, per: 31.4, ts: 67.2, bpm: 11.4, vorp: 8.8, ortg: 126, drtg: 112, form: ["W","L","W","W","W"] },
  { id: 4,  name: "Jayson Tatum",             pos: "SF", team: "BOS", age: 28, pts: 26.8, ast: 4.9,  reb: 8.2,  per: 22.1, ts: 58.6, bpm: 6.2,  vorp: 5.1, ortg: 119, drtg: 111, form: ["W","W","W","W","L"] },
  { id: 5,  name: "LeBron James",             pos: "SF", team: "LAL", age: 41, pts: 24.1, ast: 8.3,  reb: 7.1,  per: 22.8, ts: 60.1, bpm: 5.9,  vorp: 4.8, ortg: 117, drtg: 113, form: ["W","L","W","L","W"] },
  { id: 6,  name: "Luka Doncic",              pos: "PG", team: "DAL", age: 27, pts: 29.2, ast: 9.1,  reb: 8.7,  per: 27.3, ts: 60.9, bpm: 7.8,  vorp: 6.1, ortg: 120, drtg: 113, form: ["L","L","W","L","W"] },
  { id: 7,  name: "Giannis Antetokounmpo",    pos: "PF", team: "MIL", age: 31, pts: 29.6, ast: 6.2,  reb: 11.8, per: 29.1, ts: 64.4, bpm: 8.8,  vorp: 6.9, ortg: 121, drtg: 109, form: ["L","W","W","W","L"] },
  { id: 8,  name: "Jalen Brunson",            pos: "PG", team: "NYK", age: 28, pts: 27.8, ast: 7.4,  reb: 3.6,  per: 22.6, ts: 61.8, bpm: 5.8,  vorp: 4.6, ortg: 118, drtg: 114, form: ["W","W","L","W","W"] },
  { id: 9,  name: "Cade Cunningham",          pos: "PG", team: "DET", age: 24, pts: 26.4, ast: 8.7,  reb: 5.8,  per: 23.4, ts: 56.9, bpm: 6.1,  vorp: 5.0, ortg: 116, drtg: 110, form: ["W","W","W","L","W"] },
  { id: 10, name: "Anthony Edwards",          pos: "SG", team: "MIN", age: 24, pts: 27.3, ast: 5.4,  reb: 5.6,  per: 22.4, ts: 57.8, bpm: 5.4,  vorp: 4.3, ortg: 115, drtg: 111, form: ["W","W","L","W","L"] },
  { id: 11, name: "Trae Young",               pos: "PG", team: "ATL", age: 28, pts: 26.8, ast: 10.8, reb: 3.7,  per: 21.6, ts: 58.7, bpm: 4.9,  vorp: 4.0, ortg: 117, drtg: 116, form: ["L","W","W","W","L"] },
  { id: 12, name: "Tyrese Haliburton",        pos: "PG", team: "IND", age: 26, pts: 20.4, ast: 11.8, reb: 4.2,  per: 21.3, ts: 61.7, bpm: 5.2,  vorp: 4.1, ortg: 119, drtg: 113, form: ["L","L","W","L","L"] },
  { id: 13, name: "Scottie Barnes",           pos: "SF", team: "TOR", age: 24, pts: 22.1, ast: 5.9,  reb: 8.4,  per: 19.7, ts: 58.3, bpm: 4.1,  vorp: 3.3, ortg: 114, drtg: 112, form: ["W","L","W","W","W"] },
  { id: 14, name: "Alperen Sengun",           pos: "C",  team: "HOU", age: 23, pts: 21.3, ast: 4.6,  reb: 9.7,  per: 22.3, ts: 59.8, bpm: 5.6,  vorp: 4.4, ortg: 116, drtg: 111, form: ["W","L","W","W","L"] },
  { id: 15, name: "Paolo Banchero",           pos: "PF", team: "ORL", age: 23, pts: 25.4, ast: 5.1,  reb: 7.8,  per: 21.9, ts: 57.1, bpm: 4.8,  vorp: 3.8, ortg: 115, drtg: 113, form: ["W","W","L","W","W"] },
  // ── Added for full 30-team coverage ────────────────────────
  { id: 16, name: "Donovan Mitchell",         pos: "SG", team: "CLE", age: 29, pts: 24.2, ast: 4.6,  reb: 4.8,  per: 20.8, ts: 57.5, bpm: 4.3,  vorp: 3.4, ortg: 116, drtg: 111, form: ["W","W","L","W","W"] },
  { id: 17, name: "Stephen Curry",            pos: "PG", team: "GSW", age: 37, pts: 22.8, ast: 6.3,  reb: 4.5,  per: 20.4, ts: 61.2, bpm: 4.1,  vorp: 3.2, ortg: 117, drtg: 115, form: ["L","L","W","L","W"] },
  { id: 18, name: "Devin Booker",             pos: "SG", team: "PHX", age: 29, pts: 25.7, ast: 5.8,  reb: 4.3,  per: 21.3, ts: 58.9, bpm: 3.8,  vorp: 3.0, ortg: 115, drtg: 114, form: ["W","L","L","W","L"] },
  { id: 19, name: "James Harden",             pos: "PG", team: "LAC", age: 36, pts: 19.8, ast: 8.4,  reb: 5.7,  per: 19.1, ts: 59.3, bpm: 3.4,  vorp: 2.7, ortg: 114, drtg: 115, form: ["L","W","L","L","W"] },
  { id: 20, name: "Bam Adebayo",              pos: "C",  team: "MIA", age: 28, pts: 19.4, ast: 4.1,  reb: 10.2, per: 20.6, ts: 56.8, bpm: 3.6,  vorp: 2.9, ortg: 113, drtg: 109, form: ["L","L","W","L","L"] },
  { id: 21, name: "Tyrese Maxey",             pos: "PG", team: "PHI", age: 25, pts: 25.9, ast: 5.6,  reb: 3.8,  per: 21.4, ts: 58.1, bpm: 3.9,  vorp: 3.1, ortg: 115, drtg: 114, form: ["W","L","W","L","L"] },
  { id: 22, name: "LaMelo Ball",              pos: "PG", team: "CHA", age: 24, pts: 22.4, ast: 7.2,  reb: 5.3,  per: 19.3, ts: 55.4, bpm: 2.8,  vorp: 2.2, ortg: 112, drtg: 114, form: ["L","L","W","W","L"] },
  { id: 23, name: "Zach LaVine",              pos: "SG", team: "CHI", age: 31, pts: 21.6, ast: 4.3,  reb: 4.8,  per: 17.8, ts: 57.6, bpm: 1.4,  vorp: 1.1, ortg: 112, drtg: 116, form: ["W","W","L","L","L"] },
  { id: 24, name: "Anfernee Simons",          pos: "SG", team: "POR", age: 26, pts: 23.1, ast: 5.2,  reb: 3.1,  per: 18.6, ts: 57.3, bpm: 1.8,  vorp: 1.4, ortg: 113, drtg: 116, form: ["W","W","W","L","W"] },
  { id: 25, name: "Ja Morant",                pos: "PG", team: "MEM", age: 26, pts: 22.3, ast: 7.6,  reb: 4.9,  per: 19.8, ts: 54.6, bpm: 2.4,  vorp: 1.9, ortg: 111, drtg: 115, form: ["L","L","L","W","L"] },
  { id: 26, name: "Zion Williamson",          pos: "PF", team: "NOP", age: 25, pts: 21.8, ast: 4.2,  reb: 6.4,  per: 20.1, ts: 61.4, bpm: 3.2,  vorp: 2.5, ortg: 115, drtg: 116, form: ["L","L","W","L","L"] },
  { id: 27, name: "Lauri Markkanen",          pos: "PF", team: "UTA", age: 29, pts: 20.9, ast: 2.1,  reb: 7.1,  per: 18.4, ts: 58.7, bpm: 1.6,  vorp: 1.3, ortg: 112, drtg: 115, form: ["L","L","L","W","L"] },
  { id: 28, name: "De'Aaron Fox",             pos: "PG", team: "SAC", age: 28, pts: 24.8, ast: 6.1,  reb: 4.2,  per: 19.6, ts: 56.2, bpm: 2.1,  vorp: 1.7, ortg: 113, drtg: 117, form: ["L","L","L","L","W"] },
  { id: 29, name: "Cam Thomas",               pos: "SG", team: "BKN", age: 24, pts: 24.4, ast: 3.8,  reb: 3.4,  per: 17.2, ts: 54.8, bpm: 0.6,  vorp: 0.5, ortg: 110, drtg: 117, form: ["L","L","L","W","L"] },
  { id: 30, name: "Jordan Poole",             pos: "SG", team: "WAS", age: 27, pts: 20.1, ast: 4.9,  reb: 3.6,  per: 15.4, ts: 53.6, bpm: -0.8, vorp: -0.3, ortg: 109, drtg: 118, form: ["L","L","W","L","L"] },
];

// ─── TODAY'S GAMES ────────────────────────────────────────────
// id is required — used as React key in game tile lists.
export const TODAY_GAMES = [
  { id: "g1", away: "GSW", home: "BOS", awayP: 16.8, homeP: 83.2, time: "7:00 PM", spread: "BOS -9.5", total: "224.5", status: "scheduled" },
  { id: "g2", away: "POR", home: "IND", awayP: 84.7, homeP: 15.3, time: "7:30 PM", spread: "POR -8",   total: "228",   status: "scheduled" },
  { id: "g3", away: "OKC", home: "BKN", awayP: 94.7, homeP: 5.3,  time: "7:30 PM", spread: "OKC -16",  total: "218",   status: "scheduled" },
  { id: "g4", away: "TOR", home: "CHI", awayP: 73.0, homeP: 27.0, time: "8:00 PM", spread: "TOR -5",   total: "226",   status: "scheduled" },
  { id: "g5", away: "LAC", home: "NOP", awayP: 44.6, homeP: 55.4, time: "8:00 PM", spread: "NOP -1",   total: "231",   status: "scheduled" },
  { id: "g6", away: "UTA", home: "MIN", awayP: 13.3, homeP: 86.7, time: "8:00 PM", spread: "MIN -12",  total: "221",   status: "scheduled" },
  { id: "g7", away: "DEN", home: "MEM", awayP: 86.9, homeP: 13.1, time: "8:30 PM", spread: "DEN -10",  total: "222.5", status: "scheduled" },
  { id: "g8", away: "ATL", home: "DAL", awayP: 74.5, homeP: 25.5, time: "8:30 PM", spread: "ATL -5.5", total: "233.5", status: "scheduled" },
  { id: "g9", away: "LAL", home: "HOU", awayP: 45.1, homeP: 54.9, time: "9:30 PM", spread: "HOU -1",   total: "231",   status: "scheduled" },
];

// ─── STANDINGS ────────────────────────────────────────────────
export const EAST_STANDINGS = [
  { team: "DET", w: 49, l: 19, pct: .721, last10: "9-1", home: "28-7",  road: "21-12", streak: "W5" },
  { team: "BOS", w: 45, l: 23, pct: .662, last10: "8-2", home: "26-9",  road: "19-14", streak: "W3" },
  { team: "NYK", w: 45, l: 25, pct: .643, last10: "7-3", home: "25-10", road: "20-15", streak: "W1" },
  { team: "CLE", w: 42, l: 27, pct: .609, last10: "6-4", home: "24-11", road: "18-16", streak: "W2" },
  { team: "TOR", w: 38, l: 29, pct: .567, last10: "5-5", home: "22-13", road: "16-16", streak: "L1" },
  { team: "ORL", w: 38, l: 30, pct: .559, last10: "6-4", home: "21-12", road: "17-18", streak: "W1" },
  { team: "MIA", w: 38, l: 31, pct: .551, last10: "4-6", home: "22-13", road: "16-18", streak: "L2" },
  { team: "ATL", w: 37, l: 31, pct: .544, last10: "7-3", home: "21-13", road: "16-18", streak: "W4" },
  { team: "PHI", w: 37, l: 32, pct: .536, last10: "5-5", home: "22-14", road: "15-18", streak: "L1" },
  { team: "CHA", w: 35, l: 34, pct: .507, last10: "4-6", home: "20-15", road: "15-19", streak: "L1" },
  { team: "CHI", w: 28, l: 40, pct: .412, last10: "4-6", home: "17-18", road: "11-22", streak: "W2" },
  { team: "MIL", w: 28, l: 40, pct: .412, last10: "3-7", home: "17-18", road: "11-22", streak: "L3" },
  { team: "BKN", w: 17, l: 51, pct: .250, last10: "1-9", home: "9-27",  road: "8-24",  streak: "L6" },
  { team: "WAS", w: 16, l: 52, pct: .235, last10: "2-8", home: "10-26", road: "6-26",  streak: "L4" },
  { team: "IND", w: 15, l: 54, pct: .217, last10: "2-8", home: "9-27",  road: "6-27",  streak: "L3" },
];

export const WEST_STANDINGS = [
  { team: "OKC", w: 54, l: 15, pct: .783, last10: "8-2", home: "29-5",  road: "25-10", streak: "W3" },
  { team: "SAS", w: 51, l: 18, pct: .739, last10: "9-1", home: "28-6",  road: "23-12", streak: "W7" },
  { team: "LAL", w: 43, l: 25, pct: .632, last10: "6-4", home: "24-11", road: "19-14", streak: "L1" },
  { team: "HOU", w: 41, l: 26, pct: .612, last10: "7-3", home: "23-11", road: "18-15", streak: "W2" },
  { team: "DEN", w: 42, l: 27, pct: .609, last10: "8-2", home: "24-10", road: "18-17", streak: "W5" },
  { team: "MIN", w: 42, l: 27, pct: .609, last10: "6-4", home: "23-11", road: "19-16", streak: "W1" },
  { team: "PHX", w: 39, l: 30, pct: .565, last10: "5-5", home: "22-13", road: "17-17", streak: "L2" },
  { team: "LAC", w: 34, l: 34, pct: .500, last10: "4-6", home: "20-15", road: "14-19", streak: "L1" },
  { team: "GSW", w: 33, l: 35, pct: .485, last10: "4-6", home: "19-16", road: "14-19", streak: "L2" },
  { team: "POR", w: 33, l: 36, pct: .478, last10: "7-3", home: "19-16", road: "14-20", streak: "W4" },
  { team: "MEM", w: 23, l: 44, pct: .343, last10: "3-7", home: "14-21", road: "9-23",  streak: "L5" },
  { team: "NOP", w: 23, l: 46, pct: .333, last10: "2-8", home: "13-22", road: "10-24", streak: "L3" },
  { team: "DAL", w: 23, l: 46, pct: .333, last10: "3-7", home: "12-22", road: "11-24", streak: "L2" },
  { team: "UTA", w: 20, l: 48, pct: .294, last10: "2-8", home: "12-24", road: "8-24",  streak: "L4" },
  { team: "SAC", w: 18, l: 52, pct: .257, last10: "1-9", home: "11-26", road: "7-26",  streak: "L6" },
];

// ─── BETTING EDGE ─────────────────────────────────────────────
export const ODDS_GAMES = [
  { matchup: "GSW @ BOS", fav: "BOS", modelP: 83, impliedP: 79, spread: "BOS -9.5", total: "224.5", edge: "low"  },
  { matchup: "OKC @ BKN", fav: "OKC", modelP: 95, impliedP: 88, spread: "OKC -16",  total: "218",   edge: "high" },
  { matchup: "POR @ IND", fav: "POR", modelP: 85, impliedP: 80, spread: "POR -8",   total: "228",   edge: "low"  },
  { matchup: "LAL @ HOU", fav: "HOU", modelP: 55, impliedP: 52, spread: "HOU -1",   total: "231",   edge: "low"  },
  { matchup: "DEN @ MEM", fav: "DEN", modelP: 87, impliedP: 82, spread: "DEN -10",  total: "222.5", edge: "mid"  },
  { matchup: "ATL @ DAL", fav: "ATL", modelP: 75, impliedP: 64, spread: "ATL -5.5", total: "233.5", edge: "high" },
];
