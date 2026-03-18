# ± PlusMinus — NBA Analytics Platform

> A full-stack NBA analytics dashboard inspired by the UI/UX of Football Manager 2026.
> Built with React, Vite, Framer Motion, Tailwind CSS, and Recharts.
> Dark-first. Data-dense. Smooth as hell.

---

## What is this?

PlusMinus is a browser-based NBA analytics platform built for three types of people:

- **NBA fans** — live scores, tonight's games, win probabilities, standings, player cards
- **Data scientists** — advanced metrics (PER, BPM, VORP, ORTG, DRTG), expandable player cards with FM26-style attribute bars, sortable/filterable explorer
- **Bettors** — model vs market edge finder, bet tracker with P&L math, cumulative ROI chart

The design language is directly inspired by **Football Manager 2026** — dense tile-based layouts, a dark charcoal palette, hover submenus, staggered entrance animations, and FM-style color-coded attribute bars that animate on expand.

Everything runs on static demo data right now (2025-26 NBA season snapshot). The data layer is one file — swap `src/data.js` for real API calls and you're live.

---

## Live repo

```
https://github.com/l9rins/plusminus
```

---

## Project structure

```
plusminus/
├── index.html                ← Entry point; loads Google Fonts (Bebas Neue, DM Sans, DM Mono)
├── package.json              ← Dependencies: React 18, Framer Motion, Recharts, Lucide, Tailwind
├── vite.config.js            ← Vite + React plugin, @ alias → src/
├── tailwind.config.js        ← Full custom design system (pitch palette, accent, tier colors)
├── postcss.config.js         ← Tailwind + autoprefixer
└── src/
    ├── main.jsx              ← ReactDOM.createRoot, mounts <App />
    ├── App.jsx               ← Root: tab state, AnimatePresence page transitions, route switch
    ├── index.css             ← Tailwind base + all .pm-* component classes
    ├── data.js               ← All static NBA data (replace with API calls to go live)
    └── components/
        ├── TopNav.jsx        ← Sticky nav bar with hover submenus, search slide-in, live dot
        ├── Dashboard.jsx     ← Home portal: summary tiles, game tiles, mini standings, top scorers
        ├── Players.jsx       ← Searchable/filterable player list with expandable FM26-style cards
        └── Views.jsx         ← Scores, Standings, Betting Edge, BetTracker (all named exports)
```

---

## Getting started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Install and run

```bash
git clone https://github.com/l9rins/plusminus.git
cd plusminus
npm install
npm run dev
```

Open `http://localhost:5173` and you're in.

### Build for production

```bash
npm run build       # outputs to dist/
npm run preview     # serve the build locally
```

Deploy the `dist/` folder to Vercel, Netlify, or GitHub Pages — it's a static site.

---

## Tech stack

| Package | Version | Role |
|---|---|---|
| `react` + `react-dom` | ^18.3.1 | UI framework |
| `framer-motion` | ^11.3.0 | All animations — page transitions, tile stagger, stat bar fills, expandable cards |
| `recharts` | ^2.12.7 | Cumulative P&L line chart in the Bet Tracker |
| `lucide-react` | ^0.383.0 | All icons (thin stroke, consistent with FM26 aesthetic) |
| `tailwindcss` | ^3.4.7 | Utility styling — entire design system lives in `tailwind.config.js` |
| `vite` | ^5.3.4 | Dev server + build |
| `@radix-ui/*` | various | Installed as peer deps for shadcn; not yet wired to components |

---

## Design system

The entire visual language is defined in two files: `tailwind.config.js` and `src/index.css`.

### Color palette — the `pitch` scale

Inspired by FM26's deep navy-charcoal UI. 13 stops from near-black to near-white:

```
pitch-950  #0a0b0d   deepest bg (unused, available)
pitch-900  #0f1114   main page background  ← body bg
pitch-850  #141720   nav / sidebar bg
pitch-800  #1a1e2a   card background       ← .pm-tile, .pm-card
pitch-750  #1f2535   card hover state
pitch-700  #252d3d   elevated surface, inputs
pitch-600  #2e3a50   strong border
pitch-500  #3d4f6a   default border
pitch-400  #546480   muted text
pitch-300  #7d91ab   secondary text
pitch-200  #adbdd0   body text
pitch-100  #d4e0ec   primary text
pitch-50   #eef4fb   brightest text
```

### Accent color

```
accent         #00d4aa   electric teal-green — FM26's signature action color
accent/dim     #00a882   hover/pressed
accent/10-25   opacity variants for backgrounds
```

### Status + tier colors

