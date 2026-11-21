'use strict';

const {
  readConfig,
  getBearerToken,
  requestJson,
  verifySupabaseUser,
  callSupabaseRpc,
  createRequestId
} = require('../../lib/supabase-ai-gateway');

const PROVIDER = 'cloudflare';
const MODEL = '@cf/black-forest-labs/flux-1-schnell';
const MAX_PROMPT_LENGTH = 2048;
const MAX_IMAGE_BASE64_LENGTH = 16 * 1024 * 1024;

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('vary', 'Authorization');
  res.end(JSON.stringify(payload));
}

function reservationObject(value) {
  if (Array.isArray(value)) return value[0] || {};
  return value && typeof value === 'object' ? value : {};
}

function imageConfig(env = process.env) {
  if (env.GEED_AI_CLOUDFLARE_IMAGE_ENABLED !== 'true' ||
      env.GEED_AI_CLOUDFLARE_FREE_TIER_CONFIRMED !== 'true' ||
      env.GEED_AI_CLOUDFLARE_BILLING_DISABLED !== 'true') return null;

  const apiKey = env.GEED_AI_CLOUDFLARE_API_KEY || '';
  const accountId = env.GEED_AI_CLOUDFLARE_ACCOUNT_ID || '';
  if (!apiKey || !/^[a-f0-9]{32}$/i.test(accountId)) return null;

  return {
    apiKey,
    accountId,
    url: 'https://api.cloudflare.com/client/v4/accounts/' + accountId + '/ai/run/' + MODEL
  };
}

function normalizePrompt(value) {
  if (typeof value !== 'string') throw new TypeError('Enter a text description for the image.');
  const prompt = value.trim();
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
    throw new TypeError('Image description must contain 1–2,048 characters.');
  }
  return prompt;
}

function decodeImage(base64) {
  if (typeof base64 !== 'string' || !base64 || base64.length > MAX_IMAGE_BASE64_LENGTH) return null;
  const normalized = base64.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized) || normalized.length % 4 !== 0) return null;
  const bytes = Buffer.from(normalized, 'base64');
  if (!bytes.length || bytes.length > 12 * 1024 * 1024) return null;

  let mime = null;
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) mime = 'image/jpeg';
  else if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) mime = 'image/png';
  else if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') mime = 'image/webp';
  if (!mime) return null;
  return { mime, dataUrl: 'data:' + mime + ';base64,' + normalized, bytes: bytes.length };
}

async function finalizeUsage(config, userId, requestId, outcome) {
  return callSupabaseRpc({
    config,
    functionName: 'geed_finalize_ai_request',
    payload: {
      p_user_id: userId,
      p_request_id: requestId,
      p_provider: PROVIDER,
      p_model: MODEL,
      p_task_type: 'creative',
      p_input_tokens: 0,
      p_output_tokens: 0,
      p_actual_cost_usd: null,
      p_estimated_cost_usd: null,
      p_cost_status: 'unknown',
      p_outcome: outcome
    }
  });
}

