# Goal 8 — Account, entitlement and data protection

Status: Supabase schema, Google-only browser sign-in client, server-side Supabase session verification, and per-account AI quota enforcement are implemented on the working branch. Google OAuth credentials and Vercel server secrets still require owner setup.
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
- `ai_memories`: small text context only, with 2/3/7/30-day retention and expiry. RLS limits every record to its owner.
- `project_metadata`: lightweight project name/summary/version only. Original project JSON, images, audio and exports stay local.

All five exposed public tables have RLS enabled. Policies use `auth.uid()` ownership checks. Internal trigger, cleanup and reservation tables/functions live in the non-exposed `private` schema. Quota reservation/finalization RPCs are executable only by the server `service_role`, never by `anon` or `authenticated`.

## Google OAuth owner setup

Google OAuth cannot be activated without a Client ID and Client Secret created by the project owner. Do not paste the Client Secret into chat, source control, browser storage or frontend code.

1. Open Google Cloud Console → Google Auth Platform → Clients and create an OAuth Client ID of type **Web application**.
2. Authorized JavaScript origin: `https://geed-hardwin.vercel.app`.
3. Authorized redirect URI (Supabase callback): `https://rdzitdoarrfjugzogkrf.supabase.co/auth/v1/callback`.
4. Keep requested scopes limited to `openid`, `email` and `profile`.
5. In Supabase Dashboard → Authentication → Sign In / Providers → Google, enable Google and enter the Client ID and Client Secret.
6. In Supabase Dashboard → Authentication → URL Configuration, set Site URL to `https://geed-hardwin.vercel.app` and add the exact production redirect URL `https://geed-hardwin.vercel.app/**`. Add the exact Vercel preview URL only after the preview exists; do not allow all unrelated Vercel deployment domains.
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
Only an exact model ID match is used. This calculates a **rate-based estimate** from provider token counts; it is not an invoice or authoritative actual charge. The ledger records it as `estimated`. When no verified price map exists, the cost remains `unknown` (null), not zero. Actual invoice cost is intentionally left null until there is a reliable source for it.

## AI authentication and quota enforcement

The `POST /api/ai/chat` endpoint now:
1. Requires a bearer access token and verifies it using Supabase Auth `/auth/v1/user`; it never trusts a user ID supplied by the browser.
2. Reserves monthly request and token allowance under a row lock on that user's entitlement. Concurrent calls cannot all pass the same remaining quota.
3. Refuses accounts without active status, AI access, and positive configured limits before calling any provider.
4. Routes through configured provider APIs, records provider token counts and an estimated cost only when an exact price entry exists.
5. Records ambiguous provider timeouts without retrying another provider, reducing the risk of duplicate generation charges.
6. Writes usage through a server-only RPC. If the usage write fails after a completed generation, the response explicitly sets `usage_recorded: false` and warns not to automatically retry.

The reservation uses conservative input-character estimates plus the server-enforced output token ceiling. Expired in-flight reservations are cleared on the next reservation after ten minutes. New accounts are intentionally AI-disabled by default. No account has been granted nonzero quotas yet.

## Retention and storage

- Local project/media: remains on the user's device. JSON export is recommended because browser data can be cleared or evicted.
- Free cloud backup: not enabled. There is no local project deletion timer.
- AI memory: database accepts only 2/3/7/30 days. A daily `pg_cron` job runs at 03:17 UTC, removes only expired rows from `ai_memories`, and the RLS read policy hides expired rows immediately. It never targets project metadata or local files.
- Paid cloud storage and subscription-expiry handling: deferred until costs, quotas and pricing are measured and explicitly approved.

## Verification performed

- Supabase project reports `ACTIVE_HEALTHY`.
- Migrations applied: `initial_account_safety_schema`, `usage_cost_status`, `ai_memory_expiry_cleanup`, `ai_usage_quota_enforcement`, `separate_estimated_and_actual_ai_cost`.
- All five public tables have RLS enabled.
- Security Advisor returned zero findings.
- Reserve/finalize RPCs are executable by `service_role` and not by `anon` or `authenticated`.
- AI memory cleanup job is present and active; cleanup function is under the private schema with fixed empty search path.
- No real Google sign-in test is possible until owner-created OAuth credentials are entered.
