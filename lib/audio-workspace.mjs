import { storeGeneratedAudio } from "./tts-handoff.mjs";

const AUDIO_API_BASE = "https://geed-audio-tts.geed-hardwin.workers.dev";
const MAX_TEXT_LENGTH = 500;
const TURNSTILE_SITE_KEY = "0x4AAAAAAGT9EV5DiOxVQMlW";
let turnstileScriptPromise = null;
const PROVIDERS = {
  ttsdotai: {
    label: "Piper tiếng Việt · TTS.ai miễn phí",
    voices: [
      ["vi_VN-vais1000-medium", "Vais1000 · Nữ · Tiếng Việt"]
    ]
  },
  fpt: {
    label: "FPT AI Factory",
    voices: [
      ["auto", "Tự chọn giọng · FPT.TTS-ultra"]
    ]
  },
  google: {
    label: "Google Cloud TTS",
    voices: [
      ["vi-VN-Standard-A", "Standard A · Nữ"],
      ["vi-VN-Standard-B", "Standard B · Nam"],
      ["vi-VN-Standard-C", "Standard C · Nữ"],
      ["vi-VN-Standard-D", "Standard D · Nam"]
    ]
  },
  azure: {
    label: "Azure Speech F0",
    voices: [
      ["vi-VN-HoaiMyNeural", "Hoài My · Nữ"],
      ["vi-VN-NamMinhNeural", "Nam Minh · Nam"]
    ]
  }
};
let activeAudioBlob = null;
let activeAudioUrl = null;
let activeFilename = "geed-voice.mp3";
let busy = false;
let configuredProviders = { ttsdotai: false, fpt: false, google: false, azure: false };

const byId = id => document.getElementById(id);

function setStatus(message, state = "idle") {
  const status = byId("audioEngineStatus");
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
  status.classList.toggle("connected", state === "success");
  status.classList.toggle("error", state === "error");
  status.classList.toggle("loading", state === "loading");
}

function provider() {
  const selected = byId("audioProvider")?.value;
  return Object.hasOwn(PROVIDERS, selected) ? selected : "ttsdotai";
}

function refreshVoices() {
  const select = byId("audioVoice");
  if (!select) return;
  const selectedProvider = provider();
  select.replaceChildren();
  for (const [value, label] of PROVIDERS[selectedProvider].voices) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }
  updateGenerateButton();
}

function updateGenerateButton() {
  const button = byId("generateSpeech");
  if (!button) return;
  const text = String(byId("audioSourceText")?.value || "").trim();
  button.disabled = busy || !configuredProviders[provider()] || text.length < 3 || text.length > MAX_TEXT_LENGTH;
}

function setBusy(value) {
  busy = value;
  const generate = byId("generateSpeech");
  if (generate) generate.textContent = value ? "Đang tạo giọng nói…" : "♫ Tạo giọng nói";
  const check = byId("connectAudioEngine");
  if (check) {
    check.disabled = value;
    check.textContent = value ? "Đang kiểm tra…" : "Kiểm tra dịch vụ";
  }
  const send = byId("sendAudioToEditor");
  if (send) send.disabled = value || !activeAudioBlob;
  updateGenerateButton();
}

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!turnstileScriptPromise) {
    turnstileScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = () => window.turnstile ? resolve(window.turnstile) : reject(new Error("Không tải được xác minh bảo mật."));
      script.onerror = () => {
        turnstileScriptPromise = null;
        reject(new Error("Không kết nối được dịch vụ xác minh bảo mật."));
      };
      document.head.appendChild(script);
    });
  }
  return turnstileScriptPromise;
}

