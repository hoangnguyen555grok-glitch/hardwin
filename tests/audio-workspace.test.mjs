import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import worker from "../cloudflare/audio-tts-worker.js";

const origin = "https://geed.example";
const env = {
  GEED_ALLOWED_ORIGINS: origin,
  FPT_TTS_ENABLED: "true",
  FPT_TTS_API_KEY: "test-fpt-secret",
  FPT_TTS_API_URL: "https://fpt.example/tts",
  FPT_TTS_MODEL: "FPT.TTS-ultra",
  GOOGLE_TTS_ENABLED: "true",
  GOOGLE_TTS_API_KEY: "test-google-secret",
  AZURE_TTS_ENABLED: "true",
  AZURE_SPEECH_KEY: "test-azure-secret",
  AZURE_SPEECH_REGION: "southeastasia",
  TURNSTILE_SECRET_KEY: "test-turnstile-secret",
  TTS_RATE_LIMITER: { limit: async () => ({ success: true }) }
};

test("status reports configured cloud providers without exposing credentials", async () => {
  const response = await worker.fetch(new Request("https://audio.test/status", {
    headers: { Origin: origin }
  }), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.providers, { fpt: true, google: true, azure: true });
  assert.equal(JSON.stringify(body).includes("test-fpt-secret"), false);
  assert.equal(JSON.stringify(body).includes("test-google-secret"), false);
  assert.equal(JSON.stringify(body).includes("test-azure-secret"), false);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
});

test("both providers stay locked unless explicit enable flags are set", async () => {
  const lockedEnv = {
    GEED_ALLOWED_ORIGINS: origin,
    FPT_TTS_API_KEY: "present-but-disabled",
    FPT_TTS_API_URL: "https://fpt.example/tts",
    FPT_TTS_MODEL: "FPT.TTS-ultra",
    GOOGLE_TTS_API_KEY: "present-but-disabled"
  };
  const statusResponse = await worker.fetch(new Request("https://audio.test/status", {
    headers: { Origin: origin }
  }), lockedEnv);
  const status = await statusResponse.json();
  assert.deepEqual(status.providers, { fpt: false, google: false, azure: false });

  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error("provider must not be called"); };
  try {
    const response = await worker.fetch(new Request("https://audio.test/tts", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.10", "X-Turnstile-Token": "test-turnstile-token" },
      body: JSON.stringify({ provider: "google", text: "Xin chào Geed", voice: "vi-VN-Standard-A", speed: 1 })
    }), lockedEnv);
    assert.equal(response.status, 503);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects requests from origins outside the explicit allowlist", async () => {
  const response = await worker.fetch(new Request("https://audio.test/status", {
    headers: { Origin: "https://attacker.example" }
  }), env);
  assert.equal(response.status, 403);
});

