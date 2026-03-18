// ─── CourtIQ Data ─────────────────────────────────────────────
// All static data for the 2025-26 NBA season.
// To connect a real API, replace these arrays with fetch() calls
// pointing to endpoints like:
//   https://www.balldontlie.io/api/v1/players
//   https://api.sportradar.com/nba/...
//   https://stats.nba.com/stats/...

const BB = '#E8531A';
const BLUE = '#3B8BD4';

// ─── TODAY'S GAMES ────────────────────────────────────────────

const TODAY_GAMES = [
  { away:'GSW', home:'BOS', awayP:16.8, homeP:83.2, time:'7:00 PM ET' },
  { away:'POR', home:'IND', awayP:84.7, homeP:15.3, time:'7:30 PM ET' },
  { away:'OKC', home:'BKN', awayP:94.7, homeP:5.3,  time:'7:30 PM ET' },
  { away:'TOR', home:'CHI', awayP:73.0, homeP:27.0, time:'8:00 PM ET' },
  { away:'LAC', home:'NOP', awayP:44.6, homeP:55.4, time:'8:00 PM ET' },
  { away:'UTA', home:'MIN', awayP:13.3, homeP:86.7, time:'8:00 PM ET' },
  { away:'DEN', home:'MEM', awayP:86.9, homeP:13.1, time:'8:30 PM ET' },
  { away:'ATL', home:'DAL', awayP:74.5, homeP:25.5, time:'8:30 PM ET' },
  { away:'LAL', home:'HOU', awayP:45.1, homeP:54.9, time:'9:30 PM ET' },
];

const TEAM_NAMES = {
  GSW:'Warriors', BOS:'Celtics', POR:'Trail Blazers', IND:'Pacers',
  OKC:'Thunder',  BKN:'Nets',    TOR:'Raptors',       CHI:'Bulls',
  LAC:'Clippers', NOP:'Pelicans',UTA:'Jazz',           MIN:'Timberwolves',
  DEN:'Nuggets',  MEM:'Grizzlies',ATL:'Hawks',         DAL:'Mavericks',
  LAL:'Lakers',   HOU:'Rockets', CLE:'Cavaliers',      MIL:'Bucks',
  PHI:'76ers',    NYK:'Knicks',  MIA:'Heat',           ORL:'Magic',
  CHA:'Hornets',  WAS:'Wizards', DET:'Pistons',        SAS:'Spurs',
  SAC:'Kings',    PHX:'Suns',
};

// ─── STANDINGS ────────────────────────────────────────────────

const EAST_STANDINGS = [
  {n:'Boston Celtics',      w:45, l:23, pct:.662},
  {n:'New York Knicks',     w:45, l:25, pct:.643},
  {n:'Detroit Pistons',     w:49, l:19, pct:.721},
  {n:'Cleveland Cavaliers', w:42, l:27, pct:.609},
  {n:'Toronto Raptors',     w:38, l:29, pct:.567},
  {n:'Orlando Magic',       w:38, l:30, pct:.559},
  {n:'Miami Heat',          w:38, l:31, pct:.551},
  {n:'Atlanta Hawks',       w:37, l:31, pct:.544},
  {n:'Philadelphia 76ers',  w:37, l:32, pct:.536},
  {n:'Charlotte Hornets',   w:35, l:34, pct:.507},
  {n:'Chicago Bulls',       w:28, l:40, pct:.412},
  {n:'Milwaukee Bucks',     w:28, l:40, pct:.412},
  {n:'Washington Wizards',  w:16, l:52, pct:.235},
  {n:'Brooklyn Nets',       w:17, l:51, pct:.250},
  {n:'Indiana Pacers',      w:15, l:54, pct:.217},
].sort((a,b) => b.pct - a.pct);

const WEST_STANDINGS = [
  {n:'Oklahoma City Thunder',   w:54, l:15, pct:.783},
  {n:'San Antonio Spurs',       w:51, l:18, pct:.739},
  {n:'Los Angeles Lakers',      w:43, l:25, pct:.632},
  {n:'Houston Rockets',         w:41, l:26, pct:.612},
  {n:'Denver Nuggets',          w:42, l:27, pct:.609},
  {n:'Minnesota Timberwolves',  w:42, l:27, pct:.609},
  {n:'Phoenix Suns',            w:39, l:30, pct:.565},
  {n:'LA Clippers',             w:34, l:34, pct:.500},
  {n:'Portland Trail Blazers',  w:33, l:36, pct:.478},
  {n:'Golden State Warriors',   w:33, l:35, pct:.485},
  {n:'Utah Jazz',               w:20, l:48, pct:.294},
  {n:'Memphis Grizzlies',       w:23, l:44, pct:.343},
  {n:'New Orleans Pelicans',    w:23, l:46, pct:.333},
  {n:'Dallas Mavericks',        w:23, l:46, pct:.333},
  {n:'Sacramento Kings',        w:18, l:52, pct:.257},
].sort((a,b) => b.pct - a.pct);

