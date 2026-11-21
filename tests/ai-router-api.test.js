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
