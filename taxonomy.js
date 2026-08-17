const taxonomyState = {
  terms: [],
  categoryMap: {},
  selectedPath: [],
  favoriteOnly: false,
  favorites: new Set()
};

const FAVORITE_KEY = 'myglossary:favorites:v1';

function loadFavorites() {
  try {
    const stored = JSON.parse(localStorage.getItem(FAVORITE_KEY) || '[]');
    taxonomyState.favorites = new Set(Array.isArray(stored) ? stored : []);
  } catch {
    taxonomyState.favorites = new Set();
  }
}

function saveFavorites() {
  localStorage.setItem(FAVORITE_KEY, JSON.stringify([...taxonomyState.favorites]));
}

function categoryPathFor(term) {
  if (Array.isArray(term?.categoryPath) && term.categoryPath.length) return term.categoryPath;
  return taxonomyState.categoryMap[term?.id] || [];
}

function pathStartsWith(path, prefix) {
  return prefix.every((segment, index) => path[index] === segment);
}

async function initTaxonomy() {
  loadFavorites();
  try {
    const [termResponse, categoryResponse] = await Promise.all([
      fetch('./data/terms.json', { cache: 'no-store' }),
      fetch('./data/categories.json', { cache: 'no-store' })
    ]);
    if (!termResponse.ok) throw new Error(`terms HTTP ${termResponse.status}`);
    taxonomyState.terms = await termResponse.json();
    if (categoryResponse.ok) taxonomyState.categoryMap = await categoryResponse.json();
  } catch (error) {
    console.error('Failed to load taxonomy data:', error);
  }

  mountTaxonomyBrowser();
  augmentAddForm();
  decorateAll();
  applyExtendedFilters();

  const list = document.querySelector('#termList');
  const recent = document.querySelector('#recentList');
  const detail = document.querySelector('#termDetail');
  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(() => {
      decorateAll();
      applyExtendedFilters();
    });
  });
  if (list) observer.observe(list, { childList: true, subtree: true });
  if (recent) observer.observe(recent, { childList: true, subtree: true });
  if (detail) observer.observe(detail, { childList: true, subtree: true });
}

function mountTaxonomyBrowser() {
  const tagFilters = document.querySelector('#tagFilters');
  if (!tagFilters || document.querySelector('#taxonomyBrowser')) return;
  const shell = document.createElement('div');
  shell.id = 'taxonomyBrowser';
  shell.className = 'taxonomy-shell';
  shell.innerHTML = `
    <div class="taxonomy-topline">
      <div class="taxonomy-title">分類 <small>階層でたどる</small></div>
      <div class="taxonomy-actions">
        <button class="taxonomy-action" id="favoriteOnly" type="button" aria-pressed="false">☆ お気に入り</button>
        <button class="taxonomy-action" id="clearCategory" type="button">分類をクリア</button>
      </div>
    </div>
    <div class="category-trail" id="categoryTrail"></div>
    <div class="category-levels" id="categoryLevels"></div>
  `;
  tagFilters.before(shell);
  shell.addEventListener('click', handleTaxonomyClick);
  renderCategoryBrowser();
}

function handleTaxonomyClick(event) {
  const category = event.target.closest('[data-category-level]');
  if (category) {
    const level = Number(category.dataset.categoryLevel);
    const value = category.dataset.categoryValue;
    taxonomyState.selectedPath = taxonomyState.selectedPath.slice(0, level);
    taxonomyState.selectedPath[level] = value;
    renderCategoryBrowser();
    applyExtendedFilters();
    return;
  }

  const trail = event.target.closest('[data-trail-level]');
  if (trail) {
    const level = Number(trail.dataset.trailLevel);
    taxonomyState.selectedPath = level < 0 ? [] : taxonomyState.selectedPath.slice(0, level + 1);
    renderCategoryBrowser();
    applyExtendedFilters();
    return;
  }

  if (event.target.closest('#clearCategory')) {
    taxonomyState.selectedPath = [];
    renderCategoryBrowser();
    applyExtendedFilters();
    return;
  }

  if (event.target.closest('#favoriteOnly')) {
    taxonomyState.favoriteOnly = !taxonomyState.favoriteOnly;
    const button = document.querySelector('#favoriteOnly');
    button?.classList.toggle('is-active', taxonomyState.favoriteOnly);
    button?.setAttribute('aria-pressed', String(taxonomyState.favoriteOnly));
    if (button) button.textContent = taxonomyState.favoriteOnly ? '★ お気に入りのみ' : '☆ お気に入り';
    applyExtendedFilters();
  }
}

