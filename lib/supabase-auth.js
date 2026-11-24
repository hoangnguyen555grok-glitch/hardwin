import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.2/+esm";

const SUPABASE_URL = "https://rdzitdoarrfjugzogkrf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_yywGTcsZLFA33hUw5Yl8sw_nAbdS5zB";

const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
    persistSession: true,
    storageKey: "geed-hardwin-auth-v1"
  }
});

const accountButton = document.getElementById("accountButton");
const accountButtonLabel = document.getElementById("accountButtonLabel");
const accountArea = document.getElementById("accountArea");
const accountMenu = document.getElementById("accountMenu");
const accountStatus = document.getElementById("accountStatus");
const accountDialog = document.getElementById("accountDialog");
const accountDialogTitle = document.getElementById("accountDialogTitle");
const accountDialogContent = document.getElementById("accountDialogContent");
const accountDialogPrimary = document.getElementById("accountDialogPrimary");
const toastElement = document.getElementById("toast");
let currentUser = null;

function notify(message) {
  if (!toastElement) return;
  toastElement.textContent = String(message);
  toastElement.classList.add("show");
  window.setTimeout(() => toastElement.classList.remove("show"), 4200);
}

function getDisplayName(user) {
  const metadata = user?.user_metadata || {};
  return String(metadata.full_name || metadata.name || user?.email?.split("@")[0] || "Người dùng").trim();
}

function getSafeAvatarUrl(user) {
  const raw = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || "";
  if (typeof raw !== "string" || !raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return "";
    if (url.hostname !== "lh3.googleusercontent.com" && !url.hostname.endsWith(".googleusercontent.com")) return "";
    return url.href;
  } catch {
    return "";
  }
}

function setAvatar(imgId, fallbackId, user) {
  const image = document.getElementById(imgId);
  const fallback = document.getElementById(fallbackId);
  if (!image || !fallback) return;
  const initial = getDisplayName(user).charAt(0).toLocaleUpperCase("vi") || "G";
  fallback.textContent = initial;
  fallback.hidden = true;
  image.hidden = true;
  image.removeAttribute("src");
  const avatarUrl = getSafeAvatarUrl(user);
  if (!avatarUrl) {
    fallback.hidden = false;
    return;
  }
  image.onload = () => {
    image.hidden = false;
    fallback.hidden = true;
  };
  image.onerror = () => {
    image.hidden = true;
    fallback.hidden = false;
    image.removeAttribute("src");
  };
  image.src = avatarUrl;
}

function closeAccountMenu() {
  if (!accountMenu || !accountButton) return;
  accountMenu.hidden = true;
  accountButton.setAttribute("aria-expanded", "false");
}

function toggleAccountMenu() {
  if (!currentUser) {
    startGoogleSignIn();
    return;
  }
  if (!accountMenu || !accountButton) return;
  accountMenu.hidden = !accountMenu.hidden;
  accountButton.setAttribute("aria-expanded", String(!accountMenu.hidden));
}

function appendText(parent, tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  parent.appendChild(element);
  return element;
}

