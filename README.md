# ± PlusMinus

**NBA analytics platform** — live scores, standings, player stats, betting edge finder, Elo ratings, and win probability models.

Built with React + Vite. Styled with Tailwind CSS. Charts from Recharts. Data from BallDontLie + The Odds API.

---

## Features

| Tab | What it does |
|-----|-------------|
| **Dashboard** | Overview tiles (games today, top edge, best win prob, tracked bets), tonight's scores, mini standings |
| **Scores** | Full game grid with live scores, win probabilities, spreads, and over/under |
| **Standings** | East/West conference tables with W-L, PCT, streaks, home/road splits |
| **Players** | Searchable player cards with advanced metrics (PER, TS%, BPM, VORP, O/D-RTG), expandable stat bars |
| **Betting** | Edge finder (model vs. implied probability), full bet tracker with inline result editing, P&L chart |
| **Analytics** | Four Factors efficiency table, Elo power rankings with trajectory chart, Shot Quality radar profiles |

## Data sources

| Source | What | Tier | Refresh |
|--------|------|------|---------|
| [BallDontLie](https://www.balldontlie.io) | Scores, standings, player stats | Free | 2 min (scores), 10 min (standings), 1 hr (players) |
| [The Odds API](https://the-odds-api.com) | Moneyline odds → win probabilities | Free (500 req/mo) | 15 min |
| Static (`data.js`) | Advanced player metrics, fallback standings | Built-in | — |

## Setup

```bash
# Clone
git clone https://github.com/l9rins/PlusMinus.git
cd PlusMinus

# Install
npm install

# Configure API keys
cp .env.example .env
# Edit .env with your keys (see below)

# Run
npm run dev
```

### Environment variables

Create a `.env` file in the project root:

```env
# BallDontLie API key (required for live data)
# Sign up: https://www.balldontlie.io
VITE_BDLAPI_KEY=your_balldontlie_key

# The Odds API key (optional — enables real win probabilities)
# Sign up: https://the-odds-api.com
VITE_ODDS_API_KEY=your_odds_api_key
```

**Without API keys:** The app still works — all views render using static fallback data from `data.js`. The `API KEY REQUIRED` card tells you exactly what to do.

**With BDL key only:** Live scores, standings, and player stats. Win probabilities default to 42/58 (home court prior).

**With both keys:** Full live data including real market-derived win probabilities on every scheduled game.

## Architecture

```
src/
├── api.js            # All data hooks (useStandings, useTodayGames, useOdds, usePlayers)
├── data.js           # Static fallback data (30 teams, 30 players, sample games/odds)
├── utils.js          # Pure utilities (calcPL, oddsToImplied, signed, clamp)
├── main.jsx          # React entry + QueryClient
├── App.jsx           # Tab routing + search state
├── index.css         # Design system (pm-tile, pm-card, pm-label, pm-badge, etc.)
└── components/
    ├── TopNav.jsx     # Navigation bar with search
    ├── Dashboard.jsx  # Overview dashboard
    ├── Views.jsx      # Scores, Standings, Betting, BetTracker
    ├── Players.jsx    # Player cards with expandable stats
    ├── Analytics.jsx  # Four Factors, Elo Ratings, Shot Quality
    └── ui.jsx         # Shared primitives (skeletons, error states, spinners)
```

### Key design decisions

- **Data layer separation**: All API calls live in `api.js`. Components only see hooks.
- **Graceful degradation**: Every hook has `placeholderData` from `data.js`. No API key? Static data. API down? Fallback data. No crashes.
- **Separate refresh cadences**: Scores every 2 min (games are live), odds every 15 min (lines move slowly, 500 req/mo budget), standings every 10 min, players hourly.
- **Computed analytics**: Four Factors and Elo derive from win% (documented in methodology footnotes). Shot Quality derives from player stats. All three compute functions accept data as arguments — plug in any source.
- **Bet persistence**: Bets save to `localStorage` with cross-tab sync via `StorageEvent`.

## Tech stack

| | |
|---|---|
| **Framework** | React 18 |
| **Build** | Vite 5 |
| **Styling** | Tailwind CSS 3 |
| **Charts** | Recharts 2 |
| **Data** | @tanstack/react-query 5 |
| **Animations** | framer-motion 11 |
| **Icons** | lucide-react |
| **Fonts** | Bebas Neue, DM Sans, DM Mono |

## Deployment

### Netlify

1. Connect GitHub repo
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Environment variables: Add `VITE_BDLAPI_KEY` and `VITE_ODDS_API_KEY`

### Vercel

1. Import project
2. Framework: Vite
3. Environment variables: Add both API keys

## License

MIT