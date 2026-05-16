/* ===== IPOVista — app.js ===== */

// ── Chart.js global defaults ──────────────────────────────────────────────
Chart.defaults.color = '#7a7a90';
Chart.defaults.font.family = "'DM Mono', monospace";
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';

// ── Active charts (for destroy/re-create) ────────────────────────────────
const charts = {};

// ── Utility ──────────────────────────────────────────────────────────────
const fmt = (n, d = 1) => (typeof n === 'number' ? n.toFixed(d) : '—');
const fmtCr = n => n >= 1000 ? `₹${(n / 1000).toFixed(1)}K Cr` : `₹${n.toFixed(0)} Cr`;
const parseYear = d => {
  // d is DD/MM/YY
  const y = d.split('/')[2];
  return parseInt(y) + (parseInt(y) < 30 ? 2000 : 1900);
};

function gainColor(v) {
  return v >= 0 ? '#00d97e' : '#ff5555';
}

// ── View switching ────────────────────────────────────────────────────────
document.querySelectorAll('.pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');
    if (view === 'market') initMarketView();
    if (view === 'leaderboard') initLeaderboard();
  });
});

// ── Search logic ──────────────────────────────────────────────────────────
const searchInput = document.getElementById('searchInput');
const suggestions = document.getElementById('suggestions');
const searchBtn = document.getElementById('searchBtn');

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  if (q.length < 2) { suggestions.classList.remove('open'); return; }

  const matches = IPO_DATA.filter(d => d.name.toLowerCase().includes(q)).slice(0, 8);
  if (!matches.length) { suggestions.classList.remove('open'); return; }

  suggestions.innerHTML = matches.map(m => `
    <div class="suggestion-item" data-name="${m.name}">
      <span>${m.name}</span>
      <span class="suggestion-gain ${m.listingGains >= 0 ? 'pos' : 'neg'}">
        ${m.listingGains >= 0 ? '+' : ''}${fmt(m.listingGains)}%
      </span>
    </div>
  `).join('');
  suggestions.classList.add('open');

  suggestions.querySelectorAll('.suggestion-item').forEach(el => {
    el.addEventListener('click', () => {
      searchInput.value = el.dataset.name;
      suggestions.classList.remove('open');
      runSearch(el.dataset.name);
    });
  });
});

document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) suggestions.classList.remove('open');
});

searchBtn.addEventListener('click', () => {
  const q = searchInput.value.trim();
  if (q) runSearch(q);
});
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { const q = searchInput.value.trim(); if (q) runSearch(q); }
});

// Quick chips
document.querySelectorAll('.chip').forEach(c => {
  c.addEventListener('click', () => {
    const name = c.dataset.name;
    searchInput.value = name;
    runSearch(name);
  });
});

// Back button
document.getElementById('backBtn').addEventListener('click', () => {
  document.getElementById('resultsPanel').classList.add('hidden');
  document.querySelector('.hero').style.display = '';
});

// ── Main search function ──────────────────────────────────────────────────
function runSearch(query) {
  const q = query.toLowerCase();
  // Exact match first, then partial
  let match = IPO_DATA.find(d => d.name.toLowerCase() === q);
  if (!match) match = IPO_DATA.find(d => d.name.toLowerCase().includes(q));
  if (!match) {
    alert(`No IPO found for "${query}". Try a different name.`);
    return;
  }

  suggestions.classList.remove('open');
  document.querySelector('.hero').style.display = 'none';
  renderResults(match);
}

// ── Render results ────────────────────────────────────────────────────────
function renderResults(d) {
  const panel = document.getElementById('resultsPanel');
  panel.classList.remove('hidden');

  // Header
  document.getElementById('companyBadge').textContent = d.name[0].toUpperCase();
  document.getElementById('companyName').textContent = d.name;
  document.getElementById('companyMeta').textContent =
    `Listed ${formatDate(d.date)} · Issue Price ₹${d.issuePrice || '—'}`;

  const badge = document.getElementById('listingBadge');
  badge.textContent = `${d.listingGains >= 0 ? '+' : ''}${fmt(d.listingGains)}%`;
  badge.className = `listing-badge ${d.listingGains >= 0 ? 'pos' : 'neg'}`;

  // KPIs
  document.getElementById('kpi-size').textContent = d.issueSize ? fmtCr(d.issueSize) : '—';
  document.getElementById('kpi-sub').textContent = d.total ? `${fmt(d.total)}x` : '—';
  document.getElementById('kpi-qib').textContent = d.qib ? `${fmt(d.qib)}x` : '—';
  document.getElementById('kpi-hni').textContent = d.hni ? `${fmt(d.hni)}x` : '—';
  document.getElementById('kpi-rii').textContent = d.rii ? `${fmt(d.rii)}x` : '—';
  const kpiGain = document.getElementById('kpi-gain');
  kpiGain.textContent = `${d.listingGains >= 0 ? '+' : ''}${fmt(d.listingGains)}%`;
  kpiGain.style.color = gainColor(d.listingGains);

  // Charts
  renderSubChart(d);
  renderBenchChart(d);
  renderSentiment(d);
  renderPeers(d);
  renderAnalyst(d);

  panel.scrollIntoView({ behavior: 'smooth' });
}

