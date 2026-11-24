'use strict';

const { createHash, createHmac, randomUUID } = require('node:crypto');
const {
  readConfig,
  getBearerToken,
  verifySupabaseUser
} = require('../../lib/supabase-ai-gateway');

const MAX_UPLOAD_BYTES = 512 * 1024 * 1024;
const UPLOAD_URL_TTL_SECONDS = 900;
const DOWNLOAD_URL_TTL_SECONDS = 24 * 60 * 60;
const RETENTION_SECONDS = 48 * 60 * 60;

function normalizeUploadPurpose(value) {
  const purpose = value === undefined || value === null || value === ''
    ? 'temporary'
    : String(value);
  return purpose === 'temporary' || purpose === 'final' ? purpose : null;
}

function buildObjectKey({ purpose, userId, extension, id }) {
  if (purpose !== 'temporary' && purpose !== 'final') throw new Error('Unsupported upload purpose.');
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(String(userId || ''))) throw new Error('Invalid storage owner.');
  if (extension !== 'mp4' && extension !== 'webm') throw new Error('Unsupported video extension.');
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(String(id || ''))) throw new Error('Invalid object identifier.');
  const prefix = purpose === 'final' ? 'geed-final/' : 'geed-temp/';
  return prefix + userId + '/' + id + '.' + extension;
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('vary', 'Authorization');
  res.end(JSON.stringify(payload));
}

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
  if (verb !== 'PUT' && verb !== 'GET') throw new Error('Unsupported presigned URL method.');
  const expiry = Math.max(1, Math.min(604800, Math.floor(Number(expiresSeconds) || 900)));
  const host = accountId + '.r2.cloudflarestorage.com';
  const canonicalUri = '/' + awsEncode(bucket) + '/' + String(key).split('/').map(awsEncode).join('/');
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
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
  const canonicalHeaders = 'host:' + host + '\n';
  const canonicalRequest = [
    verb,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    'host',
    'UNSIGNED-PAYLOAD'
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256(canonicalRequest)
  ].join('\n');
  const dateKey = hmac('AWS4' + secretAccessKey, dateStamp);
  const regionKey = hmac(dateKey, 'auto');
  const serviceKey = hmac(regionKey, 's3');
  const signingKey = hmac(serviceKey, 'aws4_request');
  const signature = hmac(signingKey, stringToSign, 'hex');
  return 'https://' + host + canonicalUri + '?' + canonicalQuery +
    '&X-Amz-Signature=' + signature;
}

module.exports = async function handler(req, res) {
  const storage = r2Config();
  if (req.method === 'GET') {
    return send(res, 200, {
      available: Boolean(storage),
      reason: storage ? null : 'R2_NOT_CONFIGURED',
      maxUploadBytes: MAX_UPLOAD_BYTES,
      retentionSeconds: RETENTION_SECONDS
    });
  }
  if (req.method !== 'POST') {
    res.setHeader('allow', 'GET, POST');
    return send(res, 405, { error: 'Method not allowed' });
  }
  if (!storage) {
    return send(res, 503, {
      error: 'Cloud video storage is not enabled yet. The project owner must enable R2 and configure its storage credentials.',
      code: 'R2_STORAGE_NOT_CONFIGURED'
    });
  }

  const config = readConfig();
  if (!config) return send(res, 503, { error: 'Account verification is not configured.', code: 'AUTH_SERVICE_NOT_CONFIGURED' });
  const token = getBearerToken(req);
  if (!token) return send(res, 401, { error: 'Sign in with Google before uploading a video.', code: 'AUTH_REQUIRED' });

  let user;
  try { user = await verifySupabaseUser({ token, config }); }
  catch { return send(res, 503, { error: 'Account verification is temporarily unavailable.', code: 'AUTH_SERVICE_UNAVAILABLE' }); }
  if (!user) return send(res, 401, { error: 'Your session is invalid or expired. Sign in again.', code: 'INVALID_SESSION' });

  let body;
  try {
    body = req.body && typeof req.body === 'object'
      ? req.body
      : (typeof req.body === 'string' ? JSON.parse(req.body) : {});
  } catch {
    return send(res, 400, { error: 'Invalid JSON request body.', code: 'INVALID_REQUEST' });
  }

  const purpose = normalizeUploadPurpose(body.purpose);
  if (!purpose) {
    return send(res, 400, { error: 'Upload purpose must be "temporary" or "final".', code: 'INVALID_UPLOAD_PURPOSE' });
  }

  const contentType = body.contentType;
  const size = Number(body.size);
  if (contentType !== 'video/mp4' && contentType !== 'video/webm') {
    return send(res, 400, { error: 'Only MP4 and WebM video files are supported.', code: 'UNSUPPORTED_MEDIA_TYPE' });
  }
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_UPLOAD_BYTES) {
    return send(res, 413, { error: 'Video must be between 1 byte and 512 MiB.', code: 'VIDEO_SIZE_LIMIT' });
  }

  const extension = contentType === 'video/mp4' ? 'mp4' : 'webm';
  const objectKey = buildObjectKey({
    purpose,
    userId: user.id,
    extension,
    id: randomUUID()
  });
  const retentionSeconds = purpose === 'temporary' ? RETENTION_SECONDS : null;
  const now = new Date();
  const uploadUrl = presignS3Url({
    method: 'PUT', bucket: storage.bucket, key: objectKey,
    accountId: storage.accountId, accessKeyId: storage.accessKeyId,
    secretAccessKey: storage.secretAccessKey,
    expiresSeconds: UPLOAD_URL_TTL_SECONDS, now
  });
  const downloadUrl = presignS3Url({
    method: 'GET', bucket: storage.bucket, key: objectKey,
    accountId: storage.accountId, accessKeyId: storage.accessKeyId,
    secretAccessKey: storage.secretAccessKey,
    expiresSeconds: DOWNLOAD_URL_TTL_SECONDS, now
  });

  return send(res, 200, {
    uploadUrl,
    downloadUrl,
    objectKey,
    uploadExpiresSeconds: UPLOAD_URL_TTL_SECONDS,
    downloadExpiresSeconds: DOWNLOAD_URL_TTL_SECONDS,
    retentionSeconds,
    permanentStorage: purpose === 'final',
    purpose,
    contentType
  });
};

module.exports._test = { r2Config, presignS3Url, awsEncode, normalizeUploadPurpose, buildObjectKey, MAX_UPLOAD_BYTES };
