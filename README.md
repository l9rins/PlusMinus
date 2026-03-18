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

Everything runs on static demo data (2025-26 NBA season snapshot). The data layer is one file — swap `src/data.js` for real API calls and you're live.

---

## Live repo

```
https://github.com/l9rins/plusminus
```

---

## Running it

```bash
git clone https://github.com/l9rins/plusminus.git
cd plusminus
npm install
npm run dev        # http://localhost:5173
npm run build      # outputs to dist/
npm run preview    # serve the build locally
```

No framework magic. No config required. Just open and go.

> **GitHub Pages note:** `vite.config.js` sets `base: "/plusminus/"` for GH Pages deployment. If deploying to Vercel, Netlify, or a root domain, change this to `"/"`.

---

## Project structure

```
plusminus/
├── index.html              ← Entry point; loads Google Fonts
├── package.json            ← React 18, Framer Motion, Recharts, Lucide, Tailwind
├── vite.config.js          ← Vite + React plugin, @ alias → src/, base path
├── tailwind.config.js      ← Full custom design system
├── postcss.config.js
└── src/
    ├── main.jsx            ← ReactDOM.createRoot
    ├── App.jsx             ← Root: tab state, AnimatePresence routing, Placeholder
    ├── index.css           ← Tailwind base + all .pm-* component classes
    ├── data.js             ← All static NBA data (replace with API calls to go live)
    ├── utils.js            ← Pure utility functions: calcPL, oddsToImplied, signed, clamp
    └── components/
        ├── TopNav.jsx      ← Sticky nav with hover submenus, search, live indicator
        ├── Dashboard.jsx   ← Home portal: summary tiles, games, standings, scorers
        ├── Players.jsx     ← Searchable player list with expandable FM26-style cards
        └── Views.jsx       ← Scores, Standings, Betting, BetTracker (named exports)
```

---

## Tech stack

| Package | Version | Role |
|---|---|---|
| `react` + `react-dom` | ^18.3.1 | UI framework |
| `framer-motion` | ^11.3.0 | Page transitions, tile stagger, stat bar fills, card expand |
| `recharts` | ^2.12.7 | Cumulative P&L line chart in BetTracker |
| `lucide-react` | ^0.383.0 | All icons (thin stroke, consistent weight) |
| `tailwindcss` | ^3.4.7 | Utility styling — entire design system in `tailwind.config.js` |
| `vite` | ^5.3.4 | Dev server + build |
| `@radix-ui/*` | various | Installed as peer deps for future shadcn components |

---

## Design system

The entire visual language lives in `tailwind.config.js` and `src/index.css`.

### Color palette — the `pitch` scale

FM26-inspired deep navy-charcoal. 13 stops:

```
pitch-950  #0a0b0d   deepest bg
pitch-900  #0f1114   page background          ← body bg
pitch-850  #141720   nav background
pitch-800  #1a1e2a   card / tile background   ← .pm-tile, .pm-card
pitch-750  #1f2535   tile hover state
pitch-700  #252d3d   elevated surface, inputs
pitch-600  #2e3a50   strong border
pitch-500  #3d4f6a   default border
pitch-400  #546480   muted text
pitch-300  #7d91ab   secondary text
pitch-200  #adbdd0   body text
pitch-100  #d4e0ec   primary text
pitch-50   #eef4fb   brightest text
```

### Accent + status

```
accent     #00d4aa   electric teal — active state, live indicator, top-ranked teams
win        #22c55e   green  — wins, positive P&L, W streaks
loss       #ef4444   red    — losses, negative P&L, L streaks
draw       #f59e0b   amber  — pending bets, moderate edge
```

### Rating tiers (FM26-style attribute bar colors)

```
tier-elite  #00d4aa   ≥ 80% of metric max
tier-good   #4ade80   ≥ 65%
tier-avg    #facc15   ≥ 50%
tier-poor   #f97316   ≥ 35%
tier-bad    #ef4444   < 35%
```

### Typography

