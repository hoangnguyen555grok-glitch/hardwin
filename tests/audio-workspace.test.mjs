import test from "node:test";
import assert from "node:assert/strict";
import worker from "../cloudflare/audio-tts-worker.js";

const origin = "https://geed.example";
const env = {
  GEED_ALLOWED_ORIGINS: origin,
  FPT_TTS_ENABLED: "true",
  FPT_TTS_API_KEY: "test-fpt-secret",
  FPT_TTS_API_URL: "https://fpt.example/tts",
  FPT_TTS_MODEL: "FPT.TTS-ultra",
  GOOGLE_TTS_ENABLED: "true",
  GOOGLE_TTS_API_KEY: "test-google-secret"
};

test("status reports configured cloud providers without exposing credentials", async () => {
  const response = await worker.fetch(new Request("https://audio.test/status", {
    headers: { Origin: origin }
  }), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.providers, { fpt: true, google: true });
  assert.equal(JSON.stringify(body).includes("test-fpt-secret"), false);
  assert.equal(JSON.stringify(body).includes("test-google-secret"), false);
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
  assert.deepEqual(status.providers, { fpt: false, google: false });

  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error("provider must not be called"); };
  try {
    const response = await worker.fetch(new Request("https://audio.test/tts", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
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
      headers: { Origin: origin, "Content-Type": "application/json" },
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
      headers: { Origin: origin, "Content-Type": "application/json" },
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
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "google", text: "Xin chào", voice: "not-a-voice" })
  }), env);
  assert.equal(badVoice.status, 400);
  const tooLong = await worker.fetch(new Request("https://audio.test/tts", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "google", text: "x".repeat(5001), voice: "vi-VN-Standard-A" })
  }), env);
  assert.equal(tooLong.status, 400);
});
