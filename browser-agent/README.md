# Legacy local-agent prototype — archived

> **Not part of the current Geed Hardwin application. Do not install or run this prototype.**

This folder contains an earlier local experiment built around Browser Use, Opera/CDP, LiteLLM, LangGraph and SQLite. It does not implement the approved cloud-only AI architecture and is not connected to the production editor.

The current project requirements are documented in [../docs/GOAL8-CLOUD-AI-PLAN.md](../docs/GOAL8-CLOUD-AI-PLAN.md).

## Why these files remain temporarily

The prototype has not yet been deleted because its references and CI workflow must be checked first. Keeping it on this working branch avoids accidentally removing editor functionality or useful test coverage while the audit is in progress.

## Current status

- No local model or Ollama installation is required by Geed Hardwin.
- No Opera remote-debugging session is required by Geed Hardwin.
- No local Python agent or LiteLLM proxy is used by the production editor.
- No cloud AI backend/provider integration has been deployed yet.
- Do not put provider API keys in frontend code or commit them to this repository.

This folder is retained only as legacy source pending the final dependency and reference audit.
