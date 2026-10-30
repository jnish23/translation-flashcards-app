import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTask, buildLearningPrompt, parseLearningResponse } from '../src/learning.ts';
import { requestLearningWithFallback, requestLearning, translateWithFallback } from '../src/translate.ts';
import { makeCard } from '../src/cards.ts';
import { loadCards, persistCard } from '../src/storage.ts';
import { getDueCards, applyRating } from '../src/sm2.ts';
import { exportToAnki } from '../src/exportAnki.ts';
import { check, option, translations, scenarios } from './fixtures.mjs';

test('auto routes scripts and explicit overrides handle romaji and mixed input', () => {
  for (const phrase of ['こんにちは', 'ミズ', '水', 'ｺﾝﾆﾁﾊ', 'I want 水']) assert.equal(resolveTask('auto', phrase), 'check');
  for (const phrase of ['', 'I want water', 'mizu o nomitai', '123 🙂']) assert.equal(resolveTask('auto', phrase), 'translate');
  assert.equal(resolveTask('check', 'mizu o nomitai'), 'check');
  assert.equal(resolveTask('translate', 'I want 水'), 'translate');
});

test('prompts distinguish tasks, preserve intent, and budget more tokens for teaching', () => {
  const translation = buildLearningPrompt({ task: 'translate', phrase: 'water', context: 'family', intendedMeaning: 'ignored' });
  const feedback = buildLearningPrompt({ task: 'check', phrase: '水', context: 'family', intendedMeaning: ' water ' });
  assert.equal(JSON.parse(translation.user).intendedMeaning, undefined);
  assert.equal(JSON.parse(feedback.user).intendedMeaning, 'water');
  assert.ok(feedback.maxTokens > translation.maxTokens);
  assert.match(feedback.system, /keep its wording unchanged/);
  assert.match(feedback.system, /do not silently invent intent/);
});

test('translation validation requires three complete options and accepts fenced JSON', () => {
  assert.deepEqual(parseLearningResponse(`\n\x60\x60\x60json\n${JSON.stringify(translations)}\n\x60\x60\x60\n`, 'translate').response, translations);
  for (const bad of [{}, { options: [] }, { options: [option] }, { options: [...translations.options, option] }, { options: [option, option, { ...option, reading: 3 }] }]) {
    assert.throws(() => parseLearningResponse(JSON.stringify(bad), 'translate'), /Unexpected response/);
  }
  assert.throws(() => parseLearningResponse('not JSON', 'check'), /invalid JSON/);
});

for (const scenario of scenarios) test(`accepts complete feedback: ${scenario.name}`, () => {
  assert.deepEqual(parseLearningResponse(JSON.stringify(scenario.response), 'check'), { task: 'check', response: scenario.response });
});

test('rejects incomplete teaching fields, invalid verdicts, and malformed arrays', () => {
  const invalid = [
    { ...check, grammar: { verdict: 'fine', explanation: 'Fine' } },
    { ...check, naturalness: null },
    { ...check, interpretation: '' },
    { ...check, recommendation: { ...check.recommendation, english: '' } },
    { ...check, corrections: [{ ...check.corrections[0], kind: 'wrong' }] },
    { ...check, breakdown: [] },
    { ...check, breakdown: [{ text: '水', reading: null, explanation: 'water' }] },
    { ...check, meaningMatch: { verdict: 'differs', explanation: '' } },
  ];
  for (const bad of invalid) assert.throws(() => parseLearningResponse(JSON.stringify(bad), 'check'), /Unexpected response/);
  for (const field of Object.keys(check)) {
    const bad = { ...check }; delete bad[field];
    assert.throws(() => parseLearningResponse(JSON.stringify(bad), 'check'), /Unexpected response/);
  }
});

function providerResponse(url, payload) {
  const raw = JSON.stringify(payload);
  if (String(url).includes('anthropic.com')) return Response.json({ content: [{ type: 'text', text: raw }] });
  if (String(url).includes('googleapis.com')) return Response.json({ candidates: [{ content: { parts: [{ text: raw }], role: 'model' }, finishReason: 'STOP' }] });
  return Response.json({ choices: [{ finish_reason: 'stop', message: { content: raw } }] });
}

