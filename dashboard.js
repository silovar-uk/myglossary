const dashboardState = {
  terms: [],
  favoriteKey: 'myglossary:favorites:v1',
  heroRandomId: ''
};

function prepareCompactHeroLayout() {
  const hero = document.querySelector('.hero');
  const glossary = document.querySelector('.glossary-section');
  const tagFilters = document.querySelector('#tagFilters');
  if (!hero || !glossary || !tagFilters) return;

  const searchShell = hero.querySelector('.search-shell');
  const heroMeta = hero.querySelector('.hero-meta');
  if (searchShell) {
    const tools = document.createElement('div');
    tools.className = 'glossary-tools';
    tools.setAttribute('aria-label', '用語を探す');
    tools.appendChild(searchShell);
    if (heroMeta) tools.appendChild(heroMeta);
    glossary.insertBefore(tools, tagFilters);
  }

  hero.innerHTML = `
    <div class="random-hero" aria-live="polite">
      <div class="random-hero-content">
        <div class="random-hero-main">
          <p class="eyebrow">RANDOM DISCOVERY</p>
          <h1 id="heroRandomTerm">1語、ひいてみる。</h1>
          <p class="random-hero-english" id="heroRandomEnglish">MY GLOSSARY</p>
          <p class="random-hero-copy" id="heroRandomOneLine">登録した用語から、ランダムに1つ表示する。</p>
        </div>
        <div class="random-hero-actions">
          <button class="primary-button" id="heroRandomOpen" type="button" disabled>詳しく見る</button>
          <button class="ghost-button" id="heroRandomNext" type="button" disabled>別の1語</button>
          <button class="ghost-button" id="heroRandomSources" type="button" aria-expanded="false" aria-controls="heroRandomSourcesMenu" hidden>
            <span aria-hidden="true">↗</span> 参考URL
          </button>
        </div>
        <div id="heroRandomSourcesMenu" class="hero-random-sources-menu" hidden></div>
      </div>
      <div class="random-hero-visual-wrap" id="heroRandomVisualWrap" hidden>
        <p class="random-hero-visual-label">INTERACTIVE SAMPLE</p>
        <div class="random-hero-visual" id="heroRandomVisual"></div>
      </div>
    </div>
  `;

  mountHeroSourceStyles();

  const todayPanel = document.querySelector('#todayTerm')?.closest('.dashboard-panel');
  todayPanel?.remove();

  const randomPracticeCard = document.querySelector('#randomTerm')?.closest('.practice-card');
  randomPracticeCard?.remove();

  const practiceHeading = document.querySelector('.practice-section .section-heading');
  const practiceTitle = document.querySelector('#practice-title');
  if (practiceTitle) practiceTitle.textContent = 'クイズで思い出す';
  const practiceCopy = practiceHeading?.querySelector(':scope > p');
  if (practiceCopy) practiceCopy.textContent = '説明や見た目から、言葉を短く思い出す。';
}

function mountHeroSourceStyles() {
  if (document.querySelector('#heroSourceStyles')) return;
  const style = document.createElement('style');
  style.id = 'heroSourceStyles';
  style.textContent = `
    .hero-random-sources-menu {
      width: min(100%, 560px);
      margin-top: 10px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: rgba(255,253,248,.96);
      padding: 8px;
      box-shadow: 0 14px 32px rgba(31, 28, 23, .08);
    }
    .hero-random-sources-menu[hidden] { display: none; }
    .hero-random-sources-menu a {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      border-radius: 8px;
      padding: 10px 11px;
      color: inherit;
      text-decoration: none;
      font-size: 12px;
      line-height: 1.45;
    }
    .hero-random-sources-menu a:hover,
    .hero-random-sources-menu a:focus-visible {
      background: var(--accent-soft);
      color: var(--accent);
      outline: none;
    }
    .hero-random-sources-menu a + a { border-top: 1px solid var(--line); }
    .hero-random-sources-menu a span:last-child {
      flex: 0 0 auto;
      color: var(--accent);
      font-weight: 800;
    }
    #heroRandomSources > span {
      margin-right: 2px;
      font-weight: 800;
    }
    @media (max-width: 620px) {
      .random-hero-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      #heroRandomSources { grid-column: 1 / -1; }
      .hero-random-sources-menu { width: 100%; }
    }
  `;
  document.head.appendChild(style);
}

