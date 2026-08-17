const practiceState = {
  terms: [],
  lastRandomId: '',
  currentQuiz: null,
  score: 0,
  answered: 0,
  questionNumber: 0,
  visualNext: false
};

const practiceEls = {
  randomTerm: document.querySelector('#randomTerm'),
  openQuiz: document.querySelector('#openQuiz'),
  quizDialog: document.querySelector('#quizDialog'),
  closeQuiz: document.querySelector('#closeQuiz'),
  quizContent: document.querySelector('#quizContent')
};

async function initPractice() {
  if (!practiceEls.randomTerm || !practiceEls.openQuiz) return;
  practiceEls.randomTerm.disabled = true;
  practiceEls.openQuiz.disabled = true;
  try {
    const response = await fetch('./data/terms.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    practiceState.terms = await response.json();
    practiceEls.randomTerm.disabled = practiceState.terms.length === 0;
    practiceEls.openQuiz.disabled = practiceState.terms.length < 2;
  } catch (error) {
    console.error('Failed to load practice data:', error);
  }
}

function pickRandomTerm() {
  if (!practiceState.terms.length) return null;
  const candidates = practiceState.terms.length > 1
    ? practiceState.terms.filter((term) => term.id !== practiceState.lastRandomId)
    : practiceState.terms;
  const term = candidates[Math.floor(Math.random() * candidates.length)];
  practiceState.lastRandomId = term.id;
  return term;
}

function openRandomTerm() {
  const term = pickRandomTerm();
  if (!term) return;
  if (typeof openTerm === 'function') {
    openTerm(term.id);
  } else {
    location.hash = `term=${encodeURIComponent(term.id)}`;
  }
}

function startQuiz(resetScore = false) {
  if (practiceState.terms.length < 2) return;
  if (resetScore) {
    practiceState.score = 0;
    practiceState.answered = 0;
    practiceState.questionNumber = 0;
    practiceState.visualNext = false;
  }
  practiceState.questionNumber += 1;
  practiceState.visualNext = !practiceState.visualNext;
  practiceState.currentQuiz = pickRandomTerm();
  renderQuizQuestion();
  if (!practiceEls.quizDialog.open) practiceEls.quizDialog.showModal();
}

function renderQuizQuestion() {
  const term = practiceState.currentQuiz;
  if (!term) return;
  const distractors = shuffle(practiceState.terms.filter((item) => item.id !== term.id)).slice(0, 3);
  const choices = shuffle([term, ...distractors]);
  const canUseVisual = practiceState.visualNext && term.visual && typeof renderVisual === 'function';

  const clue = canUseVisual
    ? `<div class="quiz-visual">${renderVisual(term.visual)}</div>`
    : `<div class="quiz-prompt"><p class="quiz-prompt-label">DESCRIPTION</p><p class="quiz-prompt-text">${escapePractice(term.oneLine)}</p></div>`;

  practiceEls.quizContent.innerHTML = `
    <div class="quiz-status">
      <span>Q${practiceState.questionNumber} · ${canUseVisual ? '見た目から当てる' : '説明から当てる'}</span>
      <span>正解 ${practiceState.score} / ${practiceState.answered}</span>
    </div>
    ${clue}
    <div class="quiz-choices" role="group" aria-label="回答候補">
      ${choices.map((choice) => `<button class="quiz-choice" type="button" data-quiz-id="${escapePractice(choice.id)}">${escapePractice(choice.term)}</button>`).join('')}
    </div>
    <div id="quizFeedback" aria-live="polite"></div>
  `;
  activateSamples();
}

function answerQuiz(button) {
  if (!practiceState.currentQuiz || button.disabled) return;
  const correctId = practiceState.currentQuiz.id;
  const selectedId = button.dataset.quizId;
  const correct = selectedId === correctId;
  practiceState.answered += 1;
  if (correct) practiceState.score += 1;

  practiceEls.quizContent.querySelectorAll('.quiz-choice').forEach((choice) => {
    choice.disabled = true;
    if (choice.dataset.quizId === correctId) choice.classList.add('is-correct');
    if (choice === button && !correct) choice.classList.add('is-wrong');
  });

  const term = practiceState.currentQuiz;
  const feedback = practiceEls.quizContent.querySelector('#quizFeedback');
  feedback.innerHTML = `
    <div class="quiz-feedback">
      <strong>${correct ? '正解。' : `正解は「${escapePractice(term.term)}」。`}</strong>
      <p>${escapePractice(term.oneLine)}</p>
    </div>
    <div class="quiz-actions">
      <button class="primary-button" id="nextQuiz" type="button">次の問題</button>
    </div>
  `;
}

function closeQuiz() {
  if (practiceEls.quizDialog?.open) practiceEls.quizDialog.close();
}

function shuffle(items) {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function escapePractice(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  })[char]);
}

