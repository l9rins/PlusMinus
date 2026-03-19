# ± PlusMinus

**NBA analytics platform** — live scores, standings, player stats, betting edge finder, Elo ratings, and win probability models.

Built with React 18 + Vite. Styled with Tailwind CSS. Animated with Framer Motion. Charts via Recharts. Data from BallDontLie API and The Odds API.

---

## What this app is

PlusMinus is a dark-themed, FM26-inspired NBA dashboard. It pulls live game data and odds from two free-tier APIs and presents them alongside computed analytics (Four Factors, Elo ratings, Shot Quality radar charts). It degrades gracefully — every view works without any API key, falling back to static data from `data.js`.

---

## Features

| Tab | What it does |
|-----|-------------|
| **Dashboard** | Overview tiles: games today, top betting edge, best win probability, tracked bets summary. Tonight's scores. Mini standings (East/West top 6). |
| **Scores** | Full game grid with live scores, win probabilities, spreads, over/under totals. Tiles update every 2 minutes. |
| **Standings** | East and West conference tables — W, L, PCT, Last 10, Home, Road, Streak. Live from BallDontLie. |
| **Players** | 30-player static roster with live BDL season averages overlaid. Expandable cards with PER, TS%, BPM, VORP, O-RTG, D-RTG attribute bars. Full-database search (debounced, 2-char minimum). |
| **Betting** | Edge finder: model win% vs. market implied probability (vig-removed). Bet Tracker: add/edit/delete bets, inline result editing, cumulative P&L line chart, win rate by bet type bar chart, CSV export. All bets persist in `localStorage`. |
| **Analytics** | Four Factors efficiency table (sortable, bar chart), Elo power rankings (trajectory line chart, tier badges), Shot Quality radar profiles (team comparison overlay). |

---

## Data sources