// ─── PLAYERS ──────────────────────────────────────────────────
// Stats: pts/ast/reb per game, PER, TS%
// col: team brand color for avatar background

const PLAYERS = [
  {name:'Shai Gilgeous-Alex.',   pos:'PG', team:'OKC', pts:32.4, ast:6.1,  reb:5.3,  per:28.6, ts:62.8, col:'#E8531A'},
  {name:'Victor Wembanyama',     pos:'C',  team:'SAS', pts:27.1, ast:4.8,  reb:11.4, per:26.2, ts:59.4, col:'#C0392B'},
  {name:'Nikola Jokic',          pos:'C',  team:'DEN', pts:28.3, ast:9.7,  reb:13.1, per:31.4, ts:67.2, col:'#FDB927'},
  {name:'Jayson Tatum',          pos:'SF', team:'BOS', pts:26.8, ast:4.9,  reb:8.2,  per:22.1, ts:58.6, col:'#007A33'},
  {name:'LeBron James',          pos:'SF', team:'LAL', pts:24.1, ast:8.3,  reb:7.1,  per:22.8, ts:60.1, col:'#552583'},
  {name:'Luka Doncic',           pos:'PG', team:'DAL', pts:29.2, ast:9.1,  reb:8.7,  per:27.3, ts:60.9, col:'#00538C'},
  {name:'Giannis Antetokounmpo', pos:'PF', team:'MIL', pts:29.6, ast:6.2,  reb:11.8, per:29.1, ts:64.4, col:'#00471B'},
  {name:'Tyrese Haliburton',     pos:'PG', team:'IND', pts:20.4, ast:11.8, reb:4.2,  per:21.3, ts:61.7, col:'#002D62'},
  {name:'Anthony Edwards',       pos:'SG', team:'MIN', pts:27.3, ast:5.4,  reb:5.6,  per:22.4, ts:57.8, col:'#236192'},
  {name:'Damian Lillard',        pos:'PG', team:'MIL', pts:24.7, ast:7.3,  reb:4.1,  per:20.8, ts:59.2, col:'#00471B'},
  {name:'Scottie Barnes',        pos:'SF', team:'TOR', pts:22.1, ast:5.9,  reb:8.4,  per:19.7, ts:58.3, col:'#CE1141'},
  {name:'Cade Cunningham',       pos:'PG', team:'DET', pts:26.4, ast:8.7,  reb:5.8,  per:23.4, ts:56.9, col:'#C8102E'},
  {name:'Evan Mobley',           pos:'C',  team:'CLE', pts:18.6, ast:3.2,  reb:10.4, per:20.1, ts:61.2, col:'#860038'},
  {name:"De'Aaron Fox",          pos:'PG', team:'SAC', pts:25.3, ast:7.2,  reb:4.4,  per:21.2, ts:57.4, col:'#5A2D81'},
  {name:'Jalen Brunson',         pos:'PG', team:'NYK', pts:27.8, ast:7.4,  reb:3.6,  per:22.6, ts:61.8, col:'#006BB6'},
  {name:'Paolo Banchero',        pos:'PF', team:'ORL', pts:25.4, ast:5.1,  reb:7.8,  per:21.9, ts:57.1, col:'#0077C0'},
  {name:'Darius Garland',        pos:'PG', team:'CLE', pts:22.4, ast:8.1,  reb:3.2,  per:19.8, ts:60.3, col:'#860038'},
  {name:'Alperen Sengun',        pos:'C',  team:'HOU', pts:21.3, ast:4.6,  reb:9.7,  per:22.3, ts:59.8, col:'#CE1141'},
  {name:'Franz Wagner',          pos:'SF', team:'ORL', pts:23.1, ast:5.3,  reb:5.4,  per:20.4, ts:59.0, col:'#0077C0'},
  {name:'Trae Young',            pos:'PG', team:'ATL', pts:26.8, ast:10.8, reb:3.7,  per:21.6, ts:58.7, col:'#E03A3E'},
];

