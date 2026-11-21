'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/ai/chat');

function responseMock() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    statusCode: 200,
    end(value) { this.body = JSON.parse(value); }
  };
}

test('chat endpoint fails closed when gateway authentication is not configured', async () => {
  const previous = process.env.GEED_AI_GATEWAY_TOKEN;
  delete process.env.GEED_AI_GATEWAY_TOKEN;
  const res = responseMock();
  await handler({ method: 'POST', headers: {}, body: { messages: [{ role: 'user', content: 'hello' }] } }, res);
  assert.equal(res.statusCode, 503);
  assert.match(res.body.error, /authentication/i);
  if (previous !== undefined) process.env.GEED_AI_GATEWAY_TOKEN = previous;
});

test('chat endpoint rejects requests without a valid server-to-server token', async () => {
  const previous = process.env.GEED_AI_GATEWAY_TOKEN;
  process.env.GEED_AI_GATEWAY_TOKEN = 'test-secret-token';
  const res = responseMock();
  await handler({ method: 'POST', headers: {}, body: { messages: [{ role: 'user', content: 'hello' }] } }, res);
  assert.equal(res.statusCode, 401);
  if (previous !== undefined) process.env.GEED_AI_GATEWAY_TOKEN = previous;
  else delete process.env.GEED_AI_GATEWAY_TOKEN;
});

test('chat endpoint only accepts POST', async () => {
  const res = responseMock();
  await handler({ method: 'GET', headers: {} }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.allow, 'POST');
});


test('chat endpoint stops on ambiguous provider timeout and marks it non-retryable', async () => {
  const keys = [
    'GEED_AI_GATEWAY_TOKEN',
    'GEED_AI_OPENAI_API_KEY',
    'GEED_AI_OPENAI_MODEL',
    'GEED_AI_DEEPSEEK_API_KEY',
    'GEED_AI_DEEPSEEK_MODEL',
    'GEED_AI_PROVIDER_ORDER'
  ];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    process.env.GEED_AI_GATEWAY_TOKEN = 'test-secret-token';
    process.env.GEED_AI_OPENAI_API_KEY = 'test-openai-key';
    process.env.GEED_AI_OPENAI_MODEL = 'test-openai-model';
    process.env.GEED_AI_DEEPSEEK_API_KEY = 'test-deepseek-key';
    process.env.GEED_AI_DEEPSEEK_MODEL = 'test-deepseek-model';
    process.env.GEED_AI_PROVIDER_ORDER = 'openai,deepseek';
    globalThis.fetch = async () => {
      calls += 1;
      const error = new Error('timed out');
      error.name = 'AbortError';
      throw error;
    };
    const res = responseMock();
    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer test-secret-token' },
      body: { messages: [{ role: 'user', content: 'hello' }] }
    }, res);
    assert.equal(res.statusCode, 504);
    assert.equal(res.body.retryable, false);
    assert.equal(res.body.attempts[0].outcome, 'uncertain_timeout');
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
