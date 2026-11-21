'use strict';

const PROVIDERS = {
  openrouter: { key: 'GEED_AI_OPENROUTER_API_KEY', model: 'GEED_AI_OPENROUTER_MODEL', base: 'https://openrouter.ai/api/v1', kind: 'openai' },
  groq: { key: 'GEED_AI_GROQ_API_KEY', model: 'GEED_AI_GROQ_MODEL', base: 'https://api.groq.com/openai/v1', kind: 'openai' },
  cloudflare: { key: 'GEED_AI_CLOUDFLARE_API_KEY', model: 'GEED_AI_CLOUDFLARE_MODEL', base: '', kind: 'openai' },
  openai: { key: 'GEED_AI_OPENAI_API_KEY', model: 'GEED_AI_OPENAI_MODEL', base: 'https://api.openai.com/v1', kind: 'openai' },
  xai: { key: 'GEED_AI_XAI_API_KEY', model: 'GEED_AI_XAI_MODEL', base: 'https://api.x.ai/v1', kind: 'openai' },
  deepseek: { key: 'GEED_AI_DEEPSEEK_API_KEY', model: 'GEED_AI_DEEPSEEK_MODEL', base: 'https://api.deepseek.com', kind: 'openai' },
  qwen: { key: 'GEED_AI_QWEN_API_KEY', model: 'GEED_AI_QWEN_MODEL', base: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', kind: 'openai' },
  glm: { key: 'GEED_AI_GLM_API_KEY', model: 'GEED_AI_GLM_MODEL', base: 'https://open.bigmodel.cn/api/paas/v4', kind: 'openai' },
  anthropic: { key: 'GEED_AI_ANTHROPIC_API_KEY', model: 'GEED_AI_ANTHROPIC_MODEL', base: 'https://api.anthropic.com/v1', kind: 'anthropic' },
  gemini: { key: 'GEED_AI_GEMINI_API_KEY', model: 'GEED_AI_GEMINI_MODEL', base: 'https://generativelanguage.googleapis.com/v1beta', kind: 'gemini' }
};

const ALLOWED_ROLES = new Set(['system', 'user', 'assistant']);
const MAX_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 12000;
const MAX_TOTAL_CHARS = 50000;
const DEFAULT_TIMEOUT_MS = 25000;

function classifyTask(messages) {
  const text = messages.filter(m => m.role === 'user').map(m => m.content).join('\n').toLowerCase();
  if (/(debug|bug|code|javascript|typescript|python|html|css|api|function|lỗi|sửa mã|viết mã|lập trình)/i.test(text)) return 'coding';
  if (/(phân tích|lập kế hoạch|kiến trúc|so sánh|suy luận|logic|chiến lược|reason|analy[sz]e|architecture|plan)/i.test(text)) return 'reasoning';
  if (/(vẽ|thiết kế|ý tưởng|kịch bản|nhân vật|hoạt cảnh|sáng tạo|story|creative|design)/i.test(text)) return 'creative';
  return 'general';
}

function normalizeMessages(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_MESSAGES) {
    throw new Error('messages must contain between 1 and 30 items');
  }
  let total = 0;
  const messages = input.map((item) => {
    if (!item || !ALLOWED_ROLES.has(item.role) || typeof item.content !== 'string') {
      throw new Error('Each message must have an allowed role and plain-text content');
    }
    const content = item.content.trim();
    if (!content || content.length > MAX_MESSAGE_CHARS) throw new Error('Each message must contain 1–12000 characters');
    total += content.length;
    return { role: item.role, content };
  });
  if (total > MAX_TOTAL_CHARS) throw new Error('Conversation is too long');
  if (!messages.some(m => m.role === 'user')) throw new Error('At least one user message is required');
  return messages;
}

function configuredProviders(env = process.env) {
  return Object.entries(PROVIDERS).filter(([name, spec]) => {
    if (!env[spec.key] || !env[spec.model]) return false;
    if (name === 'openrouter') {
      return env[spec.model] === 'openrouter/free' || /:free$/.test(env[spec.model]);
    }
    if (name === 'groq') return env.GEED_AI_GROQ_FREE_TIER_CONFIRMED === 'true';
    if (name === 'cloudflare') {
      return env.GEED_AI_CLOUDFLARE_FREE_TIER_CONFIRMED === 'true' &&
        Boolean(env.GEED_AI_CLOUDFLARE_BASE_URL);
    }
    return env.GEED_AI_ALLOW_PAID_PROVIDERS === 'true';
  }).map(([name]) => name);
}

function providerOrder(taskType, env = process.env) {
  const specific = env['GEED_AI_PROVIDER_ORDER_' + taskType.toUpperCase()];
  const raw = specific || env.GEED_AI_PROVIDER_ORDER || 'openrouter,groq,cloudflare';
  const available = new Set(configuredProviders(env));
  return [...new Set(raw.split(',').map(v => v.trim().toLowerCase())
    .filter(v => v && PROVIDERS[v] && available.has(v)))];
}

function resolveMaxTokens(requested, env = process.env) {
  const configured = Number(env.GEED_AI_MAX_OUTPUT_TOKENS || 1200);
  const serverCap = Number.isFinite(configured) ? Math.min(4096, Math.max(64, Math.floor(configured))) : 1200;
  const wanted = Number(requested || serverCap);
  const requestedCap = Number.isFinite(wanted) ? Math.min(4096, Math.max(64, Math.floor(wanted))) : serverCap;
  return Math.min(serverCap, requestedCap);
}

