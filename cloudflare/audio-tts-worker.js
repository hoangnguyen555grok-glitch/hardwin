const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const GOOGLE_VOICES = new Set(["vi-VN-Standard-A", "vi-VN-Standard-B", "vi-VN-Standard-C", "vi-VN-Standard-D"]);
const AZURE_VOICES = new Set(["vi-VN-HoaiMyNeural", "vi-VN-NamMinhNeural"]);
const TTSAI_VOICES = new Set(["vi_VN-vivos-x_low"]);
const MAX_REQUEST_BYTES = 24000;
const RATE_LIMIT_WINDOW = 60;
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
    headers.set("Access-Control-Allow-Headers", "Content-Type, X-Turnstile-Token");
    headers.set("Access-Control-Max-Age", "86400");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function errorResponse(message, status = 400, headers = {}) {
  return json({ error: message }, status, headers);
}

async function verifyTurnstile(token, clientIp, env) {
  if (!env.TURNSTILE_SECRET_KEY || !token || token.length > 2048) return false;
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET_KEY);
  form.append("response", token);
  form.append("remoteip", clientIp);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form
    });
    const result = await response.json().catch(() => ({}));
    return response.ok && result.success === true &&
      result.hostname === "geed-hardwin.vercel.app" && result.action === "tts";
  } catch {
    return false;
  }
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


function detectAudioContentType(buffer, declaredType = "") {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) {
    return "audio/wav";
  }
  if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return "audio/mpeg";
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "audio/mpeg";
  return declaredType.startsWith("audio/") ? declaredType : "";
}

