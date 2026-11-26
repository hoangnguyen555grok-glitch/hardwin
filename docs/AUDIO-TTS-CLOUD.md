# Geed Hardwin — Cloud TTS setup

This integration routes TTS.ai Vietnamese Piper, Azure Speech F0, FPT AI Factory, and Google Cloud Text-to-Speech through the Cloudflare Worker `geed-audio-tts`.

## Safety defaults

The Worker is deployed but provider generation is closed by default:
- `GEED_ALLOWED_ORIGINS` allows only `https://geed-hardwin.vercel.app`; requests from other browser origins are rejected.
- TTS.ai, Azure, FPT, and Google provider flags must each be explicitly set to the literal string `true`.
- Every generation request must pass Cloudflare Turnstile Siteverify with the expected hostname and `tts` action.
- Every generation request must pass the Cloudflare `TTS_RATE_LIMITER` binding: 4 requests per client IP per 60 seconds.
- TTS.ai requests additionally pass `TTSAI_RATE_LIMITER`: 2 requests per 60 seconds per Cloudflare location, to protect its anonymous free allowance.
- Azure requests additionally pass `AZURE_F0_RATE_LIMITER`: 15 requests per 60 seconds per Cloudflare location, leaving headroom below Azure F0's documented 20 transactions per 60 seconds. Missing bindings or client IP fail closed.
- Request bodies are limited to 24,000 bytes and JSON only; the text itself is limited to 5,000 characters.
- Provider errors are sanitized before they are returned to the browser; credentials and upstream diagnostics are not exposed.
- Cloudflare's Rate Limiting API is location-local and best-effort, not a strict global counter. The Azure limiter's 15/60 threshold applies per Cloudflare location, not globally across all locations. Turnstile and rate limits reduce abuse but do not guarantee the Azure subscription-wide quota; monitor the Azure F0 quota and do not share the endpoint as an unrestricted public service.
- Provider credentials are Worker secrets only. Never put API keys in `audio.html`, browser storage, GitHub, or chat.
- No provider request is made until the user presses **Tạo giọng nói**.
- Generated audio is streamed to the browser; the Worker does not save it to R2, KV, D1, Supabase, or Notion.

## TTS.ai — Vietnamese Piper (current free candidate)

Geed uses the anonymous TTS.ai API with the open-source Piper model for Vietnamese. The documented anonymous free tier:
- No account or API key required.
- 5,000 characters per day per source IP.
- 500 characters per request.
- 10 requests per minute and 2 concurrent requests.
- Free models include Piper, VITS, MeloTTS and Kokoro; the API selects or accepts the Piper model for Vietnamese.
- Geed currently selects the Piper Vietnamese voice ID `vi_VN-vivos-x_low` (VIVOS; the live TTS.ai voice catalog reports neutral gender).

API:
- Voice catalog: `GET https://api.tts.ai/v1/voices/?model=piper&language=vi`
- Synthesis: `POST https://api.tts.ai/v1/tts/`
- Body: `{"model":"piper","language":"vi","text":"...","voice":"vi_VN-vivos-x_low","format":"mp3","speed":1}`
- Anonymous calls omit Authorization. The API may return binary audio directly or a queued job UUID; Geed handles both and validates the final download host. The live API currently labels a RIFF/WAVE payload as `audio/mpeg` and uses a `.mp3` URL; the Worker inspects the RIFF/WAVE signature and correctly returns it as `audio/wav`. The browser names the file `.wav` and labels the player accordingly. If the service returns genuine MP3 bytes later, Geed keeps `audio/mpeg` and `.mp3`.

Important limits and use conditions:
- The 5,000-character daily quota is per source IP, not a guaranteed project-wide allowance. Cloudflare Worker egress may be shared; actual usable daily capacity can be lower if the upstream groups requests by egress IP.
- Free anonymous requests are capped at 500 characters each. The voice workspace enforces that limit. Create several short voice clips and place them separately on the editor timeline for longer narration.
- The free tier's generated audio is for personal, non-commercial use only according to TTS.ai's published terms. Do not use this free tier for monetized videos, client work, ads or other commercial output unless you obtain a suitable license.
- TTS.ai is a hosted third-party service, not a guaranteed community resource. Its limits, model availability, queue time and terms may change. It has no SLA for this free tier.
- Text is sent to TTS.ai for synthesis. Do not submit confidential, personal or sensitive text unless that external processing is acceptable.
- Geed does not persist generated audio: it streams the MP3 to the browser for preview and one-time editor handoff.

The previous unofficial Microsoft Edge TTS integration is no longer the active provider. Community reports describe persistent HTTP 403 failures against the Edge Read Aloud endpoint since October 2026; it remains archived in source for reference only and is not imported by the production Worker.

## FPT AI Factory

The former personal FPT.AI Console TTS service is retired. Use the current FPT AI Factory Serverless Inference / Voice Studio integration instead.

FPT AI Factory is pay-per-use and requires credits. Current published Voice Studio prices include FPT.TTS-pro at approximately USD 16.50 per million characters and FPT.TTS-ultra at approximately USD 99 per million characters. Do not enable this provider unless the account has a promotional voucher or the owner explicitly accepts a controlled credit spend.