function formatDate(s) {
  if (!s) return '';
  const [dd, mm, yy] = s.split('/');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const year = parseInt(yy) + (parseInt(yy) < 30 ? 2000 : 1900);
  return `${dd} ${months[parseInt(mm) - 1]} ${year}`;
}

// ── Subscription Breakdown Chart ──────────────────────────────────────────
function renderSubChart(d) {
  if (charts.sub) charts.sub.destroy();
  const ctx = document.getElementById('subChart').getContext('2d');
  charts.sub = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['QIB', 'HNI', 'RII', 'Total'],
      datasets: [{
        label: 'Subscription (x)',
        data: [d.qib, d.hni, d.rii, d.total],
        backgroundColor: ['rgba(108,92,231,0.7)', 'rgba(253,121,168,0.7)', 'rgba(200,240,60,0.7)', 'rgba(0,217,126,0.7)'],
        borderColor: ['#6c5ce7', '#fd79a8', '#c8f03c', '#00d97e'],
        borderWidth: 1.5,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { callback: v => v + 'x' } },
        x: { grid: { display: false } }
      }
    }
  });
}

// ── Benchmark Chart ───────────────────────────────────────────────────────
function renderBenchChart(d) {
  if (charts.bench) charts.bench.destroy();

  const year = parseYear(d.date);
  const sameYear = IPO_DATA.filter(r => parseYear(r.date) === year && r.name !== d.name);
  const avgYear = sameYear.length
    ? sameYear.reduce((a, r) => a + r.listingGains, 0) / sameYear.length
    : 0;
  const allAvg = IPO_DATA.reduce((a, r) => a + r.listingGains, 0) / IPO_DATA.length;

  const ctx = document.getElementById('benchChart').getContext('2d');
  charts.bench = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [d.name, `${year} Avg`, 'All-time Avg'],
      datasets: [{
        label: 'Listing Gain %',
        data: [d.listingGains, avgYear, allAvg],
        backgroundColor: [
          d.listingGains >= 0 ? 'rgba(0,217,126,0.7)' : 'rgba(255,85,85,0.7)',
          'rgba(108,92,231,0.5)',
          'rgba(200,240,60,0.5)',
        ],
        borderColor: [gainColor(d.listingGains), '#6c5ce7', '#c8f03c'],
        borderWidth: 1.5,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { callback: v => v + '%' } },
        x: { grid: { display: false } }
      }
    }
  });
}

// ── Sentiment Score ───────────────────────────────────────────────────────
function renderSentiment(d) {
  // Score: 0–100 based on total subscription + listing gains
  const subScore = Math.min(d.total / 2, 50); // max 50 pts from subscription
  const gainScore = Math.min(Math.max(d.listingGains + 50, 0) / 2, 50); // max 50 pts from gain
  const score = Math.round(subScore + gainScore);

  document.getElementById('sentimentScore').textContent = score;

  const tag = score >= 75 ? 'Strong Bullish'
    : score >= 55 ? 'Bullish'
    : score >= 45 ? 'Neutral'
    : score >= 30 ? 'Bearish'
    : 'Strong Bearish';
  document.getElementById('sentimentTag').textContent = tag;

  // Needle position
  setTimeout(() => {
    document.getElementById('sentimentNeedle').style.left = `${score}%`;
    // fill dims everything left of needle
    document.getElementById('sentimentFill').style.transform = `scaleX(${score / 100})`;
  }, 100);
}

