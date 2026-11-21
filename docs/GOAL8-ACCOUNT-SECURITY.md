# Goal 8 — Account, entitlement and data protection

Status: Supabase schema, database-enforced Google-only account creation, server-side session verification, per-account AI request quotas, bounded AI Agent, opt-in AI memory, free-first text routing and the FLUX.1 Schnell image endpoint are implemented on `goal8-cloud-ai-cleanup`. The image route remains fail-closed until the owner adds Cloudflare server credentials and confirms the account is on Workers Free with no paid Workers plan. Google OAuth and provider credentials remain unconfigured in Preview.
Working branch: `goal8-cloud-ai-cleanup`
Supabase project: `geed-hardwin-auth` (`rdzitdoarrfjugzogkrf`), region `ap-southeast-1` (Singapore).
Project creation quote: USD 0/month on 2026-11-21. This quote does not guarantee that future provider API calls, storage or other services are free.

## Product rules

- The editor remains usable without signing in.
- Account sign-in is Google only. No email/password, Facebook or Apple sign-in flow is added.
- Free users keep animation project files and media in the browser/device. Existing IndexedDB autosave and JSON export/import remain in place.
- Supabase stores only account data, entitlements, AI usage measurements, limited AI memory and lightweight project metadata. It does not store animation binaries or media.
- Payments, paid plans, recurring billing and paid cloud file storage are not enabled in this phase.
- Every new account receives the `free` entitlement, AI disabled, zero AI request/token allowance and zero cloud-storage allowance. AI cannot call a provider until the owner explicitly configures quotas.
- AI-memory retention is restricted to 2, 3, 7 or 30 days. Expiration never deletes local project files or original media.

## Database tables and access controls

- `profiles`: user display name, avatar URL and locale. An Auth trigger creates the row when a user is created.
- `entitlements`: server-controlled plan/status, AI enablement and request/token/storage limits. Clients can read their own row but cannot change it.
- `usage_ledger`: provider/model, provider token usage, request outcome, estimated cost and actual cost (when an authoritative invoice value later becomes available). Clients can read their own rows; they cannot write or modify ledger entries. Unknown cost remains null and is never represented as zero.
- `ai_memories`: small text context only, with opt-in 2/3/7/30-day retention and expiry. The database sets the expiration timestamp, limits each account to 20 active memories, removes expired rows opportunistically and through a daily scheduled cleanup, and denies client updates. RLS limits every record to its owner.
- `project_metadata`: lightweight project name/summary/version only. Original project JSON, images, audio and exports stay local.

All five exposed public tables have RLS enabled. Policies use `auth.uid()` ownership checks. Internal trigger, cleanup and reservation tables/functions live in the non-exposed `private` schema. Quota reservation/finalization RPCs are executable only by the server `service_role`, never by `anon` or `authenticated`.

## Google OAuth owner setup

Google OAuth cannot be activated without a Client ID and Client Secret created by the project owner. Do not paste the Client Secret into chat, source control, browser storage or frontend code.

1. Open Google Cloud Console → Google Auth Platform → Clients and create an OAuth Client ID of type **Web application**.
2. Authorized JavaScript origins: `https://geed-hardwin.vercel.app` and `https://geed-hardwin-git-goal8-cloud-ai-cleanup-hoangnguyen555grok-1529.vercel.app` (the isolated Preview alias).
3. Authorized redirect URI (Supabase callback): `https://rdzitdoarrfjugzogkrf.supabase.co/auth/v1/callback`.
4. Keep requested scopes limited to `openid`, `email` and `profile`.
5. In Supabase Dashboard → Authentication → Sign In / Providers, enable Google and enter the Client ID and Client Secret. Disable the Email provider and leave every other provider disabled. A database `BEFORE INSERT` trigger also rejects any new Auth user whose `raw_app_meta_data.provider` is not exactly `google`, providing a server-side enforcement layer in addition to the UI.
6. In Supabase Dashboard → Authentication → URL Configuration, set Site URL to `https://geed-hardwin.vercel.app` and add these exact redirect patterns: `https://geed-hardwin.vercel.app/**` and `https://geed-hardwin-git-goal8-cloud-ai-cleanup-hoangnguyen555grok-1529.vercel.app/**`. Do not allow all unrelated Vercel deployment domains.
7. Complete Google consent-screen branding and add privacy policy/terms links before public launch.

