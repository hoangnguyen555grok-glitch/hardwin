import { storeGeneratedAudio } from "./tts-handoff.js";

const DEFAULT_ENGINE_URL = "http://127.0.0.1:8000";
const MODEL_ID = "vieneu-v3-turbo";
const SAMPLE_RATE = 48000;
let activeAudioBlob = null;
let activeAudioUrl = null;
let activeFilename = "geed-voice.wav";
let engineConnected = false;
let engineBusy = false;

export function pcm16ToWav(pcmData, sampleRate = SAMPLE_RATE) {
  const pcm = pcmData instanceof Uint8Array
    ? pcmData
    : new Uint8Array(pcmData instanceof ArrayBuffer ? pcmData : pcmData.buffer);
  if (pcm.byteLength === 0 || pcm.byteLength % 2 !== 0) {
    throw new TypeError("Dữ liệu PCM16 không hợp lệ.");
  }
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
    throw new RangeError("Tần số lấy mẫu không hợp lệ.");
  }

  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeAscii = (offset, value) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  const dataBytes = pcm.byteLength;

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, dataBytes, true);

  return new Blob([header, pcm], { type: "audio/wav" });
}

function byId(id) {
  return document.getElementById(id);
}

function normalizeEngineUrl(raw) {
  const value = String(raw || "").trim();
  const url = new URL(value || DEFAULT_ENGINE_URL);
  const allowedHost = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname.toLowerCase());
  if (url.protocol !== "http:" || !allowedHost || url.username || url.password ||
      (url.pathname !== "/" && url.pathname !== "") || url.search || url.hash) {
    throw new Error("Địa chỉ bộ máy phải là dịch vụ cục bộ, ví dụ http://127.0.0.1:8000.");
  }
  return url.origin;
}

function setEngineStatus(message, state = "idle") {
  const status = byId("audioEngineStatus");
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
  status.classList.toggle("connected", state === "success");
  status.classList.toggle("error", state === "error");
}

function setBusy(value) {
  engineBusy = value;
  const generate = byId("generateSpeech");
  if (generate) {
    generate.disabled = value || !engineConnected || !String(byId("audioSourceText")?.value || "").trim();
    generate.textContent = value ? "Đang tạo giọng nói…" : "♫ Tạo giọng nói";
  }
  const connect = byId("connectAudioEngine");
  if (connect) {
    connect.disabled = value;
    connect.textContent = value ? "Đang kết nối…" : "Kiểm tra kết nối";
  }
  const send = byId("sendAudioToEditor");
  if (send) send.disabled = value || !activeAudioBlob;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 600000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeout);
  }
}

function getEngineBaseUrl() {
  const input = byId("audioEngineUrl");
  return normalizeEngineUrl(input?.value || DEFAULT_ENGINE_URL);
}

function explainConnectionError(error) {
  if (error?.name === "AbortError") return "Bộ máy mất quá nhiều thời gian phản hồi. Kiểm tra cửa sổ audio-engine và thử lại.";
  return "Không kết nối được bộ máy cục bộ. Hãy mở audio-engine trên máy và kiểm tra GEED_AUDIO_ORIGINS có đúng địa chỉ website hiện tại không.";
}

async function connectAudioEngine() {
  if (engineBusy) return;
  engineConnected = false;
  const voiceControl = byId("audioVoice");
  if (voiceControl) voiceControl.disabled = true;
  setBusy(true);
  setEngineStatus("Đang kiểm tra bộ máy trên máy tính… lần đầu có thể cần tải mô hình.", "loading");
  try {
    const baseUrl = getEngineBaseUrl();
    localStorage.setItem("geedAudioEngineUrl", baseUrl);

    const healthResponse = await fetchWithTimeout(baseUrl + "/health");
    if (!healthResponse.ok) {
      const body = await healthResponse.json().catch(() => ({}));
      throw new Error(body.error || "Bộ máy trả về HTTP " + healthResponse.status);
    }
    const health = await healthResponse.json();

    const voiceResponse = await fetchWithTimeout(baseUrl + "/v1/voices", {}, 120000);
    if (!voiceResponse.ok) {
      const body = await voiceResponse.json().catch(() => ({}));
      throw new Error(body.error?.message || body.error || "Không tải được danh sách giọng đọc.");
    }
    const voicePayload = await voiceResponse.json();
    const voices = Array.isArray(voicePayload.data) ? voicePayload.data : [];
    const select = byId("audioVoice");
    if (!voices.length || !select) throw new Error("Bộ máy chưa cung cấp giọng đọc nào.");

    const preferred = ["Hải Đăng", "Mai Anh", "Trúc Ly", "Minh Đức"];
    const oldValue = select.value;
    select.replaceChildren();
    voices.forEach(voice => {
      const option = document.createElement("option");
      option.value = String(voice.id || voice.name || "");
      option.textContent = String(voice.name || voice.id || "Giọng đọc");
      if (voice.description) option.title = String(voice.description);
      select.appendChild(option);
    });
    if (voices.some(v => String(v.id || v.name) === oldValue)) select.value = oldValue;
    else {
      const recommended = preferred.find(name => voices.some(v => String(v.name || v.id) === name));
      if (recommended) select.value = recommended;
    }
    select.disabled = false;

    engineConnected = true;
    setEngineStatus(
      "Đã kết nối · " + voices.length + " giọng · " + String(health.backend || "local").toUpperCase() + " · 48 kHz",
      "success"
    );
  } catch (error) {
    setEngineStatus(error.message || explainConnectionError(error), "error");
    if (error instanceof TypeError || error.name === "TypeError") {
      setEngineStatus(explainConnectionError(error), "error");
    }
  } finally {
    setBusy(false);
    const generate = byId("generateSpeech");
    if (generate) generate.disabled = !engineConnected || !String(byId("audioSourceText")?.value || "").trim();
  }
}

