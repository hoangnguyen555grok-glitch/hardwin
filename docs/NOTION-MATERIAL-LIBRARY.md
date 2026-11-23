# Geed Hardwin — Notion input material library

## Storage architecture

**Notion database link:** https://app.notion.com/p/421d38d6eafa81c4ae05e5206c0f29ed

This link is a stable reference to the source-material catalogue, not a public file-hosting URL. Geed reads the database through the Notion API using a private integration token stored only in Vercel.

- Notion is the home for the material files: images, video, audio, voices, music, fonts, textures and other reusable assets.
- The database stores metadata (name, type, role, source, licence, dimensions, keywords and notes) and a native **Tệp Notion** Files property. Rows created from Geed store the signed-in account ID in **Người tạo**; rows added manually in Notion can leave **Người tạo** empty and are treated as shared source materials.
- GitHub stores only application source code, the Notion database/data-source IDs and references. Do not commit media binaries to GitHub.
- Geed reads file metadata and short-lived download URLs from Notion. Notion's file URLs expire, so the API re-queries the database when the user refreshes Geed.

The materials page is `/materials.html`. It includes a direct **Mở kho Notion** link and supports catalogue browsing, search, type filtering, metadata creation and image/video/audio previews. A material can be attached from its Notion row using the native **Tệp Notion** property.

## 1. Connect Notion to Geed

1. In Notion, open Settings → Connections and create an internal connection named **Geed Hardwin**.
2. Give it permission to read content and insert/update content.
3. Open the database **Geed Hardwin — Thư viện vật liệu**, choose Share, and invite the Geed Hardwin connection.
4. Confirm the database contains a **Tệp Notion** property of type **Files**. This property has already been added to the current Geed database.
5. Copy the internal integration secret. Keep it private; do not paste it into chat or browser code.
6. In Vercel → Geed Hardwin → Settings → Environment Variables, add:
   - `GEED_NOTION_API_TOKEN` — the internal integration secret.
   - `GEED_NOTION_DATA_SOURCE_ID` — `421d38d6-eafa-8116-8ec2-000bff1b1ed1`.
7. Add the variables to **Preview** first. Configure **Production** only after the pull request has been reviewed, approved and merged.

The API returns rows created by the signed-in Geed user plus rows whose **Người tạo** field is empty (shared Notion library entries). Rows created by other Geed accounts are not returned. Notion and Supabase secrets remain on the server.

## 2. Add an asset

Bạn có thể thêm vật liệu theo một trong hai cách:

**Thêm trực tiếp trong Notion (không cần tạo trước trong Geed):**
1. Mở database **Geed Hardwin — Thư viện vật liệu**.
2. Tạo một dòng mới; nhập tên ở **Vật liệu**, chọn **Loại** (ví dụ **Hình ảnh**), và đính kèm tệp ở **Tệp Notion**.
3. Có thể để trống **Người tạo**. Geed coi dòng này là tài nguyên dùng chung và hiển thị cho người đã đăng nhập.
4. Quay lại Geed. Trang tự kiểm tra cập nhật khoảng mỗi 30 giây khi đang mở; khi chuyển tab quay lại cũng sẽ tải mới. Nút **Làm mới** vẫn có thể dùng thủ công.

**Hoặc tạo từ Geed:**
1. Sign in to Geed and open **Thư viện vật liệu**.
2. Choose **Thêm vật liệu**, enter its metadata and save it.
3. In the new material card, choose **Mở trong Notion**.
4. On that Notion database row, find the **Tệp Notion** property and attach the original file. Do not paste a temporary Notion download URL into GitHub or another metadata field.
5. Return to Geed. Geed automatically refreshes the library, and you can also choose **Làm mới**.

This first version intentionally uses Notion's native attachment UI for the binary upload. It does not expose the Notion integration secret to the browser and it does not send large files through a Vercel Function request body. The Notion workspace's own file-size limits still apply.

## 3. Preview and video export

- Image, video and audio assets attached in **Tệp Notion** can be previewed on their Geed material cards.
- Finished animation preview is rendered in the browser and can be downloaded directly to the local device.
- R2 is a separate output store, not part of this Notion library. After Notion is connected, the separate R2 step will keep finished MP4/WebM renders for the later YouTube/TikTok publishing connector. Do not put finished exports into the Notion source-material database.

## 4. Expiring Notion file URLs

Notion returns signed file URLs that expire. Geed requests the data source on initial load, about every 30 seconds while the page is visible, when the tab regains focus, and when the user presses refresh, so the newest file URLs are used. Treat these URLs as temporary access links, not permanent asset identifiers.

## Security and repository hygiene

- Never put the Notion integration secret in HTML, browser JavaScript, GitHub commits or chat.
- Store only application code, database IDs and stable Notion page/data-source references in GitHub.
- Do not commit downloaded media files, exported videos, generated images or audio assets to the repository.
- Every row returned to a user is scoped to that user's Supabase ID.
