# ± PlusMinus — NBA Analytics Dashboard

A real-time NBA analytics platform built with React 18 + Vite, deployed on Vercel.

## Features

- **Live scores & standings** via ESPN (no API key required)
- **Multi-book odds** with arbitrage detection via The Odds API
- **Team efficiency** — Four Factors, Net Rating, O-RTG, D-RTG
- **Player analytics** — PIE, TS%, O-RTG, D-RTG, USG% from NBA Stats API
- **Power Index** — composite ranking from Elo + Net Rating + Shot Quality
- **Playoff simulator** — 10,000 Monte Carlo runs with play-in tournament
- **Bet tracker** — persistent across devices via Vercel KV + Clerk auth
- **Kelly criterion** — optimal stake sizing from live odds

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion |
| Data fetching | TanStack Query (React Query) |
| Auth | Clerk |
| Persistence | Vercel KV (Upstash Redis) |
| Deployment | Vercel |

## Data Sources

| Data | Source | Key required |
|---|---|---|
| Standings, scores, schedules | ESPN API (undocumented, free) | No |
| Multi-book odds, arb detection | [The Odds API](https://the-odds-api.com) | Yes |
| Team & player stats | NBA Stats API (stats.nba.com) | No |
| Player search | [BallDontLie API](https://www.balldontlie.io) | Yes (free tier) |

## Local development

### 1. Clone and install
```bash
git clone https://github.com/l9rins/plusminus.git
cd plusminus
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in the values:
```bash
cp .env.example .env.local
```

| Variable | Where to get it |
|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | [Clerk Dashboard](https://dashboard.clerk.com) → API Keys |
| `CLERK_SECRET_KEY` | Clerk Dashboard → API Keys |
| `KV_REST_API_URL` | Vercel Dashboard → Storage → your KV store |
| `KV_REST_API_TOKEN` | Same as above |
| `ODDS_API_KEY` | [The Odds API](https://the-odds-api.com) |
| `BDL_API_KEY` | [BallDontLie](https://www.balldontlie.io) |

> The app runs without `ODDS_API_KEY` and `BDL_API_KEY` — those features fall back to sample data. Clerk and KV are required for the bet tracker.

### 3. Run
```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Deployment

Push to `main` — Vercel deploys automatically.

Set all six environment variables in **Vercel → Project → Settings → Environment Variables** scoped to Production.

## API proxy architecture

All external API calls go through Vercel serverless functions in `/api/` — the client never calls external APIs directly. This keeps API keys server-side and allows edge caching.
```
/api/espn.js    — ESPN proxy (standings, scoreboard, team schedule)
/api/odds.js    — The Odds API proxy (multi-book h2h, arb detection)
/api/nba.js     — NBA Stats API proxy (team + player stats)
/api/bdl.js     — BallDontLie proxy (player search)
/api/bets.js    — KV-backed bet persistence (Clerk JWT auth)
```

## Keyboard shortcuts

| Key | Page |
|---|---|
| `D` | Dashboard |
| `S` | Scores |
| `L` | Standings |
| `P` | Players |
| `B` | Betting |
| `T` | Bet Tracker |
| `A` | Analytics |
| `/` | Search players |

## Running tests
```bash
npm test
```

59 unit tests covering utility functions (Kelly criterion, P&L calculation, odds conversion, season detection, etc.).