function renderCategoryBrowser() {
  const trail = document.querySelector('#categoryTrail');
  const levels = document.querySelector('#categoryLevels');
  if (!trail || !levels) return;

  trail.innerHTML = [
    '<button type="button" data-trail-level="-1">すべて</button>',
    ...taxonomyState.selectedPath.map((segment, index) => `<span>›</span><button type="button" data-trail-level="${index}">${escapeTaxonomy(segment)}</button>`)
  ].join('');

  const labels = ['大分類', '中分類', '小分類', '詳細分類'];
  const rows = [];
  for (let level = 0; level < 4; level += 1) {
    const prefix = taxonomyState.selectedPath.slice(0, level);
    const values = [...new Set(taxonomyState.terms
      .map((term) => categoryPathFor(term))
      .filter((path) => path.length > level && pathStartsWith(path, prefix))
      .map((path) => path[level]))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'ja'));
    if (!values.length) break;
    rows.push(`
      <div class="category-level">
        <span class="category-level-label">${labels[level] || `LEVEL ${level + 1}`}</span>
        <div class="category-options">
          ${values.map((value) => `<button class="category-chip ${taxonomyState.selectedPath[level] === value ? 'is-selected' : ''}" type="button" data-category-level="${level}" data-category-value="${escapeTaxonomy(value)}">${escapeTaxonomy(value)}</button>`).join('')}
        </div>
      </div>
    `);
    if (!taxonomyState.selectedPath[level]) break;
  }
  levels.innerHTML = rows.join('');
}

function applyExtendedFilters() {
  const rows = [...document.querySelectorAll('#termList .term-row[data-term-id]')];
  rows.forEach((row) => {
    const id = row.dataset.termId;
    const term = taxonomyState.terms.find((item) => item.id === id);
    const categoryMatch = !taxonomyState.selectedPath.length || pathStartsWith(categoryPathFor(term), taxonomyState.selectedPath);
    const favoriteMatch = !taxonomyState.favoriteOnly || taxonomyState.favorites.has(id);
    row.hidden = !(categoryMatch && favoriteMatch);
  });
  const resultCount = document.querySelector('#resultCount');
  if (resultCount) resultCount.textContent = `${rows.filter((row) => !row.hidden).length}件`;
}

function decorateAll() {
  decorateCards();
  decorateDetail();
}

function decorateCards() {
  document.querySelectorAll('[data-term-id]').forEach((card) => {
    const id = card.dataset.termId;
    if (!id) return;
    let indicator = card.querySelector(':scope > .favorite-indicator');
    const favorite = taxonomyState.favorites.has(id);
    if (favorite && !indicator) {
      indicator = document.createElement('span');
      indicator.className = 'favorite-indicator';
      indicator.setAttribute('aria-hidden', 'true');
      indicator.textContent = '★';
      const title = card.querySelector('.term-title strong, h3');
      if (title) title.appendChild(indicator);
    } else if (!favorite && indicator) {
      indicator.remove();
    }
  });
}