The browser client uses only the Supabase publishable key, PKCE flow and Google provider. The sign-in button is optional; the local editor still works if OAuth is not configured. The real login flow cannot be tested until the owner configures these values.

## Vercel server environment (owner setup)

Configure these only in Vercel Project Settings → Environment Variables. For initial verification, use the **Preview** environment on this branch. Do not add these to frontend-prefixed variables, Git, logs or chat.

Supabase:
- `GEED_SUPABASE_URL=https://rdzitdoarrfjugzogkrf.supabase.co`
- `GEED_SUPABASE_PUBLISHABLE_KEY`: the project's publishable key.
- `GEED_SUPABASE_SERVICE_ROLE_KEY`: the legacy service-role secret from the Supabase API Keys dashboard, server-only. This is required for the quota RPCs and must never enter frontend JavaScript.

AI provider:
- At least one provider key and matching model ID from `docs/GOAL8-MODEL-ROUTER.md`.
- Keep provider credentials in Vercel server environment only. Do not set `GEED_AI_GATEWAY_TOKEN`; the chat endpoint now authenticates the Supabase user session and verifies the user with Supabase Auth.

Optional exact-model price map:
`GEED_AI_TOKEN_PRICES_JSON` may contain JSON entries such as:
```json
{
  "exact-model-id": {
    "input_per_1m_usd": 0.5,
    "output_per_1m_usd": 1.5
  }
}
```
Only an exact model ID match is used. Both rate values must be explicitly supplied as a non-negative number or non-empty numeric string; missing, null, blank or invalid values leave cost `unknown`. An explicitly configured rate of `0` is accepted only as a deliberate price entry. This calculates a **rate-based estimate** from provider token counts; it is not an invoice or authoritative actual charge. The ledger records it as `estimated`. When no valid exact price map exists, the cost remains `unknown` (null), not zero. Actual invoice cost is intentionally left null until there is a reliable source for it.

## AI authentication and quota enforcement

The `POST /api/ai/chat` endpoint now:
1. Requires a bearer access token and verifies it using Supabase Auth `/auth/v1/user`; it never trusts a user ID supplied by the browser.
2. Reserves monthly request and token allowance under a row lock on that user's entitlement. Concurrent calls cannot all pass the same remaining quota.
3. Refuses accounts without active status, AI access, and positive configured limits before calling any provider.
4. Routes through configured provider APIs, records provider token counts and an estimated cost only when an exact price entry exists.
5. Records ambiguous provider timeouts without retrying another provider. For quota accounting, it conservatively records the full server-side output-token allowance reserved for that request; this is not reported as measured output or actual provider cost.
6. Writes usage through a server-only RPC. If the usage write fails after a completed generation, the response explicitly sets `usage_recorded: false` and warns not to automatically retry.

The reservation uses conservative input-character estimates plus the server-enforced output token ceiling. Expired in-flight reservations are cleared on the next reservation after ten minutes. New accounts are intentionally AI-disabled by default. No account has been granted nonzero quotas yet.


## Community image generation — FLUX.1 Schnell

The AI Bridge includes a small image-generation form. It uses the Apache-2.0 FLUX.1 Schnell model hosted on Cloudflare Workers AI; no model is installed locally and no image is uploaded to Supabase.

The route is intentionally disabled unless all of these server-only Vercel variables are configured:

- `GEED_AI_CLOUDFLARE_API_KEY`: Cloudflare API token with Workers AI Run permission.
- `GEED_AI_CLOUDFLARE_ACCOUNT_ID`: 32-character account ID.
- `GEED_AI_CLOUDFLARE_IMAGE_ENABLED=true`: explicit feature switch.
- `GEED_AI_CLOUDFLARE_FREE_TIER_CONFIRMED=true`: owner verified the account is on the Workers Free plan.
- `GEED_AI_CLOUDFLARE_BILLING_DISABLED=true`: owner verified the account has no paid Workers plan/overage enabled.