// ── Peer IPOs ─────────────────────────────────────────────────────────────
function renderPeers(d) {
  const [dd, mm, yy] = d.date.split('/');
  const base = new Date(`20${yy}-${mm}-${dd}`);

  const peers = IPO_DATA
    .filter(r => {
      if (r.name === d.name) return false;
      const [rd, rm, ry] = r.date.split('/');
      const rDate = new Date(`20${ry}-${rm}-${rd}`);
      const diff = Math.abs(rDate - base) / (1000 * 60 * 60 * 24);
      return diff <= 90;
    })
    .slice(0, 12);

  const grid = document.getElementById('peersGrid');
  if (!peers.length) {
    grid.innerHTML = '<p style="color:var(--text-dim);font-size:0.85rem;">No peers found within 90 days.</p>';
    return;
  }
  grid.innerHTML = peers.map(p => `
    <div class="peer-card" onclick="searchInput.value='${p.name}'; runSearch('${p.name}')">
      <p class="peer-name">${p.name}</p>
      <p class="peer-date">${formatDate(p.date)}</p>
      <p class="peer-gain ${p.listingGains >= 0 ? 'pos' : 'neg'}">
        ${p.listingGains >= 0 ? '+' : ''}${fmt(p.listingGains)}%
      </p>
    </div>
  `).join('');
}

// ── Analyst Summary ───────────────────────────────────────────────────────
function renderAnalyst(d) {
  const year = parseYear(d.date);
  const verdict = d.listingGains >= 20 ? 'buy'
    : d.listingGains >= 0 ? 'hold'
    : 'avoid';
  const verdictText = verdict === 'buy' ? '✅ Strong Buy' : verdict === 'hold' ? '⚖️ Hold' : '❌ Avoid';

  const subStrength = d.total >= 50 ? 'massively oversubscribed'
    : d.total >= 10 ? 'strongly oversubscribed'
    : d.total >= 2 ? 'moderately subscribed'
    : 'weakly subscribed';

  const gainNote = d.listingGains > 0
    ? `delivered a listing gain of +${fmt(d.listingGains)}% — beating issue price by ₹${fmt(d.issuePrice * d.listingGains / 100, 0)}`
    : `fell ${fmt(Math.abs(d.listingGains))}% on listing day below its issue price of ₹${d.issuePrice}`;

  const qibNote = d.qib > 20
    ? 'Strong QIB participation signals high institutional conviction.'
    : d.qib < 2
    ? 'Low QIB interest may indicate institutional skepticism.'
    : 'Moderate QIB participation.';

  document.getElementById('analystTitle').textContent = `${d.name} — IPO Analysis`;
  document.getElementById('analystText').textContent =
    `${d.name} listed in ${year} and was ${subStrength} (${fmt(d.total)}x overall). ` +
    `The IPO ${gainNote}. ${qibNote} ` +
    `HNI subscription stood at ${fmt(d.hni)}x while retail (RII) was ${fmt(d.rii)}x, ` +
    `suggesting ${d.rii > d.hni ? 'stronger retail than HNI interest' : 'higher HNI demand relative to retail'}.`;

  const vEl = document.getElementById('analystVerdict');
  vEl.textContent = verdictText;
  vEl.className = `analyst-verdict ${verdict}`;
}