async function fetchTtsAi(text, voice, speed) {
  if (text.length > 500) throw new Error("Gói TTS.ai miễn phí ẩn danh giới hạn 500 ký tự mỗi lượt. Hãy tách lời thoại thành các đoạn ngắn.");
  const selectedVoice = TTSAI_VOICES.has(voice) ? voice : "vi_VN-vais1000-medium";
  const response = await fetch("https://api.tts.ai/v1/tts/", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "audio/mpeg, application/json" },
    body: JSON.stringify({
      model: "piper", language: "vi", text, voice: selectedVoice, format: "mp3",
      speed: Math.max(0.75, Math.min(1.25, speed))
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error("TTS.ai từ chối yêu cầu (HTTP " + response.status + "). " + detail.slice(0, 180));
  }
  const contentType = response.headers.get("content-type") || "";
  if (contentType.startsWith("audio/") || contentType === "application/octet-stream") {
    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength) throw new Error("TTS.ai trả về file âm thanh rỗng.");
    const detectedType = detectAudioContentType(bytes, contentType);
    if (!detectedType) throw new Error("TTS.ai trả về định dạng âm thanh không nhận diện được.");
    return new Response(bytes, { status: 200, headers: { "content-type": detectedType, "cache-control": "no-store" } });
  }
  const job = await response.json().catch(() => ({}));
  if (!job.uuid) throw new Error("TTS.ai không trả về MP3 hoặc mã tác vụ hợp lệ.");
  for (let attempt = 0; attempt < 24; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    const poll = await fetch("https://api.tts.ai/v1/speech/results/?uuid=" + encodeURIComponent(job.uuid), {
      headers: { "Accept": "application/json" }
    });
    const result = await poll.json().catch(() => ({}));
    if (!poll.ok) throw new Error("TTS.ai không thể kiểm tra trạng thái tác vụ (HTTP " + poll.status + ").");
    if (result.status === "failed") throw new Error("TTS.ai không thể hoàn tất tác vụ tổng hợp.");
    if (result.status === "completed" && result.result_url) {
      const resultUrl = new URL(result.result_url);
      if (!["https://api.tts.ai", "https://cdn.tts.ai"].includes(resultUrl.origin)) throw new Error("TTS.ai trả về địa chỉ tải âm thanh không hợp lệ.");
      const download = await fetch(resultUrl.toString(), { headers: { "Accept": "audio/mpeg" } });
      if (!download.ok) throw new Error("Không tải được MP3 đã tạo từ TTS.ai (HTTP " + download.status + ").");
      const bytes = await download.arrayBuffer();
      if (!bytes.byteLength) throw new Error("TTS.ai trả về file âm thanh rỗng.");
      const detectedType = detectAudioContentType(bytes, download.headers.get("content-type") || "");
      if (!detectedType) throw new Error("TTS.ai trả về định dạng âm thanh không nhận diện được.");
      return new Response(bytes, { status: 200, headers: { "content-type": detectedType, "cache-control": "no-store" } });
    }
  }
  throw new Error("TTS.ai xử lý quá lâu. Hãy thử lại với một đoạn văn ngắn hơn.");
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
          azure: env.AZURE_TTS_ENABLED === "true" && Boolean(env.AZURE_SPEECH_KEY && env.AZURE_SPEECH_REGION),
          ttsdotai: env.TTSAI_TTS_ENABLED === "true"
        },
        maxCharacters: 500,
        dailyCharactersPerIp: 5000,
        outputFormat: "mp3-or-wav",
        security: {
          turnstileRequired: Boolean(env.TURNSTILE_SECRET_KEY),
          rateLimitRequired: true,
          rateLimitBindingAvailable: Boolean(env.TTS_RATE_LIMITER && typeof env.TTS_RATE_LIMITER.limit === "function"),
          azureF0RateLimitBindingAvailable: Boolean(env.AZURE_F0_RATE_LIMITER && typeof env.AZURE_F0_RATE_LIMITER.limit === "function"),
          ttsAiRateLimitBindingAvailable: Boolean(env.TTSAI_RATE_LIMITER && typeof env.TTSAI_RATE_LIMITER.limit === "function")
        }
      }), origin);
    }
    if (request.method !== "POST" || url.pathname !== "/tts") {
      return withCors(errorResponse("Không tìm thấy endpoint.", 404), origin);
    }

    // Fail closed if the Cloudflare rate-limit binding is missing.
    const clientIp = request.headers.get("CF-Connecting-IP");
    if (!clientIp || !env.TTS_RATE_LIMITER || typeof env.TTS_RATE_LIMITER.limit !== "function") {
      return withCors(errorResponse("Dịch vụ TTS chưa có lớp bảo vệ lưu lượng. Vui lòng thử lại sau.", 503), origin);
    }
    try {
      const { success } = await env.TTS_RATE_LIMITER.limit({ key: clientIp });
      if (!success) return withCors(errorResponse("Bạn đã gửi quá nhiều yêu cầu. Vui lòng đợi một phút rồi thử lại.", 429, {
        "Retry-After": String(RATE_LIMIT_WINDOW)
      }), origin);
    } catch {
      return withCors(errorResponse("Không xác minh được giới hạn lưu lượng. Yêu cầu đã bị chặn an toàn.", 503), origin);
    }

    const contentType = request.headers.get("Content-Type") || "";
    if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
      return withCors(errorResponse("Chỉ chấp nhận yêu cầu JSON.", 415), origin);
    }
    const declaredLength = Number(request.headers.get("Content-Length") || 0);
    if (declaredLength > MAX_REQUEST_BYTES) {
      return withCors(errorResponse("Yêu cầu vượt quá dung lượng cho phép.", 413), origin);
    }

    if (!(env.FPT_TTS_ENABLED === "true" && env.FPT_TTS_API_KEY && env.FPT_TTS_API_URL && env.FPT_TTS_MODEL) && !(env.GOOGLE_TTS_ENABLED === "true" && env.GOOGLE_TTS_API_KEY) && !(env.AZURE_TTS_ENABLED === "true" && env.AZURE_SPEECH_KEY && env.AZURE_SPEECH_REGION) && env.TTSAI_TTS_ENABLED !== "true") {
      return withCors(errorResponse("Chưa bật nhà cung cấp giọng đọc nào trên máy chủ.", 503), origin);
    }

    try {
      const rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
        return withCors(errorResponse("Yêu cầu vượt quá dung lượng cho phép.", 413), origin);
      }
      let body;
      try { body = JSON.parse(rawBody); }
      catch { return withCors(errorResponse("Dữ liệu JSON không hợp lệ."), origin); }
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return withCors(errorResponse("Dữ liệu yêu cầu không hợp lệ."), origin);
      }
      const provider = ["fpt", "google", "azure", "ttsdotai"].includes(body?.provider) ? body.provider : null;
      const text = typeof body?.text === "string" ? body.text.trim() : "";
      const voice = typeof body?.voice === "string" ? body.voice : "";
      const speed = Number.isFinite(Number(body?.speed)) ? Number(body.speed) : 1;
      if (!provider) return withCors(errorResponse("Nhà cung cấp không hợp lệ."), origin);
      if (text.length < 3 || text.length > 5000) return withCors(errorResponse("Văn bản phải từ 3 đến 5.000 ký tự."), origin);
      if (provider === "fpt" && !(env.FPT_TTS_ENABLED === "true" && env.FPT_TTS_API_KEY && env.FPT_TTS_API_URL && env.FPT_TTS_MODEL)) return withCors(errorResponse("FPT AI Factory đang khóa hoặc chưa cấu hình đầy đủ. Chỉ bật khi đã có voucher/hạn mức an toàn.", 503), origin);
      if (provider === "ttsdotai" && env.TTSAI_TTS_ENABLED !== "true") return withCors(errorResponse("TTS.ai Piper đang khóa trên máy chủ.", 503), origin);
      if (provider === "ttsdotai" && text.length > 500) return withCors(errorResponse("Gói TTS.ai miễn phí ẩn danh giới hạn 500 ký tự mỗi lượt.", 413), origin);
      if (provider === "google" && !(env.GOOGLE_TTS_ENABLED === "true" && env.GOOGLE_TTS_API_KEY)) return withCors(errorResponse("Google TTS đang khóa hoặc chưa cấu hình đầy đủ. Chỉ bật sau khi đặt giới hạn chi tiêu.", 503), origin);
      if (provider === "fpt" && voice !== "auto" && (typeof voice !== "string" || voice.length > 120)) return withCors(errorResponse("Mã giọng FPT không hợp lệ."), origin);
      if (provider === "google" && !GOOGLE_VOICES.has(voice)) return withCors(errorResponse("Giọng Google không hợp lệ."), origin);
      if (provider === "azure" && !AZURE_VOICES.has(voice)) return withCors(errorResponse("Giọng Azure không hợp lệ."), origin);
      if (provider === "ttsdotai" && !TTSAI_VOICES.has(voice)) return withCors(errorResponse("Giọng Piper tiếng Việt không hợp lệ."), origin);
      if (provider === "azure" && !(env.AZURE_TTS_ENABLED === "true" && env.AZURE_SPEECH_KEY && env.AZURE_SPEECH_REGION)) return withCors(errorResponse("Azure Speech đang khóa hoặc chưa cấu hình tài nguyên F0.", 503), origin);
      if (provider === "ttsdotai") {
        if (!env.TTSAI_RATE_LIMITER || typeof env.TTSAI_RATE_LIMITER.limit !== "function") {
          return withCors(errorResponse("TTS.ai chưa có lớp giới hạn lưu lượng riêng. Yêu cầu đã bị chặn an toàn.", 503), origin);
        }
        try {
          const { success } = await env.TTSAI_RATE_LIMITER.limit({ key: "ttsai-free-anonymous" });
          if (!success) return withCors(errorResponse("Nguồn Piper miễn phí đang nhận nhiều yêu cầu. Vui lòng đợi một phút rồi thử lại.", 429, {
            "Retry-After": String(RATE_LIMIT_WINDOW)
          }), origin);
        } catch {
          return withCors(errorResponse("Không xác minh được giới hạn lưu lượng TTS.ai. Yêu cầu đã bị chặn an toàn.", 503), origin);
        }
      }

      if (provider === "azure") {
        if (!env.AZURE_F0_RATE_LIMITER || typeof env.AZURE_F0_RATE_LIMITER.limit !== "function") {
          return withCors(errorResponse("Azure F0 chưa có lớp giới hạn lưu lượng riêng. Yêu cầu đã bị chặn an toàn.", 503), origin);
        }
        try {
          const { success } = await env.AZURE_F0_RATE_LIMITER.limit({ key: "azure-speech-f0" });
          if (!success) return withCors(errorResponse("Azure F0 đang nhận nhiều yêu cầu. Vui lòng đợi một phút rồi thử lại.", 429, {
            "Retry-After": String(RATE_LIMIT_WINDOW)
          }), origin);
        } catch {
          return withCors(errorResponse("Không xác minh được hạn mức Azure F0. Yêu cầu đã bị chặn an toàn.", 503), origin);
        }
      }

      const turnstileToken = request.headers.get("X-Turnstile-Token") || "";
      if (!await verifyTurnstile(turnstileToken, clientIp, env)) {
        return withCors(errorResponse("Không xác minh được yêu cầu bảo mật. Hãy tải lại trang và thử lại.", 403), origin);
      }

      const audio = provider === "fpt"
        ? await fetchFpt(text, voice, speed, env)
        : provider === "google" ? await fetchGoogle(text, voice, speed, env)
        : provider === "azure" ? await fetchAzure(text, voice, speed, env)
        : await fetchTtsAi(text, voice, speed);
      const headers = new Headers(audio.headers);
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Vary", "Origin");
      headers.set("Access-Control-Expose-Headers", "Content-Type");
      headers.set("Cache-Control", "no-store");
      headers.set("X-Content-Type-Options", "nosniff");
      return new Response(audio.body, { status: audio.status, headers });
    } catch (error) {
      // Never return upstream provider details or credential-related diagnostics to browsers.
      return withCors(errorResponse("Nhà cung cấp giọng nói chưa thể xử lý yêu cầu. Vui lòng thử lại sau.", 502), origin);
    }
  }
};