function openAccountDialog(kind) {
  if (!accountDialog || !accountDialogContent || !accountDialogTitle || !accountDialogPrimary) return;
  accountDialogContent.replaceChildren();
  accountDialog.dataset.kind = kind;

  if (kind === "profile") {
    accountDialogTitle.textContent = "Hồ sơ tài khoản";
    accountDialogPrimary.textContent = "Đóng";
    const card = appendText(accountDialogContent, "div", "account-profile-card", "");
    const avatarWrap = document.createElement("span");
    avatarWrap.className = "account-avatar account-dialog-avatar";
    const avatar = document.createElement("img");
    avatar.alt = "";
    avatar.referrerPolicy = "no-referrer";
    avatar.hidden = true;
    const fallback = appendText(avatarWrap, "span", "account-avatar-fallback", getDisplayName(currentUser).charAt(0).toLocaleUpperCase("vi") || "G");
    avatarWrap.appendChild(avatar);
    card.appendChild(avatarWrap);
    const copy = appendText(card, "div", "account-profile-copy", "");
    appendText(copy, "h3", "", getDisplayName(currentUser));
    appendText(copy, "p", "", currentUser?.email || "Không có địa chỉ email được cung cấp");
    const avatarUrl = getSafeAvatarUrl(currentUser);
    if (avatarUrl) {
      avatar.onload = () => { avatar.hidden = false; fallback.hidden = true; };
      avatar.onerror = () => { avatar.hidden = true; fallback.hidden = false; };
      avatar.src = avatarUrl;
    }
    appendText(accountDialogContent, "span", "account-provider-pill", "✓ Đã kết nối bằng Google");
    appendText(accountDialogContent, "p", "account-dialog-note", "Thông tin hồ sơ được lấy từ tài khoản Google đang đăng nhập. Dự án hoạt hình và tài nguyên vẫn được lưu trên thiết bị cho đến khi có tính năng đồng bộ cloud riêng.");
  } else if (kind === "settings") {
    accountDialogTitle.textContent = "Cài đặt trình biên tập";
    accountDialogPrimary.textContent = "Lưu cài đặt";
    const fpsCurrent = document.getElementById("fpsSelect");
    const durationCurrent = document.getElementById("durationInput");
    const fpsRow = appendText(accountDialogContent, "label", "account-setting-row", "Tốc độ khung hình");
    const fpsSelect = document.createElement("select");
    fpsSelect.id = "accountSettingsFps";
    [12, 24, 30, 60].forEach(value => {
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = value + " FPS";
      fpsSelect.appendChild(option);
    });
    fpsSelect.value = fpsCurrent?.value || "24";
    fpsRow.appendChild(fpsSelect);

    const durationRow = appendText(accountDialogContent, "label", "account-setting-row", "Thời lượng cảnh");
    const durationInput = document.createElement("input");
    durationInput.id = "accountSettingsDuration";
    durationInput.type = "number";
    durationInput.min = "1";
    durationInput.max = "120";
    durationInput.step = "1";
    durationInput.value = durationCurrent?.value || "5";
    durationRow.appendChild(durationInput);
    appendText(accountDialogContent, "p", "account-dialog-note", "Các thay đổi này cập nhật trực tiếp thiết lập FPS và thời lượng trên timeline hiện tại.");
  } else if (kind === "help") {
    accountDialogTitle.textContent = "Trợ giúp và phím tắt";
    accountDialogPrimary.textContent = "Đóng";
    const list = appendText(accountDialogContent, "div", "account-help-list", "");
    const shortcuts = [
      ["Ctrl + Z", "Hoàn tác thao tác gần nhất"],
      ["Ctrl + Shift + Z", "Làm lại thao tác"],
      ["Delete / Backspace", "Xóa layer đang chọn"],
      ["Space", "Phát hoặc tạm dừng hoạt ảnh"]
    ];
    shortcuts.forEach(([key, description]) => {
      const row = appendText(list, "div", "account-help-row", "");
      appendText(row, "kbd", "", key);
      appendText(row, "span", "", description);
    });
    appendText(accountDialogContent, "p", "account-dialog-note", "Mẹo: dùng nút Save project để tải bản sao dự án JSON về máy và Open project để mở lại.");
  }

  closeAccountMenu();
  if (!accountDialog.open) accountDialog.showModal();
}

async function startGoogleSignIn() {
  if (accountButton) accountButton.disabled = true;
  try {
    const redirectTo = new URL("/", window.location.origin).toString();
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { prompt: "select_account" }
      }
    });
    if (error) throw error;
  } catch (error) {
    console.error("Google sign-in failed:", error);
    const errorCode = String(error?.code || "");
    const errorMessage = String(error?.message || "");
    if (errorCode === "validation_failed" || /provider is not enabled|unsupported provider/i.test(errorMessage)) {
      notify("Google Provider chưa bật trong Supabase. Chủ dự án cần bật Google và thêm OAuth Web Client ID/Secret trong Authentication → Providers → Google.");
    } else {
      notify("Đăng nhập Google chưa thành công: " + (errorMessage || "Vui lòng kiểm tra cấu hình OAuth."));
    }
    if (accountButton) accountButton.disabled = false;
  }
}

