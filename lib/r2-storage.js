'use strict';

const { createHash, createHmac } = require('node:crypto');

function r2Config(env = process.env) {
  const accountId = String(env.GEED_R2_ACCOUNT_ID || '').trim();
  const bucket = String(env.GEED_R2_BUCKET || '').trim();
  const accessKeyId = String(env.GEED_R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = String(env.GEED_R2_SECRET_ACCESS_KEY || '');
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) return null;
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) return null;
  if (!/^[a-f0-9]{32}$/i.test(accountId)) return null;
  return { accountId, bucket, accessKeyId, secretAccessKey };
}

function awsEncode(value) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/g, char =>
    '%' + char.charCodeAt(0).toString(16).toUpperCase()
  );
}

function hmac(key, value, encoding) {
  const result = createHmac('sha256', key).update(value, 'utf8');
  return encoding ? result.digest(encoding) : result.digest();
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function presignS3Url({
  method,
  bucket,
  key,
  accountId,
  accessKeyId,
  secretAccessKey,
  expiresSeconds,
  now = new Date()
}) {
  const verb = String(method || '').toUpperCase();
  if (!['PUT', 'GET', 'DELETE'].includes(verb)) {
    throw new Error('Unsupported presigned URL method.');
  }
  const expiry = Math.max(1, Math.min(604800, Math.floor(Number(expiresSeconds) || 900)));
  const host = accountId + '.r2.cloudflarestorage.com';
  const canonicalUri = '/' + awsEncode(bucket) + '/' + String(key).split('/').map(awsEncode).join('/');
  const amzDate = now.toISOString().replace(/[:-]|\\.\\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = dateStamp + '/auto/s3/aws4_request';
  const query = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', accessKeyId + '/' + credentialScope],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(expiry)],
    ['X-Amz-SignedHeaders', 'host']
  ];
  const canonicalQuery = query
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, value]) => awsEncode(name) + '=' + awsEncode(value))
    .join('&');
  const canonicalHeaders = 'host:' + host + '\\n';
  const canonicalRequest = [
    verb,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    'host',
    'UNSIGNED-PAYLOAD'
  ].join('\\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256(canonicalRequest)
  ].join('\\n');
  const dateKey = hmac('AWS4' + secretAccessKey, dateStamp);
  const regionKey = hmac(dateKey, 'auto');
  const serviceKey = hmac(regionKey, 's3');
  const signingKey = hmac(serviceKey, 'aws4_request');
  const signature = hmac(signingKey, stringToSign, 'hex');
  return 'https://' + host + canonicalUri + '?' + canonicalQuery +
    '&X-Amz-Signature=' + signature;
}

module.exports = { r2Config, awsEncode, presignS3Url };