function extractOpenAIText(data) {
  const value = data?.choices?.[0]?.message?.content;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(part => part?.text || '').join('');
  return '';
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAICompatible(name, spec, messages, env, fetchImpl, timeoutMs, maxTokens) {
  const baseUrl = env['GEED_AI_' + name.toUpperCase() + '_BASE_URL'] || spec.base;
  if (!baseUrl) throw new Error(name + ' base URL is not configured');
  const base = baseUrl.replace(/\/+$/, '');
  const response = await fetchWithTimeout(fetchImpl, base + '/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env[spec.key] },
    body: JSON.stringify({ model: env[spec.model], messages, max_tokens: maxTokens, temperature: 0.4, stream: false })
  }, timeoutMs);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw providerError(name, response.status, data);
  const content = extractOpenAIText(data);
  if (!content) throw new Error(name + ' returned an empty response');
  return { content, usage: data.usage || null, model: data.model || env[spec.model] };
}

async function callAnthropic(spec, messages, env, fetchImpl, timeoutMs, maxTokens) {
  const base = (env.GEED_AI_ANTHROPIC_BASE_URL || spec.base).replace(/\/+$/, '');
  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
  const conversation = messages.filter(m => m.role !== 'system');
  const response = await fetchWithTimeout(fetchImpl, base + '/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env[spec.key], 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: env[spec.model], max_tokens: maxTokens, ...(system ? { system } : {}), messages: conversation })
  }, timeoutMs);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw providerError('anthropic', response.status, data);
  const content = (data.content || []).filter(x => x.type === 'text').map(x => x.text).join('');
  if (!content) throw new Error('anthropic returned an empty response');
  return { content, usage: data.usage || null, model: data.model || env[spec.model] };
}

async function callGemini(spec, messages, env, fetchImpl, timeoutMs, maxTokens) {
  const base = (env.GEED_AI_GEMINI_BASE_URL || spec.base).replace(/\/+$/, '');
  const model = encodeURIComponent(env[spec.model]);
  const url = base + '/models/' + model + ':generateContent';
  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
  const contents = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
  const response = await fetchWithTimeout(fetchImpl, url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env[spec.key] },
    body: JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents,
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4 }
    })
  }, timeoutMs);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw providerError('gemini', response.status, data);
  const content = (data.candidates?.[0]?.content?.parts || []).map(x => x.text || '').join('');
  if (!content) throw new Error('gemini returned an empty response');
  return { content, usage: data.usageMetadata || null, model: env[spec.model] };
}

function providerError(name, status, data) {
  const error = new Error(name + ' request failed with HTTP ' + status);
  error.provider = name;
  error.status = status;
  error.providerMessage = String(data?.error?.message || data?.message || '').slice(0, 300);
  return error;
}

async function callProvider(name, messages, env, fetchImpl, timeoutMs, maxTokens) {
  const spec = PROVIDERS[name];
  if (spec.kind === 'anthropic') return callAnthropic(spec, messages, env, fetchImpl, timeoutMs, maxTokens);
  if (spec.kind === 'gemini') return callGemini(spec, messages, env, fetchImpl, timeoutMs, maxTokens);
  return callOpenAICompatible(name, spec, messages, env, fetchImpl, timeoutMs, maxTokens);
}

async function routeChat(options = {}) {
  const env = options.env || process.env;
  const messages = normalizeMessages(options.messages);
  const taskType = classifyTask(messages);
  const order = providerOrder(taskType, env);
  if (!order.length) {
    const error = new Error('No AI provider is configured. Add a provider API key and model ID in server-side environment variables.');
    error.code = 'NO_PROVIDER';
    throw error;
  }
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = Math.min(60000, Math.max(1000, Number(options.timeoutMs || env.GEED_AI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)));
  const maxTokens = resolveMaxTokens(options.maxTokens, env);
  const attempts = [];
  for (const name of order) {
    try {
      const result = await callProvider(name, messages, env, fetchImpl, timeoutMs, maxTokens);
      return {
        ok: true,
        content: result.content,
        provider: name,
        model: result.model,
        taskType,
        attempts: attempts.concat([{ provider: name, outcome: 'success' }]),
        usage: result.usage
      };
    } catch (error) {
      const timedOut = error.name === 'AbortError';
      attempts.push({
        provider: name,
        outcome: timedOut ? 'uncertain_timeout' : 'failed',
        status: Number.isInteger(error.status) ? error.status : null,
        reason: timedOut ? 'timeout_ambiguous_billing' : 'provider_error'
      });
      // A timeout is ambiguous: the provider may already have completed and billed
      // the generation. Stop here rather than risk a second paid fallback request.
      if (timedOut) {
        const timeoutError = new Error('AI provider timed out; automatic fallback was stopped to avoid a possible duplicate charge.');
        timeoutError.code = 'UPSTREAM_TIMEOUT_UNCERTAIN';
        timeoutError.attempts = attempts;
        throw timeoutError;
      }
    }
  }
  const error = new Error('All configured AI providers failed. Check provider keys, model IDs, quotas and service status.');
  error.code = 'ALL_PROVIDERS_FAILED';
  error.attempts = attempts;
  throw error;
}

module.exports = { PROVIDERS, classifyTask, normalizeMessages, configuredProviders, providerOrder, resolveMaxTokens, routeChat };
