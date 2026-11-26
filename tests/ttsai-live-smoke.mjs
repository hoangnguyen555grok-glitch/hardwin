const base = "https://api.tts.ai/v1";
const voicesResponse = await fetch(base + "/voices/?model=piper&language=vi", { headers: { accept: "application/json" } });
const voicesText = await voicesResponse.text();
console.log("VOICE_LIST_STATUS", voicesResponse.status);
console.log("VOICE_LIST_CONTENT_TYPE", voicesResponse.headers.get("content-type"));
console.log("VOICE_LIST_BODY", voicesText.slice(0, 12000));
if (!voicesResponse.ok) process.exit(1);
let voices;
try { voices = JSON.parse(voicesText).voices || []; } catch { throw new Error("Voice list was not JSON"); }
const preferred = voices.find(v => /vais1000/i.test(v.id + " " + v.name)) || voices[0];
if (!preferred?.id) throw new Error("No Vietnamese Piper voice was returned");
console.log("SELECTED_VOICE", JSON.stringify(preferred));
const submit = await fetch(base + "/tts/", {
  method: "POST",
  headers: { "content-type": "application/json", accept: "audio/mpeg, application/json" },
  body: JSON.stringify({ model: "piper", language: "vi", text: "Xin chào Geed Hardwin. Đây là bài kiểm tra giọng đọc tiếng Việt.", voice: preferred.id, format: "mp3", speed: 1 })
});
console.log("TTS_STATUS", submit.status, "CONTENT_TYPE", submit.headers.get("content-type"));
if (!submit.ok) throw new Error("TTS submit failed: " + submit.status + " " + (await submit.text()).slice(0, 2000));
const type = submit.headers.get("content-type") || "";
let audio;
if (type.startsWith("audio/") || type === "application/octet-stream") {
  audio = new Uint8Array(await submit.arrayBuffer());
} else {
  const job = await submit.json();
  console.log("TTS_JOB", JSON.stringify(job));
  if (!job.uuid) throw new Error("TTS returned no audio and no job UUID");
  let result;
  for (let i = 0; i < 20; i++) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    const poll = await fetch(base + "/speech/results/?uuid=" + encodeURIComponent(job.uuid), { headers: { accept: "application/json" } });
    const body = await poll.json().catch(() => ({}));
    console.log("POLL", i + 1, poll.status, JSON.stringify(body).slice(0, 500));
    if (!poll.ok) throw new Error("TTS poll failed: " + poll.status);
    if (body.status === "failed") throw new Error("TTS job failed: " + (body.error || "unknown"));
    if (body.status === "completed" && body.result_url) {
      const url = new URL(body.result_url);
      if (url.origin !== "https://api.tts.ai") throw new Error("Unexpected result host: " + url.origin);
      const download = await fetch(url);
      if (!download.ok) throw new Error("TTS audio download failed: " + download.status);
      audio = new Uint8Array(await download.arrayBuffer());
      break;
    }
  }
}
if (!audio?.byteLength) throw new Error("No audio bytes returned");
console.log("AUDIO_SMOKE_OK", JSON.stringify({ voice: preferred.id, bytes: audio.byteLength, header: Array.from(audio.slice(0, 4)) }));
