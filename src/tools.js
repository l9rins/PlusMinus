// ─── Analytics Tools Module ───────────────────────────────────

(function renderTools() {
  const grid = document.getElementById('tools-grid');

  TOOLS.forEach(t => {
    const card = document.createElement('div');
    card.className = 'tool-card';
    card.innerHTML = `
      <div class="tool-icon">${t.icon}</div>
      <div class="tool-title">${t.title}</div>
      <div class="tool-desc">${t.desc}</div>
    `;
    card.onclick = () => alert(`Tool: ${t.title}\n\n${t.desc}\n\nIn the full web app, this would launch an interactive panel or notebook.`);
    grid.appendChild(card);
  });
})();