const liveControlSelectors = [
  '.sample-input',
  '.sample-icon-button',
  '.sample-avatar',
  '.sample-popup span',
  '.sample-select-trigger',
  '.sample-menu span',
  '.sample-native-select',
  '.sample-accordion > div',
  '.sample-toggle-group span',
  '.sample-switch',
  '.sample-toast',
  '.sample-snackbar b',
  '.sample-modal-box strong',
  '.sample-modal-box em',
  '.sample-dialog-box strong',
  '.sample-dialog-box em',
  '.sample-drawer',
  '.sample-global-nav span',
  '.sample-local-nav span',
  '.sample-local-nav strong',
  '.sample-breadcrumb span',
  '.sample-breakpoint',
  '.sample-progress-wrap',
  '.sample-center:has(.sample-spinner)',
  '.sample-danger-button',
  '.sample-hero em'
].join(',');

function activateSamples() {
  document.querySelectorAll('.ui-sample:not(.is-live)').forEach((sample) => {
    const hasInteractive = sample.querySelector(liveControlSelectors) || sample.querySelector('.sample-dialog-box');
    if (!hasInteractive) return;
    sample.classList.add('is-live');
    if (!sample.querySelector('.sample-interaction-hint')) {
      sample.insertAdjacentHTML('afterbegin', '<span class="sample-interaction-hint">触って試せる</span>');
    }
    sample.querySelectorAll(liveControlSelectors).forEach((control) => {
      control.dataset.liveControl = 'true';
      if (!control.hasAttribute('tabindex')) control.tabIndex = 0;
      if (!control.hasAttribute('role')) control.setAttribute('role', 'button');
    });
    const editable = sample.querySelector('.sample-faux-input');
    if (editable) {
      editable.contentEditable = 'true';
      editable.tabIndex = 0;
      editable.setAttribute('role', 'textbox');
      editable.setAttribute('aria-label', '名前を編集');
    }
  });
}

function showSampleFeedback(sample, text) {
  if (!sample) return;
  sample.querySelector('.sample-feedback')?.remove();
  const feedback = document.createElement('span');
  feedback.className = 'sample-feedback';
  feedback.textContent = text;
  sample.appendChild(feedback);
  window.setTimeout(() => feedback.remove(), 1500);
}