function createFilename() {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0")
  ].join("");
  return "geed-voice-" + stamp + ".wav";
}

function showGeneratedAudio(blob) {
  if (activeAudioUrl) URL.revokeObjectURL(activeAudioUrl);
  activeAudioBlob = blob;
  activeFilename = createFilename();
  activeAudioUrl = URL.createObjectURL(blob);

  const result = byId("audioResult");
  const player = byId("generatedAudioPlayer");
  const download = byId("downloadGeneratedAudio");
  if (player) player.src = activeAudioUrl;
  if (download) {
    download.href = activeAudioUrl;
    download.download = activeFilename;
    download.hidden = false;
  }
  if (result) result.hidden = false;
  const send = byId("sendAudioToEditor");
  if (send) send.disabled = false;
  setEngineStatus("Đã tạo xong file WAV · 48 kHz · " + (blob.size / 1024 / 1024).toFixed(2) + " MB", "success");
}

async function generateSpeech() {
  if (!engineConnected || engineBusy) return;
  const input = byId("audioSourceText");
  const text = String(input?.value || "").trim();
  if (!text) {
    setEngineStatus("Hãy nhập nội dung trước khi tạo giọng nói.", "error");
    input?.focus();
    return;
  }
  if (text.length > 20000) {
    setEngineStatus("Văn bản vượt quá 20.000 ký tự cho một lượt tạo.", "error");
    return;
  }

  setBusy(true);
  setEngineStatus("Đang tổng hợp giọng nói trên máy tính…", "loading");
  try {
    const response = await fetchWithTimeout(getEngineBaseUrl() + "/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL_ID,
        input: text,
        voice: byId("audioVoice")?.value || undefined,
        response_format: "pcm",
        stream_format: "audio",
        sample_rate: SAMPLE_RATE
      })
    }, 600000);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error?.message || payload.detail || "Tạo giọng nói thất bại (HTTP " + response.status + ").");
    }

    const pcm = await response.arrayBuffer();
    const wav = pcm16ToWav(pcm, SAMPLE_RATE);
    showGeneratedAudio(wav);
  } catch (error) {
    setEngineStatus(error.message || explainConnectionError(error), "error");
  } finally {
    setBusy(false);
    const generate = byId("generateSpeech");
    if (generate) generate.disabled = !engineConnected || !String(byId("audioSourceText")?.value || "").trim();
  }
}

async function sendAudioToEditor() {
  if (!activeAudioBlob) return;
  const button = byId("sendAudioToEditor");
  if (button) {
    button.disabled = true;
    button.textContent = "Đang chuyển âm thanh…";
  }
  try {
    const id = await storeGeneratedAudio(activeAudioBlob, activeFilename);
    sessionStorage.setItem("geedTtsAudioHandoff", id);
    window.location.assign("/index.html?audioHandoff=1");
  } catch (error) {
    setEngineStatus(error.message || "Không thể chuyển file sang trình biên tập.", "error");
    if (button) {
      button.disabled = false;
      button.textContent = "Đưa vào trình biên tập";
    }
  }
}

function showHub() {
  byId("voiceWorkspace").hidden = true;
  byId("musicWorkspace").hidden = true;
  byId("audioHub").hidden = false;
  byId("audioHub")?.querySelector("#openVoiceWorkspace")?.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showVoiceWorkspace() {
  byId("audioHub").hidden = true;
  byId("musicWorkspace").hidden = true;
  byId("voiceWorkspace").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (!engineConnected) connectAudioEngine();
}

function showMusicWorkspace() {
  byId("audioHub").hidden = true;
  byId("voiceWorkspace").hidden = true;
  byId("musicWorkspace").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function initAudioWorkspace() {
  const hub = byId("audioHub");
  if (!hub) return;

  const savedUrl = localStorage.getItem("geedAudioEngineUrl");
  if (savedUrl && byId("audioEngineUrl")) byId("audioEngineUrl").value = savedUrl;

  byId("openVoiceWorkspace")?.addEventListener("click", showVoiceWorkspace);
  byId("openMusicWorkspace")?.addEventListener("click", showMusicWorkspace);
  byId("backToAudioHubFromVoice")?.addEventListener("click", showHub);
  byId("backToAudioHubFromMusic")?.addEventListener("click", showHub);
  byId("connectAudioEngine")?.addEventListener("click", connectAudioEngine);
  byId("generateSpeech")?.addEventListener("click", generateSpeech);
  byId("sendAudioToEditor")?.addEventListener("click", sendAudioToEditor);

  byId("audioSourceText")?.addEventListener("input", () => {
    const text = byId("audioSourceText").value;
    const counter = byId("audioTextCount");
    if (counter) counter.textContent = text.length.toLocaleString("vi-VN") + " / 20.000";
    const generate = byId("generateSpeech");
    if (generate) generate.disabled = engineBusy || !engineConnected || !text.trim();
  });

  byId("clearAudioText")?.addEventListener("click", () => {
    if (byId("audioSourceText")) byId("audioSourceText").value = "";
    byId("audioSourceText")?.dispatchEvent(new Event("input", { bubbles: true }));
    byId("audioSourceText")?.focus();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !byId("voiceWorkspace").hidden) showHub();
    if (event.key === "Escape" && !byId("musicWorkspace").hidden) showHub();
  });

  if (new URLSearchParams(window.location.search).get("section") === "voice") {
    showVoiceWorkspace();
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAudioWorkspace, { once: true });
  } else {
    initAudioWorkspace();
  }
}
