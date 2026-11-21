'use strict';

const {
  readConfig,
  getBearerToken,
  verifySupabaseUser,
  callSupabaseRpc
} = require('../../lib/supabase-ai-gateway');
const { presignR2Url } = require('../../lib/r2-presign');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_RE = /^[0-9a-f]{64}$/i;
const DEFAULT_MAX_OBJECT_BYTES = 50 * 1024 * 1024;

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('vary', 'Authorization');
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) return req.body;
  if (typeof req.body === 'string' && req.body.length <= 16000) {
    const parsed = JSON.parse(req.body);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  }
  throw new TypeError('Invalid request body.');
}

function readR2Config(env = process.env) {
  const config = {
    accountId: String(env.GEED_R2_ACCOUNT_ID || '').trim(),
    bucket: String(env.GEED_R2_BUCKET || '').trim(),
    accessKeyId: String(env.GEED_R2_ACCESS_KEY_ID || '').trim(),
    secretAccessKey: String(env.GEED_R2_SECRET_ACCESS_KEY || '')
  };
  if (!config.accountId || !config.bucket || !config.accessKeyId || !config.secretAccessKey) return null;
  return config;
}

function objectKeyFor(userId, projectKey) {
  return userId + '/' + projectKey + '/project.json';
}

function maxObjectBytes(env = process.env) {
  const value = Number(env.GEED_CLOUD_MAX_OBJECT_BYTES || DEFAULT_MAX_OBJECT_BYTES);
  if (!Number.isSafeInteger(value) || value < 1024 || value > 100 * 1024 * 1024) {
    return DEFAULT_MAX_OBJECT_BYTES;
  }
  return value;
}

async function supabaseRequest(config, path, options = {}) {
  const response = await fetch(config.url + path, {
    method: options.method || 'GET',
    headers: {
      apikey: config.serviceRoleKey,
      authorization: 'Bearer ' + config.serviceRoleKey,
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {})
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    cache: 'no-store'
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error('Cloud workspace database request failed.');
    error.status = response.status;
    error.code = data?.code || 'CLOUD_DATABASE_ERROR';
    throw error;
  }
  return data;
}

async function getStorageStats(config, userId) {
  const query = '/rest/v1/entitlements?select=cloud_storage_limit_bytes,status&user_id=eq.' +
    encodeURIComponent(userId) + '&limit=1';
  const entitlements = await supabaseRequest(config, query);
  const rows = await supabaseRequest(config,
    '/rest/v1/project_metadata?select=cloud_size_bytes&user_id=eq.' +
    encodeURIComponent(userId) + '&cloud_object_key=not.is.null');
  const usedBytes = Array.isArray(rows)
    ? rows.reduce((sum, row) => sum + Math.max(0, Number(row.cloud_size_bytes) || 0), 0)
    : 0;
  return {
    usedBytes,
    limitBytes: Math.max(0, Number(entitlements?.[0]?.cloud_storage_limit_bytes) || 0),
    status: entitlements?.[0]?.status || 'unknown'
  };
}

function signedUrl(r2, method, key, expiresIn = 600) {
  return presignR2Url({
    method,
    accountId: r2.accountId,
    bucket: r2.bucket,
    objectKey: key,
    accessKeyId: r2.accessKeyId,
    secretAccessKey: r2.secretAccessKey,
    expiresIn
  });
}

async function listProjects(config, userId) {
  const fields = 'id,local_project_key,name,schema_version,cloud_size_bytes,cloud_sha256,cloud_version,cloud_saved_at,updated_at';
  const path = '/rest/v1/project_metadata?select=' + fields +
    '&user_id=eq.' + encodeURIComponent(userId) +
    '&cloud_object_key=not.is.null&order=updated_at.desc&limit=100';
  const [projects, storage] = await Promise.all([
    supabaseRequest(config, path),
    getStorageStats(config, userId)
  ]);
  return { projects: Array.isArray(projects) ? projects : [], storage };
}

async function prepareSave(config, r2, userId, body) {
  const projectKey = String(body.projectKey || '');
  const name = String(body.name || '').trim();
  const schemaVersion = Number(body.schemaVersion);
  const byteSize = Number(body.byteSize);
  if (!UUID_RE.test(projectKey)) throw Object.assign(new Error('Invalid project identifier.'), { status: 400 });
  if (!name || name.length > 160) throw Object.assign(new Error('Project name must be 1–160 characters.'), { status: 400 });
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1 || schemaVersion > 1000) {
    throw Object.assign(new Error('Invalid project version.'), { status: 400 });
  }
  if (!Number.isSafeInteger(byteSize) || byteSize < 2 || byteSize > maxObjectBytes()) {
    throw Object.assign(new Error('Project file exceeds the cloud upload limit.'), { status: 413, code: 'CLOUD_OBJECT_TOO_LARGE' });
  }

  const reservation = await callSupabaseRpc({
    config,
    functionName: 'geed_reserve_cloud_storage',
    payload: {
      p_user_id: userId,
      p_local_project_key: projectKey,
      p_requested_bytes: byteSize
    }
  });
  const result = Array.isArray(reservation) ? reservation[0] : reservation;
  if (!result || result.allowed !== true || !result.reservation_id) {
    const code = result?.code || 'CLOUD_STORAGE_NOT_ALLOWED';
    throw Object.assign(new Error(
      code === 'CLOUD_STORAGE_QUOTA_EXCEEDED'
        ? 'Your cloud storage allowance has been reached.'
        : code === 'CLOUD_PROJECT_SAVE_IN_PROGRESS'
          ? 'This project is already being saved. Try again shortly.'
          : 'Cloud storage is not enabled for this account yet.'
    ), { status: code === 'CLOUD_STORAGE_QUOTA_EXCEEDED' ? 413 : 403, code });
  }

  const key = objectKeyFor(userId, projectKey);
  return {
    reservationId: result.reservation_id,
    uploadUrl: signedUrl(r2, 'PUT', key, 600),
    byteSize,
    expiresIn: 600
  };
}

