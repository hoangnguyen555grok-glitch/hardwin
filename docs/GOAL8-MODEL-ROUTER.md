# Goal 8 — Community-first AI Routing

Status: community-first provider routing, Supabase session verification, account-level quota reservation/finalization, and the bounded Geed Hardwin editor-agent loop are implemented on `goal8-cloud-ai-cleanup`. The latest workflow run for the provider-selection changes passed all test and syntax-check steps. Live provider calls still require owner-configured provider credentials and free-tier confirmation flags.

## Core decision

Geed Hardwin should reuse community projects, hosted free APIs, and maintained SDKs wherever practical. Do not deploy another general-purpose AI gateway or self-host an LLM proxy unless a measured product requirement makes it necessary.

The existing Node.js adapter is deliberately small: it reuses the OpenAI-compatible HTTP protocol already supported by OpenRouter, Groq, and Cloudflare Workers AI. It is Geed Hardwin-specific glue for user authentication, quota enforcement, provider selection, and the animation-editor tool bridge — not a replacement for the community's AI infrastructure.

## Default free-first providers

The default order is:

1. **OpenRouter** — model `openrouter/free` or a specific model ending in `:free`. The dynamic `openrouter/free` route selects an eligible free model. Current documented free-model limits are 20 requests/minute and 50 requests/day. The higher daily limit requires buying credits, so this project must not buy credits just to raise the limit.
2. **Groq Free** — uses the OpenAI-compatible endpoint `https://api.groq.com/openai/v1`. It is included only after the owner explicitly confirms that the account is still on the Free tier with `GEED_AI_GROQ_FREE_TIER_CONFIRMED=true`.
3. **Cloudflare Workers AI Free** — uses the account-scoped OpenAI-compatible endpoint `https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1`. It is included only when `GEED_AI_CLOUDFLARE_FREE_TIER_CONFIRMED=true` and `GEED_AI_CLOUDFLARE_BASE_URL` is set. The Workers Free plan currently documents 10,000 Neurons/day; model availability and plan eligibility must be checked in the account before enabling it.

Free quotas, eligible models, regional availability, and provider terms can change. A free tier is not unlimited capacity and can be exhausted or rate-limited. The router may move to the next explicitly enabled free provider after a clear provider error or rate-limit response. An ambiguous network timeout stops the chain because the first provider may already have processed the request.

## Provider eligibility is intentionally restrictive

- OpenRouter accepts only `openrouter/free` or model IDs ending in `:free` by default. A paid OpenRouter model is rejected by the default eligibility check.
- Groq is not enabled until its Free-tier confirmation flag is set.
- Cloudflare is not enabled until its Free-plan confirmation flag and account-specific base URL are both present.
- Existing direct integrations for OpenAI, Anthropic, Gemini, xAI, DeepSeek, Qwen, and GLM are **disabled by default**. They require the explicit server-side switch `GEED_AI_ALLOW_PAID_PROVIDERS=true`.
- The configured provider order is an allow-list. The router no longer silently appends every configured provider. A provider key being present does not, by itself, authorize it as a fallback.
- No provider key or confirmation flag is embedded in browser code.

## Server environment variables

For OpenRouter:

| Variable | Value |
|---|---|
| `GEED_AI_OPENROUTER_API_KEY` | OpenRouter API key |
| `GEED_AI_OPENROUTER_MODEL` | `openrouter/free` or a model ID ending in `:free` |

For Groq Free:

| Variable | Value |
|---|---|
| `GEED_AI_GROQ_API_KEY` | Groq API key |
| `GEED_AI_GROQ_MODEL` | A model currently available to the account's Free tier |
| `GEED_AI_GROQ_FREE_TIER_CONFIRMED` | `true` only after confirming the account remains on Free |

For Cloudflare Workers AI Free:

