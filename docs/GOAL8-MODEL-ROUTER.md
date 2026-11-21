# Goal 8 — Part 2: Cloud Model Router

Status: backend router implementation added on branch \`goal8-cloud-ai-cleanup\`. Not deployed or enabled for browser clients.

## Design

- Vercel Node serverless endpoint: \`POST /api/ai/chat\`.
- Provider keys and model IDs are read only from server-side environment variables.
- Supported adapters: OpenAI-compatible chat completions (OpenAI, xAI, DeepSeek, Qwen, GLM), Anthropic Messages API, and Gemini generateContent API.
- Task classifier routes general, coding, reasoning, and creative requests through independently configurable provider order.
- Automatic failover proceeds to the next configured provider after a provider error, quota/rate limit, timeout, or service failure. No same-provider retry loop is used.
- Request validation limits the conversation to 30 plain-text messages, 12,000 characters per message, 50,000 characters total, and 4,096 output tokens.
- Responses disclose the selected provider/model and sanitized attempt outcomes; provider API keys and raw provider error text are never returned.
- Provider model IDs are intentionally supplied by environment variables instead of assuming that a particular model name is enabled on the user's account.

## Required server-side environment variables

For each provider enabled, set both its API key and model ID:

| Provider | API key variable | Model ID variable |
|---|---|---|
| OpenAI | \`GEED_AI_OPENAI_API_KEY\` | \`GEED_AI_OPENAI_MODEL\` |
| Anthropic | \`GEED_AI_ANTHROPIC_API_KEY\` | \`GEED_AI_ANTHROPIC_MODEL\` |
| Gemini | \`GEED_AI_GEMINI_API_KEY\` | \`GEED_AI_GEMINI_MODEL\` |
| xAI | \`GEED_AI_XAI_API_KEY\` | \`GEED_AI_XAI_MODEL\` |
| DeepSeek | \`GEED_AI_DEEPSEEK_API_KEY\` | \`GEED_AI_DEEPSEEK_MODEL\` |
| Qwen | \`GEED_AI_QWEN_API_KEY\` | \`GEED_AI_QWEN_MODEL\` |
| GLM | \`GEED_AI_GLM_API_KEY\` | \`GEED_AI_GLM_MODEL\` |

Optional server-side routing controls:

- \`GEED_AI_PROVIDER_ORDER\`: comma-separated default order.
- \`GEED_AI_PROVIDER_ORDER_CODING\`, \`_REASONING\`, \`_CREATIVE\`, \`_GENERAL\`: task-specific provider order.
- \`GEED_AI_<PROVIDER>_BASE_URL\`: override an API base URL if the provider uses a different region/endpoint.
- \`GEED_AI_TIMEOUT_MS\`: request timeout (1,000–60,000 ms).

## Security gate — deliberately fail closed

The current editor is a static frontend and has no verified user-authentication/session system. A public AI endpoint with provider keys would be vulnerable to unauthorized use and unexpected bills. Therefore \`/api/ai/chat\` returns HTTP 503 unless \`GEED_AI_GATEWAY_TOKEN\` is configured, and then requires a matching Bearer token.

**Do not place \`GEED_AI_GATEWAY_TOKEN\` in \`index.html\`, browser JavaScript, local storage, or any public client.** The endpoint is intended for server-to-server integration after a real authenticated session is added. Merely enabling the token does not make it safe to embed in the frontend.

No provider API keys have been supplied, no paid provider has been activated, and no deployment has been made as part of this change.

## Cost and failover caveats

- Failover is attempted only among providers with both a configured key and model ID.
- A provider timeout can be ambiguous: the provider may have completed generation even if the response was lost. Falling back may therefore create a second billable request. The router does not retry the same provider.
- Free tiers, rate limits, model availability, regions, and pricing are controlled by each provider and may change.
- Configure conservative provider order and output limits; monitor provider usage in each provider console.

## Verification

Run tests with Node.js 18 or newer:

\`\`\`sh
node --test tests/ai-router.test.js
\`\`\`

This phase adds the routing backend only. It does not yet add the chatbot's agent/tool loop or project memory.