function handleLiveControl(control) {
  const sample = control.closest('.ui-sample');
  if (!sample) return;

  if (control.matches('.sample-input')) {
    const text = control.querySelector('span');
    const hasValue = control.classList.toggle('has-value');
    text.textContent = hasValue ? 'ツールチップ' : '用語を検索';
    showSampleFeedback(sample, hasValue ? '入力するとヒントは消える' : '空になると再表示');
    return;
  }

  if (control.matches('.sample-icon-button')) {
    control.closest('.sample-tooltip-wrap')?.classList.toggle('is-open');
    return;
  }

  if (control.matches('.sample-avatar')) {
    sample.querySelector('.sample-popup')?.classList.toggle('is-open');
    return;
  }

  if (control.matches('.sample-popup span')) {
    showSampleFeedback(sample, `${control.textContent.trim()} を選択`);
    sample.querySelector('.sample-popup')?.classList.remove('is-open');
    return;
  }

  if (control.matches('.sample-select-trigger')) {
    control.closest('.sample-dropdown')?.classList.toggle('is-open');
    return;
  }

  if (control.matches('.sample-menu span')) {
    const dropdown = control.closest('.sample-dropdown');
    const trigger = dropdown?.querySelector('.sample-select-trigger');
    if (trigger?.firstChild) trigger.firstChild.textContent = `${control.textContent.trim()} `;
    dropdown?.classList.remove('is-open');
    showSampleFeedback(sample, '選択肢を変更');
    return;
  }

  if (control.matches('.sample-native-select')) {
    const values = ['埼玉県', '東京都', '千葉県', '神奈川県'];
    const label = control.querySelector('span');
    const index = Math.max(0, values.indexOf(label.textContent.trim()));
    label.textContent = values[(index + 1) % values.length];
    showSampleFeedback(sample, '選択値が変わる');
    return;
  }

  if (control.matches('.sample-accordion > div')) {
    const accordion = control.closest('.sample-accordion');
    let panel = control.nextElementSibling;
    if (!panel || panel.tagName !== 'P') {
      panel = document.createElement('p');
      const title = control.querySelector('b')?.textContent || '';
      const copy = title.includes('入場') ? '入場方法やゲートの案内を確認できます。' : 'スタジアムまでのアクセスを確認できます。';
      panel.textContent = copy;
      control.insertAdjacentElement('afterend', panel);
    }
    const collapsed = panel.classList.toggle('is-collapsed');
    const icon = control.querySelector('span');
    if (icon) icon.textContent = collapsed ? '＋' : '−';
    accordion.querySelectorAll(':scope > div').forEach((header) => {
      if (header === control) return;
      const other = header.nextElementSibling;
      if (other?.tagName === 'P') other.classList.add('is-collapsed');
      const otherIcon = header.querySelector('span');
      if (otherIcon) otherIcon.textContent = '＋';
    });
    return;
  }

  if (control.matches('.sample-toggle-group span')) {
    const group = control.closest('.sample-toggle-group');
    group.querySelectorAll('span').forEach((item) => item.classList.toggle('is-selected', item === control));
    showSampleFeedback(sample, '状態を切り替え');
    return;
  }

  if (control.matches('.sample-switch')) {
    const isOff = control.classList.toggle('is-off');
    control.setAttribute('aria-pressed', String(!isOff));
    showSampleFeedback(sample, isOff ? 'OFF' : 'ON');
    return;
  }

  if (control.matches('.sample-toast')) {
    control.classList.add('is-hidden');
    sample.dataset.toastHidden = 'true';
    showSampleFeedback(sample, '閉じた。背景を押すと再表示');
    return;
  }

  if (control.matches('.sample-snackbar b')) {
    const bar = control.closest('.sample-snackbar');
    const label = bar.querySelector('span');
    label.textContent = '削除を取り消しました';
    control.textContent = '完了';
    bar.classList.add('is-undone');
    return;
  }

  if (control.matches('.sample-modal-box strong, .sample-modal-box em')) {
    const box = control.closest('.sample-modal-box');
    box.classList.add('is-dismissed');
    box.closest('.sample-window')?.classList.remove('is-dimmed');
    sample.dataset.modalDismissed = 'true';
    showSampleFeedback(sample, control.matches('strong') ? '削除を実行' : 'キャンセル');
    return;
  }

  if (control.matches('.sample-dialog-box strong, .sample-dialog-box em')) {
    const box = control.closest('.sample-dialog-box');
    const title = box.querySelector('b');
    title.textContent = control.matches('strong') ? '保存しました' : 'キャンセルしました';
    showSampleFeedback(sample, 'ダイアログ内で応答');
    return;
  }

  if (control.matches('.sample-drawer')) {
    control.classList.add('is-closed');
    sample.dataset.drawerClosed = 'true';
    showSampleFeedback(sample, 'ドロワーを閉じた');
    return;
  }

  if (control.matches('.sample-global-nav span, .sample-local-nav span, .sample-local-nav strong')) {
    const nav = control.parentElement;
    nav.querySelectorAll('span, strong').forEach((item) => item.classList.toggle('is-selected', item === control));
    showSampleFeedback(sample, `${control.textContent.trim()} を選択`);
    return;
  }

  if (control.matches('.sample-breadcrumb span')) {
    const browser = control.closest('.sample-browser');
    const title = browser?.querySelector('.sample-page-title');
    if (title) title.textContent = `${control.textContent.trim()} を開いた例`;
    return;
  }

  if (control.matches('.sample-breakpoint')) {
    control.classList.toggle('is-swapped');
    showSampleFeedback(sample, '幅による切り替えをイメージ');
    return;
  }

  if (control.matches('.sample-progress-wrap')) {
    animateProgress(control, sample);
    return;
  }

  if (control.matches('.sample-center') && control.querySelector('.sample-spinner')) {
    const spinner = control.querySelector('.sample-spinner');
    const paused = spinner.classList.toggle('is-paused');
    showSampleFeedback(sample, paused ? '一時停止' : '再開');
    return;
  }

  if (control.matches('.sample-danger-button')) {
    control.closest('.sample-feedforward')?.classList.toggle('is-revealed');
    showSampleFeedback(sample, '操作前に結果を予告');
    return;
  }

  if (control.matches('.sample-hero em')) {
    control.classList.toggle('is-pressed');
    control.textContent = control.classList.contains('is-pressed') ? 'チケット画面へ →' : 'チケットを見る →';
  }
}

