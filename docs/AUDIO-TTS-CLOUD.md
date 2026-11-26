# Geed Hardwin — Cloud TTS setup

This integration adds FPT AI Factory and Google Cloud Text-to-Speech through the Cloudflare Worker `geed-audio-tts`.

## Safety defaults

The Worker is deployed but closed by default:
- `GEED_ALLOWED_ORIGINS` is empty, so browser requests are rejected.
- `FPT_TTS_ENABLED` and `GOOGLE_TTS_ENABLED` must be explicitly set to the literal string `true`.
- Provider credentials are Worker secrets only. Never put API keys in `audio.html`, browser storage, GitHub, or chat.
- No provider request is made until the user presses **Tạo giọng nói**.
- Generated audio is streamed to the browser; the Worker does not save it to R2, KV, D1, Supabase, or Notion.

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
- `FPT_TTS_API_KEY`
- `GOOGLE_TTS_API_KEY`

Required variables:
- `GEED_ALLOWED_ORIGINS`
- `FPT_TTS_ENABLED` (default false)
- `FPT_TTS_API_URL`
- `FPT_TTS_MODEL`
- `GOOGLE_TTS_ENABLED` (default false)

## Audio handoff

The Worker returns MP3 bytes directly. The browser creates an object URL for preview/download and temporarily stores the generated Blob in the existing one-time IndexedDB handoff. The editor consumes and deletes that record, then imports the file through its existing audio input to create a normal Audio track.

No speech model, Python runtime, local server, or large model download is required on the user's computer.

## Azure Speech — preferred free-tier candidate

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
