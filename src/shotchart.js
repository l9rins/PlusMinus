// ─── Shot Chart Module ────────────────────────────────────────
// Draws an NBA half-court SVG with zone heat dots.
// Orange = above-average FG%, blue = below-average.
// Dot size reflects attempt volume; percentage shown inside.

function renderCourt() {
  const key    = document.getElementById('sc-player').value;
  const filter = document.getElementById('sc-zone').value;
  const data   = SHOT_DATA[key];
  const svg    = document.getElementById('court-svg');

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    || matchMedia('(prefers-color-scheme: dark)').matches;

  const courtFill = isDark ? '#1a1a1c' : '#FDF8F0';
  const lineCol   = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.16)';
  const paintFill = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)';

  // Draw the court
  svg.innerHTML = `
    <rect width="400" height="380" fill="${courtFill}" rx="0"/>
    <!-- Paint / lane -->
    <rect x="148" y="222" width="104" height="128" fill="${paintFill}" stroke="${lineCol}" stroke-width="1"/>
    <rect x="118" y="222" width="164" height="128" fill="none" stroke="${lineCol}" stroke-width="0.8"/>
    <!-- Free throw circle -->
    <circle cx="200" cy="222" r="22" fill="none" stroke="${lineCol}" stroke-width="0.8"/>
    <!-- Restricted area -->
    <path d="M172,350 A28,28 0 0,1 228,350" fill="none" stroke="${lineCol}" stroke-width="0.8" stroke-dasharray="4 3"/>
    <!-- Basket -->
    <rect x="183" y="338" width="34" height="18" fill="none" stroke="${lineCol}" stroke-width="1" rx="3"/>
    <circle cx="200" cy="347" r="5" fill="none" stroke="${lineCol}" stroke-width="1"/>
    <!-- 3-point arc -->
    <path d="M42,350 Q42,82 200,80 Q358,82 358,350" fill="none" stroke="${lineCol}" stroke-width="1.2"/>
    <line x1="42"  y1="282" x2="42"  y2="350" stroke="${lineCol}" stroke-width="1"/>
    <line x1="358" y1="282" x2="358" y2="350" stroke="${lineCol}" stroke-width="1"/>
    <!-- Half-court line -->
    <line x1="0" y1="350" x2="400" y2="350" stroke="${lineCol}" stroke-width="1.5"/>
  `;

  // Filter zones
  const filtered = data.zones.filter(z => {
    if (filter === 'paint')  return /paint|post|floater/i.test(z.z);
    if (filter === 'mid')    return /mid/i.test(z.z);
    if (filter === 'three')  return /3/i.test(z.z);
    return true;
  });

  const zoneStats = [];

  filtered.forEach(z => {
    const pct     = z.makes / z.att;
    const avgPct  = z.z.includes('3') ? 0.36 : 0.52;
    const aboveAvg = pct > avgPct;
    const color   = aboveAvg ? BB : BLUE;
    const opacity = Math.min(0.92, 0.5 + Math.abs(pct - avgPct) * 2.4).toFixed(2);

    // Shot dot
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', z.x);
    circle.setAttribute('cy', z.y);
    circle.setAttribute('r',  z.r);
    circle.setAttribute('fill', color);
    circle.setAttribute('fill-opacity', opacity);
    circle.setAttribute('stroke', color);
    circle.setAttribute('stroke-width', '1');
    circle.setAttribute('stroke-opacity', '0.35');
    svg.appendChild(circle);

    // Percentage label inside dot
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', z.x);
    label.setAttribute('y', z.y + 1);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dominant-baseline', 'central');
    label.setAttribute('fill', 'white');
    label.setAttribute('font-size', z.r > 12 ? '9' : '8');
    label.setAttribute('font-weight', '500');
    label.setAttribute('font-family', 'DM Mono, monospace');
    label.textContent = (pct * 100).toFixed(0) + '%';
    svg.appendChild(label);

    zoneStats.push({ z: z.z, pct, makes: z.makes, att: z.att, aboveAvg });
  });

  // Zone stats cards below the court
  const zd = document.getElementById('zone-stats');
  zd.innerHTML = '';
  zoneStats.slice(0, 6).forEach(z => {
    const card = document.createElement('div');
    card.className = 'zone-stat-card';
    card.innerHTML = `
      <div class="zone-stat-label">${z.z}</div>
      <div class="zone-stat-pct" style="color:${z.aboveAvg ? BB : BLUE}">${(z.pct * 100).toFixed(1)}%</div>
      <div class="zone-stat-att">${z.makes}/${z.att} FG</div>
    `;
    zd.appendChild(card);
  });
}

// Initial render
renderCourt();
