'use strict';

const { routeChat, normalizeMessages, configuredProviders, resolveMaxTokens, classifyTask } = require('../../lib/ai-router');
const { AGENT_SYSTEM_PROMPT, parseAgentOutput } = require('../../lib/ai-agent');
const {
  readConfig,
  getBearerToken,
  verifySupabaseUser,
  callSupabaseRpc,
  estimateInputTokens,
  estimateReservationTokens,
  deriveUsage,
  estimateProviderCost,
  createRequestId
} = require('../../lib/supabase-ai-gateway');

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

async function finalizeUsage(config, userId, requestId, data) {
  return callSupabaseRpc({
    config,
    functionName: 'geed_finalize_ai_request',
    payload: {
      p_user_id: userId,
      p_request_id: requestId,
      p_provider: data.provider || 'router',
      p_model: data.model || 'unavailable',
      p_task_type: data.taskType || 'general',
      p_input_tokens: data.inputTokens || 0,
      p_output_tokens: data.outputTokens || 0,
      p_actual_cost_usd: null,
      p_estimated_cost_usd: data.estimatedCost,
      p_cost_status: data.estimatedCost === null ? 'unknown' : 'estimated',
      p_outcome: data.outcome || 'success'
    }
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }

  const config = readConfig();
  if (!config) {
    return send(res, 503, {
      error: 'AI service is not configured. Contact the project owner.',
      code: 'AI_ACCOUNT_SERVICE_NOT_CONFIGURED'
    });
  }

  const token = getBearerToken(req);
  if (!token) return send(res, 401, { error: 'Sign in with Google to use AI.', code: 'AUTH_REQUIRED' });

  let user;
  try {
    user = await verifySupabaseUser({ token, config });
  } catch {
    return send(res, 503, { error: 'Account verification is temporarily unavailable.', code: 'AUTH_SERVICE_UNAVAILABLE' });
  }
  if (!user) return send(res, 401, { error: 'Your session is invalid or expired. Sign in again.', code: 'INVALID_SESSION' });

  let messages;
  let body;
  try {
    body = req.body && typeof req.body === 'object'
      ? req.body
      : (typeof req.body === 'string' ? JSON.parse(req.body) : {});
    const normalized = normalizeMessages(body.messages);
    if (body.mode !== undefined && body.mode !== 'chat' && body.mode !== 'agent') {
      return send(res, 400, { error: 'Unsupported AI mode.', code: 'INVALID_MODE' });
    }
    if (body.mode === 'agent') {
      const conversation = normalized.filter(message => message.role !== 'system').slice(-29);
      if (!conversation.some(message => message.role === 'user')) {
        return send(res, 400, { error: 'Agent mode requires a user message.', code: 'INVALID_AGENT_CONVERSATION' });
      }
      messages = [{ role: 'system', content: AGENT_SYSTEM_PROMPT }, ...conversation];
    } else {
      messages = normalized;
    }
  } catch (error) {
    return send(res, 400, { error: error.message || 'Invalid request' });
  }

  if (configuredProviders().length === 0) {
    return send(res, 503, { error: 'No AI provider is configured on the server.', code: 'NO_PROVIDER' });
  }

  const agentMode = body.mode === 'agent';
  const requestedMaxTokens = body.max_tokens === undefined ? (agentMode ? 512 : undefined) : body.max_tokens;
  const maxTokens = resolveMaxTokens(requestedMaxTokens);
  const reservedTokens = estimateReservationTokens(messages, maxTokens);
  const requestId = createRequestId();

  let reservation;
  try {
    reservation = reservationObject(await callSupabaseRpc({
      config,
      functionName: 'geed_reserve_ai_request',
      payload: {
        p_user_id: user.id,
        p_request_id: requestId,
        p_reserved_tokens: reservedTokens
      }
    }));
  } catch {
    return send(res, 503, { error: 'AI quota service is temporarily unavailable. No model request was sent.', code: 'QUOTA_SERVICE_UNAVAILABLE' });
  }

  if (reservation.allowed !== true) {
    const code = reservation.code || 'AI_NOT_ALLOWED';
    const status = ['REQUEST_QUOTA_EXCEEDED', 'TOKEN_QUOTA_EXCEEDED'].includes(code) ? 429
      : code === 'DUPLICATE_REQUEST' ? 409
      : 403;
    return send(res, status, {
      error: code === 'AI_DISABLED' || code === 'QUOTA_NOT_CONFIGURED'
        ? 'AI is not enabled for this account yet.'
        : code === 'REQUEST_QUOTA_EXCEEDED' || code === 'TOKEN_QUOTA_EXCEEDED'
          ? 'Your monthly AI allowance has been reached.'
          : 'Your account is not currently allowed to use AI.',
      code,
      quota: reservation
    });
  }

  const taskType = classifyTask(messages);
  let result;
  try {
    result = await routeChat({ messages, maxTokens });
  } catch (error) {
    const attempts = Array.isArray(error.attempts) ? error.attempts : [];
    const firstProvider = attempts[0]?.provider || 'router';
    const outcome = error.code === 'UPSTREAM_TIMEOUT_UNCERTAIN' ? 'uncertain' : 'provider_error';
    let usageRecorded = false;
    try {
      const saved = await finalizeUsage(config, user.id, requestId, {
        provider: firstProvider,
        model: 'unavailable',
        taskType,
        inputTokens: estimateInputTokens(messages),
        // When a provider timeout is ambiguous, charge the full reserved output allowance
        // to the account's token quota. The actual provider charge remains unknown.
        outputTokens: outcome === 'uncertain' ? maxTokens : 0,
        estimatedCost: null,
        outcome
      });
      usageRecorded = saved === true;
    } catch { /* keep the reservation until its ten-minute expiry if persistence is unavailable */ }

    if (error.code === 'NO_PROVIDER') return send(res, 503, { error: error.message, code: error.code, usage_recorded: usageRecorded });
    if (error.code === 'UPSTREAM_TIMEOUT_UNCERTAIN') {
      return send(res, 504, { error: error.message, attempts, retryable: false, usage_recorded: usageRecorded });
    }
    return send(res, 502, { error: error.message || 'All configured AI providers failed.', attempts, usage_recorded: usageRecorded });
  }

  const usage = deriveUsage({ usage: result.usage, messages, content: result.content });
  const estimatedCost = estimateProviderCost({
    model: result.model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens
  });
  let usageRecorded = false;
  try {
    const saved = await finalizeUsage(config, user.id, requestId, {
      provider: result.provider,
      model: result.model,
      taskType: result.taskType,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      estimatedCost,
      outcome: 'success'
    });
    usageRecorded = saved === true;
  } catch { /* return the completed generation but make the missing ledger write explicit */ }

  const agent = agentMode ? parseAgentOutput(result.content) : null;

  return send(res, 200, {
    ...result,
    ...(agentMode ? { agent: agent.data, agent_format_valid: agent.formatValid } : {}),
    usage: {
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      source: usage.usageSource,
      estimated_cost_usd: estimatedCost,
      cost_status: estimatedCost === null ? 'unknown' : 'estimated'
    },
    usage_recorded: usageRecorded,
    ...(usageRecorded ? {} : { warning: 'Generation completed, but the usage ledger could not be updated. Do not automatically retry this request.' }),
    request_id: requestId,
    quota: reservation
  });
};
