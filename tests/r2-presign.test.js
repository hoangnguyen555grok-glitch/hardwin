'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { presignR2Url, canonicalPath } = require('../lib/r2-presign');

const credentials = {
  accountId: '0123456789abcdef0123456789abcdef',
  bucket: 'geed-hardwin-user-data',
  objectKey: '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/project.json',
  accessKeyId: 'TESTACCESSKEY',
  secretAccessKey: 'never-return-this-secret',
  now: new Date('2026-11-21T12:34:56.000Z')
};

test('creates an expiring path-style R2 PUT URL for one object', () => {
  const url = new URL(presignR2Url({ ...credentials, method: 'PUT', expiresIn: 600 }));
  assert.equal(url.origin, 'https://' + credentials.accountId + '.r2.cloudflarestorage.com');
  assert.equal(url.pathname, '/' + credentials.bucket + '/' + credentials.objectKey);
  assert.equal(url.searchParams.get('X-Amz-Algorithm'), 'AWS4-HMAC-SHA256');
  assert.equal(url.searchParams.get('X-Amz-Expires'), '600');
  assert.equal(url.searchParams.get('X-Amz-SignedHeaders'), 'host');
  assert.match(url.searchParams.get('X-Amz-Signature'), /^[a-f0-9]{64}$/);
  assert.match(url.searchParams.get('X-Amz-Credential'), /^TESTACCESSKEY\//);
  assert.doesNotMatch(url.toString(), /never-return-this-secret/);
});

test('supports short-lived GET and HEAD access for the same private object', () => {
  const get = new URL(presignR2Url({ ...credentials, method: 'GET', expiresIn: 120 }));
  const head = new URL(presignR2Url({ ...credentials, method: 'HEAD', expiresIn: 120 }));
  assert.equal(get.pathname, head.pathname);
  assert.notEqual(get.searchParams.get('X-Amz-Signature'), head.searchParams.get('X-Amz-Signature'));
  assert.equal(get.searchParams.get('X-Amz-Expires'), '120');
});

test('encodes object path segments without allowing path traversal', () => {
  assert.equal(canonicalPath('geed-hardwin-user-data', 'user-a/file name.json'),
    '/geed-hardwin-user-data/user-a/file%20name.json');
  assert.throws(() => canonicalPath('geed-hardwin-user-data', '../private.json'), /Invalid R2 object key/);
  assert.throws(() => canonicalPath('geed-hardwin-user-data', 'user//file.json'), /Invalid R2 object key/);
});

test('rejects invalid methods, expiry, bucket and credentials', () => {
  assert.throws(() => presignR2Url({ ...credentials, method: 'POST' }), /Unsupported R2 operation/);
  assert.throws(() => presignR2Url({ ...credentials, method: 'GET', expiresIn: 0 }), /expiry/);
  assert.throws(() => presignR2Url({ ...credentials, method: 'GET', expiresIn: 604801 }), /expiry/);
  assert.throws(() => presignR2Url({ ...credentials, method: 'GET', bucket: 'bad bucket' }), /bucket/);
  assert.throws(() => presignR2Url({ ...credentials, method: 'GET', secretAccessKey: '' }), /credentials/);
});