async function completeSave(config, r2, userId, body) {
  const reservationId = String(body.reservationId || '');
  const projectKey = String(body.projectKey || '');
  const name = String(body.name || '').trim();
  const schemaVersion = Number(body.schemaVersion);
  const byteSize = Number(body.byteSize);
  const sha256 = String(body.sha256 || '').toLowerCase();
  if (!UUID_RE.test(reservationId) || !UUID_RE.test(projectKey) ||
      !name || name.length > 160 || !Number.isInteger(schemaVersion) ||
      schemaVersion < 1 || schemaVersion > 1000 ||
      !Number.isSafeInteger(byteSize) || byteSize < 2 || byteSize > maxObjectBytes() ||
      !SHA256_RE.test(sha256)) {
    throw Object.assign(new Error('Invalid cloud save confirmation.'), { status: 400 });
  }

  const key = objectKeyFor(userId, projectKey);
  const headUrl = signedUrl(r2, 'HEAD', key, 120);
  const response = await fetch(headUrl, { method: 'HEAD', cache: 'no-store' });
  if (!response.ok) {
    throw Object.assign(new Error('The uploaded project file could not be verified in cloud storage.'), {
      status: 409, code: 'CLOUD_UPLOAD_NOT_FOUND'
    });
  }
  const storedBytes = Number(response.headers.get('content-length'));
  if (!Number.isSafeInteger(storedBytes) || storedBytes !== byteSize) {
    throw Object.assign(new Error('Uploaded file size does not match the reserved size.'), {
      status: 409, code: 'CLOUD_UPLOAD_SIZE_MISMATCH'
    });
  }

  const saved = await callSupabaseRpc({
    config,
    functionName: 'geed_finalize_cloud_storage',
    payload: {
      p_reservation_id: reservationId,
      p_user_id: userId,
      p_local_project_key: projectKey,
      p_name: name,
      p_schema_version: schemaVersion,
      p_object_key: key,
      p_uploaded_bytes: storedBytes,
      p_sha256: sha256
    }
  });
  const result = Array.isArray(saved) ? saved[0] : saved;
  return { project: result };
}