```
win   #22c55e   green  — wins, positive P&L, above-average stats
loss  #ef4444   red    — losses, negative P&L
draw  #f59e0b   amber  — pending, neutral

tier-elite  #00d4aa   PER/stat bars: top tier (≥80% of max)
tier-good   #4ade80   good (≥65%)
tier-avg    #facc15   average (≥50%)
tier-poor   #f97316   below average (≥35%)
tier-bad    #ef4444   poor (<35%)
```

### Typography

```
font-display   Bebas Neue     → team abbreviations, logo, big display numbers
font-sans      DM Sans        → all body text, labels, UI copy
font-mono      DM Mono        → stats, odds, numbers, monospace values
```

### Component classes (defined in `src/index.css`)

```css
.pm-tile          Base tile — bg-pitch-800 card with hover state
.pm-card          Elevated card — same fill, slightly heavier shadow
.pm-accent-border Teal glow border for active/selected state
.pm-label         10px uppercase tracking label (section headers)
.pm-stat-bar      3px attribute bar container
.pm-stat-bar-fill Animated fill inside stat bar
.pm-badge         Small pill badge
.pm-nav-btn       Navigation button with active state
.pm-number        Mono tabular-nums span
.pm-result        W/L/D result square
```

---

## Component breakdown

### `TopNav.jsx`

Sticky top navigation bar. FM26-style horizontal nav with hover-triggered submenus.

- `NAV_ITEMS` array defines each nav item: id, icon, label, and sub-menu items
- `hoveredItem` state + `useRef` timeout controls submenu visibility with a 120ms delay (prevents flicker on fast mouse movements)
- Submenus animate in with `framer-motion` `AnimatePresence` (opacity + y: -4 → 0)
- Right side: search button (toggles slide-in input), bell (notification dot), settings, live indicator
- Search bar uses `AnimatePresence` with `height: 0 → 40` transition

**Props:**
```jsx
<TopNav activeTab="dashboard" onTabChange={(id) => setTab(id)} />
```

---

### `Dashboard.jsx`

The portal/hub view. Renders as a 12-column CSS grid with staggered tile entrance.

Sub-components:
- `SummaryTile` — metric card with icon, big number, trend indicator
- `GameTile` — tonight's game card with team names, win probability bar, spread/total
- `MiniStandings` — compact 6-team standings list for each conference
- `PlayerTile` — scoring leader row with rank, name, PPG

All wrapped in Framer Motion `variants` with `staggerChildren: 0.05` — tiles cascade in from bottom on mount.

**Props:**
```jsx
<Dashboard onNavigate={(id) => setTab(id)} />
```

---

### `Players.jsx`

Searchable, filterable player list with FM26-style expandable cards.

- Filter bar: text search, position pills (All/PG/SG/SF/PF/C), sort dropdown
- Each `PlayerCard` shows collapsed header (avatar, name, PTS/AST/REB) with a `ChevronDown`
- Click to expand: `AnimatePresence` animates `height: 0 → auto`
- Expanded view shows:
  - Left: 6 `AttrBar` components (PER, TS%, BPM, VORP, O-RTG, D-RTG) with color-tiered animated fills
  - Right: 6-stat number grid + last-5 form dots
- `TEAM_COLORS` from `data.js` tints each player's avatar with their team brand color

**The `AttrBar` component:**
```jsx
// Normalized to max value, colored by tier threshold
<AttrBar label="PER" value={28.6} max={35} />
// → 81.7% fill → tier-elite color (#00d4aa)
```

---

### `Views.jsx`

Four named exports:

**`Scores`** — grid of game tiles, each selectable (accent border on click), animated win-probability bar.

**`Standings`** — East/West toggle. Full table with W, L, PCT, L10, HOME, ROAD, STREAK columns. Rows animate in staggered (x: -4 → 0). Row 7 gets an accent top border marking the playoff/play-in cutline. Streak badges color-coded win/loss.

**`Betting`** — 6 game cards showing model win probability vs market-implied probability. Edge badges: `★ EDGE` (≥10% gap, green), `MOD` (5–9%, amber), `SMALL` (<5%, muted). Explainer card at bottom.

**`BetTracker`** — Full bet logger with:
- 4 metric tiles: total bets, win rate, net P&L, ROI
- Add-bet form (6 inputs: game, type, pick, odds, stake, result)
- Bet history table with P&L calculation and delete button
- `calcPL` handles American odds math (positive and negative)
- Cumulative P&L `LineChart` (Recharts) renders when ≥2 settled bets exist

---

## Data layer — `src/data.js`

All data is plain JS exported constants. The file is structured so every section is self-contained and documented.

### What's in there

