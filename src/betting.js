// ─── Betting Edge Module ──────────────────────────────────────

(function renderBettingEdge() {
  const grid = document.getElementById('odds-grid');

  const EDGE_LABELS = { high: 'HIGH EDGE', mid: 'MODERATE', low: 'SMALL' };

  ODDS_GAMES.forEach(g => {
    const diff = g.modelP - g.impliedP;
    const card = document.createElement('div');
    card.className = 'odds-card';

    const matchupHtml = g.matchup.replace(
      g.modelFav,
      `<span class="fav-team">${g.modelFav}</span>`
    );

    card.innerHTML = `
      <div class="odds-matchup">${matchupHtml}</div>
      <div class="odds-row"><span class="odds-label">Model win prob</span><span class="odds-val">${g.modelP}%</span></div>
      <div class="odds-row"><span class="odds-label">Market implied</span><span class="odds-val">${g.impliedP}%</span></div>
      <div class="odds-row"><span class="odds-label">Spread</span><span class="odds-val" style="font-size:11px">${g.spread}</span></div>
      <div class="odds-row"><span class="odds-label">O/U Total</span><span class="odds-val" style="font-size:11px">${g.total}</span></div>
      <div class="odds-row" style="margin-top:6px">
        <span class="odds-label">Model edge</span>
        <span class="edge-badge edge-${g.edge}">${EDGE_LABELS[g.edge]} +${diff}%</span>
      </div>
    `;

    card.onclick = () => {
      alert(`Betting breakdown: ${g.matchup}\n\nModel: ${g.modelFav} ${g.modelP}% vs market ${g.impliedP}%\nEdge: +${diff}% ${g.edge === 'high' ? '★ Strong value' : ''}\n\nConnect a live odds API (Odds API, Action Network) for real-time lines.`);
    };

    grid.appendChild(card);
  });
})();