// ─── SHOT DATA ────────────────────────────────────────────────
// Each zone: label, makes, attempts, SVG x/y coords, dot radius
// Zones mapped to half-court SVG (400x380 viewBox)

const SHOT_DATA = {
  shai: { name:'Shai Gilgeous-Alexander', zones:[
    {z:'Paint',         makes:312, att:424, x:200, y:265, r:18},
    {z:'Floater',       makes:88,  att:142, x:200, y:208, r:11},
    {z:'Mid (left)',    makes:41,  att:98,  x:110, y:192, r:9 },
    {z:'Mid (right)',   makes:38,  att:91,  x:290, y:192, r:9 },
    {z:'Mid (center)',  makes:29,  att:74,  x:200, y:174, r:8 },
    {z:'Corner 3 (L)',  makes:48,  att:112, x:52,  y:290, r:10},
    {z:'Corner 3 (R)',  makes:51,  att:118, x:348, y:290, r:10},
    {z:'Left wing 3',   makes:82,  att:204, x:72,  y:190, r:13},
    {z:'Right wing 3',  makes:79,  att:197, x:328, y:190, r:13},
    {z:'Top of arc 3',  makes:94,  att:228, x:200, y:130, r:14},
  ]},
  jokic: { name:'Nikola Jokic', zones:[
    {z:'Paint',         makes:298, att:388, x:200, y:265, r:18},
    {z:'Post left',     makes:124, att:178, x:138, y:248, r:12},
    {z:'Post right',    makes:118, att:172, x:262, y:248, r:12},
    {z:'Floater',       makes:62,  att:108, x:200, y:210, r:9 },
    {z:'Mid (left)',    makes:58,  att:118, x:110, y:192, r:9 },
    {z:'Mid (right)',   makes:54,  att:112, x:290, y:192, r:9 },
    {z:'Mid (center)',  makes:88,  att:164, x:200, y:174, r:11},
    {z:'Left wing 3',   makes:42,  att:114, x:72,  y:190, r:9 },
    {z:'Right wing 3',  makes:44,  att:116, x:328, y:190, r:9 },
    {z:'Top of arc 3',  makes:38,  att:102, x:200, y:130, r:9 },
  ]},
  wemby: { name:'Victor Wembanyama', zones:[
    {z:'Paint',         makes:284, att:372, x:200, y:265, r:18},
    {z:'Floater',       makes:72,  att:128, x:200, y:210, r:10},
    {z:'Mid (center)',  makes:44,  att:96,  x:200, y:174, r:9 },
    {z:'Mid (left)',    makes:36,  att:88,  x:118, y:190, r:8 },
    {z:'Mid (right)',   makes:34,  att:82,  x:282, y:190, r:8 },
    {z:'Corner 3 (L)',  makes:38,  att:88,  x:52,  y:290, r:9 },
    {z:'Corner 3 (R)',  makes:36,  att:84,  x:348, y:290, r:9 },
    {z:'Left wing 3',   makes:94,  att:218, x:72,  y:190, r:14},
    {z:'Right wing 3',  makes:88,  att:208, x:328, y:190, r:14},
    {z:'Top of arc 3',  makes:108, att:252, x:200, y:126, r:15},
  ]},
  tatum: { name:'Jayson Tatum', zones:[
    {z:'Paint',         makes:242, att:334, x:200, y:265, r:16},
    {z:'Floater',       makes:68,  att:124, x:200, y:210, r:10},
    {z:'Post left',     makes:82,  att:148, x:138, y:244, r:11},
    {z:'Post right',    makes:78,  att:142, x:262, y:244, r:11},
    {z:'Mid (left)',    makes:62,  att:128, x:110, y:192, r:10},
    {z:'Mid (right)',   makes:58,  att:118, x:290, y:192, r:10},
    {z:'Corner 3 (L)',  makes:52,  att:118, x:52,  y:290, r:10},
    {z:'Corner 3 (R)',  makes:48,  att:112, x:348, y:290, r:9 },
    {z:'Left wing 3',   makes:88,  att:212, x:72,  y:190, r:13},
    {z:'Right wing 3',  makes:84,  att:204, x:328, y:190, r:13},
    {z:'Top of arc 3',  makes:72,  att:178, x:200, y:130, r:12},
  ]},
  lebron: { name:'LeBron James', zones:[
    {z:'Paint',         makes:308, att:412, x:200, y:260, r:18},
    {z:'Floater',       makes:84,  att:138, x:200, y:210, r:11},
    {z:'Post left',     makes:94,  att:162, x:138, y:244, r:11},
    {z:'Post right',    makes:88,  att:154, x:262, y:244, r:11},
    {z:'Mid (left)',    makes:48,  att:112, x:110, y:190, r:9 },
    {z:'Mid (right)',   makes:44,  att:104, x:290, y:190, r:9 },
    {z:'Corner 3 (L)',  makes:42,  att:98,  x:52,  y:290, r:9 },
    {z:'Corner 3 (R)',  makes:44,  att:102, x:348, y:290, r:9 },
    {z:'Left wing 3',   makes:68,  att:178, x:72,  y:190, r:12},
    {z:'Right wing 3',  makes:64,  att:172, x:328, y:190, r:12},
    {z:'Top of arc 3',  makes:58,  att:148, x:200, y:130, r:11},
  ]},
};

