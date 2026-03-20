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
| **Dashboard** | Today's game tiles with live win probabilities, Kelly bet sizing on real odds lines, mini standings (East/West), P&L summary from bet tracker. |
| **Scores** | Full game grid — live scores, win probabilities, spread/total, per-book best line with line shopping breakdown. Filters for live / upcoming / final. Arbitrage badge when cross-book opportunity exists. |
| **Standings** | East and West conference tables — W, L, PCT, GB, L10, Home, Road, Streak. Live from ESPN. Sortable columns, play-in badges. |
| **Players** | Static 30-player roster with expandable advanced metric cards (PER, TS%, BPM, VORP, O-RTG, D-RTG), mini SVG radar charts, side-by-side compare mode, keyboard navigation. Full-database search via BallDontLie. |
| **Betting** | Multi-book edge finder — model win% vs. vig-removed market probability. Arbitrage detection across books. Kelly criterion bet sizing on real odds. Per-book line breakdown. |
| **Bet Tracker** | Log, edit, and delete bets. Inline result editing. Cumulative P&L chart. Win rate by bet type. CSV export. Demo bets pre-loaded for new users. All bets persist in localStorage. |
| **Analytics** | Five tabs: Power Index (composite), Four Factors (Dean Oliver), Elo Ratings (trajectory chart), Shot Quality (radar profiles), Playoff Sim (Monte Carlo bracket with visual bracket UI). |
| **Team Detail** | Full team page at `/team/:abbR` — season Elo trajectory chart, star player card, recent results, upcoming schedule, play-in indicator. Dynamic team accent color theming. |

---

## Data sources

