// ─── Player Explorer Module ───────────────────────────────────

let activeTeam = '';

// Build team filter buttons
(function initTeamFilter() {
  const teams = [...new Set(PLAYERS.map(p => p.team))].sort();
  const tf = document.getElementById('teamfilter');

  const allBtn = document.createElement('button');
  allBtn.className = 'tf on';
  allBtn.textContent = 'All';
  allBtn.onclick = () => setTeam('');
  tf.appendChild(allBtn);

  teams.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'tf';
    btn.textContent = t;
    btn.onclick = () => setTeam(t);
    tf.appendChild(btn);
  });
})();

function setTeam(t) {
  activeTeam = t;
  document.querySelectorAll('.tf').forEach(b => {
    b.classList.toggle('on', b.textContent === (t || 'All'));
  });
  filterPlayers();
}

function filterPlayers() {
  const q      = document.getElementById('psearch').value.toLowerCase();
  const pos    = document.getElementById('posfilter').value;
  const sortKey = document.getElementById('sortby').value;

  const list = PLAYERS
    .filter(p =>
      (!q         || p.name.toLowerCase().includes(q)) &&
      (!pos       || p.pos === pos) &&
      (!activeTeam|| p.team === activeTeam)
    )
    .sort((a, b) => b[sortKey] - a[sortKey]);

  renderPlayerGrid(list);
}

function renderPlayerGrid(list) {
  const grid = document.getElementById('pgrid');
  grid.innerHTML = '';

  if (list.length === 0) {
    grid.innerHTML = '<p style="color:var(--text3);font-size:13px;padding:20px 0">No players match your filters.</p>';
    return;
  }

  list.forEach(p => {
    const initials = p.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const card = document.createElement('div');
    card.className = 'pcard';

    card.innerHTML = `
      <div class="pcard-top">
        <div class="avatar" style="background:${p.col}22; color:${p.col}">${initials}</div>
        <div>
          <div class="pname">${p.name}</div>
          <div class="ppos">${p.pos} · ${p.team}</div>
        </div>
      </div>
      <div class="stat-row"><span class="stat-lbl">PTS</span><span class="stat-val">${p.pts.toFixed(1)}</span></div>
      <div class="stat-row"><span class="stat-lbl">AST</span><span class="stat-val">${p.ast.toFixed(1)}</span></div>
      <div class="stat-row"><span class="stat-lbl">REB</span><span class="stat-val">${p.reb.toFixed(1)}</span></div>
      <div class="stat-row"><span class="stat-lbl">PER</span><span class="stat-val">${p.per.toFixed(1)}</span></div>
      <div class="stat-row"><span class="stat-lbl">TS%</span><span class="stat-val">${p.ts.toFixed(1)}%</span></div>
    `;

    card.onclick = () => {
      alert(`Deep stats for ${p.name}:\n\nPTS: ${p.pts} | AST: ${p.ast} | REB: ${p.reb}\nPER: ${p.per} | TS%: ${p.ts}%\n\nConnect a real NBA API (NBA Stats or BallDontLie) for full advanced stats.`);
    };

    grid.appendChild(card);
  });
}

function exportPlayersCSV() {
  const sortKey = document.getElementById('sortby').value;
  const list = [...PLAYERS].sort((a, b) => b[sortKey] - a[sortKey]);

  const headers = ['Name', 'Pos', 'Team', 'PTS', 'AST', 'REB', 'PER', 'TS%'];
  const rows = list.map(p => [p.name, p.pos, p.team, p.pts, p.ast, p.reb, p.per, p.ts]);

  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  downloadCSV(csv, 'courtiq_players.csv');
}

function downloadCSV(content, filename) {
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(content);
  a.download = filename;
  a.click();
}

// Initial render
filterPlayers();
