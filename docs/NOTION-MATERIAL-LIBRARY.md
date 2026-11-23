# Geed Hardwin — Notion input material library

## Storage architecture

**Notion database link:** https://app.notion.com/p/421d38d6eafa81c4ae05e5206c0f29ed

This link is a stable reference to the source-material catalogue, not a public file-hosting URL. Geed reads the database through the Notion API using a private integration token stored only in Vercel.

- Notion is the home for the material files: images, video, audio, voices, music, fonts, textures and other reusable assets.
- The database stores metadata (name, type, role, source, licence, dimensions, keywords, notes), the creator's Geed account ID, and a native **Tệp Notion** Files property.
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

The API filters each database query by the signed-in Geed user's ID. Notion and Supabase secrets remain on the server.

## 2. Add an asset

1. Sign in to Geed and open **Thư viện vật liệu**.
2. Choose **Thêm vật liệu**, enter its metadata and save it.
3. In the new material card, choose **Mở trong Notion**.
4. On that Notion database row, find the **Tệp Notion** property and attach the original file. Do not paste a temporary Notion download URL into GitHub or another metadata field.
5. Return to Geed and choose **Làm mới**. Geed reads the current Files property and receives a fresh preview/download URL from Notion.

This first version intentionally uses Notion's native attachment UI for the binary upload. It does not expose the Notion integration secret to the browser and it does not send large files through a Vercel Function request body. The Notion workspace's own file-size limits still apply.

## 3. Preview and video export

- Image, video and audio assets attached in **Tệp Notion** can be previewed on their Geed material cards.
- Finished animation preview is rendered in the browser and can be downloaded directly to the local device.
- R2 is a separate output store, not part of this Notion library. After Notion is connected, the separate R2 step will keep finished MP4/WebM renders for the later YouTube/TikTok publishing connector. Do not put finished exports into the Notion source-material database.

## 4. Expiring Notion file URLs

Notion returns signed file URLs that expire. Geed requests the data source again when the user refreshes the materials list, so the newest file URLs are used. Treat these URLs as temporary access links, not permanent asset identifiers.

## Security and repository hygiene

- Never put the Notion integration secret in HTML, browser JavaScript, GitHub commits or chat.
- Store only application code, database IDs and stable Notion page/data-source references in GitHub.
- Do not commit downloaded media files, exported videos, generated images or audio assets to the repository.
- Every row returned to a user is scoped to that user's Supabase ID.
