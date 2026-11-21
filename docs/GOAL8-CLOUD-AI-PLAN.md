# Goal 8 — Cloud AI, accounts and data protection

Status: repository cleanup, Google-only account foundation, per-account quota gate, bounded AI Agent loop, opt-in expiring AI memory, and community-first provider routing are implemented on the working branch. GitHub Actions run `44867167763` passed **41/41 tests** and all syntax checks on commit `0ff268f2f364ead465ef356ffb2f5b66352cc4fe`. The updated free-provider routing still needs a fresh Vercel Preview smoke test. Real Google OAuth and provider calls remain blocked until the owner configures credentials and confirms the free-tier provider accounts.
Branch: `goal8-cloud-ai-cleanup`
Production branch: unchanged. No merge or production deployment has been performed.

## Product and safety decisions

- AI runs through hosted model/provider APIs and hosted application services. No local model runtime, model weights, Ollama, local proxy, browser automation or Opera/CDP dependency.
- Provider credentials and the Supabase service-role key stay in server-side environment variables only.
- The editor remains usable without an account. Google is the only permitted sign-in method, enforced both in the browser OAuth flow and by a database trigger on new Auth users.
- Free users keep project files and media in their browser/device through IndexedDB autosave and JSON export/import.
- Supabase stores user/account data, entitlements, usage ledger, lightweight project metadata and small AI memory. It does not store animation project binaries or media.
- Payments, paid plans, auto-renewal and paid cloud media storage are deferred until actual costs can be measured and a price plan approved.
- Every new account starts with AI disabled, zero AI request/token quota and zero cloud-storage quota.
- AI memory is off by default. Only an explicit remember request plus a selected 2/3/7/30-day TTL can store a short note. Expiry never deletes projects or media.
- Risky editor actions require user confirmation. The Agent Engine verifies the editor state after each supported operation and stops if it cannot verify an outcome.

## A. Repository cleanup — completed

The former `browser-agent/` directory and its local-only setup instructions/workflow were removed from this branch after checking that the production editor did not depend on them. The obsolete local-agent launcher was removed from the UI. The editor's animation tools, IndexedDB autosave, JSON import/export and in-editor bridge remain available. Git history preserves the removed prototype.

The deleted prototype had a local FastAPI runner, Browser Use/CDP, local Ollama and LiteLLM configuration, SQLite task memory and Windows scripts for local browser debugging. None of those components is part of the target cloud workflow.

## B. Cloud Model Router — implemented

Files: `lib/ai-router.js`, `api/ai/chat.js`, `lib/supabase-ai-gateway.js`, tests and `docs/GOAL8-MODEL-ROUTER.md`.

- Defaults to hosted community free-tier inference: OpenRouter `openrouter/free`, Groq Free (only after the Free-tier confirmation flag), then Cloudflare Workers AI Free (only after the Free-plan flag and account endpoint are configured).
- Existing direct integrations for OpenAI, xAI, DeepSeek, Qwen, GLM, Anthropic and Gemini are disabled by default and require the explicit owner-only `GEED_AI_ALLOW_PAID_PROVIDERS=true` switch.
- Configured provider order is a strict allow-list; configured API keys are never silently appended as fallback options.
- Uses the shared OpenAI-compatible HTTP protocol where providers support it. No extra self-hosted LiteLLM/Bifrost service is added; those community gateways would create unnecessary hosting and maintenance for the current use case.
- Falls through to the next explicitly allowed provider after clear errors or quota/rate-limit responses. An ambiguous timeout stops the chain to avoid a possible duplicate billable generation.
- Enforces request validation, timeout limits, a server-side output-token ceiling, authenticated sessions and atomic account-level monthly request/token reservations.
- Records provider token usage. Model costs remain unknown unless an exact model price is configured; rate-based calculations are labelled estimates, never invoice actuals.
- Free quotas are limited and may change. This is a text-agent/chat foundation, not an image/video generation pipeline.

## C. Account and data protection — foundation implemented

Supabase project `geed-hardwin-auth` (`rdzitdoarrfjugzogkrf`) is active in Singapore; its project creation quote was USD 0/month on 2026-11-21. This is not a quote for any external provider API usage.

