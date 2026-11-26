# Geed Hardwin — Local Voice Engine

This small local service connects the **Giọng nói & lời thoại** page to VieNeu-TTS v3 Turbo.

## What it does

1. The browser sends the text and selected preset voice to `127.0.0.1:8000`.
2. VieNeu-TTS generates Vietnamese speech locally.
3. The browser receives a WAV-compatible PCM response, previews it, and can download it.
4. The user can hand the audio directly to the Geed editor. The handoff uses browser IndexedDB in the same browser profile; the audio file is not uploaded to Geed, Notion, Supabase, or another cloud bucket.

The service binds to **127.0.0.1 only**. CORS is restricted to the exact Geed website origin supplied when starting the service. A wildcard origin is rejected.

## Model and cost

- Model: [VieNeu-TTS v3 Turbo](https://huggingface.co/pnnbao-ump/VieNeu-TTS-v3-Turbo)
- Source: [pnnbao97/VieNeu-TTS](https://github.com/pnnbao97/VieNeu-TTS)
- License: Apache-2.0 for the v3 Turbo model, bundled preset voices, and generated speech. Keep the upstream attribution and license notices when redistributing.
- Local inference: CPU/ONNX is supported; NVIDIA CUDA is optional.
- The first run downloads the model files from Hugging Face. Thereafter synthesis can run offline.
- No per-character, per-minute, or API credit charge. The computer still uses its own CPU/GPU, electricity, RAM, and disk space.

The upstream README's published CPU benchmark is approximately RTF 0.55–0.62 on a 12th-gen Core i5 for v3 Turbo fp32 (about 6 seconds to generate 10 seconds of audio). This is a benchmark, not a guarantee for every computer.

## Windows quick start

Requirements: Windows 10/11, Python 3.10 or newer, and an internet connection for the first install/model download.

1. Start the Geed website in your browser and copy its **origin only**. Example: `https://your-project.pages.dev` (no page path and no trailing slash).
2. Double-click `start-windows.bat`.
3. Paste that exact origin when prompted.
4. Wait for the first-time installation and model download to finish.
5. Keep the terminal window open while generating speech in Geed.

The service address is `http://127.0.0.1:8000`. The API follows the upstream VieNeu OpenAI-compatible routes:
- `GET /health`
- `GET /v1/voices`
- `POST /v1/audio/speech`

## Manual setup

From this folder:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt

$env:GEED_AUDIO_ORIGINS = "https://your-project.pages.dev"
$env:HOST = "127.0.0.1"
$env:PORT = "8000"
python server.py
```

For local development, set the origin to the exact local editor origin, for example `http://localhost:3000`.

## Voice generation flow

The browser requests 48 kHz mono PCM from VieNeu and wraps the completed bytes with a standard WAV header. The generated Blob is only held in browser memory until the user downloads it or chooses **Đưa vào trình biên tập**. That action stores the Blob temporarily in same-origin IndexedDB and transfers it into the existing Geed audio import path. It does not create a server-side media library.

## Voice cloning

The UI initially exposes only the built-in preset voices. Custom voice cloning is intentionally not enabled in this first integration. Only add a reference voice when you have the speaker's permission and the rights to use the recording.

## Troubleshooting

- **CORS / origin blocked:** restart the service and enter the exact origin currently shown in the browser address bar. An origin contains scheme + host + optional port only.
- **Connection refused:** ensure the terminal window is still running and visit `http://127.0.0.1:8000/health`.
- **First connection is slow:** the model is loading or downloading. Keep the service window open.
- **Model or dependency error:** check that Python is 3.10+ and rerun `pip install -r requirements.txt`.

## Attribution

This integration uses VieNeu-TTS by Phạm Nguyễn Ngọc Bảo. The model repository and v3 Turbo model card publish Apache License 2.0 terms. Refer to the upstream [LICENSE](https://github.com/pnnbao97/VieNeu-TTS/blob/main/LICENSE) and [model card licensing FAQ](https://huggingface.co/pnnbao-ump/VieNeu-TTS-v3-Turbo).
