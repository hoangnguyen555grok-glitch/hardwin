# Goal 8 — Part 2: Cloud Model Router

Status: backend router implementation added on branch \`goal8-cloud-ai-cleanup\`. Not deployed or enabled for browser clients.

## Design

- Vercel Node serverless endpoint: \`POST /api/ai/chat\`.
- Provider keys and model IDs are read only from server-side environment variables.
- Supported adapters: OpenAI-compatible chat completions (OpenAI, xAI, DeepSeek, Qwen, GLM), Anthropic Messages API, and Gemini generateContent API.
- Task classifier routes general, coding, reasoning, and creative text requests through independently configurable provider order. The initial fallback preference is DeepSeek → Qwen → GLM → Gemini → xAI → OpenAI → Anthropic, a cost-conscious starting order rather than a promise about live prices. Set explicit provider orders after comparing the exact models enabled on each account.
- Automatic failover proceeds to the next configured provider after a provider error, quota/rate limit, timeout, or service failure. No same-provider retry loop is used.
- Request validation limits the conversation to 30 plain-text messages, 12,000 characters per message, and 50,000 characters total. Output tokens have a server-side ceiling controlled by `GEED_AI_MAX_OUTPUT_TOKENS` (default 1,200; allowed range 64–4,096); clients cannot raise that ceiling.
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
- A provider timeout can be ambiguous: the provider may have completed generation even if the response was lost. The router now stops on an ambiguous timeout and returns HTTP 504 with `retryable: false`, rather than calling another provider and risking a second billable generation. Quota/rate-limit and other explicit provider failures still fall through to the next configured provider.
- Free tiers, rate limits, model availability, regions, and pricing are controlled by each provider and may change.
- Configure conservative provider order and output limits; monitor provider usage in each provider console.

## Verification

Run tests with Node.js 18 or newer:

\`\`\`sh
node --test tests/ai-router.test.js
\`\`\`

This phase adds the routing backend only. It does not yet add the chatbot's agent/tool loop or project memory.


## API protocol references

- xAI Chat Completions: https://docs.x.ai/developers/rest-api-reference/inference/chat-completions
- DeepSeek Chat Completions: https://api-docs.deepseek.com/api/create-chat-completion/
- Gemini `generateContent` and `x-goog-api-key` header: https://ai.google.dev/api/generate-content
- Anthropic Messages API: https://docs.anthropic.com/en/api/messages
- OpenAI Chat Completions: https://platform.openai.com/docs/api-reference/chat


## Owner-protection hardening added on the branch

- `GEED_AI_MAX_OUTPUT_TOKENS` enforces a server-side maximum generation size. A browser/client request can ask for fewer tokens, but cannot raise the configured cap.
- An ambiguous upstream timeout stops failover. This deliberately favors avoiding a possible duplicate charge over silently retrying the same user request through another paid provider.
- This does **not** implement customer accounts, subscriptions, per-user quotas, or payment collection. Those require a verified identity/session and durable server-side usage ledger. The current static editor has no such authentication layer, so the AI endpoint remains unavailable to browser clients and must stay fail-closed.
- Do not mistake IP-only throttling or a shared browser token for licensing: both can be bypassed or copied. Before public AI access, add real user authentication, server-side entitlement checks, per-account and per-operation quotas, idempotency/abuse controls, usage ledger, and a global emergency spend switch. Keep provider credentials exclusively on the server.
