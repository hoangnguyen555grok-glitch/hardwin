# Goal 8 — Cloud AI, accounts and data protection

Status: repository cleanup, cloud Model Router, Supabase account schema, database-enforced Google-only account creation, browser sign-in client, per-account quota gate and automatic AI-memory expiry cleanup are implemented on the working branch. The first Vercel Preview build is READY and the first full CI pass reported 22/22 tests. **Not ready for production publication yet:** OAuth credentials and server secrets still require owner setup; the latest hardening commit needs a refreshed Preview; the Agent Engine and memory/chat UI are not implemented.
Branch: `goal8-cloud-ai-cleanup`
Production branch: unchanged; no production deployment or merge has been performed.

## Product and safety decisions

- AI runs through hosted model/provider APIs and hosted application services. No local model runtime, model weights, Ollama, local proxy, browser automation or Opera/CDP dependency.
- Provider credentials stay in server-side environment variables. No secret is placed in frontend code, Git, logs or browser storage.
- The editor remains usable without an account. Google is the only sign-in method.
- Free users keep project files and media in their browser/device through the existing IndexedDB autosave and JSON export/import workflow.
- Supabase stores user/account data, entitlements, usage ledger, lightweight project metadata and small AI memory. It does not store animation project binaries or media.
- No payments, paid plan, auto-renewal or cloud media storage are enabled in this phase.
- AI access defaults to disabled and zero quota until model prices and cost controls are configured deliberately.
- AI memory retention is configurable as 2, 3, 7 or 30 days. Expiry must never delete project files or original media.
- Risky editor actions require explicit user confirmation. The Agent Engine must verify outcomes before reporting completion.

## A. Repository cleanup — completed

The former `browser-agent/` directory and its local-only setup instructions/workflow were removed from this branch after checking that the production editor did not depend on them. The obsolete local-agent launcher was removed from the UI. The editor's animation tools, IndexedDB autosave, JSON import/export and in-editor bridge remain available. Git history preserves the removed prototype.

The deleted prototype had a local FastAPI runner, Browser Use/CDP, local Ollama and LiteLLM configuration, SQLite task memory and Windows scripts for local browser debugging. None of those components is part of the target cloud workflow.

## B. Cloud Model Router — implemented, backend-only

Files: `lib/ai-router.js`, `api/ai/chat.js`, router tests, GitHub Actions workflow and `docs/GOAL8-MODEL-ROUTER.md`.

- Supports OpenAI-compatible providers (OpenAI, xAI, DeepSeek, Qwen and GLM), Anthropic Messages and Gemini generateContent.
- Provider keys/model IDs and order are supplied through server environment variables only.
- Uses configured providers only; supports fallback for explicit provider failures such as rate limits/quota errors.
- Does not automatically fall back after an ambiguous timeout, to avoid duplicate billable generations.
- Enforces request validation, timeout limits and a server-side output-token ceiling.
- It is a text-chat router, not an image/video generation pipeline.

## C. Account and data protection — foundation implemented

Supabase project `geed-hardwin-auth` (`rdzitdoarrfjugzogkrf`) is active in Singapore; project creation quote was USD 0/month on 2026-11-21.

- Google-only browser sign-in client uses Supabase's publishable key and PKCE. The header control is optional; the editor still works signed out. A database `BEFORE INSERT` trigger rejects new auth.users rows unless `raw_app_meta_data.provider` is exactly `google`.
- Database contains profiles, entitlements, usage ledger, AI memories and project metadata, all with RLS and per-user ownership policies.
- New users are assigned the Free plan with AI disabled and zero storage/AI quotas.
- The AI endpoint verifies the Supabase access token with Supabase Auth and uses server-only RPCs to reserve account request/token quota and finalize measured usage. It does not trust a user ID from the browser.
- Quota reservation serializes requests per account, preventing concurrent requests from bypassing the monthly limits.
- Provider token counts are recorded. Cost stays unknown unless a model's exact rate is configured; a rate-based calculation is marked estimate, never actual invoice cost.
- Payments and cloud project/media storage remain deferred.

**Owner setup still required:** create a Google OAuth Web Client in Google Cloud, enter Client ID/Secret in Supabase Auth Provider settings, disable the Email provider, set the exact production/Preview redirect allow-list, and add the server-only Supabase service-role secret plus provider keys/models to the Vercel **Preview** environment. Do not place secrets in chat or Git. Details are in `docs/GOAL8-ACCOUNT-SECURITY.md`.

## D. Cloud AI memory — opt-in controls and expiry implemented

- AI memory records are limited to small text context and retention values 2/3/7/30 days. Saving is off by default and requires a clear user request to remember a note plus the selected TTL.
- Browser controls allow selecting TTL, reading the user's own recent memories and deleting an individual note. The note is retrieved only when the user has selected a nonzero retention mode.
- The database computes expiry server-side, limits each account to 20 active notes, and denies client updates.
- Expired rows are hidden immediately by RLS and a daily `pg_cron` task deletes only expired `ai_memories` rows at 03:17 UTC.
- The project/media store is not referenced by the deletion job; no original projects or assets are written into AI memory.

## E. Remaining build and release gates

1. Owner configures Google OAuth credentials and Vercel Preview-only server secrets.
2. Re-run CI after the latest quota/cost hardening and verify all tests and syntax checks.
3. Refresh the Vercel Preview from the latest branch commit and test the app, Google sign-in, session restoration, local autosave/import/export, unauthorized/disabled AI, quota enforcement, provider failover and usage logging.
4. Implement the Agent Engine: natural-language plan → bounded tool calls → observe editor state → verify results, permission gates, audit trail, timeouts, cancellation and safe rollback.
5. Integrate the AI chat UI only after the preview backend is configured and tested. Keep the prototype AI Bridge clearly marked until that integration is real.
6. Implement AI-memory selection/read/write UI and deletion/export controls, then test automatic expiry without touching project assets.
7. Compare observed provider usage with provider invoices. Only after measuring actual costs should free allowances and paid pricing be designed.
8. Present the tested preview and deployment evidence. Production merge/deploy requires the owner's explicit instruction.

## Cost and release safety

- The Supabase project quote was USD 0/month when created. Provider APIs can still incur separate usage costs.
- Do not assume a provider free tier is unlimited or permanent.
- Do not enable AI quota or add payment integrations by default.
- Never deploy to production or merge to `main` until the owner explicitly authorizes the release.
