# Community asset catalog — owner workflow

## Storage model

Geed Hardwin does **not** receive or store community media files in this workflow. The public library is a small static catalog at `assets/community-library.json`. Each entry points to a public HTTPS file hosted by the creator or by a hosting service they control.

The browser reads the catalog from Geed, then loads the selected image or audio file directly from its external host. Geed does not proxy the media bytes, copy them into Supabase, save them to R2, or embed them as base64 in the project. A project stores the external URL and a small amount of resource metadata.

This removes Geed's object-storage usage for these assets. It does **not** make hosting free for the creator: their provider still stores the file and serves the bytes to each viewer. The host may apply bandwidth, request, CORS or access restrictions.

## Add an owner-curated asset

1. Create or edit the graphic/audio in the cloud tools you use.
2. Put the finished file on a public HTTPS object/CDN host that you control. Use a direct file URL, not a share-page URL that needs a login.
3. For images/audio intended to be used by the editor, configure CORS to allow `https://geed-hardwin.vercel.app` (or `*` for intentionally public assets). The editor uses anonymous cross-origin loading so canvas export can read the image.
4. Edit `assets/community-library.json` on GitHub and add a catalog record. Commit the metadata only; do not commit large media binaries to this repository.
5. Check the live page, preview and editor import before keeping the item published.

Example record:

```json
{
  "id": "forest-dawn-bg",
  "title": "Rừng thông buổi sớm",
  "category": "backgrounds",
  "mediaType": "image",
  "url": "https://cdn.example.com/geed/forest-dawn.webp",
  "thumbnailUrl": "https://cdn.example.com/geed/forest-dawn-thumb.webp",
  "description": "Bối cảnh rừng thông có sương nhẹ, khung ngang 16:9.",
  "tags": ["rừng thông", "sương", "buổi sáng"],
  "author": "Geed Hardwin",
  "license": "Geed Hardwin original",
  "attribution": "Thiết kế và sở hữu bởi Geed Hardwin",
  "supportsEditor": true,
  "status": "published"
}
```

Supported categories: `backgrounds`, `characters`, `props`, `audio`, `effects`, `fonts`.

Supported media types in the catalog: `image`, `audio`, `video`, `font`.

In the current editor bridge:
- Images and audio with `supportsEditor: true` can be inserted into the editor by the user or by an allow-listed AI action. A newly inserted community image can then receive one bounded start/end motion via AI, but only while that same unanimated image is selected and identified by its catalog ID. This action does not overwrite an existing animation.
- Video clips can be previewed in the library but are not video layers in the editor timeline yet.
- Fonts can be listed but are not yet loaded from the community catalog.
- Use only direct, public HTTPS file URLs. Avoid URLs containing temporary signatures that expire.

## Community suggestions

The "Đề xuất tài nguyên bằng link" form creates a GitHub issue containing metadata and an external URL. It does not upload the file. The submitter must have a GitHub account. The issue is a review request, not automatic publication.

Only publish an item after checking:
- the URL is publicly reachable and stable;
- the submitter owns the work or has permission to share it;
- the licence/attribution is recorded;
- the file type, dimensions and size are reasonable;
- the host provides CORS headers for editor-capable images/audio.

## Privacy and operating costs

Do not put private project files, personal data, private bucket URLs or account tokens in this public catalog. The catalog and all published media URLs are public. Do not use a user's private upload for AI training or publish it without an explicit rights grant.

Geed's static manifest consumes a small amount of repository/deployment bandwidth, but the image/audio/video bytes stay with the external host. Every viewer downloads from that host directly; hosting and egress cost/limits belong to the external provider/account holder. If we later proxy media through Geed or mirror it into R2, this no-Geed-media-storage model changes and must be reviewed separately.
