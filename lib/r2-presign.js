'use strict';

const crypto = require('node:crypto');

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest(encoding);
}

function encodeRfc3986(value) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/g, char =>
    '%' + char.charCodeAt(0).toString(16).toUpperCase()
  );
}

function canonicalPath(bucket, objectKey) {
  if (typeof bucket !== 'string' || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw new TypeError('Invalid R2 bucket name.');
  }
  if (typeof objectKey !== 'string' || !objectKey || objectKey.length > 1024 ||
      objectKey.startsWith('/') || objectKey.endsWith('/')) {
    throw new TypeError('Invalid R2 object key.');
  }
  const segments = objectKey.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..' || segment.length > 255)) {
    throw new TypeError('Invalid R2 object key.');
  }
  return '/' + encodeRfc3986(bucket) + '/' + segments.map(encodeRfc3986).join('/');
}

function presignR2Url({
  method,
  accountId,
  bucket,
  objectKey,
  accessKeyId,
  secretAccessKey,
  expiresIn = 600,
  now = new Date()
} = {}) {
  const verb = String(method || '').toUpperCase();
  if (!['GET', 'PUT', 'HEAD', 'DELETE'].includes(verb)) {
    throw new TypeError('Unsupported R2 operation.');
  }
  if (typeof accountId !== 'string' || !/^[a-f0-9]{32}$/i.test(accountId)) {
    throw new TypeError('Invalid R2 account ID.');
  }
  if (typeof accessKeyId !== 'string' || !accessKeyId.trim() ||
      typeof secretAccessKey !== 'string' || !secretAccessKey) {
    throw new TypeError('R2 credentials are not configured.');
  }
  if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 604800) {
    throw new RangeError('R2 URL expiry must be between 1 and 604800 seconds.');
  }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new TypeError('Invalid signing date.');
  }

  const host = accountId + '.r2.cloudflarestorage.com';
  const uri = canonicalPath(bucket, objectKey);
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = iso.slice(0, 8);
  const credentialScope = dateStamp + '/auto/s3/aws4_request';
  const parameters = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', accessKeyId + '/' + credentialScope],
    ['X-Amz-Date', iso],
    ['X-Amz-Expires', String(expiresIn)],
    ['X-Amz-SignedHeaders', 'host']
  ];
  const canonicalQuery = parameters
    .map(([key, value]) => [encodeRfc3986(key), encodeRfc3986(value)])
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([key, value]) => key + '=' + value)
    .join('&');

  const canonicalRequest = [
    verb,
    uri,
    canonicalQuery,
    'host:' + host + '\n',
    'host',
    'UNSIGNED-PAYLOAD'
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    iso,
    credentialScope,
    sha256(canonicalRequest)
  ].join('\n');

  const dateKey = hmac('AWS4' + secretAccessKey, dateStamp);
  const regionKey = hmac(dateKey, 'auto');
  const serviceKey = hmac(regionKey, 's3');
  const signingKey = hmac(serviceKey, 'aws4_request');
  const signature = hmac(signingKey, stringToSign, 'hex');

  return 'https://' + host + uri + '?' + canonicalQuery + '&X-Amz-Signature=' + signature;
}

module.exports = { presignR2Url, encodeRfc3986, canonicalPath };
