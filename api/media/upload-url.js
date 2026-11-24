'use strict';

const { randomUUID } = require('node:crypto');
const {
  r2Config,
  awsEncode,
  presignS3Url
} = require('../../lib/r2-storage');
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

module.exports._test = {
  r2Config,
  presignS3Url,
  awsEncode,
  normalizeUploadPurpose,
  buildObjectKey,
  MAX_UPLOAD_BYTES
};
