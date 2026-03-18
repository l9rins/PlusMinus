// ─── Scores Module ────────────────────────────────────────────

(function renderScores() {
  const grid = document.getElementById('scores-grid');

  TODAY_GAMES.forEach(g => {
    const favSide = g.homeP >= 50 ? 'home' : 'away';
    const card = document.createElement('div');
    card.className = 'game-card';

    card.innerHTML = `
      <div class="game-meta">
        <span>${g.time}</span>
        <span class="game-status-badge">TONIGHT</span>
      </div>
      <div class="matchup">
        <div class="team-block">
          <div class="team-abbr ${favSide === 'away' ? 'fav' : ''}">${g.away}</div>
          <div class="team-name">${TEAM_NAMES[g.away] || ''}</div>
        </div>
        <div class="score-vs">vs</div>
        <div class="team-block" style="text-align:right">
          <div class="team-abbr ${favSide === 'home' ? 'fav' : ''}">${g.home}</div>
          <div class="team-name">${TEAM_NAMES[g.home] || ''}</div>
        </div>
      </div>
      <div class="prob-bar-wrap">
        <div class="prob-labels">
          <span>${g.away} ${g.awayP}%</span>
          <span>${g.homeP}% ${g.home}</span>
        </div>
        <div class="prob-bar">
          <div class="prob-fill" style="width:${g.awayP}%; background:${g.awayP >= 50 ? BB : 'var(--border2)'}"></div>
        </div>
      </div>
    `;

    const awayName = TEAM_NAMES[g.away] || g.away;
    const homeName = TEAM_NAMES[g.home] || g.home;
    card.style.cursor = 'pointer';
    card.onclick = () => {
      alert(`Full game previews require a real NBA API connection.\n\nGame: ${awayName} @ ${homeName}\nModel: ${g.awayP >= 50 ? awayName : homeName} win probability ${Math.max(g.awayP, g.homeP)}%`);
    };

    grid.appendChild(card);
  });
})();
