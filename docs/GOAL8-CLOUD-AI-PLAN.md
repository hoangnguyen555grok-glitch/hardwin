# Goal 8 — Cloud AI cleanup and implementation plan

Status: legacy local prototype removed from this working branch; cloud implementation not yet started.
Branch: goal8-cloud-ai-cleanup
Production branch is intentionally unchanged.

## Non-negotiable product decisions

- Geed Hardwin's AI must run through hosted provider APIs and hosted application services.
- No local model runtime, model weights, Ollama, local LiteLLM proxy, local browser automation, or Opera/CDP dependency in the production AI path.
- ChatGPT connectors are not automatically available to the Geed Hardwin application. Integrate provider APIs directly, with credentials stored only in server-side environment variables.
- Reuse hosted model/provider infrastructure instead of building or training a model.
- Prefer free tiers and open-source libraries; never assume an API is free or unlimited.
- Keep animation projects and media assets in their existing project storage. AI memory stores only small context/task metadata.
- Per-project AI memory retention is configurable: 2, 3, 7, or 30 days. Expiry cleanup must delete only AI memory records, never original project files or media.
- Risky actions require explicit user confirmation. The agent must verify outcomes before reporting completion.

## Repository audit findings and cleanup (2026-11-21)

The former `browser-agent/` folder was a local prototype, not a hosted Geed AI service. Its contents and its dedicated local-agent CI workflow have now been removed from this working branch after confirming the production frontend did not depend on them. The production editor's animation tools and in-editor bridge demo remain intact. The original prototype can still be inspected through Git history if ever needed.

The removed prototype had these characteristics:
- `assistant_app.py` starts a local FastAPI app, attaches to a local browser via CDP, imports Browser Use, checks a local Ollama endpoint, and stores SQLite files locally.
- `litellm_config.yaml` defaults to `ollama_chat/llama3.1:8b` and uses a local proxy.
- `.env.example` configures localhost endpoints and a local model.
- `requirements.txt` includes Browser Use, Playwright, MCP CLI, LiteLLM proxy, and SQLite checkpoint dependencies.
- Windows batch files start local services and Opera debugging.
- `memory_store.py` and `workflow.py` persist local task history/checkpoints; they do not implement the requested cloud project-scoped retention.
- `mcp_server.py` exposes a restricted local browser/editor bridge; it is not a hosted, authenticated application API.

## Cleanup policy

The local-only prototype and its local setup instructions are removed from this branch. The production editor remains unchanged apart from removing the obsolete local-agent launcher and clarifying the AI Bridge status. Preserve Git history. No local setup scripts are required for the intended cloud-only architecture.

## Target architecture

1. Cloud model gateway/router: server-side API calls to supported model providers; provider/model IDs and fallback behavior must be validated against each provider. No local proxy process.
2. Hosted agent runtime: reason-plan-act-observe-verify loop with bounded steps, timeouts, retries, token/cost limits, and explicit approval gates.
3. Geed application tools: narrow server-side actions that call the editor's supported project APIs. Do not use browser automation to click the user's local browser.
4. Cloud memory: small project-scoped context and task records with retention choice (2/3/7/30 days), expiry timestamps, scheduled or query-time cleanup, and RLS/authentication. Never store animation binaries in AI memory.

## Implementation sequence

A. Audit and isolate legacy local prototype (this branch).
B. Implement the cloud provider router without exposing provider secrets to the browser.
C. Implement the hosted agent runtime and secure Geed tool interface.
D. Implement cloud memory and retention/automatic cleanup.
E. Test, deploy, and verify each part. Production branch is not changed until verified.

## Cost and safety

- No paid service/project is created without explicit user approval.
- Free-tier availability and quotas must be checked; "free" is not guaranteed indefinitely.
- Do not put API keys in frontend code, Git, logs, or browser storage.
- Do not delete user animation projects, source assets, or exports during AI-memory cleanup.
