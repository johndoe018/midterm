export const STORAGE_KEY = 'memo.ai-midterm.v1';
export const intervals = [0, 1, 3, 7, 14, 30];
export function freshState() {
  return { version: 1, progress: {}, favorites: [], essays: {}, activity: {}, history: [], goal: 20, theme: 'light', session: null };
}
export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function shuffle(list, random = Math.random) {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function recordReview(state, id, quality, now = Date.now()) {
  const old = state.progress[id] || { level: 0, attempts: 0, correct: 0, wrong: 0 };
  const passed = quality > 0;
  const level = passed ? Math.min(5, old.level + (quality === 2 ? 2 : 1)) : 0;
  state.progress[id] = { level, attempts: old.attempts + 1, correct: old.correct + Number(passed), wrong: old.wrong + Number(!passed), lastWrong: !passed, lastSeen: now, due: now + (passed ? intervals[level] * 86400000 : 600000) };
  const day = dayKey(new Date(now));
  state.activity[day] = (state.activity[day] || 0) + 1;
}
export function isDue(state, id, now = Date.now()) { return !state.progress[id] || state.progress[id].due <= now; }
export function mastered(state, id) { return (state.progress[id]?.level || 0) >= 3; }
export function accuracy(state) {
  const rows = Object.values(state.progress);
  const total = rows.reduce((a, p) => a + p.attempts, 0);
  return total ? Math.round(rows.reduce((a, p) => a + p.correct, 0) / total * 100) : 0;
}
export function streak(state, now = new Date()) {
  let count = 0;
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  if (!state.activity[dayKey(date)]) date.setDate(date.getDate() - 1);
  while (state.activity[dayKey(date)]) { count++; date.setDate(date.getDate() - 1); }
  return count;
}
const finite = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
export function validateState(input, questions) {
  if (!input || typeof input !== 'object' || input.version !== 1) throw Error('Это не файл прогресса memo версии 1.');
  const result = freshState();
  const ids = new Set(questions.map(q => q.id));
  const byId = new Map(questions.map(q => [q.id, q]));
  if (finite(input.goal, 5, 200)) result.goal = Math.round(input.goal);
  if (input.theme === 'dark') result.theme = 'dark';
  if (Array.isArray(input.favorites)) result.favorites = [...new Set(input.favorites.filter(id => ids.has(id)))];
  for (const [id, p] of Object.entries(input.progress || {})) {
    if (!ids.has(id) || !p || !finite(p.level, 0, 5) || !Number.isInteger(p.level) || !finite(p.attempts, 1, 1e7) || !finite(p.correct, 0, p.attempts) || !finite(p.wrong, 0, p.attempts) || p.correct + p.wrong !== p.attempts || !finite(p.due, 0, 1e15) || !finite(p.lastSeen, 0, 1e15)) continue;
    result.progress[id] = { level: p.level, attempts: p.attempts, correct: p.correct, wrong: p.wrong, lastWrong: !!p.lastWrong, due: p.due, lastSeen: p.lastSeen };
  }
  for (const [id, e] of Object.entries(input.essays || {})) {
    if (byId.get(id)?.type !== 'essay' || !e || typeof e.text !== 'string') continue;
    result.essays[id] = { text: e.text.slice(0, 30000), checks: Array.from({ length: 5 }, (_, i) => !!e.checks?.[i]) };
  }
  for (const [key, count] of Object.entries(input.activity || {})) if (/^\d{4}-\d{2}-\d{2}$/.test(key) && finite(count, 0, 1e7)) result.activity[key] = Math.round(count);
  if (Array.isArray(input.history)) result.history = input.history.filter(h => h && ['exam', 'practice', 'cards', 'essays'].includes(h.kind) && finite(h.date, 0, 1e15) && finite(h.total, 1, 329) && finite(h.correct, 0, h.total)).slice(-100).map(h => ({ kind: h.kind, date: h.date, total: h.total, correct: h.correct }));
  const s = input.session;
  if (s && ['exam', 'practice', 'cards', 'essays'].includes(s.kind) && Array.isArray(s.ids) && s.ids.length && s.ids.length <= 329 && new Set(s.ids).size === s.ids.length && s.ids.every(id => ids.has(id) && (s.kind === 'essays' ? byId.get(id).type === 'essay' : s.kind === 'cards' || byId.get(id).type === 'mcq')) && Number.isInteger(s.index) && finite(s.index, 0, s.ids.length - 1) && finite(s.startedAt, 0, 1e15) && (s.deadline === null || finite(s.deadline, s.startedAt, 1e15))) {
    const answers = {};
    for (const id of s.ids) if (Number.isInteger(s.answers?.[id]) && finite(s.answers[id], 0, s.kind === 'cards' || s.kind === 'essays' ? 2 : 3)) answers[id] = s.answers[id];
    result.session = { kind: s.kind, ids: [...s.ids], index: s.index, answers, startedAt: s.startedAt, deadline: s.deadline, revealed: !!s.revealed, finished: !!s.finished, recorded: !!s.recorded };
  }
  return result;
}
