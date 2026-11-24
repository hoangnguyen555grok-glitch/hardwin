'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { _test: r2 } = require('../api/media/upload-url');
const { _test: runway } = require('../api/media/send-to-runway');

const env = {
  GEED_R2_ACCOUNT_ID: 'a'.repeat(32),
  GEED_R2_BUCKET: 'geed-hardwin-exports',
  GEED_R2_ACCESS_KEY_ID: 'test-access',
  GEED_R2_SECRET_ACCESS_KEY: 'test-secret',
  GEED_RUNWAY_API_KEY: 'test-runway-key',
  GEED_SUPABASE_URL: 'https://example.supabase.co',
  GEED_SUPABASE_PUBLISHABLE_KEY: 'test-publishable',
  GEED_SUPABASE_SERVICE_ROLE_KEY: 'test-service-role'
};

function makeResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body) { this.body = body; }
  };
}

function makeRequest(body) {
  return {
    method: 'POST',
    headers: { authorization: 'Bearer signed-in-token' },
    body
  };
}

function makeHandler(fetchImpl, envOverride = env) {
  return runway.createHandler({
    env: envOverride,
    fetchImpl,
    verifyUser: async ({ token }) => token === 'signed-in-token' ? { id: 'user-123' } : null
  });
}

test('R2 signer creates a scoped DELETE presigned URL for post-handoff cleanup', () => {
  const signed = new URL(r2.presignS3Url({
    method: 'DELETE',
    bucket: 'geed-hardwin-exports',
    key: 'geed-final/user-123/render-1.mp4',
    accountId: 'a'.repeat(32),
    accessKeyId: 'ACCESS',
    secretAccessKey: 'SECRET',
    expiresSeconds: 900,
    now: new Date('2026-11-24T10:00:00.000Z')
  }));
  assert.equal(signed.searchParams.get('X-Amz-Expires'), '900');
  assert.match(signed.searchParams.get('X-Amz-Signature'), /^[a-f0-9]{64}$/);
});

test('Runway handoff accepts only a final video key owned by the signed-in user', () => {
  assert.deepEqual(runway.parseOwnedFinalObjectKey('geed-final/user-123/render-01.mp4', 'user-123'), {
    key: 'geed-final/user-123/render-01.mp4',
    filename: 'render-01.mp4',
    contentType: 'video/mp4'
  });
  assert.equal(runway.parseOwnedFinalObjectKey('geed-final/user-456/render-01.mp4', 'user-123'), null);
  assert.equal(runway.parseOwnedFinalObjectKey('geed-temp/user-123/render-01.mp4', 'user-123'), null);
  assert.equal(runway.parseOwnedFinalObjectKey('geed-final/user-123/../../other.mp4', 'user-123'), null);
});

test('successful Runway receipt deletes only the matching source object from R2', async () => {
  const calls = [];
  const video = Buffer.alloc(2048, 7);
  let uploadedForm = null;
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET' });
    if (String(url) === runway.RUNWAY_API_URL) {
      return new Response(JSON.stringify({
        uploadUrl: 'https://uploads.runway.example/temporary',
        fields: { key: 'temporary/object', policy: 'signed-policy' },
        runwayUri: 'runway://upload/asset-123'
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (String(url) === 'https://uploads.runway.example/temporary') {
      uploadedForm = options.body;
      return new Response(null, { status: 204 });
    }
    if (String(url).includes('.r2.cloudflarestorage.com')) {
      if ((options.method || 'GET') === 'GET') {
        return new Response(video, {
          status: 200,
          headers: { 'content-length': String(video.length), 'content-type': 'video/mp4' }
        });
      }
      if (options.method === 'DELETE') return new Response(null, { status: 204 });
    }
    throw new Error('Unexpected fetch: ' + url);
  };

  const handler = makeHandler(fetchImpl);
  const response = makeResponse();
  await handler(makeRequest({ objectKey: 'geed-final/user-123/render-01.mp4' }), response);

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.accepted, true);
  assert.equal(body.r2Deleted, true);
  assert.equal(body.runwayUri, 'runway://upload/asset-123');
  assert.equal(body.runwayUriTtlSeconds, 86400);
  assert.ok(uploadedForm instanceof FormData);
  assert.equal(uploadedForm.get('key'), 'temporary/object');
  assert.equal(uploadedForm.get('policy'), 'signed-policy');
  assert.equal(uploadedForm.get('file').size, video.length);
  assert.equal(calls.filter(call => call.method === 'DELETE').length, 1);
});

test('Runway upload failure keeps the R2 source and does not call DELETE', async () => {
  const calls = [];
  const video = Buffer.alloc(2048, 9);
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET' });
    if (String(url) === runway.RUNWAY_API_URL) {
      return new Response(JSON.stringify({
        uploadUrl: 'https://uploads.runway.example/temporary',
        fields: { key: 'temporary/object' },
        runwayUri: 'runway://upload/asset-456'
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (String(url) === 'https://uploads.runway.example/temporary') {
      return new Response('upload failed', { status: 500 });
    }
    if (String(url).includes('.r2.cloudflarestorage.com') && (options.method || 'GET') === 'GET') {
      return new Response(video, {
        status: 200,
        headers: { 'content-length': String(video.length) }
      });
    }
    throw new Error('Unexpected fetch: ' + url);
  };

  const handler = makeHandler(fetchImpl);
  const response = makeResponse();
  await handler(makeRequest({ objectKey: 'geed-final/user-123/render-02.webm' }), response);

  assert.equal(response.statusCode, 502);
  assert.equal(JSON.parse(response.body).code, 'RUNWAY_FILE_UPLOAD_FAILED');
  assert.equal(calls.filter(call => call.method === 'DELETE').length, 0);
});

test('Runway handoff rejects files above the Runway limit before starting an upload', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET' });
    return new Response(null, {
      status: 200,
      headers: { 'content-length': String(runway.RUNWAY_UPLOAD_MAX_BYTES + 1) }
    });
  };

  const handler = makeHandler(fetchImpl);
  const response = makeResponse();
  await handler(makeRequest({ objectKey: 'geed-final/user-123/large.mp4' }), response);

  assert.equal(response.statusCode, 413);
  assert.equal(JSON.parse(response.body).code, 'RUNWAY_FILE_TOO_LARGE');
  assert.equal(calls.length, 1);
});

test('missing Runway API key leaves the video in R2 and reports setup required', async () => {
  let fetchCount = 0;
  const fetchImpl = async () => { fetchCount += 1; throw new Error('must not call'); };
  const handler = makeHandler(fetchImpl, { ...env, GEED_RUNWAY_API_KEY: '' });
  const response = makeResponse();
  await handler(makeRequest({ objectKey: 'geed-final/user-123/render-03.mp4' }), response);

  assert.equal(response.statusCode, 503);
  assert.equal(JSON.parse(response.body).code, 'RUNWAY_API_NOT_CONFIGURED');
  assert.equal(fetchCount, 0);
});

test('cleanup action deletes only the authenticated user object without re-uploading', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET' });
    return new Response(null, { status: 204 });
  };
  const handler = makeHandler(fetchImpl);
  const response = makeResponse();
  await handler(makeRequest({
    action: 'cleanup',
    objectKey: 'geed-final/user-123/render-04.mp4'
  }), response);

  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).r2Deleted, true);
  assert.deepEqual(calls.map(call => call.method), ['DELETE']);
});