- Google-only browser sign-in uses Supabase's publishable key and PKCE. A database `BEFORE INSERT` trigger rejects new Auth users unless `raw_app_meta_data.provider` equals `google`.
- Tables: `profiles`, `entitlements`, `usage_ledger`, `ai_memories`, `project_metadata`; all public tables have RLS with per-user policies.
- Clients cannot change entitlements or write usage rows. Quota reservation/finalization RPCs are service-role only.
- New accounts receive Free status, AI off and zero quotas. Server checks the Supabase access token against Auth and derives the account ID from the verified session.
- The AI endpoint reserves quota before calling a provider and writes token usage afterward. Ambiguous timeouts are not retried, and the token reservation is conservatively accounted against the user's allowance.
- Cost is labelled `unknown` unless an exact configured model price exists. Estimated cost and actual invoice cost are stored separately; no assumed-zero pricing.

**Owner setup still required:** create a Google OAuth Web Client, enter its Client ID/Secret in Supabase Auth, disable Email and all non-Google providers, set the exact redirect allow-list, and add Supabase server secrets plus provider keys/models to the Vercel **Preview** environment. Secrets must not be pasted into chat or Git. See `docs/GOAL8-ACCOUNT-SECURITY.md`.

## D. Bounded cloud AI Agent — implemented, provider test pending

The AI Bridge no longer parses command keywords. In `agent` mode, the API injects a server-owned system prompt, discards all client-supplied system messages, and accepts a strict one-action JSON response. The browser validates arguments again, invokes only existing `GeedHardwinBridge` methods and sends a fresh editor-state observation to the model. The loop is capped at five model turns per user request; chat history is kept in memory for the current tab only and is cleared when the account changes or signs out.

Supported actions: inspect project, create circle, animate circle, play, stop, set frame and delete selected layer(s). Deletion requires a separate `window.confirm` that names the currently selected items and count; it is only reported as verified when the layer count decreases by exactly that count. A requested layer that is not selected cannot be deleted. Video export remains manual because the current editor does not expose a reliable job-completion result to the agent. The agent cannot run arbitrary code, shell commands, access local files or control a browser.

**Runtime integration test pending:** the backend is deliberately closed until the owner adds Preview secrets and enables Google OAuth. Therefore a real end-to-end LLM→editor tool loop has not yet been executed against a live configured provider. CI validates the request, parser, allow-list, browser code syntax, mocked quota and provider flows.

## E. AI memory — opt-in controls and expiry implemented

- UI defaults to `Không lưu`. A short note is stored only when the user explicitly asks the AI to remember something and has selected 2, 3, 7 or 30 days.
- When a nonzero retention period is selected, recent own-account notes can be read as untrusted context. The user can open the memory list and delete individual notes.
- Browser code cannot set its own expiration timestamp. Supabase computes `expires_at` from the selected retention value, caps each account at 20 active notes, removes expired rows opportunistically and does not grant clients UPDATE on memories.
- RLS hides expired rows immediately; a daily `pg_cron` job at 03:17 UTC deletes only expired rows from `ai_memories`.
- These memory operations never delete or modify animation project JSON, images, audio, video or project metadata.

## F. Remaining release gates

1. Owner configures Google OAuth and Vercel Preview server environment variables (instructions in `docs/GOAL8-ACCOUNT-SECURITY.md`).
2. The last confirmed Preview served commit `1f68edce761320ff2d3cd38feaf7533578dd9866`; it predates the latest free-first router edits. Create/check a fresh Preview for the current branch before interactive testing. Then verify Auth callback, session restoration and local save/import/export.
3. With an owner-configured test account/provider, exercise AI disabled, quota boundaries, real provider response, usage ledger, cost estimate, tool actions, confirmation prompt and post-action verification.
4. Test memory write/read/delete and automatic expiry using a test note; ensure project/media remain untouched.
5. Compare usage ledger estimates with actual provider invoices before deciding any Free allowance or paid plan. Payments remain out of scope.
6. Implement further agent tools only when their results can be independently observed and verified. Add cancellation/undo or rollback only where the editor provides a safe, testable contract.
7. Present Preview evidence. Production merge/deploy requires the owner's explicit instruction.

## Cost and release safety

- The Supabase project creation quote was USD 0/month. Provider APIs can still incur separate usage charges.
- Do not assume any provider free tier is unlimited or permanent.
- Do not grant AI quota, add payments or create paid cloud storage by default.
- Never deploy to production or merge to `main` until the owner explicitly authorizes release.
