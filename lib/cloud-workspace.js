const $ = id => document.getElementById(id);
const dialog = $('cloudWorkspaceDialog');
const statusNode = $('cloudWorkspaceStatus');
const storageNode = $('cloudWorkspaceStorage');
const projectList = $('cloudWorkspaceProjects');
const nameInput = $('cloudProjectName');
const openButton = $('cloudWorkspaceOpen');
const saveButton = $('cloudSaveCurrent');
const saveAsButton = $('cloudSaveAsNew');

let currentUserId = null;
let busy = false;

function showStatus(message, isError = false) {
  if (!statusNode) return;
  statusNode.textContent = message;
  statusNode.dataset.state = isError ? 'error' : 'normal';
}

function formatBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function formatDate(value) {
  if (!value) return 'Chưa có thời gian lưu';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa có thời gian lưu' : date.toLocaleString();
}

async function getSessionContext() {
  const auth = window.GeedHardwinAuth;
  if (!auth?.getAccessToken || !auth?.getUser) throw new Error('Dịch vụ tài khoản chưa sẵn sàng. Hãy tải lại trang.');
  const [token, user] = await Promise.all([auth.getAccessToken(), auth.getUser()]);
  if (!token || !user?.id) throw new Error('Bạn cần đăng nhập Google để dùng Cloud Workspace.');
  return { token, user };
}

async function cloudApi(payload) {
  const { token } = await getSessionContext();
  const response = await fetch('/api/cloud/workspace', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer ' + token
    },
    body: JSON.stringify(payload),
    cache: 'no-store'
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || 'Không thể kết nối Cloud Workspace.');
    error.code = result.code || 'CLOUD_WORKSPACE_ERROR';
    error.status = response.status;
    throw error;
  }
  return result;
}

function openProjectDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('Trình duyệt không hỗ trợ IndexedDB.'));
      return;
    }
    const request = indexedDB.open('GeedHardwinStudio', 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('projects')) {
        request.result.createObjectStore('projects');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Không thể mở kho lưu trữ cục bộ.'));
  });
}

async function getStoredProjectKey(userId, create = false) {
  const key = 'cloudProjectKey:' + userId;
  const db = await openProjectDatabase();
  try {
    const existing = await new Promise((resolve, reject) => {
      const request = db.transaction('projects', 'readonly').objectStore('projects').get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    if (existing || !create) return existing;
    const generated = crypto.randomUUID();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('projects', 'readwrite');
      transaction.objectStore('projects').put(generated, key);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Không thể lưu mã dự án.'));
    });
    return generated;
  } finally {
    db.close();
  }
}

async function setStoredProjectKey(userId, projectKey) {
  const db = await openProjectDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('projects', 'readwrite');
      transaction.objectStore('projects').put(projectKey, 'cloudProjectKey:' + userId);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Không thể ghi mã dự án.'));
    });
  } finally {
    db.close();
  }
}

async function sha256Hex(arrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function setBusy(value) {
  busy = Boolean(value);
  [saveButton, saveAsButton].forEach(button => {
    if (button) button.disabled = busy;
  });
  if (openButton) openButton.disabled = busy;
}

function renderProjects(projects) {
  if (!projectList) return;
  projectList.replaceChildren();
  if (!projects.length) {
    const empty = document.createElement('p');
    empty.className = 'cloud-workspace-empty';
    empty.textContent = 'Chưa có dự án nào được lưu trên Cloud.';
    projectList.appendChild(empty);
    return;
  }
  for (const project of projects) {
    const row = document.createElement('div');
    row.className = 'cloud-workspace-project';
    const details = document.createElement('div');
    details.className = 'cloud-workspace-project-details';
    const title = document.createElement('strong');
    title.textContent = project.name || 'Dự án không tên';
    const metadata = document.createElement('small');
    metadata.textContent = formatBytes(project.cloud_size_bytes) + ' · Phiên bản ' +
      (Number(project.cloud_version) || 1) + ' · ' + formatDate(project.cloud_saved_at);
    details.append(title, metadata);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ghost';
    button.textContent = 'Mở';
    button.addEventListener('click', () => openCloudProject(project));
    row.append(details, button);
    projectList.appendChild(row);
  }
}

async function refreshProjects() {
  const { user } = await getSessionContext();
  currentUserId = user.id;
  const result = await cloudApi({ action: 'list' });
  renderProjects(result.projects || []);
  if (storageNode) {
    const used = formatBytes(result.storage?.usedBytes || 0);
    const limit = formatBytes(result.storage?.limitBytes || 0);
    storageNode.textContent = 'Dung lượng đã dùng: ' + used + ' / ' + limit;
    if (!(Number(result.storage?.limitBytes) > 0)) {
      storageNode.textContent += ' · Cloud chưa được cấp hạn mức cho tài khoản này.';
    }
  }
}

async function saveProject(asNew = false) {
  if (busy) return;
  setBusy(true);
  let reservationId = null;
  try {
    const { user } = await getSessionContext();
    const bridge = window.GeedHardwinBridge;
    if (!bridge?.getProjectSnapshot) throw new Error('Trình biên tập chưa sẵn sàng để lưu.');
    const snapshot = bridge.getProjectSnapshot();
    if (snapshot?.format !== 'geed-hardwin-project' || !Array.isArray(snapshot.scenes) || !snapshot.scenes.length) {
      throw new Error('Dữ liệu dự án hiện tại không hợp lệ.');
    }
    const name = String(nameInput?.value || '').trim().slice(0, 160) || 'Dự án hoạt hình';
    const projectKey = asNew ? crypto.randomUUID() : await getStoredProjectKey(user.id, true);
    const blob = new Blob([JSON.stringify(snapshot)], { type: 'application/json' });
    if (blob.size > 50 * 1024 * 1024) {
      throw new Error('Dự án lớn hơn giới hạn 50 MB của bản Cloud Workspace đầu tiên.');
    }
    showStatus('Đang kiểm tra hạn mức và chuẩn bị tệp…');
    const buffer = await blob.arrayBuffer();
    const checksum = await sha256Hex(buffer);
    const prepared = await cloudApi({
      action: 'prepare-save',
      projectKey,
      name,
      schemaVersion: Number(snapshot.version) || 1,
      byteSize: blob.size
    });
    reservationId = prepared.reservationId;
    showStatus('Đang tải dự án lên kho riêng…');
    const upload = await fetch(prepared.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: blob,
      cache: 'no-store'
    });
    if (!upload.ok) throw new Error('Kho Cloud từ chối tệp tải lên. Kiểm tra quyền CORS của bucket rồi thử lại.');
    showStatus('Đã tải tệp. Đang xác nhận và ghi thông tin dự án…');
    await cloudApi({
      action: 'complete-save',
      reservationId,
      projectKey,
      name,
      schemaVersion: Number(snapshot.version) || 1,
      byteSize: blob.size,
      sha256: checksum
    });
    reservationId = null;
    await setStoredProjectKey(user.id, projectKey);
    if (nameInput) nameInput.value = name;
    showStatus('Đã lưu dự án lên Cloud. Bản lưu cục bộ vẫn được giữ nguyên.');
    try { await refreshProjects(); } catch (error) {
      console.warn('Cloud save succeeded but list refresh failed:', error);
    }
  } catch (error) {
    if (reservationId) {
      try { await cloudApi({ action: 'cancel-save', reservationId }); } catch { /* Expired reservations are cleaned up by the database. */ }
    }
    const message = error?.code === 'CLOUD_STORAGE_NOT_CONFIGURED'
      ? 'Cloud chưa kết nối kho R2. Cần bật R2 và cấu hình khóa ở server.'
      : error?.code === 'CLOUD_STORAGE_NOT_ALLOWED'
        ? 'Tài khoản chưa được cấp dung lượng Cloud. Dữ liệu trên máy vẫn an toàn.'
        : error?.code === 'CLOUD_STORAGE_QUOTA_EXCEEDED'
          ? 'Đã hết hạn mức Cloud của tài khoản. Hãy dọn bớt dự án hoặc tăng hạn mức có kiểm soát.'
          : (error?.message || 'Không thể lưu dự án lên Cloud.');
    showStatus(message, true);
  } finally {
    setBusy(false);
  }
}

