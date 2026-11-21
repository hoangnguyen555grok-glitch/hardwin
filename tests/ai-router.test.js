'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyTask, normalizeMessages, configuredProviders, providerOrder, resolveMaxTokens, routeChat } = require('../lib/ai-router');

const baseEnv = {
  GEED_AI_OPENAI_API_KEY: 'test-openai-key',
  GEED_AI_OPENAI_MODEL: 'test-model',
  GEED_AI_DEEPSEEK_API_KEY: 'test-deepseek-key',
  GEED_AI_DEEPSEEK_MODEL: 'deepseek-test',
  GEED_AI_PROVIDER_ORDER: 'openai,deepseek'
};

test('classifies coding and reasoning tasks', () => {
  assert.equal(classifyTask([{ role: 'user', content: 'Sửa lỗi JavaScript trong hàm này' }]), 'coding');
  assert.equal(classifyTask([{ role: 'user', content: 'Phân tích kiến trúc và lập kế hoạch' }]), 'reasoning');
});

test('validates plain-text conversation roles and size', () => {
  assert.equal(normalizeMessages([{ role: 'user', content: 'Xin chào' }]).length, 1);
  assert.throws(() => normalizeMessages([{ role: 'tool', content: 'bad' }]));
  assert.throws(() => normalizeMessages([{ role: 'user', content: 'x'.repeat(12001) }]));
  assert.throws(() => normalizeMessages([]));
});

test('only routes to providers with both a key and model ID', () => {
  assert.deepEqual(configuredProviders(baseEnv), ['openai', 'deepseek']);
  assert.deepEqual(providerOrder('general', baseEnv), ['openai', 'deepseek']);
});

test('fails over from the first provider to the next configured provider', async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(url);
    if (url.includes('api.openai.com')) {
      return { ok: false, status: 429, json: async () => ({ error: { message: 'rate limited' } }) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ model: 'deepseek-test', choices: [{ message: { content: 'Đã chuyển nhà cung cấp.' } }], usage: { total_tokens: 9 } })
    };
  };
  const result = await routeChat({
    env: baseEnv,
    fetchImpl: fakeFetch,
    messages: [{ role: 'user', content: 'Xin chào' }]
  });
  assert.equal(result.ok, true);
  assert.equal(result.provider, 'deepseek');
  assert.equal(result.attempts[0].outcome, 'failed');
  assert.equal(result.attempts[1].outcome, 'success');
  assert.equal(calls.length, 2);
});

test('does not expose configured secrets in provider status', () => {
  const names = configuredProviders(baseEnv);
  assert.deepEqual(names, ['openai', 'deepseek']);
  assert.equal(JSON.stringify(names).includes('test-openai-key'), false);
});


test('server-side output token cap cannot be raised by the client', () => {
  assert.equal(resolveMaxTokens(4096, { GEED_AI_MAX_OUTPUT_TOKENS: '300' }), 300);
  assert.equal(resolveMaxTokens(128, { GEED_AI_MAX_OUTPUT_TOKENS: '300' }), 128);
  assert.equal(resolveMaxTokens(4096, {}), 1200);
  assert.equal(resolveMaxTokens(4096, { GEED_AI_MAX_OUTPUT_TOKENS: 'not-a-number' }), 1200);
});

test('stops provider fallback after an ambiguous timeout to avoid duplicate billing', async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(url);
    const error = new Error('timed out');
    error.name = 'AbortError';
    throw error;
  };
  await assert.rejects(
    routeChat({
      env: baseEnv,
      fetchImpl: fakeFetch,
      messages: [{ role: 'user', content: 'Xin chào' }]
    }),
    (error) => {
      assert.equal(error.code, 'UPSTREAM_TIMEOUT_UNCERTAIN');
      assert.equal(error.attempts[0].outcome, 'uncertain_timeout');
      return true;
    }
  );
  assert.equal(calls.length, 1);
});