async function prepareOpen(config, r2, userId, body) {
  const projectKey = String(body.projectKey || '');
  if (!UUID_RE.test(projectKey)) throw Object.assign(new Error('Invalid project identifier.'), { status: 400 });
  const fields = 'local_project_key,name,schema_version,cloud_size_bytes,cloud_sha256,cloud_version,cloud_saved_at,cloud_object_key';
  const path = '/rest/v1/project_metadata?select=' + fields +
    '&user_id=eq.' + encodeURIComponent(userId) +
    '&local_project_key=eq.' + encodeURIComponent(projectKey) +
    '&cloud_object_key=not.is.null&limit=1';
  const rows = await supabaseRequest(config, path);
  const project = Array.isArray(rows) ? rows[0] : null;
  if (!project || project.cloud_object_key !== objectKeyFor(userId, projectKey)) {
    throw Object.assign(new Error('Cloud project not found.'), { status: 404, code: 'CLOUD_PROJECT_NOT_FOUND' });
  }
  return {
    downloadUrl: signedUrl(r2, 'GET', project.cloud_object_key, 600),
    project: {
      local_project_key: project.local_project_key,
      name: project.name,
      schema_version: project.schema_version,
      cloud_size_bytes: project.cloud_size_bytes,
      cloud_sha256: project.cloud_sha256,
      cloud_version: project.cloud_version,
      cloud_saved_at: project.cloud_saved_at
    },
    expiresIn: 600
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST');
    return send(res, 405, { error: 'Method not allowed.' });
  }

  const config = readConfig();
  if (!config) return send(res, 503, {
    error: 'Cloud workspace server is not configured.',
    code: 'CLOUD_WORKSPACE_NOT_CONFIGURED'
  });

  const token = getBearerToken(req);
  if (!token) return send(res, 401, { error: 'Sign in with Google to use cloud storage.', code: 'AUTH_REQUIRED' });

  let user;
  try {
    user = await verifySupabaseUser({ token, config });
  } catch {
    return send(res, 503, { error: 'Account verification is temporarily unavailable.', code: 'AUTH_SERVICE_UNAVAILABLE' });
  }
  if (!user) return send(res, 401, { error: 'Your session is invalid or expired.', code: 'INVALID_SESSION' });

  let body;
  try {
    body = parseBody(req);
    const action = String(body.action || '');
    if (!['list', 'prepare-save', 'complete-save', 'prepare-open'].includes(action)) {
      return send(res, 400, { error: 'Unsupported cloud workspace action.', code: 'INVALID_ACTION' });
    }
    if (action === 'list') {
      const result = await listProjects(config, user.id);
      return send(res, 200, result);
    }

    const r2 = readR2Config();
    if (!r2) return send(res, 503, {
      error: 'Cloud object storage is not connected yet. Enable R2 and configure its server-side credentials.',
      code: 'CLOUD_STORAGE_NOT_CONFIGURED'
    });

    if (action === 'prepare-save') {
      return send(res, 200, await prepareSave(config, r2, user.id, body));
    }
    if (action === 'complete-save') {
      return send(res, 200, await completeSave(config, r2, user.id, body));
    }
    return send(res, 200, await prepareOpen(config, r2, user.id, body));
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 503;
    const code = error?.code || 'CLOUD_WORKSPACE_ERROR';
    if (status >= 500) console.error('Cloud workspace request failed:', code);
    return send(res, status, { error: error?.message || 'Cloud workspace request failed.', code });
  }
};

module.exports.readR2Config = readR2Config;
module.exports.objectKeyFor = objectKeyFor;
