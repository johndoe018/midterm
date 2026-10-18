import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { freshState, recordReview, isDue, mastered, accuracy, streak, dayKey, shuffle, validateState } from '../src/core.js';
const bank = JSON.parse(await readFile(new URL('../public/bank.json', import.meta.url)));
const qs = bank.questions;

test('All 329 source questions are complete, uniquely identified, and correctly distributed', () => {
  assert.equal(qs.length, 329);
  assert.equal(new Set(qs.map(q => q.id)).size, 329);
  assert.deepEqual(qs.filter(q => q.type === 'mcq').map(q => q.id), Array.from({ length: 256 }, (_, i) => `Q${String(i + 1).padStart(3, '0')}`));
  assert.deepEqual(qs.filter(q => q.type === 'essay').map(q => q.id), Array.from({ length: 73 }, (_, i) => `E${String(i + 1).padStart(2, '0')}`));
  const counts = [[48,12],[38,11],[33,10],[26,9],[35,10],[35,10],[41,11]];
  for (const t of bank.topics) {
    const list = qs.filter(q => q.topic === t.id);
    assert.deepEqual([list.filter(q => q.type === 'mcq').length, list.filter(q => q.type === 'essay').length], counts[t.id - 1]);
  }
  for (const q of qs) {
    assert.ok(q.question && q.source && q.reference);
    if (q.type === 'mcq') { assert.equal(q.options.length, 4); assert.ok(q.options.every(Boolean)); assert.ok(q.answer >= 0 && q.answer <= 3); assert.ok(q.explanation); }
    else { assert.ok(q.modelAnswer); assert.equal(q.rubric.length, 5); assert.ok(q.rubric.every(Boolean)); }
  }
});
test('Spaced repetition increases intervals, caps mastery and reschedules mistakes', () => {
  const state = freshState(), now = new Date(2026, 9, 19, 12).getTime();
  recordReview(state, 'Q001', 1, now);
  assert.equal(state.progress.Q001.due, now + 86400000);
  recordReview(state, 'Q001', 2, now);
  assert.equal(state.progress.Q001.level, 3);
  assert.ok(mastered(state, 'Q001'));
  assert.equal(state.progress.Q001.due, now + 7 * 86400000);
  recordReview(state, 'Q001', 2, now);
  recordReview(state, 'Q001', 2, now);
  assert.equal(state.progress.Q001.level, 5);
  assert.equal(state.progress.Q001.due, now + 30 * 86400000);
  recordReview(state, 'Q001', 0, now);
  assert.equal(state.progress.Q001.level, 0);
  assert.equal(state.progress.Q001.lastWrong, true);
  assert.equal(state.progress.Q001.due, now + 600000);
  assert.ok(!isDue(state, 'Q001', now + 599999));
  assert.ok(isDue(state, 'Q001', now + 600000));
  assert.ok(isDue(state, 'Q002', now));
  assert.equal(accuracy(state), 80);
});
test('Streak survives an unfinished current day and breaks after a missed day', () => {
  const state = freshState();
  state.activity = {'2026-10-17': 5, '2026-10-18': 10};
  assert.equal(streak(state, new Date(2026, 9, 19, 12)), 2);
  state.activity['2026-10-19'] = 1;
  assert.equal(streak(state, new Date(2026, 9, 19, 12)), 3);
  assert.equal(streak(state, new Date(2026, 9, 21, 12)), 0);
  assert.equal(dayKey(new Date(2026, 0, 2, 1)), '2026-01-02');
});
test('Backups round-trip progress, drafts, favorites and active timed sessions', () => {
  const state = freshState();
  recordReview(state, 'Q001', 1, 1000);
  state.favorites = ['Q001', 'E01'];
  state.essays.E01 = { text: '<script>user text</script>', checks: [true,false,true,false,true] };
  state.session = { kind: 'exam', ids: ['Q001', 'Q002'], index: 1, answers: { Q001: 1 }, startedAt: 1000, deadline: 61000, finished: false, revealed: false, recorded: false };
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(state)), qs), state);
});
test('Import rejects unsupported files and drops corrupt, unknown or dangerous state', () => {
  assert.throws(() => validateState({version: 9}, qs));
  const input = freshState();
  input.favorites = ['Q001', 'unknown', 'Q001'];
  input.progress.Q002 = { level: 99, attempts: 1, correct: 1, wrong: 0, due: 1000, lastSeen: 1 };
  input.essays.Q001 = { text: 'wrong type', checks: [] };
  input.session = { kind: 'exam', ids: ['E01'], index: 0, answers: {}, startedAt: 1000, deadline: 61000 };
  input.history = [{kind: 'invalid', date: 0, total: 20, correct: 10}];
  input.activity = JSON.parse('{"__proto__": 5,"2026-10-19": 20}');
  const clean = validateState(input, qs);
  assert.deepEqual(clean.favorites, ['Q001']);
  assert.deepEqual(clean.progress, {});
  assert.deepEqual(clean.essays, {});
  assert.deepEqual(clean.history, []);
  assert.equal(clean.session, null);
  assert.equal(clean.activity['2026-10-19'], 20);
  assert.equal(Object.getPrototypeOf(clean.activity), Object.prototype);
});
test('Shuffling preserves every input exactly once and does not mutate the source', () => {
  const original = ['a','b','c','d','e'];
  const shuffled = shuffle(original, () => 0);
  assert.deepEqual(original, ['a','b','c','d','e']);
  assert.deepEqual([...shuffled].sort(), original);
  assert.notDeepEqual(shuffled, original);
});
