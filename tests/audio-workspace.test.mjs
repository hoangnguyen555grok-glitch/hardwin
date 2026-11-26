import test from "node:test";
import assert from "node:assert/strict";
import worker from "../cloudflare/audio-tts-worker.js";

const origin = "https://geed.example";
const env = {
  GEED_ALLOWED_ORIGINS: origin,
  FPT_TTS_API_KEY: "test-fpt-secret",
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

test("rejects requests from origins outside the explicit allowlist", async () => {
  const response = await worker.fetch(new Request("https://audio.test/status", {
    headers: { Origin: "https://attacker.example" }
  }), env);
  assert.equal(response.status, 403);
});

test("Google TTS returns MP3 bytes and keeps the API key server-side", async () => {
  const originalFetch = globalThis.fetch;
  let calledUrl = "";
  globalThis.fetch = async (url, options) => {
    calledUrl = String(url);
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
    assert.equal(calledUrl.includes("test-google-secret"), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("FPT TTS submits once and retrieves the asynchronous MP3", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("/hmi/tts/v5")) {
      assert.equal(options.headers.api_key, "test-fpt-secret");
      assert.equal(options.headers.voice, "banmai");
      return new Response(JSON.stringify({ error: 0, async: "https://cdn.fpt.example/audio.mp3" }), {
        headers: { "content-type": "application/json" }
      });
    }
    return new Response("fpt-mp3", { headers: { "content-type": "audio/mpeg" } });
  };
  try {
    const response = await worker.fetch(new Request("https://audio.test/tts", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "fpt", text: "Xin chào Geed", voice: "banmai", speed: 0 })
    }), env);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "fpt-mp3");
    assert.equal(calls.filter(call => call.url.includes("/hmi/tts/v5")).length, 1);
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects invalid voice IDs and text over the provider request limit", async () => {
  const badVoice = await worker.fetch(new Request("https://audio.test/tts", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "fpt", text: "Xin chào", voice: "not-a-voice" })
  }), env);
  assert.equal(badVoice.status, 400);
  const tooLong = await worker.fetch(new Request("https://audio.test/tts", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "google", text: "x".repeat(5001), voice: "vi-VN-Standard-A" })
  }), env);
  assert.equal(tooLong.status, 400);
});
