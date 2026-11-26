const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const FPT_VOICES = new Set(["banmai", "lannhi", "leminh", "myan", "thuminh", "giahuy", "linhsan"]);
const GOOGLE_VOICES = new Set(["vi-VN-Standard-A", "vi-VN-Standard-B", "vi-VN-Standard-C", "vi-VN-Standard-D"]);

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
  const response = await fetch("https://api.fpt.ai/hmi/tts/v5", {
    method: "POST",
    headers: {
      "api_key": env.FPT_TTS_API_KEY,
      "voice": voice,
      "speed": String(Math.max(-3, Math.min(3, speed))),
      "format": "mp3",
      "Content-Type": "application/json"
    },
    body: text
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || Number(payload.error) !== 0 || !payload.async) {
    throw new Error(payload.message || "FPT AI không nhận được yêu cầu tổng hợp giọng nói.");
  }

  const audioUrl = new URL(payload.async);
  if (audioUrl.protocol !== "https:") throw new Error("FPT AI trả về đường dẫn âm thanh không an toàn.");

  // FPT creates the MP3 asynchronously. Poll only the result URL; never resubmit
  // the synthesis request because that could create a second billable job.
  for (let attempt = 0; attempt < 22; attempt++) {
    if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 5000));
    const audioResponse = await fetch(audioUrl.toString(), { redirect: "follow" });
    if (audioResponse.ok) {
      const type = audioResponse.headers.get("content-type") || "audio/mpeg";
      if (!type.startsWith("audio/") && type !== "application/octet-stream") continue;
      return new Response(audioResponse.body, { status: 200, headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
    }
    if (![403, 404, 425, 429, 500, 502, 503, 504].includes(audioResponse.status)) {
      throw new Error("Không tải được file âm thanh từ FPT AI (HTTP " + audioResponse.status + ").");
    }
  }
  throw new Error("FPT AI vẫn đang xử lý. Hãy chờ một chút rồi tạo lại nếu chưa có file.");
}

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function fetchGoogle(text, voice, speed, env) {
  const response = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize?key=" + encodeURIComponent(env.GOOGLE_TTS_API_KEY), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: "vi-VN", name: voice },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: Math.max(0.75, Math.min(1.25, 1 + speed * 0.08))
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
          fpt: Boolean(env.FPT_TTS_API_KEY),
          google: Boolean(env.GOOGLE_TTS_API_KEY)
        },
        maxCharacters: 5000,
        outputFormat: "mp3"
      }), origin);
    }
    if (request.method !== "POST" || url.pathname !== "/tts") {
      return withCors(errorResponse("Không tìm thấy endpoint.", 404), origin);
    }
    if (!env.FPT_TTS_API_KEY && !env.GOOGLE_TTS_API_KEY) {
      return withCors(errorResponse("Chưa cấu hình API key cho FPT AI hoặc Google Cloud TTS.", 503), origin);
    }

    try {
      const body = await request.json();
      const provider = body?.provider === "google" ? "google" : body?.provider === "fpt" ? "fpt" : null;
      const text = typeof body?.text === "string" ? body.text.trim() : "";
      const voice = typeof body?.voice === "string" ? body.voice : "";
      const speed = Number.isFinite(Number(body?.speed)) ? Number(body.speed) : 0;
      if (!provider) return withCors(errorResponse("Nhà cung cấp không hợp lệ."), origin);
      if (text.length < 3 || text.length > 5000) return withCors(errorResponse("Văn bản phải từ 3 đến 5.000 ký tự."), origin);
      if (provider === "fpt" && !env.FPT_TTS_API_KEY) return withCors(errorResponse("FPT AI chưa được cấu hình API key.", 503), origin);
      if (provider === "google" && !env.GOOGLE_TTS_API_KEY) return withCors(errorResponse("Google Cloud TTS chưa được cấu hình API key.", 503), origin);
      if (provider === "fpt" && !FPT_VOICES.has(voice)) return withCors(errorResponse("Giọng FPT không hợp lệ."), origin);
      if (provider === "google" && !GOOGLE_VOICES.has(voice)) return withCors(errorResponse("Giọng Google không hợp lệ."), origin);

      const audio = provider === "fpt"
        ? await fetchFpt(text, voice, speed, env)
        : await fetchGoogle(text, voice, speed, env);
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