// ─── BETTING EDGE DATA ────────────────────────────────────────

const ODDS_GAMES = [
  { matchup:'GSW @ BOS', modelFav:'BOS', modelP:83, impliedP:79, spread:'BOS -9.5', total:'224.5', edge:'low'  },
  { matchup:'OKC @ BKN', modelFav:'OKC', modelP:95, impliedP:88, spread:'OKC -16',  total:'218',   edge:'high' },
  { matchup:'POR @ IND', modelFav:'POR', modelP:85, impliedP:80, spread:'POR -8',   total:'228',   edge:'low'  },
  { matchup:'LAL @ HOU', modelFav:'HOU', modelP:55, impliedP:52, spread:'HOU -1',   total:'231',   edge:'low'  },
  { matchup:'DEN @ MEM', modelFav:'DEN', modelP:87, impliedP:82, spread:'DEN -10',  total:'222.5', edge:'mid'  },
  { matchup:'ATL @ DAL', modelFav:'ATL', modelP:75, impliedP:64, spread:'ATL -5.5', total:'233.5', edge:'high' },
];

// ─── ANALYTICS TOOLS ─────────────────────────────────────────

const TOOLS = [
  { icon:'📊', title:'PER vs TS% Plot',      desc:'Scatter efficiency metrics across all players',        prompt:'Build me a player performance scatter plot comparing PER vs true shooting % for this NBA season with Chart.js' },
  { icon:'⚡', title:'Four Factors',          desc:"Dean Oliver's offensive/defensive pillars",           prompt:'Show me a pace and efficiency four factors analysis chart for NBA teams this season' },
  { icon:'🏆', title:'Playoff Odds',          desc:'Seed probability for each team',                      prompt:'Build a playoff seed probability chart for the 2026 NBA season based on current standings' },
  { icon:'±',  title:'Plus/Minus Guide',      desc:'Raw → RAPM → EPM explained visually',                prompt:'Explain NBA plus/minus metrics: raw +/-, adjusted +/-, RAPM, RPM, and EPM with interactive examples' },
  { icon:'💰', title:'EV Calculator',         desc:'Convert odds → implied prob → find +EV',             prompt:'Build an NBA betting value calculator — convert moneyline odds to implied probability and compare to model probability to find expected value' },
  { icon:'🎯', title:'Shot Quality',          desc:'xPPS and shot selection by team',                     prompt:'Create a shot quality vs shot quantity analysis chart for NBA teams — offensive rating vs shot difficulty' },
  { icon:'🔀', title:'Lineup Builder',        desc:'On/off splits and net rating combos',                 prompt:'Build an NBA lineup optimizer tool — show how to think about lineup construction using on/off data and net rating' },
  { icon:'📡', title:'Player Tracking',       desc:'Second Spectrum stats explained',                     prompt:'Explain NBA player tracking stats: speed, distance, touch time, contested shots — interactive visual explainer' },
  { icon:'📈', title:'Elo Ratings',           desc:'Team strength ratings visualized',                    prompt:'Build a visual explainer of how NBA Elo ratings work and show current 2026 season team Elo ratings as a ranked bar chart' },
  { icon:'🌩', title:'OKC Breakdown',         desc:'Why are the Thunder dominant this year?',             prompt:'Analyze the Oklahoma City Thunder 2025-26 season — what makes them the #1 seed in the West? Use advanced stats context' },
  { icon:'⚜️', title:'Spurs Analysis',        desc:'The Spurs are back — what changed?',                  prompt:'Analyze the San Antonio Spurs surprising 2nd place finish in the West — advanced stats breakdown' },
  { icon:'📋', title:'Betting 101',           desc:'Lines, spreads, CLV explained',                       prompt:'Explain NBA betting lines: how are point spreads, moneylines, and totals set? What does closing line value mean for bettors?' },
];
