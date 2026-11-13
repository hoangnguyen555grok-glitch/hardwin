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

The local MCP server in `mcp_server.py` exposes these as typed tools over Streamable HTTP at:

`http://127.0.0.1:8766/mcp`

This is a local endpoint only. ChatGPT's cloud service cannot call `127.0.0.1` on your PC. To connect ChatGPT, the local MCP endpoint must later be exposed through a trusted tunnel or hosted relay with authentication. Do **not** expose this unauthenticated local server to the public Internet. The server intentionally binds to loopback only.

After the authenticated endpoint exists, a private ChatGPT MCP plugin/connector can point to that endpoint. The plugin package cannot be completed with a working URL before the tunnel and authentication are set up.

## Path 2 — Free local chatbot using Browser Use + Ollama

This is a separate local assistant with its own chat page. It uses:

- Browser Use (open source, MIT) to drive a Chromium DevTools Protocol browser;
- Ollama to run a local model, so no paid model API key is required;
- Playwright/CDP attachment to connect to an Opera instance that exposes a CDP endpoint.

The model runs on your computer. It is not a copy of the current ChatGPT conversation and does not inherit this chat's memory. Local model quality and speed depend on the computer's RAM/GPU.

### Windows setup

1. Install Python 3.11 or newer (64-bit). A local model such as Llama 3.1 8B needs about 8 GB of available RAM; the model download is roughly 4.9 GB.
2. Install Ollama from https://ollama.com/ and make sure it is running.
3. Run `setup_windows.bat`.
4. Open `start_opera_debug.bat`. It launches a **separate Opera profile** with remote debugging on port 9222. This avoids exposing your everyday browser profile to the automation agent. Sign in to Geed Hardwin in this separate window.
5. In a command prompt, run `ollama pull llama3.1:8b`.
6. Run `start_assistant.bat`, then open http://127.0.0.1:8765.
7. Type a task such as “Check the current timeline and tell me how many layers are in the scene”.

The local assistant UI binds to `127.0.0.1` only and restricts browser automation to `geed-hardwin.vercel.app`.

### MCP local-client setup

Run `start_mcp.bat` after starting the Opera debug window. A local MCP client can connect to:

`http://127.0.0.1:8766/mcp`

To let ChatGPT cloud connect, configure an authenticated tunnel first. No public tunnel is configured in this starter kit.

## Current limitations

- Opera is Chromium-based, and Playwright can attach to Chromium browsers over CDP. However, this exact Opera installation/launch path has not been tested on the user's computer yet.
- The in-editor AI Bridge v1.12 has a small built-in command demo, not a connected generative model.
- Path 1 still needs an authenticated public MCP route before ChatGPT can call the tools from a cloud conversation.
- Path 2 is a separate local chatbot. It does not connect to this ChatGPT thread.
- Browser agents can make mistakes. Keep the browser on Geed Hardwin, inspect destructive changes, and do not let the local agent handle passwords, payment pages, or unrelated private tabs.

## Sources

- Browser Use source and license: https://github.com/browser-use/browser-use
- Ollama model example: https://github.com/browser-use/browser-use/blob/main/examples/models/ollama.py
- Playwright CDP docs: https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp
- Opera extension and Chromium compatibility: https://help.opera.com/en/extensions/