async function openCloudProject(project) {
  if (busy) return;
  setBusy(true);
  try {
    const { user } = await getSessionContext();
    showStatus('Đang lấy liên kết tải riêng tư…');
    const prepared = await cloudApi({
      action: 'prepare-open',
      projectKey: project.local_project_key
    });
    const response = await fetch(prepared.downloadUrl, { method: 'GET', cache: 'no-store' });
    if (!response.ok) throw new Error('Không tải được tệp dự án từ kho Cloud.');
    const buffer = await response.arrayBuffer();
    const expectedHash = String(prepared.project?.cloud_sha256 || '').toLowerCase();
    if (expectedHash && await sha256Hex(buffer) !== expectedHash) {
      throw new Error('Kiểm tra SHA-256 không khớp. Dự án chưa được mở để tránh nạp dữ liệu lỗi.');
    }
    const snapshot = JSON.parse(new TextDecoder().decode(buffer));
    if (snapshot?.format !== 'geed-hardwin-project' || !Array.isArray(snapshot.scenes)) {
      throw new Error('Tệp Cloud không phải dự án Geed Hardwin hợp lệ.');
    }
    const bridge = window.GeedHardwinBridge;
    if (!bridge?.loadProjectSnapshot) throw new Error('Trình biên tập chưa sẵn sàng để mở dự án.');
    bridge.loadProjectSnapshot(snapshot);
    await setStoredProjectKey(user.id, project.local_project_key);
    if (nameInput) nameInput.value = project.name || '';
    showStatus('Đã mở dự án Cloud. Bản tự động lưu trên máy đã được cập nhật.');
    dialog?.close();
  } catch (error) {
    showStatus(error?.message || 'Không thể mở dự án Cloud.', true);
  } finally {
    setBusy(false);
  }
}

openButton?.addEventListener('click', async () => {
  if (!dialog) return;
  if (!dialog.open) dialog.showModal();
  showStatus('Đang tải danh sách dự án…');
  try {
    await refreshProjects();
    showStatus('Chọn dự án để mở hoặc lưu dự án hiện tại lên Cloud.');
  } catch (error) {
    renderProjects([]);
    showStatus(error?.message || 'Cloud Workspace chưa sẵn sàng.', true);
  }
});

$('cloudWorkspaceClose')?.addEventListener('click', () => dialog?.close());
saveButton?.addEventListener('click', () => saveProject(false));
saveAsButton?.addEventListener('click', () => saveProject(true));
dialog?.addEventListener('click', event => {
  if (event.target === dialog) dialog.close();
});

window.addEventListener('geed-auth-change', event => {
  const nextUserId = event.detail?.user?.id || null;
  if (nextUserId !== currentUserId) {
    currentUserId = nextUserId;
    renderProjects([]);
    if (storageNode) storageNode.textContent = '';
    if (statusNode) statusNode.textContent = nextUserId
      ? 'Tài khoản đã kết nối. Mở Cloud Workspace để xem dự án.'
      : 'Đăng nhập Google để truy cập dự án Cloud của bạn.';
  }
});

try {
  const { user } = await getSessionContext();
  currentUserId = user.id;
} catch {
  currentUserId = null;
}
