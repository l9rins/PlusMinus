# ± PlusMinus — NBA Analytics & Bet Tracking

Real-time NBA analytics, multi-book odds comparison, player prop tracking, and AI-powered bet analysis. Built with React + Vite, deployed on Vercel.

---

## Features

### Data & Analytics
- **Live scores** — ESPN free API, 30s refresh during live games, auto-slows to 10min when no games
- **Standings** — sortable, conference toggle, play-in markers
- **Player stats** — enriched NBA Stats API data (base + advanced merged), search, radar charts
- **Elo ratings** — server-computed power rankings with trajectory charts
- **Team analytics** — four factors, net rating tiers, shot quality radar
- **Head-to-head** — Elo win probability arc, dual radar, star player clash, home court toggle
- **Play-by-play** — ESPN summary endpoint, 30s poll, scoring play highlights

### Betting
- **Edge finder** — model win probability vs implied odds across 8 books
- **Arbitrage detection** — flags guaranteed-profit opportunities across books
- **Line shopping** — per-book odds breakdown on every game
- **Player props** — 5 markets (Points, Rebounds, Assists, 3-Pointers, Blks+Stls), best-book display
- **Line movement** — detects ≥0.5 point moves between cached snapshots
- **Prop history** — last 10 games vs current line with hit/miss visualization
- **AI bet analysis** — Claude Haiku gives verdict (value/fair/avoid), confidence, edge summary, risk factors

### Bet Tracking
- **Unified tracker** — game bets, prop bets, and parlays in one log
- **Unit system** — configurable unit size (% of bankroll), all P/L displayed in $ and units
- **Kelly criterion** — suggested stake on every bet form
- **Historical dashboard** — monthly P/L bar chart, cumulative ROI trend, streak tracker, book performance
- **CSV export** — full bet history download
- **Parlay builder** — multi-leg with live combined odds calculator

### Infrastructure
- **Push notifications** — browser Notifications API, polls `/api/notify` for game starts + line moves scoped to pending bets
- **Offline mode** — Workbox runtime caching, app loads from cache without network
- **Error telemetry** — structured error log to Vercel KV, 100-entry ring buffer
- **Light/dark mode** — full light theme via `html.light` CSS class

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, TailwindCSS, Framer Motion |
| Data fetching | TanStack React Query |
| Auth | Clerk |
| API | Vercel Serverless Functions (Node.js ESM) |
| Storage | Vercel KV (Redis) |
| Routing | React Router v6 |
| Charts | Recharts |
| Icons | Lucide React |
| Testing | Vitest + jsdom |
| PWA | vite-plugin-pwa + Workbox |

---

## Data Sources

| Source | Used For | Key Required |
|--------|----------|-------------|
| ESPN Site API | Scores, standings, schedule, play-by-play | No |
| NBA Stats API | Player stats, team stats, game logs | No |
| The Odds API | Moneyline odds, player props | Yes — `ODDS_API_KEY` |
| BallDontLie | Player search | Yes — `BDL_API_KEY` |
| Anthropic API | AI bet analysis | Yes — `ANTHROPIC_API_KEY` |

---

## Project Structure

```
PlusMinus/
├── api/                        # Vercel serverless functions
│   ├── _cors.js                # CORS headers + origin whitelist
│   ├── analyze.js              # AI bet analysis (Anthropic)
│   ├── bdl.js                  # BallDontLie proxy (player search)
│   ├── bets.js                 # Bet CRUD (GET + PUT)
│   ├── bets/
│   │   └── [id].js             # DELETE /api/bets/:id
│   ├── config.js               # Feature flags + Odds API credit monitor
│   ├── elo.js                  # Server-side Elo computation
│   ├── espn.js                 # ESPN proxy
│   ├── log.js                  # Error telemetry (ring buffer → KV)
│   ├── nba.js                  # NBA Stats API proxy
│   ├── notify.js               # Notification payload generator
│   ├── odds.js                 # The Odds API — h2h moneyline
│   └── props.js                # The Odds API — player props
│
├── public/
│   └── icons/                  # PWA icons (192, 512)
│
└── src/
    ├── App.jsx                 # Root, routing, keyboard shortcuts, ErrorBoundary
    ├── api.js                  # All React Query hooks + fetchers
    ├── data.js                 # Static fallbacks, TEAM_COLORS, TEAM_NAMES
    ├── index.css               # Global styles, pm-* components, light theme
    ├── main.jsx                # React root, SW registration, error listener
    ├── utils.js                # Pure functions — odds math, formatting, unit system
    ├── utils.test.js           # Vitest test suite (~80 cases)
    │
    ├── components/
    │   ├── Analytics.jsx       # Power index, four factors, Elo, playoff sim
    │   ├── Dashboard.jsx       # Overview — scores, standings, Kelly tile
    │   ├── HeadToHead.jsx      # Team comparison view
    │   ├── Players.jsx         # Player browser + search
    │   ├── PlayoffBracket.jsx  # Monte Carlo bracket
    │   ├── TeamDetail.jsx      # Team page with schedule + stats
    │   ├── TopNav.jsx          # Navigation, mobile drawer, theme toggle
    │   ├── Views.jsx           # Scores, Standings, Betting, BetTracker,
    │   │                       # PropsBrowser, HistoricalDashboard, PlayByPlay,
    │   │                       # BetAnalysisPanel
    │   └── ui.jsx              # Shared: TileSkeleton, ErrorState, Toast, etc.
    │
    ├── hooks/
    │   └── useNotifications.js # Browser Notifications API polling hook
    │
    └── workers/
        └── playoffWorker.js    # Web Worker for Monte Carlo sim
```

