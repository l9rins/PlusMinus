// ─── CourtIQ App Core ─────────────────────────────────────────
// Tab switching and theme toggling

function sw(id, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('on'));
  el.classList.add('on');
  document.getElementById('p-' + id).classList.add('on');
  // Re-render court if switching to shot chart (needs DOM to be visible)
  if (id === 'shotchart') setTimeout(renderCourt, 50);
}

function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  // Re-render the shot chart so court colors update
  renderCourt();
}
