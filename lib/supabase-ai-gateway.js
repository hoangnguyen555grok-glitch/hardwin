'use strict';

const { randomUUID } = require('node:crypto');

function readConfig(env = process.env) {
  const url = String(env.GEED_SUPABASE_URL || '').replace(/\/+$/, '');
  const publishableKey = env.GEED_SUPABASE_PUBLISHABLE_KEY || '';
  const serviceRoleKey = env.GEED_SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !publishableKey || !serviceRoleKey) return null;
  return { url, publishableKey, serviceRoleKey };
}

function getBearerToken(req) {
  const header = req?.headers?.authorization || req?.headers?.Authorization || '';
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token && !/\s/.test(token) ? token : null;
}

async function requestJson(fetchImpl, url, options, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...options, signal: controller.signal });
    const data = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timer);
  }
}

async function verifySupabaseUser({ token, config, fetchImpl = globalThis.fetch }) {
  if (!token || !config) return null;
  const result = await requestJson(fetchImpl, config.url + '/auth/v1/user', {
    method: 'GET',
    headers: {
      apikey: config.publishableKey,
      authorization: 'Bearer ' + token,
      accept: 'application/json'
    }
  });
  if (!result.ok || !result.data || typeof result.data.id !== 'string') return null;
  return { id: result.data.id, email: typeof result.data.email === 'string' ? result.data.email : null };
}

async function callSupabaseRpc({ config, functionName, payload, fetchImpl = globalThis.fetch }) {
  const result = await requestJson(fetchImpl, config.url + '/rest/v1/rpc/' + functionName, {
    method: 'POST',
    headers: {
      apikey: config.serviceRoleKey,
      authorization: 'Bearer ' + config.serviceRoleKey,
      'content-type': 'application/json',
      accept: 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!result.ok) {
    const error = new Error('Supabase account service rejected the request.');
    error.code = 'SUPABASE_RPC_FAILED';
    error.status = result.status;
    throw error;
  }
  return result.data;
}

function estimateReservationTokens(messages, maxOutputTokens) {
  const chars = messages.reduce((sum, message) => sum + message.content.length, 0);
  const overhead = messages.length * 8;
  return Math.max(1, Math.min(100000, Math.ceil(chars / 3) + overhead + maxOutputTokens));
}

function firstFinite(source, keys) {
  for (const key of keys) {
    const value = Number(source?.[key]);
    if (Number.isFinite(value) && value >= 0) return Math.floor(value);
  }
  return null;
}

function deriveUsage({ usage, messages, content }) {
  const inputActual = firstFinite(usage, ['input_tokens', 'prompt_tokens', 'promptTokenCount']);
  const outputActual = firstFinite(usage, ['output_tokens', 'completion_tokens', 'candidatesTokenCount']);
  const inputTokens = inputActual ?? Math.ceil(messages.reduce((sum, message) => sum + message.content.length, 0) / 3);
  const outputTokens = outputActual ?? Math.ceil(String(content || '').length / 3);
  return {
    inputTokens,
    outputTokens,
    usageSource: inputActual === null || outputActual === null ? 'estimated' : 'provider'
  };
}

function estimateProviderCost({ model, inputTokens, outputTokens, env = process.env }) {
  const raw = env.GEED_AI_TOKEN_PRICES_JSON;
  if (!raw) return null;
  let priceMap;
  try { priceMap = JSON.parse(raw); } catch { return null; }
  const price = priceMap && priceMap[model];
  const inputRate = Number(price?.input_per_1m_usd);
  const outputRate = Number(price?.output_per_1m_usd);
  if (!Number.isFinite(inputRate) || inputRate < 0 ||
      !Number.isFinite(outputRate) || outputRate < 0) return null;
  const amount = (inputTokens * inputRate + outputTokens * outputRate) / 1000000;
  return Math.round(amount * 1e8) / 1e8;
}

function createRequestId() {
  return randomUUID();
}

module.exports = {
  readConfig,
  getBearerToken,
  requestJson,
  verifySupabaseUser,
  callSupabaseRpc,
  estimateReservationTokens,
  deriveUsage,
  estimateProviderCost,
  createRequestId
};