---

## Environment Variables

Set these in your Vercel project dashboard under **Settings → Environment Variables**.

```bash
# Required for all features
CLERK_SECRET_KEY=sk_...
CLERK_PUBLISHABLE_KEY=pk_...   # set in Vite via VITE_CLERK_PUBLISHABLE_KEY

# Required for Vercel KV (bet storage, snapshots, telemetry)
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...

# Required for odds + props
ODDS_API_KEY=...

# Required for player search
BDL_API_KEY=...

# Required for AI bet analysis
ANTHROPIC_API_KEY=sk-ant-...

# Optional — locks CORS to your production domain
PRODUCTION_ORIGIN=https://your-app.vercel.app

# Optional — protects the GET /api/log endpoint
ADMIN_TOKEN=some-secret-string
```

---

## Local Development

```bash
# Install dependencies
npm install

# Start with Vercel CLI (recommended — runs serverless functions locally)
vercel dev

# Or start Vite only (no API functions)
npm run dev

# Run tests
npx vitest run

# Build for production
npm run build
```

> **Note:** `vercel dev` requires the [Vercel CLI](https://vercel.com/docs/cli) and a linked project (`vercel link`). All environment variables must be set in your Vercel project or in a local `.env` file.

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/config` | None | Feature flags + Odds API credits |
| GET | `/api/espn` | None | ESPN proxy (scores, standings, schedule) |
| GET | `/api/nba` | None | NBA Stats API proxy |
| GET | `/api/elo` | None | Server-computed Elo ratings |
| GET | `/api/odds` | None | Multi-book h2h moneyline odds |
| GET | `/api/props` | None | Player prop lines — all 5 markets |
| GET | `/api/bdl` | None | BallDontLie player search |
| GET | `/api/notify` | Clerk JWT | Notification payloads for pending bets |
| GET | `/api/bets` | Clerk JWT | Fetch saved bets from KV |
| PUT | `/api/bets` | Clerk JWT | Save full bet array to KV |
| DELETE | `/api/bets/:id` | Clerk JWT | Delete single bet by ID |
| POST | `/api/analyze` | Clerk JWT | AI analysis of a bet (rate limited 1/10s) |
| POST | `/api/log` | None | Ingest client error |
| GET | `/api/log` | Admin token | Read error log (last 100 entries) |

---

## Keyboard Shortcuts

| Key | View |
|-----|------|
| `D` | Dashboard |
| `S` | Scores |
| `P` | Players |
| `B` | Betting |
| `T` | Bet Tracker |
| `A` | Analytics |
| `C` | Compare |
| `H` | History |
| `L` | Live Feed |

---

## Bet Schema

All bets are stored as JSON arrays in Vercel KV under `bets:{userId}`.

```typescript
// Game bet
{
  id:      string;        // UUID
  type:    "game";
  stake:   number;        // dollars
  odds:    number;        // american (-110, +150)
  result:  "win" | "loss" | "push" | "pending";
  units?:  number;        // unit size snapshot at log time
  matchup?: string;       // e.g. "BOS@LAL"
  team?:   string;        // 3-letter abbr
  book?:   string;        // bookmaker key
  date?:   string;        // YYYY-MM-DD
  note?:   string;
}

// Prop bet (extends game bet)
{
  type:       "prop";
  player:     string;
  playerTeam: string;
  market:     "player_points" | "player_rebounds" | "player_assists"
            | "player_threes" | "player_blocks_steals";
  side:       "over" | "under";
  line:       number;
}

// Parlay (extends game bet)
{
  type:     "parlay";
  legCount: number;
  legs: [{
    desc:    string;       // human-readable leg description
    odds:    number;
    result?: "win" | "loss" | "push" | "pending";
    team?:   string;
    player?: string;
    market?: string;
    side?:   string;
    line?:   number;
  }];
}
```

---

## Testing

```bash
npx vitest run        # single run
npx vitest            # watch mode
npx vitest --coverage # coverage report
```

Test coverage:
- Odds converters (`oddsToDecimal`, `oddsToImplied`, `impliedToOdds`)
- Financial math (`calcPL`, `calcROI`, `kellyBet`, `breakEven`)
- Unit system (`getUnitSize`, `stakeToUnits`, `unitsToDollars`, `plInUnits`)
- Parlay combined odds math
- Prop history hit-rate math
- Date helpers (`todayStr`, `formatShortDate`, `formatGameTime`)
- Formatters (`formatCurrency`, `formatPct`, `compactNumber`, `signed`)
- Analytics (`netRatingTier`, `edgeLabel`)
- Utilities (`clamp`, `lerp`, `sum`, `avg`, `groupBy`, `deepClone`)
- LocalStorage helpers (`lsGet`, `lsSet`, `lsRemove`)

---

## Security Notes

- **CORS** — origin whitelist in `api/_cors.js`. Set `PRODUCTION_ORIGIN` to lock to your domain. Wildcard (`*`) is explicitly rejected.
- **Bet validation** — `api/bets.js` reconstructs every bet from an allowlist before writing to KV. Unknown fields and oversized strings are stripped.
- **Prop endpoint** — `api/bdl.js` normalizes paths before prefix check to prevent path traversal.
- **NBA proxy** — `api/nba.js` whitelists query parameters per endpoint to prevent cache-busting attacks.
- **AI rate limit** — `api/analyze.js` enforces 1 request per 10 seconds per user via KV timestamp.
- **Error log** — `GET /api/log` requires `ADMIN_TOKEN` header. Never exposed in client code.
- **Clerk tokens** — verified server-side on every authenticated endpoint. Never trusted client-side claims.

---

## License

MIT