function decorateDetail() {
  const detail = document.querySelector('#termDetail');
  if (!detail || !detail.children.length) return;
  const id = currentTermId();
  const term = taxonomyState.terms.find((item) => item.id === id);
  if (!term) return;

  let tools = detail.querySelector('.detail-meta-tools');
  if (!tools) {
    tools = document.createElement('div');
    tools.className = 'detail-meta-tools';
    const english = detail.querySelector('.detail-english');
    const title = detail.querySelector('.detail-title');
    (english || title)?.insertAdjacentElement('afterend', tools);
  }

  const path = categoryPathFor(term);
  const favorite = taxonomyState.favorites.has(id);
  tools.innerHTML = `
    <button class="favorite-button ${favorite ? 'is-favorite' : ''}" type="button" data-favorite-toggle="${escapeTaxonomy(id)}" aria-pressed="${favorite}">${favorite ? '★ お気に入り' : '☆ お気に入り'}</button>
    ${path.length ? `<div class="detail-category-trail" aria-label="分類">${path.map((segment) => `<span>${escapeTaxonomy(segment)}</span>`).join('')}</div>` : ''}
  `;
}

function currentTermId() {
  const match = location.hash.match(/^#term=(.+)$/);
  if (match) return decodeURIComponent(match[1]);
  const title = document.querySelector('#termDetail .detail-title')?.textContent?.trim();
  return taxonomyState.terms.find((term) => term.term === title)?.id || '';
}

function toggleFavorite(id) {
  if (!id) return;
  if (taxonomyState.favorites.has(id)) taxonomyState.favorites.delete(id);
  else taxonomyState.favorites.add(id);
  saveFavorites();
  decorateAll();
  applyExtendedFilters();
}

function augmentAddForm() {
  const form = document.querySelector('#addForm');
  const related = form?.querySelector('input[name="related"]')?.closest('label');
  if (!form || !related || form.querySelector('[name="categoryPath"]')) return;

  const block = document.createElement('div');
  block.innerHTML = `
    <label>分類 <small>› または &gt; で区切る</small><input name="categoryPath" placeholder="Web › UI › ナビゲーション"></label>
    <div class="form-grid">
      <label>参考元名 <small>任意</small><input name="sourceLabel" placeholder="例：MDN / W3C"></label>
      <label>参考URL <small>任意・一次情報推奨</small><input name="sourceUrl" type="url" placeholder="https://..."></label>
    </div>
    <p class="add-policy-note">出典は登録条件にしない。定義を確認した語は、公式ドキュメントなど一次情報を残すのを推奨。</p>
  `;
  related.insertAdjacentElement('afterend', block);

  document.querySelector('#generateJson')?.addEventListener('click', () => {
    window.queueMicrotask(augmentGeneratedJson);
  });
}

function augmentGeneratedJson() {
  const form = document.querySelector('#addForm');
  const output = document.querySelector('#jsonOutput');
  if (!form || !output?.textContent) return;
  let entry;
  try { entry = JSON.parse(output.textContent); } catch { return; }
  const data = new FormData(form);
  const categoryPath = String(data.get('categoryPath') || '')
    .split(/\s*(?:›|>|\/)+\s*/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (categoryPath.length) entry.categoryPath = categoryPath;

  const sourceUrl = String(data.get('sourceUrl') || '').trim();
  const sourceLabel = String(data.get('sourceLabel') || '').trim();
  if (sourceUrl) {
    let fallback = '参考資料';
    try { fallback = new URL(sourceUrl).hostname.replace(/^www\./, ''); } catch {}
    entry.sources = [{ label: sourceLabel || fallback, url: sourceUrl }];
  }
  output.textContent = JSON.stringify(entry, null, 2);
}

function escapeTaxonomy(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  })[char]);
}

document.addEventListener('click', (event) => {
  const favorite = event.target.closest('[data-favorite-toggle]');
  if (favorite) toggleFavorite(favorite.dataset.favoriteToggle);
});

window.addEventListener('hashchange', () => window.requestAnimationFrame(decorateDetail));
initTaxonomy();