// ── Market Overview ───────────────────────────────────────────────────────
let marketInited = false;
function initMarketView() {
  if (marketInited) return;
  marketInited = true;

  const avgGain = IPO_DATA.reduce((a, d) => a + d.listingGains, 0) / IPO_DATA.length;
  const positive = IPO_DATA.filter(d => d.listingGains > 0);
  const best = IPO_DATA.reduce((a, b) => b.listingGains > a.listingGains ? b : a);

  document.getElementById('stat-avg-gain').textContent =
    `${avgGain >= 0 ? '+' : ''}${fmt(avgGain)}%`;
  document.getElementById('stat-avg-gain').style.color = gainColor(avgGain);
  document.getElementById('stat-positive').textContent =
    `${positive.length} (${fmt(positive.length / IPO_DATA.length * 100, 0)}%)`;
  document.getElementById('stat-biggest').textContent =
    `${best.name} +${fmt(best.listingGains)}%`;

  // Group by year
  const byYear = {};
  IPO_DATA.forEach(d => {
    const y = parseYear(d.date);
    if (!byYear[y]) byYear[y] = [];
    byYear[y].push(d.listingGains);
  });
  const years = Object.keys(byYear).sort();
  const avgsByYear = years.map(y => {
    const arr = byYear[y];
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  });

  // Year Chart
  if (charts.year) charts.year.destroy();
  charts.year = new Chart(document.getElementById('yearChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: years,
      datasets: [{
        label: 'Avg Listing Gain %',
        data: avgsByYear,
        backgroundColor: avgsByYear.map(v => v >= 0 ? 'rgba(0,217,126,0.6)' : 'rgba(255,85,85,0.6)'),
        borderColor: avgsByYear.map(v => v >= 0 ? '#00d97e' : '#ff5555'),
        borderWidth: 1.5,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { callback: v => v + '%' } },
        x: { grid: { display: false } }
      }
    }
  });

  // Count by Year
  if (charts.count) charts.count.destroy();
  charts.count = new Chart(document.getElementById('countChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: years,
      datasets: [{
        label: 'IPO Count',
        data: years.map(y => byYear[y].length),
        backgroundColor: 'rgba(108,92,231,0.6)',
        borderColor: '#6c5ce7',
        borderWidth: 1.5,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { grid: { color: 'rgba(255,255,255,0.04)' } },
        x: { grid: { display: false } }
      }
    }
  });

  // Gain distribution histogram
  const bins = [
    { label: '< -50%', min: -Infinity, max: -50 },
    { label: '-50 to -20%', min: -50, max: -20 },
    { label: '-20 to 0%', min: -20, max: 0 },
    { label: '0 to 20%', min: 0, max: 20 },
    { label: '20 to 50%', min: 20, max: 50 },
    { label: '50 to 100%', min: 50, max: 100 },
    { label: '> 100%', min: 100, max: Infinity },
  ];
  const binCounts = bins.map(b => IPO_DATA.filter(d => d.listingGains > b.min && d.listingGains <= b.max).length);
  const binColors = bins.map(b => b.min >= 0 ? 'rgba(0,217,126,0.6)' : 'rgba(255,85,85,0.6)');

  if (charts.dist) charts.dist.destroy();
  charts.dist = new Chart(document.getElementById('distChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: bins.map(b => b.label),
      datasets: [{
        label: 'Number of IPOs',
        data: binCounts,
        backgroundColor: binColors,
        borderRadius: 4,
        borderWidth: 0,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { grid: { color: 'rgba(255,255,255,0.04)' } },
        x: { grid: { display: false }, ticks: { font: { size: 9 } } }
      }
    }
  });
}

// ── Leaderboard ───────────────────────────────────────────────────────────
let lbSort = 'gain-desc';

function initLeaderboard() {
  renderLeaderboard();
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      lbSort = btn.dataset.sort;
      renderLeaderboard();
    });
  });
}

function renderLeaderboard() {
  let data = [...IPO_DATA];
  if (lbSort === 'gain-desc') data.sort((a, b) => b.listingGains - a.listingGains);
  else if (lbSort === 'gain-asc') data.sort((a, b) => a.listingGains - b.listingGains);
  else if (lbSort === 'sub-desc') data.sort((a, b) => b.total - a.total);
  else if (lbSort === 'size-desc') data.sort((a, b) => b.issueSize - a.issueSize);
  data = data.slice(0, 50);

  document.getElementById('leaderboardRows').innerHTML = data.map((d, i) => `
    <div class="lb-row" onclick="goToSearch('${d.name}')">
      <span class="lb-rank">${i + 1}</span>
      <span class="lb-name">${d.name}</span>
      <span class="lb-date">${formatDate(d.date)}</span>
      <span class="lb-price">₹${d.issuePrice || '—'}</span>
      <span class="lb-sub">${fmt(d.total)}x</span>
      <span class="lb-gain ${d.listingGains >= 0 ? 'pos' : 'neg'}">
        ${d.listingGains >= 0 ? '+' : ''}${fmt(d.listingGains)}%
      </span>
    </div>
  `).join('');
}

function goToSearch(name) {
  // Switch to search view
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-view="search"]').classList.add('active');
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-search').classList.add('active');
  document.querySelector('.hero').style.display = 'none';
  searchInput.value = name;
  runSearch(name);
}

// ── Init ──────────────────────────────────────────────────────────────────
// Pre-init leaderboard event listeners once
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!document.getElementById('view-leaderboard').classList.contains('active')) return;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    lbSort = btn.dataset.sort;
    renderLeaderboard();
  });
});
