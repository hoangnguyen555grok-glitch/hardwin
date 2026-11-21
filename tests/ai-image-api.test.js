'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/ai/image');

function responseMock() {
  return {
    statusCode: 0, headers: {}, body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body) { this.body = JSON.parse(body); }
  };
}

function response(status, data) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}

const envKeys = [
  'GEED_SUPABASE_URL', 'GEED_SUPABASE_PUBLISHABLE_KEY', 'GEED_SUPABASE_SERVICE_ROLE_KEY',
  'GEED_AI_CLOUDFLARE_API_KEY', 'GEED_AI_CLOUDFLARE_ACCOUNT_ID',
  'GEED_AI_CLOUDFLARE_IMAGE_ENABLED', 'GEED_AI_CLOUDFLARE_FREE_TIER_CONFIRMED',
  'GEED_AI_CLOUDFLARE_BILLING_DISABLED'
];

async function withEnv(values, action) {
  const previous = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  try {
    for (const key of envKeys) {
      if (Object.prototype.hasOwnProperty.call(values, key)) process.env[key] = values[key];
      else delete process.env[key];
    }
    return await action();
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of envKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

const baseEnv = {
  GEED_SUPABASE_URL: 'https://example.supabase.co',
  GEED_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  GEED_SUPABASE_SERVICE_ROLE_KEY: 'server-only-test-secret',
  GEED_AI_CLOUDFLARE_API_KEY: 'cloudflare-test-secret',
  GEED_AI_CLOUDFLARE_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
  GEED_AI_CLOUDFLARE_IMAGE_ENABLED: 'true',
  GEED_AI_CLOUDFLARE_FREE_TIER_CONFIRMED: 'true',
  GEED_AI_CLOUDFLARE_BILLING_DISABLED: 'true'
};

test('image endpoint only accepts POST', async () => {
  await withEnv(baseEnv, async () => {
    const res = responseMock();
    await handler({ method: 'GET', headers: {} }, res);
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.allow, 'POST');
  });
});

test('image endpoint fails closed when Supabase server credentials are missing', async () => {
  await withEnv({}, async () => {
    const res = responseMock();
    await handler({ method: 'POST', headers: {}, body: { prompt: '2D fox character' } }, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.code, 'AI_ACCOUNT_SERVICE_NOT_CONFIGURED');
  });
});

test('image endpoint requires a valid Supabase bearer session', async () => {
  await withEnv(baseEnv, async () => {
    const res = responseMock();
    await handler({ method: 'POST', headers: {}, body: { prompt: '2D fox character' } }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.code, 'AUTH_REQUIRED');
  });
});

test('image endpoint stays disabled without all three free-only owner switches', async () => {
  await withEnv({
    ...baseEnv,
    GEED_AI_CLOUDFLARE_IMAGE_ENABLED: 'false'
  }, async () => {
    let modelCalls = 0;
    globalThis.fetch = async url => {
      if (String(url).endsWith('/auth/v1/user')) return response(200, { id: 'user-image-1' });
      modelCalls++;
      throw new Error('No other request is expected');
    };
    const res = responseMock();
    await handler({ method: 'POST', headers: { authorization: 'Bearer valid-token' }, body: { prompt: '2D fox character' } }, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.code, 'IMAGE_PROVIDER_NOT_CONFIGURED');
    assert.equal(modelCalls, 0);
  });
});

test('image endpoint rejects oversized prompts before reserving quota', async () => {
  await withEnv(baseEnv, async () => {
    let reservationCalls = 0;
    globalThis.fetch = async url => {
      const target = String(url);
      if (target.endsWith('/auth/v1/user')) return response(200, { id: 'user-image-2' });
      if (target.endsWith('/rpc/geed_reserve_ai_request')) reservationCalls++;
      throw new Error('Unexpected request: ' + target);
    };
    const res = responseMock();
    await handler({ method: 'POST', headers: { authorization: 'Bearer valid-token' }, body: { prompt: 'x'.repeat(2049) } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, 'INVALID_IMAGE_REQUEST');
    assert.equal(reservationCalls, 0);
  });
});

test('image endpoint does not call Cloudflare when account AI entitlement is disabled', async () => {
  await withEnv(baseEnv, async () => {
    let modelCalls = 0;
    globalThis.fetch = async url => {
      const target = String(url);
      if (target.endsWith('/auth/v1/user')) return response(200, { id: 'user-image-3' });
      if (target.endsWith('/rpc/geed_reserve_ai_request')) {
        return response(200, { allowed: false, code: 'AI_DISABLED' });
      }
      if (target.includes('/ai/run/')) modelCalls++;
      throw new Error('Unexpected request: ' + target);
    };
    const res = responseMock();
    await handler({ method: 'POST', headers: { authorization: 'Bearer valid-token' }, body: { prompt: '2D fox character' } }, res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'AI_DISABLED');
    assert.equal(modelCalls, 0);
  });
});

test('image endpoint rejects an invalid Cloudflare account ID before a provider call', async () => {
  await withEnv({ ...baseEnv, GEED_AI_CLOUDFLARE_ACCOUNT_ID: '../not-an-account' }, async () => {
    let modelCalls = 0;
    globalThis.fetch = async url => {
      const target = String(url);
      if (target.endsWith('/auth/v1/user')) return response(200, { id: 'user-image-4' });
      if (target.endsWith('/rpc/geed_reserve_ai_request')) return response(200, { allowed: true });
      if (target.includes('/ai/run/')) modelCalls++;
      throw new Error('Unexpected request: ' + target);
    };
    const res = responseMock();
    await handler({ method: 'POST', headers: { authorization: 'Bearer valid-token' }, body: { prompt: '2D fox character' } }, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.code, 'IMAGE_PROVIDER_NOT_CONFIGURED');
    assert.equal(modelCalls, 0);
  });
});

test('image endpoint reserves account quota, calls only fixed FLUX.1 Schnell and records success', async () => {
  await withEnv(baseEnv, async () => {
    const calls = [];
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64');
    globalThis.fetch = async (url, options = {}) => {
      const target = String(url);
      calls.push({ url: target, options });
      if (target.endsWith('/auth/v1/user')) return response(200, { id: 'user-image-5' });
      if (target.endsWith('/rpc/geed_reserve_ai_request')) {
        assert.equal(options.headers.apikey, baseEnv.GEED_SUPABASE_SERVICE_ROLE_KEY);
        const reservation = JSON.parse(options.body);
        assert.equal(reservation.p_user_id, 'user-image-5');
        assert.equal(reservation.p_reserved_tokens, 1);
        return response(200, { allowed: true, request_limit: 10, token_limit: 100 });
      }
      if (target.endsWith('/rpc/geed_finalize_ai_request')) {
        const record = JSON.parse(options.body);
        assert.equal(record.p_user_id, 'user-image-5');
        assert.equal(record.p_provider, 'cloudflare');
        assert.equal(record.p_model, '@cf/black-forest-labs/flux-1-schnell');
        assert.equal(record.p_task_type, 'creative');
        assert.equal(record.p_input_tokens, 0);
        assert.equal(record.p_output_tokens, 0);
        assert.equal(record.p_cost_status, 'unknown');
        assert.equal(record.p_actual_cost_usd, null);
        assert.equal(record.p_estimated_cost_usd, null);
        assert.equal(record.p_outcome, 'success');
        return response(200, true);
      }
      if (target.endsWith('/ai/run/@cf/black-forest-labs/flux-1-schnell')) {
        assert.equal(options.headers.authorization, 'Bearer cloudflare-test-secret');
        assert.deepEqual(JSON.parse(options.body), { prompt: '2D fox character', steps: 4 });
        return response(200, { success: true, result: { image: jpeg } });
      }
      throw new Error('Unexpected URL: ' + target);
    };
    const res = responseMock();
    await handler({ method: 'POST', headers: { authorization: 'Bearer valid-token' }, body: { prompt: '  2D fox character  ', model: 'some-paid-model', steps: 8 } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.image, 'data:image/jpeg;base64,' + jpeg);
    assert.equal(res.body.provider, 'cloudflare');
    assert.equal(res.body.model, '@cf/black-forest-labs/flux-1-schnell');
    assert.equal(res.body.usage_recorded, true);
    assert.equal(res.body.usage.cost_status, 'unknown');
    assert.equal(calls.length, 4);
    assert.equal(JSON.stringify(res.body).includes('cloudflare-test-secret'), false);
    assert.equal(JSON.stringify(res.body).includes('server-only-test-secret'), false);
  });
});

test('image endpoint records provider rate limits and does not call another provider', async () => {
  await withEnv(baseEnv, async () => {
    let imageCalls = 0;
    let recordedOutcome = null;
    globalThis.fetch = async (url, options = {}) => {
      const target = String(url);
      if (target.endsWith('/auth/v1/user')) return response(200, { id: 'user-image-6' });
      if (target.endsWith('/rpc/geed_reserve_ai_request')) return response(200, { allowed: true });
      if (target.endsWith('/rpc/geed_finalize_ai_request')) {
        recordedOutcome = JSON.parse(options.body).p_outcome;
        return response(200, true);
      }
      if (target.includes('/ai/run/')) {
        imageCalls++;
        return response(429, { success: false, errors: [{ message: 'daily neurons exceeded' }] });
      }
      throw new Error('Unexpected URL: ' + target);
    };
    const res = responseMock();
    await handler({ method: 'POST', headers: { authorization: 'Bearer valid-token' }, body: { prompt: '2D forest background' } }, res);
    assert.equal(res.statusCode, 429);
    assert.equal(res.body.code, 'IMAGE_FREE_QUOTA_EXCEEDED');
    assert.equal(res.body.usage_recorded, true);
    assert.equal(recordedOutcome, 'provider_error');
    assert.equal(imageCalls, 1);
  });
});

test('image endpoint records ambiguous timeouts and refuses automatic retry', async () => {
  await withEnv(baseEnv, async () => {
    let imageCalls = 0;
    let recordedOutcome = null;
    globalThis.fetch = async (url, options = {}) => {
      const target = String(url);
      if (target.endsWith('/auth/v1/user')) return response(200, { id: 'user-image-7' });
      if (target.endsWith('/rpc/geed_reserve_ai_request')) return response(200, { allowed: true });
      if (target.endsWith('/rpc/geed_finalize_ai_request')) {
        recordedOutcome = JSON.parse(options.body).p_outcome;
        return response(200, true);
      }
      if (target.includes('/ai/run/')) {
        imageCalls++;
        const error = new Error('upstream timeout');
        error.name = 'AbortError';
        throw error;
      }
      throw new Error('Unexpected URL: ' + target);
    };
    const res = responseMock();
    await handler({ method: 'POST', headers: { authorization: 'Bearer valid-token' }, body: { prompt: '2D forest background' } }, res);
    assert.equal(res.statusCode, 504);
    assert.equal(res.body.retryable, false);
    assert.equal(res.body.usage_recorded, true);
    assert.equal(recordedOutcome, 'uncertain');
    assert.equal(imageCalls, 1);
  });
});

test('image endpoint rejects invalid image bytes and does not claim an asset was created', async () => {
  await withEnv(baseEnv, async () => {
    let recordedOutcome = null;
    globalThis.fetch = async (url, options = {}) => {
      const target = String(url);
      if (target.endsWith('/auth/v1/user')) return response(200, { id: 'user-image-8' });
      if (target.endsWith('/rpc/geed_reserve_ai_request')) return response(200, { allowed: true });
      if (target.endsWith('/rpc/geed_finalize_ai_request')) {
        recordedOutcome = JSON.parse(options.body).p_outcome;
        return response(200, true);
      }
      if (target.includes('/ai/run/')) return response(200, { success: true, result: { image: 'aGVsbG8=' } });
      throw new Error('Unexpected URL: ' + target);
    };
    const res = responseMock();
    await handler({ method: 'POST', headers: { authorization: 'Bearer valid-token' }, body: { prompt: '2D forest background' } }, res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.code, 'INVALID_IMAGE_RESPONSE');
    assert.equal(res.body.image, undefined);
    assert.equal(recordedOutcome, 'provider_error');
  });
});
