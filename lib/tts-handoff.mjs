const DB_NAME = "geed-hardwin-audio-handoff";
const DB_VERSION = 1;
const STORE_NAME = "generated";

function openHandoffDatabase() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("Trình duyệt này chưa hỗ trợ lưu âm thanh tạm bằng IndexedDB."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Không mở được kho âm thanh tạm."));
    request.onblocked = () => reject(new Error("Kho âm thanh tạm đang bị một tab khác khóa."));
  });
}

function createTransferId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
}

export async function storeGeneratedAudio(blob, filename) {
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new TypeError("Không có file âm thanh hợp lệ để chuyển sang trình biên tập.");
  }

  const id = createTransferId();
  const database = await openHandoffDatabase();

  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({
        id,
        blob,
        filename: String(filename || "geed-voice.wav"),
        contentType: blob.type || "audio/wav",
        createdAt: Date.now()
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Không lưu được file âm thanh tạm."));
      transaction.onabort = () => reject(transaction.error || new Error("Thao tác lưu âm thanh đã bị hủy."));
    });
    return id;
  } finally {
    database.close();
  }
}

export async function takeGeneratedAudio(id) {
  if (!id || typeof id !== "string") return null;
  const database = await openHandoffDatabase();

  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      let file = null;

      request.onsuccess = () => {
        const record = request.result;
        if (!record || !(record.blob instanceof Blob)) return;
        file = new File(
          [record.blob],
          record.filename || "geed-voice.wav",
          { type: record.contentType || record.blob.type || "audio/wav" }
        );
        store.delete(id);
      };

      request.onerror = () => reject(request.error || new Error("Không đọc được file âm thanh tạm."));
      transaction.oncomplete = () => resolve(file);
      transaction.onerror = () => reject(transaction.error || new Error("Không nhận được file âm thanh tạm."));
      transaction.onabort = () => reject(transaction.error || new Error("Thao tác nhận âm thanh đã bị hủy."));
    });
  } finally {
    database.close();
  }
}