| Source | What it provides | Tier | Refresh cadence |
|--------|-----------------|------|----------------|
| [BallDontLie](https://www.balldontlie.io) | Scores, standings, player season averages, player search | Free (requires key) | Scores: 2 min · Standings: 10 min · Players: 1 hr |
| [The Odds API](https://the-odds-api.com) | NBA moneyline odds → vig-removed win probabilities | Free (500 req/month) | 15 min |
| `src/data.js` | Fallback standings, fallback games, 30-player roster with advanced metrics, sample odds | Built-in static | Never fetched — only used when API is absent or fails |

**Rate limit math for The Odds API:** At 15-minute intervals across a full game day, ~96 requests/day. Well within the 500/month free budget.

---

## Setup

```bash
# 1. Clone
git clone https://github.com/l9rins/PlusMinus.git
cd PlusMinus

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env

# 4. Add your API keys to .env (see below)

# 5. Run dev server
npm run dev
```

### Environment variables

```env
# BallDontLie API key — required for live scores, standings, player stats
# Free key at: https://www.balldontlie.io
VITE_BDLAPI_KEY=your_balldontlie_key

# The Odds API key — optional, enables real market-derived win probabilities
# Free key at: https://the-odds-api.com
VITE_ODDS_API_KEY=your_odds_api_key
```

**Without any keys:** The entire app renders using static fallback data from `data.js`. A `NoApiKey` card tells users what to do.

**With BDL key only:** Live scores, standings, player stats. Win probabilities default to 42% away / 58% home (home court prior) until odds load.

**With both keys:** Full live data. Win probabilities derived from real moneyline odds on every scheduled game, merged into game tiles via `mergeOddsIntoGames()`.

---

## Project structure

```
PlusMinus/
├── .env.example              # Documents both required env vars
├── index.html                # Vite entry, Google Fonts loaded here
├── tailwind.config.js        # Full design token system (pitch palette, tier colors, accent)
├── vite.config.js
├── package.json
├── public/
│   ├── favicon.svg
│   └── og-image.png
└── src/
    ├── main.jsx              # React root, QueryClient instantiation
    ├── App.jsx               # Tab routing, search query state threading
    ├── api.js                # ALL data fetching lives here — no fetch calls in components
    ├── data.js               # Static fallback data — 30 teams, 30 players, sample odds
    ├── utils.js              # Pure functions: calcPL, oddsToImplied, signed, clamp, BET_STORAGE_KEY
    ├── index.css             # Design system: pm-tile, pm-card, pm-label, pm-badge, pm-stat-bar
    └── components/
        ├── TopNav.jsx        # Sticky nav, hover dropdowns, search bar (Enter → Players tab)
        ├── Dashboard.jsx     # Overview dashboard
        ├── Views.jsx         # Scores, Standings, Betting, BetTracker
        ├── Players.jsx       # Player browse + full-database search
        ├── Analytics.jsx     # Four Factors, Elo Ratings, Shot Quality
        └── ui.jsx            # Shared primitives: Skeleton, TileSkeleton, RowSkeleton, Spinner, ErrorState, NoApiKey, FreshnessTag
```

---

## Architecture decisions (important for AI assistants)

**1. All data fetching is in `api.js` only.**
Components never call `fetch()` directly. They import hooks (`useStandings`, `useTodayGames`, `useOdds`, `usePlayers`, `usePlayerSearch`). This is a hard rule — do not add fetch calls to components.

**2. Every hook has `placeholderData` from `data.js`.**
This means components always receive data immediately on mount. There is no "undefined on first render" problem for static roster data. The only exception is `useOdds`, which is `enabled: !!ODDS_API_KEY` — it never fires without a key.

**3. Two separate refresh cadences.**
`useTodayGames` refetches every 2 minutes (live scores change constantly). `useOdds` refetches every 15 minutes (lines move slowly, budget is limited). These are intentionally different — do not synchronize them.

**4. Win probability merging.**
`useOdds` returns a lookup object keyed by `"AWAY@HOME"` (e.g. `"GSW@BOS"`). The helper `mergeOddsIntoGames(games, odds)` merges these into game tiles — only for scheduled games, not live or final. Default is 42/58.

**5. BallDontLie player IDs.**
BDL uses its own sequential integer IDs — NOT NBA.com IDs. The `PLAYER_IDS` map in `api.js` contains verified BDL IDs for the 15 players in the static roster. Search results use BDL IDs returned dynamically.

**6. Bet persistence.**
`BET_STORAGE_KEY` is exported from `utils.js` — import it, never hardcode the string. `saveBets()` dispatches a synthetic `StorageEvent` so same-tab listeners (Dashboard bet stats tile) update immediately without a page reload.

**7. `loadBets` behavior.**
Returns `DEMO_BETS` only when `localStorage.getItem(BET_STORAGE_KEY)` returns `null` (first visit, key never set). Returns an empty array when the user has cleared all bets. This distinction matters — `null` vs `"[]"` are different states.

**8. Shot Quality fallback.**
`computeShotQuality` in `Analytics.jsx` accepts `players` with a default of the static `PLAYERS` array. The call site uses `playersData ?? PLAYERS` to handle the case where `usePlayers()` hasn't resolved yet.

**9. `initialQuery` in Players.**
`App.jsx` passes `initialQuery` to `<Players>` when the user searches from TopNav. A `useEffect` inside `Players` syncs `query` state whenever `initialQuery` changes. This handles re-renders without unmounting the component.

---

## Key computed models

### Betting edge
```
modelP     = team's season win% × 100 (minimum 10 games played)
impliedP   = vig-removed market probability from moneyline odds
edge       = modelP − impliedP
★ EDGE     = diff ≥ 10%
MOD        = diff ≥ 5%
```
This is a directional signal, not a sophisticated model. Always bet responsibly.

### Elo ratings
Standard Elo starting at 1500, K-factor 20, logistic distribution. Tiers: Championship (1640+), Contender (1560+), Playoff (1480+), Lottery (1400+), Rebuild (<1400). Trajectories are simulated from win% with minor variance for visual realism.

### Four Factors
Dean Oliver's model derived from win%: eFG%, TOV%, ORB%, FT Rate. Net Rating = best roster player's O-RTG minus D-RTG. All values are proxies — documented in the methodology footnote in the UI.

---

## Tech stack

| | Version |
|---|---|
| React | 18.3.1 |
| Vite | 5.3.4 |
| Tailwind CSS | 3.4.7 |
| Recharts | 2.12.7 |
| @tanstack/react-query | 5.40.0 |
| framer-motion | 11.3.0 |
| lucide-react | 0.383.0 |

---

## Deployment

### Netlify
1. Connect GitHub repo
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Site settings → Environment variables → add `VITE_BDLAPI_KEY` and `VITE_ODDS_API_KEY`

### Vercel
1. Import project from GitHub
2. Framework preset: Vite (auto-detected)
3. Environment variables: add both keys
4. Deploy

Both platforms auto-redeploy on push to `main`.

---

## License

MIT