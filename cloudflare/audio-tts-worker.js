const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const GOOGLE_VOICES = new Set(["vi-VN-Standard-A", "vi-VN-Standard-B", "vi-VN-Standard-C", "vi-VN-Standard-D"]);
const AZURE_VOICES = new Set(["vi-VN-HoaiMyNeural", "vi-VN-NamMinhNeural"]);
function xmlEscape(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });
}

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.GEED_ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : null;
}

function withCors(response, origin) {
  const headers = new Headers(response.headers);
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Max-Age", "86400");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function errorResponse(message, status = 400) {
  return json({ error: message }, status);
}

async function fetchFpt(text, voice, speed, env) {
  if (env.FPT_TTS_ENABLED !== "true" || !env.FPT_TTS_API_KEY || !env.FPT_TTS_API_URL || !env.FPT_TTS_MODEL) {
    throw new Error("FPT AI Factory đang khóa để tránh phát sinh phí. Chỉ bật sau khi đã có voucher/hạn mức chi tiêu an toàn.");
  }
  const endpoint = new URL(env.FPT_TTS_API_URL);
  if (endpoint.protocol !== "https:") throw new Error("FPT TTS API URL phải dùng HTTPS.");
  const payload = {
    model: env.FPT_TTS_MODEL,
    input: text,
    speed: Math.max(0.75, Math.min(1.25, speed)),
    response_format: "mp3"
  };
  if (voice && voice !== "auto") payload.voice = voice;
  else if (env.FPT_TTS_DEFAULT_VOICE) payload.voice = env.FPT_TTS_DEFAULT_VOICE;
  const response = await fetch(endpoint.toString(), {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + env.FPT_TTS_API_KEY,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg"
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error("FPT AI Factory TTS lỗi HTTP " + response.status + (detail ? ": " + detail.slice(0, 240) : ""));
  }
  const type = response.headers.get("content-type") || "audio/mpeg";
  if (!type.startsWith("audio/") && type !== "application/octet-stream") {
    const detail = await response.text().catch(() => "");
    throw new Error("FPT AI Factory không trả file âm thanh: " + detail.slice(0, 240));
  }
  return new Response(response.body, { status: 200, headers: { "content-type": type, "cache-control": "no-store" } });
}
function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function fetchAzure(text, voice, speed, env) {
  if (env.AZURE_TTS_ENABLED !== "true" || !env.AZURE_SPEECH_KEY || !env.AZURE_SPEECH_REGION) {
    throw new Error("Azure Speech đang khóa hoặc chưa cấu hình. Chỉ bật với tài nguyên F0 miễn phí.");
  }
  const region = String(env.AZURE_SPEECH_REGION).toLowerCase();
  if (!/^[a-z0-9-]+$/.test(region)) throw new Error("Azure Speech region không hợp lệ.");
  const selectedVoice = AZURE_VOICES.has(voice) ? voice : "vi-VN-HoaiMyNeural";
  const rate = Math.round((Math.max(0.75, Math.min(1.25, speed)) - 1) * 100);
  const rateText = (rate >= 0 ? "+" : "") + rate + "%";
  const ssml = '<speak version="1.0" xml:lang="vi-VN"><voice name="' + selectedVoice + '"><prosody rate="' + rateText + '">' + xmlEscape(text) + '</prosody></voice></speak>';
  const response = await fetch("https://" + region + ".tts.speech.microsoft.com/cognitiveservices/v1", {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": env.AZURE_SPEECH_KEY,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3"
    },
    body: ssml
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error("Azure Speech lỗi HTTP " + response.status + (detail ? ": " + detail.slice(0, 240) : ""));
  }
  return new Response(response.body, { status: 200, headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
}

async function fetchGoogle(text, voice, speed, env) {
  const response = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.GOOGLE_TTS_API_KEY },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: "vi-VN", name: voice },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: Math.max(0.75, Math.min(1.25, speed))
      }
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.audioContent) {
    const detail = payload.error?.message || "Google Cloud TTS không tạo được âm thanh.";
    throw new Error(detail);
  }
  return new Response(decodeBase64(payload.audioContent), {
    status: 200,
    headers: { "content-type": "audio/mpeg", "cache-control": "no-store" }
  });
}

