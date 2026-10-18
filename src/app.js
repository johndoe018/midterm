import { STORAGE_KEY, freshState, validateState, dayKey, shuffle, recordReview, isDue, mastered, accuracy, streak } from './core.js';
import bank from '../public/bank-data.js?v=3';

const $ = s => document.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  cards: '<rect x="6" y="6" width="14" height="15" rx="2"/><path d="M16 3H5a2 2 0 0 0-2 2v12M10 11h6m-6 4h4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  practice: '<path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  book: '<path d="M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1zm0 0v15"/>',
  chart: '<path d="M4 3v17h17M8 15v-4m5 4V7m5 8v-6"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
  spark: '<path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3zM20 2v4m-2-2h4"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 9v12"/>',
  function: '<path d="M8 21c3 0 3-18 6-18m-7 7h10M5 17l3 4 4-2m-1-15 3-1 3 3"/>',
  message: '<path d="M21 11a9 9 0 0 1-9 9H4l-2 2V11a9.5 9.5 0 0 1 19 0zM7 9h10M7 13h6"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8zM2 12l10 5 10-5M2 16l10 5 10-5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="m9 3 1-1h4l1 3 3 1 3 2-1 3v3l1 3-3 2-3 1-1 2h-4l-1-2-3-1-3-2 1-3v-3L3 8l3-2z"/>',
  flame: '<path d="M13 2c1 7 7 7 7 13a8 8 0 1 1-16 0c0-4 3-6 4-8 0 4 2 4 2 4s4-4 3-9z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  moon: '<path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 14-2l1 6M4 12l1 6a8 8 0 0 0 14-2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>',
};
function icon(name, cls = '') { return `<svg class="icon ${cls}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.book}</svg>`; }
function flower() { return '<svg class="flower" viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M50 8v84M8 50h84M20.3 20.3l59.4 59.4m0-59.4L20.3 79.7" stroke="currentColor" stroke-width="9" stroke-linecap="round"/></svg>'; }
const questions = bank.questions;
const byId = new Map(questions.map(q => [q.id, q]));
let state = freshState();
let storageWarning = false;
try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) state = validateState(JSON.parse(saved), questions); } catch { toast('Не удалось прочитать прогресс. Можно восстановить его из резервной копии.'); }
let route = location.hash.slice(1) || 'home';
const routes = { home: ['Обзор', 'grid'], cards: ['Карточки', 'cards'], practice: ['Тренировка', 'practice'], exam: ['Экзамен', 'clock'], essays: ['Открытые задания', 'message'], bank: ['Банк вопросов', 'book'], progress: ['Мой прогресс', 'chart'] };
const modeLabels = { cards: 'Карточки', practice: 'Тренировка', exam: 'Экзамен', essays: 'Открытые задания' };
let filters = { search: '', topic: 'all', type: 'all', status: 'all' };
let setupTopic = 'all';
let setupPool = 'all';
let timer;
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { if (!storageWarning) { storageWarning = true; toast('Хранилище недоступно. Экспортируй прогресс перед закрытием вкладки.'); } }
}
function toast(message) {
  const el = $('#toast'); el.textContent = message; el.classList.add('visible');
  clearTimeout(toast.timeout); toast.timeout = setTimeout(() => el.classList.remove('visible'), 4200);
}
function navigate(view) { if (location.hash === '#' + view) { route = view; render(); } else location.hash = view; }
function topicOf(q) { return bank.topics.find(t => t.id === q.topic); }
function masteredCount(list = questions) { return list.filter(q => mastered(state, q.id)).length; }
function practicedCount(list = questions) { return list.filter(q => state.progress[q.id]).length; }
function percentage(value, total) { return total ? Math.round(value / total * 100) : 0; }
function bookmark(q) { return `<button class="icon-btn bookmark ${state.favorites.includes(q.id) ? 'selected' : ''}" data-action="bookmark" data-id="${q.id}" aria-label="${state.favorites.includes(q.id) ? 'Убрать из избранного' : 'В избранное'}" aria-pressed="${state.favorites.includes(q.id)}">${icon('star')}</button>`; }
function progressBar(value, cls = '') { return `<div class="progress-track ${cls}"><span style="width:${Math.min(100, value)}%"></span></div>`; }
function topicOptions(selected = 'all') { return `<option value="all">Все темы</option>${bank.topics.map(t => `<option value="${t.id}" ${String(t.id) === String(selected) ? 'selected' : ''}>${t.id}. ${t.title}</option>`).join('')}`; }
function pageHeading(kicker, title, description, action = '') { return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${description}</p></div>${action}</div>`; }

function render() {
  clearInterval(timer);
  if (!routes[route]) route = 'home';
  document.documentElement.dataset.theme = state.theme;
  document.title = `${routes[route][0]} · memo — AI Midterm`;
  const today = state.activity[dayKey()] || 0;
  $('#app').innerHTML = `<aside class="sidebar" id="sidebar"><a href="#home" class="brand" aria-label="memo — главная"><span class="brand-mark">m<span>${flower()}</span></span>memo<span class="brand-dot">.</span></a><div class="workspace-label">ТВОЙ УЧЕБНЫЙ СТОЛ</div><div class="course-chip"><span class="course-icon">AI</span><span><strong>AI Midterm</strong><small>Mathematics education</small></span><span class="tiny-dot"></span></div><div class="nav-label">ПОДГОТОВКА</div><nav aria-label="Основная навигация">${Object.entries(routes).map(([key, [label, ico]]) => `<a href="#${key}" class="nav-item ${route === key ? 'active' : ''}" ${route === key ? 'aria-current="page"' : ''}>${icon(ico)}<span>${label}</span>${key === 'bank' ? '<span class="nav-count">329</span>' : ''}${key === 'cards' && questions.filter(q => state.progress[q.id] && isDue(state, q.id)).length ? '<span class="nav-dot"></span>' : ''}</a>`).join('')}</nav><div class="sidebar-bottom"><div class="small-reminder"><span class="tiny-spark">${flower()}</span><p>Немного каждый день —<br>и всё останется в памяти.</p></div><button class="nav-item" data-action="settings">${icon('settings')}<span>Настройки и данные</span></button><div class="profile"><span class="avatar">Я</span><div><strong>Моё пространство</strong><small>Прогресс на этом устройстве</small></div><span class="status-dot"></span></div></div></aside><div class="mobile-scrim" data-action="close-menu"></div><div class="workspace"><header class="topbar"><div class="breadcrumb"><button class="icon-btn mobile-menu" data-action="menu" aria-label="Открыть меню">${icon('menu')}</button><span>Моя подготовка</span><span class="slash">/</span><strong>${routes[route][0]}</strong></div><div class="header-tools"><span class="offline-label"><span class="status-dot"></span><span id="connection-label">${navigator.onLine ? 'Всё сохранено локально' : 'Офлайн-режим'}</span></span><span class="header-divider"></span><button class="streak-pill" data-action="show-streak" aria-label="Серия занятий">${icon('flame')}<strong>${streak(state)}</strong><span>дн.</span></button><button class="icon-btn theme-btn" data-action="theme" aria-label="Переключить тему">${icon('moon')}</button></div></header><main id="main" tabindex="-1">${renderView(today)}</main><footer class="footer"><span>Сделано для понимания. И немного для зубрёжки.</span><a href="./public/question-bank.pdf" target="_blank" rel="noopener">Оригинал PDF ${icon('arrow')}</a></footer></div>`;
  if (route === 'bank') renderBankResults();
  if (state.session?.kind === route && !state.session.finished && state.session.kind === 'exam') {
    tick(); timer = setInterval(tick, 1000);
  }
}
function renderView(today) {
  if (['cards', 'practice', 'exam', 'essays'].includes(route)) {
    if (state.session?.kind === route) return state.session.finished ? renderResults() : renderSession();
    return renderSetup(route);
  }
  if (route === 'bank') return renderBank();
  if (route === 'progress') return renderProgress();
  return renderHome(today);
}
function renderHome(today) {
  const seen = practicedCount(), learned = masteredCount();
  const due = questions.filter(q => state.progress[q.id] && isDue(state, q.id)).length;
  return `<div class="home-heading"><div><div class="eyebrow">ШАГ ЗА ШАГОМ К MIDTERM</div><h1>Хороший день, чтобы запомнить.</h1></div><span class="date-label">${new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', weekday: 'short' }).format(new Date())}</span></div><section class="hero"><div class="hero-copy"><div class="hero-badge"><span></span>ТВОЯ ПОДГОТОВКА, ТВОЙ РИТМ</div><h2>Меньше перечитывать.<br><em>Больше помнить.</em></h2><p>Все вопросы к AI Midterm — в одном месте.<br>Разбирайся, проверяй себя и возвращайся к сложному.</p><div class="hero-actions"><button class="btn btn-dark" data-action="quick-start">${state.session && !state.session.finished ? 'Продолжить занятие' : 'Начать учиться'} ${icon('arrow')}</button><span class="hero-note">10 вопросов · около 5 минут</span></div></div><div class="hero-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="art-spark">${flower()}</div><div class="floating-note note-one"><span class="note-pin"></span><span class="note-label">маленькие шаги</span><strong>Большой<br>результат.</strong><div class="note-lines"></div></div><div class="floating-note note-two">${icon('check')}<span>Это ты уже знаешь.</span></div><span class="art-cross">✦</span></div></section><section class="stats-grid" aria-label="Статистика подготовки"><div class="stat"><span class="stat-icon lavender">${icon('book')}</span><div><span class="stat-number">${seen}<small> / 329</small></span><span class="stat-label">Вопросов разобрано</span></div></div><div class="stat"><span class="stat-icon sage">${icon('check')}</span><div><span class="stat-number">${learned}</span><span class="stat-label">Уверенно в памяти</span></div></div><div class="stat"><span class="stat-icon peach">${icon('target')}</span><div><span class="stat-number">${accuracy(state)}<small>%</small></span><span class="stat-label">Точность ответов</span></div></div><div class="stat"><span class="stat-icon yellow">${icon('refresh')}</span><div><span class="stat-number">${due}</span><span class="stat-label">Пора повторить</span></div></div></section><div class="home-columns"><div><div class="section-heading"><div><h2>Как будем учиться?</h2><p>Выбери формат под своё настроение.</p></div><span class="subtle">01 — ПРАКТИКА</span></div><div class="mode-grid"><a class="mode-card" href="#cards"><span class="mode-icon lavender">${icon('cards')}</span><span class="mode-tag">ЗАПОМНИТЬ</span><h3>Карточки</h3><p>Вспомни ответ.<br>Переверни. Повтори.</p><span class="mode-link">В своём темпе ${icon('arrow')}</span></a><a class="mode-card" href="#practice"><span class="mode-icon sage">${icon('practice')}</span><span class="mode-tag">ПОНЯТЬ</span><h3>Тренировка</h3><p>Выбирай ответ и сразу<br>разбирай объяснение.</p><span class="mode-link">Без давления ${icon('arrow')}</span></a><a class="mode-card" href="#exam"><span class="mode-icon peach">${icon('clock')}</span><span class="mode-tag">ПРОВЕРИТЬ</span><h3>Пробный экзамен</h3><p>Таймер, никаких подсказок.<br>Всё как на настоящем.</p><span class="mode-link">Проверка готовности ${icon('arrow')}</span></a></div><div class="section-heading topics-heading"><div><h2>Карта твоих знаний</h2><p>Шесть лекций и один дополнительный раздел.</p></div><a class="text-link" href="#bank">Все вопросы ${icon('arrow')}</a></div><div class="topic-grid">${bank.topics.map(t => {
    const list = questions.filter(q => q.topic === t.id), learned = masteredCount(list), seen = practicedCount(list);
    return `<button class="topic-card" data-action="topic" data-topic="${t.id}"><span class="topic-number">${String(t.id).padStart(2, '0')}</span><div class="topic-content"><div class="topic-card-title"><h3>${t.title}</h3>${t.supplementary ? '<span class="mini-tag">ДОП.</span>' : ''}</div><p>${list.filter(q => q.type === 'mcq').length} тестовых · ${list.filter(q => q.type === 'essay').length} открытых</p>${progressBar(percentage(learned, list.length))}<div class="topic-card-footer"><span>${seen ? `${seen} из ${list.length} разобрано` : 'Ещё не начато'}</span><strong>${percentage(learned, list.length)}%</strong></div></div>${icon('chevron')}</button>`;
  }).join('')}</div></div><aside class="right-column"><section class="daily-card"><div class="card-top"><span class="eyebrow">МАЛЕНЬКАЯ ПРИВЫЧКА</span>${icon('spark')}</div><h3>Сегодняшняя цель</h3><div class="goal-ring" style="--value:${Math.min(100, percentage(today, state.goal))}"><div><strong>${today}<span> / ${state.goal}</span></strong><small>повторений</small></div></div><p>${today >= state.goal ? 'Цель выполнена. Ты молодец!' : today ? 'Отличное начало. Продолжай в своём темпе.' : 'Пять минут сегодня — спокойнее завтра.'}</p><button class="btn btn-outline full" data-action="quick-start">${today >= state.goal ? 'Ещё немного практики' : 'Сделать первый шаг'} ${icon('arrow')}</button></section><section class="week-card"><div class="card-top"><h3>Твоя неделя</h3>${icon('flame')}</div><div class="week-days">${Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); const n = state.activity[dayKey(d)] || 0; return `<div class="week-day ${n ? 'done' : ''} ${i === 6 ? 'today' : ''}" title="${dayKey(d)}: ${n} повторений"><span>${new Intl.DateTimeFormat('ru', { weekday: 'short' }).format(d)}</span><b>${n ? icon('check') : d.getDate()}</b></div>`; }).join('')}</div><p><strong>${streak(state)} дн.</strong> в ритме подготовки</p></section><section class="tip-card"><span class="tip-label">НА ЗАМЕТКУ</span><span class="tip-quote">“</span><p>Попробуй вспомнить ответ <em>до</em> того, как его увидишь.</p><small>Активное вспоминание помогает запомнить надолго.</small><span class="tip-flower" aria-hidden="true">${flower()}</span></section><a href="#essays" class="essay-promo"><span class="essay-promo-icon">${icon('message')}</span><div><strong>А что с открытыми?</strong><p>73 задания с ответами<br>и критериями на 5 баллов.</p><span class="text-link">Потренировать ${icon('arrow')}</span></div></a></aside></div>`;
}
function renderSetup(kind) {
  const titles = { cards: ['СНАЧАЛА ВСПОМНИ. ПОТОМ ПРОВЕРЬ.', 'Знания, которые остаются.', 'Активное вспоминание и интервальное повторение для всех 329 вопросов.'], practice: ['ОШИБАТЬСЯ ЗДЕСЬ — ПОЛЕЗНО.', 'Разберёмся на практике.', '256 тестовых вопросов. Объяснение и ссылка на источник после каждого ответа.'], exam: ['ТВОЯ ГЕНЕРАЛЬНАЯ РЕПЕТИЦИЯ', 'Проверим готовность?', 'Ответы и объяснения появятся в конце. Таймер продолжит идти, даже если закрыть вкладку.'], essays: ['НЕ ТОЛЬКО ВЫБРАТЬ. ОБЪЯСНИТЬ.', 'Сформулируй своими словами.', '73 открытых задания: твой ответ, образец из PDF и пять критериев самооценки.'] };
  return `${pageHeading(...titles[kind])}<div class="setup-layout"><form class="setup-card" id="start-form" data-kind="${kind}"><div class="setup-card-title"><span class="mode-icon ${kind === 'exam' ? 'peach' : 'lavender'}">${icon(routes[kind][1])}</span><div><h2>Настрой занятие</h2><p>Подстрой нагрузку под себя.</p></div></div><label>Тема<select name="topic">${topicOptions(setupTopic)}</select></label><div class="form-grid"><label>Какие вопросы<select name="pool"><option value="all" ${setupPool === 'all' ? 'selected' : ''}>Все вопросы</option><option value="new">Ещё не изученные</option><option value="due" ${setupPool === 'due' ? 'selected' : ''}>К повторению</option><option value="wrong" ${setupPool === 'wrong' ? 'selected' : ''}>Последние ошибки</option><option value="favorites" ${setupPool === 'favorites' ? 'selected' : ''}>Избранное</option></select></label><label>Количество<select name="count">${[5,10,20,30,50,100,329].map(n => `<option value="${n}" ${n === (kind === 'exam' ? 20 : kind === 'essays' ? 5 : 10) ? 'selected' : ''}>${n === 329 ? 'Все подходящие' : n + ' вопросов'}</option>`).join('')}</select></label></div>${kind === 'cards' ? '<label>Тип вопросов<select name="type"><option value="all">Тестовые и открытые</option><option value="mcq">Только тестовые</option><option value="essay">Только открытые</option></select></label>' : ''}${kind === 'exam' ? '<label>Время на экзамен<select name="minutes"><option value="10">10 минут</option><option value="20" selected>20 минут</option><option value="30">30 минут</option><option value="60">60 минут</option><option value="0">Без ограничения</option></select></label>' : ''}<label class="checkbox-label"><input type="checkbox" name="random" checked> Перемешать вопросы</label><p id="setup-error" class="form-error" role="alert"></p><button class="btn btn-dark full" type="submit">${kind === 'exam' ? 'Начать экзамен' : 'Начать занятие'} ${icon('arrow')}</button><p class="setup-footnote">Прогресс сохраняется автоматически на этом устройстве.</p></form><aside class="setup-aside"><div class="large-flower" aria-hidden="true">${flower()}</div><h2>${kind === 'exam' ? 'Без подсказок.<br>С пользой.' : kind === 'essays' ? 'Своя мысль —<br>лучше заученной.' : 'Вспомнить сложнее.<br>Запомнить легче.'}</h2><div class="setup-instructions">${(kind === 'exam' ? ['Выбирай ответы в любом порядке.', 'Возвращайся к вопросам через навигатор.', 'Заверши экзамен, чтобы увидеть разбор.'] : kind === 'essays' ? ['Напиши ответ, прежде чем смотреть образец.', 'Сравни с ответом из исходного PDF.', 'Отметь выполненные критерии: каждый даёт 1 балл.'] : kind === 'cards' ? ['Попробуй ответить по памяти.', 'Открой оборот и проверь себя.', 'Оцени ответ: повтор через 10 минут, 1 или 3 дня.'] : ['Выбери один из четырёх ответов.', 'Прочитай объяснение, даже если угадал.', 'Вернись к ошибкам в следующем занятии.']).map((text, i) => `<div><span>0${i + 1}</span><p>${text}</p></div>`).join('')}</div><div class="info-note">${icon('info')}<p>${kind === 'essays' ? 'Оценка открытых ответов — самостоятельная, по критериям PDF. AI не оценивает твой текст.' : '«Уверенно в памяти» — уровень 3 из 5. Интервалы повторения: 1, 3, 7, 14 и 30 дней.'}</p></div></aside></div>`;
}
function startSession(kind, options) {
  const type = kind === 'essays' ? 'essay' : kind === 'cards' ? options.type || 'all' : 'mcq';
  let pool = questions.filter(q => (type === 'all' || q.type === type) && (options.topic === 'all' || q.topic === Number(options.topic)));
  pool = pool.filter(q => options.pool === 'new' ? !state.progress[q.id] : options.pool === 'due' ? isDue(state, q.id) : options.pool === 'wrong' ? state.progress[q.id]?.lastWrong : options.pool === 'favorites' ? state.favorites.includes(q.id) : true);
  if (!pool.length) { const message = 'Здесь пока нет вопросов. Попробуй другую тему или фильтр.'; if ($('#setup-error')) $('#setup-error').textContent = message; else toast(message); return; }
  if (options.random) pool = shuffle(pool);
  const ids = pool.slice(0, Number(options.count) || 10).map(q => q.id);
  createSession(kind, ids, Number(options.minutes) || 0);
}
function createSession(kind, ids, minutes = 0) {
  if (state.session && !state.session.finished && !confirm('Начать новое занятие? Текущее занятие завершится; уже сохранённый прогресс останется.')) return;
  const now = Date.now();
  state.session = { kind, ids, index: 0, answers: {}, revealed: false, startedAt: now, deadline: minutes ? now + minutes * 60000 : null, finished: false, recorded: false };
  save(); if (route === kind) render(); else navigate(kind);
}
function questionMeta(q) { return `<div class="question-meta"><span class="question-id">${q.id}</span><span>${esc(topicOf(q).title)}</span>${bookmark(q)}</div>`; }
function renderSession() {
  const s = state.session, q = byId.get(s.ids[s.index]), answered = Object.hasOwn(s.answers, q.id), answer = s.answers[q.id];
  return `<div class="session-top"><button class="text-link" data-action="leave-session">← К настройке</button><div class="session-heading"><span>${modeLabels[s.kind]}</span><strong>${s.index + 1}<small> / ${s.ids.length}</small></strong></div>${s.kind === 'exam' ? '<span class="timer" id="exam-timer">' + icon('clock') + '<span></span></span>' : '<span class="keyboard-hint">Сохраняется автоматически</span>'}</div>${progressBar(percentage(Object.keys(s.answers).length, s.ids.length), 'session-progress')}<div class="session-layout"><div class="session-main"><article class="question-card ${s.kind === 'cards' ? 'flashcard' : ''}">${questionMeta(q)}<div class="question-type-label">${s.kind === 'cards' ? 'ПОПРОБУЙ ВСПОМНИТЬ' : q.type === 'essay' ? 'ОТКРЫТЫЙ ВОПРОС' : 'ВЫБЕРИ ОДИН ОТВЕТ'}</div><h1 class="question-text" lang="en">${esc(q.question)}</h1>${s.kind === 'cards' ? renderCard(q, s, answered) : q.type === 'essay' ? renderEssay(q, s, answered) : `<div class="options">${q.options.map((option, i) => {
    const show = s.kind !== 'exam' && answered;
    const cls = show ? i === q.answer ? 'correct' : i === answer ? 'incorrect' : '' : answer === i ? 'chosen' : '';
    return `<button class="option ${cls}" data-action="answer" data-answer="${i}" ${show ? 'disabled' : ''} aria-pressed="${answer === i}"><span class="option-letter">${'ABCD'[i]}</span><span lang="en">${esc(option)}</span>${show && i === q.answer ? icon('check') : show && i === answer ? icon('close') : ''}</button>`;
  }).join('')}</div>${s.kind !== 'exam' && answered ? `<div class="answer-feedback ${answer === q.answer ? 'success' : 'failure'}"><strong>${answer === q.answer ? 'Верно. Так держать!' : 'Ничего страшного. Разберёмся.'}</strong><p lang="en">${esc(q.explanation)}</p><span>${esc(q.reference)} · ${esc(q.source)}</span></div>` : ''}`}</article><div class="session-controls"><button class="btn btn-outline" data-action="previous" ${s.index === 0 ? 'disabled' : ''}>← Назад</button><span class="keyboard-hint">${s.kind === 'cards' ? 'Пробел — перевернуть · 1–3 — оценка' : s.kind === 'essays' ? 'Ответ сохраняется при вводе' : '1–4 — ответ · Enter — дальше'}</span><button class="btn btn-dark" data-action="next" ${s.kind !== 'exam' && !answered ? 'disabled' : ''}>${s.index === s.ids.length - 1 ? 'Завершить' : 'Дальше'} ${icon('arrow')}</button></div></div><aside class="session-sidebar"><h3>Твоё занятие</h3><p>${Object.keys(s.answers).length} из ${s.ids.length} ${s.kind === 'exam' ? 'отвечено' : 'разобрано'}</p><div class="question-nav">${s.ids.map((id, i) => `<button data-action="jump" data-index="${i}" class="${i === s.index ? 'current' : ''} ${Object.hasOwn(s.answers, id) ? 'answered' : ''}" aria-label="Вопрос ${i + 1}${Object.hasOwn(s.answers, id) ? ', отвечен' : ''}" ${i === s.index ? 'aria-current="step"' : ''}>${i + 1}</button>`).join('')}</div><div class="nav-legend"><span><i></i> Отвечено</span><span><i></i> Текущий</span></div>${s.kind === 'exam' ? '<button class="btn btn-outline full" data-action="finish-exam">Завершить экзамен</button><p class="setup-footnote">Пропущенные вопросы считаются ошибками.</p>' : `<div class="info-note">${icon('info')}<p>${s.kind === 'cards' ? 'Честная самооценка помогает выбрать время для следующего повторения.' : 'Вопросы и ответы взяты из твоего PDF. Формулировки сохранены на английском.'}</p></div>`}</aside></div>`;
}
function renderCard(q, s, answered) {
  return `<div class="flashcard-prompt">${q.type === 'mcq' ? 'Сформулируй ответ, прежде чем перевернуть карточку.' : 'Назови ключевые идеи, которые должны быть в ответе.'}</div>${s.revealed || answered ? `<div class="card-back"><span class="eyebrow">ОТВЕТ ИЗ PDF</span><h2 lang="en">${q.type === 'mcq' ? `${'ABCD'[q.answer]}. ${esc(q.options[q.answer])}` : 'Model response'}</h2><p lang="en">${esc(q.type === 'mcq' ? q.explanation : q.modelAnswer)}</p>${q.type === 'essay' ? `<ol class="compact-rubric" lang="en">${q.rubric.map(r => `<li>${esc(r)}</li>`).join('')}</ol>` : ''}<span class="source-label">${esc(q.reference)}</span></div>${answered ? '<div class="rated-note">Самооценка сохранена. Можно идти дальше.</div>' : '<p class="rate-label">Насколько легко ты вспомнил?</p><div class="rating-buttons"><button data-action="rate" data-quality="0" class="rate-again"><strong>Не помню</strong><small>повтор через 10 мин</small></button><button data-action="rate" data-quality="1" class="rate-good"><strong>Вспомнил</strong><small>интервал увеличится</small></button><button data-action="rate" data-quality="2" class="rate-easy"><strong>Легко!</strong><small>интервал увеличится ×2</small></button></div>'}` : `<div class="flip-placeholder" aria-hidden="true"><span>?</span></div><button class="btn btn-dark flip-btn" data-action="flip">${icon('refresh')} Показать ответ <kbd>Space</kbd></button>`}`;
}
function renderEssay(q, s, answered) {
  const essay = state.essays[q.id] || { text: '', checks: [] };
  const score = essay.checks.filter(Boolean).length;
  return `<label class="essay-label" for="essay-answer">Твой ответ <span>Сохраняется автоматически</span></label><textarea id="essay-answer" data-essay="${q.id}" lang="en" placeholder="Write your answer here. Try to explain the idea in your own words…" rows="7">${esc(essay.text)}</textarea><div class="essay-word-count"><span id="word-count">${essay.text.trim() ? essay.text.trim().split(/\s+/).length : 0}</span> слов</div>${s.revealed || answered ? `<div class="model-answer"><span class="eyebrow">ОБРАЗЕЦ ИЗ PDF</span><p lang="en">${esc(q.modelAnswer)}</p><span class="source-label">${esc(q.reference)}</span></div><div class="rubric"><h3>Самопроверка <span id="rubric-score">${score} / 5</span></h3><p>Отметь то, что есть в твоём ответе. Каждый критерий — 1 балл.</p>${q.rubric.map((r, i) => `<label class="rubric-item"><input type="checkbox" data-rubric="${i}" data-id="${q.id}" ${essay.checks[i] ? 'checked' : ''}><span lang="en">${esc(r)}</span></label>`).join('')}</div>${answered ? '<div class="rated-note">Оценка сохранена.</div>' : '<button class="btn btn-dark full" data-action="grade-essay">Сохранить самооценку и продолжить ' + icon('arrow') + '</button>'}` : '<button class="btn btn-outline full" data-action="flip">Сравнить с образцом ' + icon('arrow') + '</button><p class="setup-footnote">Постарайся сначала ответить самостоятельно.</p>'}`;
}
function finishSession() {
  const s = state.session;
  if (!s || s.finished) return;
  if (s.kind === 'exam' && !s.recorded) {
    s.ids.forEach(id => recordReview(state, id, s.answers[id] === byId.get(id).answer ? 1 : 0));
  }
  const correct = s.ids.filter(id => s.kind === 'exam' || s.kind === 'practice' ? s.answers[id] === byId.get(id).answer : s.answers[id] > 0).length;
  if (!s.recorded) state.history.push({ kind: s.kind, date: Date.now(), total: s.ids.length, correct });
  state.history = state.history.slice(-100);
  s.recorded = true; s.finished = true; save(); render(); window.scrollTo({ top: 0, behavior: 'smooth' });
}
function renderResults() {
  const s = state.session;
  const correct = s.ids.filter(id => ['exam', 'practice'].includes(s.kind) ? s.answers[id] === byId.get(id).answer : s.answers[id] > 0).length;
  const percent = percentage(correct, s.ids.length);
  return `<div class="result-header"><span class="eyebrow">${modeLabels[s.kind].toUpperCase()} ЗАВЕРШЕНА</span><h1>${percent >= 80 ? 'Есть чему порадоваться.' : 'Теперь знаешь, что повторить.'}</h1><p>${s.kind === 'cards' || s.kind === 'essays' ? 'Результат основан на твоей самооценке.' : 'Каждая ошибка — подсказка, на что обратить внимание.'}</p><div class="result-ring" style="--value:${percent}"><div><strong>${percent}<span>%</span></strong><small>${correct} из ${s.ids.length} ${s.kind === 'cards' || s.kind === 'essays' ? 'вспомнил' : 'верно'}</small></div></div><div class="result-actions"><button class="btn btn-dark" data-action="retry-wrong" ${correct === s.ids.length ? 'disabled' : ''}>Разобрать сложное ${icon('refresh')}</button><button class="btn btn-outline" data-action="new-session">Новое занятие</button><a class="text-link" href="#home">К обзору ${icon('arrow')}</a></div></div><div class="section-heading"><div><h2>Разбор по вопросам</h2><p>Раскрой вопрос, чтобы посмотреть правильный ответ.</p></div></div><div class="review-list">${s.ids.map((id, i) => {
    const q = byId.get(id), a = s.answers[id], ok = ['exam', 'practice'].includes(s.kind) ? a === q.answer : a > 0;
    return `<details class="review-item"><summary><span class="review-status ${ok ? 'good' : 'bad'}">${icon(ok ? 'check' : 'close')}</span><span><small>${i + 1} · ${q.id} · ${esc(topicOf(q).title)}</small><strong lang="en">${esc(q.question)}</strong></span>${icon('chevron')}</summary><div class="review-content">${q.type === 'mcq' ? `${['practice', 'exam'].includes(s.kind) ? `<p>Твой ответ: <strong lang="en">${a === undefined ? 'Пропущено' : `${'ABCD'[a]}. ${esc(q.options[a])}`}</strong></p>` : ''}<p class="correct-text" lang="en">${'ABCD'[q.answer]}. ${esc(q.options[q.answer])}</p><p lang="en">${esc(q.explanation)}</p>` : `<p lang="en">${esc(q.modelAnswer)}</p><ol lang="en">${q.rubric.map(r => `<li>${esc(r)}</li>`).join('')}</ol>`}<span class="source-label">${esc(q.reference)} · ${esc(q.source)}</span></div></details>`;
  }).join('')}</div>`;
}
function tick() {
  const s = state.session;
  if (!s || s.kind !== 'exam' || s.finished) return;
  const el = $('#exam-timer span');
  if (!el) return;
  if (!s.deadline) { el.textContent = 'Без таймера'; return; }
  const seconds = Math.max(0, Math.ceil((s.deadline - Date.now()) / 1000));
  el.textContent = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  $('#exam-timer').classList.toggle('urgent', seconds < 120);
  if (seconds === 0) { finishSession(); toast('Время вышло. Экзамен завершён, результаты сохранены.'); }
}
function renderBank() {
  return `${pageHeading('НИЧЕГО НЕ ПОТЕРЯЛОСЬ', 'Весь материал. Под рукой.', '256 тестовых + 73 открытых вопроса из твоего PDF, с ответами и источниками.')}<div class="bank-toolbar"><label class="search-field">${icon('search')}<input id="bank-search" type="search" placeholder="Найти вопрос, термин или номер…" aria-label="Поиск по банку вопросов" value="${esc(filters.search)}"><kbd>/</kbd></label><div class="bank-filters"><select id="filter-topic" aria-label="Тема">${topicOptions(filters.topic)}</select><select id="filter-type" aria-label="Тип вопроса"><option value="all">Все типы</option><option value="mcq" ${filters.type === 'mcq' ? 'selected' : ''}>Тестовые</option><option value="essay" ${filters.type === 'essay' ? 'selected' : ''}>Открытые</option></select><select id="filter-status" aria-label="Прогресс"><option value="all">Любой прогресс</option>${[['new','Не изучены'],['wrong','Последние ошибки'],['favorites','Избранное'],['mastered','В памяти'],['due','К повторению']].map(([v, label]) => `<option value="${v}" ${filters.status === v ? 'selected' : ''}>${label}</option>`).join('')}</select></div></div><div class="bank-list-heading"><span id="bank-count" role="status"></span><span>ФОРМУЛИРОВКИ НА АНГЛИЙСКОМ</span></div><div class="bank-list" id="bank-results"></div>`;
}
function renderBankResults() {
  const search = filters.search.toLowerCase().trim();
  const list = questions.filter(q => (filters.topic === 'all' || q.topic === Number(filters.topic)) && (filters.type === 'all' || q.type === filters.type) && (!search || [q.id, q.question, ...q.options || [], q.explanation || '', q.modelAnswer || '', topicOf(q).title].join(' ').toLowerCase().includes(search)) && (filters.status === 'new' ? !state.progress[q.id] : filters.status === 'wrong' ? state.progress[q.id]?.lastWrong : filters.status === 'favorites' ? state.favorites.includes(q.id) : filters.status === 'mastered' ? mastered(state, q.id) : filters.status === 'due' ? isDue(state, q.id) : true));
  $('#bank-count').textContent = `Найдено: ${list.length} из 329`;
  $('#bank-results').innerHTML = list.length ? list.map(q => `<article class="bank-row"><button class="bank-question" data-action="question" data-id="${q.id}"><span class="bank-id">${q.id}</span><span class="bank-question-body"><span class="bank-meta">${esc(topicOf(q).title)}<span>·</span>${q.type === 'mcq' ? 'Тестовый' : 'Открытый'}</span><strong lang="en">${esc(q.question)}</strong><span class="bank-status ${mastered(state, q.id) ? 'mastered' : state.progress[q.id]?.lastWrong ? 'needs-work' : ''}">${mastered(state, q.id) ? 'В памяти' : state.progress[q.id]?.lastWrong ? 'Повторить' : state.progress[q.id] ? 'В процессе' : 'Не изучен'}</span></span>${icon('chevron')}</button>${bookmark(q)}</article>`).join('') : `<div class="empty-state">${icon('search')}<h2>Здесь пока тихо.</h2><p>Попробуй другой запрос или сбрось фильтры.</p><button class="btn btn-outline" data-action="reset-filters">Сбросить фильтры</button></div>`;
}
function renderProgress() {
  const total = Object.values(state.activity).reduce((a, b) => a + b, 0);
  const learned = masteredCount();
  const dates = Array.from({ length: 28 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 27 + i); return dayKey(d); });
  return `${pageHeading('КАЖДЫЙ ШАГ СЧИТАЕТСЯ', 'Ты уже ближе, чем вчера.', 'Прогресс хранится в этом браузере. Экспортируй копию, чтобы перенести его на другое устройство.', '<button class="btn btn-outline" data-action="export">' + icon('download') + ' Экспорт</button>')}<div class="progress-overview"><section class="progress-summary"><span class="eyebrow">ОБЩАЯ ГОТОВНОСТЬ</span><div class="big-percent">${percentage(learned, 329)}<span>%</span></div><p>${learned} из 329 вопросов уверенно в памяти</p>${progressBar(percentage(learned, 329))}<div class="summary-stats"><div><strong>${total}</strong><span>повторений</span></div><div><strong>${accuracy(state)}%</strong><span>точность</span></div><div><strong>${streak(state)}</strong><span>дней подряд</span></div></div></section><section class="activity-card"><h2>Ритм за 28 дней</h2><p>Даже короткое занятие — уже шаг вперёд.</p><div class="activity-grid">${dates.map(day => { const n = state.activity[day] || 0; return `<div class="activity-cell level-${n === 0 ? 0 : n < 10 ? 1 : n < 20 ? 2 : 3}" title="${day}: ${n} повторений"><span>${Number(day.slice(-2))}</span><small>${n || '·'}</small></div>`; }).join('')}</div><div class="heatmap-legend">Меньше <i></i><i></i><i></i><i></i> Больше</div></section></div><div class="section-heading"><h2>По темам</h2><span class="subtle">УРОВЕНЬ 3 ИЗ 5 = В ПАМЯТИ</span></div><div class="topic-progress-list">${bank.topics.map(t => { const list = questions.filter(q => q.topic === t.id); return `<div class="topic-progress-row"><span class="topic-number">0${t.id}</span><div><h3>${t.title}</h3><p>${practicedCount(list)} разобрано · ${masteredCount(list)} в памяти · ${list.length} всего</p></div>${progressBar(percentage(masteredCount(list), list.length))}<strong>${percentage(masteredCount(list), list.length)}%</strong><button class="icon-btn" data-action="topic" data-topic="${t.id}" aria-label="Изучать: ${t.title}">${icon('arrow')}</button></div>`; }).join('')}</div><div class="section-heading"><h2>Последние занятия</h2></div>${state.history.length ? `<div class="history-list">${[...state.history].reverse().slice(0, 20).map(h => `<div class="history-row"><span class="mode-icon lavender">${icon(routes[h.kind][1])}</span><div><strong>${modeLabels[h.kind]}</strong><span>${new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(h.date)}</span></div><span>${h.correct} / ${h.total}</span><b>${percentage(h.correct, h.total)}%</b></div>`).join('')}</div>` : '<div class="empty-state compact"><h3>История ещё впереди.</h3><p>Заверши первое занятие — и оно появится здесь.</p><a href="#practice" class="text-link">Начать тренировку →</a></div>'}`;
}

function showDialog(content, cls = '') {
  const modal = $('#modal'); modal.className = cls;
  modal.innerHTML = `<button class="icon-btn modal-close" data-action="close-modal" aria-label="Закрыть">${icon('close')}</button>${content}`;
  if (!modal.open) modal.showModal();
}
function showQuestion(q) {
  showDialog(`${questionMeta(q)}<h2 class="modal-question" lang="en">${esc(q.question)}</h2>${q.type === 'mcq' ? `<ol class="bank-answer-options" type="A" lang="en">${q.options.map((o, i) => `<li>${esc(o)}</li>`).join('')}</ol>` : ''}<details class="answer-details"><summary>Показать правильный ответ ${icon('chevron')}</summary><div>${q.type === 'mcq' ? `<strong class="correct-text" lang="en">${'ABCD'[q.answer]}. ${esc(q.options[q.answer])}</strong><p lang="en">${esc(q.explanation)}</p>` : `<p lang="en">${esc(q.modelAnswer)}</p><h3>Критерии: 5 баллов</h3><ol lang="en">${q.rubric.map(r => `<li>${esc(r)}</li>`).join('')}</ol>`}</div></details><p class="source-label">${esc(q.reference)} · ${esc(q.source)}</p><button class="btn btn-dark full" data-action="study-one" data-id="${q.id}">Изучить этот вопрос ${icon('arrow')}</button>`);
}
function showSettings() {
  showDialog(`<span class="eyebrow">ТВОЁ ПРОСТРАНСТВО</span><h2>Пусть учиться будет удобно.</h2><div class="settings-section"><label for="daily-goal">Ежедневная цель: повторений</label><div class="goal-setting"><input id="daily-goal" type="number" min="5" max="200" value="${state.goal}"><button class="btn btn-dark" data-action="save-goal">Сохранить</button></div><p>От 5 до 200. Одна попытка ответа = одно повторение.</p></div><div class="settings-section"><h3>Данные и резервная копия</h3><p>Ответы, заметки и история хранятся только в этом браузере. На сервер ничего не отправляется. Сохрани копию перед очисткой браузера.</p><div class="settings-buttons"><button class="btn btn-outline" data-action="export">${icon('download')} Экспорт JSON</button><label class="btn btn-outline import-label">Импорт JSON<input type="file" id="import-file" accept="application/json,.json"></label></div></div><div class="settings-section"><h3>Как устроено повторение</h3><p>Правильный ответ повышает уровень, ошибка возвращает к началу. Повторение через 10 минут после ошибки; интервалы успеха — 1, 3, 7, 14, 30 дней. «Легко» в карточках повышает уровень на две ступени. В памяти — с уровня 3.</p></div><div class="settings-section danger-section"><h3>Начать с чистого листа</h3><p>Удалит прогресс, избранное и тексты открытых ответов.</p><button class="btn btn-danger" data-action="reset">Сбросить все данные</button></div>`, 'settings-modal');
}

document.addEventListener('submit', event => {
  if (event.target.id !== 'start-form') return;
  event.preventDefault(); const data = new FormData(event.target);
  startSession(event.target.dataset.kind, { topic: data.get('topic'), pool: data.get('pool'), count: data.get('count'), minutes: data.get('minutes'), type: data.get('type'), random: data.has('random') });
});
document.addEventListener('input', event => {
  const el = event.target;
  if (el.id === 'bank-search') { filters.search = el.value; renderBankResults(); }
  if (el.dataset.essay) {
    const essay = state.essays[el.dataset.essay] ||= { text: '', checks: [] };
    essay.text = el.value.slice(0, 30000); save();
    $('#word-count').textContent = essay.text.trim() ? essay.text.trim().split(/\s+/).length : 0;
  }
});
document.addEventListener('change', async event => {
  const el = event.target;
  if (el.id.startsWith('filter-')) { filters[el.id.slice(7)] = el.value; renderBankResults(); }
  if (el.dataset.rubric !== undefined) {
    const essay = state.essays[el.dataset.id] ||= { text: '', checks: [] };
    essay.checks[Number(el.dataset.rubric)] = el.checked; save();
    $('#rubric-score').textContent = `${essay.checks.filter(Boolean).length} / 5`;
  }
  if (el.id === 'import-file' && el.files?.[0]) {
    try {
      if (el.files[0].size > 5 * 1024 * 1024) throw Error('Файл слишком большой. Максимум — 5 МБ.');
      const imported = validateState(JSON.parse(await el.files[0].text()), questions);
      if (!confirm('Заменить текущий прогресс данными из файла? Перед импортом можно экспортировать текущую копию.')) { el.value = ''; return; }
      state = imported; save(); $('#modal').close(); render(); toast('Прогресс восстановлен. Можно продолжать.');
    } catch (e) { toast('Импорт не выполнен: ' + (e instanceof SyntaxError ? 'некорректный JSON.' : e.message)); el.value = ''; }
  }
});
document.addEventListener('click', event => {
  if (event.target.closest('nav a')) document.body.classList.remove('menu-open');
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  const s = state.session;
  const q = s && byId.get(s.ids[s.index]);
  if (action === 'menu') document.body.classList.toggle('menu-open');
  if (action === 'close-menu') document.body.classList.remove('menu-open');
  if (action === 'close-modal') $('#modal').close();
  if (action === 'settings') showSettings();
  if (action === 'theme') { state.theme = state.theme === 'dark' ? 'light' : 'dark'; save(); document.documentElement.dataset.theme = state.theme; }
  if (action === 'show-streak') toast(`Серия: ${streak(state)} дн. Занимайся каждый день, чтобы её продолжить.`);
  if (action === 'quick-start') {
    if (s && !s.finished) navigate(s.kind);
    else startSession('practice', { topic: 'all', pool: 'all', count: 10, random: true });
  }
  if (action === 'topic') { setupTopic = button.dataset.topic; setupPool = 'all'; navigate('practice'); }
  if (action === 'bookmark') {
    const id = button.dataset.id, selected = state.favorites.includes(id);
    state.favorites = selected ? state.favorites.filter(x => x !== id) : [...state.favorites, id]; save();
    document.querySelectorAll(`[data-action="bookmark"][data-id="${id}"]`).forEach(b => { b.classList.toggle('selected', !selected); b.setAttribute('aria-pressed', String(!selected)); b.setAttribute('aria-label', selected ? 'В избранное' : 'Убрать из избранного'); });
    if (route === 'bank' && filters.status === 'favorites') renderBankResults();
    toast(selected ? 'Убрано из избранного' : 'Сохранено в избранное');
  }
  if (action === 'leave-session') {
    showDialog(`<h2>Занятие сохранено.</h2><p>Можно вернуться к нему позже или начать новое.</p><div class="dialog-actions"><button class="btn btn-dark" data-action="close-modal">Продолжить</button><a href="#home" class="btn btn-outline" data-action="close-modal">К обзору</a><button class="text-link" data-action="discard-session">Выбрать другое занятие</button></div>`);
  }
  if (action === 'discard-session') { if (!confirm('Сбросить текущее занятие? Отвеченные тренировочные вопросы уже сохранены; незавершённый экзамен не попадёт в статистику.')) return; state.session = null; save(); $('#modal').close(); render(); }
  if (action === 'answer' && s && !s.finished) {
    if (s.kind !== 'exam' && Object.hasOwn(s.answers, q.id)) return;
    const answer = Number(button.dataset.answer); s.answers[q.id] = answer;
    if (s.kind !== 'exam') recordReview(state, q.id, answer === q.answer ? 1 : 0);
    save(); render();
  }
  if (action === 'flip' && s) { s.revealed = !s.revealed; save(); render(); }
  if (action === 'rate' && s && !Object.hasOwn(s.answers, q.id) && s.revealed) {
    const quality = Number(button.dataset.quality); s.answers[q.id] = quality; recordReview(state, q.id, quality); save(); advance();
  }
  if (action === 'grade-essay' && s && !Object.hasOwn(s.answers, q.id)) {
    const score = state.essays[q.id]?.checks.filter(Boolean).length || 0;
    const quality = score >= 4 ? 1 : 0; s.answers[q.id] = quality; recordReview(state, q.id, quality); save(); advance();
  }
  if (action === 'previous' && s && s.index > 0) { s.index--; s.revealed = false; save(); render(); }
  if (action === 'jump' && s) { s.index = Number(button.dataset.index); s.revealed = false; save(); render(); }
  if (action === 'next') advance();
  if (action === 'finish-exam') confirmFinish();
  if (action === 'confirm-finish') { $('#modal').close(); finishSession(); }
  if (action === 'new-session') { state.session = null; save(); render(); }
  if (action === 'retry-wrong' && s) {
    const ids = s.ids.filter(id => ['exam', 'practice'].includes(s.kind) ? s.answers[id] !== byId.get(id).answer : !(s.answers[id] > 0));
    if (ids.length) createSession(s.kind === 'exam' ? 'practice' : s.kind, ids);
  }
  if (action === 'reset-filters') { filters = { search: '', topic: 'all', type: 'all', status: 'all' }; render(); }
  if (action === 'question') showQuestion(byId.get(button.dataset.id));
  if (action === 'study-one') { const item = byId.get(button.dataset.id); $('#modal').close(); createSession(item.type === 'essay' ? 'essays' : 'practice', [item.id]); }
  if (action === 'save-goal') {
    const value = Number($('#daily-goal').value);
    if (!Number.isInteger(value) || value < 5 || value > 200) { toast('Выбери целое число от 5 до 200.'); return; }
    state.goal = value; save(); render(); toast('Ежедневная цель обновлена.');
  }
  if (action === 'export') {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `memo-progress-${dayKey()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Копия прогресса сохранена.');
  }
  if (action === 'reset') {
    if (!confirm('Удалить весь прогресс, избранное и ответы? Это действие нельзя отменить без экспортированной копии.')) return;
    state = freshState(); save(); $('#modal').close(); render(); toast('Данные сброшены. Новый старт.');
  }
});
function advance() {
  const s = state.session; if (!s || s.finished) return;
  if (s.kind !== 'exam' && !Object.hasOwn(s.answers, s.ids[s.index])) return;
  if (s.index < s.ids.length - 1) { s.index++; s.revealed = false; save(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  else if (s.kind === 'exam') confirmFinish();
  else if (Object.keys(s.answers).length < s.ids.length) { s.index = s.ids.findIndex(id => !Object.hasOwn(s.answers, id)); s.revealed = false; save(); render(); toast('Остались пропущенные вопросы. Продолжим с первого.'); }
  else finishSession();
}
function confirmFinish() {
  const s = state.session;
  if (!s || s.finished) return;
  const skipped = s.ids.length - Object.keys(s.answers).length;
  showDialog(`<span class="eyebrow">ГОТОВО?</span><h2>Завершить экзамен?</h2><p>${skipped ? `Без ответа: ${skipped}. Они будут засчитаны как ошибки.` : 'Ты ответил на все вопросы. Посмотрим результат?'}</p><div class="dialog-actions"><button class="btn btn-dark" data-action="confirm-finish">Завершить и посмотреть разбор</button><button class="btn btn-outline" data-action="close-modal">Вернуться к вопросам</button></div>`);
}
document.addEventListener('keydown', event => {
  if (event.target.closest('input, textarea, select, button, a') || event.ctrlKey || event.metaKey || event.altKey || $('#modal').open) return;
  if (event.key === '/' && route === 'bank') { event.preventDefault(); $('#bank-search').focus(); return; }
  const s = state.session;
  if (!s || s.finished || s.kind !== route) return;
  if (s.kind === 'cards') {
    if (event.code === 'Space') { event.preventDefault(); $('[data-action="flip"]')?.click(); }
    if (['1','2','3'].includes(event.key)) $(`[data-action="rate"][data-quality="${Number(event.key) - 1}"]`)?.click();
  } else if (['1','2','3','4'].includes(event.key)) $(`[data-action="answer"][data-answer="${Number(event.key) - 1}"]`)?.click();
  if (event.key === 'Enter' || event.key === 'ArrowRight') $('[data-action="next"]')?.click();
  if (event.key === 'ArrowLeft') $('[data-action="previous"]')?.click();
});
$('#modal').addEventListener('click', event => { if (event.target === $('#modal')) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });
window.addEventListener('hashchange', () => { route = location.hash.slice(1) || 'home'; setupPool = 'all'; render(); window.scrollTo(0, 0); });
window.addEventListener('online', () => { if ($('#connection-label')) $('#connection-label').textContent = 'Всё сохранено локально'; });
window.addEventListener('offline', () => { if ($('#connection-label')) $('#connection-label').textContent = 'Офлайн-режим'; });
// Keep progress coherent if another tab changes the same browser storage.
window.addEventListener('storage', event => { if (event.key === STORAGE_KEY && event.newValue) { try { state = validateState(JSON.parse(event.newValue), questions); render(); toast('Прогресс обновлён из другой вкладки.'); } catch { /* Ignore invalid external data. */ } } });
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => { /* The app also works without offline caching. */ });
