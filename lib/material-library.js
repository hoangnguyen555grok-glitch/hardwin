import "./supabase-auth.js";

const $ = id => document.getElementById(id);
const grid = $("materialsGrid");
const dialog = $("materialDialog");
const form = $("materialForm");
const setupMessage = $("setupMessage");
let materials = [];
let state = { notionAvailable: false };
let loading = false;

const allowedTags = new Set(["Geed", "Runway", "Adobe", "Canva", "Video", "Audio", "AI"]);

function setStatus(id, text, good) {
  const node = $(id);
  node.textContent = text;
  node.className = "status " + (good ? "ok" : "warn");
}
async function authHeaders() {
  const token = await window.GeedHardwinAuth?.getAccessToken();
  if (!token) throw new Error("Hãy đăng nhập Google bằng nút ở góc trên.");
  return { authorization: "Bearer " + token };
}
async function requestJson(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers["content-type"] = "application/json";
  const response = await fetch(url, { ...options, headers, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Yêu cầu chưa thành công.");
  return payload;
}
function showSetup(message) {
  setupMessage.classList.remove("hidden");
  setupMessage.textContent = message;
}
function hideSetup() {
  setupMessage.classList.add("hidden");
  setupMessage.textContent = "";
}
async function loadMaterials() {
  if (loading) return;
  loading = true;
  grid.innerHTML = '<div class="empty">Đang tải thư viện…</div>';
  try {
    const headers = await authHeaders();
    const result = await requestJson("/api/materials", { headers });
    state = result;
    materials = Array.isArray(result.items) ? result.items : [];
    setStatus("notionStatus", result.notionAvailable ? "Notion: đã kết nối" : "Notion: chưa cấu hình", !!result.notionAvailable);
    $("itemCount").textContent = materials.length + " vật liệu";
    if (!result.notionAvailable) {
      showSetup("Cần kết nối Notion nội bộ và thêm GEED_NOTION_API_TOKEN trong Vercel. Xem docs/NOTION-MATERIAL-LIBRARY.md.");
    } else {
      hideSetup();
    }
    renderMaterials();
  } catch (error) {
    setStatus("notionStatus", "Notion: chưa tải được", false);
    showSetup(error.message);
    grid.innerHTML = '<div class="empty">Chưa đọc được thư viện. Kiểm tra đăng nhập và cấu hình kết nối, sau đó bấm Làm mới.</div>';
  } finally {
    loading = false;
  }
}
function renderPreview(item) {
  const box = document.createElement("div");
  box.className = "preview";
  const url = item.previewUrl || item.fileUrl;
  if (!url) {
    box.textContent = item.type === "Video" ? "▶" : ["Âm thanh", "Nhạc", "Giọng đọc", "Hiệu ứng âm thanh"].includes(item.type) ? "♫" : "▧";
    return box;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new Error("Invalid URL");
    if (item.type === "Hình ảnh" || item.type === "Texture") {
      const img = document.createElement("img");
      img.loading = "lazy";
      img.alt = item.name;
      img.src = parsed.href;
      box.appendChild(img);
    } else if (item.type === "Video") {
      const video = document.createElement("video");
      video.src = parsed.href;
      video.controls = true;
      video.preload = "metadata";
      box.appendChild(video);
    } else if (["Âm thanh", "Nhạc", "Giọng đọc", "Hiệu ứng âm thanh"].includes(item.type)) {
      const audio = document.createElement("audio");
      audio.src = parsed.href;
      audio.controls = true;
      box.appendChild(audio);
    } else {
      box.textContent = "▧";
    }
  } catch {
    box.textContent = "▧";
  }
  return box;
}
function addSafeLink(container, href, label) {
  if (!href) return;
  try {
    const url = new URL(href);
    if (url.protocol !== "https:") return;
    const link = document.createElement("a");
    link.href = url.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;
    container.appendChild(link);
  } catch {}
}
function renderMaterials() {
  const q = $("searchMaterials").value.trim().toLocaleLowerCase("vi");
  const type = $("filterType").value;
  const filtered = materials.filter(item => {
    if (type && item.type !== type) return false;
    const text = [item.name, item.note, item.type, ...(item.tags || []), ...(item.roles || [])].join(" ").toLocaleLowerCase("vi");
    return !q || text.includes(q);
  });
  grid.replaceChildren();
  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = materials.length ? "Không tìm thấy vật liệu phù hợp." : "Thư viện chưa có vật liệu. Bấm “Thêm vật liệu” để bắt đầu.";
    grid.appendChild(empty);
    return;
  }
  for (const item of filtered) {
    const card = document.createElement("article");
    card.className = "card";
    card.appendChild(renderPreview(item));
    const body = document.createElement("div");
    body.className = "cardbody";
    const name = document.createElement("strong");
    name.textContent = item.name || "Vật liệu không tên";
    body.appendChild(name);
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = [item.type, item.storage, item.license, item.format, item.sizeMb ? item.sizeMb + " MB" : ""].filter(Boolean).join(" · ");
    body.appendChild(meta);
    if (item.note) {
      const note = document.createElement("div");
      note.className = "note";
      note.textContent = item.note;
      body.appendChild(note);
    }
    const links = document.createElement("div");
    links.className = "cardlinks";
    addSafeLink(links, item.url, "Mở trong Notion");
    if (item.storage === "Notion" && !item.notionFileName) {
      const hint = document.createElement("span");
      hint.className = "meta";
      hint.textContent = "Chưa đính kèm tệp";
      links.appendChild(hint);
    } else {
      addSafeLink(links, item.fileUrl, "Mở tệp");
    }
    addSafeLink(links, item.sourceUrl, "Nguồn");
    body.appendChild(links);
    card.appendChild(body);
    grid.appendChild(card);
  }
}
$("newMaterial").addEventListener("click", () => {
  if (!state.notionAvailable) {
    showSetup("Cần kết nối Notion với Geed trước khi lưu mục mới. Xem docs/NOTION-MATERIAL-LIBRARY.md.");
    return;
  }
  form.reset();
  dialog.showModal();
});
$("closeMaterial").addEventListener("click", () => dialog.close());
$("cancelMaterial").addEventListener("click", () => dialog.close());
form.addEventListener("submit", async event => {
  event.preventDefault();
  const save = $("saveMaterial");
  save.disabled = true;
  save.textContent = "Đang lưu…";
  try {
    const data = new FormData(form);
    const rawTags = String(data.get("tags") || "").split(",").map(v => v.trim()).filter(v => allowedTags.has(v));
    const payload = {
      name: data.get("name"),
      type: data.get("type"),
      roles: data.get("role") ? [data.get("role")] : [],
      sourceUrl: data.get("sourceUrl"),
      fileUrl: data.get("fileUrl"),
      previewUrl: data.get("previewUrl"),
      format: data.get("format"),
      resolution: data.get("resolution"),
      sizeMb: Number(data.get("sizeMb")),
      durationSeconds: Number(data.get("durationSeconds")),
      tags: rawTags,
      note: data.get("note"),
      license: data.get("license")
    };
    const auth = await authHeaders();
    const result = await requestJson("/api/materials", {
      method: "POST",
      headers: auth,
      body: JSON.stringify(payload)
    });
    dialog.close();
    await loadMaterials();
    if (result.item?.url) {
      showSetup("Đã tạo mục vật liệu. Mở thẻ của mục này trong Notion, tải tệp vào thuộc tính “Tệp Notion”, rồi quay lại Geed và bấm “Làm mới” để xem trước.");
    }
  } catch (error) {
    showSetup(error.message);
  } finally {
    save.disabled = false;
    save.textContent = "Lưu vật liệu";
  }
});
$("refreshMaterials").addEventListener("click", loadMaterials);
$("searchMaterials").addEventListener("input", renderMaterials);
$("filterType").addEventListener("change", renderMaterials);
window.addEventListener("geed-auth-change", () => loadMaterials());
await loadMaterials();