| Variable | Value |
|---|---|
| `GEED_AI_CLOUDFLARE_API_KEY` | Cloudflare API token with the required Workers AI permission |
| `GEED_AI_CLOUDFLARE_MODEL` | Model ID available on the Free plan |
| `GEED_AI_CLOUDFLARE_BASE_URL` | `https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1` |
| `GEED_AI_CLOUDFLARE_FREE_TIER_CONFIRMED` | `true` only after confirming the account is on Workers Free |

Common routing controls:

- `GEED_AI_PROVIDER_ORDER`: explicit comma-separated provider allow-list and fallback order. Default: `openrouter,groq,cloudflare`.
- `GEED_AI_PROVIDER_ORDER_CODING`, `_REASONING`, `_CREATIVE`, `_GENERAL`: optional task-specific allow-lists.
- `GEED_AI_TIMEOUT_MS`: request timeout (1,000–60,000 ms).
- `GEED_AI_MAX_OUTPUT_TOKENS`: server-controlled response ceiling (64–4,096; default 1,200).
- `GEED_AI_TOKEN_PRICES_JSON`: optional exact per-model price table. When no exact rate exists, cost is recorded as unknown; the system must not assume zero.

Existing direct provider variables remain available only for an owner-approved paid configuration:

- `GEED_AI_ALLOW_PAID_PROVIDERS=true` is required before any direct provider such as OpenAI, Anthropic, Gemini, xAI, DeepSeek, Qwen, or GLM can be selected.
- Each enabled provider needs its own server-only API key and model ID.
- Do not enable this flag merely to make a provider fallback succeed.

## Authentication, quota, and safety

- Endpoint: `POST /api/ai/chat`.
- A valid Supabase Bearer session is verified server-side before processing the request.
- The account ID is derived from the verified session, not accepted from the browser.
- The server reserves per-account request/token quota before calling an AI provider and finalizes the usage record afterward.
- New accounts remain AI-disabled with zero AI quota until an owner-approved entitlement policy grants access.
- Provider credentials and the Supabase service-role key remain server-side only.
- Output tokens have a server-side ceiling; the client cannot raise it.
- Ambiguous provider timeouts are not retried through another provider, preventing a second possible billable generation.
- The animation agent uses a narrow editor-tool allow-list. Destructive operations require explicit user confirmation, and each action is checked against the next editor observation before success is reported.

## Why we are not adding another gateway stack right now

OpenRouter, Groq, and Cloudflare already expose compatible hosted inference endpoints. The existing adapter can call them directly without adding a persistent Python/Go service. LiteLLM and Bifrost are valuable community projects, but self-hosting either would add another service, deployment, and maintenance burden without solving a current need. The Vercel AI SDK is also a useful open-source option; it can be evaluated later if streaming, structured outputs, or more complex tool orchestration become a concrete requirement. Do not add dependencies just to duplicate the current working path.

## Operational rules

- Never assume free usage is unlimited or permanent.
- Never rotate identities or keys to bypass a provider's quotas.
- Keep provider fallback within the explicit allow-list.
- Prefer measured usage and actual provider dashboards over guesses.
- Do not activate paid providers, buy credits, upgrade plans, or enable paid storage without the owner's explicit approval.
- Do not put secrets in Git, logs, client JavaScript, local storage, or chat messages.

## Public project and service references

- OpenRouter free models: https://openrouter.ai/docs/guides/routing/routers/free-models
- OpenRouter rate limits: https://openrouter.ai/docs/api/reference/limits
- Groq API compatibility: https://console.groq.com/docs/openai
- Groq rate limits: https://console.groq.com/docs/rate-limits
- Cloudflare Workers AI pricing and Free plan limits: https://developers.cloudflare.com/workers-ai/platform/pricing/
- Cloudflare OpenAI-compatible endpoint: https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/
- Vercel AI SDK: https://github.com/vercel/ai
- LiteLLM: https://github.com/BerriAI/litellm
- Bifrost: https://github.com/maximhq/bifrost
