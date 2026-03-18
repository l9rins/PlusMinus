// ─── Standings Module ─────────────────────────────────────────

function renderStandings(teams, bodyId) {
  const tbody = document.getElementById(bodyId);
  const PLAYOFF_LINE = 6; // top 6 get direct seeds; 7-10 play-in

  teams.forEach((t, i) => {
    const tr = document.createElement('tr');
    if (i === PLAYOFF_LINE) tr.classList.add('playoff-line');

    // Shorten long team names for narrow screens
    const shortName = t.n
      .replace('Oklahoma City ', 'OKC ')
      .replace('Los Angeles ',   'LA ')
      .replace('Golden State ',  'GS ')
      .replace('San Antonio ',   'SA ')
      .replace('New Orleans ',   'NO ')
      .replace('Portland Trail Blazers', 'Portland');

    tr.innerHTML = `
      <td class="s-rank">${i + 1}</td>
      <td class="${i === 0 ? 's-top' : 's-team'}">${shortName}</td>
      <td>${t.w}</td>
      <td>${t.l}</td>
      <td>${t.pct.toFixed(3)}</td>
    `;

    tbody.appendChild(tr);
  });
}

renderStandings(EAST_STANDINGS, 'east-body');
renderStandings(WEST_STANDINGS, 'west-body');
