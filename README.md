# CourtIQ — NBA Analytics Platform

> A full-featured NBA analytics web app for data scientists, fans, and sports bettors.
> Built with vanilla HTML/CSS/JS — no framework, no build step, just open `index.html`.

---

## What is this?

CourtIQ is a browser-based NBA dashboard that pulls together everything an NBA nerd needs in one place:

- **Live scores** with win probability bars
- **Standings** for both conferences with playoff cutlines
- **Player explorer** — searchable, filterable, sortable stats cards
- **Shot chart** — half-court zone heat maps per player
- **Betting edge** — model probability vs market-implied odds
- **Bet tracker** — log bets, track ROI, export CSV
- **Win probability model** — live logistic regression with adjustable sliders
- **Analytics tools** — launch pad for deeper analysis tools

The app currently runs on **static demo data** (2025-26 season snapshot). To make it fully live, swap the data arrays in `src/data.js` for real API calls — every fetch hook is described below.

---

## Who is this for?

| Audience | What they use |
|---|---|
| **NBA fans / hobbyists** | Scores, standings, player cards, shot charts |
| **Data scientists** | Model builder, Python code output, CSV exports, analytics tools |
| **Sports bettors** | Betting edge panel, EV model, bet tracker with ROI chart |

---

## Project structure

```
courtiq/
├── index.html          ← Single HTML shell; loads all JS modules
├── src/
│   ├── styles.css      ← All styles; CSS variables for light/dark theme
│   ├── data.js         ← All static data (replace with API calls to go live)
│   ├── app.js          ← Tab switching, theme toggle
│   ├── scores.js       ← Tonight's games + win probability bars
│   ├── standings.js    ← East/West conference tables
│   ├── players.js      ← Searchable player grid + CSV export
│   ├── shotchart.js    ← SVG half-court heat map renderer
│   ├── betting.js      ← Model vs market edge cards
│   ├── tracker.js      ← Bet logger, P&L calculator, ROI chart
│   ├── model.js        ← Logistic regression model + Python code output
│   └── tools.js        ← Analytics tool launch cards
└── README.md
```

---

## How to run it

```bash
# Option 1: just double-click
open index.html   # macOS
# or drag index.html into any browser

# Option 2: local dev server (prevents CORS issues if you add fetch() calls)
npx serve .
# or
python3 -m http.server 8080
```

No npm install. No build step. No framework. It just works.

---

## How the data layer works

All data lives in `src/data.js` as plain JS arrays. Every constant is documented.
To go from demo to live, replace the arrays with `fetch()` calls at the top of each module.

### Replacing static data with real APIs

#### Scores & win probabilities
```js
// In src/scores.js — replace TODAY_GAMES with:
const res   = await fetch('https://api.sportradar.com/nba/production/v8/en/games/2026/03/19/schedule.json?api_key=YOUR_KEY');
const json  = await res.json();
const TODAY_GAMES = json.games.map(g => ({
  away:  g.away.alias,
  home:  g.home.alias,
  awayP: g.away_win_probability * 100,
  homeP: g.home_win_probability * 100,
  time:  new Date(g.scheduled).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET',
}));
```

