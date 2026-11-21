# Geed Hardwin — Community-first resources

Reviewed: 2026-11-21

## Rule

Reuse maintained community projects, libraries, hosted APIs and free tiers before writing a replacement. Build only the small integration that is unique to Geed Hardwin. Do not replace the current editor wholesale unless a migration is demonstrably safer and better for existing projects.

All AI provider credentials remain server-side. A provider is enabled only when its account is configured and the owner has confirmed the eligible free tier. Free quotas are limited and may change; a source being open source does not make its hosted API unlimited or free.

## Integrated or available now

| Resource | Reuse in Geed Hardwin | License / cost note |
|---|---|---|
| [gifenc](https://github.com/mattdesl/gifenc) | GIF export adapter in `lib/gif-export.mjs`. Loaded only when GIF export is requested. Uses a shared palette across frames. | MIT; package pinned to 1.0.3. Loaded from esm.sh, with the existing offline encoder retained as a fallback if the CDN or library is unavailable. |
| [OpenRouter](https://openrouter.ai/) | Default AI text route can use `openrouter/free` or a specific model ID ending in `:free`. | Hosted free-model quota is limited. Never fall through to a paid model automatically. |
| [Groq](https://groq.com/) | OpenAI-compatible free-tier route. | Enabled only with Free-tier and billing-disabled confirmation flags. Check the account's current Free-tier model and rate limits first. |
| [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/) | OpenAI-compatible account endpoint for optional text inference. | Enabled only with Free-tier and billing-disabled confirmations plus account endpoint. Free-plan allowance/model availability must be checked in the account. |
| [Gemini Developer API](https://ai.google.dev/gemini-api/docs/pricing) | Existing native adapter can use a model on Google's Free tier. | Optional hosted free tier, not an open-source project. Requires both free-tier confirmation and a Google API project with billing disabled; features/model access vary and may change. |

## Evaluated, not adopted wholesale

| Community project | What it offers | Decision |
|---|---|---|
| [Mediabunny](https://github.com/Vanilagy/mediabunny) | Active TypeScript media toolkit for browser video/audio reading, writing and conversion; canvas/WebCodecs encoding for MP4/WebM. | Strong candidate to replace or complement the current MediaRecorder export path. Not yet wired in: audio-track parity, browser codec support, bundle size and download/save behaviour must be tested first. |
| [MyMotionStudio](https://github.com/rodolphe37/my-motion-studio) | MIT, offline-first browser 2D/3D motion editor with timeline, keyframes and media export. | Useful architecture and component reference. Do not import the whole React/Vite app into the existing single-page editor; that would be a major rewrite. |
| [AniCraft](https://github.com/storytold/anicraft) | MIT OR Apache-2.0, Rust 2D vector animation engine, WebAssembly build, command-oriented engine and MCP server. | Interesting future AI/engine reference. It is early alpha, its web build requires a Rust/WASM toolchain, has browser limitations and is not a drop-in JavaScript library. |
| [Flare](https://github.com/Flare-Animate/Flare) | BSD-3-Clause, Rust animation suite with browser/WASM build, derived from OpenToonz/Tahoma2D. | Early alpha and a complete editor suite, not a safe incremental dependency for the current project format. |
| [Animora](https://github.com/itsrajverma/animora) | MIT browser SVG animator with layers, keyframes, easing and SVG/WebM/PNG export. | Useful reference for SVG animation; narrower than Geed Hardwin's current editor and not adopted as a replacement. |

## AI generation beyond text

[Pollinations](https://github.com/pollinations/pollinations) exposes text, image, video, audio, embeddings, 3D and an MCP server. Its live model catalogue can be queried without authentication, but generation requires an API key and uses a prepaid wallet. Eligible community quests can earn Pollen, but those rewards vary and are not a guaranteed free allowance.

Pollinations Pay (BYOP) lets an individual user authorize Geed Hardwin to use that user's own Pollinations balance with PKCE OAuth, a model/budget/expiry-limited key and revocation. This could be an optional user-connected generation source later; it must not be silently enabled or presented as unlimited free AI. It also uses a separate Pollinations/GitHub authorization, not the Geed Hardwin Google-only sign-in.

## Deliberately not selected

- GitHub Models is not a current inference dependency; its service/API was sunset in July 2026.
- Flowise was archived in August 2026, so it is not selected as a new foundation.
- Self-hosting LiteLLM or Bifrost would add a separate gateway service and maintenance burden. The current hosted providers already expose the OpenAI-compatible protocol used by the small Geed Hardwin adapter.
- Do not replace the existing editor with a whole alternate application just because it is open source. Preserve current animation projects and add community components selectively.

## Next validation priorities

1. Evaluate Mediabunny against current MP4/WebM export only if real-browser testing exposes a measurable limitation.
2. Keep AI provider configuration free-only until the owner explicitly changes the policy.
3. Build the AI asset-library workflow around searching, selecting and manipulating user-provided resources rather than generating new images.
4. Before integrating a new community project, check the exact license, upstream activity, security posture, browser compatibility and whether it can be consumed as a component rather than a whole-app migration.