| Export | Shape | Used in |
|---|---|---|
| `TEAM_COLORS` | `{ OKC: "#007AC1", ... }` | `Players.jsx` avatar tinting |
| `PLAYERS` | Array of 12 player objects | `Players.jsx`, `Dashboard.jsx` |
| `TODAY_GAMES` | Array of 9 game objects | `Dashboard.jsx`, `Views.jsx` (Scores) |
| `EAST_STANDINGS` | Array of 15 team objects | `Dashboard.jsx`, `Views.jsx` (Standings) |
| `WEST_STANDINGS` | Array of 15 team objects | `Dashboard.jsx`, `Views.jsx` (Standings) |
| `TEAM_NAMES` | `{ GSW: "Warriors", ... }` | `Dashboard.jsx`, `Views.jsx` |

### Player object shape

```js
{
  id: 1,
  name: "Shai Gilgeous-Alexander",
  pos: "PG",
  team: "OKC",
  age: 27,
  pts: 32.4,    // points per game
  ast: 6.1,     // assists per game
  reb: 5.3,     // rebounds per game
  per: 28.6,    // player efficiency rating
  ts: 62.8,     // true shooting %
  bpm: 9.2,     // box plus/minus
  vorp: 7.1,    // value over replacement
  ortg: 123,    // offensive rating (points per 100 poss)
  drtg: 110,    // defensive rating
  form: ["W","W","W","L","W"],  // last 5 results
}
```

### Game object shape

```js
{
  id: "g1",
  away: "GSW",
  home: "BOS",
  awayP: 16.8,        // model win probability (away)
  homeP: 83.2,        // model win probability (home)
  time: "7:00 PM",
  spread: "BOS -9.5",
  total: "224.5",
}
```

---

## Connecting real APIs

Everything in `data.js` is swappable. Here's how to go live:

### Scores + win probabilities
```js
// BallDontLie (free) — good for scores, basic game data
const res = await fetch("https://www.balldontlie.io/api/v1/games?dates[]=2026-03-19");
const { data } = await res.json();

// Sportradar NBA (paid) — win probabilities + live data
const res = await fetch(`https://api.sportradar.com/nba/v8/games/2026/03/19/schedule.json?api_key=${KEY}`);
```

### Player stats
```js
// BallDontLie season averages
const res = await fetch("https://www.balldontlie.io/api/v1/season_averages?season=2025&player_ids[]=...");

// NBA Stats API (free, needs spoofed headers)
// Use a serverless proxy (Vercel Edge Function) to avoid CORS + header requirements
```

### Live betting lines
```js
// The Odds API (free tier: 500 requests/month)
const res = await fetch(
  `https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?apiKey=${KEY}&regions=us&markets=h2h,spreads,totals`
);
```

### Recommended proxy pattern (avoid CORS + rate limits)
```
Client → Vercel Edge Function → External API
```

Create `api/nba.js` as a Vercel serverless function, cache responses for 60s, and fetch from your React app.

---

## What's stubbed / not built yet

| Feature | Status | Notes |
|---|---|---|
| Analytics tab | Placeholder | Shows "Coming soon" — wire up Four Factors, Elo, etc. |
| Shot chart | Data in `data.js`, no view yet | SVG court renderer built in the vanilla version — needs porting to React |
| Model builder | Not in React version yet | Full logistic regression slider UI exists in vanilla JS version |
| Nav submenu routing | Submenus exist but all route to parent tab | Each sub-item needs its own view |
| `@radix-ui` components | Installed, not wired | shadcn components ready to add — Dialog, Tooltip, Progress, Avatar |
| Bet persistence | In-memory only (resets on refresh) | Add `localStorage` or Supabase for persistence |
| Search | Input renders, no logic | Wire up to filter across players, teams, games |

---

## Roadmap

```
Phase 1 — current         Static data, core views working
Phase 2 — real data       Wire BallDontLie + Odds API
Phase 3 — shot chart      Port SVG court renderer to React component
Phase 4 — model builder   Port logistic regression sliders to React
Phase 5 — persistence     localStorage bets, user preferences
Phase 6 — auth            Supabase auth + per-user bet history
Phase 7 — mobile          Bottom tab bar, touch-optimized cards
```

---

## Notes for contributors / future Claude instances

This codebase has a deliberate aesthetic. If you're adding something, keep these rules:

1. **Never use white backgrounds** — everything is `pitch-800` or darker
2. **Accent color (`#00d4aa`) is for one thing** — the active/highlighted state. Don't spray it everywhere
3. **All numbers go in `font-mono`** — stats, odds, percentages, counts, all of them
4. **Framer Motion for everything that moves** — no CSS transitions on layout changes, use `motion.div` with `layout` prop
5. **`pm-tile` is the atom** — build new sections out of tiles, not custom card components
6. **Labels are always `pm-label`** — 10px, uppercase, tracked, muted. Never `text-sm font-bold` for a section header
7. **The `pitch` scale is your only gray** — never `gray-*` or `slate-*` from default Tailwind

---

## License

MIT. Build something great.

---

*PlusMinus — commit `6ead1de` · React + Vite · NBA 2025-26 season data*