async function initDashboard() {
  try {
    const response = await fetch('./data/terms.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    dashboardState.terms = await response.json();
    dashboardState.terms.sort((a, b) => new Date(b.learnedAt) - new Date(a.learnedAt));
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
  }

  renderRandomHero();
  renderDashboardFavorites();
  renderTodayTerm();
  mountMisconceptionField();
  decorateMisconception();

  const detail = document.querySelector('#termDetail');
  if (detail) {
    new MutationObserver(() => window.requestAnimationFrame(decorateMisconception))
      .observe(detail, { childList: true, subtree: true });
  }
}

function pickDashboardRandomTerm() {
  if (!dashboardState.terms.length) return null;
  const candidates = dashboardState.terms.length > 1
    ? dashboardState.terms.filter((term) => term.id !== dashboardState.heroRandomId)
    : dashboardState.terms;
  const term = candidates[Math.floor(Math.random() * candidates.length)];
  dashboardState.heroRandomId = term.id;
  return term;
}

function renderRandomHero() {
  const hero = document.querySelector('.random-hero');
  const termTarget = document.querySelector('#heroRandomTerm');
  const englishTarget = document.querySelector('#heroRandomEnglish');
  const oneLineTarget = document.querySelector('#heroRandomOneLine');
  const openButton = document.querySelector('#heroRandomOpen');
  const nextButton = document.querySelector('#heroRandomNext');
  const sourcesButton = document.querySelector('#heroRandomSources');
  const sourcesMenu = document.querySelector('#heroRandomSourcesMenu');
  const visualWrap = document.querySelector('#heroRandomVisualWrap');
  const visualTarget = document.querySelector('#heroRandomVisual');
  if (!hero || !termTarget || !englishTarget || !oneLineTarget || !openButton || !nextButton || !sourcesButton || !sourcesMenu || !visualWrap || !visualTarget) return;

  const term = pickDashboardRandomTerm();
  if (!term) {
    termTarget.textContent = 'まだ用語がない。';
    englishTarget.textContent = 'MY GLOSSARY';
    oneLineTarget.textContent = '最初の用語を追加すると、ここにランダム表示される。';
    sourcesButton.hidden = true;
    sourcesButton.setAttribute('aria-expanded', 'false');
    sourcesMenu.hidden = true;
    sourcesMenu.innerHTML = '';
    visualTarget.innerHTML = '';
    visualWrap.hidden = true;
    hero.classList.remove('has-visual');
    return;
  }

  termTarget.textContent = term.term;
  englishTarget.textContent = term.english || '—';
  oneLineTarget.textContent = term.oneLine;
  openButton.disabled = false;
  openButton.dataset.termId = term.id;
  nextButton.disabled = dashboardState.terms.length < 2;

  renderHeroSources(term, sourcesButton, sourcesMenu);

  const sampleMarkup = term.visual && typeof renderVisual === 'function'
    ? renderVisual(term.visual)
    : '';
  visualTarget.innerHTML = sampleMarkup;
  visualWrap.hidden = !sampleMarkup;
  hero.classList.toggle('has-visual', Boolean(sampleMarkup));

  if (sampleMarkup && typeof activateSamples === 'function') {
    window.requestAnimationFrame(activateSamples);
  }
}

function renderHeroSources(term, button, menu) {
  const sources = Array.isArray(term.sources)
    ? term.sources.filter((source) => source?.url)
    : [];

  button.setAttribute('aria-expanded', 'false');
  menu.hidden = true;
  menu.innerHTML = '';

  if (!sources.length) {
    button.hidden = true;
    return;
  }

  button.hidden = false;
  menu.innerHTML = sources.map((source, index) => `
    <a href="${escapeDashboard(source.url)}" target="_blank" rel="noopener noreferrer">
      <span>${escapeDashboard(source.label || `参考URL ${index + 1}`)}</span>
      <span aria-hidden="true">↗</span>
    </a>
  `).join('');
}

function toggleHeroSources() {
  const button = document.querySelector('#heroRandomSources');
  const menu = document.querySelector('#heroRandomSourcesMenu');
  if (!button || !menu || button.hidden) return;
  const willOpen = menu.hidden;
  menu.hidden = !willOpen;
  button.setAttribute('aria-expanded', String(willOpen));
}

function favoriteIds() {
  try {
    const value = JSON.parse(localStorage.getItem(dashboardState.favoriteKey) || '[]');
    return new Set(Array.isArray(value) ? value : []);
  } catch {
    return new Set();
  }
}

function renderDashboardFavorites() {
  const target = document.querySelector('#favoritePreview');
  if (!target) return;
  const ids = favoriteIds();
  const favorites = dashboardState.terms.filter((term) => ids.has(term.id)).slice(0, 4);
  if (!favorites.length) {
    target.innerHTML = '<p class="dashboard-empty">まだ★はなし。あとで見返したい用語を詳細画面からお気に入りにできる。</p>';
    return;
  }
  target.innerHTML = favorites.map((term) => dashboardTermButton(term, '★')).join('');
}

function renderTodayTerm() {
  const target = document.querySelector('#todayTerm');
  if (!target || !dashboardState.terms.length) return;
  const now = new Date();
  const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const index = simpleHash(dateKey) % dashboardState.terms.length;
  const term = dashboardState.terms[index];
  target.innerHTML = `
    <div class="today-card">
      <p class="today-label">${escapeDashboard(dateKey)}</p>
      <h4>${escapeDashboard(term.term)}</h4>
      ${term.english ? `<span class="today-english">${escapeDashboard(term.english)}</span>` : ''}
      <p>${escapeDashboard(term.oneLine)}</p>
      <button class="ghost-button" type="button" data-term-id="${escapeDashboard(term.id)}">今日の1語を開く</button>
    </div>
  `;
}

function dashboardTermButton(term, marker = '↗') {
  return `
    <button class="dashboard-term-button" type="button" data-term-id="${escapeDashboard(term.id)}">
      <span>
        <strong>${escapeDashboard(term.term)}</strong>
        ${term.english ? `<small>${escapeDashboard(term.english)}</small>` : ''}
      </span>
      <span aria-hidden="true">${marker}</span>
    </button>
  `;
}

function simpleHash(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function mountMisconceptionField() {
  const form = document.querySelector('#addForm');
  if (!form || form.querySelector('[name="misconception"]')) return;
  const example = form.querySelector('textarea[name="example"]')?.closest('label');
  if (!example) return;
  const label = document.createElement('label');
  label.innerHTML = 'よくある勘違い <small>任意</small><textarea name="misconception" rows="2" placeholder="例：プレースホルダーはラベルの代わりではない"></textarea>';
  example.insertAdjacentElement('afterend', label);
}

function addMisconceptionToJson() {
  const form = document.querySelector('#addForm');
  const output = document.querySelector('#jsonOutput');
  if (!form || !output?.textContent) return;
  let entry;
  try { entry = JSON.parse(output.textContent); } catch { return; }
  const value = String(new FormData(form).get('misconception') || '').trim();
  if (value) entry.misconception = value;
  output.textContent = JSON.stringify(entry, null, 2);
}

function decorateMisconception() {
  const detail = document.querySelector('#termDetail');
  if (!detail || detail.querySelector('.misconception-block')) return;
  const id = currentDashboardTermId();
  const term = dashboardState.terms.find((item) => item.id === id);
  if (!term?.misconception) return;

  const block = document.createElement('section');
  block.className = 'detail-block misconception-block';
  block.innerHTML = `
    <h3>よくある勘違い</h3>
    <div class="misconception-note"><p>${escapeDashboard(term.misconception).replace(/\n/g, '<br>')}</p></div>
  `;

  const detailBlocks = [...detail.querySelectorAll('.detail-block')];
  const exampleBlock = detailBlocks.find((section) => section.querySelector('h3')?.textContent?.trim() === '具体例');
  const contextBlock = detailBlocks.find((section) => section.querySelector('h3')?.textContent?.trim() === 'なぜ覚えた？');
  if (exampleBlock) exampleBlock.insertAdjacentElement('afterend', block);
  else if (contextBlock) contextBlock.insertAdjacentElement('beforebegin', block);
  else detail.appendChild(block);
}

function currentDashboardTermId() {
  const match = location.hash.match(/^#term=(.+)$/);
  if (match) return decodeURIComponent(match[1]);
  const title = document.querySelector('#termDetail .detail-title')?.textContent?.trim();
  return dashboardState.terms.find((term) => term.term === title)?.id || '';
}

function escapeDashboard(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  })[char]);
}

document.addEventListener('click', (event) => {
  if (event.target.closest('#heroRandomNext')) {
    renderRandomHero();
    return;
  }
  if (event.target.closest('#heroRandomSources')) {
    toggleHeroSources();
    return;
  }
  if (event.target.closest('[data-favorite-toggle]')) {
    window.setTimeout(renderDashboardFavorites, 0);
  }
  if (event.target.closest('#generateJson')) {
    window.setTimeout(addMisconceptionToJson, 0);
  }
});

window.addEventListener('storage', (event) => {
  if (event.key === dashboardState.favoriteKey) renderDashboardFavorites();
});
window.addEventListener('hashchange', () => window.requestAnimationFrame(decorateMisconception));

prepareCompactHeroLayout();
initDashboard();