test("Google TTS returns MP3 bytes and keeps the API key server-side", async () => {
  const originalFetch = globalThis.fetch;
  let calledUrl = "";
  let calledHeaders = {};
  globalThis.fetch = async (url, options) => {
    if (String(url).includes("/turnstile/v0/siteverify")) return new Response(JSON.stringify({ success: true, hostname: "geed-hardwin.vercel.app", action: "tts" }), { headers: { "content-type": "application/json" } });
    calledUrl = String(url);
    calledHeaders = options.headers;
    assert.equal(options.method, "POST");
    const body = JSON.parse(options.body);
    assert.equal(body.voice.name, "vi-VN-Standard-A");
    assert.equal(body.audioConfig.audioEncoding, "MP3");
    return new Response(JSON.stringify({ audioContent: btoa("mp3-data") }), {
      headers: { "content-type": "application/json" }
    });
  };
  try {
    const response = await worker.fetch(new Request("https://audio.test/tts", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.10", "X-Turnstile-Token": "test-turnstile-token" },
      body: JSON.stringify({ provider: "google", text: "Xin chào Geed", voice: "vi-VN-Standard-A", speed: 0 })
    }), env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "audio/mpeg");
    assert.equal(await response.text(), "mp3-data");
    assert.match(calledUrl, /texttospeech\.googleapis\.com/);
    assert.equal(calledUrl.includes("test-google-secret"), false);
    assert.equal(calledHeaders["x-goog-api-key"], "test-google-secret");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("FPT AI Factory TTS sends the configured model and returns MP3 bytes", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes("/turnstile/v0/siteverify")) return new Response(JSON.stringify({ success: true, hostname: "geed-hardwin.vercel.app", action: "tts" }), { headers: { "content-type": "application/json" } });
    called = true;
    assert.equal(String(url), "https://fpt.example/tts");
    assert.equal(options.headers.Authorization, "Bearer test-fpt-secret");
    const body = JSON.parse(options.body);
    assert.equal(body.model, "FPT.TTS-ultra");
    assert.equal(body.input, "Xin chào Geed");
    assert.equal(body.response_format, "mp3");
    assert.equal(body.voice, undefined);
    return new Response("fpt-factory-mp3", { headers: { "content-type": "audio/mpeg" } });
  };
  try {
    const response = await worker.fetch(new Request("https://audio.test/tts", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.10", "X-Turnstile-Token": "test-turnstile-token" },
      body: JSON.stringify({ provider: "fpt", text: "Xin chào Geed", voice: "auto", speed: 1 })
    }), env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "audio/mpeg");
    assert.equal(await response.text(), "fpt-factory-mp3");
    assert.equal(called, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects invalid Google voice IDs and text over the provider request limit", async () => {
  const badVoice = await worker.fetch(new Request("https://audio.test/tts", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.10", "X-Turnstile-Token": "test-turnstile-token" },
    body: JSON.stringify({ provider: "google", text: "Xin chào", voice: "not-a-voice" })
  }), env);
  assert.equal(badVoice.status, 400);
  const tooLong = await worker.fetch(new Request("https://audio.test/tts", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.10", "X-Turnstile-Token": "test-turnstile-token" },
    body: JSON.stringify({ provider: "google", text: "x".repeat(5001), voice: "vi-VN-Standard-A" })
  }), env);
  assert.equal(tooLong.status, 400);
});

test("Azure Speech F0 returns MP3 and safely escapes Vietnamese SSML", async () => {
  const originalFetch = globalThis.fetch;
  let calledUrl = "";
  let calledOptions = {};
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes("/turnstile/v0/siteverify")) return new Response(JSON.stringify({ success: true, hostname: "geed-hardwin.vercel.app", action: "tts" }), { headers: { "content-type": "application/json" } });
    calledUrl = String(url);
    calledOptions = options;
    return new Response("azure-mp3", { headers: { "content-type": "audio/mpeg" } });
  };
  try {
    const response = await worker.fetch(new Request("https://audio.test/tts", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.10", "X-Turnstile-Token": "test-turnstile-token" },
      body: JSON.stringify({ provider: "azure", text: "Xin chào <Geed> & bạn", voice: "vi-VN-HoaiMyNeural", speed: 1.1 })
    }), env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "audio/mpeg");
    assert.equal(await response.text(), "azure-mp3");
    assert.equal(calledUrl, "https://southeastasia.tts.speech.microsoft.com/cognitiveservices/v1");
    assert.equal(calledOptions.headers["Ocp-Apim-Subscription-Key"], "test-azure-secret");
    assert.match(calledOptions.body, /Xin chào &lt;Geed&gt; &amp; bạn/);
    assert.match(calledOptions.body, /rate="\+10%"/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Azure Speech remains locked unless explicitly enabled", async () => {
  const locked = { GEED_ALLOWED_ORIGINS: origin, AZURE_SPEECH_KEY: "present-but-disabled", AZURE_SPEECH_REGION: "southeastasia" };
  const response = await worker.fetch(new Request("https://audio.test/tts", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.10", "X-Turnstile-Token": "test-turnstile-token" },
    body: JSON.stringify({ provider: "azure", text: "Xin chào", voice: "vi-VN-HoaiMyNeural" })
  }), locked);
  assert.equal(response.status, 503);
});