```
font-display   Bebas Neue    team abbreviations, logo, large numbers
font-sans      DM Sans       all body text, labels, UI
font-mono      DM Mono       stats, odds, P&L values, code
```

### Component classes (`src/index.css`)

```css
.pm-tile          Base tile — pitch-800 bg, border, hover state.
                  NOTE: no overflow-hidden — intentional so .pm-accent-border
                  glow is not clipped on expanded player cards.

.pm-card          Elevated card — heavier shadow, rounded-xl

.pm-accent-border Teal glow border for selected/active tiles

.pm-label         10px uppercase tracking label (section headers)

.pm-stat-bar      3px attribute bar track
.pm-stat-bar-fill Animated fill (color set by tier-* class)

.pm-badge         Small pill badge

.pm-nav-btn       Nav button with .active state (text-accent + bg-accent/10)

.pm-number        Mono tabular-nums span

.pm-result        5×5 W/L/D result square

.scrollbar-none   Hides scrollbar on nav overflow — defined here since Tailwind
                  base does not include this utility without a plugin
```

---

## Component breakdown

### `App.jsx`

Root component. Owns the `tab` state and routes to the correct view via `renderContent()`.

Routes:
- `dashboard` → `<Dashboard>`
- `scores` → `<Scores>`
- `standings` → `<Standings>`
- `players` → `<Players>`
- `betting` → `<Betting>`
- `tracker` → `<BetTracker>` ← accessed via Betting → "Bet Tracker" submenu
- `analytics` → `<Placeholder>` with description of coming features
- `default` → console.warn + fallback to Dashboard

`Placeholder` accepts a `title` and optional `description` prop so each stub can describe what it will eventually contain.

---

### `TopNav.jsx`

Sticky nav bar. FM26-style horizontal tabs with 120ms-delayed hover submenus.

Key details:
- `NAV_ITEMS` array drives both the tab buttons and their submenu items, each with a real route `id`
- "Bet Tracker" submenu item routes to `"tracker"` (distinct from `"betting"`)
- Betting tab stays highlighted when `activeTab === "tracker"`
- `useEffect` cleanup: `clearTimeout(timeoutRef.current)` on unmount prevents state updates on unmounted component
- Search: Escape closes + clears, Enter navigates to Players
- Labels hidden below `sm:` breakpoint — icon-only on mobile
- `scrollbar-none` on the nav items container (defined in `index.css`)
- Bell + Settings buttons have `onClick` handlers (log to console until built)

---

### `Dashboard.jsx`

Portal/hub. 12-column CSS grid with staggered tile entrance animation.

- `TOP_SCORERS` is computed at **module level** (not inside the component) — PLAYERS is static, so sorting once on import is free
- Sub-components: `SummaryTile`, `GameTile`, `MiniStandings`, `PlayerTile`
- All wrapped in Framer `variants` with `staggerChildren: 0.05`

---

### `Players.jsx`

Searchable, filterable player list with FM26-style expandable cards.

**`AttrBar` component:**
- Accepts an `invert` prop for lower-is-better metrics
- D-RTG uses `invert={true}` — elite defenders (low D-RTG) fill the bar fully; poor defenders barely fill it
- Formula: `pct = (max - value) / (max - 100) * 100` for inverted metrics, range anchored at 100 (best possible)
- Color tier thresholds: 80% = elite, 65% = good, 50% = avg, 35% = poor, <35% = bad

**`PlayerCard` component:**
- `overflow-hidden` is on the **inner animated div**, not on `pm-tile`
- This ensures `pm-accent-border`'s teal glow box-shadow is visible on expanded cards
- BPM stat uses `signed()` from `utils.js` — correctly handles negative BPM (no `+-3.1`)

---

### `Views.jsx`

Four named exports:

**`Scores`** — 9 game tiles with win probability bars. Clicking a tile toggles accent border selection.

**`Standings`** — East/West toggle. Full 9-column table with `min-w-[640px]` for mobile scroll. Row 7 gets accent top border for playoff/play-in cutline. Staggered row entrance.

**`Betting`** — 6 game cards showing model probability vs market-implied probability. Imports `ODDS_GAMES` from `data.js` (no local duplicate).

