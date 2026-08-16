const state = {
  terms: [],
  query: '',
  tag: 'all'
};

const els = {
  search: document.querySelector('#search'),
  termCount: document.querySelector('#termCount'),
  lastUpdated: document.querySelector('#lastUpdated'),
  recentList: document.querySelector('#recentList'),
  termList: document.querySelector('#termList'),
  resultCount: document.querySelector('#resultCount'),
  tagFilters: document.querySelector('#tagFilters'),
  emptyState: document.querySelector('#emptyState'),
  clearSearch: document.querySelector('#clearSearch'),
  termDialog: document.querySelector('#termDialog'),
  termDetail: document.querySelector('#termDetail'),
  closeTerm: document.querySelector('#closeTerm'),
  addDialog: document.querySelector('#addDialog'),
  openAdd: document.querySelector('#openAdd'),
  closeAdd: document.querySelector('#closeAdd'),
  addForm: document.querySelector('#addForm'),
  generateJson: document.querySelector('#generateJson'),
  jsonOutputWrap: document.querySelector('#jsonOutputWrap'),
  jsonOutput: document.querySelector('#jsonOutput'),
  copyJson: document.querySelector('#copyJson')
};

async function init() {
  try {
    const response = await fetch('./data/terms.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.terms = await response.json();
    state.terms.sort((a, b) => new Date(b.learnedAt) - new Date(a.learnedAt));
    render();
    openFromHash();
  } catch (error) {
    console.error('Failed to load glossary data:', error);
    els.termList.innerHTML = '<p>用語データを読み込めませんでした。</p>';
  }
}

function render() {
  const filtered = getFilteredTerms();
  els.termCount.textContent = state.terms.length;
  els.resultCount.textContent = `${filtered.length}件`;
  els.lastUpdated.textContent = state.terms[0]
    ? `Last learned ${formatDate(state.terms[0].learnedAt)}`
    : 'No terms yet';

  renderRecent();
  renderFilters();
  renderList(filtered);
  els.emptyState.hidden = filtered.length !== 0;
}

function getFilteredTerms() {
  const q = normalize(state.query);
  return state.terms.filter((term) => {
    const tagMatch = state.tag === 'all' || term.tags?.includes(state.tag);
    if (!tagMatch) return false;
    if (!q) return true;

    const haystack = [
      term.term,
      term.english,
      term.reading,
      term.oneLine,
      term.detail,
      term.example,
      term.context,
      ...(term.tags || [])
    ].join(' ');

    return normalize(haystack).includes(q);
  });
}

function renderRecent() {
  const recent = state.terms.slice(0, 4);
  els.recentList.innerHTML = recent.map((term) => `
    <button class="term-card" type="button" data-term-id="${escapeHtml(term.id)}">
      <span class="term-date">${formatDate(term.learnedAt)}</span>
      <h3>${escapeHtml(term.term)}</h3>
      ${term.english ? `<span class="english">${escapeHtml(term.english)}</span>` : ''}
      <p>${escapeHtml(term.oneLine)}</p>
      <span class="arrow" aria-hidden="true">↗</span>
    </button>
  `).join('') || '<p>最初の用語を追加すると、ここに表示される。</p>';
}

function renderFilters() {
  const tags = [...new Set(state.terms.flatMap((term) => term.tags || []))].sort((a, b) => a.localeCompare(b, 'ja'));
  const options = ['all', ...tags];
  els.tagFilters.innerHTML = options.map((tag) => `
    <button class="filter-chip ${state.tag === tag ? 'is-active' : ''}" type="button" data-tag="${escapeHtml(tag)}">
      ${tag === 'all' ? 'すべて' : escapeHtml(tag)}
    </button>
  `).join('');
}

function renderList(terms) {
  els.termList.innerHTML = terms.map((term) => `
    <button class="term-row" type="button" data-term-id="${escapeHtml(term.id)}">
      <span class="term-title">
        <strong>${escapeHtml(term.term)}</strong>
        ${term.english ? `<small>${escapeHtml(term.english)}</small>` : ''}
      </span>
      <span class="term-summary">${escapeHtml(term.oneLine)}</span>
      <span class="term-tags">${(term.tags || []).slice(0, 3).map((tag) => `<span class="term-tag">${escapeHtml(tag)}</span>`).join('')}</span>
    </button>
  `).join('');
}

function openTerm(id, updateHash = true) {
  const term = state.terms.find((item) => item.id === id);
  if (!term) return;

  const related = (term.related || [])
    .map((relatedId) => state.terms.find((item) => item.id === relatedId))
    .filter(Boolean);

  els.termDetail.innerHTML = `
    <p class="detail-eyebrow">LEARNED ${escapeHtml(formatDate(term.learnedAt))}</p>
    <h2 class="detail-title">${escapeHtml(term.term)}</h2>
    ${term.english ? `<p class="detail-english">${escapeHtml(term.english)}${term.reading ? ` / ${escapeHtml(term.reading)}` : ''}</p>` : ''}
    <p class="detail-oneline">${escapeHtml(term.oneLine)}</p>

    <section class="detail-block">
      <h3>もう少し詳しく</h3>
      <p>${nl2br(term.detail)}</p>
    </section>

    ${term.example ? `
      <section class="detail-block">
        <h3>具体例</h3>
        <p>${nl2br(term.example)}</p>
      </section>
    ` : ''}

    ${term.context ? `
      <section class="detail-block">
        <h3>なぜ覚えた？</h3>
        <p class="context-note">${nl2br(term.context)}</p>
      </section>
    ` : ''}

    <section class="detail-block">
      <h3>タグ</h3>
      <div class="related-links">${(term.tags || []).map((tag) => `<span class="term-tag">${escapeHtml(tag)}</span>`).join('')}</div>
    </section>

    ${related.length ? `
      <section class="detail-block">
        <h3>関連語</h3>
        <div class="related-links">${related.map((item) => `<button class="related-link" type="button" data-term-id="${escapeHtml(item.id)}">${escapeHtml(item.term)}</button>`).join('')}</div>
      </section>
    ` : ''}
  `;

  if (!els.termDialog.open) els.termDialog.showModal();
  if (updateHash) history.replaceState(null, '', `#term=${encodeURIComponent(id)}`);
}

function openFromHash() {
  const match = location.hash.match(/^#term=(.+)$/);
  if (!match) return;
  openTerm(decodeURIComponent(match[1]), false);
}

function closeTerm() {
  els.termDialog.close();
  if (location.hash.startsWith('#term=')) history.replaceState(null, '', location.pathname + location.search);
}

function generateJson() {
  if (!els.addForm.reportValidity()) return;
  const data = new FormData(els.addForm);
  const term = String(data.get('term') || '').trim();
  const learnedAt = String(data.get('learnedAt') || '').trim() || new Date().toISOString().slice(0, 10);
  const entry = {
    id: slugify(String(data.get('english') || term)),
    term,
    english: String(data.get('english') || '').trim(),
    reading: String(data.get('reading') || '').trim(),
    oneLine: String(data.get('oneLine') || '').trim(),
    detail: String(data.get('detail') || '').trim(),
    example: String(data.get('example') || '').trim(),
    context: String(data.get('context') || '').trim(),
    learnedAt,
    tags: splitComma(data.get('tags')),
    related: splitComma(data.get('related')),
    relations: {
      similar: [],
      contrast: []
    }
  };

  els.jsonOutput.textContent = JSON.stringify(entry, null, 2);
  els.jsonOutputWrap.hidden = false;
  els.jsonOutputWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function copyJson() {
  const text = els.jsonOutput.textContent;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    const old = els.copyJson.textContent;
    els.copyJson.textContent = 'コピー済み';
    setTimeout(() => { els.copyJson.textContent = old; }, 1200);
  } catch {
    const range = document.createRange();
    range.selectNodeContents(els.jsonOutput);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

function splitComma(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function slugify(value) {
  return String(value)
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '') || `term-${Date.now()}`;
}

function normalize(value) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  })[char]);
}

