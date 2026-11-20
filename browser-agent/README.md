# Geed Hardwin AI & Browser Agent Kit

This folder contains two experimental connection paths for Geed Hardwin.

## Path 1 — Connect this ChatGPT assistant through MCP

The Geed Hardwin editor exposes a restricted control API on the page:

- read scene, timeline and selected-layer state;
- list layer names/types;
- create a circle;
- create a circle animation with start/end keyframes;
- play, stop and set the playhead;
- delete the selected layer(s);
- start video export.

The local MCP server in `mcp_server.py` uses MCP Python SDK 2.3.0 and exposes these as typed tools over Streamable HTTP at:

`http://127.0.0.1:8766/mcp`

This is a local endpoint only. ChatGPT's cloud service cannot call `127.0.0.1` on your PC. To connect ChatGPT, the local MCP endpoint must later be exposed through a trusted tunnel or hosted relay with authentication. Do **not** expose this unauthenticated local server to the public Internet. The server intentionally binds to loopback only.

After the authenticated endpoint exists, a private ChatGPT MCP plugin/connector can point to that endpoint. The plugin package cannot be completed with a working URL before the tunnel and authentication are set up.

## Path 2 — Geed Hardwin Local AI Agent

The local assistant combines four open-source layers:

- **Browser Use (MIT):** performs browser interaction over Chromium DevTools Protocol (CDP).
- **LiteLLM (MIT):** model gateway with provider routing, retries, cooldowns, and ordered fallbacks.
- **LangGraph (MIT):** runs recall → browser execution → save and checkpoints state by session/thread.
- **SQLite:** stores successful task summaries locally and recalls relevant task history in the same session.

The default model is local Ollama. OpenAI, Anthropic, and Gemini are configured as optional fallback routes after provider keys and supported model IDs are added to `.env`. This local assistant is a separate process; it is not a copy of this ChatGPT conversation.

### MCP local-client setup

Run `start_mcp.bat` after starting the Opera debug window. A local MCP client can connect to:

`http://127.0.0.1:8766/mcp`

To let ChatGPT cloud connect, configure an authenticated tunnel first. No public tunnel is configured in this starter kit.

## Current limitations

- The in-editor AI Bridge remains a limited local command demo; generative browser control runs in the separate Local AI Agent at `127.0.0.1:8765`.
- Path 1 still needs an authenticated public MCP route before ChatGPT cloud can call local tools.
- SQLite memory is local to this computer and is not synchronized with ChatGPT or other devices.
- Browser agents can make mistakes. Inspect actions and results; never give the agent passwords, payment details, or unrestricted access to unrelated private tabs.
## Sources

- Browser Use source and license: https://github.com/browser-use/browser-use
- Ollama model example: https://github.com/browser-use/browser-use/blob/main/examples/models/ollama.py
- Playwright CDP docs: https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp
- Opera extension and Chromium compatibility: https://help.opera.com/en/extensions/

## Windows setup for the local AI agent

1. Install Python 3.11 or newer and install Ollama from https://ollama.com/.
2. Run `setup_windows.bat`. It installs the pinned browser agent, LangGraph, LiteLLM Proxy and supporting packages, then copies `.env.example` to `.env`.
3. Edit `.env` and change `LITELLM_MASTER_KEY` to a private random value. Never commit the real `.env` file.
4. Run `ollama pull llama3.1:8b`.
5. Start `start_model_gateway.bat` in a terminal; it listens on `127.0.0.1:4000`.
6. Start `start_opera_debug.bat` in another terminal. It opens a separate Opera profile with CDP on `127.0.0.1:9222`. Sign in to Geed Hardwin in that window.
7. Start `start_assistant.bat` and open http://127.0.0.1:8765.

### Provider fallback order

- `geed-agent` starts with local Ollama.
- `geed-agent-openai` tries OpenAI → Anthropic → Gemini → local Ollama.
- `geed-agent-anthropic` tries Anthropic → Gemini → OpenAI → local Ollama.
- `geed-agent-gemini` tries Gemini → OpenAI → Anthropic → local Ollama.

Set the desired alias in `GEED_LLM_MODEL`. Add each provider's API key and an account-enabled model ID to `.env`. The sample model IDs are examples; availability depends on the provider account. LiteLLM retries and moves to the next model for supported provider/rate-limit errors. If all configured routes fail, the task stops rather than pretending it succeeded.

### Memory and workflow

- Successful task summaries are stored in `browser-agent/data/geed-agent.sqlite`.
- LangGraph checkpoints are stored in `browser-agent/data/geed-workflow.sqlite`.
- The browser chat page stores a session/thread ID in local storage. Related task history can be recalled in later tasks within that session.
- Secret-like values and email addresses are redacted before saving; no screenshots or cookies are stored. A local control clears memory.

### Safety

- Browser automation is restricted to `GEED_ALLOWED_DOMAINS`, defaulting to `geed-hardwin.vercel.app`. Add other domains explicitly in `.env`.
- Delete, send, publish, purchase, payment/transfer and account-change tasks request confirmation in the local agent UI.
- The agent is instructed not to enter passwords, change security settings, pay, bypass CAPTCHAs/paywalls, or follow instructions embedded in untrusted pages.
- Keep ports 4000, 8765 and 9222 bound to loopback. Do not expose them publicly. A future tunnel needs authentication and security review.

## Open-source components

- https://github.com/browser-use/browser-use — MIT; browser operator and CDP interaction.
- https://github.com/BerriAI/litellm — MIT; LLM gateway and fallback routing.
- https://github.com/langchain-ai/langgraph — MIT; stateful workflows and checkpoints.
- https://github.com/mem0ai/mem0 — Apache-2.0; evaluated as a future semantic-memory upgrade. The current first version uses SQLite to avoid requiring embeddings/vector services.