**`BetTracker`**:
- `calcPL` imported from `utils.js` — single source of truth for P&L math
- `stats` and `chartData` wrapped in `useMemo([bets])` — no recomputation on form keystrokes
- Win rate calculated on decisive bets only (wins + losses), **excluding pushes** from denominator
- ROI stake base uses decisive bets only — pushes return stake so they don't count as risked
- Form validation: `addBet()` shows a visible `formError` message instead of silently doing nothing
- ROI chart renders only when `chartData.length >= 2`

---

## Data layer — `src/data.js`

All data is plain JS exported constants. Fully documented inline.

### Exports

| Export | Shape | Used in |
|---|---|---|
| `TEAM_COLORS` | `{ OKC: "#007AC1", ... }` | `Players.jsx` avatar tinting |
| `TEAM_NAMES` | `{ GSW: "Warriors", ... }` | `Dashboard.jsx`, `Views.jsx` |
| `PLAYERS` | Array of 15 player objects | `Players.jsx`, `Dashboard.jsx` |
| `TODAY_GAMES` | Array of 9 game objects | `Dashboard.jsx`, `Views.jsx` |
| `EAST_STANDINGS` | Array of 15 team objects | `Dashboard.jsx`, `Views.jsx` |
| `WEST_STANDINGS` | Array of 15 team objects | `Dashboard.jsx`, `Views.jsx` |
| `ODDS_GAMES` | Array of 6 betting edge objects | `Views.jsx` |

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
  per: 28.6,    // player efficiency rating (max ~35 for elite)
  ts: 62.8,     // true shooting % (max ~75 for elite)
  bpm: 9.2,     // box plus/minus (can be negative)
  vorp: 7.1,    // value over replacement player
  ortg: 123,    // offensive rating: points per 100 possessions
  drtg: 110,    // defensive rating: lower is better
  form: ["W","W","W","L","W"],  // last 5 game results
}
```

### Game object shape

```js
{
  id: "g1",           // required for React key — do not omit
  away: "GSW",
  home: "BOS",
  awayP: 16.8,        // model win probability (away team)
  homeP: 83.2,        // model win probability (home team)
  time: "7:00 PM",
  spread: "BOS -9.5",
  total: "224.5",
}
```

---

## Utilities — `src/utils.js`

Pure functions, no React. Fully JSDoc'd.

| Function | Used by | Purpose |
|---|---|---|
| `calcPL(stake, odds, result)` | `Views.jsx` BetTracker | American odds → P&L in dollars |
| `oddsToImplied(odds)` | future: `Views.jsx` Betting | American odds → implied probability |
| `signed(n, decimals)` | `Players.jsx` BPM display | Format number with explicit +/− sign |
| `clamp(value, min, max)` | future: shot chart, model builder | Bound a value within a range |

`oddsToImplied` and `clamp` are not yet called by any component. Both are documented with the specific future use case they'll serve.

---

## Connecting real APIs

Everything in `data.js` is swappable. Recommended sources:

### Scores + win probabilities
```js
// BallDontLie (free)
const res = await fetch("https://www.balldontlie.io/api/v1/games?dates[]=2026-03-19");

