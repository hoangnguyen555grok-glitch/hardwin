'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyTask, normalizeMessages, configuredProviders, providerOrder, resolveMaxTokens, routeChat } = require('../lib/ai-router');

const baseEnv = {
  GEED_AI_OPENAI_API_KEY: 'test-openai-key',
  GEED_AI_OPENAI_MODEL: 'test-model',
  GEED_AI_DEEPSEEK_API_KEY: 'test-deepseek-key',
  GEED_AI_DEEPSEEK_MODEL: 'deepseek-test',
  GEED_AI_PROVIDER_ORDER: 'openai,deepseek',
  GEED_AI_ALLOW_PAID_PROVIDERS: 'true'
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

test('defaults to free-tier community providers and excludes paid providers', () => {
  const env = {
    GEED_AI_OPENROUTER_API_KEY: 'openrouter-test-key',
    GEED_AI_OPENROUTER_MODEL: 'openrouter/free',
    GEED_AI_GROQ_API_KEY: 'groq-test-key',
    GEED_AI_GROQ_MODEL: 'free-groq-model',
    GEED_AI_GROQ_FREE_TIER_CONFIRMED: 'true',
    GEED_AI_OPENAI_API_KEY: 'paid-openai-key',
    GEED_AI_OPENAI_MODEL: 'paid-model'
  };
  assert.deepEqual(configuredProviders(env), ['openrouter', 'groq']);
  assert.deepEqual(providerOrder('general', env), ['openrouter', 'groq']);
});

test('OpenRouter only accepts its free router or a free model variant by default', () => {
  const env = {
    GEED_AI_OPENROUTER_API_KEY: 'openrouter-test-key',
    GEED_AI_OPENROUTER_MODEL: 'openai/paid-model'
  };
  assert.deepEqual(configuredProviders(env), []);
});

test('Cloudflare Workers AI requires an explicit free-plan confirmation and endpoint', () => {
  const env = {
    GEED_AI_CLOUDFLARE_API_KEY: 'cloudflare-test-key',
    GEED_AI_CLOUDFLARE_MODEL: '@cf/zai-org/glm-4.7-flash',
    GEED_AI_CLOUDFLARE_FREE_TIER_CONFIRMED: 'true'
  };
  assert.deepEqual(configuredProviders(env), []);
  env.GEED_AI_CLOUDFLARE_BASE_URL = 'https://api.cloudflare.com/client/v4/accounts/test/ai/v1';
  assert.deepEqual(configuredProviders(env), ['cloudflare']);
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
