'use strict';

const {
  r2Config,
  presignS3Url
} = require('../../lib/r2-storage');
const {
  readConfig,
  getBearerToken,
  verifySupabaseUser
} = require('../../lib/supabase-ai-gateway');

const RUNWAY_API_URL = 'https://api.dev.runwayml.com/v1/uploads';
const RUNWAY_API_VERSION = '2024-11-06';
const RUNWAY_UPLOAD_MAX_BYTES = 200 * 1024 * 1024;
const RUNWAY_UPLOAD_MIN_BYTES = 512;
const R2_URL_TTL_SECONDS = 900;
const REQUEST_TIMEOUT_MS = 55000;

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('vary', 'Authorization');
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  return {};
}

function parseOwnedFinalObjectKey(value, userId) {
  if (typeof value !== 'string' || !value || value.length > 240) return null;
  const prefix = 'geed-final/' + String(userId || '') + '/';
  if (!prefix || !value.startsWith(prefix)) return null;
  const filename = value.slice(prefix.length);
  if (!/^[a-zA-Z0-9-]{1,80}\.(mp4|webm)$/.test(filename)) return null;
  return {
    key: value,
    filename,
    contentType: filename.toLowerCase().endsWith('.mp4') ? 'video/mp4' : 'video/webm'
  };
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function deleteR2Object({ fetchImpl, storage, key }) {
  const deleteUrl = presignS3Url({
    method: 'DELETE',
    bucket: storage.bucket,
    key,
    accountId: storage.accountId,
    accessKeyId: storage.accessKeyId,
    secretAccessKey: storage.secretAccessKey,
    expiresSeconds: R2_URL_TTL_SECONDS
  });
  const response = await fetchWithTimeout(fetchImpl, deleteUrl, { method: 'DELETE' });
  return response.ok;
}

function createHandler(dependencies = {}) {
  const env = dependencies.env || process.env;
  const fetchImpl = dependencies.fetchImpl || globalThis.fetch;
  const verifyUser = dependencies.verifyUser || verifySupabaseUser;

  return async function handler(req, res) {
    const storage = r2Config(env);
    const runwayApiKey = String(env.GEED_RUNWAY_API_KEY || '').trim();

    if (req.method === 'GET') {
      const available = Boolean(storage && runwayApiKey);
      return send(res, 200, {
        available,
        r2Available: Boolean(storage),
        runwayConfigured: Boolean(runwayApiKey),
        reason: !storage ? 'R2_NOT_CONFIGURED' : (!runwayApiKey ? 'RUNWAY_API_NOT_CONFIGURED' : null),
        maxRunwayUploadBytes: RUNWAY_UPLOAD_MAX_BYTES,
        runwayUriTtlSeconds: 24 * 60 * 60
      });
    }

    if (req.method !== 'POST') {
      res.setHeader('allow', 'GET, POST');
      return send(res, 405, { error: 'Method not allowed' });
    }
    if (!storage) {
      return send(res, 503, {
        error: 'R2 has not been configured. The video has not been transferred or deleted.',
        code: 'R2_STORAGE_NOT_CONFIGURED'
      });
    }

    const config = readConfig(env);
    if (!config) return send(res, 503, { error: 'Account verification is not configured.', code: 'AUTH_SERVICE_NOT_CONFIGURED' });
    const token = getBearerToken(req);
    if (!token) return send(res, 401, { error: 'Sign in with Google before transferring a video.', code: 'AUTH_REQUIRED' });

    let user;
    try { user = await verifyUser({ token, config, fetchImpl }); }
    catch { return send(res, 503, { error: 'Account verification is temporarily unavailable.', code: 'AUTH_SERVICE_UNAVAILABLE' }); }
    if (!user) return send(res, 401, { error: 'Your session is invalid or expired. Sign in again.', code: 'INVALID_SESSION' });

    let body;
    try { body = parseBody(req); }
    catch { return send(res, 400, { error: 'Invalid JSON request body.', code: 'INVALID_REQUEST' }); }

    const object = parseOwnedFinalObjectKey(body.objectKey, user.id);
    if (!object) {
      return send(res, 400, {
        error: 'The video key is invalid or does not belong to this signed-in account.',
        code: 'INVALID_OBJECT_KEY'
      });
    }

    if (body.action === 'cleanup') {
      try {
        const deleted = await deleteR2Object({ fetchImpl, storage, key: object.key });
        if (!deleted) return send(res, 502, {
          error: 'Runway has already received the file, but R2 did not confirm cleanup. The object key is kept so cleanup can be retried.',
          code: 'R2_DELETE_FAILED',
          objectKey: object.key
        });
        return send(res, 200, { accepted: true, r2Deleted: true });
      } catch {
        return send(res, 502, {
          error: 'R2 cleanup could not be confirmed. The object remains available for another cleanup attempt.',
          code: 'R2_DELETE_FAILED',
          objectKey: object.key
        });
      }
    }

    if (!runwayApiKey) {
      return send(res, 503, {
        error: 'The Runway API key is not configured on the server. The video is still safe in R2 and has not been deleted.',
        code: 'RUNWAY_API_NOT_CONFIGURED',
        objectKey: object.key
      });
    }

    let sourceResponse;
    try {
      const sourceUrl = presignS3Url({
        method: 'GET',
        bucket: storage.bucket,
        key: object.key,
        accountId: storage.accountId,
        accessKeyId: storage.accessKeyId,
        secretAccessKey: storage.secretAccessKey,
        expiresSeconds: R2_URL_TTL_SECONDS
      });
      sourceResponse = await fetchWithTimeout(fetchImpl, sourceUrl, { method: 'GET' });
    } catch {
      return send(res, 502, {
        error: 'Could not read the video from R2. The R2 copy has been kept.',
        code: 'R2_READ_FAILED',
        objectKey: object.key
      });
    }
    if (!sourceResponse.ok) {
      return send(res, sourceResponse.status === 404 ? 404 : 502, {
        error: 'The video could not be found in R2. Nothing was sent to Runway or deleted.',
        code: 'R2_OBJECT_NOT_FOUND',
        objectKey: object.key
      });
    }

    const declaredLength = Number(sourceResponse.headers?.get?.('content-length') || 0);
    if (declaredLength > RUNWAY_UPLOAD_MAX_BYTES) {
      try { await sourceResponse.body?.cancel?.(); } catch {}
      return send(res, 413, {
        error: 'Runway ephemeral uploads support files up to 200 MB. The R2 copy remains untouched.',
        code: 'RUNWAY_FILE_TOO_LARGE',
        maxBytes: RUNWAY_UPLOAD_MAX_BYTES,
        objectKey: object.key
      });
    }

    let bytes;
    try { bytes = Buffer.from(await sourceResponse.arrayBuffer()); }
    catch {
      return send(res, 502, {
        error: 'The video could not be read completely from R2. The R2 copy has been kept.',
        code: 'R2_READ_FAILED',
        objectKey: object.key
      });
    }
    if (bytes.length < RUNWAY_UPLOAD_MIN_BYTES) {
      return send(res, 400, {
        error: 'Runway requires a video file of at least 512 bytes. The R2 copy has been kept.',
        code: 'RUNWAY_FILE_TOO_SMALL',
        objectKey: object.key
      });
    }
    if (bytes.length > RUNWAY_UPLOAD_MAX_BYTES) {
      return send(res, 413, {
        error: 'Runway ephemeral uploads support files up to 200 MB. The R2 copy remains untouched.',
        code: 'RUNWAY_FILE_TOO_LARGE',
        maxBytes: RUNWAY_UPLOAD_MAX_BYTES,
        objectKey: object.key
      });
    }

    let uploadSession;
    try {
      const initResponse = await fetchWithTimeout(fetchImpl, RUNWAY_API_URL, {
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + runwayApiKey,
          'x-runway-version': RUNWAY_API_VERSION,
          'content-type': 'application/json',
          accept: 'application/json'
        },
        body: JSON.stringify({ filename: object.filename, type: 'ephemeral' })
      });
      uploadSession = await initResponse.json().catch(() => null);
      if (!initResponse.ok) {
        return send(res, 502, {
          error: 'Runway refused to create an upload session (HTTP ' + initResponse.status + '). The R2 copy has been kept.',
          code: 'RUNWAY_UPLOAD_SESSION_FAILED',
          providerStatus: initResponse.status,
          objectKey: object.key
        });
      }
    } catch {
      return send(res, 502, {
        error: 'Runway could not be reached. The R2 copy has been kept.',
        code: 'RUNWAY_UNAVAILABLE',
        objectKey: object.key
      });
    }

    if (!uploadSession ||
        typeof uploadSession.uploadUrl !== 'string' ||
        !uploadSession.uploadUrl.startsWith('https://') ||
        !uploadSession.fields ||
        typeof uploadSession.fields !== 'object' ||
        Array.isArray(uploadSession.fields) ||
        typeof uploadSession.runwayUri !== 'string' ||
        !uploadSession.runwayUri.startsWith('runway://')) {
      return send(res, 502, {
        error: 'Runway returned an invalid upload session. The R2 copy has been kept.',
        code: 'RUNWAY_INVALID_UPLOAD_SESSION',
        objectKey: object.key
      });
    }

    let runwayUploadResponse;
    try {
      const form = new FormData();
      for (const [name, value] of Object.entries(uploadSession.fields)) {
        if (name === 'file') continue;
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
          return send(res, 502, {
            error: 'Runway returned unsupported upload fields. The R2 copy has been kept.',
            code: 'RUNWAY_INVALID_UPLOAD_FIELDS',
            objectKey: object.key
          });
        }
        form.append(name, String(value));
      }
      form.append('file', new Blob([bytes], { type: object.contentType }), object.filename);
      runwayUploadResponse = await fetchWithTimeout(fetchImpl, uploadSession.uploadUrl, {
        method: 'POST',
        body: form
      });
    } catch {
      return send(res, 502, {
        error: 'The video could not be uploaded to Runway. The R2 copy has been kept for a safe retry.',
        code: 'RUNWAY_FILE_UPLOAD_FAILED',
        objectKey: object.key
      });
    }

    if (!runwayUploadResponse.ok) {
      return send(res, 502, {
        error: 'Runway did not confirm receipt of the video (HTTP ' + runwayUploadResponse.status + '). The R2 copy has been kept.',
        code: 'RUNWAY_FILE_UPLOAD_FAILED',
        providerStatus: runwayUploadResponse.status,
        objectKey: object.key
      });
    }

    try {
      const deleted = await deleteR2Object({ fetchImpl, storage, key: object.key });
      if (!deleted) {
        return send(res, 200, {
          accepted: true,
          runwayUri: uploadSession.runwayUri,
          runwayUriTtlSeconds: 24 * 60 * 60,
          r2Deleted: false,
          objectKey: object.key,
          cleanupRequired: true
        });
      }
      return send(res, 200, {
        accepted: true,
        runwayUri: uploadSession.runwayUri,
        runwayUriTtlSeconds: 24 * 60 * 60,
        r2Deleted: true
      });
    } catch {
      return send(res, 200, {
        accepted: true,
        runwayUri: uploadSession.runwayUri,
        runwayUriTtlSeconds: 24 * 60 * 60,
        r2Deleted: false,
        objectKey: object.key,
        cleanupRequired: true
      });
    }
  };
}

module.exports = createHandler();
module.exports._test = {
  parseOwnedFinalObjectKey,
  createHandler,
  RUNWAY_UPLOAD_MAX_BYTES,
  RUNWAY_UPLOAD_MIN_BYTES,
  RUNWAY_API_URL,
  RUNWAY_API_VERSION
};