// Sportradar NBA (paid, has win probabilities)
const res = await fetch(`https://api.sportradar.com/nba/v8/games/2026/03/19/schedule.json?api_key=${KEY}`);
```

### Player stats
```js
// BallDontLie season averages
const res = await fetch("https://www.balldontlie.io/api/v1/season_averages?season=2025&player_ids[]=...");
```

### Live betting lines
```js
// The Odds API (free tier: 500 req/month)
const res = await fetch(`https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?apiKey=${KEY}&regions=us&markets=h2h,spreads,totals`);
```

Once you have real moneyline odds, you can replace the hardcoded `impliedP` in `ODDS_GAMES` with:
```js
import { oddsToImplied } from "./utils";
impliedP: Math.round(oddsToImplied(moneyline) * 100)
```

---

## What's stubbed / not built yet

| Feature | Status | Notes |
|---|---|---|
| Analytics tab | Placeholder | Renders description of upcoming Four Factors, Elo, Lineup, Shot Quality views |
| Shot chart | Not in React version | SVG court renderer exists in the vanilla version — needs porting |
| Model builder | Not in React version | Logistic regression slider UI exists in vanilla version — needs porting |
| Nav submenu routing | Partial | "Bet Tracker" routes correctly; other sub-items route to parent tab |
| Bet persistence | In-memory only | Add `localStorage` or Supabase for cross-session tracking |
| Search logic | Input wired | Pressing Enter navigates to Players; no query pre-fill yet |
| `@radix-ui` components | Installed, not wired | shadcn Dialog, Tooltip, Progress, Avatar ready to use |

---

## Roadmap

```
Phase 1 — current         Static data, core views, clean architecture
Phase 2 — real data       Wire BallDontLie + The Odds API
Phase 3 — shot chart      Port SVG court renderer to React
Phase 4 — model builder   Port logistic regression sliders to React
Phase 5 — persistence     localStorage bets, user preferences
Phase 6 — auth            Supabase auth + per-user bet history
Phase 7 — mobile          Bottom tab bar, touch-optimised cards
```

---

## Design rules for contributors

1. Never use white backgrounds — everything is `pitch-800` or darker
2. Accent color (`#00d4aa`) marks one thing: the active/selected state
3. All numbers go in `font-mono` — stats, odds, P&L, counts
4. Framer Motion for everything that moves — no CSS transitions on layout changes
5. `pm-tile` is the atom — build new sections from tiles
6. Labels are always `pm-label` — never `text-sm font-bold` for section headers
7. Only use the `pitch` scale for grays — never default Tailwind `gray-*` or `slate-*`
8. D-RTG and any future lower-is-better metric uses `invert={true}` on `AttrBar`
9. New P&L math belongs in `utils.js`, not inline in components

---

## Changelog

### `215304f` — Quality pass 2 (current)
- `AttrBar`: D-RTG bar inverted — elite defenders now correctly fill the bar
- `Players.jsx`: BPM display uses `signed()` from utils — no more `+-3.1` for negative values
- `Views.jsx`: Win rate excludes pushes from denominator; ROI stake base excludes push stakes
- `Views.jsx`: `stats` and `chartData` wrapped in `useMemo` — no recomputation on form keystrokes
- `Views.jsx`: Form validation now shows visible error message instead of silent no-op
- `Dashboard.jsx`: `TOP_SCORERS` moved to module level — computed once, not on every render
- `TopNav.jsx`: `useEffect` cleanup for `setTimeout` ref on unmount
- `App.jsx`: `Placeholder` accepts `description` prop; Analytics shows actual upcoming content
- `index.css`: `overflow-hidden` removed from `.pm-tile`; `.scrollbar-none` utility defined

### `6ae9f50` — Quality pass 1
- All exports added to `data.js` — previously nothing was exported (silent module failure)
- `TEAM_COLORS` added to `data.js` — Players.jsx was importing it and crashing
- `id` field added to all `TODAY_GAMES` entries — React key warnings eliminated
- Dead `BB` / `BLUE` constants removed from `data.js`
- `ODDS_GAMES` exported from `data.js`; local `ODDS_DATA` duplicate in `Views.jsx` deleted
- `BetTracker` routed via `case "tracker"` in `App.jsx` — was previously unreachable
- `calcPL` extracted to `utils.js` — single source of truth
- `utils.js` created with `calcPL`, `oddsToImplied`, `signed`, `clamp`
- Standings table `min-w-[640px]` — mobile horizontal scroll now works
- `TopNav` submenu items given real route ids; Bell/Settings given onClick handlers
- Search Escape closes + clears; Enter navigates to Players
- Nav labels hidden on mobile (icon-only below `sm:`)
- `vite.config.js`: `base: "/plusminus/"` for GitHub Pages
- `index.html`: meta description + og tags added

---

*PlusMinus · commit `215304f` · React + Vite · NBA 2025-26 season*