for (const task of ['translate', 'check']) {
  test(`${task}: all provider adapters send the task prompt and parse results`, async (t) => {
    const payload = task === 'check' ? check : translations;
    const requests = [];
    t.mock.method(globalThis, 'fetch', async (url, init) => {
      requests.push(JSON.parse(init.body));
      return providerResponse(url, payload);
    });
    for (const key of ['sk-test-primary', 'sk-ant-test-primary', 'google-test-primary']) {
      const result = await requestLearning({ task, phrase: 'test', context: 'family' }, key);
      assert.equal(result.task, task);
      assert.deepEqual(result.response, payload);
    }
    for (const body of requests) {
      assert.equal(body.max_tokens ?? body.generationConfig.maxOutputTokens, task === 'check' ? 4096 : 1024);
    }
  });

  test(`${task}: fallback preserves the request and handles backup failure`, async (t) => {
    const requests = [];
    const payload = task === 'check' ? check : translations;
    const fetchMock = t.mock.method(globalThis, 'fetch', async (url, init) => {
      const body = JSON.parse(init.body); requests.push(body);
      if (String(url).includes('deepseek.com')) return Response.json({ error: { message: 'empty balance' } }, { status: 402 });
      return providerResponse(url, payload);
    });
    const request = { task, phrase: '水を飲むたい', context: 'family', intendedMeaning: 'I want water' };
    const outcome = await requestLearningWithFallback(request, 'sk-test-primary', 'google-test-backup');
    assert.deepEqual(outcome.fallback, { from: 'deepseek', reason: 'out of balance' });
    assert.equal(outcome.provider, 'google');
    assert.deepEqual(outcome.result.response, payload);
    assert.equal(requests[0].messages[1].content, requests[1].contents[0].parts[0].text);
    fetchMock.mock.mockImplementation(async () => { throw new Error('Failed to fetch'); });
    await assert.rejects(requestLearningWithFallback(request, 'sk-primary', 'google-backup'), /Backup.*also failed/);
  });

  test(`${task}: malformed responses and rejected keys do not use the backup`, async (t) => {
    const fetchMock = t.mock.method(globalThis, 'fetch', async (url) => providerResponse(url, {}));
    await assert.rejects(requestLearningWithFallback({ task, phrase: 'test', context: '' }, 'sk-primary', 'google-backup'), /Unexpected response/);
    assert.equal(fetchMock.mock.callCount(), 1);
    fetchMock.mock.mockImplementation(async () => Response.json({ error: { message: 'bad key' } }, { status: 401 }));
    await assert.rejects(requestLearningWithFallback({ task, phrase: 'test', context: '' }, 'sk-primary', 'google-backup'), /401/);
    assert.equal(fetchMock.mock.callCount(), 2);
  });
}

test('the original translation API remains compatible', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => providerResponse(url, translations));
  const outcome = await translateWithFallback('water', 'family', 'sk-primary');
  assert.deepEqual(outcome.response, translations);
});

test('both card directions retain only existing fields, reload, review, and export', (t) => {
  const store = new Map();
  globalThis.localStorage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
  t.after(() => { delete globalThis.localStorage; delete globalThis.document; });
  for (const type of ['production', 'recognition']) {
    persistCard(makeCard(check.recommendation, check.recommendation.english, 'family', type));
  }
  const cards = loadCards();
  assert.equal(cards.length, 2);
  assert.notEqual(cards[0].id, cards[1].id);
  assert.equal(getDueCards(cards).length, 2);
  for (const card of cards) {
    assert.equal(card.prompt, check.recommendation.english);
    assert.equal(card.nuance, option.nuance);
    assert.equal(card.breakdown, undefined);
    assert.equal(card.interpretation, undefined);
    assert.equal(card.due_date, card.created_at);
    assert.equal(applyRating(card, 'good').repetitions, 1);
  }
  let blob; let downloaded = false;
  t.mock.method(URL, 'createObjectURL', (value) => { blob = value; return 'blob:test'; });
  t.mock.method(URL, 'revokeObjectURL', () => {});
  globalThis.document = { createElement: () => ({ click: () => { downloaded = true; } }) };
  exportToAnki(cards);
  assert.ok(downloaded);
  return blob.text().then((text) => {
    assert.match(text, /I want to drink water/);
    assert.match(text, /水を飲みたい/);
    assert.doesNotMatch(text, /Attach たい/);
  });
});