export default {
  async fetch(request, env) {
    const origin = allowedOrigin(request, env);
    if (request.method === "OPTIONS") {
      if (!origin) return errorResponse("Origin không được phép.", 403);
      return withCors(new Response(null, { status: 204 }), origin);
    }
    if (!origin) return errorResponse("Origin không được phép. Hãy cấu hình GEED_ALLOWED_ORIGINS trong Worker.", 403);

    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/status") {
      return withCors(json({
        providers: {
          fpt: env.FPT_TTS_ENABLED === "true" && Boolean(env.FPT_TTS_API_KEY && env.FPT_TTS_API_URL && env.FPT_TTS_MODEL),
          google: env.GOOGLE_TTS_ENABLED === "true" && Boolean(env.GOOGLE_TTS_API_KEY),
          azure: env.AZURE_TTS_ENABLED === "true" && Boolean(env.AZURE_SPEECH_KEY && env.AZURE_SPEECH_REGION)
        },
        maxCharacters: 5000,
        outputFormat: "mp3"
      }), origin);
    }
    if (request.method !== "POST" || url.pathname !== "/tts") {
      return withCors(errorResponse("Không tìm thấy endpoint.", 404), origin);
    }
    if (!(env.FPT_TTS_ENABLED === "true" && env.FPT_TTS_API_KEY && env.FPT_TTS_API_URL && env.FPT_TTS_MODEL) && !(env.GOOGLE_TTS_ENABLED === "true" && env.GOOGLE_TTS_API_KEY) && !(env.AZURE_TTS_ENABLED === "true" && env.AZURE_SPEECH_KEY && env.AZURE_SPEECH_REGION)) {
      return withCors(errorResponse("Chưa bật nhà cung cấp nào. FPT và Google đang khóa mặc định để tránh chi phí ngoài ý muốn.", 503), origin);
    }

    try {
      const body = await request.json();
      const provider = ["fpt", "google", "azure"].includes(body?.provider) ? body.provider : null;
      const text = typeof body?.text === "string" ? body.text.trim() : "";
      const voice = typeof body?.voice === "string" ? body.voice : "";
      const speed = Number.isFinite(Number(body?.speed)) ? Number(body.speed) : 1;
      if (!provider) return withCors(errorResponse("Nhà cung cấp không hợp lệ."), origin);
      if (text.length < 3 || text.length > 5000) return withCors(errorResponse("Văn bản phải từ 3 đến 5.000 ký tự."), origin);
      if (provider === "fpt" && !(env.FPT_TTS_ENABLED === "true" && env.FPT_TTS_API_KEY && env.FPT_TTS_API_URL && env.FPT_TTS_MODEL)) return withCors(errorResponse("FPT AI Factory đang khóa hoặc chưa cấu hình đầy đủ. Chỉ bật khi đã có voucher/hạn mức an toàn.", 503), origin);
      if (provider === "google" && !(env.GOOGLE_TTS_ENABLED === "true" && env.GOOGLE_TTS_API_KEY)) return withCors(errorResponse("Google TTS đang khóa hoặc chưa cấu hình đầy đủ. Chỉ bật sau khi đặt giới hạn chi tiêu.", 503), origin);
      if (provider === "fpt" && voice !== "auto" && (typeof voice !== "string" || voice.length > 120)) return withCors(errorResponse("Mã giọng FPT không hợp lệ."), origin);
      if (provider === "google" && !GOOGLE_VOICES.has(voice)) return withCors(errorResponse("Giọng Google không hợp lệ."), origin);\n      if (provider === "azure" && !AZURE_VOICES.has(voice)) return withCors(errorResponse("Giọng Azure không hợp lệ."), origin);\n      if (provider === "azure" && !(env.AZURE_TTS_ENABLED === "true" && env.AZURE_SPEECH_KEY && env.AZURE_SPEECH_REGION)) return withCors(errorResponse("Azure Speech đang khóa hoặc chưa cấu hình tài nguyên F0.", 503), origin);

      const audio = provider === "fpt"
        ? await fetchFpt(text, voice, speed, env)
        : provider === "google" ? await fetchGoogle(text, voice, speed, env) : await fetchAzure(text, voice, speed, env);
      const headers = new Headers(audio.headers);
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Vary", "Origin");
      headers.set("Access-Control-Expose-Headers", "Content-Type");
      headers.set("Cache-Control", "no-store");
      headers.set("X-Content-Type-Options", "nosniff");
      return new Response(audio.body, { status: audio.status, headers });
    } catch (error) {
      return withCors(errorResponse(error?.message || "Lỗi tổng hợp giọng nói.", 502), origin);
    }
  }
};