Good free/cheap APIs:
- [BallDontLie](https://www.balldontlie.io) — free, good for scores and player stats
- [Sportradar NBA](https://developer.sportradar.com) — paid, comprehensive (scores, odds, play-by-play)
- [SportsDataIO](https://sportsdata.io) — paid, beginner-friendly
- [The Odds API](https://the-odds-api.com) — for live betting lines (free tier available)

#### Player stats
```js
// In src/data.js — replace PLAYERS with:
const res     = await fetch('https://www.balldontlie.io/api/v1/season_averages?season=2025&player_ids[]=...');
const { data } = await res.json();
```

#### Shot chart data
NBA.com's stats API has real shot location data (x/y coordinates per shot):
```
https://stats.nba.com/stats/shotchartdetail?PlayerID=1629029&Season=2025-26&...
```
Note: NBA.com requires browser-like headers. Use a proxy or server-side fetch.

#### Live betting lines
```js
// In src/data.js — replace ODDS_GAMES with:
const res  = await fetch('https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?apiKey=YOUR_KEY&regions=us&markets=h2h,spreads');
const json = await res.json();
```

---

## The win probability model

The model in `src/model.js` is a **logistic regression** with these features:

| Feature | Weight | Why it matters |
|---|---|---|
| Net rating differential | 0.18 | Best single predictor of team strength |
| Season win% differential | 1.40 | Overall record captures full-season quality |
| Last-10 form differential | 0.80 | Recent momentum / hot/cold streaks |
| Rest days advantage | 0.015 | Back-to-backs meaningfully hurt performance |
| Home court | 0.084 | Home teams win ~58% of NBA games historically |

**Formula:**
```
logit = 0.18 × net_rtg_diff
      + 1.40 × win_pct_diff
      + 0.80 × form_diff
      + 0.015 × rest_adv
      + 0.084 × home_court

home_win_prob = 1 / (1 + e^(-logit))
```

The model builder tab lets you dial in all 10 inputs and watch the probability update live. It also generates a Python sklearn snippet you can copy into a notebook.

**To train a real model:**
```python
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split

# Pull 5 seasons of game logs from Basketball Reference or NBA Stats API
df = pd.read_csv('nba_games_2020_2025.csv')

features = ['net_rtg_diff', 'win_pct_diff', 'form_10_diff', 'rest_adv', 'home_court']
X = df[features]
y = df['home_win']  # 1 if home team won, 0 if away

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
model = LogisticRegression()
model.fit(X_train, y_train)

print("Accuracy:", model.score(X_test, y_test))
print("Coefficients:", dict(zip(features, model.coef_[0])))
```

---

## The shot chart

`src/shotchart.js` draws an SVG half-court (400×380 viewBox) and overlays colored dots per shooting zone.

- **Orange dot** = above-average FG% for that zone
- **Blue dot** = below-average FG%
- Dot **size** = attempt volume (more shots → bigger dot)
- Dot **opacity** = how far above/below average (more extreme → more opaque)
- The % printed inside is the player's actual FG% from that zone

Zone averages used as benchmarks:
- Paint / post / floater zones: 52% average
- Mid-range zones: 42% average
- Three-point zones: 36% average

To use real shot coordinate data from `stats.nba.com/shotchartdetail`, bucket the x/y coordinates into zones and pass `makes` and `att` per zone.

---

## The bet tracker

`src/tracker.js` handles bet logging, P&L math, and the ROI line chart.

**P&L formula:**
```js
// American odds → payout
if (odds > 0)  profit = stake * (odds / 100)       // +150 odds on $50 = $75 profit
if (odds < 0)  profit = stake * (100 / Math.abs(odds))  // -110 odds on $110 = $100 profit
```

**To persist bets across browser sessions**, swap the in-memory `bets` array for localStorage:
```js
// Save
localStorage.setItem('courtiq_bets', JSON.stringify(bets));

// Load on page start
const saved = localStorage.getItem('courtiq_bets');
let bets = saved ? JSON.parse(saved) : [];
```

Or wire up a backend (Supabase, Firebase, PocketBase) for multi-device sync.

---

## Theme system

CourtIQ uses CSS custom properties on `<html data-theme="light|dark">`.

```css
:root {
  --bb:     #E8531A;   /* brand orange */
  --bg:     #ffffff;   /* card background */
  --bg2:    #f5f4f0;   /* surface */
  --text:   #1a1a1a;
  --text2:  #6b6b6b;
  --border: rgba(0,0,0,0.10);
}

[data-theme="dark"] {
  --bg:     #111113;
  --bg2:    #1c1c1f;
  --text:   #f0efeb;
  /* ... */
}
```

Every color in the app pulls from these variables, so the toggle in the header flips the whole UI instantly.

---

## Typography

| Font | Use |
|---|---|
| [Bebas Neue](https://fonts.google.com/specimen/Bebas+Neue) | Logo, team abbreviations, big display numbers |
| [DM Sans](https://fonts.google.com/specimen/DM+Sans) | All body text, labels, UI |
| [DM Mono](https://fonts.google.com/specimen/DM+Mono) | Stats, odds, numbers, code |

Loaded from Google Fonts in `index.html`.

---

## Extending the app

| Feature | Where to add | Notes |
|---|---|---|
| Player detail modal | `src/players.js` → `card.onclick` | Replace `alert()` with a slide-in panel |
| Real shot coordinates | `src/shotchart.js` | Swap `SHOT_DATA` with NBA Stats API response |
| Live odds refresh | `src/betting.js` | Add `setInterval(() => fetchOdds(), 60000)` |
| Bet persistence | `src/tracker.js` | Swap `let bets = []` for localStorage or a DB |
| More players | `src/data.js` | Add to the `PLAYERS` array or replace with API |
| Push notifications | New `src/alerts.js` | Use the Web Notifications API |
| User accounts | Backend + auth | Supabase or Firebase for multi-device bet tracking |

---

## License

MIT. Use it, fork it, build on it. If you ship something cool with it, give a shout.

---

## Credits

Built with:
- [Chart.js](https://chartjs.org) — ROI line chart
- [Google Fonts](https://fonts.google.com) — Bebas Neue, DM Sans, DM Mono
- NBA data structure inspired by [Basketball Reference](https://www.basketball-reference.com) and [NBA Stats](https://stats.nba.com)

---

*CourtIQ was designed as a complete starting point. The demo data is a snapshot of the 2025-26 NBA season as of March 19, 2026. Wire up the APIs listed above and it becomes a fully live platform.*