function nl2br(value) {
  return escapeHtml(value).replace(/\n/g, '<br>');
}

els.search.addEventListener('input', (event) => {
  state.query = event.target.value;
  render();
});

els.clearSearch.addEventListener('click', () => {
  state.query = '';
  state.tag = 'all';
  els.search.value = '';
  render();
  els.search.focus();
});

document.addEventListener('click', (event) => {
  const termButton = event.target.closest('[data-term-id]');
  if (termButton) openTerm(termButton.dataset.termId);

  const tagButton = event.target.closest('[data-tag]');
  if (tagButton) {
    state.tag = tagButton.dataset.tag;
    render();
  }
});

document.addEventListener('keydown', (event) => {
  const tag = document.activeElement?.tagName?.toLowerCase();
  const isTyping = tag === 'input' || tag === 'textarea';
  if (event.key === '/' && !isTyping && !els.termDialog.open && !els.addDialog.open) {
    event.preventDefault();
    els.search.focus();
  }
  if (event.key === 'Escape' && els.termDialog.open) closeTerm();
});

els.closeTerm.addEventListener('click', closeTerm);
els.termDialog.addEventListener('click', (event) => {
  if (event.target === els.termDialog) closeTerm();
});

els.openAdd.addEventListener('click', () => {
  els.addForm.reset();
  els.addForm.elements.learnedAt.value = new Date().toISOString().slice(0, 10);
  els.jsonOutputWrap.hidden = true;
  els.addDialog.showModal();
});
els.closeAdd.addEventListener('click', () => els.addDialog.close());
els.addDialog.addEventListener('click', (event) => {
  if (event.target === els.addDialog) els.addDialog.close();
});
els.generateJson.addEventListener('click', generateJson);
els.copyJson.addEventListener('click', copyJson);
window.addEventListener('hashchange', openFromHash);

init();
