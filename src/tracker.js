// ─── Bet Tracker Module ───────────────────────────────────────
// Tracks bets locally in-memory (persists until page refresh).
// To persist across sessions, swap the `bets` array for
// localStorage.getItem / setItem calls.

let bets = [
  { id:1, game:'OKC @ BKN',   type:'Spread',      pick:'OKC -16',  odds:-110, stake:50,  result:'win'     },
  { id:2, game:'GSW @ BOS',   type:'Moneyline',   pick:'BOS ML',   odds:-240, stake:100, result:'win'     },
  { id:3, game:'POR @ IND',   type:'Over/Under',  pick:'Over 228', odds:-112, stake:40,  result:'loss'    },
  { id:4, game:'LAL @ HOU',   type:'Spread',      pick:'HOU -1',   odds:-108, stake:55,  result:'pending' },
];

let roiChart = null;

// ── P&L calculation ───────────────────────────────────────────

function calcPL(stake, odds, result) {
  if (result === 'pending' || result === 'push') return 0;
  if (result === 'loss') return -Math.abs(parseFloat(stake));
  const o = parseFloat(odds);
  if (o > 0) return +(parseFloat(stake) * o / 100).toFixed(2);
  return +(parseFloat(stake) * 100 / Math.abs(o)).toFixed(2);
}

// ── Metrics bar ───────────────────────────────────────────────

function renderBetMetrics() {
  const settled    = bets.filter(b => b.result !== 'pending' && b.result !== 'push');
  const wins       = bets.filter(b => b.result === 'win').length;
  const pl         = bets.reduce((s, b) => s + calcPL(b.stake, b.odds, b.result), 0);
  const totalStake = settled.reduce((s, b) => s + parseFloat(b.stake), 0);
  const roi        = totalStake > 0 ? (pl / totalStake * 100) : 0;

  const metrics = [
    { lbl: 'Total bets', val: bets.length,                                      cls: '' },
    { lbl: 'Win rate',   val: settled.length ? (wins/settled.length*100).toFixed(1)+'%' : '—', cls: '' },
    { lbl: 'Net P&L',    val: (pl >= 0 ? '+' : '') + pl.toFixed(2),             cls: pl >= 0 ? 'pos' : 'neg' },
    { lbl: 'ROI',        val: (roi >= 0 ? '+' : '') + roi.toFixed(1) + '%',     cls: roi >= 0 ? 'pos' : 'neg' },
  ];

  const el = document.getElementById('bet-metrics');
  el.innerHTML = metrics.map(m =>
    `<div class="metric">
       <div class="metric-lbl">${m.lbl}</div>
       <div class="metric-val ${m.cls}">${m.val}</div>
     </div>`
  ).join('');
}

// ── Bet table ─────────────────────────────────────────────────

function renderBets() {
  renderBetMetrics();

  const tbody = document.getElementById('bets-body');
  tbody.innerHTML = '';

  if (bets.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:20px;font-size:12px">No bets yet — add your first bet above</td></tr>`;
    updateRoiChart();
    return;
  }

  bets.forEach(b => {
    const pl    = calcPL(b.stake, b.odds, b.result);
    const plStr = b.result === 'pending' ? '—' : (pl >= 0 ? '+' : '') + pl.toFixed(2);
    const plCls = b.result === 'pending' ? '' : pl > 0 ? 'bw' : pl < 0 ? 'bl' : 'bp';
    const rb    = b.result === 'win' ? 'rb-w' : b.result === 'loss' ? 'rb-l' : 'rb-p';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:500;font-size:12px">${b.game}</td>
      <td style="color:var(--text2)">${b.type}</td>
      <td>${b.pick}</td>
      <td style="font-family:'DM Mono',monospace">${b.odds}</td>
      <td style="font-family:'DM Mono',monospace">$${b.stake}</td>
      <td class="${plCls}" style="font-family:'DM Mono',monospace">${plStr}</td>
      <td><span class="result-badge ${rb}">${b.result.toUpperCase()}</span></td>
      <td><button class="del-btn" onclick="deleteBet(${b.id})">×</button></td>
    `;
    tbody.appendChild(tr);
  });

  updateRoiChart();
}

// ── ROI chart ─────────────────────────────────────────────────

function updateRoiChart() {
  const canvas  = document.getElementById('roi-chart');
  const settled = bets.filter(b => b.result !== 'pending').reverse();

  if (settled.length < 2) {
    if (roiChart) { roiChart.destroy(); roiChart = null; }
    return;
  }

  let running = 0;
  const labels = settled.map((_, i) => 'Bet ' + (i + 1));
  const data   = settled.map(b => {
    running += calcPL(b.stake, b.odds, b.result);
    return +running.toFixed(2);
  });

  if (roiChart) roiChart.destroy();

  roiChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Cumulative P&L',
        data,
        borderColor:     BB,
        backgroundColor: BB + '22',
        fill:            true,
        tension:         0.3,
        pointRadius:     3,
        borderWidth:     2,
      }],
    },
    options: {
      responsive:           true,
      maintainAspectRatio:  false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { font: { family: 'DM Mono', size: 10 }, color: '#888' }, grid: { display: false } },
        y: { ticks: { font: { family: 'DM Mono', size: 10 }, color: '#888', callback: v => '$' + v }, grid: { color: 'rgba(128,128,128,0.1)' } },
      },
    },
  });
}

// ── Actions ───────────────────────────────────────────────────

function addBet() {
  const game   = document.getElementById('b-game').value.trim();
  const type   = document.getElementById('b-type').value;
  const pick   = document.getElementById('b-pick').value.trim();
  const odds   = document.getElementById('b-odds').value;
  const stake  = document.getElementById('b-stake').value;
  const result = document.getElementById('b-result').value;

  if (!game || !pick || !odds || !stake) {
    alert('Please fill in Game, Pick, Odds, and Stake before adding.');
    return;
  }

  bets.unshift({ id: Date.now(), game, type, pick, odds, stake, result });
  ['b-game', 'b-pick', 'b-odds', 'b-stake'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('b-result').value = 'pending';
  renderBets();
}

function deleteBet(id) {
  bets = bets.filter(b => b.id !== id);
  renderBets();
}

function exportBetsCSV() {
  const headers = ['Game', 'Type', 'Pick', 'Odds', 'Stake', 'Result', 'P&L'];
  const rows    = bets.map(b => [
    b.game, b.type, b.pick, b.odds, b.stake, b.result,
    calcPL(b.stake, b.odds, b.result).toFixed(2),
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const a   = document.createElement('a');
  a.href     = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'courtiq_bets.csv';
  a.click();
}

// Initial render
renderBets();
