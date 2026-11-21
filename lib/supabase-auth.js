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
const accountStatus = document.getElementById("accountStatus");
const toastElement = document.getElementById("toast");

function notify(message) {
  if (!toastElement) return;
  toastElement.textContent = String(message);
  toastElement.classList.add("show");
  window.setTimeout(() => toastElement.classList.remove("show"), 4200);
}

function renderSession(session) {
  const user = session?.user || null;
  if (accountButton) {
    accountButton.textContent = user ? "Đăng xuất" : "Đăng nhập Google";
    accountButton.title = user ? `Đăng nhập: ${user.email || user.id}. Nhấn để đăng xuất.` : "Đăng nhập bằng Google";
    accountButton.dataset.authenticated = user ? "true" : "false";
  }
  if (accountStatus) {
    accountStatus.textContent = user ? (user.email || "Đã đăng nhập") : "Lưu dự án trên thiết bị";
    accountStatus.title = user ? "Tài khoản Geed Hardwin đã kết nối" : "Không cần tài khoản để tiếp tục dùng trình biên tập";
  }
  window.dispatchEvent(new CustomEvent("geed-auth-change", {
    detail: {
      authenticated: Boolean(user),
      user: user ? { id: user.id, email: user.email || null } : null
    }
  }));
}

async function startGoogleSignIn() {
  if (accountButton) accountButton.disabled = true;
  try {
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });
    if (error) throw error;
  } catch (error) {
    console.error("Google sign-in failed:", error);
    notify("Chưa thể đăng nhập Google. Cần bật Google Provider và hoàn tất OAuth trong Supabase trước.");
    if (accountButton) accountButton.disabled = false;
  }
}

async function signOut() {
  if (accountButton) accountButton.disabled = true;
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

if (accountButton) {
  accountButton.addEventListener("click", async () => {
    const isAuthenticated = accountButton.dataset.authenticated === "true";
    if (isAuthenticated) await signOut();
    else await startGoogleSignIn();
  });
}

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

window.Ge edHardwinAuth = undefined;
window.Ge edHardwinAuth = Object.freeze({
  getAccessToken: async () => {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    return sessionData.session?.access_token || null;
  },
  getUser: async () => {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError) throw userError;
    return userData.user || null;
  }
});
