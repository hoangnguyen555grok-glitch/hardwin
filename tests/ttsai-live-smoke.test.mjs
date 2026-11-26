import test from "node:test";
import assert from "node:assert/strict";

const enabled = process.env.GITHUB_HEAD_REF === "feat/ttsai-piper-provider" ||
  process.env.TTSAI_LIVE_SMOKE === "1";

test("live TTS.ai anonymous Vietnamese Piper smoke test", { skip: !enabled }, async () => {
  const base = "https://api.tts.ai/v1";
  const voicesResponse = await fetch(base + "/voices/?model=piper&language=vi", {
    headers: { accept: "application/json" }
  });
  const voicesText = await voicesResponse.text();
  console.log("VOICE_LIST_STATUS", voicesResponse.status);
  console.log("VOICE_LIST_BODY", voicesText.slice(0, 10000));
  assert.equal(voicesResponse.ok, true, "Vietnamese Piper voice list should be available");
  const voices = JSON.parse(voicesText).voices || [];
  const preferred = voices.find(v => /vais1000/i.test(v.id + " " + v.name)) || voices[0];
  assert.ok(preferred?.id, "TTS.ai must expose at least one Vietnamese Piper voice");
  console.log("SELECTED_VOICE", JSON.stringify(preferred));

  const submit = await fetch(base + "/tts/", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "audio/mpeg, application/json" },
    body: JSON.stringify({
      model: "piper",
      language: "vi",
      text: "Xin chào Geed Hardwin. Đây là bài kiểm tra giọng đọc tiếng Việt.",
      voice: preferred.id,
      format: "mp3",
      speed: 1
    })
  });
  console.log("TTS_STATUS", submit.status, "CONTENT_TYPE", submit.headers.get("content-type"));
  assert.equal(submit.ok, true, "Anonymous TTS.ai synthesis should be accepted");
  const type = submit.headers.get("content-type") || "";
  let audio;
  if (type.startsWith("audio/") || type === "application/octet-stream") {
    audio = new Uint8Array(await submit.arrayBuffer());
  } else {
    const job = await submit.json();
    console.log("TTS_JOB", JSON.stringify(job));
    assert.ok(job.uuid, "Queued TTS response should include a UUID");
    let result;
    for (let i = 0; i < 24; i++) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const poll = await fetch(base + "/speech/results/?uuid=" + encodeURIComponent(job.uuid), {
        headers: { accept: "application/json" }
      });
      const body = await poll.json().catch(() => ({}));
      console.log("POLL", i + 1, poll.status, JSON.stringify(body).slice(0, 400));
      assert.equal(poll.ok, true, "TTS job polling should succeed");
      if (body.status === "failed") assert.fail("TTS job failed: " + (body.error || "unknown"));
      if (body.status === "completed" && body.result_url) { result = body; break; }
    }
    assert.ok(result?.result_url, "TTS job should complete within 36 seconds");
    const resultUrl = new URL(result.result_url);
    assert.equal(resultUrl.origin, "https://api.tts.ai", "Audio must be hosted on the documented API origin");
    const download = await fetch(resultUrl);
    assert.equal(download.ok, true, "Generated MP3 should be downloadable");
    audio = new Uint8Array(await download.arrayBuffer());
  }
  assert.ok(audio?.byteLength > 100, "TTS.ai should return non-empty audio bytes");
  console.log("AUDIO_SMOKE_OK", JSON.stringify({
    voice: preferred.id,
    bytes: audio.byteLength,
    header: Array.from(audio.slice(0, 4))
  }));
});