async function getTurnstileToken() {
  const turnstile = await loadTurnstile();
  const container = document.createElement("div");
  container.setAttribute("aria-hidden", "true");
  container.style.cssText = "position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden";
  document.body.appendChild(container);
  let widgetId = null;
  try {
    return await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        callback(value);
      };
      const timeout = setTimeout(() => finish(reject, new Error("Xác minh bảo mật quá thời gian. Hãy thử lại.")), 30000);
      widgetId = turnstile.render(container, {
        sitekey: TURNSTILE_SITE_KEY,
        size: "invisible",
        action: "tts",
        callback: token => finish(resolve, token),
        "error-callback": () => finish(reject, new Error("Xác minh bảo mật thất bại. Hãy thử lại.")),
        "expired-callback": () => finish(reject, new Error("Mã xác minh đã hết hạn. Hãy thử lại.")),
        "timeout-callback": () => finish(reject, new Error("Xác minh bảo mật quá thời gian. Hãy thử lại."))
      });
      turnstile.execute(widgetId);
    });
  } finally {
    if (widgetId !== null) turnstile.remove(widgetId);
    container.remove();
  }
}

async function requestJson(path, options = {}, timeoutMs = 150000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(AUDIO_API_BASE + path, {
      ...options,
      signal: controller.signal,
      cache: "no-store"
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Dịch vụ âm thanh phản hồi HTTP " + response.status + ".");
    }
    return payload;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Dịch vụ mất quá nhiều thời gian phản hồi. Hãy thử lại sau.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function checkService() {
  if (busy) return;
  setBusy(true);
  setStatus("Đang kiểm tra kết nối và cấu hình các nhà cung cấp…", "loading");
  try {
    const status = await requestJson("/status", {}, 15000);
    configuredProviders = {
      ttsdotai: status.providers?.ttsdotai === true,
      fpt: status.providers?.fpt === true,
      google: status.providers?.google === true,
      azure: status.providers?.azure === true
    };
    const active = provider();
    if (configuredProviders[active]) {
      setStatus("Đã sẵn sàng · " + PROVIDERS[active].label + " đã cấu hình. Chỉ phát sinh yêu cầu khi bạn bấm Tạo giọng nói.", "success");
    } else {
      const other = Object.keys(PROVIDERS).find(key => key !== active && configuredProviders[key]);
      setStatus(
        PROVIDERS[active].label + " chưa được cấu hình ở máy chủ. " +
        (other ? PROVIDERS[other].label + " hiện đã sẵn sàng; bạn có thể đổi nhà cung cấp." : "Vui lòng thử lại sau hoặc chọn nguồn dự phòng đã được cấu hình."),
        "error"
      );
    }
  } catch (error) {
    configuredProviders = { ttsdotai: false, fpt: false, google: false, azure: false };
    setStatus(error.message || "Không kết nối được dịch vụ âm thanh.", "error");
  } finally {
    setBusy(false);
  }
}

function createFilename() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return "geed-voice-" + stamp + ".mp3";
}

function showGeneratedAudio(blob) {
  if (activeAudioUrl) URL.revokeObjectURL(activeAudioUrl);
  activeAudioBlob = blob;
  activeFilename = createFilename();
  activeAudioUrl = URL.createObjectURL(blob);
  const player = byId("generatedAudioPlayer");
  const download = byId("downloadGeneratedAudio");
  const result = byId("audioResult");
  if (player) player.src = activeAudioUrl;
  if (download) {
    download.href = activeAudioUrl;
    download.download = activeFilename;
    download.hidden = false;
  }
  if (result) result.hidden = false;
  const send = byId("sendAudioToEditor");
  if (send) send.disabled = false;
  const sizeMb = (blob.size / 1024 / 1024).toFixed(2);
  setStatus("Đã tạo âm thanh MP3 · " + sizeMb + " MB · " + PROVIDERS[provider()].label, "success");
}

async function generateSpeech() {
  if (busy) return;
  const text = String(byId("audioSourceText")?.value || "").trim();
  if (text.length < 3) {
    setStatus("Văn bản cần có ít nhất 3 ký tự.", "error");
    byId("audioSourceText")?.focus();
    return;
  }
  if (text.length > MAX_TEXT_LENGTH) {
    setStatus("Văn bản vượt giới hạn 5.000 ký tự mỗi lượt.", "error");
    return;
  }
  const selectedProvider = provider();
  if (!configuredProviders[selectedProvider]) {
    setStatus("Nhà cung cấp giọng đọc hiện chưa sẵn sàng.", "error");
    return;
  }
  setBusy(true);
  setStatus("Đang gửi văn bản tới " + PROVIDERS[selectedProvider].label + " để tổng hợp giọng nói…", "loading");
  try {
    const speed = Number(byId("audioSpeed")?.value || 1);
    setStatus("Đang xác minh yêu cầu bảo mật…", "loading");
    const turnstileToken = await getTurnstileToken();
    setStatus("Đã xác minh · đang gửi văn bản tới " + PROVIDERS[selectedProvider].label + "…", "loading");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 150000);
    let response;
    try {
      response = await fetch(AUDIO_API_BASE + "/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Turnstile-Token": turnstileToken },
        body: JSON.stringify({
          provider: selectedProvider,
          text,
          voice: byId("audioVoice")?.value,
          speed
        }),
        signal: controller.signal,
        cache: "no-store"
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Tạo giọng nói thất bại (HTTP " + response.status + ").");
    }
    const blob = await response.blob();
    if (!blob.size || !blob.type.startsWith("audio/")) throw new Error("Máy chủ không trả về file âm thanh hợp lệ.");
    showGeneratedAudio(blob);
  } catch (error) {
    setStatus(error.message || "Không thể tạo giọng nói. Hãy thử lại.", "error");
  } finally {
    setBusy(false);
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
    setStatus(error.message || "Không thể chuyển file sang trình biên tập.", "error");
    if (button) {
      button.disabled = false;
      button.textContent = "Đưa vào trình biên tập →";
    }
  }
}