1. In FPT AI Factory, open Serverless Inference → Voice Studio.
2. Choose a TTS model and inspect the price shown in the interface.
3. Use **View Code** to copy the exact gateway URL and request configuration for that model.
4. Use **Get API Keys** to create a key restricted to the required TTS model.
5. Store the key as the Cloudflare Worker secret `FPT_TTS_API_KEY`.
6. Set the Worker variables:
   - `FPT_TTS_API_URL`: exact HTTPS endpoint from View Code.
   - `FPT_TTS_MODEL`: exact model name from View Code, e.g. `FPT.TTS-ultra`.
   - `FPT_TTS_ENABLED`: keep `false` until a voucher/quota is verified; set to `true` only after that.
   - Optional `FPT_TTS_DEFAULT_VOICE`: exact voice identifier from View Code if using a model that requires a named voice. The UI's `auto` choice omits this field for models that auto-select a voice.
7. Check the workspace quota and Usage page before enabling. Keep a strict usage cap.

The Worker sends the documented TTS request shape: `model`, `input`, optional `voice`, `speed`, and `response_format: "mp3"`.

## Google Cloud Text-to-Speech

Google Standard voices currently include a published free allowance of 4 million characters/month. However, Google requires billing to be enabled and automatically charges usage beyond the free allowance. The free allowance is not an unconditional hard spending cap.

1. Create/select a Google Cloud project and enable Cloud Text-to-Speech.
2. Create an API key restricted to the Cloud Text-to-Speech API.
3. Set a billing budget and monitor usage. Budget alerts are notifications, not a hard stop.
4. Store the key as the Cloudflare Worker secret `GOOGLE_TTS_API_KEY`.
5. Keep `GOOGLE_TTS_ENABLED` unset/false until a hard usage-control strategy is confirmed. Set it to `true` only when you accept the billing configuration.

The UI currently exposes Vietnamese Standard voices A–D and MP3 output.

## Cloudflare Worker configuration

Worker name: `geed-audio-tts`

Worker URL: `https://geed-audio-tts.geed-hardwin.workers.dev`

The deployed Worker currently allows exactly `https://geed-hardwin.vercel.app` through `GEED_ALLOWED_ORIGINS`. This must match the browser origin exactly (scheme + hostname + optional port; no path). Do not add `*`.

Required secret names:
- `TURNSTILE_SECRET_KEY` — server-side Turnstile secret; never expose it in the browser.
- `AZURE_SPEECH_KEY` — only when Azure F0 is intentionally enabled.
- `FPT_TTS_API_KEY` — only when FPT is intentionally enabled.
- `GOOGLE_TTS_API_KEY` — only when Google is intentionally enabled.

Public frontend Turnstile sitekey: `0x4AAAAAAGT9EV5DiOxVQMlW` (restricted to `geed-hardwin.vercel.app`).

The Worker requires two Cloudflare Rate Limiting bindings:
- `TTS_RATE_LIMITER`: namespace ID `2026112601`, 4 requests per 60 seconds per client IP.
- `AZURE_F0_RATE_LIMITER`: namespace ID `2026112602`, 15 requests per 60 seconds per Cloudflare location using the shared key `azure-speech-f0`.
- `TTSAI_RATE_LIMITER`: namespace ID `2026112603`, 2 requests per 60 seconds per Cloudflare location using the shared key `ttsai-free-anonymous`.

Keep all three bindings attached; the Worker intentionally rejects requests if the relevant binding is missing.

Required variables:
- `GEED_ALLOWED_ORIGINS`
- `TTSAI_TTS_ENABLED` (default false; set to `true` to enable anonymous Vietnamese Piper synthesis)
- `FPT_TTS_ENABLED` (default false)
- `FPT_TTS_API_URL`
- `FPT_TTS_MODEL`
- `GOOGLE_TTS_ENABLED` (default false)
- `AZURE_TTS_ENABLED` (default false)
- `AZURE_SPEECH_REGION` (only when Azure is intentionally enabled)

## Audio handoff

The Worker returns the detected audio container (WAV or MP3). The browser creates an object URL for preview/download and temporarily stores the generated Blob in the existing one-time IndexedDB handoff. The editor consumes and deletes that record, then imports the file through its existing audio input to create a normal Audio track.

No speech model, Python runtime, local server, or large model download is required on the user's computer.

## Azure Speech F0 — optional fallback candidate

Microsoft Azure Speech offers 500,000 characters/month for Standard Neural text-to-speech on the Free (F0) tier. F0 quotas are fixed and not adjustable. The Vietnamese standard voices are `vi-VN-HoaiMyNeural` (female) and `vi-VN-NamMinhNeural` (male). The F0 tier must remain selected; do not upgrade the resource to Standard (S0), which is pay-as-you-go.

Official references:
- Azure free services and F0 allowance: https://azure.microsoft.com/en-gb/pricing/free-services/
- Speech F0 quotas (20 TTS transactions per 60 seconds): https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-services-quotas-and-limits
- Vietnamese voices: https://learn.microsoft.com/azure/ai-services/speech-service/language-support?tabs=tts
- REST API: https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/rest-text-to-speech

Configuration:
- `AZURE_TTS_ENABLED=false` by default.
- Worker secrets: `AZURE_SPEECH_KEY`.
- Worker variable: `AZURE_SPEECH_REGION` (e.g. `southeastasia`).
- Create an Azure Speech resource on Free (F0), never S0. The application will not auto-enable this provider.
- The service is invoked only after a user explicitly selects Azure and presses Generate.