| Source | What it provides | Auth | Refresh |
|--------|-----------------|------|---------|
| [ESPN API](https://site.web.api.espn.com) | Standings, live scoreboard, team schedules | None — completely free | Standings: 10 min · Games: 1 min · Schedules: 5 min |
| [The Odds API](https://the-odds-api.com) | NBA moneyline odds across 8 books | Free key (500 req/month) | 15 min |
| [BallDontLie](https://app.balldontlie.io) | Player name search | Free key (requires account) | On search |
| `src/data.js` | Fallback standings, fallback games, 30-player roster with advanced metrics | Built-in static | Never fetched |

**Zero required API keys.** Standings, live scores, and team schedules work with no setup — ESPN is fully unauthenticated. The Odds API and BallDontLie keys are optional enhancements.

---

## Setup

```bash
# 1. Clone
git clone https://github.com/l9rins/PlusMinus.git
cd PlusMinus

# 2. Install
npm install

# 3. Dev server (Vercel CLI — recommended, serves /api functions locally)
npm run dev

# 4. Run tests
npm test
```

The app runs fully without any API keys. To enable live odds and player search, add keys to Vercel's environment variables (see Deployment below).

---

## Environment variables

These are **server-side only** — set in Vercel's dashboard, never in a `.env` file committed to git. No `VITE_` prefix.

```
BDL_API_KEY        = your_balldontlie_key    # enables player search
ODDS_API_KEY       = your_odds_api_key       # enables live betting odds
PRODUCTION_ORIGIN  = https://yourdomain.com  # CORS allowlist for custom domain
```

**Without any keys:** App runs fully on ESPN data (standings, live scores, team schedules) + static roster. Betting tab shows sample edge data with a banner explaining the key setup.

**With `ODDS_API_KEY`:** Live multi-book odds, vig-removed probabilities, arbitrage detection, Kelly bet sizing on real lines. 500 free requests/month — edge-cached at 15 min to stay well within limits.

**With `BDL_API_KEY`:** Player name search across the full NBA database. Note: BallDontLie season averages are behind a paywall — the app uses the free `/players` search endpoint only.

**`PRODUCTION_ORIGIN`:** Optional. If you're deploying to a custom domain, set this so the CORS allowlist in `api/_cors.js` recognises it. Vercel preview deployments (`.vercel.app`) are already covered automatically.

---

## Architecture

### Serverless proxy pattern

All API keys live server-side in Vercel functions. The browser never sees a key. CORS is enforced with exact-match origin checking — no `.includes()` substring bypass.

```
Browser → /api/espn   → site.web.api.espn.com  (no key needed)
Browser → /api/odds   → api.the-odds-api.com   (ODDS_API_KEY)
Browser → /api/bdl    → api.balldontlie.io     (BDL_API_KEY)
Browser → /api/config → returns {hasEspn, hasBdl, hasOdds} feature flags
```

All proxy responses set `Vary: Origin` to prevent edge cache from serving one origin's CORS headers to a different origin. The Odds API response is cached at the edge for 15 minutes (`s-maxage=900`) — this is the primary mechanism keeping the 500 req/month quota intact.

### CORS helper

`api/_cors.js` exports three functions shared by all four proxy handlers:

```js
isAllowedOrigin(origin)          // exact set + regex for Vercel preview URLs + PRODUCTION_ORIGIN env
setCORSHeaders(res, origin)      // sets Vary: Origin + Access-Control-Allow-Origin when allowed
handleOptions(req, res)          // handles OPTIONS preflight — returns true if handled
```

### Project structure

```
PlusMinus/
├── api/
│   ├── _cors.js        # Shared CORS helpers — single source of truth for allowed origins
│   ├── bdl.js          # BallDontLie proxy — player search, Retry-After forwarded on 429
│   ├── config.js       # Feature flags — which keys are configured server-side
│   ├── espn.js         # ESPN proxy — standings, scoreboard, team schedule
│   └── odds.js         # Odds API proxy — multi-book h2h odds + arb detection
├── src/
│   ├── App.jsx         # React Router v6, lazy imports, ErrorBoundary, useTeamTheme
│   ├── api.js          # All React Query hooks: useStandings, useTodayGames, useOdds,
│   │                   #   usePlayers, usePlayerSearch, useTeamSchedule, useServerConfig
│   ├── data.js         # Static fallback — 30 teams, 30 players, sample odds, TEAM_COLORS
│   ├── index.css       # Design system — pm-tile, pm-card, pm-badge, pitch palette, tier colors
│   ├── utils.js        # Pure functions — calcPL, kellyBet, currentSeason, oddsToImplied,
│   │                   #   breakEven, lsGet/lsSet, formatCurrency, todayStr, formatShortDate
│   ├── utils.test.js   # Vitest unit tests covering all utility functions
│   └── components/
│       ├── Analytics.jsx     # Power Index, Four Factors, Elo, Shot Quality, Playoff Sim
│       ├── Dashboard.jsx     # Overview — game tiles, Kelly tile, mini standings, P&L
│       ├── Players.jsx       # Browse + search, radar charts, compare mode, keyboard nav
│       ├── PlayoffBracket.jsx # SVG bracket rendered from Monte Carlo sim output
│       ├── TeamDetail.jsx    # /team/:abbr — schedule, Elo chart, star player, form strip
│       ├── TopNav.jsx        # Sticky nav, submenus, search bar, theme toggle, shortcuts
│       ├── Views.jsx         # Scores, Standings, Betting (edge finder), BetTracker
│       └── ui.jsx            # Skeletons, ErrorState, EmptyState, FreshnessTag, Toast, Tooltip
└── src/workers/
    └── playoffWorker.js  # Web Worker — 10,000 Monte Carlo playoff sims off the main thread
```

### Key architecture rules

**All fetching is in `api.js`.** Components never call `fetch()` directly. They import React Query hooks. This is a hard rule — it keeps caching, error handling, and retry logic in one place.

**Every hook has `placeholderData`.** Components always receive data on mount — no undefined-on-first-render problems. Static data from `data.js` is the floor. `useOdds` uses `placeholderData: {}` so odds merging never receives `undefined`.

**Retry policy excludes timeouts and rate limits.** `shouldRetry` returns false for status codes `401`, `429`, `503`, and `504`. A timed-out upstream (504) would otherwise retry twice more, burning 24 seconds of UI wait and Vercel compute.

**ESPN response reshaping.** ESPN's standings live at `site.web.api.espn.com/apis/v2/sports/basketball/nba/standings` (not `site.api.espn.com` — different subdomain, different path). Records use numeric `id` fields (`"33"` = Home, `"34"` = Road, `"901"` = L10). Abbreviation fix map: `SA→SAS`, `WSH→WAS`, `NY→NYK`, `GS→GSW`, `NO→NOP`, `PHO→PHX`.

**Playoff sim runs in a Web Worker.** 10,000 simulations would block the main thread for ~200ms. The worker receives `{ standings, eloData }` and posts the full result array back when done. The `Analytics` component uses a stable `standingsKey` string as the effect dependency — not the standings object reference — so the worker doesn't respawn on every background refetch. A `worker.onerror` handler ensures `isSimulating` never gets stuck `true` if the worker throws.

**Deterministic Monte Carlo.** The playoff sim uses a seeded LCG (`makeLCG`) rather than `Math.random()`. The seed uses safe 32-bit integer arithmetic — no large integer literals that would lose precision in IEEE-754 doubles. Same standings always produce identical simulation results.

**Play-in uses single-game elimination.** The NBA play-in is not a series. `simGame()` is used for the 7v8, 9v10, and loser-bracket games. `simSeries()` (best-of-7) is used for all proper playoff rounds.

**Win probability merging.** `useOdds()` returns a lookup keyed by `"AWAY@HOME"`. `mergeOddsIntoGames(games, odds)` merges only into `scheduled` games — live and final games keep their scores. `awayP` and `homeP` are `null` until odds load; components guard against this explicitly rather than showing `null%`.

**Kelly uses real odds lines.** Both the Dashboard `KellyTile` and the Betting edge cards use the actual best available odds for the favored side (`bestHomeOdds` / `bestAwayOdds`) rather than a hardcoded `-110`. The displayed bet size and the actual edge opportunity match.

**Bet persistence.** `BET_STORAGE_KEY = "bets_v2"` exported from `utils.js`. `lsSet` dispatches a synthetic `plusminus:storage` CustomEvent so the Dashboard P&L tile updates in the same tab without a page reload. `window.addEventListener("storage")` handles cross-tab sync.

**`currentSeason` lives in `utils.js`.** It's a pure date function with no React Query dependency. Keeping it in `api.js` would force the Vitest test environment to import the entire React Query module graph to test a one-liner. It imports cleanly in tests from `utils`.

---

## Analytics models

### Playoff Simulation
10,000 Monte Carlo iterations using Elo win probability per game. Seeds 1–6 advance directly; seeds 7–10 play the real NBA play-in format (single-game elimination). Best-of-7 series with a 35-point home-court Elo advantage per game. LCG-seeded for deterministic results. Output per team: playoff %, R2 %, Conf Finals %, Finals %, Championship %. Visual SVG bracket shows the most likely advancement path.

### Elo Ratings
Standard Elo starting at 1500, K=20, logistic distribution. Tiers: Championship (1640+), Contender (1560+), Playoff (1480+), Lottery (1400+), Rebuild (<1400). Season trajectory simulated from W-L record with seeded micro-variance to break linear correlation between teams.

### Four Factors
Dean Oliver's framework — eFG%, TOV%, ORB%, FT Rate — derived as proxies from win% with per-team seeded noise. Net Rating anchored to the best roster player's O-RTG/D-RTG from static data.

### Power Index
Composite: 40% Elo + 35% Net Rating + 25% Shot Quality. All three normalized to 0–100 before weighting.

### Betting Edge
`edge = modelP − impliedP` where `modelP` = season win% (for the favored side) and `impliedP` = vig-removed consensus probability for that same side. Both sides must reference the same team — comparing the favorite's model probability against the underdog's market probability is not an edge signal. Threshold: HIGH (≥10%), MOD (≥5%). Arbitrage flagged when `1/bestHomeDecimal + 1/bestAwayDecimal < 1` across different books.

### Kelly Criterion
½-Kelly for safety, capped at 25% of bankroll. Formula: `k = (b×p − q) / b`, halved, then `× bankroll`. Dollar amount rounded to nearest dollar. Uses actual best-available odds for the recommended side, not a fixed `-110` assumption.

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

Shortcuts fire when no input, textarea, or contentEditable element is focused. Meta/Ctrl/Alt combinations are ignored.

---

## Tech stack

| | |
|---|---|
| React 18 + Vite 5 | Core framework + bundler |
| React Router v6 | Client-side routing, SPA deep links |
| TanStack Query v5 | Data fetching, caching, stale-while-revalidate |
| Tailwind CSS 3 | Utility-first styling |
| Framer Motion 11 | Page transitions, tile animations |
| Recharts 2 | Bar, area, radar charts |
| Lucide React | Icons |
| Vitest | Unit tests (`src/utils.test.js`) |

### Bundle chunks

```
vendor     → react, react-dom, react-router-dom, lucide-react  (needed immediately on any route)
charts     → recharts                                           (lazy — only analytics/scores views)
animation  → framer-motion                                      (lazy — loaded after first paint)
```

---

## Deployment (Vercel)

1. Import repo from GitHub at [vercel.com/new](https://vercel.com/new)
2. Framework preset: **Vite** (auto-detected)
3. Settings → Environment Variables → add:
   - `BDL_API_KEY` — your BallDontLie key
   - `ODDS_API_KEY` — your The Odds API key
   - `PRODUCTION_ORIGIN` — your custom domain (e.g. `https://plusminus.app`) if not using the default Vercel URL
4. Deploy — Vercel auto-deploys on every push to `main`

The `vercel.json` handles SPA rewrites (so `/standings` doesn't 404 on hard refresh) and sets long-lived cache headers on hashed `/assets/` files. API route caching is controlled entirely by the serverless functions themselves — `vercel.json` does **not** override their `Cache-Control` headers.

---

## What's next

**Short (a few hours)**
- `null%` probability text in Scores — when odds haven't loaded yet, the win probability bar shows `null%`. A one-line guard fixes this.
- Proper light mode — the current toggle uses CSS `filter: invert` which inverts dynamic team color values set via JavaScript. A real implementation would swap a second set of `--pitch-*` CSS custom properties under a `.light` root class. The toggle already exists in `TopNav.jsx`; it just needs the CSS variable layer underneath it.
- Real notifications — the bell icon in the nav opens a panel with three hardcoded fake items. Connecting it to actual game state (live game alerts, high-edge detection) would require polling against the existing hooks.

**Medium (half a day)**
- Historical bet tracking — bets currently live only in `localStorage`, so they're device-specific and get cleared with browser data. Vercel KV or a lightweight backend would enable cross-device persistence and season-long analytics.
- Game detail modal — ESPN has a play-by-play endpoint. Tapping a game card could open a modal with a live feed during in-progress games.
- Push notifications — service worker + Web Push API to alert on live game starts or high-edge bets. Would need a Vercel cron or edge function to trigger.

**Large (full day+)**
- Real advanced stats — the 30-player roster and their advanced metrics are hand-curated static data. Replacing them with live BallDontLie season averages (requires a paid tier) or a scraped source would make the Analytics models significantly more accurate.
- Player prop betting — the Odds API supports player prop markets. Extending the Betting tab to props would require reshaping the odds proxy and a new edge-detection model.

---

## License

MIT