async function recordOutcome(config, userId, requestId, outcome) {
  try { return await finalizeUsage(config, userId, requestId, outcome) === true; }
  catch { return false; }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }

  const supabaseConfig = readConfig();
  if (!supabaseConfig) {
    return send(res, 503, { error: 'Account service is not configured.', code: 'AI_ACCOUNT_SERVICE_NOT_CONFIGURED' });
  }

  const token = getBearerToken(req);
  if (!token) return send(res, 401, { error: 'Sign in with Google to generate images.', code: 'AUTH_REQUIRED' });

  let user;
  try { user = await verifySupabaseUser({ token, config: supabaseConfig }); }
  catch {
    return send(res, 503, { error: 'Account verification is temporarily unavailable.', code: 'AUTH_SERVICE_UNAVAILABLE' });
  }
  if (!user) return send(res, 401, { error: 'Your session is invalid or expired. Sign in again.', code: 'INVALID_SESSION' });

  let prompt;
  try {
    const body = req.body && typeof req.body === 'object'
      ? req.body
      : (typeof req.body === 'string' ? JSON.parse(req.body) : {});
    prompt = normalizePrompt(body.prompt);
  } catch (error) {
    return send(res, 400, { error: error.message || 'Invalid image request.', code: 'INVALID_IMAGE_REQUEST' });
  }

  const provider = imageConfig();
  if (!provider) {
    return send(res, 503, {
      error: 'Image generation is not enabled. The owner must configure the Cloudflare Free account and billing lock first.',
      code: 'IMAGE_PROVIDER_NOT_CONFIGURED'
    });
  }

  const requestId = createRequestId();
  let reservation;
  try {
    reservation = reservationObject(await callSupabaseRpc({
      config: supabaseConfig,
      functionName: 'geed_reserve_ai_request',
      payload: { p_user_id: user.id, p_request_id: requestId, p_reserved_tokens: 1 }
    }));
  } catch {
    return send(res, 503, {
      error: 'AI quota service is temporarily unavailable. No image request was sent.',
      code: 'QUOTA_SERVICE_UNAVAILABLE'
    });
  }

  if (reservation.allowed !== true) {
    const code = reservation.code || 'AI_NOT_ALLOWED';
    const status = ['REQUEST_QUOTA_EXCEEDED', 'TOKEN_QUOTA_EXCEEDED'].includes(code) ? 429
      : code === 'DUPLICATE_REQUEST' ? 409 : 403;
    return send(res, status, {
      error: code === 'AI_DISABLED' || code === 'QUOTA_NOT_CONFIGURED'
        ? 'Image generation is not enabled for this account yet.'
        : code === 'REQUEST_QUOTA_EXCEEDED' || code === 'TOKEN_QUOTA_EXCEEDED'
          ? 'Your monthly AI request allowance has been reached.'
          : 'Your account is not currently allowed to generate images.',
      code,
      quota: reservation
    });
  }

  let upstream;
  try {
    upstream = await requestJson(globalThis.fetch, provider.url, {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + provider.apiKey,
        'content-type': 'application/json',
        accept: 'application/json'
      },
      body: JSON.stringify({ prompt, steps: 4 })
    }, 60000);
  } catch {
    const usageRecorded = await recordOutcome(supabaseConfig, user.id, requestId, 'uncertain');
    return send(res, 504, {
      error: 'Image generation timed out or the connection ended unexpectedly. The provider may have processed the request, so it will not be retried automatically.',
      code: 'IMAGE_PROVIDER_TIMEOUT_UNCERTAIN',
      retryable: false,
      usage_recorded: usageRecorded,
      request_id: requestId
    });
  }

  if (!upstream.ok || upstream.data?.success === false) {
    const usageRecorded = await recordOutcome(supabaseConfig, user.id, requestId, 'provider_error');
    const status = upstream.status === 429 ? 429 : upstream.status === 403 ? 503 : 502;
    const message = upstream.status === 429
      ? 'Cloudflare Free quota or rate limit has been reached. No paid upgrade or fallback was attempted.'
      : upstream.status === 403
        ? 'Cloudflare did not allow this model on the configured plan. No paid plan was activated.'
        : 'Cloudflare image generation failed. No other or paid provider was called.';
    return send(res, status, {
      error: message,
      code: upstream.status === 429 ? 'IMAGE_FREE_QUOTA_EXCEEDED'
        : upstream.status === 403 ? 'IMAGE_FREE_MODEL_UNAVAILABLE' : 'IMAGE_PROVIDER_FAILED',
      usage_recorded: usageRecorded,
      request_id: requestId
    });
  }

  const image = decodeImage(upstream.data?.result?.image || upstream.data?.image);
  if (!image) {
    const usageRecorded = await recordOutcome(supabaseConfig, user.id, requestId, 'provider_error');
    return send(res, 502, {
      error: 'The image provider returned an unsupported or invalid image. Nothing was added to your project.',
      code: 'INVALID_IMAGE_RESPONSE',
      usage_recorded: usageRecorded,
      request_id: requestId
    });
  }

  const usageRecorded = await recordOutcome(supabaseConfig, user.id, requestId, 'success');
  return send(res, 200, {
    image: image.dataUrl,
    image_type: image.mime,
    image_bytes: image.bytes,
    provider: PROVIDER,
    model: MODEL,
    usage: { cost_status: 'unknown', input_tokens: 0, output_tokens: 0 },
    usage_recorded: usageRecorded,
    ...(usageRecorded ? {} : { warning: 'Image generation completed, but the account usage ledger could not be updated. Do not automatically retry.' }),
    request_id: requestId,
    quota: reservation
  });
};

module.exports.config = { maxDuration: 60 };