function animateProgress(control, sample) {
  if (control._progressTimer) window.clearInterval(control._progressTimer);
  const bar = control.querySelector('.sample-progress i');
  const number = control.querySelector(':scope > div:first-child span');
  let value = 0;
  if (bar) bar.style.width = '0%';
  if (number) number.textContent = '0%';
  control._progressTimer = window.setInterval(() => {
    value += 10;
    if (bar) bar.style.width = `${value}%`;
    if (number) number.textContent = `${value}%`;
    if (value >= 100) {
      window.clearInterval(control._progressTimer);
      control._progressTimer = null;
      showSampleFeedback(sample, '完了');
    }
  }, 80);
}

function restoreSampleFromBackground(sample) {
  if (sample.dataset.toastHidden === 'true') {
    sample.querySelector('.sample-toast')?.classList.remove('is-hidden');
    delete sample.dataset.toastHidden;
  }
  if (sample.dataset.modalDismissed === 'true') {
    sample.querySelector('.sample-modal-box')?.classList.remove('is-dismissed');
    sample.querySelector('.sample-window')?.classList.add('is-dimmed');
    delete sample.dataset.modalDismissed;
  }
  if (sample.dataset.drawerClosed === 'true') {
    sample.querySelector('.sample-drawer')?.classList.remove('is-closed');
    delete sample.dataset.drawerClosed;
  }
}

practiceEls.randomTerm?.addEventListener('click', openRandomTerm);
practiceEls.openQuiz?.addEventListener('click', () => startQuiz(true));
practiceEls.closeQuiz?.addEventListener('click', closeQuiz);
practiceEls.quizDialog?.addEventListener('click', (event) => {
  if (event.target === practiceEls.quizDialog) closeQuiz();
});

document.addEventListener('click', (event) => {
  const answer = event.target.closest('[data-quiz-id]');
  if (answer) {
    answerQuiz(answer);
    return;
  }
  if (event.target.closest('#nextQuiz')) {
    startQuiz(false);
    return;
  }

  const control = event.target.closest('[data-live-control]');
  if (control) {
    handleLiveControl(control);
    return;
  }

  const sample = event.target.closest('.ui-sample.is-live');
  if (sample) restoreSampleFromBackground(sample);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && practiceEls.quizDialog?.open) {
    closeQuiz();
    return;
  }
  const control = event.target.closest?.('[data-live-control]');
  if (!control || event.target.isContentEditable) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    handleLiveControl(control);
  }
});

const termDetailForPractice = document.querySelector('#termDetail');
if (termDetailForPractice) {
  new MutationObserver(() => activateSamples()).observe(termDetailForPractice, { childList: true, subtree: true });
}

initPractice();
activateSamples();