async function signOut() {
  if (accountButton) accountButton.disabled = true;
  closeAccountMenu();
  try {
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw error;
    notify("Đã đăng xuất. Dự án lưu trên thiết bị vẫn được giữ nguyên.");
  } catch (error) {
    console.error("Sign-out failed:", error);
    notify("Đăng xuất chưa thành công. Vui lòng thử lại.");
  } finally {
    if (accountButton) accountButton.disabled = false;
  }
}

function renderSession(session) {
  const user = session?.user || null;
  currentUser = user;
  const displayName = user ? getDisplayName(user) : "Đăng nhập Google";
  const email = user?.email || (user ? "Tài khoản Google" : "Chưa đăng nhập");

  if (accountButton) {
    accountButton.dataset.authenticated = user ? "true" : "false";
    accountButton.title = user ? `Mở menu tài khoản: ${displayName}` : "Đăng nhập bằng Google";
    accountButton.setAttribute("aria-label", user ? `Mở menu tài khoản: ${displayName}` : "Đăng nhập bằng Google");
    accountButton.setAttribute("aria-expanded", "false");
    accountButton.disabled = false;
    if (accountButtonLabel) accountButtonLabel.textContent = displayName;
    const avatarWrap = document.getElementById("accountAvatarWrap");
    if (avatarWrap) avatarWrap.hidden = !user;
    setAvatar("accountAvatar", "accountAvatarFallback", user);
    if (!user) {
      const fallback = document.getElementById("accountAvatarFallback");
      if (fallback) fallback.textContent = "G";
    }
  }
  if (accountMenu) accountMenu.hidden = !user;
  const menuName = document.getElementById("accountMenuName");
  const menuEmail = document.getElementById("accountMenuEmail");
  if (menuName) menuName.textContent = user ? displayName : "Tài khoản Geed Hardwin";
  if (menuEmail) menuEmail.textContent = email;
  setAvatar("accountMenuAvatar", "accountMenuAvatarFallback", user);

  if (accountStatus) {
    accountStatus.textContent = user ? (user.email || "Đã đăng nhập") : "Lưu dự án trên thiết bị";
    accountStatus.title = user ? "Tài khoản Geed Hardwin đã kết nối" : "Không cần tài khoản để tiếp tục dùng trình biên tập";
  }
  window.dispatchEvent(new CustomEvent("geed-auth-change", {
    detail: {
      authenticated: Boolean(user),
      user: user ? {
        id: user.id,
        email: user.email || null,
        name: displayName,
        avatarUrl: getSafeAvatarUrl(user)
      } : null
    }
  }));
}

