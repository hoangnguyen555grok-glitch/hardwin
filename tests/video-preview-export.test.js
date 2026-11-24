'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { _test } = require('../api/media/upload-url');

test('R2 configuration requires all credentials and a valid bucket/account ID', () => {
  assert.equal(_test.r2Config({}), null);
  const env = {
    GEED_R2_ACCOUNT_ID: 'a'.repeat(32),
    GEED_R2_BUCKET: 'geed-hardwin-exports',
    GEED_R2_ACCESS_KEY_ID: 'test-access-key',
    GEED_R2_SECRET_ACCESS_KEY: 'test-secret-key'
  };
  assert.equal(_test.r2Config(env).bucket, 'geed-hardwin-exports');
  assert.equal(_test.r2Config({...env, GEED_R2_BUCKET: 'Bad Bucket'}), null);
  assert.equal(_test.r2Config({...env, GEED_R2_ACCOUNT_ID: 'not-an-account-id'}), null);
});

test('R2 SigV4 presigned URLs are deterministic, scoped, and time-limited', () => {
  const input = {
    method: 'PUT',
    bucket: 'geed-hardwin-exports',
    key: 'geed-temp/user-123/video-test.webm',
    accountId: 'a'.repeat(32),
    accessKeyId: 'TESTACCESS',
    secretAccessKey: 'test-secret-key',
    expiresSeconds: 900,
    now: new Date('2026-11-23T10:00:00.000Z')
  };
  const first = new URL(_test.presignS3Url(input));
  const second = new URL(_test.presignS3Url(input));
  assert.equal(first.href, second.href);
  assert.equal(first.hostname, 'a'.repeat(32) + '.r2.cloudflarestorage.com');
  assert.equal(first.pathname, '/geed-hardwin-exports/geed-temp/user-123/video-test.webm');
  assert.equal(first.searchParams.get('X-Amz-Algorithm'), 'AWS4-HMAC-SHA256');
  assert.equal(first.searchParams.get('X-Amz-Expires'), '900');
  assert.equal(first.searchParams.get('X-Amz-SignedHeaders'), 'host');
  assert.match(first.searchParams.get('X-Amz-Signature'), /^[a-f0-9]{64}$/);
  assert.match(first.searchParams.get('X-Amz-Credential'), /\/20261123\/auto\/s3\/aws4_request$/);
  assert.equal(first.searchParams.has('test-secret-key'), false);
});

test('R2 signing helper clamps expiry to the S3 maximum and rejects unsupported methods', () => {
  const input = {
    method: 'GET', bucket: 'geed-hardwin-exports', key: 'geed-temp/user/file.mp4',
    accountId: 'b'.repeat(32), accessKeyId: 'ACCESS', secretAccessKey: 'SECRET',
    expiresSeconds: 999999, now: new Date('2026-11-23T10:00:00.000Z')
  };
  const signed = new URL(_test.presignS3Url(input));
  assert.equal(signed.searchParams.get('X-Amz-Expires'), '604800');
  const deleted = new URL(_test.presignS3Url({...input, method: 'DELETE'}));
  assert.equal(deleted.pathname, '/geed-hardwin-exports/geed-temp/user/file.mp4');
  assert.throws(() => _test.presignS3Url({...input, method: 'POST'}), /Unsupported/);
});

test('R2 upload purposes are explicit and final exports are kept outside the temporary cleanup prefix', () => {
  assert.equal(_test.normalizeUploadPurpose(undefined), 'temporary');
  assert.equal(_test.normalizeUploadPurpose('temporary'), 'temporary');
  assert.equal(_test.normalizeUploadPurpose('final'), 'final');
  assert.equal(_test.normalizeUploadPurpose('public'), null);

  assert.equal(
    _test.buildObjectKey({ purpose: 'final', userId: 'user-123', extension: 'mp4', id: 'render-001' }),
    'geed-final/user-123/render-001.mp4'
  );
  assert.equal(
    _test.buildObjectKey({ purpose: 'temporary', userId: 'user-123', extension: 'webm', id: 'render-002' }),
    'geed-temp/user-123/render-002.webm'
  );
  assert.throws(() => _test.buildObjectKey({ purpose: 'final', userId: '../other', extension: 'mp4', id: 'render-003' }), /owner/);
  assert.throws(() => _test.buildObjectKey({ purpose: 'final', userId: 'user-123', extension: 'exe', id: 'render-004' }), /extension/);
});