test("voice workspace exposes Azure Vietnamese voices and submits the selected provider", async () => {
  const source = await readFile(new URL("../lib/audio-workspace.mjs", import.meta.url), "utf8");
  assert.match(source, /azure:\s*\{\s*label: "Azure Speech F0"/);
  assert.match(source, /vi-VN-HoaiMyNeural/);
  assert.match(source, /vi-VN-NamMinhNeural/);
  assert.match(source, /Object\.hasOwn\(PROVIDERS, selected\)/);
  assert.match(source, /provider: selectedProvider/);
  assert.match(source, /azure: status\.providers\?\.azure === true/);
});

test("generated TTS handoff imports a real audio file into the editor timeline player", async () => {
  const editor = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(editor, /async function consumeGeneratedAudioHandoff\(\)/);
  assert.match(editor, /takeGeneratedAudio\(transferId\)/);
  assert.match(editor, /transfer\.items\.add\(file\)/);
  assert.match(editor, /input\.dispatchEvent\(new Event\('change',\{bubbles:true\}\)\)/);
  assert.match(editor, /makeObject\('audio',\{name:file\.name,dataUrl:reader\.result,audioStartFrame:frame,inFrame:frame,outFrame:MAX,volume:\.8\}\)/);
  assert.match(editor, /function syncAudioPlayback\(force=false\)/);
  assert.match(editor, /audioPlayers\.forEach\(p=>p\.pause\(\)\)/);
});


test("TTS fails closed when the Cloudflare rate-limit binding is missing", async () => {
  const { TTS_RATE_LIMITER, ...unprotectedEnv } = env;
  const response = await worker.fetch(new Request("https://audio.test/tts", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.10", "X-Turnstile-Token": "test-turnstile-token" },
    body: JSON.stringify({ provider: "azure", text: "Xin chào", voice: "vi-VN-HoaiMyNeural" })
  }), unprotectedEnv);
  assert.equal(response.status, 503);
});

test("TTS rate limits each client IP and returns Retry-After", async () => {
  const limitedEnv = { ...env, TTS_RATE_LIMITER: { limit: async ({ key }) => {
    assert.equal(key, "203.0.113.10");
    return { success: false };
  } } };
  const response = await worker.fetch(new Request("https://audio.test/tts", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.10", "X-Turnstile-Token": "test-turnstile-token" },
    body: JSON.stringify({ provider: "azure", text: "Xin chào", voice: "vi-VN-HoaiMyNeural" })
  }), limitedEnv);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "60");
});

test("TTS rejects non-JSON and oversized requests before provider access", async () => {
  const wrongType = await worker.fetch(new Request("https://audio.test/tts", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "text/plain", "CF-Connecting-IP": "203.0.113.10", "X-Turnstile-Token": "test-turnstile-token" },
    body: "Xin chào"
  }), env);
  assert.equal(wrongType.status, 415);

  const oversized = await worker.fetch(new Request("https://audio.test/tts", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.10", "X-Turnstile-Token": "test-turnstile-token" },
    body: JSON.stringify({ provider: "azure", text: "x".repeat(25000), voice: "vi-VN-HoaiMyNeural" })
  }), env);
  assert.equal(oversized.status, 413);
});


test("TTS requires a verified Turnstile token with the expected hostname and action", async () => {
  const originalFetch = globalThis.fetch;
  let providerCalled = false;
  globalThis.fetch = async url => {
    if (String(url).includes("/turnstile/v0/siteverify")) {
      return new Response(JSON.stringify({ success: false, hostname: "attacker.example", action: "other" }), { headers: { "content-type": "application/json" } });
    }
    providerCalled = true;
    return new Response("unexpected");
  };
  try {
    const response = await worker.fetch(new Request("https://audio.test/tts", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.10", "X-Turnstile-Token": "invalid-token" },
      body: JSON.stringify({ provider: "azure", text: "Xin chào", voice: "vi-VN-HoaiMyNeural" })
    }), env);
    assert.equal(response.status, 403);
    assert.equal(providerCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("status advertises that Turnstile and rate limiting are required without exposing secrets", async () => {
  const response = await worker.fetch(new Request("https://audio.test/status", { headers: { Origin: origin } }), env);
  const body = await response.json();
  assert.deepEqual(body.security, { turnstileRequired: true, rateLimitRequired: true });
  assert.equal(JSON.stringify(body).includes("test-turnstile-secret"), false);
});