if (accountButton) {
  accountButton.addEventListener("click", toggleAccountMenu);
}
document.getElementById("accountProfileItem")?.addEventListener("click", () => openAccountDialog("profile"));
document.getElementById("accountSettingsItem")?.addEventListener("click", () => openAccountDialog("settings"));
document.getElementById("accountHelpItem")?.addEventListener("click", () => openAccountDialog("help"));
document.getElementById("accountLibraryItem")?.addEventListener("click", () => {
  closeAccountMenu();
  const target = document.getElementById("resourceLibraryList");
  const section = target?.closest(".section");
  if (section) {
    section.scrollIntoView({ behavior: "smooth", block: "nearest" });
    section.classList.remove("account-highlight");
    window.requestAnimationFrame(() => section.classList.add("account-highlight"));
    notify("Đã mở khu vực Thư viện tài nguyên.");
  } else {
    notify("Không tìm thấy khu vực Thư viện tài nguyên.");
  }
});
document.getElementById("accountSignOut")?.addEventListener("click", signOut);
document.getElementById("accountDialogClose")?.addEventListener("click", () => accountDialog?.close());
accountDialogPrimary?.addEventListener("click", () => {
  if (accountDialog?.dataset.kind === "settings") {
    const fpsCurrent = document.getElementById("fpsSelect");
    const durationCurrent = document.getElementById("durationInput");
    const fpsValue = document.getElementById("accountSettingsFps")?.value;
    const durationValue = Number(document.getElementById("accountSettingsDuration")?.value);
    if (!fpsCurrent || !durationCurrent || ![12, 24, 30, 60].includes(Number(fpsValue)) || !Number.isFinite(durationValue) || durationValue < 1 || durationValue > 120) {
      notify("Cài đặt chưa hợp lệ. Thời lượng phải từ 1 đến 120 giây.");
      return;
    }
    fpsCurrent.value = fpsValue;
    fpsCurrent.dispatchEvent(new Event("change", { bubbles: true }));
    durationCurrent.value = String(Math.round(durationValue));
    durationCurrent.dispatchEvent(new Event("change", { bubbles: true }));
    notify("Đã lưu cài đặt trình biên tập.");
  }
  accountDialog?.close();
});
accountDialog?.addEventListener("click", event => {
  if (event.target === accountDialog) accountDialog.close();
});
document.addEventListener("pointerdown", event => {
  if (accountArea && !accountArea.contains(event.target)) closeAccountMenu();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeAccountMenu();
});

client.auth.onAuthStateChange((_event, session) => {
  renderSession(session);
});

const { data, error } = await client.auth.getSession();
if (error) {
  console.error("Could not restore Supabase session:", error);
  if (accountStatus) accountStatus.textContent = "Tài khoản chưa kết nối";
} else {
  renderSession(data.session);
}

async function saveAiMemory({ content, retentionDays, memoryType = "context" } = {}) {
  const text = typeof content === "string" ? content.trim() : "";
  if (!text || text.length > 1000) throw new Error("AI memory must contain 1–1000 characters.");
  if (![2, 3, 7, 30].includes(Number(retentionDays))) throw new Error("Choose a 2, 3, 7 or 30-day retention period.");
  if (!["context", "task", "preference", "checkpoint"].includes(memoryType)) throw new Error("Invalid AI memory type.");
  if (/(?:api[_ -]?key|password|secret|access[_ -]?token|refresh[_ -]?token|private key)\s*[:=]/i.test(text)) {
    throw new Error("Credentials and secrets cannot be saved as AI memory.");
  }

  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session?.user?.id) throw new Error("Sign in with Google before saving AI memory.");

  const days = Number(retentionDays);
  const { data, error } = await client.from("ai_memories").insert({
    user_id: sessionData.session.user.id,
    memory_type: memoryType,
    content: text,
    retention_days: days
  }).select("id, memory_type, content, retention_days, expires_at, created_at").single();
  if (error) throw error;
  return data;
}

async function listAiMemories() {
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session?.user?.id) throw new Error("Sign in with Google to view AI memory.");

  const { data, error } = await client.from("ai_memories")
    .select("id, memory_type, content, retention_days, expires_at, created_at")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function deleteAiMemory(id) {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid AI memory identifier.");
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session?.user?.id) throw new Error("Sign in with Google to delete AI memory.");

  const { error } = await client.from("ai_memories").delete().eq("id", id);
  if (error) throw error;
  return true;
}

window.GeedHardwinAuth = Object.freeze({
  getAccessToken: async () => {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    return sessionData.session?.access_token || null;
  },
  getUser: async () => {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError) throw userError;
    return userData.user || null;
  },
  saveAiMemory,
  listAiMemories,
  deleteAiMemory
});

/* Load Adobe-parity tools (v1.31) without rewriting index.html */
(function loadAdobeParity(){
  if (document.querySelector('script[data-adobe-parity]')) return;
  const s = document.createElement('script');
  s.src = '/adobe-parity-v131.js';
  s.defer = true;
  s.dataset.adobeParity = '1';
  document.head.appendChild(s);
})();