Cloudflare's Free plan includes 10,000 Neurons per day, shared by the account and reset daily at 00:00 UTC. The Free plan rejects further operations after the allowance. Workers Paid accounts can incur charges after the free allowance. The flags above are owner confirmations, not an automatic billing lock; verify the plan in the Cloudflare Dashboard before enabling the feature. The connected Cloudflare OAuth session in this workspace cannot read subscription/billing details because it lacks Billing Read permission, so the account plan has not been independently verified here.

The server fixes the model to `@cf/black-forest-labs/flux-1-schnell`, fixes inference at 4 steps, caps prompt length at 2,048 characters, checks the Google/Supabase user session and reserves one monthly AI request before making a provider call. It records success/provider failure/uncertain timeout in `usage_ledger`. Cost is marked unknown, not assumed to be zero. A timeout is never retried automatically.

When an image succeeds, the browser places it in the local resource library and on the canvas. The image data remains in the project snapshot/IndexedDB and is excluded from Supabase storage. The user can remove it from the local resource library or project as usual.

## Retention and storage

- Local project/media: remains on the user's device. JSON export is recommended because browser data can be cleared or evicted.
- Free cloud backup: not enabled. There is no local project deletion timer.
- AI memory: the UI defaults to **Không lưu**. Only a clear remember/save request plus an explicit 2/3/7/30-day selection can save a short note. The database itself computes expiry from `retention_days`, caps each user at 20 active notes, rejects client updates, and deletes only expired AI-memory rows. A daily `pg_cron` job runs at 03:17 UTC; RLS hides expired rows immediately. The user can inspect and delete individual notes. This never targets project metadata or local files.
- Paid cloud storage and subscription-expiry handling: deferred until costs, quotas and pricing are measured and explicitly approved.

## AI agent and memory UI

The editor AI Bridge is now a cloud-agent client in the working branch. It sends natural-language tasks to the authenticated `/api/ai/chat` endpoint in `agent` mode. The server injects the agent system prompt (client system messages are discarded), parses one JSON action at a time and rejects actions outside a small allow-list. The browser validates action arguments again, runs only existing editor bridge methods, and sends fresh editor observations back to the model. The loop is bounded to five model turns per task and the in-tab chat history is capped and not persisted.

Supported automatic actions: inspect, create circle, animate circle, play, stop, set frame and delete selected layer(s). Delete requires a separate browser confirmation showing the currently selected names/count and verifies the layer count decreased by exactly that count. Video export stays manual because the editor currently has no reliable completion signal for the agent to verify. The model cannot run arbitrary code, access local files or call external shell/browser tools.

Optional AI memory is separate from the editor project. It defaults to off, is saved only when the user explicitly asks to remember something, and can be set to 2/3/7/30 days. The UI lists and deletes notes individually. User switching/sign-out clears in-tab conversation state. No animation project JSON, image, audio or video is placed in this memory table.

## Verification performed

- Supabase project reports `ACTIVE_HEALTHY`.
- Applied migrations: `20261121035113` initial schema, `20261121035229` cost status, `20261121035409` memory expiry cleanup, `20261121035551` + `20261121035624` quota RPCs, `20261121035637` estimated/actual cost separation, `20261121040340` Google-only Auth provider, `20261121041413` active-memory cap and `20261121041743` server-side TTL/client-update lockout.
- All five public tables have RLS enabled; Security Advisor returned zero findings.
- Reserve/finalize AI quota RPCs are executable by `service_role` and not by `anon` or `authenticated`.
- AI memories cannot be updated by the client; user insert/delete remains scoped by RLS. The server expiry trigger fixes the create/expiry timestamps and the active-memory trigger caps each account at 20.
- Memory cleanup job is present and active at 03:17 UTC; it deletes only expired `ai_memories` rows.
- The Google-only Auth trigger was exercised against temporary test rows: `google` was accepted, `email` and missing provider were rejected. A real OAuth login remains untested until owner credentials are configured.
- GitHub Actions run `44869081045` passed **58/58 tests**, zero failures, and all server/module syntax checks: https://github.com/hoangnguyen555grok-glitch/hardwin/actions/runs/44869081045. The newer frontend-script syntax test still needs to run in the next workflow execution.
- Vercel Preview build and real-browser interaction tests must be refreshed after the latest commit; the production branch and deployment remain untouched.
