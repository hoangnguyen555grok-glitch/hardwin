# Goal 8 — Account, entitlement and data protection

Status: database schema is live in Supabase; Google OAuth credentials and Vercel server secrets still require owner setup.
Working branch: `goal8-cloud-ai-cleanup`
Supabase project: `geed-hardwin-auth` (`rdzitdoarrfjugzogkrf`), region `ap-southeast-1` (Singapore).
Cost quote for project creation: USD 0/month on 2026-11-21. This is a Supabase project quote, not a guarantee that all future provider usage or storage is free.

## Product rules

- The editor remains usable without signing in.
- Account sign-in is Google only. No email/password, Facebook or Apple sign-in flow is added.
- Free users keep animation project files and media in the browser/device. Existing IndexedDB autosave and JSON export/import remain in place.
- Supabase stores only account data, entitlements, AI usage measurements, limited AI memory and lightweight project metadata. It does not store animation binaries or media.
- Payments, paid plans, recurring billing and paid cloud file storage are not enabled in this phase.
- AI access defaults to disabled for every new account until provider prices, usage quotas and server-side secrets have been configured deliberately.
- AI-memory retention is restricted to 2, 3, 7 or 30 days. AI-memory expiry must never delete local project files or original media.

## Database tables

- `profiles`: user display name, avatar URL and locale. A database trigger creates the row when an Auth user is created.
- `entitlements`: server-controlled plan/status, AI enablement and request/token/storage limits. New accounts receive `free`, `active`, AI disabled and zero cloud-storage allowance. Clients can read their own row but cannot change it.
- `usage_ledger`: provider/model, token counts, outcome and cost status. Clients can read their own rows; they cannot write or modify ledger entries. Cost is nullable and marked `unknown` until a verified provider price is configured. Unknown cost must never be reported as zero/free.
- `ai_memories`: small text context only, with allowed retention values and expiry timestamp. RLS limits every record to its owner.
- `project_metadata`: lightweight project name/summary/version only. Original project JSON, images, audio and exports stay local.

All five exposed public tables have RLS enabled. Policies use `auth.uid()` ownership checks. Internal trigger functions live in the unexposed `private` schema. No service-role key is placed in the browser.

## Google OAuth owner setup

Google OAuth cannot be activated without a Client ID and Client Secret created by the project owner. Do not paste the Client Secret into chat, source control, browser storage or frontend code.

1. Open Google Cloud Console → Google Auth Platform → Clients and create an OAuth Client ID of type **Web application**.
2. Authorized JavaScript origin: `https://geed-hardwin.vercel.app`.
3. Authorized redirect URI (Supabase callback): `https://rdzitdoarrfjugzogkrf.supabase.co/auth/v1/callback`.
4. Keep the requested scopes limited to `openid`, `email` and `profile`.
5. In Supabase Dashboard → Authentication → Sign In / Providers → Google, enable Google and enter the Client ID and Client Secret.
6. In Supabase Dashboard → Authentication → URL Configuration, set Site URL to `https://geed-hardwin.vercel.app` and add the exact production redirect URL `https://geed-hardwin.vercel.app/**`. Add an exact preview URL only after a Vercel preview deployment exists; do not use a broad wildcard for every Vercel project.
7. Google consent-screen branding and links to the eventual privacy policy/terms should be completed before public launch.

The application client uses the publishable key only and requests Google OAuth using the PKCE flow. The sign-in button will report a setup message until Google Provider and its redirect allow-list are configured.

## Server configuration required before AI is enabled

Configure secrets only in Vercel Project Settings → Environment Variables. Never put them in `index.html`, client-side `NEXT_PUBLIC_*` values, Git, logs or chat.

Required backend variables for a future authenticated AI endpoint:
- `GEED_SUPABASE_URL`: project URL.
- `GEED_SUPABASE_PUBLISHABLE_KEY`: Supabase publishable key.
- `GEED_SUPABASE_SERVICE_ROLE_KEY`: service-role secret, server-only.
- Provider API keys and model IDs documented in `docs/GOAL8-MODEL-ROUTER.md`.

Do not set AI entitlement flags or nonzero quotas until the server verifies the user's Supabase session, enforces account-level quotas, records token usage, and computes costs from a verified price table. The current AI route remains fail-closed.

## Retention and storage policy to implement

- Local project/media: stays on the user's device; recommend JSON export backups because browser storage can be cleared or evicted.
- Free cloud backup: not enabled in this phase. No local deletion timer exists.
- AI memory: 2/3/7/30-day expiry; deletion job and expiry-query filtering still need implementation.
- Paid cloud storage: deferred until costs, quotas and pricing are measured and approved.
- Subscription expiry/grace-period/deletion: deferred with payments.

## Verification performed

- Project reports `ACTIVE_HEALTHY`.
- Migration `initial_account_safety_schema` and `usage_cost_status` applied successfully.
- Five public tables visible; all five report `rls_enabled = true`.
- Security Advisor returned zero findings after schema creation.
- Performance Advisor currently reports five `unused_index` informational notices on newly created indexes. Recheck after real traffic before removing useful query indexes.
- No real Google sign-in test is possible until owner-created OAuth credentials are entered.
