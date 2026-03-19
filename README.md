# ± PlusMinus

A dark-themed NBA analytics platform built with React 18 and Vite. Live scores and standings from ESPN's free API, real-time multi-book betting odds, Monte Carlo playoff simulations, player analytics, and a full bet tracker — all in one dashboard.

**Live:** [plusminus.vercel.app](https://plusminus.vercel.app)

---

## What this is

PlusMinus is a personal NBA analytics dashboard. It pulls live game data from ESPN's public API (no key required), overlays real moneyline odds from up to 8 bookmakers, and layers computed models on top — Elo ratings, Four Factors efficiency, shot quality radar charts, and a 10,000-iteration Monte Carlo playoff simulation. Every view degrades gracefully to static fallback data when APIs are unavailable.

---

## Features

| Tab | What it does |
|-----|-------------|
| **Dashboard** | Today's game tiles with live win probabilities, Kelly bet sizing, mini standings (East/West), P&L summary from bet tracker. |
| **Scores** | Full game grid — live scores, win probabilities, spread/total, per-book best line with line shopping breakdown. Filters for live / upcoming / final. |
| **Standings** | East and West conference tables — W, L, PCT, GB, L10, Home, Road, Streak. Live from ESPN. Sortable columns, play-in badges. |
| **Players** | Static 30-player roster with expandable advanced metric cards (PER, TS%, BPM, VORP, O-RTG, D-RTG), mini SVG radar charts, side-by-side compare mode, keyboard navigation. Full-database search via BallDontLie. |
| **Betting** | Multi-book edge finder — model win% vs. vig-removed market probability. Arbitrage detection. Kelly criterion bet sizing. Best line per book. |
| **Bet Tracker** | Log, edit, and delete bets. Inline result editing. Cumulative P&L chart. Win rate by bet type. CSV export. All bets persist in localStorage. |
| **Analytics** | Five tabs: Power Index (composite), Four Factors (Dean Oliver), Elo Ratings (trajectory chart), Shot Quality (radar profiles), Playoff Sim (Monte Carlo bracket). |

---

## Data sources

| Source | What it provides | Auth | Refresh |
|--------|-----------------|------|---------|
| [ESPN API](https://site.web.api.espn.com) | Standings, live scoreboard | None — completely free | Standings: 10 min · Games: 1 min |
| [The Odds API](https://the-odds-api.com) | NBA moneyline odds across 8 books | Free key (500 req/month) | 15 min |
| [BallDontLie](https://app.balldontlie.io) | Player name search | Free key (requires account) | On search |
| `src/data.js` | Fallback standings, fallback games, 30-player roster with advanced metrics | Built-in static | Never fetched |

**Zero required API keys.** Standings and live scores work with no setup at all — ESPN is fully unauthenticated. The Odds API and BallDontLie keys are optional enhancements.

---

## Setup

```bash
# 1. Clone
git clone https://github.com/l9rins/PlusMinus.git
cd PlusMinus

# 2. Install
npm install

# 3. Dev server
npm run dev
```

The app runs fully without any API keys. To enable live odds and player search, add keys to Vercel's environment variables (see Deployment below).

---

## Environment variables

These are **server-side only** — set in Vercel's dashboard, never in `.env` committed to git. No `VITE_` prefix.

```
BDL_API_KEY      = your_balldontlie_key    # enables player search
ODDS_API_KEY     = your_odds_api_key       # enables live betting odds
```

**Without any keys:** App runs fully on ESPN data (standings, live scores) + static roster. Betting tab shows sample edge data with a banner explaining the key setup.

**With `ODDS_API_KEY`:** Live multi-book odds, vig-removed probabilities, arbitrage detection, Kelly bet sizing on real lines.

**With `BDL_API_KEY`:** Player name search across the full NBA database. Note: BallDontLie season averages are behind a paywall — the app uses the free `/players` search endpoint only.

---

## Architecture

### Serverless proxy pattern

All API keys live server-side in Vercel functions. The browser never sees a key.

```
Browser → /api/espn  → site.web.api.espn.com  (no key needed)
Browser → /api/odds  → api.the-odds-api.com   (ODDS_API_KEY)
Browser → /api/bdl   → api.balldontlie.io     (BDL_API_KEY)
Browser → /api/config → returns {hasEspn, hasBdl, hasOdds} feature flags
```

### Project structure

```
PlusMinus/
├── api/
│   ├── bdl.js          # BallDontLie proxy — player search only
│   ├── config.js       # Feature flags — which keys are configured
│   ├── espn.js         # ESPN proxy — standings + scoreboard
│   └── odds.js         # Odds API proxy — multi-book h2h odds + arb detection
├── src/
│   ├── App.jsx         # React Router v6, lazy imports, error boundaries
│   ├── api.js          # All hooks: useStandings, useTodayGames, useOdds, usePlayers, usePlayerSearch
│   ├── data.js         # Static fallback data — 30 teams, 30 players, sample odds
│   ├── index.css       # Design system — pm-tile, pm-card, pm-badge, pitch palette, tier colors
│   ├── utils.js        # Pure functions — calcPL, kellyBet, oddsToImplied, breakEven, lsGet/lsSet
│   └── components/
│       ├── Analytics.jsx   # Power Index, Four Factors, Elo, Shot Quality, Playoff Sim
│       ├── Dashboard.jsx   # Overview dashboard
│       ├── Players.jsx     # Player browse + search, radar charts, compare mode
│       ├── TopNav.jsx      # Sticky nav, dropdowns, search, keyboard shortcuts
│       ├── Views.jsx       # Scores, Standings, Betting, BetTracker
│       └── ui.jsx          # Shared primitives — skeletons, toasts, error states, FreshnessTag
├── vercel.json         # SPA rewrites + edge cache headers
└── vite.config.js      # Vitest config
```

### Key architecture rules

**All fetching is in `api.js`.** Components never call `fetch()` directly. They import hooks. This is a hard rule.

**Every hook has `placeholderData`.** Components always receive data on mount — no undefined-on-first-render problems. Static data from `data.js` is the floor.

**ESPN response reshaping.** ESPN's standings live at `site.web.api.espn.com/apis/v2/sports/basketball/nba/standings` (not `site.api.espn.com` — different subdomain, different path). Records use numeric `id` fields (`"33"` = Home, `"34"` = Road, `"901"` = L10). Abbreviation map: `SA→SAS`, `WSH→WAS`, `NY→NYK`, `GS→GSW`, `NO→NOP`.

**Deterministic Monte Carlo.** The playoff sim uses a seeded LCG (`makeLCG`) rather than `Math.random()`. Same standings always produce identical simulation results — no visual flicker on re-renders.

**Win probability merging.** `useOdds()` returns a lookup keyed by `"AWAY@HOME"`. `mergeOddsIntoGames(games, odds)` merges only into scheduled games — live and final games keep their scores.

**Bet persistence.** `BET_STORAGE_KEY` exported from `utils.js`. `lsSet` dispatches a synthetic `StorageEvent` so the Dashboard P&L tile updates instantly without a page reload.

---

## Analytics models

### Playoff Simulation
10,000 Monte Carlo iterations using Elo win probability per game. Seeds 1–6 advance directly; seeds 7–10 play the real NBA play-in format. Best-of-7 series with a 35-point home-court Elo advantage. LCG-seeded for deterministic results. Outputs: playoff %, R2 %, Conf Finals %, Finals %, Championship % per team.

### Elo Ratings
Standard Elo starting at 1500, K=20, logistic distribution. Tiers: Championship (1640+), Contender (1560+), Playoff (1480+), Lottery (1400+), Rebuild (<1400). Season trajectory simulated from W-L record with seeded micro-variance.

### Four Factors
Dean Oliver's framework — eFG%, TOV%, ORB%, FT Rate — derived as proxies from win% with per-team seeded noise. Net Rating anchored to best roster player's O-RTG/D-RTG from static data.

### Power Index
Composite: 40% Elo + 35% Net Rating + 25% Shot Quality. All three normalized to 0–100 before weighting.

### Betting Edge
`edge = modelP − impliedP` where modelP = season win% and impliedP = vig-removed best-line probability. Threshold: HIGH (≥10%), MOD (≥5%). Arbitrage flagged when `1/bestHomeDecimal + 1/bestAwayDecimal < 1`.

### Kelly Criterion
½-Kelly for safety, capped at 25% of bankroll. Formula: `k = (b×p − q) / b`, halved, then `× bankroll`. Dollar amount rounded to nearest dollar.

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `D` | Dashboard |
| `S` | Scores |
| `L` | Standings |
| `P` | Players |
| `B` | Betting |
| `T` | Bet Tracker |
| `A` | Analytics |
| `/` | Open search |

Shortcuts fire when no input is focused.

---

## Tech stack

| | |
|---|---|
| React 18 + Vite | Core framework + bundler |
| React Router v6 | Client-side routing, SPA deep links |
| TanStack Query v5 | Data fetching, caching, stale-while-revalidate |
| Tailwind CSS 3 | Utility-first styling |
| Framer Motion | Page transitions, tile animations |
| Recharts | Bar, area, radar charts |
| Lucide React | Icons |
| Vitest | Unit tests (`src/utils.test.js`) |

---

## Deployment (Vercel)

1. Import repo from GitHub at [vercel.com/new](https://vercel.com/new)
2. Framework preset: **Vite** (auto-detected)
3. Settings → Environment Variables → add `BDL_API_KEY` and `ODDS_API_KEY` (no `VITE_` prefix)
4. Deploy — Vercel auto-deploys on every push to `main`

The `vercel.json` handles SPA rewrites (so `/standings` doesn't 404 on refresh) and sets edge cache headers on API routes.

---

## What's next

Ranked by effort vs. impact:

**Short (1–2 hours each)**
- Bundle size — `npm run build` still warns about chunk size. Fix: `manualChunks` in `vite.config.js` to split Recharts and Framer Motion into separate vendor chunks.
- Real player search — get a working BallDontLie key from `app.balldontlie.io`. The code is already wired up; it's just a key issue.
- Streak coloring in standings — ESPN returns `W5` / `L3` strings. Could color-code hot/cold streaks with tier colors.

**Medium (half a day)**
- Team detail page — clicking a team in standings or scores navigates to `/team/OKC` showing their schedule, recent form, and how their Elo has trended. Uses existing data + ESPN schedule endpoint.
- Playoff bracket UI — the sim already produces round-by-round probabilities. A visual bracket (8 slots per conference, probability percentages on each matchup) would make the data much more readable than the table.
- Dark/light mode toggle — CSS custom properties are already set up for theming via `--theme-accent`. A global `data-theme` attribute on `<html>` could flip the pitch palette.

**Large (full day+)**
- Push notifications — service worker + Web Push API to alert when a game goes live or a high-edge bet is detected. Would require a small backend or Vercel cron.
- Historical bet analytics — currently only shows current session stats. Export + re-import, or a Vercel KV store, would enable season-long tracking across devices.
- Live play-by-play — ESPN has a play-by-play endpoint. Could add a game detail modal with a live feed during in-progress games.

---

## License

MIT