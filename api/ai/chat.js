'use strict';

const { routeChat, normalizeMessages } = require('../../lib/ai-router');

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }

  // Fail closed until Geed Hardwin has a real user-authentication/session layer.
  // This server-to-server token must never be embedded in index.html or browser storage.
  const gatewayToken = process.env.GEED_AI_GATEWAY_TOKEN;
  if (!gatewayToken) {
    return send(res, 503, { error: 'AI gateway is not enabled: configure server-side authentication first.' });
  }
  const auth = req.headers.authorization || '';
  const supplied = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(gatewayToken);
  if (!supplied || suppliedBytes.length !== expectedBytes.length ||
      !require('node:crypto').timingSafeEqual(suppliedBytes, expectedBytes)) {
    return send(res, 401, { error: 'Unauthorized' });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const messages = normalizeMessages(body.messages);
    const result = await routeChat({ messages, maxTokens: body.max_tokens });
    return send(res, 200, result);
  } catch (error) {
    if (error.code === 'NO_PROVIDER') return send(res, 503, { error: error.message });
    if (error.code === 'UPSTREAM_TIMEOUT_UNCERTAIN') {
      return send(res, 504, { error: error.message, attempts: error.attempts, retryable: false });
    }
    if (error.code === 'ALL_PROVIDERS_FAILED') {
      return send(res, 502, { error: error.message, attempts: error.attempts });
    }
    return send(res, 400, { error: error.message || 'Invalid request' });
  }
};
