'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  readConfig, getBearerToken, estimateReservationTokens, deriveUsage,
  estimateProviderCost, createRequestId
} = require('../lib/supabase-ai-gateway');

test('server config requires URL, publishable key and service-role secret', () => {
  assert.equal(readConfig({ GEED_SUPABASE_URL: 'https://a.supabase.co', GEED_SUPABASE_PUBLISHABLE_KEY: 'public' }), null);
  assert.deepEqual(readConfig({
    GEED_SUPABASE_URL: 'https://a.supabase.co/',
    GEED_SUPABASE_PUBLISHABLE_KEY: 'public',
    GEED_SUPABASE_SERVICE_ROLE_KEY: 'private'
  }), { url: 'https://a.supabase.co', publishableKey: 'public', serviceRoleKey: 'private' });
});
test('bearer parser rejects malformed authorization headers', () => {
  assert.equal(getBearerToken({ headers: {} }), null);
  assert.equal(getBearerToken({ headers: { authorization: 'Basic abc' } }), null);
  assert.equal(getBearerToken({ headers: { authorization: 'Bearer abc def' } }), null);
  assert.equal(getBearerToken({ headers: { authorization: 'Bearer valid-token' } }), 'valid-token');
});
test('quota reservation estimate includes input and output headroom', () => {
  assert.ok(estimateReservationTokens([{ content: 'x'.repeat(300) }], 100) >= 200);
});
test('provider usage is normalized and missing token counts are conservatively estimated', () => {
  assert.deepEqual(deriveUsage({
    usage: { prompt_tokens: 30, completion_tokens: 8 },
    messages: [{ content: 'hello' }], content: 'response'
  }), { inputTokens: 30, outputTokens: 8, usageSource: 'provider' });
  const estimated = deriveUsage({ usage: null, messages: [{ content: 'x'.repeat(30) }], content: 'y'.repeat(12) });
  assert.deepEqual(estimated, { inputTokens: 10, outputTokens: 4, usageSource: 'estimated' });
});
test('provider cost is only estimated from an exact model price entry', () => {
  const env = { GEED_AI_TOKEN_PRICES_JSON: JSON.stringify({
    'model-x': { input_per_1m_usd: 1, output_per_1m_usd: 2 }
  }) };
  assert.equal(estimateProviderCost({ model: 'model-x', inputTokens: 10, outputTokens: 5, env }), 0.00002);
  assert.equal(estimateProviderCost({ model: 'other', inputTokens: 10, outputTokens: 5, env }), null);
  assert.equal(estimateProviderCost({ model: 'model-x', inputTokens: 10, outputTokens: 5, env: { GEED_AI_TOKEN_PRICES_JSON: 'bad' } }), null);
});
test('request IDs are UUIDs', () => {
  assert.match(createRequestId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});