function showHub() {
  byId("voiceWorkspace").hidden = true;
  byId("musicWorkspace").hidden = true;
  byId("audioHub").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showVoiceWorkspace() {
  byId("audioHub").hidden = true;
  byId("musicWorkspace").hidden = true;
  byId("voiceWorkspace").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
  checkService();
}

function showMusicWorkspace() {
  byId("audioHub").hidden = true;
  byId("voiceWorkspace").hidden = true;
  byId("musicWorkspace").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function initAudioWorkspace() {
  if (!byId("audioHub")) return;
  refreshVoices();
  byId("openVoiceWorkspace")?.addEventListener("click", showVoiceWorkspace);
  byId("openMusicWorkspace")?.addEventListener("click", showMusicWorkspace);
  byId("backToAudioHubFromVoice")?.addEventListener("click", showHub);
  byId("backToAudioHub")?.addEventListener("click", showHub);
  byId("connectAudioEngine")?.addEventListener("click", checkService);
  byId("generateSpeech")?.addEventListener("click", generateSpeech);
  byId("sendAudioToEditor")?.addEventListener("click", sendAudioToEditor);
  byId("audioProvider")?.addEventListener("change", () => {
    refreshVoices();
    if (configuredProviders[provider()]) setStatus(PROVIDERS[provider()].label + " đã sẵn sàng.", "success");
    else setStatus(PROVIDERS[provider()].label + " hiện chưa sẵn sàng.", "error");
  });
  byId("audioSourceText")?.addEventListener("input", () => {
    const text = byId("audioSourceText").value;
    const count = byId("audioTextCount");
    if (count) count.textContent = text.length.toLocaleString("vi-VN") + " / " + MAX_TEXT_LENGTH.toLocaleString("vi-VN");
    updateGenerateButton();
  });
  byId("clearAudioText")?.addEventListener("click", () => {
    byId("audioSourceText").value = "";
    byId("audioSourceText").dispatchEvent(new Event("input", { bubbles: true }));
    byId("audioSourceText").focus();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !byId("voiceWorkspace").hidden) showHub();
    if (event.key === "Escape" && !byId("musicWorkspace").hidden) showHub();
  });
  if (new URLSearchParams(window.location.search).get("section") === "voice") showVoiceWorkspace();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAudioWorkspace, { once: true });
  else initAudioWorkspace();
}
